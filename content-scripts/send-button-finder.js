/**
 * SendButtonFinder — 统一的发送按钮查找模块
 *
 * 封装 ButtonFinderUtils，为每个 Provider 提供预配置的发送按钮选择器。
 * 消除各 enter-behavior-*.js 中重复的选择器定义。
 *
 * 依赖: button-finder-utils.js（必须先加载）
 *       provider-detector.js（必须先加载）
 */

(function () {
  'use strict';

  // 防止重复注入
  if (window.__send_button_finder_loaded__) return;
  window.__send_button_finder_loaded__ = true;

  // 引用 ButtonFinderUtils（由 button-finder-utils.js 注入）
  const ButtonFinderUtils = window.ButtonFinderUtils;
  if (!ButtonFinderUtils) {
    console.error('[SendButtonFinder] ButtonFinderUtils not loaded. Check manifest.json injection order.');
    return;
  }

  /**
   * 各 Provider 的发送按钮选择器配置
   * 按优先级排列，从最可靠到最通用
   */
  const PROVIDER_SEND_BUTTONS = {
    chatgpt: [
      'button[data-testid="send-button"]',
      'button[data-testid="fruitjuice-send-button"]',
      { type: 'aria', textKey: 'send' }
    ],

    claude: [
      'button[aria-label="Send Message"]',
      'button[data-testid="send-button"]',
      { type: 'aria', textKey: 'send' }
    ],

    gemini: [
      'button[aria-label="Send message"]',
      'button[aria-label="发送消息"]',
      { type: 'function', matcher: function() {
        return Array.from(document.querySelectorAll('button[mat-icon-button], button[mat-fab]'))
          .find(function(btn) {
            return btn.querySelector('mat-icon') &&
                   btn.getAttribute('aria-label') &&
                   btn.getAttribute('aria-label').toLowerCase().includes('send');
          });
      }}
    ],

    grok: [
      'button[data-testid="send-button"]',
      'button[aria-label="Send"]',
      { type: 'aria', textKey: 'send' }
    ],

    deepseek: [
      // Icon button with SVG (most reliable)
      { type: 'function', matcher: function() {
        var iconButton = document.querySelector('button.ds-icon-button:not([aria-disabled="true"])') ||
                          document.querySelector('.ds-icon-button[role="button"]:not([aria-disabled="true"])');
        if (iconButton && iconButton.querySelector('svg')) {
          return iconButton;
        }
        return null;
      }},
      // Data-testid fallback
      'button[data-testid="send-button"]',
      { type: 'aria', textKey: 'send' }
    ],

    kimi: [
      // Icon button (language-independent)
      { type: 'function', matcher: function() {
        var buttons = document.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          if (btn.classList.contains('btn-send') ||
              btn.classList.contains('send-btn') ||
              btn.classList.contains('chat-input-send')) {
            return btn;
          }
        }
        return null;
      }},
      // Data-testid
      'button[data-testid="send-button"]',
      { type: 'aria', textKey: 'send' }
    ],

    doubao: [
      // Icon button
      { type: 'function', matcher: function() {
        return document.querySelector('button[class*="send"]') ||
               document.querySelector('.chat-input-send-btn') ||
               document.querySelector('[data-testid="send-button"]');
      }},
      { type: 'aria', textKey: 'send' }
    ],

    qianwen: [
      // Icon button (most reliable)
      { type: 'function', matcher: function() {
        var btn = document.querySelector('button[class*="send"]') ||
                  document.querySelector('.chat-input-send-button');
        if (btn) return btn;
        // Fallback: search for send icon
        var buttons = document.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
          if (buttons[i].querySelector('svg') &&
              buttons[i].closest('.chat-input, .input-area, [class*="input"]')) {
            return buttons[i];
          }
        }
        return null;
      }},
      { type: 'aria', textKey: 'send' }
    ],

    zhipu: [
      // Icon button
      { type: 'function', matcher: function() {
        return document.querySelector('button.send-btn') ||
               document.querySelector('[class*="send-btn"]') ||
               document.querySelector('.chat-input button[class*="send"]');
      }},
      { type: 'aria', textKey: 'send' }
    ],

    wenxin: [
      // Icon button
      { type: 'function', matcher: function() {
        return document.querySelector('button[class*="send"]') ||
               document.querySelector('.chat-input-send');
      }},
      { type: 'aria', textKey: 'send' }
    ],

    yuanbao: [
      // Icon button
      { type: 'function', matcher: function() {
        return document.querySelector('button[class*="send"]') ||
               document.querySelector('.chat-input-send-btn') ||
               document.querySelector('.ql-editor')?.closest('.chat-input')?.querySelector('button');
      }},
      { type: 'aria', textKey: 'send' }
    ],

    metaso: [
      // Icon button
      { type: 'function', matcher: function() {
        return document.querySelector('button[class*="send"]') ||
               document.querySelector('.search-send-btn');
      }},
      { type: 'aria', textKey: 'send' }
    ],

    google: [
      // Google AI mode send button
      { type: 'function', matcher: function() {
        return document.querySelector('button[aria-label="Send message"]') ||
               document.querySelector('.send-button');
      }},
      { type: 'aria', textKey: 'send' }
    ]
  };

  /**
   * 查找当前 Provider 的发送按钮
   *
   * @param {string} [provider] - Provider 名称，不传则自动检测
   * @returns {HTMLElement|null} 找到的发送按钮元素，或 null
   *
   * @example
   * // 自动检测 Provider
   * const btn = SendButtonFinder.find();
   *
   * // 指定 Provider
   * const btn = SendButtonFinder.find('chatgpt');
   */
  function find(provider) {
    const targetProvider = provider || (window.ProviderDetector && window.ProviderDetector.detect());
    if (!targetProvider) {
      console.warn('[SendButtonFinder] No provider detected, cannot find send button');
      return null;
    }

    const selectors = PROVIDER_SEND_BUTTONS[targetProvider];
    if (!selectors) {
      console.warn('[SendButtonFinder] No selectors configured for provider:', targetProvider);
      return null;
    }

    return ButtonFinderUtils.findButton(selectors);
  }

  /**
   * 查找发送按钮并点击
   *
   * @param {string} [provider] - Provider 名称
   * @returns {boolean} 是否成功找到并点击了发送按钮
   */
  function findAndClick(provider) {
    const btn = find(provider);
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  }

  /**
   * 获取指定 Provider 的选择器配置（只读副本）
   *
   * @param {string} provider - Provider 名称
   * @returns {Array|null} 选择器配置数组，或 null
   */
  function getSelectors(provider) {
    return PROVIDER_SEND_BUTTONS[provider] ? PROVIDER_SEND_BUTTONS[provider].slice() : null;
  }

  // 挂载到 window 对象
  window.SendButtonFinder = {
    find: find,
    findAndClick: findAndClick,
    getSelectors: getSelectors,
    PROVIDER_SEND_BUTTONS: PROVIDER_SEND_BUTTONS
  };

})();
