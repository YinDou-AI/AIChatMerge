import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// text-injection-all-providers.js is a self-contained IIFE (no ES module
// exports) designed to run inside a Chrome extension iframe.  window.eval()
// is the only way to load its side-effect-based code into the happy-dom
// test environment.
const contentScriptSource = readFileSync(
  resolve(process.cwd(), 'content-scripts/text-injection-all-providers.js'),
  'utf8'
);

function markVisible(element) {
  Object.defineProperty(element, 'offsetParent', {
    configurable: true,
    get: () => document.body,
  });
}

function dispatchMultiPanelMessage(payload) {
  const event = new Event('message');
  Object.defineProperties(event, {
    data: { value: payload },
    source: { value: window.parent },
    origin: { value: 'chrome-extension://test-extension' },
  });
  window.dispatchEvent(event);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createDoubaoComposerDom() {
  document.body.innerHTML = `
    <div id="flow_chat_sidebar">
      <div>Header</div>
      <div class="cursor-pointer" id="doubao-new-chat">新对话</div>
    </div>
    <div id="input-engine-container">
      <div class="semi-input-textarea-wrapper">
        <textarea
          id="doubao-editor"
          class="semi-input-textarea semi-input-textarea-autosize"
          placeholder="发消息..."
        ></textarea>
      </div>
      <input id="doubao-file-input" type="file" accept=".png,.jpg,image/*" />
      <button id="flow-end-msg-send" aria-label="">Send</button>
    </div>
  `;

  const editor = document.getElementById('doubao-editor');
  const fileInput = document.getElementById('doubao-file-input');
  const sendButton = document.getElementById('flow-end-msg-send');
  const newChatButton = document.getElementById('doubao-new-chat');

  [editor, fileInput, sendButton, newChatButton].forEach(markVisible);

  return {
    editor,
    fileInput,
    sendButton,
    newChatButton,
  };
}

describe('doubao content script integration', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: vi.fn() }
    });
    window.eval(contentScriptSource);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    window.happyDOM.setURL('https://www.doubao.com/chat/');
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false),
    });
    createDoubaoComposerDom();
  });

  it('injects text into the Doubao textarea composer', () => {
    const { editor } = createDoubaoComposerDom();

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'hello doubao',
      autoSubmit: false,
      context: 'multi-panel',
    });

    expect(editor.value).toContain('hello doubao');
  });

  it('uses the send button for Doubao when triggering send', () => {
    const { sendButton } = createDoubaoComposerDom();
    const clickSpy = vi.fn();
    sendButton.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({
      type: 'TRIGGER_SEND',
      context: 'multi-panel',
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('clears the Doubao textarea composer through form control updates', async () => {
    const { editor } = createDoubaoComposerDom();
    editor.value = 'hello doubao';
    const inputSpy = vi.fn();
    const changeSpy = vi.fn();
    editor.addEventListener('input', inputSpy);
    editor.addEventListener('change', changeSpy);

    dispatchMultiPanelMessage({
      type: 'CLEAR_INPUT',
      context: 'multi-panel',
    });

    await wait(10);

    expect(editor.value).toBe('');
    expect(inputSpy).toHaveBeenCalled();
    expect(changeSpy).toHaveBeenCalled();
  });

  // Image upload was removed from the unified panel in v4.
  it.skip('uploads images through the Doubao file input and keeps text injection working', async () => {
    const { editor, fileInput } = createDoubaoComposerDom();
    const changeSpy = vi.fn();
    fileInput.addEventListener('change', () => {
      const preview = document.createElement('img');
      preview.src = 'blob:https://www.doubao.com/test-preview';
      document.getElementById('input-engine-container').appendChild(preview);
    });
    fileInput.addEventListener('change', changeSpy);

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT_WITH_IMAGES',
      text: 'text only',
      images: [{
        name: 'sample.png',
        type: 'image/png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z2ioAAAAASUVORK5CYII='
      }],
      autoSubmit: false,
      context: 'multi-panel',
    });

    await wait(2800);

    expect(editor.value).toContain('text only');
    expect(changeSpy).toHaveBeenCalled();
    expect(fileInput.files).toHaveLength(1);
    expect(fileInput.files[0].name).toBe('sample.png');
  });

  // Image upload was removed from the unified panel in v4.
  it.skip('does not auto-submit Doubao images when upload preview never appears', async () => {
    const { fileInput, sendButton } = createDoubaoComposerDom();
    const clickSpy = vi.fn();
    const changeSpy = vi.fn();
    fileInput.addEventListener('change', changeSpy);
    sendButton.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT_WITH_IMAGES',
      text: 'text with missing preview',
      images: [{
        name: 'sample.png',
        type: 'image/png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z2ioAAAAASUVORK5CYII='
      }],
      autoSubmit: true,
      context: 'multi-panel',
    });

    await wait(3500);

    expect(changeSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).not.toHaveBeenCalled();
  }, 6000);

  // Requires Doubao's live rendered sidebar; happy-dom cannot model its visibility tree.
  it.skip('uses the visible new chat control for Doubao', () => {
    const { newChatButton } = createDoubaoComposerDom();
    const clickSpy = vi.fn();
    newChatButton.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({
      type: 'NEW_CHAT',
      context: 'multi-panel',
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
