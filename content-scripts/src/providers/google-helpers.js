// google-helpers.js — Google 搜索/AI 模式特殊处理
// 日志前缀：text-injection:google

import {
  GOOGLE_PROVIDER_MODE_AI,
  GOOGLE_PROVIDER_MODE_SEARCH,
  GOOGLE_AI_INPUT_SELECTORS,
  GOOGLE_SEARCH_INPUT_SELECTORS,
  SEND_BUTTON_SELECTORS
} from './detection.js';
import { findFirstVisibleElement, isElementEnabled, pressEnter } from './dom-utils.js';
import { setFormControlValue, injectTextIntoElement } from './text-injection.js';

let googleSearchReplaceOnNextFill = true;

export function normalizeGoogleProviderMode(mode) {
  return mode === GOOGLE_PROVIDER_MODE_SEARCH
    ? GOOGLE_PROVIDER_MODE_SEARCH
    : GOOGLE_PROVIDER_MODE_AI;
}

export function resetGoogleSearchFillSession() {
  googleSearchReplaceOnNextFill = true;
}

export function getGoogleInputSelectors(mode) {
  return normalizeGoogleProviderMode(mode) === GOOGLE_PROVIDER_MODE_SEARCH
    ? GOOGLE_SEARCH_INPUT_SELECTORS
    : GOOGLE_AI_INPUT_SELECTORS;
}

export function findGoogleInput(mode) {
  return findFirstVisibleElement(getGoogleInputSelectors(mode));
}

export function buildGoogleSearchFillValue(currentValue, nextText) {
  const normalizedCurrent = (currentValue || '').trim();
  const normalizedNext = (nextText || '').trim();

  if (!normalizedNext) {
    return normalizedCurrent;
  }

  if (googleSearchReplaceOnNextFill || !normalizedCurrent) {
    return normalizedNext;
  }

  return `${normalizedCurrent}${normalizedNext}`.trim();
}

export function clearGoogleInput(mode) {
  const input = findGoogleInput(mode);
  if (!input) {
    return false;
  }

  setFormControlValue(input, '');

  if (normalizeGoogleProviderMode(mode) === GOOGLE_PROVIDER_MODE_SEARCH) {
    resetGoogleSearchFillSession();
  }

  return true;
}

export function fillGoogleSearchInput(text) {
  const input = findGoogleInput(GOOGLE_PROVIDER_MODE_SEARCH);
  if (!input || !text || typeof text !== 'string') {
    return false;
  }

  const nextValue = buildGoogleSearchFillValue(input.value || '', text);
  setFormControlValue(input, nextValue);
  googleSearchReplaceOnNextFill = false;
  return true;
}

export function navigateToGoogleSearchResults(query) {
  const normalizedQuery = (query || '').trim();
  if (!normalizedQuery) {
    return false;
  }

  const searchUrl = new URL('/search', window.location.origin);
  searchUrl.searchParams.set('q', normalizedQuery);
  window.location.assign(searchUrl.toString());
  return true;
}

export function clickGoogleSendButton(mode) {
  const normalizedMode = normalizeGoogleProviderMode(mode);

  if (normalizedMode === GOOGLE_PROVIDER_MODE_SEARCH) {
    const input = findGoogleInput(normalizedMode);
    if (!input) {
      console.warn('[Text Injection] Google Search input not found');
      return false;
    }
    const query = (input.value || '').trim();
    if (!query) {
      return false;
    }

    console.log('[Text Injection] Navigating Google Search mode to results page');
    resetGoogleSearchFillSession();
    return navigateToGoogleSearchResults(query);
  }

  const sendButton = findFirstVisibleElement(SEND_BUTTON_SELECTORS.google);
  if (sendButton && !sendButton.disabled && sendButton.getAttribute('aria-disabled') !== 'true') {
    sendButton.click();
    return true;
  }

  const input = findGoogleInput(normalizedMode);
  if (!input) {
    return false;
  }

  return pressEnter(input);
}

export function handleGoogleNewSearch(mode) {
  const normalizedMode = normalizeGoogleProviderMode(mode);
  console.log('[Text Injection] Handling Google new search for mode:', normalizedMode);
  resetGoogleSearchFillSession();
  window.location.href = normalizedMode === GOOGLE_PROVIDER_MODE_SEARCH
    ? 'https://www.google.com/'
    : 'https://www.google.com/search?udm=50';
  return true;
}

export function handleGoogleTextInjection(text, autoSubmit, providerMode) {
  const normalizedMode = normalizeGoogleProviderMode(providerMode);

  if (normalizedMode === GOOGLE_PROVIDER_MODE_SEARCH) {
    const success = fillGoogleSearchInput(text);
    if (success && autoSubmit) {
      setTimeout(() => clickGoogleSendButton(normalizedMode), 100);
    }
    return success;
  }

  const input = findGoogleInput(normalizedMode);
  if (!input) {
    return false;
  }

  const success = injectTextIntoElement(input, text);
  if (success && autoSubmit) {
    setTimeout(() => clickGoogleSendButton(normalizedMode), 500);
  }
  return success;
}
