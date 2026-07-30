/**
 * Discussion runner: main discussion flow, round progression, status bar.
 * Log prefix: discussion:*
 */

import { postToPanelIframe } from './panel-postmessage.js';
import { getNonMergePanels } from './send-pipeline.js';
import { getPanelDebugInfo, recordDebugLog } from './debug-log.js';
import { getProviderById } from '../../modules/providers.js';
import { cleanAnswer as markdownCleanAnswer, extractTitle as markdownExtractTitle, extractScores } from '../../modules/obsidian-export.js';
import { exportDiscussionResult, exportMergeResult, saveMergeScoresIfPresent } from './markdown-export.js';
import { getSettings } from '../../modules/settings.js';
import { ensurePanelVisibleBeforeAutoSubmit, sendToPanel } from './send-pipeline.js';
import { extractAllAnswers, extractSinglePanelAnswer } from './answer-extractor.js';
import { buildFinalMergePrompt, buildDiscussPrompt, sanitizeMergedAnswerForDiscussion, generateFallbackTitle, isTrueSetting } from './merge-prompt.js';
import {
  stopMergeMonitor,
  clearActiveCompletionSession,
  beginMergeSession,
  invalidateCompletionSessions,
  getActiveMergeSessionId,
  getCompletionSessionGeneration,
  getActiveCompletionSessionGeneration
} from './merge-monitor.js';
import { t } from './i18n.js';
import {
  getCurrentMergeMaxWait,
  waitForDiscussionStartGate,
  waitForDiscussionPanelsCompletionWithAbort,
  waitForDiscussionMergeCompletionWithFallback,
  waitForFinalMergeAnswerBeforeExport
} from './discussion-gates.js';

// ===== Internal State =====
let discussionAbortController = null;
let discussionActive = false;
let lastDiscussionTitle = '';

const DISCUSSION_ROUNDS = 1;

// ===== State Getters/Setters =====
export function getDiscussionActive() { return discussionActive; }
export function getLastDiscussionTitle() { return lastDiscussionTitle; }
export function setLastDiscussionTitle(value) { lastDiscussionTitle = value; }

// ===== Discussion Status Bar =====
export function showDiscussionStatusBar(totalRounds) {
  const bar = document.getElementById('discussion-status-bar');
  if (bar) {
    bar.style.display = 'flex';
    const text = document.getElementById('discussion-progress-text');
    if (text) {
      text.textContent = t('discussionProgressInitial', String(totalRounds));
    }
  }
}

export function hideDiscussionStatusBar() {
  const bar = document.getElementById('discussion-status-bar');
  if (bar) bar.style.display = 'none';
}

export function updateDiscussionProgress(currentRound, totalRounds) {
  const text = document.getElementById('discussion-progress-text');
  if (text) {
    text.textContent = t('discussionProgress', String(currentRound), String(totalRounds));
  }
}

// ===== Discussion Stop =====
export function stopDiscussion(reason = 'user') {
  const wasActive = discussionActive || Boolean(discussionAbortController);
  if (discussionAbortController) {
    discussionAbortController.abort();
  }
  invalidateCompletionSessions(`discussion-stop:${reason}`);
  if (wasActive) {
    recordDebugLog('discussion:stop', { reason });
    hideDiscussionStatusBar();
    stopMergeMonitor();
  }
}

// ===== Start Discussion After Merge =====
export async function startDiscussionAfterMerge(mergedPrompt, totalRounds, mergePanel, { panels, mergePanelIds, autoExportToMarkdown, selectedMergeTarget, lastSentQuestion }) {
  if (totalRounds <= 0) return;
  totalRounds = DISCUSSION_ROUNDS;
  const discussionWaitMs = getCurrentMergeMaxWait();
  recordDebugLog('discussion:start', {
    totalRounds,
    discussionWaitMs,
    mergePanel: getPanelDebugInfo(mergePanel),
    mergedPromptLength: String(mergedPrompt || '').length
  });

  discussionAbortController = new AbortController();
  discussionActive = true;
  const signal = discussionAbortController.signal;
  const discussionGeneration = getCompletionSessionGeneration();

  const providersSnapshot = getNonMergePanels().map(p =>
    getProviderById(p.providerId)?.name || p.providerId
  );

  showDiscussionStatusBar(totalRounds);

  try {
    const baselineAnswer = await extractSinglePanelAnswer(mergePanel) || '';

    const initialGateResult = await waitForDiscussionStartGate(mergePanel, signal, discussionWaitMs, baselineAnswer);

    if (signal.aborted) {
      recordDebugLog('discussion:aborted-before-initial-merge-extract');
      return;
    }

    let mergedAnswer = initialGateResult.answer || '';
    if (!mergedAnswer) {
      console.warn('[Discussion] Merge answer is empty, trying raw answers as fallback');
      recordDebugLog('discussion:initial-merge-answer-empty-fallback', {
        gateReason: initialGateResult.reason
      });
      const fallbackAnswers = await extractAllAnswers();
      mergedAnswer = fallbackAnswers
        .filter(a => a.answer && a.answer.trim())
        .map(a => `【${a.providerName}】\n${a.answer}`)
        .join('\n\n');
      // 不再用 mergedPrompt（10K+ 提示词模板）兜底——它不是答案，注入长文本会导致
      // gemini/claude/yuanbao 发送失败。如果原始面板答案也提取不到，直接结束讨论。
      if (!mergedAnswer) {
        recordDebugLog('discussion:all-extraction-failed', {
          gateReason: initialGateResult.reason,
          fallbackAnswerCount: fallbackAnswers.length
        });
        discussionActive = false;
        return;
      }
    }

    recordDebugLog('discussion-start-gate:begin-discussion', {
      reason: initialGateResult.reason,
      answerLength: mergedAnswer.length
    });

    const extractedTitle = markdownExtractTitle(mergedAnswer);
    let discussionScores = extractScores(mergedAnswer);
    lastDiscussionTitle = extractedTitle || generateFallbackTitle();
    mergedAnswer = markdownCleanAnswer(mergedAnswer, extractedTitle);

    const settingsForExport = await getSettings();
    const exportModeForInit = settingsForExport.markdownExportMode || settingsForExport.obsidianExportMode || 'auto';
    let pendingInitialMergeExport = null;
    if (isTrueSetting(settingsForExport.exportInitialMerge) && exportModeForInit === 'auto' && mergedAnswer) {
      pendingInitialMergeExport = {
        answer: mergedAnswer,
        options: {
          question: lastSentQuestion || '',
          providers: providersSnapshot,
          title: extractedTitle || '',
          scores: discussionScores,
          logPrefix: 'discussion-initial-merge'
        }
      };
    }

    stopMergeMonitor();

    const question = lastSentQuestion || document.getElementById('unified-input')?.value || '';

    for (let round = 1; round <= totalRounds; round++) {
      if (signal.aborted) break;

      updateDiscussionProgress(round, totalRounds);
      recordDebugLog('discussion:round-start', {
        round,
        totalRounds,
        mergedAnswerLength: mergedAnswer.length
      });

      const cleanMergedAnswer = sanitizeMergedAnswerForDiscussion(mergedAnswer);

      const discussPrompt = buildDiscussPrompt(question, cleanMergedAnswer);
      recordDebugLog('discussion:prompt-built', {
        round,
        totalRounds,
        cleanMergedAnswerLength: cleanMergedAnswer.length,
        discussPromptLength: discussPrompt.length
      });

      const currentNonMergePanels = getNonMergePanels();
      const discussionSessionIdsByPanelId = new Map(
        currentNonMergePanels.map(panel => [
          panel.id,
          `discussion-round-${round}-${panel.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        ])
      );
      // Arm the completion listener before the first serial send. Fast providers
      // may finish while later panels are still receiving the discussion prompt.
      const discussionCompletion = waitForDiscussionPanelsCompletionWithAbort(
        currentNonMergePanels,
        signal,
        discussionWaitMs,
        'discussion-wait:aborted',
        discussionSessionIdsByPanelId
      );
      const discussionSendResults = [];
      for (const panel of currentNonMergePanels) {
        if (panel.iframe && panel.iframe.contentWindow) {
          const discussionSessionId = discussionSessionIdsByPanelId.get(panel.id);
          await ensurePanelVisibleBeforeAutoSubmit(panel, true, 'discussion');
          const success = await sendToPanel(panel, discussPrompt, true, null, 0, discussionSessionId);
          discussionSendResults.push({ panel, success });
        }
      }

      const settledDiscussionSends = discussionSendResults;
      recordDebugLog('discussion:send-results', {
        round,
        results: settledDiscussionSends.map(result => ({
          panel: getPanelDebugInfo(result.panel),
          success: result.success
        }))
      });
      settledDiscussionSends
        .filter(result => !result.success)
        .forEach(result => {
          console.warn('[Discussion] Failed to send discussion prompt to panel:', result.panel?.providerId || result.panel?.id);
        });

      if (round === 1 && pendingInitialMergeExport) {
        const exportPayload = pendingInitialMergeExport;
        pendingInitialMergeExport = null;
        void Promise.resolve(exportMergeResult(exportPayload.answer, exportPayload.options)).catch(error => {
          recordDebugLog('discussion-initial-merge:auto-error', {
            message: error?.message || String(error)
          });
        });
      }

      await discussionCompletion;

      if (signal.aborted) break;

      const roundAnswers = await extractAllAnswers();
      const validRoundAnswers = roundAnswers.filter(a => a.answer && a.answer.trim().length > 0);
      recordDebugLog('discussion:round-answers-extracted', {
        round,
        totalAnswers: roundAnswers.length,
        validAnswers: validRoundAnswers.length,
        providers: roundAnswers.map(a => ({
          providerName: a.providerName,
          answerLength: String(a.answer || '').length,
          hasAnswer: Boolean(a.answer && a.answer.trim())
        }))
      });

      if (validRoundAnswers.length === 0) {
        console.warn('[Discussion] No valid answers in round', round, ', stopping discussion');
        recordDebugLog('discussion:stop-no-valid-round-answers', { round });
        break;
      }

      const roundMergePrompt = buildFinalMergePrompt(question, mergedAnswer, validRoundAnswers);
      const mergePanelCurrent = panels.find(p => p.providerId === (selectedMergeTarget || 'deepseek') && mergePanelIds.has(p.id));

      if (mergePanelCurrent && mergePanelCurrent.iframe && mergePanelCurrent.iframe.contentWindow) {
        const previousMergedAnswer = mergedAnswer;
        const roundSessionId = `discussion-merge-${round}-${Date.now()}`;
        if (signal.aborted || discussionGeneration !== getCompletionSessionGeneration()) {
          recordDebugLog('discussion:skip-stale-merge-session', {
            round,
            discussionGeneration,
            completionSessionGeneration: getCompletionSessionGeneration()
          });
          break;
        }
        beginMergeSession(roundSessionId, discussionGeneration);
        postToPanelIframe(mergePanelCurrent, {
          type: 'MONITOR_COMPLETION',
          mergeSessionId: roundSessionId,
          panelId: mergePanelCurrent.id,
          context: 'multi-panel'
        });
        postToPanelIframe(mergePanelCurrent, {
          type: 'INJECT_TEXT',
          text: roundMergePrompt,
          autoSubmit: true,
          context: 'auto-merge',
          mergeRequestId: `discussion-merge-${round}`,
          injectionRequestId: `inject-${mergePanelCurrent.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        });

        try {
          await waitForDiscussionMergeCompletionWithFallback(mergePanelCurrent, signal, discussionWaitMs, previousMergedAnswer);
        } finally {
          if (getActiveMergeSessionId() === roundSessionId &&
              getActiveCompletionSessionGeneration() === discussionGeneration) {
            clearActiveCompletionSession();
          }
        }

        if (signal.aborted) break;

        const newMergedAnswer = await extractSinglePanelAnswer(mergePanelCurrent) || '';
        if (newMergedAnswer) {
          const newExtractedTitle = markdownExtractTitle(newMergedAnswer);
          discussionScores = extractScores(newMergedAnswer) || discussionScores;
          lastDiscussionTitle = newExtractedTitle || generateFallbackTitle();
          mergedAnswer = markdownCleanAnswer(newMergedAnswer, newExtractedTitle);
          recordDebugLog('discussion:round-merge-answer-extracted', {
            round,
            mergePanel: getPanelDebugInfo(mergePanelCurrent),
            rawAnswerLength: newMergedAnswer.length,
            cleanedAnswerLength: mergedAnswer.length
          });
        }
      }
    }

    if (!signal.aborted) {
      hideDiscussionStatusBar();
      recordDebugLog('discussion:completed', {
        totalRounds,
        finalAnswerLength: mergedAnswer.length
      });
    }

    if (!signal.aborted) {
      const finalMergePanel = panels.find(p => p.providerId === (selectedMergeTarget || 'deepseek') && mergePanelIds.has(p.id)) || mergePanel;
      let exportAnswer = mergedAnswer || '';
      let latestVisibleAnswer = '';

      // Always refresh the final visible answer before export. The cached answer
      // can be a partial snapshot taken before the trailing title and scores were
      // rendered, even when its body is already non-empty.
      if (finalMergePanel) {
        latestVisibleAnswer = await waitForFinalMergeAnswerBeforeExport(finalMergePanel, signal, discussionWaitMs) || '';
        if (!latestVisibleAnswer && !signal.aborted) {
          latestVisibleAnswer = await extractSinglePanelAnswer(finalMergePanel) || '';
        }
        if (latestVisibleAnswer && latestVisibleAnswer.trim()) {
          const latestTitle = markdownExtractTitle(latestVisibleAnswer);
          discussionScores = extractScores(latestVisibleAnswer) || discussionScores;
          lastDiscussionTitle = latestTitle || lastDiscussionTitle || generateFallbackTitle();
          exportAnswer = markdownCleanAnswer(latestVisibleAnswer, latestTitle);
        }
      }

      if (exportAnswer) {
        recordDebugLog('discussion-final-answer:resolved', {
          panel: getPanelDebugInfo(finalMergePanel),
          cachedAnswerLength: mergedAnswer.length,
          latestVisibleAnswerLength: latestVisibleAnswer.length,
          exportAnswerLength: exportAnswer.length,
          usedLatestVisibleAnswer: Boolean(latestVisibleAnswer && latestVisibleAnswer.trim())
        });
      } else {
        recordDebugLog('discussion-final-answer:no-panel', {
          cachedAnswerLength: mergedAnswer.length
        });
      }

      if (!exportAnswer && mergedAnswer) {
        exportAnswer = mergedAnswer;
        recordDebugLog('discussion-final-answer:fallback-cached', {
          cachedAnswerLength: mergedAnswer.length
        });
      }

      await saveMergeScoresIfPresent(finalMergePanel, lastSentQuestion || '', discussionScores);

      if (exportAnswer) {
        await exportDiscussionResult(exportAnswer, {
          question: lastSentQuestion || '',
          providers: providersSnapshot,
          title: lastDiscussionTitle,
          scores: discussionScores
        });
      }
    }
  } catch (e) {
    console.error('[AIChatMerge] Discussion error:', e);
    recordDebugLog('discussion:error', {
      message: e?.message || String(e)
    });
  } finally {
    discussionActive = false;
    discussionAbortController = null;
    hideDiscussionStatusBar();
  }
}
