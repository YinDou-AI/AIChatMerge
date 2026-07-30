// yuanbao-editor.js — Yuanbao Quill 编辑器注入
// 日志前缀：text-injection:yuanbao

export function normalizeYuanbaoEditorText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

// Yuanbao's current Quill composer does not reliably retain programmatic
// line breaks. Preserve every paragraph by turning line breaks into a
// readable inline separator before writing to the editor.
export function prepareYuanbaoInputText(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return lines.reduce((result, line) => {
    if (!result) return line;
    return /[。！？；;!?]$/.test(result) ? `${result} ${line}` : `${result}；${line}`;
  }, '');
}

export function injectTextIntoYuanbaoEditor(element, text) {
  try {
    const preparedText = prepareYuanbaoInputText(text);
    if (!preparedText) return false;
    element.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    const inserted = document.execCommand('insertText', false, preparedText);
    if (!inserted) {
      element.textContent = preparedText;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return normalizeYuanbaoEditorText(element.innerText) === normalizeYuanbaoEditorText(preparedText);
  } catch (error) {
    console.warn('[Text Injection] Yuanbao multiline injection failed:', error);
    return false;
  }
}

// If the send button is not ready (disabled or not found) on the first try,
// retry with increasing delays so the AI's framework has time to process the
// injected text and enable the send button.
export function hasExpectedYuanbaoText(expectedText) {
  const editor = document.querySelector('#searchbar-editor .ql-editor[contenteditable="true"], .ql-editor[contenteditable="true"]');
  if (!editor || typeof expectedText !== 'string') return false;

  return normalizeYuanbaoEditorText(editor.innerText) === normalizeYuanbaoEditorText(prepareYuanbaoInputText(expectedText));
}
