import { SEND_ERROR_CODES } from './send-error-codes.js';
import { createSubmitFailure, createSubmitSuccess } from './send-result.js';
import { compareSubmitSnapshots } from './submit-snapshot.js';

function waitForDelay(delay, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }

    const timerId = setTimeout(() => {
      signal?.removeEventListener?.('abort', handleAbort);
      resolve(true);
    }, Math.max(0, delay || 0));

    function handleAbort() {
      clearTimeout(timerId);
      signal?.removeEventListener?.('abort', handleAbort);
      resolve(false);
    }

    signal?.addEventListener?.('abort', handleAbort, { once: true });
  });
}

function cancelledResult(provider, requestId, attempt, attempts) {
  return createSubmitFailure({
    provider,
    requestId,
    code: SEND_ERROR_CODES.SUBMIT_CANCELLED,
    attempt,
    evidence: { attempts }
  });
}

/**
 * Find and click a provider send control exactly once.
 *
 * Adapter contract:
 * - provider: string
 * - findSendControl(): Element | null
 * - isSendControlReady(control): boolean
 * - triggerSubmit(control): boolean
 * - captureSubmitSnapshot({ expectedText }): serializable snapshot
 * - submitPolicy: { dispatchDelayMs(initialDelay): number, confirmationDelayMs: number }
 *
 * Confirmation is deliberately not part of dispatch. A missed DOM signal must
 * never cause a second click for the same request.
 */
export async function attemptSubmit({
  adapter,
  requestId = null,
  expectedText = '',
  initialDelay = 0,
  signal = null,
  submitPolicy = adapter?.submitPolicy
}) {
  if (!adapter?.provider || !submitPolicy?.dispatchDelayMs) {
    throw new TypeError('attemptSubmit requires a provider adapter and submit policy');
  }

  const provider = adapter.provider;
  const delay = submitPolicy.dispatchDelayMs(initialDelay);
  const attempts = [];
  if (!await waitForDelay(delay, signal)) {
    return cancelledResult(provider, requestId, 0, attempts);
  }

  try {
    const control = adapter.findSendControl();
    if (!control || !adapter.isSendControlReady(control)) {
      attempts.push({
        attempt: 1,
        delay,
        clicked: false,
        code: SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND
      });
      return createSubmitFailure({
        provider,
        requestId,
        code: SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND,
        attempt: 1,
        evidence: { attempts }
      });
    }

    const before = adapter.captureSubmitSnapshot({ expectedText });
    const clicked = adapter.triggerSubmit(control) === true;
    if (!clicked) {
      attempts.push({
        attempt: 1,
        delay,
        clicked: false,
        code: SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND
      });
      return createSubmitFailure({
        provider,
        requestId,
        code: SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND,
        attempt: 1,
        evidence: { attempts }
      });
    }

    attempts.push({ attempt: 1, delay, clicked: true, code: null });
    return createSubmitSuccess({
      provider,
      requestId,
      attempt: 1,
      evidence: { dispatched: true, before, attempts }
    });
  } catch {
    attempts.push({
      attempt: 1,
      delay,
      clicked: false,
      code: SEND_ERROR_CODES.SUBMIT_ADAPTER_ERROR
    });
    return createSubmitFailure({
      provider,
      requestId,
      code: SEND_ERROR_CODES.SUBMIT_ADAPTER_ERROR,
      attempt: 1,
      evidence: { attempts }
    });
  }
}

export async function observeSubmitConfirmation({
  adapter,
  expectedText = '',
  before,
  signal = null,
  delay = adapter?.submitPolicy?.confirmationDelayMs || 0
}) {
  if (!await waitForDelay(delay, signal)) {
    return { confirmed: false, cancelled: true, signals: [], evidence: {} };
  }
  const after = adapter.captureSubmitSnapshot({ expectedText });
  return compareSubmitSnapshots(before, after);
}
