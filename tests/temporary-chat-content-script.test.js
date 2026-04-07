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

  it('silently skips unsupported providers', async () => {
    window.happyDOM.setURL('https://www.google.com/');

    dispatchMultiPanelMessage({ type: 'ENABLE_TEMP_CHAT', context: 'multi-panel' });
    await wait(50);

    expect(getTemporaryChatEnabledCalls(window.parent.postMessage)).toHaveLength(0);
  });
});
