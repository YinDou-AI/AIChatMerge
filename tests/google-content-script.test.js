import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, beforeAll, beforeEach, expect, it, vi } from 'vitest';

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
  window.dispatchEvent(new MessageEvent('message', { data: payload }));
}

function createGoogleSearchDom(initialValue = '') {
  document.body.innerHTML = `
    <form role="search" action="/search">
      <input name="q" class="gLFyf" />
      <button type="submit" aria-label="Google Search">Search</button>
    </form>
    <textarea class="ITIRGe" aria-label="Ask anything"></textarea>
    <button data-xid="input-plate-send-button">Send</button>
  `;

  const searchInput = document.querySelector('input[name="q"]');
  const searchButton = document.querySelector('button[aria-label="Google Search"]');
  const aiInput = document.querySelector('textarea.ITIRGe');
  const aiSendButton = document.querySelector('button[data-xid="input-plate-send-button"]');

  searchInput.value = initialValue;
  aiInput.value = '';

  [searchInput, searchButton, aiInput, aiSendButton].forEach(markVisible);

  return {
    searchInput,
    searchButton,
    aiInput,
    aiSendButton,
    form: document.querySelector('form'),
  };
}

function createGoogleAiImageUploadDom() {
  document.body.innerHTML = `
    <div class="google-ai-shell">
      <textarea class="ITIRGe" aria-label="Ask anything"></textarea>
      <button type="button" aria-label="更多输入项">+</button>
      <button type="button" data-xid="input-plate-send-button">Send</button>
    </div>
  `;

  const aiInput = document.querySelector('textarea.ITIRGe');
  const addButton = document.querySelector('button[aria-label="更多输入项"]');
  const sendButton = document.querySelector('button[data-xid="input-plate-send-button"]');

  [aiInput, addButton, sendButton].forEach(markVisible);

  return { aiInput, addButton, sendButton };
}

describe('google content script integration', () => {
  beforeAll(() => {
    if (typeof DataTransfer === 'undefined') {
      globalThis.DataTransfer = class DataTransfer {
        constructor() {
          this.files = [];
          this.items = {
            add: (file) => {
              this.files.push(file);
            }
          };
        }
      };
    }

    window.eval(contentScriptSource);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    window.happyDOM.setURL('https://www.google.com/');
    const { searchInput } = createGoogleSearchDom('');
    expect(searchInput).toBeTruthy();
    dispatchMultiPanelMessage({
      type: 'CLEAR_INPUT',
      providerMode: 'search',
      context: 'multi-panel',
    });
  });

  it('targets the AI composer in AI mode even when the search box exists', () => {
    const { searchInput, aiInput } = createGoogleSearchDom('existing search');

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'hello ai',
      autoSubmit: false,
      providerMode: 'ai',
      context: 'multi-panel',
    });

    expect(aiInput.value).toBe('hello ai');
    expect(searchInput.value).toBe('existing search');
  });

  it('replaces the old Google search query on the first fill and appends on later fills', () => {
    const { searchInput } = createGoogleSearchDom('old query');

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'first fill',
      autoSubmit: false,
      providerMode: 'search',
      context: 'multi-panel',
    });
    expect(searchInput.value).toBe('first fill');

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'second fill',
      autoSubmit: false,
      providerMode: 'search',
      context: 'multi-panel',
    });
    expect(searchInput.value).toBe('first fillsecond fill');
  });

  it('resets the search fill session after sending', () => {
    const { searchInput } = createGoogleSearchDom('old query');
    const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'first fill',
      autoSubmit: false,
      providerMode: 'search',
      context: 'multi-panel',
    });

    dispatchMultiPanelMessage({
      type: 'TRIGGER_SEND',
      providerMode: 'search',
      context: 'multi-panel',
    });

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy.mock.calls[0][0]).toContain('/search?q=first+fill');
    expect(searchInput.value).toBe('first fill');

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'next search',
      autoSubmit: false,
      providerMode: 'search',
      context: 'multi-panel',
    });

    expect(searchInput.value).toBe('next search');
  });

  it('clears the Google search input and resets the session on CLEAR_INPUT', () => {
    const { searchInput } = createGoogleSearchDom('old query');

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'first fill',
      autoSubmit: false,
      providerMode: 'search',
      context: 'multi-panel',
    });
    expect(searchInput.value).toBe('first fill');

    dispatchMultiPanelMessage({
      type: 'CLEAR_INPUT',
      providerMode: 'search',
      context: 'multi-panel',
    });
    expect(searchInput.value).toBe('');

    searchInput.value = 'leftover query';
    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'fresh fill',
      autoSubmit: false,
      providerMode: 'search',
      context: 'multi-panel',
    });

    expect(searchInput.value).toBe('fresh fill');
  });

  it('opens the Google AI image picker before assigning uploaded files', async () => {
    window.happyDOM.setURL('https://www.google.com/search?udm=50');
    const { addButton } = createGoogleAiImageUploadDom();
    let changeEventCount = 0;

    addButton.addEventListener('click', () => {
      if (document.querySelector('input[type="file"]')) {
        return;
      }

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.hidden = true;
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', () => {
        changeEventCount += 1;
      });
      document.body.appendChild(fileInput);
    });

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT_WITH_IMAGES',
      text: '',
      images: [{
        name: 'sample.png',
        type: 'image/png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z2ioAAAAASUVORK5CYII='
      }],
      autoSubmit: false,
      providerMode: 'ai',
      context: 'multi-panel',
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    expect(changeEventCount).toBe(1);
    expect(fileInput.files).toHaveLength(1);
    expect(fileInput.files[0].name).toBe('sample.png');
  });
});
