import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const contentScriptSource = readFileSync(
  resolve(process.cwd(), 'content-scripts/text-injection-all-providers.js'),
  'utf8'
);

function dispatchMultiPanelMessage(payload) {
  window.dispatchEvent(new MessageEvent('message', { data: payload }));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function markVisible(element) {
  Object.defineProperty(element, 'offsetParent', {
    configurable: true,
    get: () => document.body,
  });

  element.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 32,
    height: 32,
    top: 0,
    left: 0,
    right: 32,
    bottom: 32,
    toJSON() {
      return this;
    }
  });
}

function markVisibleAt(element, rect) {
  markVisible(element);
  element.getBoundingClientRect = () => ({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON() {
      return this;
    }
  });
}

function getTemporaryChatEnabledCalls(postMessageSpy) {
  return postMessageSpy.mock.calls
    .map(call => call[0])
    .filter(payload => payload?.type === 'PANELIZE_TEMP_CHAT_ENABLED' && payload?.context === 'multi-panel-provider-status');
}

describe('temporary chat content script', () => {
  beforeAll(() => {
    window.eval(contentScriptSource);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });
    document.body.innerHTML = '';
  });

  it('enables temporary chat for ChatGPT', async () => {
    window.happyDOM.setURL('https://chatgpt.com/');
    document.body.innerHTML = '<button aria-label="Turn on temporary chat">Temp</button>';
    const button = document.querySelector('button');
    markVisible(button);

    const clickSpy = vi.fn();
    button.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toEqual([
      expect.objectContaining({ provider: 'chatgpt' })
    ]);
  });

  it('polls briefly for the Gemini temporary chat button', async () => {
    window.happyDOM.setURL('https://gemini.google.com/app');

    setTimeout(() => {
      const button = document.createElement('button');
      button.setAttribute('data-test-id', 'temp-chat-button');
      markVisible(button);
      button.addEventListener('click', () => {
        button.dataset.clicked = 'true';
      });
      document.body.appendChild(button);
    }, 250);

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(500);

    expect(document.querySelector('button')?.dataset.clicked).toBe('true');
    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toEqual([
      expect.objectContaining({ provider: 'gemini' })
    ]);
  });

  it('does not click Gemini temporary chat when it is already active', async () => {
    window.happyDOM.setURL('https://gemini.google.com/app');
    document.body.innerHTML = `
      <button data-test-id="temp-chat-button" class="mdc-icon-button temp-chat-button temp-chat-on">Temporary chat</button>
      <div>Temporary chats don't appear in Recent Chats</div>
      <input aria-label="Ask questions in a temporary chat">
    `;
    const button = document.querySelector('button');
    markVisible(button);

    const clickSpy = vi.fn();
    button.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toEqual([
      expect.objectContaining({ provider: 'gemini' })
    ]);
  });

  it('treats Gemini temporary chat as active when the control exposes aria-pressed', async () => {
    window.happyDOM.setURL('https://gemini.google.com/app');
    document.body.innerHTML = `
      <button data-test-id="temp-chat-button" aria-pressed="true">Temporary chat</button>
    `;
    const button = document.querySelector('button');
    markVisible(button);

    const clickSpy = vi.fn();
    button.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toEqual([
      expect.objectContaining({ provider: 'gemini' })
    ]);
  });

  it('still clicks Gemini temporary chat when page text mentions temporary chat but the control is inactive', async () => {
    window.happyDOM.setURL('https://gemini.google.com/app');
    document.body.innerHTML = `
      <button data-test-id="temp-chat-button" class="mdc-icon-button temp-chat-button">Temporary chat</button>
      <div>Temporary chats don't appear in Recent Chats</div>
      <input aria-label="Ask questions in a temporary chat">
    `;
    const button = document.querySelector('button');
    markVisible(button);

    const clickSpy = vi.fn();
    button.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toEqual([
      expect.objectContaining({ provider: 'gemini' })
    ]);
  });

  it('enables incognito for Claude', async () => {
    window.happyDOM.setURL('https://claude.ai/new');
    document.body.innerHTML = '<button aria-label="Use incognito">Incognito</button>';
    const button = document.querySelector('button');
    markVisible(button);

    const clickSpy = vi.fn();
    button.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toEqual([
      expect.objectContaining({ provider: 'claude' })
    ]);
  });

  it('enables private chat for Grok', async () => {
    window.happyDOM.setURL('https://grok.com/');
    document.body.innerHTML = '<a href="/c#private" aria-label="Switch to Private Chat">Private</a>';
    const link = document.querySelector('a');
    markVisible(link);

    const clickSpy = vi.fn((event) => event.preventDefault());
    link.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toEqual([
      expect.objectContaining({ provider: 'grok' })
    ]);
  });

  it('does not click Grok private chat when it is already active', async () => {
    window.happyDOM.setURL('https://grok.com/c#private');
    document.body.innerHTML = '<a href="/c#private" aria-label="Switch to Private Chat">Private</a>';
    const link = document.querySelector('a');
    markVisible(link);

    const clickSpy = vi.fn((event) => event.preventDefault());
    link.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toEqual([
      expect.objectContaining({ provider: 'grok' })
    ]);
  });

  it('prefers the in-viewport Grok new chat control over offscreen links', async () => {
    window.happyDOM.setURL('https://grok.com/c#private');
    document.body.innerHTML = `
      <a id="hidden-home" href="/" aria-label="Home page">Home</a>
      <a id="visible-compose" href="/">Compose</a>
    `;

    const hiddenHome = document.getElementById('hidden-home');
    const visibleCompose = document.getElementById('visible-compose');
    markVisibleAt(hiddenHome, { x: -246, y: 10, width: 36, height: 36 });
    markVisibleAt(visibleCompose, { x: 378, y: 12, width: 40, height: 40 });

    const hiddenSpy = vi.fn((event) => event.preventDefault());
    const visibleSpy = vi.fn((event) => event.preventDefault());
    hiddenHome.addEventListener('click', hiddenSpy);
    visibleCompose.addEventListener('click', visibleSpy);

    dispatchMultiPanelMessage({ type: 'NEW_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(hiddenSpy).not.toHaveBeenCalled();
    expect(visibleSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to Kimi Chinese new chat text without invalid CSS selectors', async () => {
    window.happyDOM.setURL('https://www.kimi.com/');
    document.body.innerHTML = '<button id="kimi-new-chat">新建会话</button>';
    const button = document.getElementById('kimi-new-chat');
    markVisible(button);

    const clickSpy = vi.fn();
    button.addEventListener('click', clickSpy);

    dispatchMultiPanelMessage({ type: 'NEW_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('silently skips unsupported providers', async () => {
    window.happyDOM.setURL('https://www.google.com/');

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toHaveLength(0);
  });
});
