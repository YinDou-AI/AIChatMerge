import {
  findFirstVisibleElement,
  isElementEnabled,
  isVisibleElement
} from '../dom-utils.js';
import {
  DOUBAO_ANSWER_SELECTORS,
  DOUBAO_COMPOSER_SELECTORS,
  DOUBAO_SEND_CONTROL_SELECTORS,
  DOUBAO_STOP_BUTTON_SELECTORS
} from './selectors.js';
import { doubaoSubmitPolicy } from './submit-policy.js';

const answerNodeIds = new WeakMap();
let nextAnswerNodeId = 1;

function readElementText(element) {
  if (!element) return '';
  return typeof element.value === 'string'
    ? element.value
    : (element.textContent || '');
}

function normalizeProbe(value) {
  return String(value || '').replace(/\s+/g, '');
}

function getAnswerNodeKey(element) {
  if (!element) return null;
  if (!answerNodeIds.has(element)) {
    answerNodeIds.set(element, `doubao-answer-${nextAnswerNodeId++}`);
  }
  return answerNodeIds.get(element);
}

function collectVisibleMatches(selectors, { excludeComposer = false } = {}) {
  const matches = new Set();
  for (const selector of selectors) {
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

function findSendControlFromSelectors() {
  let firstVisibleControl = null;
  for (const selector of DOUBAO_SEND_CONTROL_SELECTORS) {
    try {
      for (const candidate of document.querySelectorAll(selector)) {
        if (!isVisibleElement(candidate)) continue;
        if (!firstVisibleControl) firstVisibleControl = candidate;
        if (isElementEnabled(candidate)) return candidate;
      }
    } catch (_) {}
  }
  return firstVisibleControl;
}

export const doubaoSubmitAdapter = Object.freeze({
  provider: 'doubao',
  submitPolicy: doubaoSubmitPolicy,

  findComposer() {
    return findFirstVisibleElement(DOUBAO_COMPOSER_SELECTORS);
  },

  findSendControl() {
    const buttonFinderControl = window.ButtonFinderUtils?.findButton?.([
      { type: 'css', value: '#flow-end-msg-send' },
      { type: 'css', value: 'button[type="submit"]' },
      { type: 'aria', textKey: 'send' },
      { type: 'text', textKey: 'send' }
    ]);
    if (buttonFinderControl &&
        isVisibleElement(buttonFinderControl) &&
        isElementEnabled(buttonFinderControl)) {
      return buttonFinderControl;
    }
    return findSendControlFromSelectors() || buttonFinderControl || null;
  },

  isSendControlReady(control) {
    return !!control && isVisibleElement(control) && isElementEnabled(control);
  },

  triggerSubmit(control) {
    if (!this.isSendControlReady(control)) return false;
    control.focus?.();
    control.click();
    return true;
  },

  captureSubmitSnapshot({ expectedText = '' } = {}) {
    const composer = this.findComposer();
    const composerText = readElementText(composer);
    const expectedProbe = normalizeProbe(expectedText).slice(0, 80);
    const answers = collectVisibleMatches(DOUBAO_ANSWER_SELECTORS, { excludeComposer: true });
    const latestAnswer = answers[answers.length - 1] || null;
    const latestAnswerText = readElementText(latestAnswer).trim();

    return {
      composerHasExpectedText: !!expectedProbe &&
        normalizeProbe(composerText).includes(expectedProbe),
      composerTextLength: composerText.length,
      visibleStopCount: collectVisibleMatches(DOUBAO_STOP_BUTTON_SELECTORS).length,
      answerCount: answers.length,
      latestAnswerKey: getAnswerNodeKey(latestAnswer),
      latestAnswerLength: latestAnswerText.length
    };
  }
});
