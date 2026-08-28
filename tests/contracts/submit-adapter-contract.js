import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attemptSubmit, observeSubmitConfirmation } from '../../content-scripts/src/submission/attempt-submit.js';
import { SEND_ERROR_CODES } from '../../content-scripts/src/submission/send-error-codes.js';

const TEST_SUBMIT_POLICY = Object.freeze({
  confirmationDelayMs: 20,
  dispatchDelayMs() {
    return 10;
  }
});

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

function markFixtureVisible() {
  document.body.querySelectorAll('*').forEach(markVisible);
}

async function finishSubmission(promise, duration = 500) {
  await vi.advanceTimersByTimeAsync(duration);
  return promise;
}

export function runSubmitAdapterContract({
  provider,
  adapter,
  loadFixture
}) {
  describe(`${provider} submit adapter contract`, () => {
    beforeEach(() => {
      vi.useFakeTimers();
      window.happyDOM.setURL('https://www.doubao.com/chat/');
      delete window.ButtonFinderUtils;
    });

    afterEach(() => {
      vi.useRealTimers();
      document.body.innerHTML = '';
      delete window.ButtonFinderUtils;
    });

    function arrange(fixtureName) {
      document.body.innerHTML = loadFixture(fixtureName);
      markFixtureVisible();
      return {
        composer: document.querySelector('textarea, [contenteditable="true"]'),
        sendButton: document.querySelector('#flow-end-msg-send')
      };
    }

    it('dispatches the first prompt and observes confirmation separately', async () => {
      const { composer, sendButton } = arrange('first-send.html');
      sendButton.addEventListener('click', () => { composer.value = ''; });

      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-first',
        expectedText: 'first prompt',
        initialDelay: 10,
        submitPolicy: TEST_SUBMIT_POLICY
      });
      const result = await finishSubmission(promise, 15);

      expect(result).toEqual(expect.objectContaining({
        ok: true,
        provider,
        stage: 'submit',
        code: null,
        requestId: 'doubao-first',
        attempt: 1
      }));
      expect(result.evidence.dispatched).toBe(true);

      const confirmationPromise = observeSubmitConfirmation({
        adapter,
        expectedText: 'first prompt',
        before: result.evidence.before,
        delay: TEST_SUBMIT_POLICY.confirmationDelayMs
      });
      const confirmation = await finishSubmission(confirmationPromise);
      expect(confirmation.signals).toContain('composer-cleared');
    });

    it('submits a second prompt when a new stop control appears', async () => {
      const { sendButton } = arrange('second-send.html');
      sendButton.addEventListener('click', () => {
        const stop = document.createElement('button');
        stop.setAttribute('aria-label', '停止生成');
        markVisible(stop);
        document.body.appendChild(stop);
      });

      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-second',
        expectedText: 'second prompt',
        submitPolicy: TEST_SUBMIT_POLICY
      });
      const result = await finishSubmission(promise, 15);

      expect(result.ok).toBe(true);
      const confirmationPromise = observeSubmitConfirmation({
        adapter,
        expectedText: 'second prompt',
        before: result.evidence.before,
        delay: TEST_SUBMIT_POLICY.confirmationDelayMs
      });
      const confirmation = await finishSubmission(confirmationPromise);
      expect(confirmation.signals).toContain('stop-button-appeared');
    });

    it('does not accept a stale stop control from the previous round', async () => {
      const { sendButton } = arrange('stale-stop-button.html');
      const clickSpy = vi.spyOn(sendButton, 'click');

      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-stale-stop',
        expectedText: 'second prompt',
        submitPolicy: TEST_SUBMIT_POLICY
      });
      const result = await finishSubmission(promise, 15);

      expect(result.ok).toBe(true);
      const confirmationPromise = observeSubmitConfirmation({
        adapter,
        expectedText: 'second prompt',
        before: result.evidence.before,
        delay: TEST_SUBMIT_POLICY.confirmationDelayMs
      });
      const confirmation = await finishSubmission(confirmationPromise);
      expect(confirmation.confirmed).toBe(false);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('never retries a swallowed click when confirmation is absent', async () => {
      const { sendButton } = arrange('swallowed-click.html');
      const clickSpy = vi.spyOn(sendButton, 'click');

      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-swallowed',
        expectedText: 'swallowed prompt',
        submitPolicy: TEST_SUBMIT_POLICY
      });
      const result = await finishSubmission(promise, 15);

      expect(result.ok).toBe(true);
      const confirmationPromise = observeSubmitConfirmation({
        adapter,
        expectedText: 'swallowed prompt',
        before: result.evidence.before,
        delay: TEST_SUBMIT_POLICY.confirmationDelayMs
      });
      const confirmation = await finishSubmission(confirmationPromise);
      expect(confirmation.confirmed).toBe(false);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('confirms when the current answer node grows', async () => {
      const { sendButton } = arrange('answer-growth.html');
      const answer = document.querySelector('.md-box-root');
      sendButton.addEventListener('click', () => {
        answer.textContent = 'partial answer continues';
      });

      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-answer-growth',
        expectedText: 'follow-up prompt',
        submitPolicy: TEST_SUBMIT_POLICY
      });
      const result = await finishSubmission(promise, 15);

      expect(result.ok).toBe(true);
      const confirmationPromise = observeSubmitConfirmation({
        adapter,
        expectedText: 'follow-up prompt',
        before: result.evidence.before,
        delay: TEST_SUBMIT_POLICY.confirmationDelayMs
      });
      const confirmation = await finishSubmission(confirmationPromise);
      expect(confirmation.signals).toContain('answer-changed');
    });

    it('reports disabled controls without clicking or falling back to Enter', async () => {
      const { sendButton } = arrange('first-send.html');
      sendButton.disabled = true;
      const clickSpy = vi.spyOn(sendButton, 'click');

      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-disabled',
        expectedText: 'first prompt',
        submitPolicy: TEST_SUBMIT_POLICY
      });
      const result = await finishSubmission(promise);

      expect(clickSpy).not.toHaveBeenCalled();
      expect(result.code).toBe(SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND);
    });

    it('does not wait or retry when the located control cannot be clicked', async () => {
      const { composer, sendButton } = arrange('first-send.html');
      sendButton.disabled = true;
      sendButton.addEventListener('click', () => { composer.value = ''; });
      setTimeout(() => { sendButton.disabled = false; }, 15);

      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-delayed-ready',
        expectedText: 'first prompt',
        submitPolicy: TEST_SUBMIT_POLICY
      });
      const result = await finishSubmission(promise, 15);

      expect(result.ok).toBe(false);
      expect(result.attempt).toBe(1);
      expect(result.evidence.attempts[0].code)
        .toBe(SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND);
    });

    it('reports SEND_CONTROL_NOT_FOUND when the fixture has no send control', async () => {
      const { sendButton } = arrange('first-send.html');
      sendButton.remove();

      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-control-missing',
        expectedText: 'first prompt',
        submitPolicy: TEST_SUBMIT_POLICY
      });
      const result = await finishSubmission(promise);

      expect(result.code).toBe(SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND);
    });

    it('resolves cancellation and leaves no submission timer pending', async () => {
      arrange('swallowed-click.html');
      const controller = new AbortController();
      const promise = attemptSubmit({
        adapter,
        requestId: 'doubao-cancelled',
        expectedText: 'swallowed prompt',
        signal: controller.signal,
        submitPolicy: TEST_SUBMIT_POLICY
      });

      await vi.advanceTimersByTimeAsync(5);
      controller.abort('new-chat');
      const result = await promise;

      expect(result).toEqual(expect.objectContaining({
        ok: false,
        stage: 'submit',
        code: SEND_ERROR_CODES.SUBMIT_CANCELLED,
        requestId: 'doubao-cancelled'
      }));
      expect(vi.getTimerCount()).toBe(0);
    });
  });
}
