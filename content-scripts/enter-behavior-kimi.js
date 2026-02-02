// Kimi Enter/Shift+Enter behavior swap
// Supports customizable key combinations via settings

// Helper: Create a synthetic Enter KeyboardEvent with specified modifiers
function createEnterEvent(modifiers = {}) {
  return new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
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

/**
 * Selector array for finding Kimi's Submit/Send button
 * Priority order: icon detection → structural selectors
 */
const SEND_BUTTON_SELECTORS = [
  // Priority 1: Send button container by class
  '.send-button-container:not(.disabled)',
  
  // Priority 2: Send icon by name
  {
    type: 'function',
    matcher: () => {
      const sendIcon = document.querySelector('svg[name="Send"]');
      if (sendIcon) {
        // Find the clickable parent button/container
        let parent = sendIcon.closest('button');
        if (parent && !parent.disabled) return parent;
        
        // Try to find the container div
        parent = sendIcon.closest('.send-button-container');
        if (parent && !parent.classList.contains('disabled')) return parent;
      }
      return null;
    }
  },

  // Priority 3: Send icon by class
  {
    type: 'function',
    matcher: () => {
      const sendIcon = document.querySelector('.send-icon');
      if (sendIcon) {
        let parent = sendIcon.closest('button');
        if (parent && !parent.disabled) return parent;
        
        parent = sendIcon.closest('.send-button-container');
        if (parent && !parent.classList.contains('disabled')) return parent;
      }
      return null;
    }
  }
];

// Helper: Find Kimi's Submit/Send button
function findSendButton(activeElement, isEditing) {
  // For editing messages: search locally from the active element's container
  if (isEditing && activeElement) {
    let container = activeElement.parentElement;
    
    // Traverse up to find a suitable container (usually within 10 levels)
    for (let i = 0; i < 10 && container; i++) {
      // Look for Send button within this container
      const sendButton = container.querySelector('.send-button-container:not(.disabled)') ||
                        container.querySelector('svg[name="Send"]')?.closest('button') ||
                        container.querySelector('.send-icon')?.closest('button');
      
      if (sendButton) return sendButton;
      container = container.parentElement;
    }
  }

  // For new messages: search globally for Send button using selector array
  return window.ButtonFinderUtils.findButton(SEND_BUTTON_SELECTORS);
}

// Helper: Check if element is Kimi's input area
function isKimiInputArea(element) {
  if (!element) return false;
  
  // Check for contenteditable editor
  const isContentEditable = element.isContentEditable || 
                           element.getAttribute('contenteditable') === 'true';
  
  if (isContentEditable) {
    // Check if it has the chat-input-editor class or is within chat input area
    const hasEditorClass = element.classList.contains('chat-input-editor');
    const inChatInput = element.closest('.chat-input-editor') !== null;
    
    return hasEditorClass || inChatInput;
  }
  
  // Also check for textarea fallback (in case Kimi changes implementation)
  if (element.tagName === 'TEXTAREA') {
    const inChatArea = element.closest('[class*="chat"]') !== null ||
                      element.closest('[class*="input"]') !== null;
    return inChatArea;
  }
  
  return false;
}

// Helper: Insert newline into contenteditable element at cursor position
function insertContentEditableNewline(element) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  
  // Create a text node with newline
  const textNode = document.createTextNode('\n');
  
  // Insert the newline at cursor position
  range.deleteContents();
  range.insertNode(textNode);
  
  // Move cursor after the newline
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Trigger input event so Kimi detects the change
  element.dispatchEvent(new Event('input', { bubbles: true }));
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
  
  // Check if this is Kimi's input area
  const isKimiInput = isKimiInputArea(activeElement);
  
  if (!isKimiInput) {
    return;
  }

  // Check if this matches newline action
  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    // For contenteditable: insert newline
    insertContentEditableNewline(activeElement);
    return;
  }
  // Check if this matches send action
  else if (matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    // Find and click the Send button
    const sendButton = findSendButton(activeElement, false);

    if (sendButton && !sendButton.disabled && !sendButton.classList.contains('disabled')) {
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
    // This prevents Kimi's native keyboard shortcuts from interfering with user settings.
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

// Apply the setting on initial load
applyEnterSwapSetting();
