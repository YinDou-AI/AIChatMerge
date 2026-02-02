// Common text injection handler for all AI providers
// Listens for postMessage from the extension and injects text using the provided selector(s)

import { findTextInputElement, injectTextIntoElement } from '../modules/text-injector.js';

/**
 * Create a text injection handler for a specific provider
 * @param {string|string[]} selectors - CSS selector(s) to find the input element
 * @param {string} providerName - Name of the provider for logging
 * @param {string|string[]|null} sendButtonSelectors - CSS selector(s) to find the send button
 * @returns {Function} Event handler function
 */
export function createTextInjectionHandler(selectors, providerName, sendButtonSelectors = null) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  const sendButtonArray = sendButtonSelectors
    ? (Array.isArray(sendButtonSelectors) ? sendButtonSelectors : [sendButtonSelectors])
    : null;

  return function handleTextInjection(event) {
    // Only handle INJECT_TEXT messages
    if (!event.data || event.data.type !== 'INJECT_TEXT' || !event.data.text) {
      return;
    }

    const autoSubmit = event.data.autoSubmit === true;

    // Try each selector until we find an element
    let element = null;
    for (const selector of selectorArray) {
      element = findTextInputElement(selector);
      if (element) break;
    }

    if (element) {
      const success = injectTextIntoElement(element, event.data.text);
      if (success) {
        console.log(`Text injected into ${providerName} editor`);

        // Auto-submit if requested and send button selectors are configured
        if (autoSubmit && sendButtonArray) {
          // Wait a bit for the UI to update after text injection
          setTimeout(() => {
            clickSendButton(sendButtonArray, providerName);
          }, 300);
        }
      } else {
        console.error(`Failed to inject text into ${providerName}`);
      }
    } else {
      console.warn(`${providerName} editor not found, will retry...`);
      // Retry after a short delay in case page is still loading
      setTimeout(() => {
        let retryElement = null;
        for (const selector of selectorArray) {
          retryElement = findTextInputElement(selector);
          if (retryElement) break;
        }
        if (retryElement) {
          const success = injectTextIntoElement(retryElement, event.data.text);
          if (success && autoSubmit && sendButtonArray) {
            setTimeout(() => {
              clickSendButton(sendButtonArray, providerName);
            }, 300);
          }
        }
      }, 1000);
    }
  };
}

/**
 * Find and click the send button
 * @param {string[]} selectors - Array of CSS selectors to try
 * @param {string} providerName - Name of the provider for logging
 */
function clickSendButton(selectors, providerName) {
  let button = null;

  for (const selector of selectors) {
    button = document.querySelector(selector);
    if (button && !button.disabled) {
      break;
    }
    button = null;
  }

  if (button) {
    console.log(`Clicking send button for ${providerName}`);
    button.click();
  } else {
    console.warn(`Send button not found or disabled for ${providerName}`);
  }
}

/**
 * Setup text injection listener for a provider
 * @param {string|string[]} selectors - CSS selector(s) to find the input element
 * @param {string} providerName - Name of the provider for logging
 * @param {string|string[]|null} sendButtonSelectors - CSS selector(s) to find the send button
 */
export function setupTextInjectionListener(selectors, providerName, sendButtonSelectors = null) {
  const handler = createTextInjectionHandler(selectors, providerName, sendButtonSelectors);
  window.addEventListener('message', handler);
}
