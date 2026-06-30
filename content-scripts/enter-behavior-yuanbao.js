// 元宝 Enter/Shift+Enter behavior swap
// Supports customizable key combinations via settings
// 依赖: enter-behavior-utils.js 中的公共 createEnterEvent 函数

/**
 * Selector array for finding Yuanbao's Submit/Send button
 * Priority order: specific ID → class-based → aria-label
 */
const YUANBAO_SEND_BUTTON_SELECTORS = [
  // Priority 1: Specific send button ID in the searchbar editor
  '#searchbar-editor #yuanbao-send-btn',
  '#yuanbao-send-btn',
  // Priority 2: Class-based selectors
  'button[class*="send"]:not([disabled])',
  // Priority 3: aria-label selectors (multi-language)
  'button[aria-label="Send"]',
  'button[aria-label="发送"]',
  'button[aria-label="发送消息"]'
];

// Helper: Find Yuanbao's Submit/Send button
function findSendButton(activeElement, isEditing) {
  // For editing messages: search locally from the active element's container
  if (isEditing && activeElement) {
    let container = activeElement.parentElement;

    // Traverse up to find a suitable container (usually within 10 levels)
    for (let i = 0; i < 10 && container; i++) {
      const sendButton = container.querySelector('#yuanbao-send-btn') ||
                         container.querySelector('button[aria-label="Send"]') ||
                         container.querySelector('button[aria-label="发送"]');

      if (sendButton) return sendButton;
      container = container.parentElement;
    }
  }

  // For new messages: search globally using ButtonFinderUtils
  if (window.ButtonFinderUtils?.findButton) {
    return window.ButtonFinderUtils.findButton([
      { type: 'css', value: '#searchbar-editor #yuanbao-send-btn' },
      { type: 'css', value: '#yuanbao-send-btn' },
      { type: 'aria', textKey: 'send' },
      { type: 'text', textKey: 'send' }
    ]);
  }

  // Fallback: manual selector search
  for (const selector of YUANBAO_SEND_BUTTON_SELECTORS) {
    try {
      const element = document.querySelector(selector);
      if (element && !element.disabled) return element;
    } catch (_) {}
  }

  return null;
}

// Helper: Check if element is Yuanbao's input area
function isYuanbaoInputArea(element) {
  if (!element) return false;

  // Quill contenteditable editor (primary input)
  const isQuillEditor = element.isContentEditable ||
    element.getAttribute('contenteditable') === 'true';

  if (isQuillEditor) {
    // Check for Quill editor class or within the searchbar editor container
    const hasQuillClass = element.classList.contains('ql-editor');
    const inSearchbarEditor = element.closest('#searchbar-editor') !== null;
    const inChatInput = element.closest('[class*="chat"]') !== null;

    return hasQuillClass || inSearchbarEditor || inChatInput;
  }

  // Also check for textarea fallback
  if (element.tagName === 'TEXTAREA') {
    const inChatArea = element.closest('#searchbar-editor') !== null ||
                      element.closest('[class*="chat"]') !== null;
    return inChatArea;
  }

  return false;
}

// Helper: Insert newline into Quill contentEditable div
function insertQuillNewline(div) {
  try {
    // Try using execCommand first (works well with Quill)
    if (document.execCommand) {
      document.execCommand('insertLineBreak');
    } else {
      // Fallback: manual DOM manipulation
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);

      const br = document.createElement('br');
      range.deleteContents();
      range.insertNode(br);

      // Insert second br if at end (Quill needs this)
      const isAtEnd = !br.nextSibling ||
        (br.nextSibling && br.nextSibling.nodeName === 'BR');
      if (isAtEnd) {
        const br2 = document.createElement('br');
        br.parentNode.insertBefore(br2, br.nextSibling);
      }

      // Move cursor
      range.setStartAfter(br);
      range.setEndAfter(br);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Trigger input event for Quill framework
    div.dispatchEvent(new Event('input', { bubbles: true }));
    div.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (e) {
    // Silent fail - if newline insertion fails, just do nothing
  }
}

function handleEnterSwap(event) {
  // Only handle trusted Enter key events
  // Skip if IME composition is in progress (e.g., Chinese/Japanese input method)
  if (!event.isTrusted || event.code !== "Enter" || event.isComposing) {
    return;
  }

  if (!enterKeyConfig || !enterKeyConfig.enabled) {
    return;
  }

  // Get the currently focused element
  const activeElement = document.activeElement;

  // Check if this is Yuanbao's input area
  const isYuanbaoInput = isYuanbaoInputArea(activeElement);

  if (!isYuanbaoInput) {
    return;
  }

  // Check if this matches newline action
  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    // For contenteditable (Quill): insert newline
    insertQuillNewline(activeElement);
    return;
  }
  // Check if this matches send action
  else if (matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    // Find and click the Send button
    const sendButton = findSendButton(activeElement, false);

    if (sendButton && !sendButton.disabled) {
      sendButton.click();
    } else {
      // Fallback: dispatch plain Enter
      const newEvent = createEnterEvent();
      activeElement.dispatchEvent(newEvent);
    }
    return;
  }
  else {
    // Block any other Enter combinations (Ctrl+Enter, Alt+Enter, Meta+Enter, etc.)
    // This prevents Yuanbao's native keyboard shortcuts from interfering with user settings.
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

// Apply the setting on initial load
applyEnterSwapSetting();
