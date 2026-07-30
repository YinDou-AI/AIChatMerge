// new-chat.js — 新建对话与临时对话
// 日志前缀：text-injection:new-chat

import { NEW_CHAT_BUTTON_SELECTORS, NEW_CHAT_URLS } from './detection.js';
import { findFirstVisibleElement, findDeepFirstVisibleElement } from './dom-utils.js';
import { handleGoogleNewSearch } from './google-helpers.js';

// Find and click new chat button
export function clickNewChatButton(provider, providerMode = null) {
  // Special handling for Google
  if (provider === 'google') {
    return handleGoogleNewSearch(providerMode);
  }

  const selectors = NEW_CHAT_BUTTON_SELECTORS[provider];
  if (!selectors) {
    console.warn('[Text Injection] No new chat button selectors for provider:', provider);
    return false;
  }

  // Try to find and click button
  const button = findDeepFirstVisibleElement(selectors) || findFirstVisibleElement(selectors);
  if (button) {
    console.log('[Text Injection] Clicking new chat button via visible selector match');
    button.click();
    return true;
  }

  // Fallback: Try to find any link or button containing "new" text
  try {
    const allButtons = document.querySelectorAll('button, a, div[role="button"]');
    for (const elem of allButtons) {
      const text = (elem.textContent || '').toLowerCase();
      const ariaLabel = (elem.getAttribute('aria-label') || '').toLowerCase();
      const href = elem.getAttribute('href') || '';

      if (text.includes('new chat') ||
        text.includes('new conversation') ||
        text.includes('start new') ||
        text.includes('新建会话') ||
        text.includes('新建对话') ||
        text.includes('开启新对话') ||
        ariaLabel.includes('new chat') ||
        ariaLabel.includes('new conversation') ||
        ariaLabel.includes('start new') ||
        ariaLabel.includes('新建会话') ||
        ariaLabel.includes('新建对话') ||
        (href === '/' && elem.closest('nav, aside'))) {
        console.log('[Text Injection] Found new chat button by text search');
        elem.click();
        return true;
      }
    }
  } catch (error) {
    console.warn('[Text Injection] Error in text-based button search:', error);
  }

  // Ultimate fallback: navigate to new chat URL
  const fallbackUrl = NEW_CHAT_URLS[provider];
  if (fallbackUrl) {
    console.log('[Text Injection] Using fallback URL for new chat:', fallbackUrl);
    if (fallbackUrl.startsWith('http')) {
      window.location.href = fallbackUrl;
    } else {
      window.location.href = window.location.origin + fallbackUrl;
    }
    return true;
  }

  console.warn('[Text Injection] New chat button not found for:', provider);
  return false;
}

export function waitForNewChatButtonReady(timeout = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
        return;
      }

      const selectors = NEW_CHAT_BUTTON_SELECTORS['claude'] || [];
      for (const selector of selectors) {
        try {
          const btn = document.querySelector(selector);
          if (btn && !btn.disabled) {
            clearInterval(checkInterval);
            resolve(true);
            return;
          }
        } catch (e) {}
      }
    }, 200);
  });
}
