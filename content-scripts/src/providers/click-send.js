// click-send.js — 发送按钮点击与自动提交
// 日志前缀：text-injection:send

import { PROVIDER_SELECTORS, SEND_BUTTON_SELECTORS } from './detection.js';
import { isVisibleElement, isElementEnabled, findFirstVisibleElement, getExtractMode, pressEnter } from './dom-utils.js';
import { hasExpectedYuanbaoText } from './yuanbao-editor.js';
import { clickGoogleSendButton } from './google-helpers.js';
import { DIRECT_ANSWER_SELECTORS } from './answer-selectors.js';
import { STOP_BUTTON_SELECTORS } from './completion-constants.js';
import { attemptSubmit, observeSubmitConfirmation } from '../submission/attempt-submit.js';
import { SEND_ERROR_CODES } from '../submission/send-error-codes.js';
import { compareSubmitSnapshots } from '../submission/submit-snapshot.js';
import { getSubmitAdapter } from './submit-adapter-registry.js';

const pendingAutoSubmitTimers = new Set();
const pendingAutoSubmitCancelHandlers = new Map();
const pendingAdapterSubmitControllers = new Set();
let autoSubmitGeneration = 0;
const STRICT_SEND_BUTTON_PROVIDERS = new Set(['qianwen', 'wenxin', 'metaso']);

export function cancelPendingAutoSubmit(reason = 'cancelled') {
  autoSubmitGeneration += 1;
  pendingAutoSubmitTimers.forEach(timerId => {
    clearTimeout(timerId);
    pendingAutoSubmitCancelHandlers.get(timerId)?.(reason);
  });
  pendingAutoSubmitTimers.clear();
  pendingAutoSubmitCancelHandlers.clear();
  pendingAdapterSubmitControllers.forEach(controller => controller.abort(reason));
  pendingAdapterSubmitControllers.clear();
  console.log('[Text Injection] Pending auto-submit cancelled:', reason);
}

export function findQianwenScopedSendButton() {
  const input = findFirstVisibleElement(PROVIDER_SELECTORS.qianwen);
  if (!input) return null;

  const selectors = SEND_BUTTON_SELECTORS.qianwen || [];
  let container = input.parentElement;
  for (let depth = 0;
    container && container !== document.body && container !== document.documentElement && depth < 10;
    depth++, container = container.parentElement) {
    for (const selector of selectors) {
      try {
        const candidates = container.querySelectorAll(selector);
        for (const candidate of candidates) {
          if (isVisibleElement(candidate) && isElementEnabled(candidate)) {
            return candidate;
          }
        }
      } catch (_) {}
    }
  }

  return null;
}

function readElementText(element) {
  if (!element) return '';
  return typeof element.value === 'string' ? element.value : (element.textContent || '');
}

function normalizeSubmitProbe(value) {
  return String(value || '').replace(/\s+/g, '');
}

function collectVisibleMatches(selectors, { excludeComposer = false } = {}) {
  const matches = new Set();
  for (const selector of selectors || []) {
    try {
      document.querySelectorAll(selector).forEach(element => {
        if (!isVisibleElement(element)) return;
        if (excludeComposer &&
            element.closest('textarea, input, [contenteditable="true"], form, nav, aside, footer, [role="navigation"]')) {
          return;
        }
        matches.add(element);
      });
    } catch (_) {}
  }
  return [...matches];
}

function captureAnswerState(provider) {
  const elements = collectVisibleMatches(DIRECT_ANSWER_SELECTORS[provider], { excludeComposer: true });
  const latest = elements[elements.length - 1] || null;
  const latestText = readElementText(latest).trim();
  return {
    count: elements.length,
    latestElement: latest,
    latestText,
  };
}

const legacyAnswerNodeIds = new WeakMap();
let nextLegacyAnswerNodeId = 1;

function getLegacyAnswerKey(element) {
  if (!element) return null;
  if (!legacyAnswerNodeIds.has(element)) {
    legacyAnswerNodeIds.set(element, `legacy-answer-${nextLegacyAnswerNodeId++}`);
  }
  return legacyAnswerNodeIds.get(element);
}

function captureLegacySubmitSnapshot(provider, expectedText, preferredComposer = null) {
  const composer = preferredComposer?.isConnected
    ? preferredComposer
    : findFirstVisibleElement(PROVIDER_SELECTORS[provider] || []);
  const composerText = readElementText(composer);
  const expectedProbe = normalizeSubmitProbe(expectedText).slice(0, 80);
  const answer = captureAnswerState(provider);
  return {
    composer,
    expectedProbe,
    composerHasExpectedText: !!expectedProbe &&
      normalizeSubmitProbe(composerText).includes(expectedProbe),
    composerTextLength: composerText.length,
    visibleStopCount: collectVisibleMatches(STOP_BUTTON_SELECTORS[provider]).length,
    answerCount: answer.count,
    latestAnswerKey: getLegacyAnswerKey(answer.latestElement),
    latestAnswerLength: answer.latestText.length
  };
}

/**
 * Capture the page state immediately before a click. Confirmation must be a
 * transition from this baseline; pre-existing stop buttons and old answers do
 * not prove that the current prompt was submitted.
 */
export function captureSubmitBaseline(provider, expectedText) {
  return captureLegacySubmitSnapshot(provider, expectedText);
}

export function verifySubmitConfirmed(provider, baseline) {
  const current = captureLegacySubmitSnapshot(
    provider,
    baseline?.expectedProbe || '',
    baseline?.composer
  );
  const comparison = compareSubmitSnapshots(baseline, current);
  return {
    confirmed: comparison.confirmed,
    signals: comparison.signals,
    snapshot: comparison.evidence
  };
}

export function clickSendButton(provider, providerMode = null) {
  if (provider === 'google') {
    return clickGoogleSendButton(providerMode);
  }

  const submitAdapter = getSubmitAdapter(provider);
  if (submitAdapter) {
    const control = submitAdapter.findSendControl();
    return !!control &&
      submitAdapter.isSendControlReady(control) &&
      submitAdapter.triggerSubmit(control);
  }

  if (provider === 'qianwen') {
    const scopedSendButton = findQianwenScopedSendButton();
    if (scopedSendButton) {
      scopedSendButton.focus?.();
      scopedSendButton.click();
      return true;
    }
    // Never fall through to a page-wide Qianwen send selector: a different
    // visible composer can produce Qianwen's immediate "unknown error".
    console.log('[Text Injection] No send control found near the Qianwen editor');
    return false;
  }

  if (provider === 'wenxin') {
    // Wenxin's current composer is a plain textarea (#chat-textarea) that
    // sends on Enter. Its ci-submit-button icon keeps the "active" class even
    // when no text is committed, so clicking it can report success without
    // sending anything. Press Enter on the textarea instead. A Slate
    // contenteditable (old chat.baidu.com UI) treats Enter as a newline, so
    // that case still falls through to the send-control click below.
    const input = findFirstVisibleElement(PROVIDER_SELECTORS.wenxin);
    if (input && (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT')) {
      return pressEnter(input);
    }
    const activeIcon = document.querySelector('#ci-submit-button-ai.ci-submit-button-ai-active');
    const sendControl = activeIcon?.closest('.ci-submit-button') || activeIcon;
    if (sendControl && isVisibleElement(sendControl) && isElementEnabled(sendControl)) {
      sendControl.focus?.();
      sendControl.click();
      return true;
    }
  }

  if (provider === 'yuanbao') {
    // 走完整选择器列表（含标签无关的兜底），但绝不回退合成 Enter：
    // Quill 可能只提交了第一段，回车会触发意外的图片请求
    const selectors = SEND_BUTTON_SELECTORS.yuanbao || [];
    for (const selector of selectors) {
      try {
        const candidates = document.querySelectorAll(selector);
        for (const candidate of candidates) {
          if (isVisibleElement(candidate) && isElementEnabled(candidate)) {
            candidate.focus?.();
            candidate.click();
            return true;
          }
        }
      } catch (_) {}
    }
    console.log('[Text Injection] Yuanbao send control not found');
    return false;
  }

  if (provider === 'metaso') {
    // Metaso's homepage has a real .send-arrow-button, but after the first
    // query the page navigates to /chat/<id> where that button does not
    // exist. The follow-up composer there is a plain textarea that sends on
    // Enter (its placeholder says so as well).
    const sendButton = document.querySelector('button.send-arrow-button');
    if (sendButton && isVisibleElement(sendButton) && isElementEnabled(sendButton)) {
      sendButton.focus?.();
      sendButton.click();
      return true;
    }
    const input = findFirstVisibleElement(PROVIDER_SELECTORS.metaso);
    if (input && (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT')) {
      return pressEnter(input);
    }
    console.log('[Text Injection] Metaso send control not found');
    return false;
  }

  // Try send button selectors
  const selectors = SEND_BUTTON_SELECTORS[provider];
  let foundDisabledButton = false;
  if (selectors) {
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          let targetElement = element;
          if (element.tagName === 'svg' || element.tagName === 'SVG') {
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
              if (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button' || parent.classList.contains('send-button-container')) {
                targetElement = parent;
                break;
              }
              parent = parent.parentElement;
            }
          }
          // Metaso keeps buttons from previous composer states in the DOM.
          // Clicking a hidden one reports success here but performs no send,
          // which prevents the retry loop from reaching the live button.
          // Qianwen and Metaso can retain hidden/obsolete send controls in
          // the DOM. Clicking one may report success but target the wrong
          // composer state, so only the currently visible control is valid.
          if (STRICT_SEND_BUTTON_PROVIDERS.has(provider) && !isVisibleElement(targetElement)) {
            continue;
          }
          // STRICT provider 即使在 extract mode 也必须等按钮真正可用：
          // 点到未就绪的按钮，豆包会弹「系统错误」、千问会进错误态
          const canClick = STRICT_SEND_BUTTON_PROVIDERS.has(provider)
            ? isElementEnabled(targetElement)
            : (getExtractMode() || isElementEnabled(targetElement));
          if (canClick) {
            targetElement.focus?.();
            targetElement.click();
            return true;
          } else {
            foundDisabledButton = true;
          }
        }
      } catch (error) {
        console.warn('[Text Injection] Error with send button selector:', selector, error);
      }
    }
  }

  // Button found but disabled — try Enter key (framework state not updated)
  if (foundDisabledButton) {
    // Qianwen's controlled editor can enter an error state after a synthetic
    // Enter. Metaso can ignore the simulated key while its real button is
    // still enabling, so both must wait for a real enabled button.
    if (STRICT_SEND_BUTTON_PROVIDERS.has(provider)) {
      console.log('[Text Injection] Send control not found for', provider);
      return false;
    }
    console.log('[Text Injection] Send button disabled for', provider, '- trying Enter key');
    if (pressEnterOnProviderInput(provider)) {
      return true;
    }
  }

  // Fallback: press Enter on provider input
  if (STRICT_SEND_BUTTON_PROVIDERS.has(provider)) {
    console.log('[Text Injection] Send control not found for', provider);
    return false;
  }
  console.log('[Text Injection] Send button not found, trying Enter key for', provider);
  if (pressEnterOnProviderInput(provider)) {
    return true;
  }

  console.warn('[Text Injection] Send button not found or disabled for:', provider);
  return false;
}

// Re-export pressEnter for backward compatibility
export { pressEnter } from './dom-utils.js';

export function pressEnterOnProviderInput(provider) {
  const selectors = PROVIDER_SELECTORS[provider];
  if (!selectors) return false;
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (input) {
      return pressEnter(input);
    }
  }
  return false;
}

export function attemptAutoSubmitOnce(
  provider,
  providerMode,
  initialDelay,
  expectedText = null,
  onFailure = null,
  onAttempt = null,
  onConfirmed = null,
  requestId = null,
  onDispatched = null,
  onUnconfirmed = null
) {
  cancelPendingAutoSubmit('new-auto-submit');
  const adapter = getSubmitAdapter(provider);
  if (adapter) {
    const controller = new AbortController();
    pendingAdapterSubmitControllers.add(controller);
    const promise = attemptSubmit({
      adapter,
      requestId,
      expectedText,
      initialDelay,
      signal: controller.signal
    }).then(result => {
      const maxAttempts = 1;
      for (const attemptResult of result.evidence?.attempts || []) {
        if (typeof onAttempt !== 'function') continue;
        const reason = attemptResult.code === SEND_ERROR_CODES.SUBMIT_NOT_CONFIRMED
          ? 'submit-not-confirmed'
          : attemptResult.code === SEND_ERROR_CODES.SUBMIT_ADAPTER_ERROR
            ? 'adapter-error'
            : attemptResult.code
              ? 'send-control-not-found'
              : null;
        onAttempt({
          attempt: attemptResult.attempt,
          maxAttempts,
          delay: attemptResult.delay,
          clicked: attemptResult.clicked,
          reason,
          code: attemptResult.code
        });
      }

      if (result.ok) {
        if (typeof onDispatched === 'function') onDispatched(result);
        // Observe once in the background. This result is diagnostic only and
        // must never schedule another click.
        observeSubmitConfirmation({
          adapter,
          expectedText,
          before: result.evidence.before,
          signal: controller.signal
        }).then(confirmation => {
          pendingAdapterSubmitControllers.delete(controller);
          if (confirmation.cancelled) {
            if (typeof onUnconfirmed === 'function') onUnconfirmed(confirmation);
            return;
          }
          if (confirmation.confirmed) {
            if (typeof onConfirmed === 'function') {
              onConfirmed({
                confirmed: true,
                signals: confirmation.signals || [],
                snapshot: confirmation.evidence || {},
                result
              });
            }
          } else if (typeof onUnconfirmed === 'function') {
            onUnconfirmed(confirmation);
          }
        }).catch(() => pendingAdapterSubmitControllers.delete(controller));
      } else if (typeof onFailure === 'function') {
        pendingAdapterSubmitControllers.delete(controller);
        onFailure(result);
      } else {
        pendingAdapterSubmitControllers.delete(controller);
      }
      return result;
    });
    return promise;
  }

  const generation = autoSubmitGeneration;
  const RETRY_DELAYS = [initialDelay];
  let attempt = 0;

  function trySubmit() {
    const delay = RETRY_DELAYS[attempt];
    attempt++;

    const timerId = setTimeout(() => {
      pendingAutoSubmitTimers.delete(timerId);
      pendingAutoSubmitCancelHandlers.delete(timerId);
      if (generation !== autoSubmitGeneration) {
        console.log('[Text Injection] Skipping stale auto-submit for', provider);
        return;
      }
      console.log('[Text Injection] Auto-submit attempt', attempt, 'for', provider, 'delay:', delay);
      if (provider === 'yuanbao' && !hasExpectedYuanbaoText(expectedText)) {
        if (typeof onAttempt === 'function') {
          onAttempt({ attempt, maxAttempts: RETRY_DELAYS.length, delay, clicked: false, reason: 'editor-not-committed' });
        }
        console.warn('[Text Injection] Yuanbao editor has not committed the complete text');
        if (typeof onFailure === 'function') {
          onFailure({
            ok: false,
            provider,
            stage: 'submit',
            code: SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND,
            requestId,
            attempt,
            evidence: { reason: 'editor-not-committed' }
          });
        }
        return;
      }
      const baseline = captureSubmitBaseline(provider, expectedText);
      const clicked = clickSendButton(provider, providerMode);
      if (typeof onAttempt === 'function') {
        onAttempt({ attempt, maxAttempts: RETRY_DELAYS.length, delay, clicked, reason: clicked ? null : 'send-control-not-found' });
      }
      if (clicked) {
        console.log('[Text Injection] Send button clicked for', provider, 'on attempt', attempt);
        if (typeof onDispatched === 'function') {
          onDispatched({
            ok: true,
            provider,
            stage: 'submit',
            code: null,
            requestId,
            attempt,
            evidence: { dispatched: true }
          });
        }
        // 提交确认：点击后 1.5s 检查是否真正发送
        const SUBMIT_CONFIRM_MS = provider === 'doubao' ? 2500 : 1500;
        const confirmTimerId = setTimeout(() => {
          pendingAutoSubmitTimers.delete(confirmTimerId);
          pendingAutoSubmitCancelHandlers.delete(confirmTimerId);
          if (generation !== autoSubmitGeneration) return;
          const confirmation = verifySubmitConfirmed(provider, baseline);
          if (confirmation.confirmed) {
            console.log('[Text Injection] Submit confirmed for', provider, confirmation.signals);
            if (typeof onConfirmed === 'function') onConfirmed(confirmation);
          } else {
            console.warn('[Text Injection] Submit not confirmed for', provider);
            if (typeof onAttempt === 'function') {
              onAttempt({
                attempt,
                maxAttempts: RETRY_DELAYS.length,
                delay,
                clicked: false,
                reason: 'submit-not-confirmed',
                confirmation
              });
            }
            if (typeof onUnconfirmed === 'function') onUnconfirmed(confirmation);
          }
        }, SUBMIT_CONFIRM_MS);
        pendingAutoSubmitTimers.add(confirmTimerId);
        pendingAutoSubmitCancelHandlers.set(confirmTimerId, () => {
          if (typeof onUnconfirmed === 'function') {
            onUnconfirmed({ confirmed: false, cancelled: true, signals: [], evidence: {} });
          }
        });
      } else {
        console.warn('[Text Injection] Send control not found for', provider);
        if (typeof onFailure === 'function') {
          onFailure({
            ok: false,
            provider,
            stage: 'submit',
            code: SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND,
            requestId,
            attempt,
            evidence: { attempts: [{ attempt, delay, clicked: false, code: SEND_ERROR_CODES.SEND_CONTROL_NOT_FOUND }] }
          });
        }
      }
    }, delay);
    pendingAutoSubmitTimers.add(timerId);
    pendingAutoSubmitCancelHandlers.set(timerId, () => {
      if (typeof onFailure === 'function') {
        onFailure({
          ok: false,
          provider,
          stage: 'submit',
          code: SEND_ERROR_CODES.SUBMIT_CANCELLED,
          requestId,
          attempt: 0,
          evidence: { attempts: [] }
        });
      }
    });
  }

  trySubmit();
  return undefined;
}

// Compatibility export for older tests/importers. New code must use the
// explicit single-attempt name.
export const attemptAutoSubmitWithRetry = attemptAutoSubmitOnce;
