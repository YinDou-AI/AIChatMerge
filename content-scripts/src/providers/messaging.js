// messaging.js — Extension 消息通信
// 日志前缀：text-injection:messaging

import {
  detectProvider,
  getMultiPanelUserInteractionTracking,
  setMultiPanelUserInteractionTracking,
  MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS,
  MULTI_PANEL_PROVIDER_STATUS_CONTEXT
} from './detection.js';
import { ENABLE_CONTENT_SCRIPT_DIAGNOSTICS } from '../../../modules/diagnostic-config.js';

const ACM_PROVIDER_USER_INTERACTION = 'ACM_PROVIDER_USER_INTERACTION';

// Provider pages are intentionally frameable while this extension is active.
// A parent window is therefore not trusted merely because it is the parent.
function getExtensionOrigin() {
  try {
    const extensionUrl = new URL(chrome.runtime.getURL('/'));
    // Some URL implementations report a null origin for extension schemes.
    // Chrome itself has a concrete chrome-extension://<id> origin.
    return extensionUrl.origin === 'null'
      ? `${extensionUrl.protocol}//${extensionUrl.host}`
      : extensionUrl.origin;
  } catch (error) {
    console.warn('[MessageHandler] Unable to determine extension origin', error);
    return null;
  }
}

export const extensionOrigin = getExtensionOrigin();
let trustedExtensionParentSource = null;

export function isTrustedExtensionParent(event) {
  const trusted = !!extensionOrigin &&
    event?.origin === extensionOrigin &&
    !!event.source &&
    event.source !== window;
  if (trusted) trustedExtensionParentSource = event.source;
  return trusted;
}

export function postToExtensionParent(message) {
  const target = trustedExtensionParentSource || window.__realParent__ || window.parent;
  if (target && target !== window && extensionOrigin) {
    target.postMessage(message, extensionOrigin);
  }
}

export function postInjectionResult(injectionRequestId, provider, inputFound, injectSuccess, error = null, diagnostics = null) {
  if (!injectionRequestId) return;
  postToExtensionParent({
    type: 'INJECT_TEXT_RESULT',
    injectionRequestId,
    provider,
    inputFound,
    injectSuccess,
    error,
    diagnostics: ENABLE_CONTENT_SCRIPT_DIAGNOSTICS ? diagnostics : null,
    context: 'multi-panel-injection'
  });
}

export function postSubmitResult(injectionRequestId, provider, submitSuccess, error = null, diagnostics = null) {
  if (!injectionRequestId) return;
  postToExtensionParent({
    type: 'SUBMIT_TEXT_RESULT',
    injectionRequestId,
    provider,
    submitSuccess,
    error,
    diagnostics: ENABLE_CONTENT_SCRIPT_DIAGNOSTICS ? diagnostics : null,
    context: 'multi-panel-submission'
  });
}

// Business acknowledgement used by the serial broadcast queue. This message
// is not diagnostic and therefore remains available in formal builds.
export function postSubmitDispatchResult(injectionRequestId, provider, dispatched, error = null) {
  if (!injectionRequestId) return;
  postToExtensionParent({
    type: 'SUBMIT_TEXT_DISPATCH_RESULT',
    injectionRequestId,
    provider,
    dispatched,
    error,
    context: 'multi-panel-submission-dispatch'
  });
}

export function postInjectionDiagnostic(event, injectionRequestId, provider, details = {}) {
  if (!ENABLE_CONTENT_SCRIPT_DIAGNOSTICS) return;
  if (!injectionRequestId || !event) return;
  postToExtensionParent({
    type: 'INJECTION_DIAGNOSTIC',
    event,
    injectionRequestId,
    provider,
    details,
    context: 'multi-panel-injection-diagnostic'
  });
}

// 完成监控诊断：与注入请求无关（monitor 由 MONITOR_COMPLETION 触发，
// 没有 injectionRequestId），走独立消息类型，面板记录为 completion-monitor:*。
export function postCompletionDiagnostic(event, provider, details = {}) {
  if (!ENABLE_CONTENT_SCRIPT_DIAGNOSTICS) return;
  if (!event) return;
  postToExtensionParent({
    type: 'COMPLETION_DIAGNOSTIC',
    event,
    provider,
    details,
    context: 'multi-panel-completion-diagnostic'
  });
}

export function postMultiPanelProviderStatus(type, requestId, phase, provider = detectProvider()) {
  if (!requestId || window.parent === window) {
    return;
  }

  window.parent.postMessage({
    type,
    requestId,
    provider,
    phase,
    context: MULTI_PANEL_PROVIDER_STATUS_CONTEXT
  }, extensionOrigin);
}

// ===== User Interaction Tracking =====

export function stopMultiPanelUserInteractionTracking() {
  const tracking = getMultiPanelUserInteractionTracking();
  if (!tracking) {
    return;
  }

  if (typeof tracking.timeoutId === 'number') {
    clearTimeout(tracking.timeoutId);
  }

  if (tracking.interactionHandler) {
    document.removeEventListener('pointerdown', tracking.interactionHandler, true);
    document.removeEventListener('keydown', tracking.interactionHandler, true);
  }

  setMultiPanelUserInteractionTracking(null);
}

export function startMultiPanelUserInteractionTracking(requestId, provider = detectProvider()) {
  if (!requestId || !provider) {
    return;
  }

  stopMultiPanelUserInteractionTracking();

  const tracking = {
    requestId,
    provider,
    timeoutId: null,
    interactionHandler: null
  };

  tracking.interactionHandler = (event) => {
    if (getMultiPanelUserInteractionTracking() !== tracking || !event.isTrusted) {
      return;
    }

    postMultiPanelProviderStatus(
      ACM_PROVIDER_USER_INTERACTION,
      tracking.requestId,
      'user-interaction',
      tracking.provider
    );

    stopMultiPanelUserInteractionTracking();
  };

  document.addEventListener('pointerdown', tracking.interactionHandler, true);
  document.addEventListener('keydown', tracking.interactionHandler, true);

  tracking.timeoutId = setTimeout(() => {
    if (getMultiPanelUserInteractionTracking() !== tracking) {
      return;
    }

    stopMultiPanelUserInteractionTracking();
  }, MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS);

  setMultiPanelUserInteractionTracking(tracking);
}
