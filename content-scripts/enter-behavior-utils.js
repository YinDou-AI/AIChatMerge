// Shared utilities for Enter key behavior modification
// Supports customizable key combinations for newline and send actions
//
// 包含公共的 createEnterEvent 函数，供所有 enter-behavior-*.js 使用。
// 消除各 Provider 脚本中重复的 createEnterEvent 实现。

let enterKeyConfig = null;

/**
 * 创建合成的 Enter KeyboardEvent
 *
 * @param {Object} [modifiers] - 修饰键配置
 * @param {boolean} [modifiers.shift] - Shift 键
 * @param {boolean} [modifiers.ctrl] - Ctrl 键
 * @param {boolean} [modifiers.meta] - Meta 键
 * @param {boolean} [modifiers.alt] - Alt 键
 * @param {Object} [options] - 额外选项
 * @param {boolean} [options.markSynthetic=true] - 是否标记为合成事件
 * @returns {KeyboardEvent} 合成的键盘事件
 *
 * @example
 * const enterEvent = createEnterEvent({ shift: true });
 * element.dispatchEvent(enterEvent);
 */
function createEnterEvent(modifiers = {}, options = {}) {
  const { markSynthetic = true } = options;
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    shiftKey: modifiers.shift || false,
    ctrlKey: modifiers.ctrl || false,
    metaKey: modifiers.meta || false,
    altKey: modifiers.alt || false
  });
  if (markSynthetic) {
    Object.defineProperty(event, '_synthetic_from_extension', { value: true, writable: false });
  }
  return event;
}
const DEFAULT_ENTER_KEY_BEHAVIOR = {
  enabled: true,
  preset: 'default',
  newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
  sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
};

function enableEnterSwap() {
  window.addEventListener("keydown", handleEnterSwap, { capture: true });
}

function disableEnterSwap() {
  window.removeEventListener("keydown", handleEnterSwap, { capture: true });
}

function normalizeEnterKeyBehavior(config) {
  const source = config && typeof config === 'object' ? config : {};
  const newlineModifiers = source.newlineModifiers && typeof source.newlineModifiers === 'object'
    ? source.newlineModifiers
    : DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers;
  const sendModifiers = source.sendModifiers && typeof source.sendModifiers === 'object'
    ? source.sendModifiers
    : DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers;

  return {
    enabled: source.enabled !== false,
    preset: typeof source.preset === 'string' ? source.preset : DEFAULT_ENTER_KEY_BEHAVIOR.preset,
    newlineModifiers: {
      shift: newlineModifiers.shift === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers.shift : newlineModifiers.shift === true,
      ctrl: newlineModifiers.ctrl === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers.ctrl : newlineModifiers.ctrl === true,
      alt: newlineModifiers.alt === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers.alt : newlineModifiers.alt === true,
      meta: newlineModifiers.meta === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers.meta : newlineModifiers.meta === true
    },
    sendModifiers: {
      shift: sendModifiers.shift === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers.shift : sendModifiers.shift === true,
      ctrl: sendModifiers.ctrl === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers.ctrl : sendModifiers.ctrl === true,
      alt: sendModifiers.alt === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers.alt : sendModifiers.alt === true,
      meta: sendModifiers.meta === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers.meta : sendModifiers.meta === true
    }
  };
}

function setEnterKeyConfig(config) {
  enterKeyConfig = normalizeEnterKeyBehavior(config);

  if (enterKeyConfig.enabled) {
    enableEnterSwap();
  } else {
    disableEnterSwap();
  }
}

function loadEnterBehaviorFromLocal() {
  chrome.storage.local.get({
    enterKeyBehavior: DEFAULT_ENTER_KEY_BEHAVIOR
  }, (data) => {
    setEnterKeyConfig(data.enterKeyBehavior);
  });
}

// Check if event matches the configured modifiers
function matchesModifiers(event, modifiers) {
  return event.shiftKey === (modifiers.shift || false) &&
         event.ctrlKey === (modifiers.ctrl || false) &&
         event.altKey === (modifiers.alt || false) &&
         event.metaKey === (modifiers.meta || false);
}

// Get target event modifiers based on action type
function getTargetModifiers(actionType) {
  if (!enterKeyConfig) return null;

  if (actionType === 'newline') {
    return enterKeyConfig.newlineModifiers;
  } else if (actionType === 'send') {
    return enterKeyConfig.sendModifiers;
  }
  return null;
}

function applyEnterSwapSetting() {
  chrome.storage.sync.get({
    enterKeyBehavior: DEFAULT_ENTER_KEY_BEHAVIOR
  }, (data) => {
    if (chrome.runtime.lastError) {
      loadEnterBehaviorFromLocal();
      return;
    }

    setEnterKeyConfig(data.enterKeyBehavior);
  });
}

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === "sync" || area === "local") && changes.enterKeyBehavior) {
    applyEnterSwapSetting();
  }
});
