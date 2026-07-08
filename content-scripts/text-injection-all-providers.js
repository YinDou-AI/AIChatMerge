// Text injection handler for all AI providers
// Self-contained script without module imports (for iframe compatibility)
// 图片注入功能已移除（v4.0）。如需恢复，参考 paste 模拟方案（DataTransfer + File + ClipboardEvent）

// Anti frame-busting: only for sites known to use frame-busting JS
// Makes top === self so frame-busting checks (if top !== self) fail gracefully
// IMPORTANT: Save real parent reference BEFORE overwriting, so content scripts can still reach multi-panel
if ((window.__realParent__ || window.parent) !== window) {
  window.__realParent__ = window.parent;
}
(function() {
  try {
    const host = location.hostname;
    const FRAME_BUSTING_HOSTS = [
      'www.qianwen.com', 'qianwen.com',
      'chatglm.cn', 'www.chatglm.cn',
      'chat.baidu.com', 'www.chat.baidu.com',
      'yuanbao.tencent.com'
    ];
    if (!FRAME_BUSTING_HOSTS.some(h => host === h || host.endsWith('.' + h))) return;

    Object.defineProperty(window, 'top', { get: () => window, configurable: true });
    Object.defineProperty(window, 'parent', { get: () => window.__realParent__ || window, configurable: true });
  } catch(e) {}
})();

(function() {
  'use strict';

  const GOOGLE_PROVIDER_MODE_AI = 'ai';
  const GOOGLE_PROVIDER_MODE_SEARCH = 'search';
  const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = 'multi-panel-provider-status';
  const ACM_PROVIDER_BUSY = 'ACM_PROVIDER_BUSY';
  const ACM_PROVIDER_IDLE = 'ACM_PROVIDER_IDLE';
  const ACM_PROVIDER_USER_INTERACTION = 'ACM_PROVIDER_USER_INTERACTION';
  const ACM_TEMP_CHAT_ENABLED = 'ACM_TEMP_CHAT_ENABLED';
  const CHATGPT_STOP_BUTTON_SELECTOR = 'button[data-testid="stop-button"]';
  const CHATGPT_SEND_TRACKING_IDLE_DELAY_MS = 800;
  const CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS = 2000;
  const MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS = 90000;
  const TEMP_CHAT_POLL_INTERVAL_MS = 200;
  const TEMP_CHAT_POLL_TIMEOUT_MS = 1200;
  const CLAUDE_UNAVAILABLE_CONTEXT = 'claude-entry-warning';
  const CLAUDE_UNAVAILABLE_REQUIRED_PATTERNS = [
    /This model isn't available right now/i,
    /You can switch to another model to continue using Claude/i
  ];
  const CLAUDE_UNAVAILABLE_CONTEXT_PATTERNS = [
    /claude-3-5-haiku-latest/i
  ];
  const CLAUDE_UNAVAILABLE_CHECK_TIMEOUT_MS = 20000;
  let googleSearchReplaceOnNextFill = true;
  let chatgptSendTracking = null;
  let multiPanelUserInteractionTracking = null;
  let claudeUnavailableWarningPosted = false;
  let claudeUnavailableObserverStarted = false;

  // Provider-specific selectors
  const PROVIDER_SELECTORS = {
    chatgpt: ['#prompt-textarea'],
    claude: [
      '.ProseMirror[role="textbox"]',
      '.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"]'
    ],
    gemini: ['.ql-editor'],
    grok: ['.tiptap', '.ProseMirror', 'textarea'],
    deepseek: [
      'textarea[placeholder="How can I help you?"]',
      'textarea.ds-scroll-area',
      'textarea[class*="ds-"]',
      'textarea',
      'div[contenteditable="true"]'
    ],
    kimi: [
      '.chat-input-editor',
      'div[contenteditable="true"].chat-input-editor',
      'div.chat-input-editor[contenteditable]',
      'div[contenteditable="true"]'
    ],
    doubao: [
      '#input-engine-container .semi-input-textarea-wrapper textarea',
      '.semi-input-textarea-wrapper textarea',
      '#input-engine-container textarea',
      'textarea.semi-input-textarea',
      'textarea.semi-input-textarea[placeholder="发消息..."]',
      'textarea[placeholder="发消息..."]',
      '[data-slate-editor="true"][contenteditable="true"]',
      '.flow-chat-editor [data-slate-editor="true"][contenteditable="true"]',
      '.flow-chat-editor [contenteditable="true"][role="textbox"]',
      '.flow-chat-editor [contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]'
    ],
    google: [
      'textarea.ITIRGe',
      'textarea[aria-label="Ask anything"]',
      'textarea[maxlength="8192"]'
    ],
    qianwen: [
      'div[data-slate-editor="true"]',
      'div[contenteditable="true"][data-slate-editor]',
      'textarea[class*="input"]',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="提问"]',
      'textarea',
      '[contenteditable="true"]'
    ],
    zhipu: [
      'textarea.scroll-display-none',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="提问"]',
      '.chat-input textarea',
      'textarea',
      '[contenteditable="true"]'
    ],
    wenxin: [
      'div[data-slate-editor="true"]',
      'div[contenteditable="true"][data-slate-editor]',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="提问"]',
      '.chat-input textarea',
      'textarea',
      '[contenteditable="true"]'
    ],
    yuanbao: [
      '.ql-editor[contenteditable="true"]',
      '.ql-editor',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="提问"]',
      'textarea',
      '[contenteditable="true"]'
    ],
    metaso: [
      'textarea.search-consult-textarea',
      'textarea[placeholder*="搜索"]',
      'textarea[placeholder*="提问"]',
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]'
    ]
  };

  const GOOGLE_AI_INPUT_SELECTORS = [
    'textarea.ITIRGe',
    'textarea[aria-label="Ask anything"]',
    'textarea[maxlength="8192"]'
  ];

  const GOOGLE_SEARCH_INPUT_SELECTORS = [
    'input[name="q"]',
    'textarea[name="q"]',
    'input.gLFyf',
    'textarea.gLFyf'
  ];

  // Provider-specific send button selectors
  const SEND_BUTTON_SELECTORS = {
    chatgpt: [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send"]',
      'form button[type="submit"]'
    ],
    claude: [
      'button[aria-label="Send Message"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'fieldset button[type="button"]:has(svg)',
      'button.bg-accent-main-100'
    ],
    gemini: [
      'button[aria-label="Send message"]',
      'button[aria-label="发送"]',
      'button.send-button',
      'button[mattooltip="Send message"]',
      '.input-area-container button:has(mat-icon)',
      'button[aria-label="Submit"]'
    ],
    grok: [
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'button[type="submit"]',
      'form button:has(svg)'
    ],
    deepseek: [
      'button[aria-label="Send"]',
      'button[type="submit"]'
    ],
    kimi: [
      // Priority: clickable send button containers that are not disabled
      '.send-button-container:not(.disabled)',
      'div[class*="send"]:not([class*="disabled"])',
      // Backup: look for send icon and click its parent
      'svg[name="Send"]',
      '.send-icon',
      // Try to find button by aria-label
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]'
    ],
    doubao: [
      '#flow-end-msg-send',
      'button#flow-end-msg-send',
      '#input-engine-container button#flow-end-msg-send',
      'button[data-testid="send-button"]',
      'button[data-test-id="send-button"]',
      'button[aria-label="Send"]',
      'button[aria-label="发送"]',
      'button[type="submit"]'
    ],
    google: [
      'button[data-xid="input-plate-send-button"]',
      'button[aria-label="Send"]',
      'button.OEueve'
    ],
    qianwen: [
      'button[aria-label="Send"]',
      'button[aria-label="发送"]',
      'button[aria-label="发送消息"]',
      'button[class*="send"]',
      'button[type="submit"]'
    ],
    zhipu: [
      'button[aria-label="Send"]',
      'button[aria-label="发送"]',
      'button[aria-label="发送消息"]',
      'button[type="submit"]'
    ],
    wenxin: [
      'button[aria-label="Send"]',
      'button[aria-label="发送"]',
      'button[aria-label="发送消息"]',
      'button[type="submit"]',
      'button[class*="send"]',
      'div[class*="send"][role="button"]',
      '[class*="send-btn"]'
    ],
    yuanbao: [
      // Yuanbao's current composer uses an <a>, not a button.  Falling back
      // to a synthetic Enter can submit before Quill has committed multiline
      // content to its internal state.
      '#searchbar-editor #yuanbao-send-btn',
      '#yuanbao-send-btn',
      'button[aria-label="Send"]',
      'button[aria-label="发送"]',
      'button[aria-label="发送消息"]',
      'button[type="submit"]',
      'button[class*="send"]'
    ],
    metaso: [
      'button.send-arrow-button',
      '.send-arrow-button',
      'button[data-testid*="send"]',
      'button[data-test-id*="send"]',
      '[role="button"][data-testid*="send"]',
      '[role="button"][data-test-id*="send"]',
      'button[title*="发送"]',
      'button[title*="Send"]',
      '[role="button"][title*="发送"]',
      '[role="button"][title*="Send"]',
      'button[type="submit"]',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      '[role="button"][aria-label*="发送"]',
      '[role="button"][aria-label*="Send"]',
      'button[aria-label*="搜索"]',
      'button[aria-label*="Search"]',
      '[role="button"][aria-label*="搜索"]',
      '[role="button"][aria-label*="Search"]',
      'button[class*="submit"]',
      'button[class*="send"]',
      '[role="button"][class*="submit"]',
      '[role="button"][class*="send"]'
    ]
  };

  // Provider-specific new chat button selectors and URLs
  const NEW_CHAT_BUTTON_SELECTORS = {
    chatgpt: [
      'a[aria-label="New chat"]',
      'button[aria-label="New chat"]',
      'a[href="/"]',
      'nav a[href="/"]',
      'aside a[href="/"]',
      '[data-testid="new-chat-button"]'
    ],
    claude: [
      'button[aria-label="Start new chat"]',
      'button[aria-label*="new chat"]',
      'a[href="/new"]',
      'div[role="button"][aria-label*="New"]',
      'a[href*="/new"]'
    ],
    gemini: [
      'button[aria-label="New chat"]',
      'button[aria-label*="New"]',
      'a[aria-label="New chat"]'
    ],
    grok: [
      'a[href="/"]',
      'button[aria-label*="New"]',
      'a[href*="new"]'
    ],
    deepseek: [
      'button[aria-label*="New"]',
      'a[href="/"]',
      'div[class*="new-chat"]'
    ],
    kimi: [
      'a.new-chat-btn',
      'a[href="/"]',
      '.sidebar a[href="/"]'
    ],
    doubao: [
      '#flow_chat_sidebar > div.cursor-pointer',
      '#flow_chat_sidebar > div[class*="cursor-pointer"]',
      'button[data-testid="new-chat-button"]',
      'button[data-test-id="new-chat-button"]',
      'button[data-testid="new-conversation-button"]',
      'button[data-test-id="new-conversation-button"]',
      'a[href="/chat/"]',
      'a[href="/chat"]',
      'button[aria-label*="New"]',
      'button[aria-label*="新建"]'
    ],
    google: [
      'button[aria-label="New search"]',
      'a[aria-label="Google"]',
      'a[href^="/search"][href*="udm="]'
    ],
    qianwen: [
      'button[aria-label*="新"]',
      'a[href="/chat"]',
      'button[aria-label*="New"]'
    ],
    zhipu: [
      'button[aria-label*="新"]',
      'a[href="/"]',
      'button[aria-label*="New"]'
    ],
    wenxin: [
      'button[aria-label*="新"]',
      'a[href="/"]',
      'button[aria-label*="New"]'
    ],
    yuanbao: [
      'button[aria-label*="新"]',
      'a[href="/chat/"]',
      'button[aria-label*="New"]'
    ],
    metaso: [
      'button[aria-label*="新"]',
      'a[href="/"]',
      'button[aria-label*="New"]'
    ]
  };

  // Fallback URLs for creating new chat when button not found
  const NEW_CHAT_URLS = {
    chatgpt: 'https://chatgpt.com/',
    claude: 'https://claude.ai/new',
    gemini: 'https://gemini.google.com/app',
    grok: 'https://grok.com/',
    deepseek: 'https://chat.deepseek.com/',
    kimi: 'https://www.kimi.com/',
    doubao: 'https://www.doubao.com/chat/',
    google: 'https://www.google.com/search?udm=50',
    qianwen: 'https://www.qianwen.com/chat',
    zhipu: 'https://chatglm.cn/',
    wenxin: 'https://chat.baidu.com/',
    yuanbao: 'https://yuanbao.tencent.com/chat/',
    metaso: 'https://metaso.cn/'
  };

  const TEMP_CHAT_BUTTON_SELECTORS = {
    chatgpt: ['button[aria-label="Turn on temporary chat"]'],
    claude: ['button[aria-label="Use incognito"]'],
    gemini: [
      'button[data-test-id="temp-chat-button"]',
      'button[aria-label="Temporary chat"]'
    ],
    grok: ['a[href="/c#private"][aria-label="Switch to Private Chat"]']
  };

  // Detect which provider we're on based on hostname
  function detectProvider() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const search = window.location.search;

    // 过滤Claude工具iframe（如isolated-segment.html）
    if (hostname.includes('claude.ai')) {
      const utilFramePattern = /isolated|segment|embed|widget|frame\.html|extension|sandbox/i;
      if (utilFramePattern.test(pathname)) {
        return null;
      }
    }

    if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
      return 'chatgpt';
    } else if (hostname.includes('claude.ai')) {
      return 'claude';
    } else if (hostname.includes('gemini.google.com')) {
      return 'gemini';
    } else if (hostname.includes('grok.com')) {
      return 'grok';
    } else if (hostname.includes('deepseek.com')) {
      return 'deepseek';
    } else if (hostname.includes('kimi.com')) {
      return 'kimi';
    } else if (hostname.includes('doubao.com')) {
      return 'doubao';
    } else if (hostname.includes('qianwen.com')) {
      return 'qianwen';
    } else if (hostname.includes('chatglm.cn')) {
      return 'zhipu';
    } else if (hostname.includes('chat.baidu.com')) {
      return 'wenxin';
    } else if (hostname.includes('yuanbao.tencent.com')) {
      return 'yuanbao';
    } else if (hostname.includes('metaso.cn')) {
      return 'metaso';
    } else if (hostname.includes('google.com') || hostname.includes('google.') || hostname === 'www.google.com') {
      // Google Search / AI Mode
      // Always return 'google' for any google.com page
      // The handleGoogleNewSearch will navigate to homepage which works for all cases
      return 'google';
    }
    return null;
  }

  function normalizeGoogleProviderMode(mode) {
    return mode === GOOGLE_PROVIDER_MODE_SEARCH
      ? GOOGLE_PROVIDER_MODE_SEARCH
      : GOOGLE_PROVIDER_MODE_AI;
  }

  function resetGoogleSearchFillSession() {
    googleSearchReplaceOnNextFill = true;
  }

  // Check if element is a Slate editor
  function isSlateEditor(element) {
    return element && (
      element.getAttribute('data-slate-editor') === 'true' ||
      element.getAttribute('data-slate-editor') === ''
    );
  }

  // Inject text into Slate editor via paste event (like 群问AI)
  function injectTextIntoSlateEditor(element, text) {
    if (!element || !text) return false;
    element.focus();

    // Select all and delete first
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    } catch (e) {
      // Fallback
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('delete', false, null);
      } catch (e2) {}
    }

    // Create clipboard data with text
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);

    // Dispatch paste event
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    });
    // A Slate paste handler normally prevents the browser default and writes
    // the editor state itself. Wenxin and Qianwen can enter an invalid state
    // when we then unconditionally insert the same text again.
    const pasteHandled = !element.dispatchEvent(pasteEvent);

    if ((detectProvider() === 'qianwen' || detectProvider() === 'wenxin') && pasteHandled) {
      return true;
    }

    // The synthetic paste was not handled, so use insertText as a fallback.
    try {
      document.execCommand('insertText', false, text);
    } catch (e) {}

    return true;
  }

  let isExtractMode = false;

  // Provider pages are intentionally frameable while this extension is active.
  // A parent window is therefore not trusted merely because it is the parent.
  function getExtensionOrigin() {
    try {
      const extensionUrl = new URL(chrome.runtime.getURL('/'));
      // Some URL implementations report a null origin for extension schemes.
      // Chrome itself has a concrete chrome-extension://<id> origin.
      return extensionUrl.origin === 'null'
        ? `${extensionUrl.protocol}//${extensionUrl.host}`
        : extensionUrl.origin;
    } catch (error) {
      console.warn('[MessageHandler] Unable to determine extension origin', error);
      return null;
    }
  }

  const extensionOrigin = getExtensionOrigin();

  function isTrustedExtensionParent(event) {
    return !!extensionOrigin && event.source === window.parent && event.origin === extensionOrigin;
  }

  function postToExtensionParent(message) {
    if (window.parent !== window && extensionOrigin) {
      window.parent.postMessage(message, extensionOrigin);
    }
  }

  function postInjectionResult(injectionRequestId, provider, inputFound, injectSuccess, error = null) {
    if (!injectionRequestId) return;
    postToExtensionParent({
      type: 'INJECT_TEXT_RESULT',
      injectionRequestId,
      provider,
      inputFound,
      injectSuccess,
      error,
      context: 'multi-panel-injection'
    });
  }

  function getClaudeUnavailableMatch() {
    const text = document.body?.innerText || '';
    const hasUnavailableMessage = CLAUDE_UNAVAILABLE_REQUIRED_PATTERNS
      .every(pattern => pattern.test(text));
    if (!hasUnavailableMessage) return '';

    return CLAUDE_UNAVAILABLE_CONTEXT_PATTERNS
      .concat(CLAUDE_UNAVAILABLE_REQUIRED_PATTERNS)
      .map(pattern => {
        const match = text.match(pattern);
        return match ? match[0] : null;
      })
      .find(Boolean) || '';
  }

  function maybePostClaudeUnavailableWarning() {
    if (claudeUnavailableWarningPosted || detectProvider() !== 'claude') return true;
    const matchedText = getClaudeUnavailableMatch();
    if (!matchedText) return false;

    claudeUnavailableWarningPosted = true;
    postToExtensionParent({
      type: 'CLAUDE_ENTRY_WARNING',
      provider: 'claude',
      reason: 'unavailable-model',
      matchedText,
      context: CLAUDE_UNAVAILABLE_CONTEXT
    });
    return true;
  }

  function startClaudeUnavailableWarningMonitor() {
    if (claudeUnavailableObserverStarted || detectProvider() !== 'claude') return;
    claudeUnavailableObserverStarted = true;

    const startedAt = Date.now();
    let observer = null;

    const stop = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };

    const check = () => {
      if (maybePostClaudeUnavailableWarning() || Date.now() - startedAt > CLAUDE_UNAVAILABLE_CHECK_TIMEOUT_MS) {
        stop();
      }
    };

    const start = () => {
      check();
      if (!document.body || claudeUnavailableWarningPosted) return;
      observer = new MutationObserver(check);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      setTimeout(start, 1200);
    } else {
      start();
    }

    setTimeout(stop, CLAUDE_UNAVAILABLE_CHECK_TIMEOUT_MS + 1000);
  }

  startClaudeUnavailableWarningMonitor();

  window.addEventListener('message', (event) => {
    if (event?.data?.type === 'SET_EXTRACT_MODE' && isTrustedExtensionParent(event)) {
      isExtractMode = event.data.enabled === true;
    }
  });

  function isVisibleElement(element) {
    if (!element) return false;
    if (isExtractMode) return true;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;

    const rect = typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : null;

    if (!rect) {
      return true;
    }

    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || Number.POSITIVE_INFINITY;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || Number.POSITIVE_INFINITY;

    return Boolean(
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportHeight &&
      rect.left < viewportWidth
    );
  }

  function findFirstVisibleElement(selectors) {
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (isVisibleElement(element)) {
            return element;
          }
        }
      } catch (error) {
        console.warn('[Text Injection] Error finding visible element with selector:', selector, error);
      }
    }

    return null;
  }

  function getElementAccessibleText(element) {
    return [
      element?.getAttribute?.('aria-label') || '',
      element?.getAttribute?.('title') || '',
      element?.textContent || ''
    ]
      .join(' ')
      .trim()
      .toLowerCase();
  }

  function findDeepFirstVisibleElement(selectors) {
    for (const selector of selectors) {
      try {
        const elements = querySelectorAllDeep(selector);
        for (const element of elements) {
          if (isVisibleElement(element)) {
            return element;
          }
        }
      } catch (error) {
        console.warn('[Text Injection] Error finding deep visible element with selector:', selector, error);
      }
    }

    return null;
  }

  function findDeepClickableElementByKeywords(keywords) {
    const loweredKeywords = keywords.map(keyword => keyword.toLowerCase());
    const candidates = querySelectorAllDeep('button, [role="button"], [role="menuitem"], label');

    for (const candidate of candidates) {
      if (!isVisibleElement(candidate)) {
        continue;
      }

      const searchableText = getElementAccessibleText(candidate);
      if (loweredKeywords.some(keyword => searchableText.includes(keyword))) {
        return candidate;
      }
    }

    return null;
  }

  function getGoogleInputSelectors(mode) {
    return normalizeGoogleProviderMode(mode) === GOOGLE_PROVIDER_MODE_SEARCH
      ? GOOGLE_SEARCH_INPUT_SELECTORS
      : GOOGLE_AI_INPUT_SELECTORS;
  }

  function postMultiPanelProviderStatus(type, requestId, phase, provider = detectProvider()) {
    if (!requestId || window.parent === window) {
      return;
    }

    window.parent.postMessage({
      type,
      requestId,
      provider,
      phase,
      context: MULTI_PANEL_PROVIDER_STATUS_CONTEXT
    }, extensionOrigin);
  }

  function postTemporaryChatEnabled(provider = detectProvider()) {
    if (!provider || window.parent === window) {
      return;
    }

    window.parent.postMessage({
      type: ACM_TEMP_CHAT_ENABLED,
      provider,
      context: MULTI_PANEL_PROVIDER_STATUS_CONTEXT
    }, extensionOrigin);
  }

  function stopMultiPanelUserInteractionTracking() {
    const tracking = multiPanelUserInteractionTracking;
    if (!tracking) {
      return;
    }

    if (typeof tracking.timeoutId === 'number') {
      clearTimeout(tracking.timeoutId);
    }

    if (tracking.interactionHandler) {
      document.removeEventListener('pointerdown', tracking.interactionHandler, true);
      document.removeEventListener('keydown', tracking.interactionHandler, true);
    }

    multiPanelUserInteractionTracking = null;
  }

  function startMultiPanelUserInteractionTracking(requestId, provider = detectProvider()) {
    if (!requestId || !provider) {
      return;
    }

    stopMultiPanelUserInteractionTracking();

    const tracking = {
      requestId,
      provider,
      timeoutId: null,
      interactionHandler: null
    };

    tracking.interactionHandler = (event) => {
      if (multiPanelUserInteractionTracking !== tracking || !event.isTrusted) {
        return;
      }

      postMultiPanelProviderStatus(
        ACM_PROVIDER_USER_INTERACTION,
        tracking.requestId,
        'user-interaction',
        tracking.provider
      );

      if (tracking.provider === 'chatgpt' && chatgptSendTracking?.requestId === tracking.requestId) {
        stopChatgptSendTracking();
      }

      stopMultiPanelUserInteractionTracking();
    };

    document.addEventListener('pointerdown', tracking.interactionHandler, true);
    document.addEventListener('keydown', tracking.interactionHandler, true);

    tracking.timeoutId = setTimeout(() => {
      if (multiPanelUserInteractionTracking !== tracking) {
        return;
      }

      stopMultiPanelUserInteractionTracking();
    }, MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS);

    multiPanelUserInteractionTracking = tracking;
  }

  function findChatgptBusyButton() {
    return document.querySelector(CHATGPT_STOP_BUTTON_SELECTOR);
  }

  function getChatgptComposerRoot() {
    return document.querySelector('form[data-type="unified-composer"]') ||
      document.querySelector('#prompt-textarea')?.closest('form') ||
      document.body;
  }

  function stopChatgptSendTracking({ reportIdle = false } = {}) {
    const tracking = chatgptSendTracking;
    if (!tracking) {
      return;
    }

    if (tracking.observer) {
      tracking.observer.disconnect();
    }

    if (typeof tracking.idleTimerId === 'number') {
      clearTimeout(tracking.idleTimerId);
    }

    if (typeof tracking.noBusyTimerId === 'number') {
      clearTimeout(tracking.noBusyTimerId);
    }

    const { requestId, phase } = tracking;
    chatgptSendTracking = null;

    if (reportIdle) {
      postMultiPanelProviderStatus(ACM_PROVIDER_IDLE, requestId, phase, 'chatgpt');
    }
  }

  function evaluateChatgptSendTrackingState() {
    const tracking = chatgptSendTracking;
    if (!tracking) {
      return;
    }

    if (findChatgptBusyButton()) {
      if (typeof tracking.noBusyTimerId === 'number') {
        clearTimeout(tracking.noBusyTimerId);
        tracking.noBusyTimerId = null;
      }

      if (typeof tracking.idleTimerId === 'number') {
        clearTimeout(tracking.idleTimerId);
        tracking.idleTimerId = null;
      }

      if (tracking.phase !== 'busy') {
        tracking.phase = 'busy';
        postMultiPanelProviderStatus(ACM_PROVIDER_BUSY, tracking.requestId, tracking.phase, 'chatgpt');
      }
      return;
    }

    if (tracking.phase !== 'busy' || typeof tracking.idleTimerId === 'number') {
      return;
    }

    tracking.idleTimerId = setTimeout(() => {
      const currentTracking = chatgptSendTracking;
      if (!currentTracking || currentTracking.requestId !== tracking.requestId) {
        return;
      }

      currentTracking.idleTimerId = null;
      if (findChatgptBusyButton()) {
        evaluateChatgptSendTrackingState();
        return;
      }

      currentTracking.phase = 'idle';
      stopChatgptSendTracking({ reportIdle: true });
    }, CHATGPT_SEND_TRACKING_IDLE_DELAY_MS);
  }

  function startChatgptSendTracking(requestId) {
    if (!requestId) {
      return;
    }

    stopChatgptSendTracking();

    const tracking = {
      requestId,
      phase: 'pending',
      observer: null,
      idleTimerId: null,
      noBusyTimerId: null
    };

    const observerTarget = document.body || getChatgptComposerRoot();
    if (observerTarget) {
      tracking.observer = new MutationObserver(() => {
        if (chatgptSendTracking !== tracking) {
          return;
        }

        if (typeof tracking.idleTimerId === 'number' && findChatgptBusyButton()) {
          clearTimeout(tracking.idleTimerId);
          tracking.idleTimerId = null;
        }

        evaluateChatgptSendTrackingState();
      });

      tracking.observer.observe(observerTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-testid', 'aria-label', 'disabled', 'aria-disabled']
      });
    }

    tracking.noBusyTimerId = setTimeout(() => {
      if (chatgptSendTracking !== tracking || tracking.phase !== 'pending') {
        return;
      }

      stopChatgptSendTracking();
    }, CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS);

    chatgptSendTracking = tracking;
    evaluateChatgptSendTrackingState();
  }

  function findGoogleInput(mode) {
    return findFirstVisibleElement(getGoogleInputSelectors(mode));
  }

  function setFormControlValue(element, value) {
    const prototype = element.tagName === 'INPUT'
      ? window.HTMLInputElement.prototype
      : window.HTMLTextAreaElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: value,
    }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    if (typeof element.value === 'string') {
      element.selectionStart = element.selectionEnd = element.value.length;
    }
  }

  function dispatchEditorKeyEvent(element, key, code, modifiers = {}) {
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      code,
      keyCode: key === 'Backspace' ? 8 : key === 'a' ? 65 : 13,
      which: key === 'Backspace' ? 8 : key === 'a' ? 65 : 13,
      ctrlKey: modifiers.ctrl || false,
      metaKey: modifiers.meta || false,
      shiftKey: modifiers.shift || false,
      altKey: modifiers.alt || false,
      bubbles: true,
      cancelable: true
    }));
  }

  function clearRichTextInput(provider, element) {
    element.focus();

    if (provider !== 'kimi' && provider !== 'doubao') {
      element.innerHTML = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    dispatchEditorKeyEvent(element, 'a', 'KeyA', { ctrl: true, meta: true });
    document.execCommand('selectAll', false, null);

    setTimeout(() => {
      dispatchEditorKeyEvent(element, 'Backspace', 'Backspace');
      document.execCommand('delete', false, null);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      const hasResidualContent = element.textContent.trim().length > 0 ||
        element.querySelector('img, figure, [data-slate-node], [data-slate-string], [data-slate-zero-width]');

      if (provider === 'doubao' && hasResidualContent) {
        element.innerHTML = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 10);
  }

  function buildGoogleSearchFillValue(currentValue, nextText) {
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

  function clearGoogleInput(mode) {
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

  function isElementEnabled(element) {
    return Boolean(
      element &&
      !element.disabled &&
      element.getAttribute('aria-disabled') !== 'true'
    );
  }

  function findMetasoSidebarContainer() {
    const candidates = document.querySelectorAll('.left-menu, [class*="LeftMenu_menu-container"]');
    for (const candidate of candidates) {
      if (!isVisibleElement(candidate)) {
        continue;
      }

      const rect = typeof candidate.getBoundingClientRect === 'function'
        ? candidate.getBoundingClientRect()
        : null;

      if (rect && rect.width >= 40 && rect.height >= 200) {
        return candidate;
      }
    }

    return null;
  }

  function isMetasoSidebarCollapsed(container = findMetasoSidebarContainer()) {
    if (!container) {
      return false;
    }

    const className = typeof container.className === 'string'
      ? container.className
      : String(container.className || '');

    if (className.includes('LeftMenu_collapse')) {
      return true;
    }

    const rect = typeof container.getBoundingClientRect === 'function'
      ? container.getBoundingClientRect()
      : null;

    return !!rect && rect.width > 0 && rect.width <= 80;
  }

  function findMetasoSidebarToggleButton(container = findMetasoSidebarContainer()) {
    if (!container) {
      return null;
    }

    const candidates = [
      ...container.querySelectorAll('button, [role="button"], [class*="LeftMenu_sidebar-action"]'),
      ...document.querySelectorAll('[class*="LeftMenu_sidebar-action"]')
    ];

    for (const candidate of candidates) {
      if (!isVisibleElement(candidate) || !isElementEnabled(candidate)) {
        continue;
      }

      const rect = typeof candidate.getBoundingClientRect === 'function'
        ? candidate.getBoundingClientRect()
        : null;

      if (!rect) {
        continue;
      }

      const text = getElementAccessibleText(candidate);
      if (text.includes('删除') || text.includes('delete') || text.includes('关闭')) {
        continue;
      }

      if (rect.top <= 80 && rect.width <= 48 && rect.height <= 48) {
        return candidate;
      }
    }

    return null;
  }

  function collapseMetasoSidebarIfNeeded() {
    const container = findMetasoSidebarContainer();
    if (!container) {
      return false;
    }

    if (isMetasoSidebarCollapsed(container)) {
      return true;
    }

    const toggleButton = findMetasoSidebarToggleButton(container);
    if (!toggleButton) {
      return false;
    }

    toggleButton.click();
    return false;
  }

  function initMetasoSidebarAutoCollapse() {
    if (detectProvider() !== 'metaso' || window.__aichatmergeMetasoSidebarAutoCollapseStarted) {
      return;
    }

    window.__aichatmergeMetasoSidebarAutoCollapseStarted = true;

    const MAX_RUNTIME_MS = 15000;
    const startTime = Date.now();
    let retryTimerId = null;
    let observer = null;

    const cleanup = () => {
      if (typeof retryTimerId === 'number') {
        clearTimeout(retryTimerId);
        retryTimerId = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };

    const attemptCollapse = () => {
      if (collapseMetasoSidebarIfNeeded()) {
        cleanup();
        return;
      }

      if (Date.now() - startTime >= MAX_RUNTIME_MS) {
        cleanup();
        return;
      }

      if (typeof retryTimerId !== 'number') {
        retryTimerId = setTimeout(() => {
          retryTimerId = null;
          attemptCollapse();
        }, 400);
      }
    };

    observer = new MutationObserver(() => {
      attemptCollapse();
    });

    const observeTarget = document.body || document.documentElement;
    if (observeTarget) {
      observer.observe(observeTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'aria-hidden']
      });
    }

    attemptCollapse();
  }

  function fillGoogleSearchInput(text) {
    const input = findGoogleInput(GOOGLE_PROVIDER_MODE_SEARCH);
    if (!input || !text || typeof text !== 'string') {
      return false;
    }

    const nextValue = buildGoogleSearchFillValue(input.value || '', text);
    setFormControlValue(input, nextValue);
    googleSearchReplaceOnNextFill = false;
    return true;
  }

  function navigateToGoogleSearchResults(query) {
    const normalizedQuery = (query || '').trim();
    if (!normalizedQuery) {
      return false;
    }

    const searchUrl = new URL('/search', window.location.origin);
    searchUrl.searchParams.set('q', normalizedQuery);
    window.location.assign(searchUrl.toString());
    return true;
  }

  // Find text input element by selector
  function findTextInputElement(selector) {
    if (!selector || typeof selector !== 'string') {
      return null;
    }

    try {
      return document.querySelector(selector);
    } catch (error) {
      console.error('Error finding element:', error);
      return null;
    }
  }

  function clickGoogleSendButton(mode) {
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

  // Qianwen can render multiple visible "send" controls (for example in
  // overlays or retained conversation UI). Only a button near the editor that
  // received the injected text is safe to click.
  function findQianwenScopedSendButton() {
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

  // Find and click send button
  function clickSendButton(provider, providerMode = null) {
    if (provider === 'google') {
      return clickGoogleSendButton(providerMode);
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
            return false;
    }

    if (provider === 'yuanbao') {
      const editor = document.querySelector('#searchbar-editor .ql-editor[contenteditable="true"], .ql-editor[contenteditable="true"]');
      const sendButton = document.querySelector('#searchbar-editor #yuanbao-send-btn, #yuanbao-send-btn');
      if (editor && sendButton && isVisibleElement(sendButton) && isElementEnabled(sendButton)) {
        sendButton.focus?.();
        sendButton.click();
        return true;
      }
      // Do not fall through to a synthetic Enter for Yuanbao.  Its current
      // Quill composer can receive the first paragraph before the remaining
      // paragraphs are committed, which produces an accidental image request.
            return false;
    }

    if (provider === 'doubao' && window.ButtonFinderUtils?.findButton) {
      const sendButton = window.ButtonFinderUtils.findButton([
        { type: 'css', value: '#flow-end-msg-send' },
        { type: 'css', value: 'button[type="submit"]' },
        { type: 'aria', textKey: 'send' },
        { type: 'text', textKey: 'send' }
      ]);

      if (sendButton) {
        const enabled = isElementEnabled(sendButton);
                if (isExtractMode || enabled) {
          sendButton.click();
          return true;
        }
      } else {
              }
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
            if ((provider === 'qianwen' || provider === 'metaso') && !isVisibleElement(targetElement)) {
              continue;
            }
            if (isExtractMode || isElementEnabled(targetElement)) {
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
      if (provider === 'qianwen' || provider === 'metaso' || provider === 'gemini') {
                return false;
      }
            if (pressEnterOnProviderInput(provider)) {
        return true;
      }
    }

    // Fallback: press Enter on provider input
    if (provider === 'qianwen' || provider === 'gemini') {
            return false;
    }
        if (pressEnterOnProviderInput(provider)) {
      return true;
    }

    console.warn('[Text Injection] Send button not found or disabled for:', provider);
    return false;
  }

  // Special handler for Google to create "new search"
  function handleGoogleNewSearch(mode) {
    const normalizedMode = normalizeGoogleProviderMode(mode);
        resetGoogleSearchFillSession();
    window.location.href = normalizedMode === GOOGLE_PROVIDER_MODE_SEARCH
      ? 'https://www.google.com/'
      : 'https://www.google.com/search?udm=50';
    return true;
  }

  function isTemporaryChatControlActive(element) {
    if (!element) {
      return false;
    }

    if (element.getAttribute('aria-pressed') === 'true' || element.getAttribute('aria-checked') === 'true') {
      return true;
    }

    const dataState = (element.dataset?.state || '').toLowerCase();
    if (dataState === 'active' || dataState === 'on' || dataState === 'checked' || dataState === 'selected') {
      return true;
    }

    const classTokens = element.classList
      ? [...element.classList].map(token => token.toLowerCase())
      : String(element.className || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    return ['active', 'selected', 'checked', 'toggled', 'enabled', 'on'].some(token => classTokens.includes(token));
  }

  function isGeminiTemporaryChatEnabled(control = null) {
    const button = control ||
      document.querySelector('button[data-test-id="temp-chat-button"]') ||
      document.querySelector('button[aria-label="Temporary chat"]');

    if (!button) {
      return false;
    }

    return button.classList.contains('temp-chat-on') || isTemporaryChatControlActive(button);
  }

  function isTemporaryChatAlreadyEnabled(provider, control = null) {
    const currentUrl = new URL(window.location.href);

    switch (provider) {
      case 'chatgpt':
        return currentUrl.searchParams.get('temporary-chat') === 'true';
      case 'claude':
        return currentUrl.searchParams.has('incognito');
      case 'grok':
        return currentUrl.hash === '#private' || isTemporaryChatControlActive(control);
      case 'gemini': {
        return isGeminiTemporaryChatEnabled(control);
      }
      default:
        return false;
    }
  }

  async function enableTemporaryChat(provider) {
    const selectors = TEMP_CHAT_BUTTON_SELECTORS[provider];
    if (!selectors || selectors.length === 0) {
            return false;
    }

    if (isTemporaryChatAlreadyEnabled(provider)) {
      postTemporaryChatEnabled(provider);
      return true;
    }

    const deadline = Date.now() + TEMP_CHAT_POLL_TIMEOUT_MS;
    while (Date.now() <= deadline) {
      const button = findDeepFirstVisibleElement(selectors) || findFirstVisibleElement(selectors);
      if (isTemporaryChatAlreadyEnabled(provider, button)) {
        postTemporaryChatEnabled(provider);
        return true;
      }

      if (button && isElementEnabled(button)) {
        button.click();
        postTemporaryChatEnabled(provider);
        return true;
      }

      await sleep(TEMP_CHAT_POLL_INTERVAL_MS);
    }

        return false;
  }

  function findNewChatButton(provider) {
    const selectors = NEW_CHAT_BUTTON_SELECTORS[provider];
    if (!selectors) {
      console.warn('[Text Injection] No new chat button selectors for provider:', provider);
      return null;
    }

    const button = findDeepFirstVisibleElement(selectors) || findFirstVisibleElement(selectors);
    if (button) {
      return button;
    }

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
          return elem;
        }
      }
    } catch (error) {
      console.warn('[Text Injection] Error in text-based button search:', error);
    }

    return null;
  }

  function navigateToNewChatFallback(provider) {
    const fallbackUrl = NEW_CHAT_URLS[provider];
    if (!fallbackUrl) {
      console.warn('[Text Injection] New chat button not found for:', provider);
      return false;
    }

    if (fallbackUrl.startsWith('http')) {
      window.location.href = fallbackUrl;
    } else {
      window.location.href = window.location.origin + fallbackUrl;
    }
    return true;
  }

  // Find and click new chat button
  function clickNewChatButton(provider, providerMode = null) {
    // Special handling for Google
    if (provider === 'google') {
      return handleGoogleNewSearch(providerMode);
    }

    const button = findNewChatButton(provider);
    if (button) {
            button.click();
      return true;
    }

    // Ultimate fallback: navigate to new chat URL
    return navigateToNewChatFallback(provider);
  }

  // Wait for Claude's new chat button before triggering auto-new-chat flows.
  function waitForNewChatButtonReady(timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        const button = findNewChatButton('claude');
        if (button && isElementEnabled(button)) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 200);
    });
  }

  function normalizeYuanbaoEditorText(value) {
    return String(value || '')
      .replace(/\r/g, '')
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n');
  }

  // Yuanbao's current Quill composer does not reliably retain programmatic
  // line breaks. Preserve every paragraph by turning line breaks into a
  // readable inline separator before writing to the editor.
  function prepareYuanbaoInputText(text) {
    const lines = String(text || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    return lines.reduce((result, line) => {
      if (!result) return line;
      return /[。！？；;!?]$/.test(result) ? `${result} ${line}` : `${result}；${line}`;
    }, '');
  }

  function injectTextIntoYuanbaoEditor(element, text) {
    try {
      const preparedText = prepareYuanbaoInputText(text);
      if (!preparedText) return false;
      element.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);

      const inserted = document.execCommand('insertText', false, preparedText);
      if (!inserted) {
        element.textContent = preparedText;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      return normalizeYuanbaoEditorText(element.innerText) === normalizeYuanbaoEditorText(preparedText);
    } catch (error) {
      console.warn('[Text Injection] Yuanbao multiline injection failed:', error);
      return false;
    }
  }

  function normalizeInjectedText(value) {
    return String(value || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n');
  }

  function hasExpectedMultilineText(actualText, expectedText) {
    const actual = normalizeInjectedText(actualText);
    const expected = normalizeInjectedText(expectedText);
    if (!expected) return false;
    if (actual === expected || actual.includes(expected)) return true;

    const expectedLines = expected.split('\n').filter(Boolean);
    let cursor = 0;
    return expectedLines.every(line => {
      const index = actual.indexOf(line, cursor);
      if (index < 0) return false;
      cursor = index + line.length;
      return true;
    });
  }

  function getGeminiEditorText() {
    const editor = document.querySelector('.ql-editor');
    return editor ? (editor.innerText || editor.textContent || '') : '';
  }

  function hasExpectedGeminiText(expectedText) {
    if (typeof expectedText !== 'string') return false;
    return hasExpectedMultilineText(getGeminiEditorText(), expectedText);
  }

  function injectTextIntoGeminiEditor(element, text) {
    try {
      element.focus();

      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
      } catch (e) {
        element.innerHTML = '';
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      element.dispatchEvent(pasteEvent);

      if (!hasExpectedMultilineText(element.innerText || element.textContent || '', text)) {
        element.innerHTML = '';
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const nonEmptyLines = lines.length ? lines : [''];
        nonEmptyLines.forEach(line => {
          const paragraph = document.createElement('p');
          paragraph.textContent = line || '\u00a0';
          element.appendChild(paragraph);
        });
      }

      element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (error) {
      console.warn('[Text Injection] Gemini multiline injection failed:', error);
      return false;
    }
  }

  // Metaso's public home page keeps its send arrow disabled until the textarea
  // is focused and receives beforeinput.  The generic value/input sequence is
  // enough on its conversation page but not on this public entry point.
  function injectTextIntoMetasoTextarea(element, text) {
    try {
      element.focus();
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(element, text);
      } else {
        element.value = text;
      }

      element.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return element.value === text;
    } catch (error) {
      console.warn('[Text Injection] Metaso textarea injection failed:', error);
      return false;
    }
  }

  // Inject text into an element (textarea or contenteditable)
  function injectTextIntoElement(element, text) {
    if (!element || !text || typeof text !== 'string' || text.trim() === '') {
      return false;
    }

    try {
      const isTextarea = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';
      const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

      if (!isTextarea && !isContentEditable) {
        console.warn('Element is not a textarea or contenteditable:', element);
        return false;
      }

      if (detectProvider() === 'yuanbao' && element.matches('.ql-editor[contenteditable="true"], #searchbar-editor [contenteditable="true"]')) {
        return injectTextIntoYuanbaoEditor(element, text);
      }

      if (detectProvider() === 'gemini' && element.matches('.ql-editor')) {
        return injectTextIntoGeminiEditor(element, text);
      }

      if (detectProvider() === 'metaso' && element.matches('textarea.search-consult-textarea')) {
        return injectTextIntoMetasoTextarea(element, text);
      }

      // Slate editors need paste method
      if (isSlateEditor(element)) {
        return injectTextIntoSlateEditor(element, text);
      }

      if (isTextarea) {
        // For textarea/input elements
        const currentValue = element.value || '';
        const newValue = currentValue + text;

        setFormControlValue(element, newValue);
      } else {
        // For contenteditable elements - clear first, then insert (replacement semantics)
        element.focus();

        // Select all content first
        try {
          document.execCommand('selectAll', false, null);
        } catch (e) {
          // Fallback: manual selection
          try {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (e2) {
            // Ignore selection errors
          }
        }

        // Delete selected content
        try {
          document.execCommand('delete', false, null);
        } catch (e) {
          // Fallback: keyboard event
          try {
            element.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8,
              bubbles: true, cancelable: true
            }));
          } catch (e2) {
            // Last resort: clear innerHTML
            element.innerHTML = '';
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }

        // Now insert the new text
        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, text);
        } catch (e) {
          // execCommand not available in some contexts
        }

        if (!inserted) {
          // Fallback: set text content
          element.textContent = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Ensure cursor is at the end after insertion
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          // Ignore selection errors in cross-origin context
        }
      }

      return true;
    } catch (error) {
      console.error('Error injecting text:', error);
      return false;
    }
  }

  function handleGoogleTextInjection(text, autoSubmit, providerMode) {
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

  // Sleep utility
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Unified Enter key dispatch for sending messages
  function pressEnter(element) {
    if (!element) return false;
    element.focus();
    const events = [
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
      new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
      new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })
    ];
    events.forEach(event => element.dispatchEvent(event));
    return true;
  }

  // Find input element for a provider and press Enter
  function pressEnterOnProviderInput(provider) {
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

  // Shadow DOM query helper functions
  function querySelectorDeep(selector, root = document) {
    // Try to find in current root element
    const element = root.querySelector(selector);
    if (element) return element;

    // Recursively search all shadow DOM
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        const found = querySelectorDeep(selector, el.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  function querySelectorAllDeep(selector, root = document) {
    const elements = [...root.querySelectorAll(selector)];
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        elements.push(...querySelectorAllDeep(selector, el.shadowRoot));
      }
    }
    return elements;
  }

  // Attempt auto-submit with retry logic.
  // If the send button is not ready (disabled or not found) on the first try,
  // retry with increasing delays so the AI's framework has time to process the
  // injected text and enable the send button.
  function hasExpectedYuanbaoText(expectedText) {
    const editor = document.querySelector('#searchbar-editor .ql-editor[contenteditable="true"], .ql-editor[contenteditable="true"]');
    if (!editor || typeof expectedText !== 'string') return false;

    return normalizeYuanbaoEditorText(editor.innerText) === normalizeYuanbaoEditorText(prepareYuanbaoInputText(expectedText));
  }

  function attemptAutoSubmitWithRetry(provider, providerMode, initialDelay, expectedText = null) {
    const RETRY_DELAYS = provider === 'metaso'
      ? [initialDelay, 1500, 2500, 4000, 5000]
      : [initialDelay, 1000, 2000, 3500];
    let attempt = 0;

    function trySubmit() {
      const delay = RETRY_DELAYS[attempt];
      attempt++;

      setTimeout(() => {
        if (provider === 'yuanbao' && !hasExpectedYuanbaoText(expectedText)) {
          console.warn('[Text Injection] Yuanbao editor has not committed the complete text - waiting for retry');
          if (attempt < RETRY_DELAYS.length) trySubmit();
          return;
        }
        if (provider === 'gemini' && !hasExpectedGeminiText(expectedText)) {
          console.warn('[Text Injection] Gemini editor has not committed the complete text - waiting for retry');
          if (attempt < RETRY_DELAYS.length) trySubmit();
          return;
        }
        const clicked = clickSendButton(provider, providerMode);
        if (clicked) {
                  } else if (attempt < RETRY_DELAYS.length) {
          console.warn('[Text Injection] Send button not ready for', provider, 'on attempt', attempt, '— will retry');
          trySubmit();
        } else {
          console.warn('[Text Injection] Failed to click send button for', provider, 'after all', RETRY_DELAYS.length, 'retry attempts');
        }
      }, delay);
    }

    trySubmit();
  }

  // Handle text injection message
  function handleTextInjection(event) {
    // Validate event data structure
    if (!event || !event.data || typeof event.data !== 'object') {
      return;
    }

    // Handle HEALTH_CHECK messages
    if (event.data.type === 'HEALTH_CHECK' && event.data.context === 'multi-panel') {
      const results = runHealthCheck();
      if ((window.__realParent__ || window.parent) !== window) {
        window.parent.postMessage({
          type: 'HEALTH_CHECK_RESULT',
          results,
          panelId: event.data.panelId,
          requestId: event.data.requestId,
          context: 'multi-panel-health'
        }, extensionOrigin);
      }
      return;
    }

    // Handle CLEAR_INPUT messages
    if (event.data.type === 'CLEAR_INPUT' && event.data.context === 'multi-panel') {
      const provider = detectProvider();
      stopMultiPanelUserInteractionTracking();
      if (provider === 'chatgpt') {
        stopChatgptSendTracking();
      }
      if (provider) {
        const providerMode = provider === 'google'
          ? normalizeGoogleProviderMode(event.data.providerMode)
          : null;

        if (provider === 'google') {
          clearGoogleInput(providerMode);
                    return;
        }

        const selectors = PROVIDER_SELECTORS[provider];
        for (const selector of selectors) {
          const element = findTextInputElement(selector);
          if (element) {
            const isTextarea = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';
            if (isTextarea) {
              setFormControlValue(element, '');
            } else {
              clearRichTextInput(provider, element);
            }
                        break;
          }
        }
      }
      return;
    }

    // Handle TRIGGER_SEND messages (send without injecting text)
    if (event.data.type === 'TRIGGER_SEND' && event.data.context === 'multi-panel') {
      const provider = detectProvider();
      if (provider) {
        const providerMode = provider === 'google'
          ? normalizeGoogleProviderMode(event.data.providerMode)
          : null;
        if (event.data.requestId) {
          startMultiPanelUserInteractionTracking(event.data.requestId, provider);
        } else {
          stopMultiPanelUserInteractionTracking();
        }
        if (provider === 'chatgpt' && event.data.requestId) {
          startChatgptSendTracking(event.data.requestId);
        }
                clickSendButton(provider, providerMode);
      }
      return;
    }

    // Handle NEW_CHAT messages (create new chat)
    if (event.data.type === 'NEW_CHAT' && event.data.context === 'multi-panel') {
      const provider = detectProvider();
      stopMultiPanelUserInteractionTracking();
      if (provider === 'chatgpt') {
        stopChatgptSendTracking();
      }
      const providerMode = provider === 'google'
        ? normalizeGoogleProviderMode(event.data.providerMode)
        : null;
                  if (provider) {
                clickNewChatButton(provider, providerMode);
      } else {
        console.warn('[Text Injection] Provider not detected for NEW_CHAT');
      }
      return;
    }

    // Handle NEW_CHAT_WHEN_READY messages (wait for button ready then create new chat)
    if (event.data.type === 'NEW_CHAT_WHEN_READY' && event.data.context === 'multi-panel') {
      const provider = detectProvider();
      if (provider === 'claude') {
        waitForNewChatButtonReady().then(ready => {
          if (ready) {
            clickNewChatButton('claude');
          } else {
            window.location.href = 'https://claude.ai/new';
          }
        });
      }
      return;
    }

    // Handle EXTRACT_ANSWER messages (collect AI responses from the page)
    if (event.data.type === 'EXTRACT_ANSWER' && event.data.context === 'multi-panel') {
      const provider = detectProvider();
      // SSE 文本和 DOM 提取都尝试，严格取更长的那个。千问的 SSE
      // 可能遗漏最后的结构化总结段，不能因为它达到 DOM 的一半就覆盖
      // 更完整的 DOM 提取结果。
      const sseText = sseAccumulatedText || '';
      const domText = extractLatestAnswer() || '';
      let answerText;
      if (sseText.length > domText.length && sseText.length > 50) {
        answerText = sseText;
              } else if (domText.length > 0) {
        answerText = domText;
              } else {
        answerText = sseText || domText;
              }
      // 清理引用标记等噪声
      if (answerText) {
        answerText = cleanCopyText(answerText);
      }
            if ((window.__realParent__ || window.parent) !== window) {
        postToExtensionParent({
          type: 'EXTRACTED_ANSWER',
          provider: provider,
          panelId: event.data.panelId,
          answer: answerText,
          requestId: event.data.requestId,
          context: 'multi-panel-answer'
        });
      }
      return;
    }

    // Only handle INJECT_TEXT messages
    if (event.data.type !== 'INJECT_TEXT') {
      return;
    }

    // Validate text payload
    const text = event.data.text;
    if (!text || typeof text !== 'string' || text.length === 0) {
      console.warn('[Text Injection] Invalid text payload');
      return;
    }

    // Sanity check: reject extremely large payloads (> 1MB)
    if (text.length > 1048576) {
      console.error('[Text Injection] Text payload too large:', text.length, 'bytes');
      return;
    }

    const autoSubmit = event.data.autoSubmit === true;
    const context = event.data.context;

    // Security check: Only allow autoSubmit from trusted contexts
    // This prevents other contexts from accidentally auto-submitting when
    // multi-panel sends messages to its iframes
    const shouldAutoSubmit = autoSubmit && (context === 'multi-panel' || context === 'auto-merge');

    const provider = detectProvider();
    const mergeRequestId = event.data.mergeRequestId;
    const injectionRequestId = event.data.injectionRequestId;
        if (!provider) {
      console.warn('Unknown provider, cannot inject text');
      if (mergeRequestId && window.parent !== window) {
        window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: false, injectSuccess: false, provider: null, error: 'unknown-provider' }, extensionOrigin);
      }
      postInjectionResult(injectionRequestId, null, false, false, 'unknown-provider');
      return;
    }

    const providerMode = provider === 'google'
      ? normalizeGoogleProviderMode(event.data.providerMode)
      : null;

    if (provider === 'chatgpt') {
      if (shouldAutoSubmit && event.data.requestId) {
        startMultiPanelUserInteractionTracking(event.data.requestId, provider);
        startChatgptSendTracking(event.data.requestId);
      } else {
        stopMultiPanelUserInteractionTracking();
        stopChatgptSendTracking();
      }
    } else if (shouldAutoSubmit && event.data.requestId) {
      startMultiPanelUserInteractionTracking(event.data.requestId, provider);
    } else {
      stopMultiPanelUserInteractionTracking();
    }

    if (provider === 'google') {
      const success = handleGoogleTextInjection(text, shouldAutoSubmit, providerMode);
      if (success) {
                postInjectionResult(injectionRequestId, provider, true, true);
        return;
      }

      console.warn('[Text Injection] Google editor not found on first try, retrying...');
      [500, 1000].forEach((delay, index, delays) => {
        setTimeout(() => {
          const retried = handleGoogleTextInjection(text, shouldAutoSubmit, providerMode);
          if (!retried && index === delays.length - 1) {
            console.error('[Text Injection] Google editor not found after retries');
            postInjectionResult(injectionRequestId, provider, false, false, 'editor-not-found-after-retry');
          } else if (retried) {
            postInjectionResult(injectionRequestId, provider, true, true);
          }
        }, delay);
      });
      return;
    }

    const selectors = PROVIDER_SELECTORS[provider];
    if (!selectors) {
      console.warn('No selectors configured for provider:', provider);
      return;
    }

    // Try each selector until we find an element
    let element = null;
    let matchedSelector = null;
    for (const selector of selectors) {
      element = findTextInputElement(selector);
      if (element) {
        matchedSelector = selector;
                break;
      }
    }

    if (element) {
      const success = injectTextIntoElement(element, text);
            if (mergeRequestId && window.parent !== window) {
        window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: true, injectSuccess: success, provider }, extensionOrigin);
      }
      postInjectionResult(injectionRequestId, provider, true, success, success ? null : 'injection-failed');
      if (success) {

        // Auto-submit if requested (only from multi-panel context)
        if (shouldAutoSubmit) {
          // Wait for UI to update, then click send button.
          // Use provider-specific delays whose composer state updates asynchronously,
          // matching the injectText() helper used by image injection.
          const delay = (provider === 'deepseek' || provider === 'kimi' || provider === 'doubao') ? 800 : (provider === 'qianwen' || provider === 'wenxin' || provider === 'metaso') ? 1500 : provider === 'gemini' ? 1200 : provider === 'yuanbao' ? 900 : 500;
          attemptAutoSubmitWithRetry(provider, providerMode, delay, text);
        }
      } else {
        console.error(`[Text Injection] Failed to inject text into ${provider}`);
      }
    } else {
      console.warn(`[Text Injection] ${provider} editor not found on first try, retrying...`);
      // Retry after a short delay in case page is still loading
      // Use multiple retries for DeepSeek
      const retryDelays = provider === 'deepseek' ? [1000, 2000] : [1000];

      retryDelays.forEach((delay, index) => {
        setTimeout(() => {
          let retryElement = null;
          let retrySelector = null;
          for (const selector of selectors) {
            retryElement = findTextInputElement(selector);
            if (retryElement) {
              retrySelector = selector;
                            break;
            }
          }
          if (retryElement) {
            const success = injectTextIntoElement(retryElement, text);
            if (success) {
                            if (shouldAutoSubmit) {
                const submitDelay = (provider === 'deepseek' || provider === 'kimi' || provider === 'doubao') ? 800 : (provider === 'qianwen' || provider === 'wenxin' || provider === 'metaso') ? 1500 : provider === 'yuanbao' ? 900 : 500;
                attemptAutoSubmitWithRetry(provider, providerMode, submitDelay, text);
              }
              postInjectionResult(injectionRequestId, provider, true, true);
            }
          } else if (index === retryDelays.length - 1) {
            console.error(`[Text Injection] ${provider} editor not found after ${retryDelays.length} retries`);
            console.error('[Text Injection] Available textareas:', document.querySelectorAll('textarea'));
            console.error('[Text Injection] Available contenteditable:', document.querySelectorAll('[contenteditable="true"]'));
            if (mergeRequestId && window.parent !== window) {
              window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: false, injectSuccess: false, provider, error: 'editor-not-found-after-retry' }, extensionOrigin);
            }
            postInjectionResult(injectionRequestId, provider, false, false, 'editor-not-found-after-retry');
          }
        }, delay);
      });
    }
  }

  // ===== Answer Extraction =====

  function extractText(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg').forEach(e => e.remove());
    return normalizeExtractedText(extractReadableText(clone));
  }

  function normalizeExtractedText(text) {
    return (text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  function appendTextPart(parts, text) {
    const normalized = (text || '').replace(/\s+/g, ' ').trim();
    if (normalized) parts.push(normalized);
  }

  function appendLineBreak(parts, forceBlankLine = false) {
    if (parts.length === 0) return;
    const last = parts[parts.length - 1];
    if (last === '\n\n') return;
    if (forceBlankLine) {
      if (last === '\n') parts[parts.length - 1] = '\n\n';
      else parts.push('\n\n');
      return;
    }
    if (last !== '\n') parts.push('\n');
  }

  function extractReadableText(node) {
    const parts = [];
    const blockTags = new Set([
      'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'DT', 'DD',
      'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5',
      'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION',
      'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
    ]);

    function walk(current) {
      if (!current) return;

      if (current.nodeType === Node.TEXT_NODE) {
        appendTextPart(parts, current.nodeValue);
        return;
      }

      if (current.nodeType !== Node.ELEMENT_NODE) return;

      const tag = current.tagName;
      if (tag === 'BR') {
        appendLineBreak(parts);
        return;
      }

      if (tag === 'HR') {
        appendLineBreak(parts, true);
        parts.push('---');
        appendLineBreak(parts, true);
        return;
      }

      if (tag === 'PRE' || tag === 'CODE') {
        const raw = current.textContent || '';
        if (raw.trim()) parts.push(raw);
        appendLineBreak(parts, tag === 'PRE');
        return;
      }

      if (/^H[1-6]$/.test(tag)) {
        appendLineBreak(parts, true);
        parts.push(`${'#'.repeat(Number(tag[1]))} `);
        for (const child of current.childNodes) {
          walk(child);
        }
        appendLineBreak(parts, true);
        return;
      }

      const isBlock = blockTags.has(tag);
      if (isBlock) appendLineBreak(parts);

      if (tag === 'LI') {
        const textBefore = parts.join('').trimEnd();
        if (!/(\n|^)[-*]\s*$/.test(textBefore)) {
          parts.push('- ');
        }
      }

      for (const child of current.childNodes) {
        walk(child);
      }

      if (isBlock) appendLineBreak(parts, tag !== 'LI');
    }

    walk(node);
    return parts.join('');
  }

  // Clean known noise patterns from extracted answer text
  function cleanCopyText(text) {
    const patterns = [
      /(?:\[]?\(?@?mark_underline=\d+\)?|\[citation:\d+\]|\[\])+/g,
      /<grok:render[^>]*>[\s\S]*?<\/grok:render>/g,
      /Request interrupted by user\s*/g,
      /以上内容为 AI 生成，不代表开发者立场，请勿删除或修改本标记\s*/g,
      /以上内容为 AI 生成，仅供参考，请仔细甄别\s*/g,
      /内容由AI生成，仅供参考\s*/g,
      /内容由 AI 生成，仅供/g,
      /内容由AI生成，请仔细甄别/g,
      /内容由 AI 生成，请仔细甄别/g,
      /NaN\/\s*/g,
      /Scroll to the (top|bottom)\s*/gi,
      /View.*sources?\s*/gi,
      /Ask follow-up\s*/gi,
      /[ \t]+$/gm,
      /\n{2,}/g,
    ];
    let cleaned = text;
    for (const p of patterns) {
      cleaned = cleaned.replace(p, '');
    }
    return cleaned.trim();
  }

  // 为 SSE 文本注入换行符（SSE 流式文本没有段落结构）
  function addLineBreaks(text) {
    if (!text) return text;
    return text
      // 中文句号/问号/感叹号 + 后续中文字符 → 加换行
      .replace(/([。！？])([一-鿿])/g, '$1\n$2')
      // 英文句号/问号/感叹号 + 空格 + 大写字母 → 加换行
      .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
      // 编号列表 (1. 2. 3. 或 1、2、3、) → 加换行
      .replace(/(\d+[.、])\s*/g, '\n$1 ')
      // 项目符号 → 加换行
      .replace(/([•·\-])\s+/g, '\n$1 ')
      // 清理多余空行
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  // ===== Direct Answer Selectors (Phase 1) =====
  const DIRECT_ANSWER_SELECTORS = {
    chatgpt: [
      '[data-message-author-role="assistant"] .markdown-body',
      '[data-message-author-role="assistant"]',
    ],
    claude: [
      '[data-message-role="assistant"]',
      '.font-claude-message',
    ],
    gemini: [
      '.model-response-text',
      'model-response .markdown-main-panel',
      'model-response .markdown',
      'model-response',
      '.response-content .markdown',
      '.markdown-main-panel',
      '[data-message-author-role="model"]',
    ],
    grok: [
      '.response-content-markdown',
      '.message-content .markdown-body',
      '[role="log"] .markdown-body',
    ],
    deepseek: [
      '.ds-assistant-message-main-content',
      '.ds-chat-message:not([class*="user"]):not([class*="system"])',
    ],
    // Kimi's current response container is .markdown-container. Completion
    // monitoring must use the same primary structure as its extractor;
    // otherwise answer growth is measured as zero and no auto-merge occurs.
    kimi: [
      '.markdown-container',
      '.markdown-container .markdown',
      '.markdown',
      '.kimi-message-content',
      '.message-list [class*="message"]'
    ],
    doubao: [
      '.md-box-root',
      '.container-qX9Csx.md-box-root',
      '.semi-chat-message-content',
      '.semi-chat-message',
    ],
    qianwen: ['.qk-markdown-complete', '#qk-markdown-react', '.qk-markdown'],
    zhipu: ['.markdown-body.md-body', '.markdown-body', '.content-markdown'],
    wenxin: ['.cosd-markdown-content', '.ai-entry-block.ai-markdown', '.custom-html.md-stream-desktop', '.md-stream-desktop', '.markdown-body'],
    metaso: ['[class*="result-responsive-layer"] .markdown-body'],
    google: ['.markdown-body'],
  };

  /**
   * Phase 1: Try direct answer selectors for the given provider.
   * Returns the LAST visible match's text (most recent answer).
   * Strips citation markers before extracting text.
   */
  function extractByDirectSelector(provider) {
    const selectors = DIRECT_ANSWER_SELECTORS[provider];
    if (!selectors) return null;

    for (const sel of selectors) {
      try {
        const elements = document.querySelectorAll(sel);
        for (let i = elements.length - 1; i >= 0; i--) {
          if (elements[i].closest('textarea, [contenteditable="true"], form, nav, aside, footer, [role="navigation"]')) continue;
          const clone = elements[i].cloneNode(true);
          clone.querySelectorAll(
            '.ds-markdown-cite, .ds-markdown-cite *, ' +
            '._2ed5dee, .options-item-Yv7oFR, ' +
            '.hyc-common-markdown__ref-list, .qk-md-has-multi-modal, ' +
            'script, style, sup, a[href] sup, ' +
            '[class*="citation"], [class*="reference"], [class*="footnote"], ' +
            'a[class*="cite"], [class*="options-item"]'
          ).forEach(el => el.remove());
          clone.querySelectorAll('svg').forEach(el => el.remove());
          const text = extractText(clone);
          if (text.length > 0) {
            return text;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  // ===== Copy Button Selectors (Phase 3) =====
  const COPY_BUTTON_SELECTORS = {
    chatgpt: [
      'button[aria-label="Copy"]',
      'button[data-testid="copy-button"]',
      'button[data-testid="copy"]',
      'button[class*="copy"]',
      'svg[class*="copy"]'
    ],
    claude: [
      'button[aria-label="Copy"]',
      'button[aria-label="复制"]',
      'button[class*="copy"]',
      'svg[class*="copy"]'
    ],
    gemini: [
      'button[aria-label="Copy"]',
      'button[aria-label="复制"]',
      'button[mattooltip="Copy"]',
      'button[mattooltip="复制"]',
      'button[class*="copy"]'
    ],
    grok: [
      'button[aria-label="Copy"]',
      'button[aria-label="复制"]',
      'button[class*="copy"]',
      'svg[class*="copy"]'
    ],
    deepseek: [
      'button[aria-label="Copy"]',
      'button[aria-label="复制"]',
      'button[class*="copy"]',
      '.ds-button[aria-label*="copy"]',
      '.ds-button[aria-label*="Copy"]',
      '.ds-chat-message-actions button'
    ],
    kimi: [
      'button[aria-label*="复制"]',
      'button[aria-label*="Copy"]',
      'span[class*="copy"]',
      'div[class*="copy"]',
      'svg[name="Copy"]',
      '[class*="copy-btn"]',
      '[class*="copyIcon"]'
    ],
    doubao: [
      'button[aria-label*="复制"]',
      'button[aria-label*="Copy"]',
      'span[class*="copy"]',
      'div[class*="copy"]',
      '.semi-button[aria-label*="复制"]',
      '.semi-button[aria-label*="Copy"]',
      '[class*="copy-btn"]'
    ],
    qianwen: [
      'button[aria-label*="复制"]',
      'button[aria-label*="Copy"]',
      'button[class*="copy"]',
      'span[class*="copy"]',
      'div[class*="copy"]',
      '[class*="copy-btn"]'
    ],
    zhipu: [
      'button[aria-label*="复制"]',
      'button[aria-label*="Copy"]',
      'button[aria-label*="copy"]',
      'span[aria-label*="复制"]',
      'div[aria-label*="复制"]',
      'span[class*="copy"]',
      'div[class*="copy"]',
      '[class*="copy-btn"]',
      '[class*="copyIcon"]',
      'button[class*="action"]'
    ],
    wenxin: [
      'button[aria-label*="复制"]',
      'button[aria-label*="Copy"]',
      'button[class*="copy"]',
      'span[class*="copy"]',
      'div[class*="copy"]',
      '[class*="copy-btn"]'
    ],
    metaso: [
      'button[aria-label*="复制"]',
      'button[aria-label*="Copy"]',
      'button[class*="copy"]',
      'span[class*="copy"]',
      'div[class*="copy"]',
      '[class*="copy-btn"]'
    ]
  };

  // Provider-specific answer selectors for copy button walking (Phase 3)
  const COPY_BUTTON_ANSWER_SELECTORS = {
    deepseek: ['.ds-assistant-message-main-content', '.ds-markdown'],
    kimi: ['.markdown-container', '.markdown-container .markdown', '.markdown', '.kimi-message-content', '.markdown-body', '[class*="message-content"]'],
    doubao: ['.semi-chat-message-content', '.markdown-body', '.semi-chat-message'],
    qianwen: ['.markdown-body', '[class*="markdown-body"]'],
    zhipu: ['.markdown-body', '.content-markdown', '[class*="markdown-body"]'],
    wenxin: ['.cosd-markdown-content', '.ai-entry-block.ai-markdown', '.markdown-body'],
    metaso: ['.markdown-body'],
    chatgpt: ['.markdown-body'],
    claude: ['.markdown-body'],
    gemini: ['.markdown-body'],
    grok: ['.response-content-markdown', '.markdown-body']
  };

  /**
   * Phase 3: Find copy button, walk up DOM, use provider-specific selectors scoped to container.
   */
  function extractByCopyButton(provider) {
    const btnSelectors = COPY_BUTTON_SELECTORS[provider];
    if (!btnSelectors) return null;

    const ansSel = COPY_BUTTON_ANSWER_SELECTORS[provider] || ['.markdown-body'];

    for (const btnSel of btnSelectors) {
      try {
        const btns = document.querySelectorAll(btnSel);
        for (const btn of btns) {
          let el = btn.parentElement;
          for (let depth = 0; depth < 10 && el; depth++) {
            for (const as of ansSel) {
              try {
                const matches = el.querySelectorAll(as);
                for (let i = matches.length - 1; i >= 0; i--) {
                  if (matches[i].contains(btn) || btn.contains(matches[i])) continue;
                  const t = extractText(matches[i]);
                  if (t.length > 0) {
                    return t;
                  }
                }
              } catch (_) {}
            }
            el = el.parentElement;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  function extractGenericMarkdownAnswer() {
    const bodies = document.querySelectorAll('.markdown-body');
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside, footer, [role="navigation"]')) continue;
      const text = extractText(bodies[i]);
      if (text.length > 0) {
        if (text.length > 50) return text;
      }
    }
    const logAreas = document.querySelectorAll('[role="log"], [role="region"]');
    for (let i = logAreas.length - 1; i >= 0; i--) {
      const text = extractText(logAreas[i]);
      if (text.length > 0) return text;
    }
    return '';
  }

  // Shared fallback extractors used by multiple provider extractors
  function extractFromRoleLog() {
    const logArea = document.querySelector('[role="log"]');
    if (!logArea) return '';
    const text = extractText(logArea);
    if (text.length > 0) return text;
    for (let i = logArea.children.length - 1; i >= 0; i--) {
      const childText = extractText(logArea.children[i]);
      if (childText.length > 0) return childText;
    }
    return '';
  }

  function extractFromRoleList() {
    const lists = document.querySelectorAll('[role="list"]');
    for (let i = lists.length - 1; i >= 0; i--) {
      const items = lists[i].querySelectorAll('[role="listitem"]');
      for (let j = items.length - 1; j >= 0; j--) {
        if (items[j].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
        const text = extractText(items[j]);
        if (text.length > 0) return text;
      }
    }
    return '';
  }

  // Expose shared utils for per-provider extractor files
  window.__aichatmerge_extractor_utils = {
    isVisibleElement,
    extractText,
    cleanCopyText,
    extractByDirectSelector,
    extractByCopyButton,
    extractGenericMarkdownAnswer,
    extractFromRoleLog,
    extractFromRoleList
  };

  function extractLatestAnswer() {
    const provider = detectProvider();
    const utils = window.__aichatmerge_extractor_utils;
    const extractors = window.__aichatmerge_extractors || {};

    // Phase 1: Try provider-specific extractor first (most precise)
    if (extractors[provider]) {
      try {
        const result = extractors[provider](utils);
        if (result) {
                    return result;
        }
              } catch (e) {
        console.warn('[Extract] Phase 1 error for', provider, e);
      }
    } else {
          }

    // Phase 2: Try direct answer selectors
    const directResult = extractByDirectSelector(provider);
    if (directResult) {
            return directResult;
    }

    // Phase 3: Try copy button approach
    const copyBtnResult = extractByCopyButton(provider);
    if (copyBtnResult) {
            return copyBtnResult;
    }

    // Phase 4: Generic markdown body
    const genericResult = extractGenericMarkdownAnswer();
        return genericResult;
  }

  // ===== Selector Health Check =====
  // Run diagnostics to check if selectors still find elements on the page.
  // Trigger via: postMessage({ type: 'HEALTH_CHECK', context: 'multi-panel' })
  function runHealthCheck() {
    const provider = detectProvider();
    if (!provider) {
      console.warn('[Health Check] Unknown provider');
      return { provider: null, status: 'unknown-provider' };
    }

    const results = { provider, input: [], send: [], extract: [], newChat: [] };

    // Check input selectors
    const inputSelectors = PROVIDER_SELECTORS[provider] || [];
    for (const sel of inputSelectors) {
      try {
        const el = document.querySelector(sel);
        results.input.push({ selector: sel, found: !!el, visible: el ? isVisibleElement(el) : false });
      } catch (e) {
        results.input.push({ selector: sel, error: e.message });
      }
    }

    // Check send button selectors
    const sendSelectors = SEND_BUTTON_SELECTORS[provider] || [];
    for (const sel of sendSelectors) {
      try {
        const el = document.querySelector(sel);
        results.send.push({ selector: sel, found: !!el, visible: el ? isVisibleElement(el) : false });
      } catch (e) {
        results.send.push({ selector: sel, error: e.message });
      }
    }

    // Check answer extraction selectors
    const directSelectors = DIRECT_ANSWER_SELECTORS[provider] || [];
    for (const sel of directSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        const visibleCount = [...els].filter(e => isVisibleElement(e)).length;
        results.extract.push({ selector: sel, count: els.length, visibleCount });
      } catch (e) {
        results.extract.push({ selector: sel, error: e.message });
      }
    }

    // Check provider-specific extractor
    const extractors = window.__aichatmerge_extractors || {};
    if (extractors[provider]) {
      try {
        const text = extractors[provider](window.__aichatmerge_extractor_utils);
        results.extract.push({ extractor: provider, returned: text.length > 0, length: text.length });
      } catch (e) {
        results.extract.push({ extractor: provider, error: e.message });
      }
    }

    // Check new chat button selectors
    const newChatSelectors = NEW_CHAT_BUTTON_SELECTORS[provider] || [];
    for (const sel of newChatSelectors) {
      try {
        const el = document.querySelector(sel);
        results.newChat.push({ selector: sel, found: !!el, visible: el ? isVisibleElement(el) : false });
      } catch (e) {
        results.newChat.push({ selector: sel, error: e.message });
      }
    }

    // Summary
    const hasInput = results.input.some(s => s.visible);
    const hasSend = results.send.some(s => s.visible);
    const hasExtract = results.extract.some(s => (s.visibleCount > 0) || (s.returned === true));

    results.summary = {
      inputOk: hasInput,
      sendOk: hasSend,
      extractOk: hasExtract,
      verdict: hasInput && hasSend ? (hasExtract ? 'OK' : 'EXTRACTION_NEEDED') : 'BROKEN'
    };

    console.group(`[Health Check] ${provider}`);
                        console.groupEnd();

    return results;
  }

  // ===== Completion Monitoring (Button-state primary + MutationObserver fallback) =====

  // Provider-specific stop button selectors
  const STOP_BUTTON_SELECTORS = {
    chatgpt: [
      'button[data-testid="stop-button"]',
      'button[aria-label="Stop"]',
      'button[aria-label="Stop generating"]'
    ],
    claude: [
      'button[aria-label="Stop Response"]',
      'button[aria-label="Stop"]',
      'button[aria-label*="stop"]',
      '[data-is-streaming]'
    ],
    gemini: [
      'button[aria-label="Stop"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="停止"]',
      'button[mattooltip="Stop"]',
      'button[mattooltip*="stop"]',
      'button[mattooltip*="停止"]'
    ],
    grok: [
      'button[aria-label="Stop"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="stop"]'
    ],
    deepseek: [
      'button[aria-label="Stop"]',
      'button[aria-label*="停止"]',
      '.ds-stop-button',
      'button[aria-label*="Stop"]',
      'button[class*="stop"]'
    ],
    kimi: [
      'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]',
      '[class*="stop"]',
      'svg[name="Stop"]'
    ],
    doubao: [
      'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]',
      '[class*="stop"]'
    ],
    google: [
      'button[aria-label="Stop"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="停止"]'
    ],
    qianwen: [
      'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]',
      '[class*="stop"]'
    ],
    zhipu: [
      'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]',
      '[class*="stop"]'
    ],
    wenxin: [
      'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]',
      '[class*="stop"]'
    ],
    yuanbao: [
      'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]',
      '[class*="stop"]'
    ],
    metaso: [
      'button[aria-label*="停止"]',
      'button[aria-label*="Stop"]',
      '[class*="stop"]'
    ]
  };

  let completionObserver = null;
  let completionStableTimer = null;
  let completionPhase = null;            // 'button-watch-appear' | 'button-watch-disappear' | 'mutation-fallback' | null
  let completionProvider = null;
  let completionButtonTimeout = null;    // timeout for falling back to MutationObserver
  let completionButtonObserver = null;   // MutationObserver watching for stop button DOM changes
  let completionAlreadyDetected = false; // prevent duplicate COMPLETION_DETECTED from SSE path
  let completionMergeSessionId = null;
  let completionMonitorDelayTimer = null; // delay before starting DOM fallback
  let completionDeepseekFallbackTimer = null; // DeepSeek answer-stability fallback
  let beforeunloadListenerAdded = false; // Issue 8: track whether beforeunload cleanup is registered

  // Issue 8: Clean up MutationObserver on page navigation to prevent leaked observers.
  function handleBeforeUnload() {
    stopCompletionMonitor();
  }

  // ===== SSE 文本累积 =====
  let sseAccumulatedText = '';  // 累积的 SSE 文本（仅正式内容，不含思考）
  let sseAccumulatedThink = ''; // 累积的思考文本

  function stopCompletionMonitor() {
    if (completionObserver) {
      completionObserver.disconnect();
      completionObserver = null;
    }
    if (completionStableTimer) {
      clearTimeout(completionStableTimer);
      completionStableTimer = null;
    }
    if (completionButtonTimeout) {
      clearTimeout(completionButtonTimeout);
      completionButtonTimeout = null;
    }
    if (completionButtonObserver) {
      completionButtonObserver.disconnect();
      completionButtonObserver = null;
    }
    if (completionMonitorDelayTimer) {
      clearTimeout(completionMonitorDelayTimer);
      completionMonitorDelayTimer = null;
    }
    if (completionDeepseekFallbackTimer) {
      clearTimeout(completionDeepseekFallbackTimer);
      completionDeepseekFallbackTimer = null;
    }
    completionPhase = null;
    completionProvider = null;
  }

  /**
   * Check if a stop button is currently visible on the page.
   */
  function isStopButtonPresent(provider) {
    const selectors = STOP_BUTTON_SELECTORS[provider];
    if (!selectors) return false;

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          // In extract mode (hidden iframes), check DOM existence only
          if (isExtractMode || isVisibleElement(el)) {
            return true;
          }
        }
      } catch (_) {}
    }

    return false;
  }

  /**
   * Phase 2 fallback: MutationObserver on the answer container.
   * Same logic as the original implementation.
   */
  function startMutationFallback(provider) {
    stopCompletionMonitor();
    completionProvider = provider;
    completionPhase = 'mutation-fallback';

    const selectors = DIRECT_ANSWER_SELECTORS[provider];
    if (!selectors || selectors.length === 0) {
      console.warn('[CompletionMonitor] No answer selectors for fallback:', provider);
      return;
    }

    // Do not observe only the previous answer element. Most providers append
    // the next answer as a sibling, so observing that old node misses a fast
    // new reply entirely. The observer watches the page body while getAnswerLen
    // below filters changes down to provider answer selectors.
    const targetNode = document.body || document.documentElement;
    if (!targetNode) {
      console.warn('[CompletionMonitor] No document root available for mutation fallback');
      return;
    }

    // Wenxin can pause between search, reasoning and final answer segments.
    // Its protocol-final SSE signal is preferred; 15 seconds is only the
    // fallback when that signal is unavailable.
    const STABLE_DELAY_MS = provider === 'wenxin' ? 15000 : provider === 'zhipu' ? 15000 : 10000;
    // A pre-existing answer must never be treated as the answer to the current
    // prompt.  Arm completion only after this monitoring session observes the
    // answer content change.
    let hasObservedAnswerChange = false;

    function notifyCompletion(reason) {
            stopCompletionMonitor();

      if (!completionAlreadyDetected && (window.__realParent__ || window.parent) !== window) {
        completionAlreadyDetected = true;
        postToExtensionParent({
          type: 'COMPLETION_DETECTED',
          provider,
          mergeSessionId: completionMergeSessionId,
          context: 'multi-panel-completion'
        });
      }
    }

    const resetStableTimer = () => {
      if (!hasObservedAnswerChange) return;
      if (completionStableTimer) {
        clearTimeout(completionStableTimer);
      }
      completionStableTimer = setTimeout(() => {
        let hasContent = false;
        for (const sel of selectors) {
          try {
            const elements = document.querySelectorAll(sel);
            for (const el of elements) {
              if (isExtractMode || isVisibleElement(el)) {
                const text = (el.textContent || '').trim();
                if (text.length > 0) {
                  hasContent = true;
                  break;
                }
              }
            }
          } catch (_) {}
          if (hasContent) break;
        }

        if (!hasContent) {
          resetStableTimer();
          return;
        }

        notifyCompletion(`MutationObserver fallback: answer stable for ${STABLE_DELAY_MS}ms.`);
      }, STABLE_DELAY_MS);
    };

    // Track answer content length — only reset stability timer when answer actually changes.
    // This prevents UI noise (button states, animations) from keeping the timer alive.
    let prevAnswerLen = -1;

    function getAnswerLen() {
      let len = 0;
      for (const sel of selectors) {
        try {
          const elements = document.querySelectorAll(sel);
          for (const el of elements) {
            if (isExtractMode || isVisibleElement(el)) {
              len += (el.textContent || '').trim().length;
            }
          }
        } catch (_) {}
      }
      return len;
    }

    // Initialize baseline
    prevAnswerLen = getAnswerLen();
    let kimiSawStopButton = provider === 'kimi' && isStopButtonPresent(provider);
    let kimiStopDisappearanceHandled = false;

    // DeepSeek stable fallback: if answer has been stable long enough with sufficient
    // length, report completion even if button-state detection missed it.
    if (provider === 'deepseek') {
      const DEEPSEEK_FALLBACK_STABLE_MS = 8000;
      const DEEPSEEK_MIN_ANSWER_LENGTH = 30;
      let deepseekFallbackLastLen = getAnswerLen();
      let deepseekFallbackLastChangeAt = Date.now();

      completionDeepseekFallbackTimer = setInterval(() => {
        const curLen = getAnswerLen();
        if (curLen !== deepseekFallbackLastLen) {
          deepseekFallbackLastChangeAt = Date.now();
          deepseekFallbackLastLen = curLen;
        }
        const stableMs = Date.now() - deepseekFallbackLastChangeAt;
        if (hasObservedAnswerChange && curLen >= DEEPSEEK_MIN_ANSWER_LENGTH &&
            stableMs >= DEEPSEEK_FALLBACK_STABLE_MS) {
          clearInterval(completionDeepseekFallbackTimer);
          completionDeepseekFallbackTimer = null;
          notifyCompletion(`DeepSeek answer stable for ${stableMs}ms (fallback).`);
        }
      }, 1500);
    }

    completionObserver = new MutationObserver(() => {
      const curLen = getAnswerLen();
      if (curLen !== prevAnswerLen) {
        // Answer content changed — AI still generating. Reset stability timer.
        prevAnswerLen = curLen;
        hasObservedAnswerChange = true;
        resetStableTimer();
      }
      // else: DOM mutated but answer unchanged (UI noise) — don't reset timer

      // Kimi's SSE final frame is not always observable. When its visible
      // stop button appeared during this response and then disappears, this
      // is a stronger completion signal than waiting the 10-second text
      // stability fallback. Re-check after a short settle window so the last
      // rendered segment is not lost.
      if (provider === 'kimi') {
        const stopButtonPresent = isStopButtonPresent(provider);
        if (stopButtonPresent) {
          kimiSawStopButton = true;
        } else if (kimiSawStopButton && !kimiStopDisappearanceHandled && hasObservedAnswerChange) {
          kimiStopDisappearanceHandled = true;
          if (completionStableTimer) {
            clearTimeout(completionStableTimer);
          }
          completionStableTimer = setTimeout(() => {
            if (isStopButtonPresent(provider)) {
              kimiStopDisappearanceHandled = false;
              return;
            }
            const latestAnswerLen = getAnswerLen();
            if (latestAnswerLen !== prevAnswerLen) {
              prevAnswerLen = latestAnswerLen;
              resetStableTimer();
              return;
            }
            notifyCompletion('Kimi stop button disappeared and answer settled for 800ms.');
          }, 800);
        }
      }
    });

    completionObserver.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true
    });

      }

  /**
   * Primary method: Button-state monitoring.
   *
   * Flow:
   *  1. Start watching for the stop button to appear (AI started generating).
   *  2. Once stop button appears, switch to watching for it to disappear (AI finished).
   *  3. When stop button disappears, send COMPLETION_DETECTED.
   *
   * If no stop button is detected within BUTTON_APPEAR_TIMEOUT_MS, fall back to
   * MutationObserver approach.
   */
  const BUTTON_APPEAR_TIMEOUT_MS = 20000;
  const BUTTON_DISAPPEAR_SETTLE_MS = 500;

  function startButtonStateMonitor(provider) {
    stopCompletionMonitor();
    completionProvider = provider;
    completionPhase = 'button-watch-appear';

    const stopSelectors = STOP_BUTTON_SELECTORS[provider];
    if (!stopSelectors || stopSelectors.length === 0) {
            startMutationFallback(provider);
      return;
    }

    // Helper: check and transition phases
    function evaluateButtonState() {
      const stopPresent = isStopButtonPresent(provider);

      if (completionPhase === 'button-watch-appear' && stopPresent) {
        // Stop button appeared — AI is now generating. Switch to watching for disappearance.
                completionPhase = 'button-watch-disappear';
        // Clear the appear-timeout since we found the button
        if (completionButtonTimeout) {
          clearTimeout(completionButtonTimeout);
          completionButtonTimeout = null;
        }
      }

      if (completionPhase === 'button-watch-disappear' && !stopPresent) {
        // Stop button gone — AI finished. Add a short settle delay then report completion.
        if (completionStableTimer) {
          clearTimeout(completionStableTimer);
        }
        completionStableTimer = setTimeout(() => {
          // Double-check: is the stop button still absent?
          if (isStopButtonPresent(provider)) {
            // It came back (maybe a new generation started). Re-enter watch-disappear.
            completionPhase = 'button-watch-disappear';
            evaluateButtonState();
            return;
          }

                    stopCompletionMonitor();

          if (!completionAlreadyDetected && (window.__realParent__ || window.parent) !== window) {
            completionAlreadyDetected = true;
            postToExtensionParent({
              type: 'COMPLETION_DETECTED',
              provider,
              mergeSessionId: completionMergeSessionId,
              context: 'multi-panel-completion'
            });
          }
        }, BUTTON_DISAPPEAR_SETTLE_MS);
      }
    }

    // Observe the entire body for button DOM changes (appear/disappear are structural changes)
    const observerTarget = document.body;
    if (observerTarget) {
      completionButtonObserver = new MutationObserver(() => {
        if (completionPhase !== 'button-watch-appear' && completionPhase !== 'button-watch-disappear') {
          return;
        }
        evaluateButtonState();
      });

      completionButtonObserver.observe(observerTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-label', 'data-testid', 'class', 'style', 'disabled', 'aria-disabled']
      });
    }

    // Immediate check — the stop button might already be visible (e.g., if we started
    // monitoring right when generation was already in progress).
    evaluateButtonState();

    // If we are still in the "appear" phase, set a timeout to fall back to MutationObserver.
    if (completionPhase === 'button-watch-appear') {
      completionButtonTimeout = setTimeout(() => {
        if (completionPhase !== 'button-watch-appear') {
          return; // Phase already changed — button was found
        }

                startMutationFallback(provider);
      }, BUTTON_APPEAR_TIMEOUT_MS);
    }

      }

  const SSE_SUPPORTED_PROVIDERS =
    window.ACM_SSE_COMPLETION_POLICY?.supportedProviders() || [];

  function acceptsSseCompletion(provider, layer) {
    return window.ACM_SSE_COMPLETION_POLICY?.accepts(provider, layer) === true;
  }

  function startCompletionMonitor(mergeSessionId) {
    stopCompletionMonitor();
    completionAlreadyDetected = false;
    completionMergeSessionId = mergeSessionId || null;

    const provider = detectProvider();
    if (!provider) {
      console.warn('[CompletionMonitor] Provider not detected');
      return;
    }

    // Wenxin, Zhipu, Kimi and DeepSeek may finish a fast response before the old
    // 3-second SSE grace period expired. Start their DOM observer now (before
    // text is injected) so it sees the entire answer change. Kimi previously
    // waited to observe a stop button that had already appeared and vanished,
    // leaving it stuck until the global timeout when its SSE final frame was
    // unavailable.
    if (provider === 'wenxin' || provider === 'zhipu' || provider === 'kimi' ||
        provider === 'gemini' || provider === 'deepseek') {
            startMutationFallback(provider);
      return;
    }

    if (SSE_SUPPORTED_PROVIDERS.includes(provider)) {
      // 延迟启动 DOM 检测：给 SSE 检测 3 秒时间
      // 如果 SSE 在 3 秒内完成，completionAlreadyDetected 会被设为 true，DOM 检测不会重复触发
            completionMonitorDelayTimer = setTimeout(() => {
        if (!completionAlreadyDetected) {
                    startButtonStateMonitor(provider);
        }
      }, 3000);
      return;
    }

    // Issue 8: Register beforeunload listener once to clean up observers on page navigation.
    // Prevents leaked MutationObservers if the page navigates away while monitoring is active.
    if (!beforeunloadListenerAdded) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      beforeunloadListenerAdded = true;
    }

    // Primary: Use button-state monitoring (more reliable)
    startButtonStateMonitor(provider);
  }

  // Listen for messages from the multi-panel host and SSE bridge
  window.addEventListener('message', (event) => {
    if (!event || !event.data || typeof event.data !== 'object') return;

    const isSameFrameSseMessage = event.source === window &&
      event.origin === window.location.origin &&
      ['__sse_text_reset__', '__sse_text__', '__sse_complete__'].includes(event.data.type);

    // Do not accept commands from an arbitrary page that embeds this provider.
    if (!isSameFrameSseMessage && !isTrustedExtensionParent(event)) {
      console.warn('[MessageHandler] Rejected message from an untrusted origin');
      return;
    }

    // SSE 文本重置：新对话开始时清空累积文本
    if (event.data.type === '__sse_text_reset__') {
      sseAccumulatedText = '';
      sseAccumulatedThink = '';
      return;
    }

    // SSE 文本累积：逐 chunk 累积正式内容
    if (event.data.type === '__sse_text__') {
      if (event.data.text) {
        if (event.data.isThink) {
          sseAccumulatedThink += event.data.text;
        } else {
          sseAccumulatedText += event.data.text;
        }
      }
      return;
    }

    // SSE检测完成：仅停止 DOM 监控。
    // 修复 #6：COMPLETION_DETECTED 的转发职责已统一由 sse-bridge.js 承担，
    // 此处不再重复转发，避免 parent 收到双重完成信号。
    if (event.data.type === '__sse_complete__') {
      const sseProvider = event.data.provider || detectProvider();
      if (!acceptsSseCompletion(sseProvider, event.data.layer)) {
                return;
      }
            stopCompletionMonitor();
      return;
    }

    if (event.data.type === 'MONITOR_COMPLETION' && event.data.context === 'multi-panel') {
      startCompletionMonitor(event.data.mergeSessionId);
      return;
    }

    if (event.data.type === 'STOP_MONITORING' && event.data.context === 'multi-panel') {
      stopCompletionMonitor();
      return;
    }

    // Delegate to existing handler
    handleTextInjection(event);
  });

  // ===== Dark Mode for Iframes =====
  (function initDarkMode() {
    const DARK_CSS = [
      'html { filter: invert(1) hue-rotate(180deg); }',
      'img, video, svg { filter: invert(1) hue-rotate(180deg); }',
      'code, pre { filter: invert(1) hue-rotate(180deg); }'
    ].join('\n');

    let styleEl = null;

    function applyDarkMode(isDark) {
      if (isDark && !styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'aichatmerge-dark-mode';
        styleEl.textContent = DARK_CSS;
        document.documentElement.appendChild(styleEl);
      } else if (!isDark && styleEl) {
        styleEl.remove();
        styleEl = null;
      }
    }

    function resolveTheme(settings) {
      const theme = settings.theme || 'auto';
      if (theme === 'dark') return true;
      if (theme === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Initial apply
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get({ theme: 'auto' }, (settings) => {
        applyDarkMode(resolveTheme(settings));
      });

      // Listen for theme changes from the multi-panel page
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.theme) {
          chrome.storage.sync.get({ theme: 'auto' }, (settings) => {
            applyDarkMode(resolveTheme(settings));
          });
        }
      });
    }

    // Listen for system theme changes (auto mode)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get({ theme: 'auto' }, (settings) => {
          if (settings.theme === 'auto') {
            applyDarkMode(resolveTheme(settings));
          }
        });
      }
    });
  })();

  initMetasoSidebarAutoCollapse();
})();
