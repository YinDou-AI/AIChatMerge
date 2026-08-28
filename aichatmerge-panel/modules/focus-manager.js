import { postNewChatToPanel } from './panel-new-chat.js';
import { isChatgptProvider } from './panel-frame-config.js';
import { getPanels, getLoadingPanelIds as getLoadingPanelIdsRaw } from './state.js';
import { getMergePanelIds } from './merge-panel-registry.js';

let newChatFocusRestoreTimerIds = [];
let isRestoringFocusAfterNewChat = false;
let sendFocusRestoreTimerIds = [];
let isRestoringFocusAfterSend = false;
let activeSendFocusRequestId = null;
let sendFocusRequestCounter = 0;
let sendFocusActivePanelIds = new Set();
let sendFocusBusyDetectionTimeoutIds = new Map();
let sendFocusHardTimeoutIds = new Map();

const SEND_FOCUS_RESTORE_DELAYS = [0, 80, 200, 400, 800, 1500, 2500, 4000, 6000, 8000, 10000, 12000];
const SEND_FOCUS_NO_BUSY_TIMEOUT_MS = 2000;
const SEND_FOCUS_HARD_TIMEOUT_MS = 90000;
const PROMPT_EDITOR_INTERACTIVE_SELECTOR = '#prompt-editor-modal input, #prompt-editor-modal textarea, #prompt-editor-modal button, #prompt-editor-modal select';

export function getLoadingPanelIds() {
  return getLoadingPanelIdsRaw();
}

export function isRestoringFocusAfterNewChatGetter() {
  return isRestoringFocusAfterNewChat;
}

export function isRestoringFocusAfterSendGetter() {
  return isRestoringFocusAfterSend;
}

export function activeSendFocusRequestIdGetter() {
  return activeSendFocusRequestId;
}

export function focusUnifiedInput({ force = false } = {}) {
  const inputTextarea = document.getElementById('unified-input');
  if (!inputTextarea) {
    return;
  }

  const active = document.activeElement;
  if (isPromptEditorInteractiveControl(active)) {
    return;
  }

  const shouldFocus = force || !active || active.tagName === 'IFRAME' || active === document.body;
  if (!shouldFocus) {
    return;
  }

  requestAnimationFrame(() => {
    try {
      inputTextarea.focus({ preventScroll: true });
    } catch {
      inputTextarea.focus();
    }
  });
}

export function shouldPreserveUnifiedInputFocus() {
  return getLoadingPanelIdsRaw().size > 0 || isRestoringFocusAfterNewChat || isRestoringFocusAfterSend;
}

export function isPromptEditorInteractiveControl(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest(PROMPT_EDITOR_INTERACTIVE_SELECTOR));
}

export function isHoveredProviderIframe(target) {
  if (!(target instanceof HTMLIFrameElement)) {
    return false;
  }

  try {
    return target.matches(':hover');
  } catch {
    return false;
  }
}

export function cancelUnifiedInputFocusRestore() {
  newChatFocusRestoreTimerIds.forEach(timerId => clearTimeout(timerId));
  newChatFocusRestoreTimerIds = [];
  isRestoringFocusAfterNewChat = false;
}

export function cancelUnifiedInputFocusRestoreAfterSend() {
  sendFocusRestoreTimerIds.forEach(timerId => clearTimeout(timerId));
  sendFocusRestoreTimerIds = [];
  sendFocusBusyDetectionTimeoutIds.forEach(timerId => clearTimeout(timerId));
  sendFocusBusyDetectionTimeoutIds.clear();
  sendFocusHardTimeoutIds.forEach(timerId => clearTimeout(timerId));
  sendFocusHardTimeoutIds.clear();
  sendFocusActivePanelIds.clear();
  activeSendFocusRequestId = null;
  isRestoringFocusAfterSend = false;
}

export function handleUnifiedInputBlur(event) {
  if (isPromptEditorInteractiveControl(event?.relatedTarget)) {
    return;
  }

  const respectProviderFocus = (target) => {
    if (!isHoveredProviderIframe(target)) {
      return false;
    }

    // Pointer events inside a cross-origin iframe do not bubble to the panel
    // document. Treat focus moving to the iframe under the pointer as explicit
    // user intent and stop all queued attempts to reclaim the focus.
    cancelUnifiedInputFocusRestore();
    cancelUnifiedInputFocusRestoreAfterSend();
    return true;
  };

  if (respectProviderFocus(event?.relatedTarget)) {
    return;
  }

  requestAnimationFrame(() => {
    if (respectProviderFocus(document.activeElement)) {
      return;
    }
    if (shouldPreserveUnifiedInputFocus()) {
      focusUnifiedInput();
    }
  });
}

export async function startFreshChatForPanel(panel, { invalidateSession = true } = {}) {
  if (!panel) {
    return;
  }
  postNewChatToPanel(panel);
  if (!invalidateSession) return;
  // 与关闭面板逻辑一致：该面板回答已失效，从已完成集合中移除，
  // 如果剩余面板全部完成则触发融合
  const { reconcileAfterPanelRemoval } = await import('./merge-monitor.js');
  reconcileAfterPanelRemoval(panel.id, getPanels(), getMergePanelIds());
}

export function isUnifiedInputOrNewChatControl(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('#unified-input, #new-chat-btn'));
}

export function isUnifiedInputOrSendControl(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('#unified-input, #send-all-btn'));
}

export function restoreUnifiedInputFocusAfterNewChat() {
  cancelUnifiedInputFocusRestore();
  isRestoringFocusAfterNewChat = true;

  const restoreDelays = [0, 80, 200, 400, 800, 1000, 1200, 1500];
  restoreDelays.forEach((delay, index) => {
    const timerId = setTimeout(() => {
      if (!isRestoringFocusAfterNewChat) {
        return;
      }

      focusUnifiedInput({ force: true });

      if (index === restoreDelays.length - 1) {
        cancelUnifiedInputFocusRestore();
      }
    }, delay);

    newChatFocusRestoreTimerIds.push(timerId);
  });
}

export function createSendFocusRequestId() {
  sendFocusRequestCounter += 1;
  return `send-focus-${Date.now()}-${sendFocusRequestCounter}`;
}

export function clearSendFocusProviderTimeout(timeoutMap, panelId) {
  const timerId = timeoutMap.get(panelId);
  if (typeof timerId === 'number') {
    clearTimeout(timerId);
  }
  timeoutMap.delete(panelId);
}

export function maybeStopSendFocusRestore() {
  if (sendFocusRestoreTimerIds.length > 0) {
    return;
  }

  if (sendFocusActivePanelIds.size > 0) {
    return;
  }

  cancelUnifiedInputFocusRestoreAfterSend();
}

export function getChatgptPanelsWithFrames() {
  return getPanels().filter(panel => (
    isChatgptProvider(panel.providerId) &&
    panel.iframe &&
    panel.iframe.contentWindow
  ));
}

export function scheduleChatgptBusyDetectionTimeout(panel, requestId) {
  clearSendFocusProviderTimeout(sendFocusBusyDetectionTimeoutIds, panel.id);

  const timerId = setTimeout(() => {
    if (activeSendFocusRequestId !== requestId) {
      return;
    }

    sendFocusBusyDetectionTimeoutIds.delete(panel.id);
  }, SEND_FOCUS_NO_BUSY_TIMEOUT_MS);

  sendFocusBusyDetectionTimeoutIds.set(panel.id, timerId);
}

export function scheduleChatgptHardTimeout(panelId, requestId) {
  clearSendFocusProviderTimeout(sendFocusHardTimeoutIds, panelId);

  const timerId = setTimeout(() => {
    if (activeSendFocusRequestId !== requestId) {
      return;
    }

    sendFocusActivePanelIds.delete(panelId);
    sendFocusHardTimeoutIds.delete(panelId);
    maybeStopSendFocusRestore();
  }, SEND_FOCUS_HARD_TIMEOUT_MS);

  sendFocusHardTimeoutIds.set(panelId, timerId);
}

export function handleSendFocusProviderBusy(panel, requestId) {
  if (activeSendFocusRequestId !== requestId) {
    return;
  }

  clearSendFocusProviderTimeout(sendFocusBusyDetectionTimeoutIds, panel.id);
  sendFocusActivePanelIds.add(panel.id);
  isRestoringFocusAfterSend = true;
  scheduleChatgptHardTimeout(panel.id, requestId);
  focusUnifiedInput({ force: true });
}

export function handleSendFocusProviderIdle(panel, requestId) {
  if (activeSendFocusRequestId !== requestId) {
    return;
  }

  clearSendFocusProviderTimeout(sendFocusBusyDetectionTimeoutIds, panel.id);
  clearSendFocusProviderTimeout(sendFocusHardTimeoutIds, panel.id);
  sendFocusActivePanelIds.delete(panel.id);
  maybeStopSendFocusRestore();
}

export function restoreUnifiedInputFocusAfterSend(trackedPanels = []) {
  cancelUnifiedInputFocusRestoreAfterSend();
  isRestoringFocusAfterSend = true;
  activeSendFocusRequestId = createSendFocusRequestId();

  trackedPanels.forEach(panel => scheduleChatgptBusyDetectionTimeout(panel, activeSendFocusRequestId));

  const requestId = activeSendFocusRequestId;
  SEND_FOCUS_RESTORE_DELAYS.forEach((delay, index) => {
    const timerId = setTimeout(() => {
      if (!isRestoringFocusAfterSend || activeSendFocusRequestId !== requestId) {
        return;
      }

      focusUnifiedInput({ force: true });

      if (index === SEND_FOCUS_RESTORE_DELAYS.length - 1) {
        sendFocusRestoreTimerIds = [];
        maybeStopSendFocusRestore();
      }
    }, delay);

    sendFocusRestoreTimerIds.push(timerId);
  });

  return requestId;
}
