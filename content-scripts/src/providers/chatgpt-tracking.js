// chatgpt-tracking.js — ChatGPT 发送状态追踪
// 日志前缀：text-injection:chatgpt

import { CHATGPT_STOP_BUTTON_SELECTOR, CHATGPT_SEND_TRACKING_IDLE_DELAY_MS, CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS, ACM_PROVIDER_BUSY, ACM_PROVIDER_IDLE, MULTI_PANEL_PROVIDER_STATUS_CONTEXT, getChatgptSendTracking, setChatgptSendTracking } from './detection.js';
import { postMultiPanelProviderStatus } from './messaging.js';

function hasTimer(timerId) {
  return timerId !== null && timerId !== undefined;
}

export function findChatgptBusyButton() {
  return document.querySelector(CHATGPT_STOP_BUTTON_SELECTOR);
}

export function getChatgptComposerRoot() {
  return document.querySelector('form[data-type="unified-composer"]') ||
    document.querySelector('#prompt-textarea')?.closest('form') ||
    document.body;
}

export function stopChatgptSendTracking({ reportIdle = false } = {}) {
  const tracking = getChatgptSendTracking();
  if (!tracking) {
    return;
  }

  if (tracking.observer) {
    tracking.observer.disconnect();
  }

  if (hasTimer(tracking.idleTimerId)) {
    clearTimeout(tracking.idleTimerId);
  }

  if (hasTimer(tracking.noBusyTimerId)) {
    clearTimeout(tracking.noBusyTimerId);
  }

  const { requestId, phase } = tracking;
  setChatgptSendTracking(null);

  if (reportIdle) {
    postMultiPanelProviderStatus(ACM_PROVIDER_IDLE, requestId, phase, 'chatgpt');
  }
}

export function evaluateChatgptSendTrackingState() {
  const tracking = getChatgptSendTracking();
  if (!tracking) {
    return;
  }

  if (findChatgptBusyButton()) {
    if (hasTimer(tracking.noBusyTimerId)) {
      clearTimeout(tracking.noBusyTimerId);
      tracking.noBusyTimerId = null;
    }

    if (hasTimer(tracking.idleTimerId)) {
      clearTimeout(tracking.idleTimerId);
      tracking.idleTimerId = null;
    }

    if (tracking.phase !== 'busy') {
      tracking.phase = 'busy';
      postMultiPanelProviderStatus(ACM_PROVIDER_BUSY, tracking.requestId, tracking.phase, 'chatgpt');
    }
    return;
  }

  if (tracking.phase !== 'busy' || hasTimer(tracking.idleTimerId)) {
    return;
  }

  tracking.idleTimerId = setTimeout(() => {
    const currentTracking = getChatgptSendTracking();
    if (!currentTracking || currentTracking.requestId !== tracking.requestId) {
      return;
    }

    currentTracking.idleTimerId = null;
    if (findChatgptBusyButton()) {
      evaluateChatgptSendTrackingState();
      return;
    }

    currentTracking.phase = 'idle';
    stopChatgptSendTracking({ reportIdle: true });
  }, CHATGPT_SEND_TRACKING_IDLE_DELAY_MS);
}

export function startChatgptSendTracking(requestId) {
  if (!requestId) {
    return;
  }

  stopChatgptSendTracking();

  const tracking = {
    requestId,
    phase: 'pending',
    observer: null,
    idleTimerId: null,
    noBusyTimerId: null
  };

  const observerTarget = document.body || getChatgptComposerRoot();
  if (observerTarget) {
    tracking.observer = new MutationObserver(() => {
      if (getChatgptSendTracking() !== tracking) {
        return;
      }

      if (tracking.phase === 'busy' && hasTimer(tracking.idleTimerId) && findChatgptBusyButton()) {
        clearTimeout(tracking.idleTimerId);
        tracking.idleTimerId = null;
      }

      evaluateChatgptSendTrackingState();
    });

    tracking.observer.observe(observerTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid', 'aria-label', 'disabled', 'aria-disabled']
    });
  }

  tracking.noBusyTimerId = setTimeout(() => {
    if (getChatgptSendTracking() !== tracking || tracking.phase !== 'pending') {
      return;
    }

    stopChatgptSendTracking();
  }, CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS);

  setChatgptSendTracking(tracking);
  evaluateChatgptSendTrackingState();
}
