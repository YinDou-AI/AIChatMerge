/**
 * Message sending pipeline: broadcast, inject, recover.
 * Extracted from multi-panel.js
 */

import { t } from './i18n.js';
import { recordDebugLog, getPanelDebugInfo, rotateDebugSession } from './debug-log.js';
import {
  restoreUnifiedInputFocusAfterSend,
  getChatgptPanelsWithFrames,
  startFreshChatForPanel,
  restoreUnifiedInputFocusAfterNewChat
} from './focus-manager.js';
import { getPanels, getCurrentLayout, getCurrentPanelPage, setCurrentPanelPage } from './state.js';
import { getPanelPageIndex as getLayoutPanelPageIndex } from './layout-config.js';
import { renderCurrentPage } from './panel-lifecycle.js';
import { sleep } from './async-utils.js';
import { getMergePanelIds, getNonMergePanels } from './merge-panel-registry.js';

import { postToPanelIframe } from './panel-postmessage.js';
import { probePanelContentScript } from './provider-transport-diagnostics.js';
import { recoverPanelContentScript } from './provider-content-recovery.js';
import { getPanelProviderMode } from './panel-frame-config.js';
import { reloadPanelIframe } from './panel-health.js';
import { SEND_LIFECYCLE_CODES, SEND_LIFECYCLE_STAGES } from './send-lifecycle.js';

import { showToast } from './toast.js';

// Wenxin's current composer can disappear when its iframe is reloaded. Keep
// the failed state visible for diagnosis and allow later broadcasts to retry
// against the same page instead of refreshing the panel automatically.
const AUTO_RECOVER_PROVIDERS = new Set(['qianwen']);

const pendingPanelInjections = new Map();
const SUBMIT_DISPATCH_TIMEOUT_MS = 6000;
const SUBMIT_CONFIRMATION_TIMEOUT_MS = 5000;

export { isMergePanel, getMergePanelIds, getNonMergePanels } from './merge-panel-registry.js';

export async function broadcastMessage(text, autoSubmit = true, mergeSessionId = null) {
  const sendBtn = document.getElementById('send-all-btn');
  const statusEl = document.getElementById('send-status');
  const unifiedInput = document.getElementById('unified-input');

  if (!text.trim()) {
    if (autoSubmit) {
      await triggerSendButtons();
      return;
    }
    return;
  }

  const shouldAutoSubmit = autoSubmit;
  const sendFocusRequestId = shouldAutoSubmit
    ? restoreUnifiedInputFocusAfterSend(getChatgptPanelsWithFrames())
    : null;
  const inputDraft = unifiedInput?.value || '';
  const submittedCurrentDraft = inputDraft.length > 0 &&
    (text === inputDraft || text.endsWith(`\n\n${inputDraft}`));
  let inputClearedForSend = false;

  const clearSubmittedDraft = () => {
    if (!submittedCurrentDraft || !unifiedInput) return;
    unifiedInput.value = '';
    unifiedInput.style.height = 'auto';
    inputClearedForSend = true;
    recordDebugLog('broadcast:input-cleared', {
      stage: SEND_LIFECYCLE_STAGES.UI,
      code: SEND_LIFECYCLE_CODES.INPUT_CLEARED,
      textLength: inputDraft.length,
      mergeSessionId
    });
  };

  const restoreSubmittedDraft = (reason) => {
    if (!inputClearedForSend || !unifiedInput || unifiedInput.value !== '') return;
    unifiedInput.value = inputDraft;
    unifiedInput.dispatchEvent(new Event('input', { bubbles: true }));
    recordDebugLog('broadcast:input-restored', {
      reason,
      textLength: inputDraft.length,
      mergeSessionId
    });
  };

  try {
    sendBtn.disabled = true;
    statusEl.textContent = shouldAutoSubmit ? t('sending') : t('filling');
    statusEl.className = 'send-status';
    const targetPanels = getNonMergePanels();
    // 真实发送 = 新一轮运行，滚动调试会话，让本轮日志/verdict 与上一轮隔离
    if (shouldAutoSubmit) {
      rotateDebugSession();
    }
    recordDebugLog('broadcast:start', {
      autoSubmit: shouldAutoSubmit,
      textLength: text.length,
      mergeSessionId,
      targetPanels: targetPanels.map(getPanelDebugInfo)
    });
    // The unified composer is UI state, not a submission receipt. Record the
    // run boundary first, then clear the exact dispatched draft immediately.
    // This keeps the UI event in the new session without waiting for providers.
    clearSubmittedDraft();
    const panelResults = [];
    for (const panel of targetPanels) {
      await ensurePanelVisibleBeforeAutoSubmit(panel, shouldAutoSubmit, 'broadcast');
      try {
        const value = await sendToPanel(panel, text, shouldAutoSubmit, sendFocusRequestId, 0, mergeSessionId);
        panelResults.push({ status: 'fulfilled', value });
      } catch (reason) {
        panelResults.push({ status: 'rejected', reason });
      }
    }

    const panelSuccessful = panelResults.filter(r => r.status === 'fulfilled' && r.value).length;
    const totalSuccessful = panelSuccessful;
    const totalCount = targetPanels.length;
    const failed = totalCount - totalSuccessful;
    recordDebugLog('broadcast:result', {
      autoSubmit: shouldAutoSubmit,
      mergeSessionId,
      totalCount,
      totalSuccessful,
      failed,
      results: panelResults.map((result, index) => ({
        panel: getPanelDebugInfo(targetPanels[index]),
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : null,
        reason: result.status === 'rejected' ? String(result.reason?.message || result.reason) : null
      }))
    });

    if (failed === 0) {
      statusEl.textContent = shouldAutoSubmit
        ? t('sentToAI', totalSuccessful)
        : t('filledToInput', totalSuccessful);
      statusEl.className = 'send-status success';
    } else if (totalSuccessful > 0) {
      statusEl.textContent = shouldAutoSubmit
        ? t('sentToPartial', totalSuccessful, totalCount)
        : t('filledPartial', totalSuccessful, totalCount);
      statusEl.className = 'send-status partial';
    } else {
      statusEl.textContent = shouldAutoSubmit ? t('sendFailed') : t('fillFailed');
      statusEl.className = 'send-status error';
      restoreSubmittedDraft('all-panels-failed');
    }

    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);

  } catch (error) {
    console.error('Error in broadcastMessage:', error);
    recordDebugLog('broadcast:error', {
      message: error?.message || String(error)
    });
    statusEl.textContent = t('errorOccurred');
    statusEl.className = 'send-status error';
    restoreSubmittedDraft('broadcast-error');
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } finally {
    sendBtn.disabled = false;
  }
}

export function handlePanelInjectionResult(data) {
  const entry = pendingPanelInjections.get(data.injectionRequestId);
  if (!entry) return;
  entry.panel.contentScriptReachable = true;
  clearTimeout(entry.timeoutId);

  if (data.inputFound && data.injectSuccess) {
    recordDebugLog('panel-injection:success', {
      targetId: entry.panel.id,
      sourceId: entry.panel.providerId,
      panel: getPanelDebugInfo(entry.panel),
      autoSubmit: entry.autoSubmit,
      recoveryAttempt: entry.recoveryAttempt,
      mergeSessionId: entry.mergeSessionId,
      injectionRequestId: data.injectionRequestId,
      inputFound: data.inputFound,
      injectSuccess: data.injectSuccess,
      diagnostics: data.diagnostics || null
    });
    if (!entry.autoSubmit) {
      pendingPanelInjections.delete(data.injectionRequestId);
      entry.resolve(true);
      return;
    }

    entry.phase = 'waiting-dispatch';
    entry.timeoutId = setTimeout(() => {
      const pendingEntry = pendingPanelInjections.get(data.injectionRequestId);
      if (!pendingEntry || pendingEntry.phase !== 'waiting-dispatch') return;
      pendingPanelInjections.delete(data.injectionRequestId);
      recordDebugLog('panel-submit:timeout', {
        targetId: pendingEntry.panel.id,
        sourceId: pendingEntry.panel.providerId,
        panel: getPanelDebugInfo(pendingEntry.panel),
        mergeSessionId: pendingEntry.mergeSessionId,
        injectionRequestId: data.injectionRequestId,
        stage: SEND_LIFECYCLE_STAGES.TRANSPORT,
        code: SEND_LIFECYCLE_CODES.SUBMIT_RESULT_TIMEOUT
      });
      pendingEntry.resolve(false);
    }, SUBMIT_DISPATCH_TIMEOUT_MS);
    return;
  }
  pendingPanelInjections.delete(data.injectionRequestId);
  recordDebugLog('panel-injection:failed', {
    targetId: entry.panel.id,
    sourceId: entry.panel.providerId,
    panel: getPanelDebugInfo(entry.panel),
    autoSubmit: entry.autoSubmit,
    recoveryAttempt: entry.recoveryAttempt,
    mergeSessionId: entry.mergeSessionId,
    injectionRequestId: data.injectionRequestId,
    inputFound: data.inputFound,
    injectSuccess: data.injectSuccess,
    diagnostics: data.diagnostics || null
  });
  recoverFailedPanelInjection(entry);
}

export function handlePanelSubmitDispatchResult(data) {
  const entry = pendingPanelInjections.get(data.injectionRequestId);
  if (!entry || !entry.autoSubmit || entry.phase !== 'waiting-dispatch') return;

  entry.panel.contentScriptReachable = true;
  clearTimeout(entry.timeoutId);

  if (!data.dispatched) {
    pendingPanelInjections.delete(data.injectionRequestId);
    if (data.error === 'SUBMIT_CANCELLED') {
      entry.resolve(false);
      return;
    }
    recordDebugLog('panel-submit:failed', {
      targetId: entry.panel.id,
      sourceId: entry.panel.providerId,
      panel: getPanelDebugInfo(entry.panel),
      recoveryAttempt: entry.recoveryAttempt,
      mergeSessionId: entry.mergeSessionId,
      injectionRequestId: data.injectionRequestId,
      stage: SEND_LIFECYCLE_STAGES.SUBMIT,
      code: data.error || 'SEND_CONTROL_NOT_FOUND',
      error: data.error || 'SEND_CONTROL_NOT_FOUND'
    });
    entry.resolve(false);
    return;
  }

  entry.phase = 'observing-confirmation';
  entry.resolve(true);
  entry.timeoutId = setTimeout(() => {
    const pendingEntry = pendingPanelInjections.get(data.injectionRequestId);
    if (!pendingEntry || pendingEntry.phase !== 'observing-confirmation') return;
    pendingPanelInjections.delete(data.injectionRequestId);
    recordDebugLog('panel-submit:unconfirmed', {
      targetId: pendingEntry.panel.id,
      sourceId: pendingEntry.panel.providerId,
      panel: getPanelDebugInfo(pendingEntry.panel),
      mergeSessionId: pendingEntry.mergeSessionId,
      injectionRequestId: data.injectionRequestId,
      stage: SEND_LIFECYCLE_STAGES.SUBMIT,
      code: 'SUBMIT_NOT_CONFIRMED'
    });
  }, SUBMIT_CONFIRMATION_TIMEOUT_MS);
}

export function handlePanelSubmitResult(data) {
  const entry = pendingPanelInjections.get(data.injectionRequestId);
  if (!entry || !entry.autoSubmit) return;

  entry.panel.contentScriptReachable = true;
  clearTimeout(entry.timeoutId);
  pendingPanelInjections.delete(data.injectionRequestId);

  if (data.error === 'SUBMIT_CANCELLED') return;

  // Compatibility with an older content-script bundle: a confirmation result
  // necessarily means a click was already attempted, so it may also release
  // the serial queue when the dispatch acknowledgement is absent.
  if (entry.phase === 'waiting-dispatch') {
    entry.resolve(true);
  }

  if (data.submitSuccess) {
    recordDebugLog('panel-submit:success', {
      targetId: entry.panel.id,
      sourceId: entry.panel.providerId,
      panel: getPanelDebugInfo(entry.panel),
      recoveryAttempt: entry.recoveryAttempt,
      mergeSessionId: entry.mergeSessionId,
      injectionRequestId: data.injectionRequestId,
      diagnostics: data.diagnostics || null
    });
    return;
  }

  recordDebugLog('panel-submit:unconfirmed', {
    targetId: entry.panel.id,
    sourceId: entry.panel.providerId,
    panel: getPanelDebugInfo(entry.panel),
    recoveryAttempt: entry.recoveryAttempt,
    mergeSessionId: entry.mergeSessionId,
    injectionRequestId: data.injectionRequestId,
    stage: SEND_LIFECYCLE_STAGES.SUBMIT,
    code: data.error || 'SUBMIT_NOT_CONFIRMED',
    error: data.error || 'SUBMIT_NOT_CONFIRMED',
    diagnostics: data.diagnostics || null
  });
}

function recoverFailedPanelInjection(entry) {
  const { panel } = entry;
  if (!AUTO_RECOVER_PROVIDERS.has(panel.providerId) || entry.recoveryAttempt >= 1) {
    recordDebugLog('panel-injection:give-up', {
      panel: getPanelDebugInfo(panel),
      recoveryAttempt: entry.recoveryAttempt,
      autoRecoverSupported: AUTO_RECOVER_PROVIDERS.has(panel.providerId),
      mergeSessionId: entry.mergeSessionId
    });
    entry.resolve(false);
    return;
  }

  console.warn('[MultiPanel] Retrying failed injection after reload:', panel.providerId);
  recordDebugLog('panel-injection:retry-after-reload', {
    panel: getPanelDebugInfo(panel),
    recoveryAttempt: entry.recoveryAttempt + 1,
    mergeSessionId: entry.mergeSessionId
  });
  const iframe = panel.iframe;
  const retryTimeout = setTimeout(() => {
    iframe.removeEventListener('load', retryAfterLoad);
    entry.resolve(false);
  }, 15000);
  const retryAfterLoad = () => {
    clearTimeout(retryTimeout);
    sendToPanel(panel, entry.text, entry.autoSubmit, entry.requestId, entry.recoveryAttempt + 1, entry.mergeSessionId)
      .then(entry.resolve);
  };
  iframe.addEventListener('load', retryAfterLoad, { once: true });
  reloadPanelIframe(panel);
}

export async function sendToPanel(panel, text, autoSubmit = true, requestId = null, recoveryAttempt = 0, mergeSessionId = null) {
  return new Promise((resolve) => {
    try {
      if (!panel.iframe || !panel.iframe.contentWindow) {
        recordDebugLog('panel-send:missing-iframe', {
          panel: getPanelDebugInfo(panel),
          autoSubmit,
          recoveryAttempt,
          mergeSessionId
        });
        resolve(false);
        return;
      }

      const injectionRequestId = `inject-${panel.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      recordDebugLog('panel-send:start', {
        panel: getPanelDebugInfo(panel),
        autoSubmit,
        textLength: text.length,
        recoveryAttempt,
        mergeSessionId,
        injectionRequestId
      });
      const timeoutId = setTimeout(() => {
        const entry = pendingPanelInjections.get(injectionRequestId);
        if (!entry) return;
        pendingPanelInjections.delete(injectionRequestId);
        recordDebugLog('panel-injection:timeout', {
          panel: getPanelDebugInfo(entry.panel),
          autoSubmit: entry.autoSubmit,
          recoveryAttempt: entry.recoveryAttempt,
          mergeSessionId: entry.mergeSessionId,
          injectionRequestId,
          transportProbe: entry.transportProbe
        });
        recoverFailedPanelInjection(entry);
      }, 6000);
      pendingPanelInjections.set(injectionRequestId, {
        resolve, panel, text, autoSubmit, requestId, recoveryAttempt, mergeSessionId, timeoutId,
        phase: 'waiting-injection',
        transportProbe: { status: 'pending' }
      });

      probePanelContentScript(panel).then(async transportProbe => {
        const entry = pendingPanelInjections.get(injectionRequestId);
        if (!entry) return;
        entry.transportProbe = transportProbe;
        if (transportProbe.status === 'pong') panel.contentScriptReachable = true;
        else if (transportProbe.status === 'timeout') panel.contentScriptReachable = false;
        if (panel.providerId !== 'wenxin' ||
            transportProbe.status !== 'timeout' ||
            transportProbe.readySeen !== false ||
            recoveryAttempt > 0) return;

        const recovery = await recoverPanelContentScript(panel);
        const currentEntry = pendingPanelInjections.get(injectionRequestId);
        if (!currentEntry) return;
        currentEntry.transportProbe = { ...transportProbe, recovery };
        recordDebugLog('provider-content-recovery:result', {
          targetId: panel.id,
          sourceId: panel.providerId,
          panel: getPanelDebugInfo(panel),
          success: recovery.success === true,
          reason: recovery.reason || null,
          frameCount: recovery.frameCount || 0
        });
        if (!recovery.success) return;

        // The initial timer started before the Wenxin transport probe and
        // recovery. Give only the recovered Wenxin listener a fresh response
        // window; other providers keep the existing timeout behavior.
        clearTimeout(currentEntry.timeoutId);
        currentEntry.timeoutId = setTimeout(() => {
          const timedOutEntry = pendingPanelInjections.get(injectionRequestId);
          if (!timedOutEntry) return;
          pendingPanelInjections.delete(injectionRequestId);
          recordDebugLog('panel-injection:timeout', {
            panel: getPanelDebugInfo(timedOutEntry.panel),
            autoSubmit: timedOutEntry.autoSubmit,
            recoveryAttempt: timedOutEntry.recoveryAttempt,
            mergeSessionId: timedOutEntry.mergeSessionId,
            injectionRequestId,
            transportProbe: timedOutEntry.transportProbe
          });
          recoverFailedPanelInjection(timedOutEntry);
        }, 6000);

        if (mergeSessionId) {
          postToPanelIframe(panel, {
            type: 'MONITOR_COMPLETION',
            mergeSessionId,
            panelId: panel.id,
            context: 'multi-panel'
          });
        }
        postToPanelIframe(panel, {
          type: 'INJECT_TEXT',
          text,
          autoSubmit,
          requestId,
          mergeSessionId,
          injectionRequestId,
          providerMode: getPanelProviderMode(panel),
          context: 'multi-panel'
        });
      });

      if (mergeSessionId) {
        postToPanelIframe(panel, {
          type: 'MONITOR_COMPLETION',
          mergeSessionId,
          panelId: panel.id,
          context: 'multi-panel'
        });
      }

      postToPanelIframe(panel, {
        type: 'INJECT_TEXT',
        text,
        autoSubmit,
        requestId,
        mergeSessionId,
        injectionRequestId,
        providerMode: getPanelProviderMode(panel),
        context: 'multi-panel'
      });
    } catch (error) {
      console.error(`Error sending to ${panel.providerId}:`, error);
      recordDebugLog('panel-send:error', {
        panel: getPanelDebugInfo(panel),
        autoSubmit,
        recoveryAttempt,
        mergeSessionId,
        message: error?.message || String(error)
      });
      resolve(false);
    }
  });
}

function getPanelPageIndex(panel) {
  const panels = getPanels();
  const panelIndex = panels.indexOf(panel);
  if (panelIndex < 0) return getCurrentPanelPage();
  return getLayoutPanelPageIndex(panelIndex, getCurrentLayout());
}

export async function ensurePanelVisibleBeforeAutoSubmit(panel, autoSubmit, reason = 'send') {
  if (!autoSubmit || !panel) return;

  const targetPage = getPanelPageIndex(panel);
  if (getCurrentPanelPage() === targetPage) return;

  recordDebugLog('panel-send:activate-page', {
    panel: getPanelDebugInfo(panel),
    fromPage: getCurrentPanelPage(),
    toPage: targetPage,
    reason
  });
  setCurrentPanelPage(targetPage);
  renderCurrentPage();
  await sleep(500);
}

export async function clearAllInputs() {
  var unifiedInput = document.getElementById('unified-input');
  unifiedInput.value = '';
  unifiedInput.style.height = 'auto';

  getNonMergePanels().forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      postToPanelIframe(panel, {
        type: 'CLEAR_INPUT',
        providerMode: getPanelProviderMode(panel),
        context: 'multi-panel'
      });
    }
  });
  showToast(t('clearedAllInputs'));
}

export async function newChatAllProviders() {
  const newChatBtn = document.getElementById('new-chat-btn');

  const discussion = await import('./discussion-runner.js');
  if (discussion.getDiscussionActive()) {
    discussion.stopDiscussion('new-chat');
  }
  const mergeMonitor = await import('./merge-monitor.js');
  mergeMonitor.invalidateCompletionSessions('new-chat');
  mergeMonitor.stopMergeMonitor(getPanels(), getMergePanelIds());

  newChatBtn.disabled = true;

  await Promise.all(getPanels().map(panel =>
    startFreshChatForPanel(panel, { invalidateSession: false })
  ));

  restoreUnifiedInputFocusAfterNewChat();
  showToast(t('newChatCreated'));

  setTimeout(() => {
    newChatBtn.disabled = false;
  }, 1000);
}

export async function triggerSendButtons() {
  const sendBtn = document.getElementById('send-all-btn');
  const statusEl = document.getElementById('send-status');
  const sendFocusRequestId = restoreUnifiedInputFocusAfterSend(getChatgptPanelsWithFrames());

  try {
    sendBtn.disabled = true;
    statusEl.textContent = t('sending');
    statusEl.className = 'send-status';

    const targetPanels = getNonMergePanels();
    targetPanels.forEach(panel => {
      if (panel.iframe && panel.iframe.contentWindow) {
        postToPanelIframe(panel, {
          type: 'TRIGGER_SEND',
          requestId: sendFocusRequestId,
          providerMode: getPanelProviderMode(panel),
          context: 'multi-panel'
        });
      }
    });

    statusEl.textContent = t('sentToAI', targetPanels.length);
    statusEl.className = 'send-status success';

    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } catch (error) {
    console.error('Error in triggerSendButtons:', error);
    statusEl.textContent = t('errorOccurred');
    statusEl.className = 'send-status error';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } finally {
    sendBtn.disabled = false;
  }
}
