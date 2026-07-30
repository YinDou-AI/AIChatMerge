import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attemptAutoSubmitWithRetry,
  captureSubmitBaseline,
  cancelPendingAutoSubmit,
  clickSendButton,
  verifySubmitConfirmed
} from '../content-scripts/src/providers/click-send.js';

function markVisible(element) {
  Object.defineProperty(element, 'offsetParent', {
    configurable: true,
    get: () => document.body,
  });
  element.getBoundingClientRect = () => ({
    top: 10,
    left: 10,
    right: 42,
    bottom: 42,
    width: 32,
    height: 32,
  });
}

describe('click-send auto submit retry cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.happyDOM.setURL('https://chatgpt.com/c/test');
    document.body.innerHTML = `
      <div id="prompt-textarea" contenteditable="true"></div>
      <button data-testid="send-button" aria-label="Send prompt">Send</button>
    `;
    markVisible(document.querySelector('[data-testid="send-button"]'));
  });

  afterEach(() => {
    cancelPendingAutoSubmit('test-cleanup');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not click a queued old auto-submit after cancellation', async () => {
    const sendButton = document.querySelector('[data-testid="send-button"]');
    const clickSpy = vi.spyOn(sendButton, 'click');

    attemptAutoSubmitWithRetry('chatgpt', null, 500);
    cancelPendingAutoSubmit('new-chat');

    await vi.advanceTimersByTimeAsync(600);

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('cancels an older queued auto-submit when a newer one starts', async () => {
    const sendButton = document.querySelector('[data-testid="send-button"]');
    const clickSpy = vi.spyOn(sendButton, 'click');

    attemptAutoSubmitWithRetry('chatgpt', null, 1000);
    attemptAutoSubmitWithRetry('chatgpt', null, 200);

    await vi.advanceTimersByTimeAsync(250);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not treat synthetic Enter as a successful Wenxin send', () => {
    window.happyDOM.setURL('https://chat.baidu.com/');
    document.body.innerHTML = `
      <div data-slate-editor="true" contenteditable="true">stuck prompt</div>
      <button aria-label="发送" disabled>Send</button>
    `;
    const editor = document.querySelector('[data-slate-editor="true"]');
    const keydownSpy = vi.fn();
    editor.addEventListener('keydown', keydownSpy);

    expect(clickSendButton('wenxin')).toBe(false);
    expect(keydownSpy).not.toHaveBeenCalled();
  });

  it('clicks Wenxin current active image send control', () => {
    window.happyDOM.setURL('https://chat.baidu.com/');
    document.body.innerHTML = `
      <div data-slate-editor="true" contenteditable="true">prompt</div>
      <span class="ci-submit-button">
        <img id="ci-submit-button-ai"
          class="ci-submit-button-ai-active"
          src="send-icon.svg"
          alt="">
      </span>
    `;
    const sendControl = document.querySelector('.ci-submit-button');
    const sendButton = document.querySelector('#ci-submit-button-ai');
    markVisible(sendControl);
    markVisible(sendButton);
    const controlClickSpy = vi.spyOn(sendControl, 'click');
    const imageClickSpy = vi.spyOn(sendButton, 'click');

    expect(clickSendButton('wenxin')).toBe(true);
    expect(controlClickSpy).toHaveBeenCalledTimes(1);
    expect(imageClickSpy).not.toHaveBeenCalled();
  });

  it('does not click Wenxin image send control before it becomes active', () => {
    window.happyDOM.setURL('https://chat.baidu.com/');
    document.body.innerHTML = `
      <div data-slate-editor="true" contenteditable="true">prompt</div>
      <img id="ci-submit-button-ai" src="send-icon.svg" alt="">
    `;
    const sendButton = document.querySelector('#ci-submit-button-ai');
    markVisible(sendButton);
    const clickSpy = vi.spyOn(sendButton, 'click');

    expect(clickSendButton('wenxin')).toBe(false);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('runs cleanup after one Wenxin send-control lookup fails', async () => {
    window.happyDOM.setURL('https://chat.baidu.com/');
    document.body.innerHTML = '<div data-slate-editor="true" contenteditable="true">stuck prompt</div>';
    const cleanup = vi.fn();
    const onAttempt = vi.fn();

    attemptAutoSubmitWithRetry('wenxin', null, 1, 'stuck prompt', cleanup, onAttempt);
    await vi.advanceTimersByTimeAsync(7000);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({
      attempt: 1,
      maxAttempts: 1,
      clicked: false,
      reason: 'send-control-not-found',
    }));
  });

  it('sends Wenxin textarea composer with Enter instead of clicking the always-active icon', () => {
    window.happyDOM.setURL('https://wenxin.baidu.com/');
    document.body.innerHTML = `
      <textarea id="chat-textarea" class="ci-textarea">prompt</textarea>
      <span class="ci-submit-button">
        <img id="ci-submit-button-ai" class="ci-submit-button-ai-active" src="send-icon.svg" alt="">
      </span>
    `;
    const textarea = document.querySelector('#chat-textarea');
    const sendControl = document.querySelector('.ci-submit-button');
    markVisible(textarea);
    markVisible(sendControl);
    const keydownSpy = vi.fn();
    textarea.addEventListener('keydown', keydownSpy);
    const controlClickSpy = vi.spyOn(sendControl, 'click');

    expect(clickSendButton('wenxin')).toBe(true);
    expect(keydownSpy).toHaveBeenCalledTimes(1);
    expect(keydownSpy.mock.calls[0][0].key).toBe('Enter');
    expect(controlClickSpy).not.toHaveBeenCalled();
  });

  it('clicks Metaso homepage send-arrow button when it is visible', () => {
    window.happyDOM.setURL('https://metaso.cn/');
    document.body.innerHTML = `
      <textarea class="search-consult-textarea" placeholder="输入，Enter 发送">probe</textarea>
      <button class="send-arrow-button">Send</button>
    `;
    const sendButton = document.querySelector('.send-arrow-button');
    markVisible(sendButton);
    const clickSpy = vi.spyOn(sendButton, 'click');
    const keydownSpy = vi.fn();
    document.querySelector('textarea').addEventListener('keydown', keydownSpy);

    expect(clickSendButton('metaso')).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(keydownSpy).not.toHaveBeenCalled();
  });

  it('sends Metaso chat-page follow-up composer with Enter (no send-arrow button there)', () => {
    window.happyDOM.setURL('https://metaso.cn/chat/123');
    document.body.innerHTML = `
      <textarea placeholder="继续提问">probe follow-up</textarea>
    `;
    const textarea = document.querySelector('textarea');
    markVisible(textarea);
    const keydownSpy = vi.fn();
    textarea.addEventListener('keydown', keydownSpy);

    expect(clickSendButton('metaso')).toBe(true);
    expect(keydownSpy).toHaveBeenCalledTimes(1);
    expect(keydownSpy.mock.calls[0][0].key).toBe('Enter');
  });

  it('clicks send once and succeeds when composer clears on click', async () => {
    const editor = document.querySelector('#prompt-textarea');
    markVisible(editor);
    editor.textContent = 'probe text';
    const sendButton = document.querySelector('[data-testid="send-button"]');
    sendButton.addEventListener('click', () => { editor.textContent = ''; });
    const clickSpy = vi.spyOn(sendButton, 'click');
    const onFailure = vi.fn();
    const onAttempt = vi.fn();

    attemptAutoSubmitWithRetry('chatgpt', null, 100, 'probe text', onFailure, onAttempt);
    await vi.advanceTimersByTimeAsync(3000);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ clicked: true }));
  });

  it('does not retry when the composer clears after the click', async () => {
    const editor = document.querySelector('#prompt-textarea');
    markVisible(editor);
    editor.textContent = 'probe text';
    const sendButton = document.querySelector('[data-testid="send-button"]');
    sendButton.addEventListener('click', () => { editor.textContent = ''; });
    const clickSpy = vi.spyOn(sendButton, 'click');
    const onFailure = vi.fn();
    const onAttempt = vi.fn();

    attemptAutoSubmitWithRetry('chatgpt', null, 100, 'probe text', onFailure, onAttempt);
    await vi.advanceTimersByTimeAsync(3000);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ clicked: true }));
  });

  it('clicks send in extract mode when composer clears on click', async () => {
    const { setExtractMode } = await import('../content-scripts/src/providers/dom-utils.js');
    setExtractMode(true);
    try {
      const editor = document.querySelector('#prompt-textarea');
      editor.textContent = 'probe text';
      const sendButton = document.querySelector('[data-testid="send-button"]');
      sendButton.addEventListener('click', () => { editor.textContent = ''; });
      const clickSpy = vi.spyOn(sendButton, 'click');
      const onFailure = vi.fn();
      const onAttempt = vi.fn();

      attemptAutoSubmitWithRetry('chatgpt', null, 100, 'probe text', onFailure, onAttempt);
      await vi.advanceTimersByTimeAsync(3000);

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(onFailure).not.toHaveBeenCalled();
      expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ clicked: true }));
    } finally {
      setExtractMode(false);
    }
  });

  it('does not confirm from a stale stop button that existed before the click', () => {
    const editor = document.querySelector('#prompt-textarea');
    editor.textContent = 'second round';
    markVisible(editor);
    const staleStop = document.createElement('button');
    staleStop.setAttribute('aria-label', 'Stop');
    document.body.appendChild(staleStop);
    markVisible(staleStop);

    const baseline = captureSubmitBaseline('chatgpt', 'second round');
    const result = verifySubmitConfirmed('chatgpt', baseline);

    expect(result.confirmed).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it('confirms when a new answer starts growing after the click', () => {
    const editor = document.querySelector('#prompt-textarea');
    editor.textContent = 'second round';
    markVisible(editor);
    const oldAnswer = document.createElement('div');
    oldAnswer.dataset.messageAuthorRole = 'assistant';
    oldAnswer.textContent = 'old answer';
    document.body.appendChild(oldAnswer);
    markVisible(oldAnswer);
    const baseline = captureSubmitBaseline('chatgpt', 'second round');

    const newAnswer = document.createElement('div');
    newAnswer.dataset.messageAuthorRole = 'assistant';
    newAnswer.textContent = 'new answer begins';
    document.body.appendChild(newAnswer);
    markVisible(newAnswer);

    const result = verifySubmitConfirmed('chatgpt', baseline);
    expect(result.confirmed).toBe(true);
    expect(result.signals).toContain('answer-changed');
  });

  it('does not retry a swallowed click and reports unconfirmed diagnostically', async () => {
    const editor = document.querySelector('#prompt-textarea');
    editor.textContent = 'probe text';
    markVisible(editor);
    const sendButton = document.querySelector('[data-testid="send-button"]');
    const clickSpy = vi.spyOn(sendButton, 'click');
    const onFailure = vi.fn();
    const onAttempt = vi.fn();
    const onConfirmed = vi.fn();
    const onDispatched = vi.fn();
    const onUnconfirmed = vi.fn();

    attemptAutoSubmitWithRetry(
      'chatgpt',
      null,
      100,
      'probe text',
      onFailure,
      onAttempt,
      onConfirmed,
      null,
      onDispatched,
      onUnconfirmed
    );
    await vi.advanceTimersByTimeAsync(15000);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(onDispatched).toHaveBeenCalledTimes(1);
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(onUnconfirmed).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({
      attempt: 1,
      reason: 'submit-not-confirmed',
    }));
  });

  it('clicks Yuanbao tag-agnostic send control when the id selector misses', async () => {
    // 2026-07-21 日志：yuanbao 讨论轮 #yuanbao-send-btn 未命中（found=false），
    // 旧兜底全是 button 标签，而元宝的发送控件是 <a class="style__send-btn__...">
    window.happyDOM.setURL('https://yuanbao.tencent.com/chat/abc');
    document.body.innerHTML = `
      <div id="searchbar-editor">
        <div class="ql-editor" contenteditable="true"><p>probe</p></div>
        <a class="style__send-btn___RwTm5">Send</a>
      </div>
    `;
    const sendLink = document.querySelector('.style__send-btn___RwTm5');
    markVisible(sendLink);
    const clickSpy = vi.spyOn(sendLink, 'click');
    const keydownSpy = vi.fn();
    document.querySelector('.ql-editor').addEventListener('keydown', keydownSpy);

    expect(clickSendButton('yuanbao')).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(keydownSpy).not.toHaveBeenCalled();
  });

  it('returns false without Enter when Yuanbao has no usable send control', () => {
    window.happyDOM.setURL('https://yuanbao.tencent.com/chat/abc');
    document.body.innerHTML = `
      <div id="searchbar-editor">
        <div class="ql-editor" contenteditable="true"><p>probe</p></div>
      </div>
    `;
    const keydownSpy = vi.fn();
    document.querySelector('.ql-editor').addEventListener('keydown', keydownSpy);

    expect(clickSendButton('yuanbao')).toBe(false);
    expect(keydownSpy).not.toHaveBeenCalled();
  });

  it('waits for an enabled Doubao button in extract mode instead of clicking early', async () => {
    // 过早点击未就绪的豆包按钮会触发页面「系统错误」提示。
    // 严格模式下 extract mode 不再豁免 enabled 检查，返回 false 等重试
    const { setExtractMode } = await import('../content-scripts/src/providers/dom-utils.js');
    setExtractMode(true);
    try {
      window.happyDOM.setURL('https://www.doubao.com/chat/');
      document.body.innerHTML = `
        <div id="input-engine-container">
          <div class="semi-input-textarea-wrapper"><textarea>probe</textarea></div>
          <button id="flow-end-msg-send" disabled>Send</button>
        </div>
      `;
      const sendButton = document.querySelector('#flow-end-msg-send');
      markVisible(sendButton);
      const clickSpy = vi.spyOn(sendButton, 'click');
      const keydownSpy = vi.fn();
      document.querySelector('textarea').addEventListener('keydown', keydownSpy);

      expect(clickSendButton('doubao')).toBe(false);
      expect(clickSpy).not.toHaveBeenCalled();
      expect(keydownSpy).not.toHaveBeenCalled();
    } finally {
      setExtractMode(false);
    }
  });
});
