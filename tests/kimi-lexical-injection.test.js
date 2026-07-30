import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectTextIntoElement } from '../content-scripts/src/providers/text-injection.js';

// kimi's composer is a Lexical editor. On the real page we observed:
// 1. execCommand('selectAll') does not move the selection into the editor,
//    so delete no-ops and insertText prepends at the cursor.
// 2. On an empty composer Lexical commits a programmatic insert
//    asynchronously — textContent is still empty right after insertText.
function createLexicalLikeEditor(initialHtml = '<p><br></p>') {
  window.happyDOM.setURL('https://www.kimi.com/');
  const editor = document.createElement('div');
  editor.className = 'chat-input-editor';
  editor.setAttribute('contenteditable', 'true');
  editor.setAttribute('data-lexical-editor', 'true');
  editor.innerHTML = initialHtml;
  document.body.appendChild(editor);
  return editor;
}

describe('kimi Lexical composer injection', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete document.execCommand;
  });

  it('replaces the previous prompt instead of prepending to it', () => {
    const editor = createLexicalLikeEditor('<p dir="ltr"><span data-lexical-text="true">old prompt</span></p>');

    // Emulate the Lexical composer: selectAll/delete are no-ops; insertText
    // replaces the current selection.
    document.execCommand = vi.fn((command, _ui, value) => {
      if (command === 'insertText') {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(value));
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      return true;
    });

    expect(injectTextIntoElement(editor, 'new prompt')).toBe(true);
    expect(editor.textContent).toBe('new prompt');
  });
});

describe('deferred composer verification', () => {
  let parentSource;

  beforeEach(async () => {
    vi.useFakeTimers();
    window.happyDOM.setURL('https://www.kimi.com/');
    parentSource = { postMessage: vi.fn() };
    await import('../content-scripts/src/text-injection-entry.js');
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete document.execCommand;
  });

  function dispatchInject(text, injectionRequestId) {
    const event = new MessageEvent('message', {
      data: {
        type: 'INJECT_TEXT',
        text,
        context: 'multi-panel',
        autoSubmit: false,
        injectionRequestId,
      },
      origin: 'chrome-extension://test-extension',
    });
    Object.defineProperty(event, 'source', { value: parentSource });
    window.dispatchEvent(event);
  }

  function postedDiagnostics() {
    return parentSource.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message?.type === 'INJECTION_DIAGNOSTIC');
  }

  it('does not report composer-verification-failed when the editor commits asynchronously', () => {
    const editor = createLexicalLikeEditor();

    // insertText reports success but Lexical commits the DOM update ~100ms later.
    document.execCommand = vi.fn((command, _ui, value) => {
      if (command === 'insertText') {
        setTimeout(() => {
          editor.innerHTML = `<p dir="ltr"><span data-lexical-text="true">${value}</span></p>`;
        }, 100);
      }
      return true;
    });

    dispatchInject('async commit prompt', 'inj-async');
    expect(editor.textContent).toBe('');

    vi.advanceTimersByTime(500);

    expect(editor.textContent).toBe('async commit prompt');
    expect(postedDiagnostics()).toHaveLength(0);
  });

  it('still reports composer-verification-failed when the text never lands', () => {
    createLexicalLikeEditor();

    // insertText claims success but the editor never commits anything.
    document.execCommand = vi.fn(() => true);

    dispatchInject('lost prompt', 'inj-lost');
    vi.advanceTimersByTime(500);

    const diagnostics = postedDiagnostics();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toEqual(expect.objectContaining({
      event: 'composer-verification-failed',
      injectionRequestId: 'inj-lost',
      provider: 'kimi',
    }));
  });
});
