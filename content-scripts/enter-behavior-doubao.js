// Doubao Enter/Shift+Enter behavior swap
// Supports customizable key combinations via settings
// Depends on globals from enter-behavior-utils.js:
// - enterKeyConfig
// - matchesModifiers()
// - applyEnterSwapSetting()

function createEnterEvent(modifiers = {}) {
  return new KeyboardEvent('keydown', {
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
}

const SEND_BUTTON_SELECTORS = [
  { type: 'css', value: '#flow-end-msg-send' },
  { type: 'css', value: 'button[type="submit"]' },
  { type: 'aria', textKey: 'send' },
  { type: 'text', textKey: 'send' }
];

function isDoubaoInputArea(element) {
  if (!element) {
    return false;
  }

  const isVisible = element.offsetParent !== null;
  if (!isVisible) {
    return false;
  }

  const isTextarea = element.tagName === 'TEXTAREA';
  const isSlateEditor = element.getAttribute('data-slate-editor') === 'true';
  const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';
  const isTextbox = element.getAttribute('role') === 'textbox';
  const inChatInput = element.closest(
    '#input-engine-container, .flow-chat-editor, [class*="chat-input"], [class*="input-engine"]'
  ) !== null;

  return isTextarea || (isContentEditable && (isSlateEditor || isTextbox || inChatInput));
}

function findSendButton() {
  if (!window.ButtonFinderUtils?.findButton) {
    return null;
  }

  return window.ButtonFinderUtils.findButton(SEND_BUTTON_SELECTORS);
}

function insertTextareaNewline(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;

  textarea.value = value.substring(0, start) + '\n' + value.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + 1;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

function insertContentEditableNewline(element) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const textNode = document.createTextNode('\n');

  range.deleteContents();
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);

  element.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

function handleEnterSwap(event) {
  if (!event.isTrusted || event.code !== 'Enter' || event.isComposing) {
    return;
  }

  if (!enterKeyConfig || !enterKeyConfig.enabled) {
    return;
  }

  const activeElement = document.activeElement;
  if (!isDoubaoInputArea(activeElement)) {
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (activeElement.tagName === 'TEXTAREA') {
      insertTextareaNewline(activeElement);
      return;
    }

    if (!insertContentEditableNewline(activeElement)) {
      activeElement.dispatchEvent(createEnterEvent({ shift: true }));
    }
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const sendButton = findSendButton();
    if (sendButton && !sendButton.disabled && sendButton.getAttribute('aria-disabled') !== 'true') {
      sendButton.click();
      return;
    }

    activeElement.dispatchEvent(createEnterEvent());
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

applyEnterSwapSetting();
