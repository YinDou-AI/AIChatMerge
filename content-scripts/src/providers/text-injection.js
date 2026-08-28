// text-injection.js — 文本注入核心逻辑
// 日志前缀：text-injection:inject

import { detectProvider } from './detection.js';
import { injectTextIntoYuanbaoEditor } from './yuanbao-editor.js';
import { injectTextIntoMetasoTextarea } from './metaso-sidebar.js';
import { injectTextIntoGeminiEditor } from './gemini-editor.js';

export function isSlateEditor(element) {
  return element && (
    element.getAttribute('data-slate-editor') === 'true' ||
    element.getAttribute('data-slate-editor') === ''
  );
}

// Inject text into Slate editor via paste event (like 群问AI)
export function injectTextIntoSlateEditor(element, text) {
  if (!element || !text) return false;
  element.focus();

  // Select all and delete first
  try {
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
  } catch (e) {
    // Fallback
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('delete', false, null);
    } catch (e2) {}
  }

  // Create clipboard data with text
  const dataTransfer = new DataTransfer();
  dataTransfer.setData('text/plain', text);

  // Dispatch paste event
  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dataTransfer
  });
  // A Slate paste handler normally prevents the browser default and writes
  // the editor state itself. Wenxin and Qianwen can enter an invalid state
  // when we then unconditionally insert the same text again.
  const pasteHandled = !element.dispatchEvent(pasteEvent);

  if ((detectProvider() === 'qianwen' || detectProvider() === 'wenxin') && pasteHandled) {
    return true;
  }

  // The synthetic paste was not handled, so use insertText as a fallback.
  try {
    document.execCommand('insertText', false, text);
  } catch (e) {}

  return true;
}

export function setFormControlValue(element, value) {
  const prototype = element.tagName === 'INPUT'
    ? window.HTMLInputElement.prototype
    : window.HTMLTextAreaElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: value,
  }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  if (typeof element.value === 'string') {
    element.selectionStart = element.selectionEnd = element.value.length;
  }
}

export function dispatchEditorKeyEvent(element, key, code, modifiers = {}) {
  element.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    code,
    keyCode: key === 'Backspace' ? 8 : key === 'a' ? 65 : 13,
    which: key === 'Backspace' ? 8 : key === 'a' ? 65 : 13,
    ctrlKey: modifiers.ctrl || false,
    metaKey: modifiers.meta || false,
    shiftKey: modifiers.shift || false,
    altKey: modifiers.alt || false,
    bubbles: true,
    cancelable: true
  }));
}

export function clearRichTextInput(provider, element) {
  element.focus();

  if (provider !== 'kimi' && provider !== 'doubao') {
    element.innerHTML = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  dispatchEditorKeyEvent(element, 'a', 'KeyA', { ctrl: true, meta: true });
  document.execCommand('selectAll', false, null);

  setTimeout(() => {
    dispatchEditorKeyEvent(element, 'Backspace', 'Backspace');
    document.execCommand('delete', false, null);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    const hasResidualContent = element.textContent.trim().length > 0 ||
      element.querySelector('img, figure, [data-slate-node], [data-slate-string], [data-slate-zero-width]');

    if (provider === 'doubao' && hasResidualContent) {
      element.innerHTML = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, 10);
}

// Inject text into an element (textarea or contenteditable)
export function injectTextIntoElement(element, text) {
  if (!element || !text || typeof text !== 'string' || text.trim() === '') {
    return false;
  }

  try {
    const isTextarea = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';
    const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

    if (!isTextarea && !isContentEditable) {
      console.warn('Element is not a textarea or contenteditable:', element);
      return false;
    }

    if (detectProvider() === 'yuanbao' && element.matches('.ql-editor[contenteditable="true"], #searchbar-editor [contenteditable="true"]')) {
      return injectTextIntoYuanbaoEditor(element, text);
    }

    if (detectProvider() === 'metaso' && element.matches('textarea.search-consult-textarea')) {
      return injectTextIntoMetasoTextarea(element, text);
    }

    if (detectProvider() === 'gemini' && element.matches('.ql-editor')) {
      return injectTextIntoGeminiEditor(element, text);
    }

    // Slate editors need paste method
    if (isSlateEditor(element)) {
      return injectTextIntoSlateEditor(element, text);
    }

    if (isTextarea) {
      // For textarea/input elements
      const currentValue = element.value || '';
      // Wenxin may leave a failed prompt in its fallback textarea. Appending
      // makes every later broadcast invalid as well, so each send replaces it.
      const newValue = detectProvider() === 'wenxin' ? text : currentValue + text;

      setFormControlValue(element, newValue);
    } else {
      // For contenteditable elements - clear first, then insert (replacement semantics)
      element.focus();

      // Select existing content via the Selection API. execCommand('selectAll')
      // does not reliably move the selection into rich editors (e.g. kimi's
      // Lexical composer): delete then no-ops and insertText prepends at the
      // cursor instead of replacing the old prompt.
      let selectionReady = false;
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        selectionReady = true;
      } catch (e) {
        // Ignore selection errors
      }

      if (!selectionReady) {
        // Fallback: select all + delete via execCommand
        try {
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
        } catch (e) {
          // Last resort: clear innerHTML
          element.innerHTML = '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      // Now insert the new text. With a full selection this replaces it.
      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, text);
      } catch (e) {
        // execCommand not available in some contexts
      }

      if (!inserted) {
        // Fallback: set text content
        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Ensure cursor is at the end after insertion
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {
        // Ignore selection errors in cross-origin context
      }
    }

    return true;
  } catch (error) {
    console.error('Error injecting text:', error);
    return false;
  }
}
