import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attemptAutoSubmitOnce,
  cancelPendingAutoSubmit
} from '../content-scripts/src/providers/click-send.js';
import { SEND_ERROR_CODES } from '../content-scripts/src/submission/send-error-codes.js';

function markVisible(element) {
  Object.defineProperty(element, 'offsetParent', {
    configurable: true,
    get: () => document.body
  });
  element.getBoundingClientRect = () => ({
    top: 10,
    left: 10,
    right: 42,
    bottom: 42,
    width: 32,
    height: 32
  });
}

describe('Doubao submit adapter dispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.happyDOM.setURL('https://www.doubao.com/chat/');
    document.body.innerHTML = `
      <main id="input-engine-container">
        <div class="semi-input-textarea-wrapper">
          <textarea>dispatch prompt</textarea>
        </div>
        <button id="flow-end-msg-send">发送</button>
      </main>
    `;
    document.body.querySelectorAll('*').forEach(markVisible);
  });

  afterEach(() => {
    cancelPendingAutoSubmit('test-cleanup');
    vi.useRealTimers();
  });

  it('returns the Promise SendResult with the injection request id', async () => {
    const composer = document.querySelector('textarea');
    document.querySelector('button').addEventListener('click', () => {
      composer.value = '';
    });
    const onConfirmed = vi.fn();

    const promise = attemptAutoSubmitOnce(
      'doubao',
      null,
      10,
      'dispatch prompt',
      vi.fn(),
      vi.fn(),
      onConfirmed,
      'inject-doubao-1'
    );
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      provider: 'doubao',
      stage: 'submit',
      code: null,
      requestId: 'inject-doubao-1'
    }));
    expect(onConfirmed).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ requestId: 'inject-doubao-1' })
    }));
  });

  it('resolves SUBMIT_CANCELLED when the shared cancellation entry runs', async () => {
    const onFailure = vi.fn();
    const promise = attemptAutoSubmitOnce(
      'doubao',
      null,
      500,
      'dispatch prompt',
      onFailure,
      vi.fn(),
      vi.fn(),
      'inject-doubao-cancel'
    );

    cancelPendingAutoSubmit('new-chat');
    const result = await promise;

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      stage: 'submit',
      code: SEND_ERROR_CODES.SUBMIT_CANCELLED,
      requestId: 'inject-doubao-cancel'
    }));
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({
      code: SEND_ERROR_CODES.SUBMIT_CANCELLED,
      requestId: 'inject-doubao-cancel'
    }));
  });
});
