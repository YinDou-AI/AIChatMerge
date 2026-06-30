import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// text-injection-all-providers.js is a self-contained IIFE designed to run
// inside an iframe injected by the Chrome extension.  It intentionally has
// no ES module exports so it can operate without a bundler in the extension
// context.  We use window.eval() to load the script into the happy-dom test
// environment, which is the only way to exercise its side effects (message
// listener registration, DOM manipulation) in a test.
const contentScriptSource = readFileSync(
  resolve(process.cwd(), 'content-scripts/text-injection-all-providers.js'),
  'utf8'
);

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

function createChatgptComposerDom({ includeSendButton = true, includeStopButton = false } = {}) {
  document.body.innerHTML = `
    <form data-type="unified-composer">
      <div id="prompt-textarea" contenteditable="true" role="textbox" aria-label="Chat with ChatGPT"></div>
      ${includeSendButton ? '<button type="button" data-testid="send-button" aria-label="Send prompt">Send</button>' : ''}
      ${includeStopButton ? '<button type="button" data-testid="stop-button" aria-label="Stop streaming">Stop</button>' : ''}
    </form>
  `;

  return {
    composer: document.querySelector('form[data-type="unified-composer"]'),
    prompt: document.getElementById('prompt-textarea'),
    getSendButton: () => document.querySelector('button[data-testid="send-button"]'),
    getStopButton: () => document.querySelector('button[data-testid="stop-button"]'),
  };
}

function getProviderStatusCalls(postMessageSpy, type) {
  return postMessageSpy.mock.calls
    .map(call => call[0])
    .filter(payload => payload?.type === type && payload?.context === 'multi-panel-provider-status');
}

describe('chatgpt content script provider status', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: vi.fn() }
    });
    window.eval(contentScriptSource);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    window.happyDOM.setURL('https://chatgpt.com/c/test');
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });
    createChatgptComposerDom();
  });

  it('does not report busy before the stop button appears', async () => {
    const postMessageSpy = window.parent.postMessage;

    dispatchMultiPanelMessage({
      type: 'TRIGGER_SEND',
      requestId: 'req-pending',
      context: 'multi-panel',
    });

    await wait(150);

    expect(getProviderStatusCalls(postMessageSpy, 'ACM_PROVIDER_BUSY')).toHaveLength(0);
  });

  it('reports busy when the ChatGPT stop button appears', async () => {
    const postMessageSpy = window.parent.postMessage;
    const { composer } = createChatgptComposerDom({ includeSendButton: true, includeStopButton: false });

    dispatchMultiPanelMessage({
      type: 'TRIGGER_SEND',
      requestId: 'req-busy',
      context: 'multi-panel',
    });

    await wait(100);
    composer.insertAdjacentHTML('beforeend', '<button type="button" data-testid="stop-button" aria-label="Stop streaming">Stop</button>');
    await wait(50);

    const busyCalls = getProviderStatusCalls(postMessageSpy, 'ACM_PROVIDER_BUSY');
    expect(busyCalls).toHaveLength(1);
    expect(busyCalls[0]).toMatchObject({
      requestId: 'req-busy',
      provider: 'chatgpt',
      phase: 'busy',
    });
  });

  it('reports idle after the stop button disappears for 800ms', async () => {
    const postMessageSpy = window.parent.postMessage;
    const { getStopButton } = createChatgptComposerDom({ includeSendButton: true, includeStopButton: false });

    dispatchMultiPanelMessage({
      type: 'TRIGGER_SEND',
      requestId: 'req-idle',
      context: 'multi-panel',
    });

    await wait(100);
    document.querySelector('form[data-type="unified-composer"]').insertAdjacentHTML(
      'beforeend',
      '<button type="button" data-testid="stop-button" aria-label="Stop streaming">Stop</button>'
    );
    await wait(50);
    getStopButton()?.remove();
    await wait(1000);

    const idleCalls = getProviderStatusCalls(postMessageSpy, 'ACM_PROVIDER_IDLE');
    expect(idleCalls).toHaveLength(1);
    expect(idleCalls[0]).toMatchObject({
      requestId: 'req-idle',
      provider: 'chatgpt',
      phase: 'idle',
    });
  });

  it('does not report idle when the stop button briefly reappears', async () => {
    const postMessageSpy = window.parent.postMessage;
    const { composer, getStopButton } = createChatgptComposerDom({ includeSendButton: true, includeStopButton: false });

    dispatchMultiPanelMessage({
      type: 'TRIGGER_SEND',
      requestId: 'req-flicker',
      context: 'multi-panel',
    });

    await wait(100);
    composer.insertAdjacentHTML('beforeend', '<button type="button" data-testid="stop-button" aria-label="Stop streaming">Stop</button>');
    await wait(50);
    getStopButton()?.remove();
    await wait(300);
    composer.insertAdjacentHTML('beforeend', '<button type="button" data-testid="stop-button" aria-label="Stop streaming">Stop</button>');
    await wait(650);

    expect(getProviderStatusCalls(postMessageSpy, 'ACM_PROVIDER_IDLE')).toHaveLength(0);

    getStopButton()?.remove();
    await wait(1000);

    expect(getProviderStatusCalls(postMessageSpy, 'ACM_PROVIDER_IDLE')).toHaveLength(1);
  });

  it('stops tracking when busy is never observed within 2 seconds', async () => {
    const postMessageSpy = window.parent.postMessage;
    const { composer } = createChatgptComposerDom({ includeSendButton: true, includeStopButton: false });

    dispatchMultiPanelMessage({
      type: 'TRIGGER_SEND',
      requestId: 'req-fallback',
      context: 'multi-panel',
    });

    await wait(2200);
    composer.insertAdjacentHTML('beforeend', '<button type="button" data-testid="stop-button" aria-label="Stop streaming">Stop</button>');
    await wait(100);

    expect(getProviderStatusCalls(postMessageSpy, 'ACM_PROVIDER_BUSY')).toHaveLength(0);
    expect(getProviderStatusCalls(postMessageSpy, 'ACM_PROVIDER_IDLE')).toHaveLength(0);
  });

  it('reports user interaction for non-chatgpt providers during send tracking', async () => {
    window.happyDOM.setURL('https://gemini.google.com/app');
    document.body.innerHTML = '<div class="ql-editor" contenteditable="true"></div>';

    const postMessageSpy = window.parent.postMessage;
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    dispatchMultiPanelMessage({
      type: 'TRIGGER_SEND',
      requestId: 'req-gemini-user-interaction',
      context: 'multi-panel',
    });

    const pointerdownHandler = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'pointerdown'
    )?.[1];

    expect(pointerdownHandler).toBeTypeOf('function');

    pointerdownHandler({ isTrusted: true });

    const interactionCalls = getProviderStatusCalls(postMessageSpy, 'ACM_PROVIDER_USER_INTERACTION');
    expect(interactionCalls).toHaveLength(1);
    expect(interactionCalls[0]).toMatchObject({
      requestId: 'req-gemini-user-interaction',
      provider: 'gemini',
      phase: 'user-interaction',
    });
  });
});
