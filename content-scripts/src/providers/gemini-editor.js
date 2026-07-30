// gemini-editor.js — Gemini 编辑器注入
// 日志前缀：text-injection:gemini

function normalizeInjectedText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function hasExpectedMultilineText(editorText, expectedText) {
  const actual = normalizeInjectedText(editorText);
  const expected = normalizeInjectedText(expectedText);
  if (!expected) return false;
  if (actual === expected || actual.includes(expected)) return true;

  const expectedLines = expected.split('\n').filter(Boolean);
  let cursor = 0;
  return expectedLines.every(line => {
    const index = actual.indexOf(line, cursor);
    if (index < 0) return false;
    cursor = index + line.length;
    return true;
  });
}

export function getGeminiEditorText() {
  const editor = document.querySelector('.ql-editor');
  return editor ? (editor.innerText || editor.textContent || '') : '';
}

export function hasExpectedGeminiText(expectedText) {
  if (typeof expectedText !== 'string') return false;
  return hasExpectedMultilineText(getGeminiEditorText(), expectedText);
}

export function injectTextIntoGeminiEditor(element, text) {
  if (!element || typeof text !== 'string') return false;

  try {
    element.focus();

    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    } catch (error) {
      element.innerHTML = '';
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    });
    element.dispatchEvent(pasteEvent);

    if (!hasExpectedMultilineText(element.innerText || element.textContent || '', text)) {
      element.innerHTML = '';
      String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(line => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line || '\u00a0';
        element.appendChild(paragraph);
      });
    }

    element.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    return true;
  } catch (error) {
    console.warn('[Text Injection] Gemini multiline injection failed:', error);
    return false;
  }
}
