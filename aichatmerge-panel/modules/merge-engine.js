// merge-engine.js — Unified entry point and triggerMerge
// Domain modules own their own exports; this file only exports triggerMerge.

// ===== Dependencies =====
import { postToPanelIframe } from './panel-postmessage.js';
import { getPanelHeaderRightHtml, bindPanelHeaderActions } from './panel-header-actions.js';
import { getProviderFrameUrl } from './panel-frame-config.js';
import { getPanels, getCurrentLayout, getCurrentPanelPage, setCurrentPanelPage } from './state.js';
import { getPanelPageIndex } from './layout-config.js';
import { renderCurrentPage, saveProviderConfiguration } from './panel-lifecycle.js';
import { getPanelDebugInfo, recordDebugLog, setDiscussionWillRun } from './debug-log.js';
import { getProviderById } from '../../modules/providers.js';
import { getSettings } from '../../modules/settings.js';
import { buildMergePanel } from './panel-builder.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

// Sub-module imports for triggerMerge
import { extractAllAnswers } from './answer-extractor.js';
import { buildMergePrompt, getMergeBadgeMeta } from './merge-prompt.js';
import { startDiscussionAfterMerge } from './discussion-runner.js';
import {
  beginMergeSession,
  getActiveMergeSessionId,
  getActiveCompletionSessionGeneration,
  getCompletionSessionGeneration,
  getLastMergeType
} from './merge-monitor.js';

// ===== State (imported from merge-state.js) =====
import { getSelectedMergeTarget, getLastSentQuestion } from './merge-state.js';

// ===== Trigger Merge =====
let activeMergeTriggerPromise = null;

export function triggerMerge(options) {
  if (activeMergeTriggerPromise) {
    recordDebugLog('merge:trigger-ignored-busy');
    return activeMergeTriggerPromise;
  }

  activeMergeTriggerPromise = runTriggerMerge(options)
    .catch(error => {
      recordDebugLog('merge:trigger-failed', {
        message: error?.message || String(error)
      });
      throw error;
    })
    .finally(() => {
      activeMergeTriggerPromise = null;
    });
  return activeMergeTriggerPromise;
}

async function runTriggerMerge({ panels, mergePanelIds, autoExportToMarkdown = () => {} }) {
  const triggerGeneration = getCompletionSessionGeneration();
  const selectedMergeTarget = getSelectedMergeTarget();
  const lastSentQuestion = getLastSentQuestion();
  recordDebugLog('merge:trigger-start', {
    lastMergeType: getLastMergeType(),
    selectedMergeTarget: selectedMergeTarget || 'deepseek'
  });

  function isTriggerGenerationCurrent() {
    return getCompletionSessionGeneration() === triggerGeneration;
  }

  const answers = await extractAllAnswers({
    timeoutMs: 2500,
    excludeUnreachablePanels: true
  });
  if (!isTriggerGenerationCurrent()) {
    recordDebugLog('merge:aborted-stale-trigger', {
      triggerGeneration,
      currentGeneration: getCompletionSessionGeneration()
    });
    return;
  }
  const validAnswers = answers.filter(a => a.answer && a.answer.trim().length > 0);
  recordDebugLog('merge:answers-extracted', {
    totalAnswers: answers.length,
    validAnswers: validAnswers.length,
    providers: answers.map(a => ({
      providerName: a.providerName,
      answerLength: String(a.answer || '').length,
      hasAnswer: Boolean(a.answer && a.answer.trim())
    }))
  });

  if (validAnswers.length === 0) {
    recordDebugLog('merge:aborted-no-valid-answers');
    return;
  }

  const question = lastSentQuestion || document.getElementById('unified-input')?.value || '';
  const prompt = buildMergePrompt(question, validAnswers);
  const targetProvider = selectedMergeTarget || 'deepseek';

  const settings = await getSettings();
  if (!isTriggerGenerationCurrent()) {
    recordDebugLog('merge:aborted-stale-trigger', {
      triggerGeneration,
      currentGeneration: getCompletionSessionGeneration()
    });
    return;
  }
  const mergeMode = settings.mergeMode || 'merge';
  setDiscussionWillRun(false);
  const discussRounds = 1;
  recordDebugLog('merge:prompt-built', {
    targetProvider,
    mergeMode,
    discussRounds,
    promptLength: prompt.length,
    questionLength: question.length,
    sourceProviders: validAnswers.map(a => a.providerName)
  });

  const existingPanel = panels.find(p => p.providerId === targetProvider && mergePanelIds.has(p.id));

  if (existingPanel) {
    recordDebugLog('merge:reuse-panel', {
      panel: getPanelDebugInfo(existingPanel),
      targetProvider,
      mergeMode
    });
    const panelIndex = panels.indexOf(existingPanel);
    const targetPage = getPanelPageIndex(panelIndex, getCurrentLayout());
    if (getCurrentPanelPage() !== targetPage) {
      setCurrentPanelPage(targetPage);
      renderCurrentPage();
    }

    const existingBadge = document.getElementById(existingPanel.id)?.querySelector('#merge-status-badge');
    if (existingBadge) {
      const badgeMeta = getMergeBadgeMeta();
      existingBadge.style.background = badgeMeta.background;
      existingBadge.textContent = badgeMeta.text;
      existingBadge.title = badgeMeta.title;
    }

    existingPanel.exportData = {
      question,
      providers: validAnswers.map(a => a.providerName),
      mode: mergeMode === 'merge+discuss' ? 'discuss' : 'merge'
    };

    const mergeRequestId = `merge-reuse-${Date.now()}`;
    let gotResponse = false;
    const diagHandler = (event) => {
      if (event?.data?.type === 'INJECT_TEXT_RECEIVED' && event?.data?.mergeRequestId === mergeRequestId) {
        gotResponse = true;
        window.removeEventListener('message', diagHandler);
        clearTimeout(diagTimeoutId);
      }
    };
    window.addEventListener('message', diagHandler);

    const mergeOutputSessionId = `merge-output-${Date.now()}`;
    beginMergeSession(mergeOutputSessionId, getCompletionSessionGeneration());
    postToPanelIframe(existingPanel, {
      type: 'MONITOR_COMPLETION',
      mergeSessionId: mergeOutputSessionId,
      panelId: existingPanel.id,
      context: 'multi-panel'
    });

    postToPanelIframe(existingPanel, {
      type: 'INJECT_TEXT',
      text: prompt,
      autoSubmit: true,
      context: 'auto-merge',
      mergeRequestId,
      injectionRequestId: `inject-${existingPanel.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    });

    const diagTimeoutId = setTimeout(() => {
      if (!gotResponse) {
        window.removeEventListener('message', diagHandler);
        console.warn('[Merge] No response from content script after 3s! iframe may not have received the message.');
        console.warn('[Merge] iframe.readyState may be:', existingPanel.iframe?.readyState);
        console.warn('[Merge] iframe src:', existingPanel.iframe?.src);
      }
    }, 3000);

    existingPanel.iframe.closest('.panel-item')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });

    if (mergeMode !== 'merge+discuss') {
      recordDebugLog('merge:auto-export-scheduled', {
        panel: getPanelDebugInfo(existingPanel)
      });
      autoExportToMarkdown(existingPanel);
    }

    if (mergeMode === 'merge+discuss') {
      setDiscussionWillRun(true);
      recordDebugLog('discussion:start-after-existing-merge', {
        panel: getPanelDebugInfo(existingPanel),
        discussRounds
      });
      startDiscussionAfterMerge(prompt, discussRounds, existingPanel, {
        panels, mergePanelIds, autoExportToMarkdown,
        selectedMergeTarget, lastSentQuestion
      }).catch(e => {
        console.error('[Discussion] Error:', e);
        console.error('[Merge]', t('errorOccurred'));
      });
    }

    return;
  }

  const provider = getProviderById(targetProvider);
  if (!provider) {
    console.error('[Merge] Provider not found:', targetProvider);
    recordDebugLog('merge:provider-not-found', { targetProvider });
    return;
  }

  const panelId = `panel-merge-${Date.now()}`;
  const panelGrid = document.getElementById('panel-grid');

  const { panelEl, iframe, panelData } = buildMergePanel({
    panelId, provider, targetProvider, question, validAnswers, mergeMode, discussRounds
  });
  const loadingEl = panelEl.querySelector('.panel-loading');

  panelGrid.insertBefore(panelEl, panelGrid.firstChild);
  panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  mergePanelIds.add(panelId);
  recordDebugLog('merge:create-panel', {
    panelId,
    targetProvider,
    mergeMode,
    discussRounds
  });

  panels.unshift(panelData);

  bindPanelHeaderActions(panelId);
  await saveProviderConfiguration();

  setCurrentPanelPage(0);
  renderCurrentPage();

  const mergeOutputSessionId = `merge-output-${Date.now()}`;
  const mergeOutputGeneration = getCompletionSessionGeneration();
  beginMergeSession(mergeOutputSessionId, mergeOutputGeneration);

  function isMergeOutputSessionStillActive() {
    return getActiveMergeSessionId() === mergeOutputSessionId &&
      getActiveCompletionSessionGeneration() === mergeOutputGeneration;
  }

  iframe.addEventListener('load', () => {
    if (!isMergeOutputSessionStillActive()) {
      recordDebugLog('merge:skip-stale-new-panel-load', {
        panelId,
        mergeOutputSessionId,
        mergeOutputGeneration
      });
      return;
    }
    loadingEl?.classList.add('hidden');
    const mergeRequestId = `merge-new-${Date.now()}`;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let gotResponse = false;
    let pendingRetry = null;

    const diagHandler = (event) => {
      if (event?.data?.type === 'INJECT_TEXT_RECEIVED' && event?.data?.mergeRequestId === mergeRequestId) {
        gotResponse = true;
        window.removeEventListener('message', diagHandler);
        if (pendingRetry) { clearTimeout(pendingRetry); pendingRetry = null; }
      }
    };
    window.addEventListener('message', diagHandler);

    function doInject() {
      if (!isMergeOutputSessionStillActive()) {
        recordDebugLog('merge:skip-stale-new-panel-inject', {
          panelId,
          mergeOutputSessionId,
          mergeOutputGeneration
        });
        return false;
      }
      const panel = panels.find(p => p.id === panelId);
      if (panel) {
        panel.exportData = {
          question,
          providers: validAnswers.map(a => a.providerName),
          mode: mergeMode === 'merge+discuss' ? 'discuss' : 'merge'
        };
        postToPanelIframe(panel, {
          type: 'MONITOR_COMPLETION',
          mergeSessionId: mergeOutputSessionId,
          panelId: panel.id,
          context: 'multi-panel'
        });

        postToPanelIframe(panel, {
          type: 'INJECT_TEXT',
          text: prompt,
          autoSubmit: true,
          context: 'auto-merge',
          mergeRequestId,
          injectionRequestId: `inject-${panel.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        });
        return true;
      }
      return false;
    }

    doInject();

    function scheduleRetry() {
      pendingRetry = setTimeout(() => {
        const isStillActive = isMergeOutputSessionStillActive();
        if (!isStillActive || gotResponse || retryCount >= MAX_RETRIES) {
          window.removeEventListener('message', diagHandler);
          if (isStillActive && !gotResponse) {
            console.warn('[Merge] No response from content script after', MAX_RETRIES, 'retries.');
          }
          return;
        }
        retryCount++;
        doInject();
        scheduleRetry();
      }, 2000);
    }
    scheduleRetry();
  });

  if (mergeMode !== 'merge+discuss') {
    const newPanel = panels.find(p => p.id === panelId);
    recordDebugLog('merge:auto-export-waiting-for-new-panel-completion', {
      panel: getPanelDebugInfo(newPanel)
    });
    autoExportToMarkdown(newPanel);
  }

  if (mergeMode === 'merge+discuss') {
    setDiscussionWillRun(true);
    const mergePanel = panels.find(p => p.id === panelId);
    recordDebugLog('discussion:start-after-new-merge', {
      panel: getPanelDebugInfo(mergePanel),
      discussRounds
    });
    startDiscussionAfterMerge(prompt, discussRounds, mergePanel, {
      panels, mergePanelIds, autoExportToMarkdown,
      selectedMergeTarget, lastSentQuestion
    }).catch(e => {
      console.error('[Discussion] Error:', e);
      showToast(t('errorOccurred'));
    });
  }
}
