/**
 * Discussion gates: wait conditions for discussion flow.
 * Handles all polling, stability detection, and completion waiting.
 * Log prefixes: discussion-wait:*, discussion-merge-wait:*, discussion-wait:final-merge:*
 */

import { getPanelDebugInfo, recordDebugLog } from './debug-log.js';
import { extractSinglePanelAnswer, getLastSingleExtractionDiag } from './answer-extractor.js';
import { normalizeAnswerForStability } from './merge-prompt.js';
import { getMergeMaxWait } from './merge-monitor.js';
import { sleep } from './async-utils.js';

// ===== Constants =====
const DISCUSSION_START_GATE_POLL_MS = 2500;
const DISCUSSION_START_GATE_STABLE_MS = 8000;
const DISCUSSION_START_GATE_MAX_WAIT_MS = 30000;
const DISCUSSION_FINAL_EXPORT_STABLE_MS = 15000;

// ===== Helper Functions =====

export function getCurrentMergeMaxWait() {
  const mergeMaxWait = getMergeMaxWait();
  return Number.isFinite(mergeMaxWait) && mergeMaxWait > 0
    ? mergeMaxWait
    : 120000;
}

export function getDiscussionStartGateTimeout(timeoutMs) {
  const configuredTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : getCurrentMergeMaxWait();
  return Math.min(configuredTimeoutMs, DISCUSSION_START_GATE_MAX_WAIT_MS);
}

export function getDiscussionStartGateOverallTimeout(timeoutMs) {
  return Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : getCurrentMergeMaxWait();
}

export { sleep };

export function sleepWithAbort(ms, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(cleanup, ms);
    const onAbort = () => cleanup();

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// ===== Wait for Discussion Panels =====

// 进行中的讨论等待。面板被用户删除时 merge-monitor 有 reconcile，
// 讨论等待之前没有——被删的面板永远等不来完成，只能干等到 120s 超时
// （2026-07-21 用户删除卡死的 chatgpt 面板后讨论「一直等待」实证）
const activePanelWaits = new Set();

export function notifyDiscussionPanelRemoved(removedPanelId) {
  if (!removedPanelId) return;
  for (const wait of Array.from(activePanelWaits)) {
    if (!wait.targetPanelIds.has(removedPanelId)) continue;
    wait.targetPanelIds.delete(removedPanelId);
    wait.targetPanels = wait.targetPanels.filter(panel => panel.id !== removedPanelId);
    recordDebugLog('discussion-wait:panel-removed', {
      panelId: removedPanelId,
      remainingCount: wait.targetPanelIds.size
    });
    wait.checkAllComplete();
  }
}

export function waitForDiscussionPanelsCompletionWithAbort(
  targetPanels,
  signal,
  timeoutMs = getCurrentMergeMaxWait(),
  abortEventName = 'discussion-wait:aborted',
  expectedSessionIdsByPanelId = null
) {
  return new Promise((resolve) => {
    if (targetPanels.length === 0) { resolve(); return; }
    if (signal.aborted) { resolve(); return; }
    const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
      ? Number(timeoutMs)
      : getCurrentMergeMaxWait();

    const completedPanelIds = new Set();
    const waitState = {
      targetPanelIds: new Set(targetPanels.map(p => p.id)),
      targetPanels: [...targetPanels],
      checkAllComplete: () => {}
    };
    recordDebugLog('discussion-wait:start', {
      timeoutMs: safeTimeoutMs,
      targetPanels: waitState.targetPanels.map(getPanelDebugInfo)
    });

    waitState.checkAllComplete = () => {
      if (completedPanelIds.size >= waitState.targetPanelIds.size) {
        recordDebugLog('discussion-wait:all-complete', {
          completedCount: completedPanelIds.size,
          totalCount: waitState.targetPanelIds.size
        });
        cleanup();
        resolve();
      }
    };

    const handler = (event) => {
      if (event?.data?.type === 'COMPLETION_DETECTED' &&
          event?.data?.context === 'multi-panel-completion') {
        const panelId = event?.data?.panelId;
        let completedPanelId = null;
        if (panelId && waitState.targetPanelIds.has(panelId)) {
          completedPanelId = panelId;
        } else if (!panelId) {
          const provider = event?.data?.provider;
          const match = waitState.targetPanels.find(p => p.providerId === provider);
          if (match) completedPanelId = match.id;
        }

        if (!completedPanelId) return;

        const hasExpectedSession = expectedSessionIdsByPanelId?.has?.(completedPanelId) === true;
        const expectedSessionId = hasExpectedSession
          ? expectedSessionIdsByPanelId.get(completedPanelId)
          : null;
        if (hasExpectedSession && event?.data?.mergeSessionId !== expectedSessionId) return;

        completedPanelIds.add(completedPanelId);
        recordDebugLog('discussion-wait:panel-complete', {
          provider: event?.data?.provider,
          panelId: completedPanelId,
          mergeSessionId: event?.data?.mergeSessionId,
          completedCount: completedPanelIds.size,
          totalCount: waitState.targetPanelIds.size
        });
        waitState.checkAllComplete();
      }
    };

    const onAbort = () => {
      recordDebugLog(abortEventName, {
        completedCount: completedPanelIds.size,
        totalCount: waitState.targetPanelIds.size,
        completedPanelIds: Array.from(completedPanelIds)
      });
      cleanup();
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });

    const timeout = setTimeout(() => {
      console.warn('[Discussion] Round completion timeout after', safeTimeoutMs, 'ms, proceeding with', completedPanelIds.size, '/', waitState.targetPanelIds.size, 'panels completed');
      recordDebugLog('discussion-wait:timeout', {
        timeoutMs: safeTimeoutMs,
        completedCount: completedPanelIds.size,
        totalCount: waitState.targetPanelIds.size,
        completedPanelIds: Array.from(completedPanelIds),
        missingPanels: waitState.targetPanels
          .filter(panel => !completedPanelIds.has(panel.id))
          .map(getPanelDebugInfo)
      });
      cleanup();
      resolve();
    }, safeTimeoutMs);

    window.addEventListener('message', handler);
    activePanelWaits.add(waitState);

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      signal.removeEventListener('abort', onAbort);
      activePanelWaits.delete(waitState);
    }
  });
}

// ===== Discussion Start Gate =====

export async function waitForDiscussionStartGate(panel, signal, timeoutMs, baselineText) {
  const activeTimeoutMs = getDiscussionStartGateTimeout(timeoutMs);
  const overallTimeoutMs = getDiscussionStartGateOverallTimeout(timeoutMs);
  const startedAt = Date.now();
  let completedByEvent = false;
  let latestAnswer = '';
  let latestNormalized = '';
  let stableCandidate = '';
  let stableSince = 0;
  let firstSeenLogged = false;
  const baselineNormalized = normalizeAnswerForStability(baselineText || '');
  let newAnswerStarted = false;
  let newAnswerStartedAt = 0;

  recordDebugLog('discussion-start-gate:start', {
    panel: getPanelDebugInfo(panel),
    timeoutMs: activeTimeoutMs,
    overallTimeoutMs,
    pollMs: DISCUSSION_START_GATE_POLL_MS,
    stableMs: DISCUSSION_START_GATE_STABLE_MS,
    baselineLength: baselineNormalized.length,
    hasBaseline: baselineNormalized.length > 0
  });

  const completionHandler = (event) => {
    if (event?.data?.type !== 'MERGE_COMPLETE') return;
    completedByEvent = true;
  };
  window.addEventListener('message', completionHandler);

  try {
    while (!signal.aborted && Date.now() - startedAt < overallTimeoutMs) {
      if (completedByEvent) {
        // MERGE_COMPLETE is only a readiness signal. Its optional cached answer
        // may have been captured before the provider rendered trailing content
        // such as the title and scores. Read the panel only after the signal.
        const eventAnswer = panel
          ? await extractSinglePanelAnswer(panel) || ''
          : '';
        const eventNormalized = normalizeAnswerForStability(eventAnswer);

        recordDebugLog('discussion-start-gate:event-complete', {
          panel: getPanelDebugInfo(panel),
          elapsedMs: Date.now() - startedAt,
          answerLength: String(eventAnswer || '').length,
          baselineLength: baselineNormalized.length
        });

        if (eventAnswer && eventAnswer.trim() && (!baselineNormalized || eventNormalized !== baselineNormalized)) {
          return {
            answer: eventAnswer,
            reason: 'event-complete'
          };
        }

        if (baselineNormalized && eventNormalized === baselineNormalized) {
          recordDebugLog('discussion-start-gate:event-ignored-baseline', {
            panel: getPanelDebugInfo(panel),
            elapsedMs: Date.now() - startedAt,
            answerLength: String(eventAnswer || '').length,
            baselineLength: baselineNormalized.length
          });
        }

        completedByEvent = false;
      }

      const currentAnswer = await extractSinglePanelAnswer(panel) || '';
      const currentNormalized = normalizeAnswerForStability(currentAnswer);

      if (currentNormalized) {
        latestAnswer = currentAnswer;
        latestNormalized = currentNormalized;

        if (!firstSeenLogged) {
          firstSeenLogged = true;
          recordDebugLog('discussion-start-gate:text-first-seen', {
            panel: getPanelDebugInfo(panel),
            elapsedMs: Date.now() - startedAt,
            answerLength: currentAnswer.length
          });
        }

        if (!newAnswerStarted) {
          const changedFromBaseline = baselineNormalized
            ? currentNormalized !== baselineNormalized &&
              Math.abs(currentNormalized.length - baselineNormalized.length) > 20
            : Boolean(currentNormalized);
          if (changedFromBaseline) {
            newAnswerStarted = true;
            newAnswerStartedAt = Date.now();
            stableCandidate = '';
            stableSince = 0;
            recordDebugLog('discussion-start-gate:new-answer-started', {
              panel: getPanelDebugInfo(panel),
              elapsedMs: Date.now() - startedAt,
              answerLength: currentAnswer.length,
              baselineLength: baselineNormalized.length
            });
          }
        }

        if (newAnswerStarted) {
          if (currentNormalized !== stableCandidate) {
            stableCandidate = currentNormalized;
            stableSince = Date.now();
            recordDebugLog('discussion-start-gate:text-changed', {
              panel: getPanelDebugInfo(panel),
              elapsedMs: Date.now() - startedAt,
              answerLength: currentAnswer.length
            });
          } else if (Date.now() - stableSince >= DISCUSSION_START_GATE_STABLE_MS) {
            recordDebugLog('discussion-start-gate:text-stable', {
              panel: getPanelDebugInfo(panel),
              elapsedMs: Date.now() - startedAt,
              stableMs: Date.now() - stableSince,
              answerLength: currentAnswer.length
            });
            return {
              answer: currentAnswer,
              reason: 'text-stable'
            };
          }

          if (newAnswerStartedAt && Date.now() - newAnswerStartedAt >= activeTimeoutMs) {
            recordDebugLog('discussion-start-gate:timeout-fallback', {
              panel: getPanelDebugInfo(panel),
              elapsedMs: Date.now() - startedAt,
              activeElapsedMs: Date.now() - newAnswerStartedAt,
              answerLength: currentAnswer.length
            });
            return {
              answer: currentAnswer,
              reason: 'timeout-fallback'
            };
          }
        }
      }

      await sleepWithAbort(DISCUSSION_START_GATE_POLL_MS, signal);
    }

    if (latestNormalized && newAnswerStarted) {
      recordDebugLog('discussion-start-gate:overall-timeout-fallback', {
        panel: getPanelDebugInfo(panel),
        elapsedMs: Date.now() - startedAt,
        activeElapsedMs: newAnswerStartedAt ? Date.now() - newAnswerStartedAt : 0,
        answerLength: latestAnswer.length
      });
      return {
        answer: latestAnswer,
        reason: 'overall-timeout-fallback'
      };
    }

    if (latestNormalized && baselineNormalized && latestNormalized === baselineNormalized) {
      recordDebugLog('discussion-start-gate:timeout-baseline-only', {
        panel: getPanelDebugInfo(panel),
        elapsedMs: Date.now() - startedAt,
        baselineLength: baselineNormalized.length
      });
      return {
        answer: '',
        reason: 'timeout-baseline-only'
      };
    }

    const lastDiag = getLastSingleExtractionDiag();
    recordDebugLog('discussion-start-gate:empty-answer', {
      panel: getPanelDebugInfo(panel),
      elapsedMs: Date.now() - startedAt,
      extractionDiag: lastDiag || undefined
    });
    return {
      answer: '',
      reason: 'empty-answer'
    };
  } finally {
    window.removeEventListener('message', completionHandler);
  }
}

// ===== Wait for Discussion Merge Completion =====

export async function waitForDiscussionMergeCompletionWithFallback(panel, signal, timeoutMs, previousAnswer = '') {
  const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : getCurrentMergeMaxWait();
  const startedAt = Date.now();
  const previousNormalized = normalizeAnswerForStability(previousAnswer);
  const baselineAnswer = await extractSinglePanelAnswer(panel) || '';
  const baselineNormalized = normalizeAnswerForStability(baselineAnswer);

  const localController = new AbortController();
  const onExternalAbort = () => localController.abort();
  signal.addEventListener('abort', onExternalAbort, { once: true });

  const completionWait = waitForDiscussionPanelsCompletionWithAbort(
    [panel],
    localController.signal,
    safeTimeoutMs,
    'discussion-wait:cancelled-after-stable-fallback'
  );
  let completionResolved = false;
  completionWait.then(() => { completionResolved = true; });

  let stableCandidate = '';
  let stableSince = 0;
  recordDebugLog('discussion-merge-wait:start', {
    panel: getPanelDebugInfo(panel),
    timeoutMs: safeTimeoutMs,
    previousAnswerLength: String(previousAnswer || '').length,
    baselineLength: baselineNormalized.length
  });

  try {
    while (!signal.aborted && !completionResolved && Date.now() - startedAt < safeTimeoutMs) {
      await sleep(2500);
      if (signal.aborted || completionResolved) break;

      const currentAnswer = await extractSinglePanelAnswer(panel) || '';
      const currentNormalized = normalizeAnswerForStability(currentAnswer);
      if (!currentNormalized ||
          currentNormalized === previousNormalized ||
          (baselineNormalized && currentNormalized === baselineNormalized)) {
        stableCandidate = '';
        stableSince = 0;
        continue;
      }

      if (currentNormalized !== stableCandidate) {
        stableCandidate = currentNormalized;
        stableSince = Date.now();
        recordDebugLog('discussion-merge-wait:answer-changed', {
          panel: getPanelDebugInfo(panel),
          answerLength: currentAnswer.length,
          baselineLength: baselineNormalized.length
        });
        continue;
      }

      if (Date.now() - stableSince >= 8000) {
        recordDebugLog('discussion-merge-wait:stable-fallback-complete', {
          panel: getPanelDebugInfo(panel),
          stableMs: Date.now() - stableSince,
          answerLength: currentAnswer.length
        });
        localController.abort();
        await completionWait;
        return;
      }
    }

    await completionWait;
    recordDebugLog('discussion-merge-wait:completion-wait-ended', {
      panel: getPanelDebugInfo(panel),
      completionResolved
    });
  } finally {
    signal.removeEventListener('abort', onExternalAbort);
  }
}

// ===== Wait for Final Merge Answer Before Export =====

export async function waitForFinalMergeAnswerBeforeExport(panel, signal, timeoutMs) {
  if (!panel || !panel.iframe || !panel.iframe.contentWindow || signal.aborted) return '';

  const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : getCurrentMergeMaxWait();
  const startedAt = Date.now();
  let completionEventSeen = false;
  let latestAnswer = '';
  let stableCandidate = '';
  let stableSince = 0;

  const completionHandler = (event) => {
    if (event?.data?.type !== 'COMPLETION_DETECTED' ||
        event?.data?.context !== 'multi-panel-completion') {
      return;
    }

    const panelId = event?.data?.panelId;
    const provider = event?.data?.provider;
    if ((panelId && panelId === panel.id) || (!panelId && provider === panel.providerId)) {
      completionEventSeen = true;
      recordDebugLog('discussion-wait:final-merge-completion-event', {
        panel: getPanelDebugInfo(panel),
        provider,
        panelId
      });
    }
  };

  window.addEventListener('message', completionHandler);
  recordDebugLog('discussion-wait:final-merge:start', {
    panel: getPanelDebugInfo(panel),
    timeoutMs: safeTimeoutMs,
    stableMs: DISCUSSION_FINAL_EXPORT_STABLE_MS
  });

  try {
    while (!signal.aborted && Date.now() - startedAt < safeTimeoutMs) {
      await sleepWithAbort(DISCUSSION_START_GATE_POLL_MS, signal);
      if (signal.aborted) break;

      const currentAnswer = await extractSinglePanelAnswer(panel) || '';
      const currentNormalized = normalizeAnswerForStability(currentAnswer);
      if (!currentNormalized) {
        continue;
      }

      latestAnswer = currentAnswer;
      if (currentNormalized !== stableCandidate) {
        stableCandidate = currentNormalized;
        stableSince = Date.now();
        recordDebugLog('discussion-wait:final-merge:answer-changed', {
          panel: getPanelDebugInfo(panel),
          answerLength: currentAnswer.length
        });
        continue;
      }

      const stableMs = Date.now() - stableSince;
      if ((completionEventSeen && stableMs >= DISCUSSION_START_GATE_POLL_MS) ||
          stableMs >= DISCUSSION_FINAL_EXPORT_STABLE_MS) {
        recordDebugLog('discussion-wait:final-merge:complete', {
          panel: getPanelDebugInfo(panel),
          answerLength: currentAnswer.length,
          stableMs,
          completionEventSeen
        });
        return currentAnswer;
      }
    }

    recordDebugLog('discussion-wait:final-merge:timeout', {
      panel: getPanelDebugInfo(panel),
      answerLength: latestAnswer.length,
      timeoutMs: safeTimeoutMs,
      completionEventSeen
    });
    return latestAnswer;
  } finally {
    window.removeEventListener('message', completionHandler);
  }
}
