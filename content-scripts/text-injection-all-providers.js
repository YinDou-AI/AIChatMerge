// Text injection handler for all AI providers
// Self-contained script without module imports (for iframe compatibility)

(function() {
  'use strict';

  const GOOGLE_PROVIDER_MODE_AI = 'ai';
  const GOOGLE_PROVIDER_MODE_SEARCH = 'search';
  const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = 'multi-panel-provider-status';
  const PANELIZE_PROVIDER_BUSY = 'PANELIZE_PROVIDER_BUSY';
  const PANELIZE_PROVIDER_IDLE = 'PANELIZE_PROVIDER_IDLE';
  const PANELIZE_PROVIDER_USER_INTERACTION = 'PANELIZE_PROVIDER_USER_INTERACTION';
  const PANELIZE_TEMP_CHAT_ENABLED = 'PANELIZE_TEMP_CHAT_ENABLED';
  const CHATGPT_STOP_BUTTON_SELECTOR = 'button[data-testid="stop-button"]';
  const CHATGPT_SEND_TRACKING_IDLE_DELAY_MS = 800;
  const CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS = 2000;
  const MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS = 90000;
  const TEMP_CHAT_POLL_INTERVAL_MS = 200;
  const TEMP_CHAT_POLL_TIMEOUT_MS = 1200;
  let googleSearchReplaceOnNextFill = true;
  let chatgptSendTracking = null;
  let multiPanelUserInteractionTracking = null;

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
    // yuanbao: [
    //   '.ql-editor[contenteditable="true"]',
    //   '.ql-editor',
    //   'textarea[placeholder*="输入"]',
    //   'textarea[placeholder*="提问"]',
    //   'textarea',
    //   '[contenteditable="true"]'
    // ],
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

  // Provider image support configuration
  const PROVIDER_IMAGE_SUPPORT = {
    chatgpt: true,
    claude: true,
    gemini: true,
    grok: true,
    deepseek: true,
    kimi: true,  // Kimi supports images
    doubao: true,
    google: true,  // Google AI Mode supports images
    qianwen: false,
    zhipu: false,
    wenxin: false,
    // yuanbao: false,
    metaso: false
  };

  // Provider-specific file input selectors for image upload
  const FILE_INPUT_SELECTORS = {
    chatgpt: ['input[type="file"][data-testid="file-upload-input"]', 'input[type="file"]'],
    claude: ['input[type="file"]'],
    gemini: ['input[type="file"]'],
    grok: ['input[type="file"]'],
    deepseek: ['input[type="file"]'],
    kimi: ['input[type="file"]'],
    doubao: ['input[type="file"]'],
    google: ['input[type="file"]'],
    qianwen: ['input[type="file"]'],
    zhipu: ['input[type="file"]'],
    wenxin: ['input[type="file"]'],
    // yuanbao: ['input[type="file"]'],
    metaso: ['input[type="file"]']
  };

  // Provider-specific upload button selectors (to click before file input)
  const UPLOAD_BUTTON_SELECTORS = {
    chatgpt: ['button[aria-label="Attach files"]', 'button[data-testid="composer-attach-button"]', 'button:has(svg path[d*="M9"])'],
    claude: ['button[aria-label="Attach file"]', 'button[aria-label="Upload file"]', 'fieldset button:has(svg)'],
    gemini: ['button[aria-label="Upload file"]', 'button[mattooltip="Upload file"]', '.add-button', 'button:has(mat-icon)'],
    grok: [],
    deepseek: [],
    kimi: [],  // Kimi supports drag-drop for images
    doubao: [
      '#input-engine-container button[data-slot="dropdown-menu-trigger"][aria-haspopup="menu"]'
    ],
    google: [
      'button[aria-label="更多输入项"]',
      'button[aria-label="Upload image"]',
      'button[aria-label="上传图片"]',
      'button[aria-label="上传文件"]',
      'button[aria-label="Add image"]',
      'button[aria-label="Upload image"]',
      'button[aria-label="Add"]',
      'button[title="Add image"]',
      'button[title="Upload image"]',
      'button[data-xid*="image"]',
      'button[data-xid*="upload"]'
    ]
  };

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
    // yuanbao: [
    //   'button[aria-label="Send"]',
    //   'button[aria-label="发送"]',
    //   'button[aria-label="发送消息"]',
    //   'button[type="submit"]',
    //   'button[class*="send"]'
    // ],
    metaso: [
      'button[type="submit"]',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      'button[class*="search"]',
      'button[class*="submit"]'
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
    // yuanbao: [
    //   'button[aria-label*="新"]',
    //   'a[href="/chat/"]',
    //   'button[aria-label*="New"]'
    // ],
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
    wenxin: 'https://yiyan.baidu.com/',
    // yuanbao: 'https://yuanbao.tencent.com/chat/',
    metaso: 'https://metaso.cn/chat/2062455376112967681'
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
    } else if (hostname.includes('yiyan.baidu.com')) {
      return 'wenxin';
    // } else if (hostname.includes('yuanbao.tencent.com')) {
    //   return 'yuanbao';
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
    element.dispatchEvent(pasteEvent);

    // Also try insertText as fallback
    try {
      document.execCommand('insertText', false, text);
    } catch (e) {}

    return true;
  }

  let isExtractMode = false;

  window.addEventListener('message', (event) => {
    if (event?.data?.type === 'SET_EXTRACT_MODE') {
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
    }, '*');
  }

  function postTemporaryChatEnabled(provider = detectProvider()) {
    if (!provider || window.parent === window) {
      return;
    }

    window.parent.postMessage({
      type: PANELIZE_TEMP_CHAT_ENABLED,
      provider,
      context: MULTI_PANEL_PROVIDER_STATUS_CONTEXT
    }, '*');
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
        PANELIZE_PROVIDER_USER_INTERACTION,
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
      postMultiPanelProviderStatus(PANELIZE_PROVIDER_IDLE, requestId, phase, 'chatgpt');
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
        postMultiPanelProviderStatus(PANELIZE_PROVIDER_BUSY, tracking.requestId, tracking.phase, 'chatgpt');
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

  function findGoogleFileInput() {
    const fileInputs = querySelectorAllDeep('input[type="file"]');
    let fallbackInput = null;

    for (const input of fileInputs) {
      const accept = (input.getAttribute('accept') || '').toLowerCase();
      if (accept && accept.includes('image') && !accept.includes('.pdf') && !accept.includes('application/pdf')) {
        return input;
      }

      if (!fallbackInput && (!accept || accept.includes('image') || accept.includes('*'))) {
        fallbackInput = input;
      }
    }

    return fallbackInput;
  }

  async function openGoogleImagePicker() {
    const uploadButton = findDeepFirstVisibleElement(UPLOAD_BUTTON_SELECTORS.google);
    if (uploadButton) {
      uploadButton.click();
      await sleep(150);
    }

    let fileInput = findGoogleFileInput();
    if (fileInput) {
      return fileInput;
    }

    const imageMenuAction = findDeepClickableElementByKeywords([
      '更多输入项',
      'add image',
      'upload image',
      'upload file',
      'image',
      'photo',
      '上传图片',
      '上传文件',
      '图片',
      '照片',
      '图像'
    ]);

    if (imageMenuAction) {
      imageMenuAction.click();
      await sleep(150);
    }

    fileInput = findGoogleFileInput();
    if (fileInput) {
      return fileInput;
    }

    const addAction = findDeepClickableElementByKeywords([
      'add',
      'attach',
      'plus',
      '添加',
      '附件'
    ]);

    if (addAction) {
      addAction.click();
      await sleep(150);
    }

    return findGoogleFileInput();
  }

  function assignFilesToInput(fileInput, files) {
    if (!fileInput || !files || files.length === 0) {
      return false;
    }

    try {
      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;
      return true;
    } catch (error) {
      try {
        Object.defineProperty(fileInput, 'files', {
          configurable: true,
          value: files
        });
        return true;
      } catch (fallbackError) {
        console.error('[Image Injection] Failed to assign files to input:', fallbackError);
        return false;
      }
    }
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

  // Find and click send button
  function clickSendButton(provider, providerMode = null) {
    if (provider === 'google') {
      return clickGoogleSendButton(providerMode);
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
        console.log('[Text Injection] Doubao ButtonFinderUtils found send button, enabled:', enabled);
        if (enabled) {
          sendButton.click();
          return true;
        }
      } else {
        console.log('[Text Injection] Doubao ButtonFinderUtils: no send button found');
      }
    }

    // For qianwen and wenxin: try Enter key first (like 群问AI)
    if (provider === 'qianwen' || provider === 'wenxin') {
      console.log('[Text Injection] Trying Enter key first for', provider);
      if (pressEnterOnProviderInput(provider)) {
        return true;
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
            if (isElementEnabled(targetElement)) {
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
      console.log('[Text Injection] Send button disabled for', provider, '- trying Enter key');
      if (pressEnterOnProviderInput(provider)) {
        return true;
      }
    }

    // Fallback: press Enter on provider input
    console.log('[Text Injection] Send button not found, trying Enter key for', provider);
    if (pressEnterOnProviderInput(provider)) {
      return true;
    }

    console.warn('[Text Injection] Send button not found or disabled for:', provider);
    return false;
  }

  // Special handler for Google to create "new search"
  function handleGoogleNewSearch(mode) {
    const normalizedMode = normalizeGoogleProviderMode(mode);
    console.log('[Text Injection] Handling Google new search for mode:', normalizedMode);
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
      console.log('[Temporary Chat] Provider does not support temporary chat:', provider);
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

    console.log('[Temporary Chat] Temporary chat control not found for provider:', provider);
    return false;
  }

  // Find and click new chat button
  function clickNewChatButton(provider, providerMode = null) {
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

  // ===== Image Injection Functions =====

  // Helper function to inject text into provider's input field
  function injectText(provider, text, autoSubmit, providerMode = null) {
    if (provider === 'google') {
      return handleGoogleTextInjection(text, autoSubmit, providerMode);
    }

    const selectors = PROVIDER_SELECTORS[provider];
    if (!selectors) {
      console.warn('[Text Injection] No selectors for provider:', provider);
      return false;
    }

    for (const selector of selectors) {
      const element = findTextInputElement(selector);
      if (element) {
        const success = injectTextIntoElement(element, text);
        if (success) {
          console.log('[Text Injection] Text injected via injectText helper for', provider);
          if (autoSubmit) {
            // Use longer delay for providers whose composer state updates asynchronously
            const delay = (provider === 'deepseek' || provider === 'kimi' || provider === 'doubao') ? 800 : (provider === 'qianwen' || provider === 'wenxin') ? 1500 : 500;
            setTimeout(() => clickSendButton(provider, providerMode), delay);
          }
          return true;
        }
      }
    }

    console.warn('[Text Injection] No input element found for provider:', provider);
    return false;
  }

  // Handle image injection message
  async function handleImageInjection(event) {
    const { text, images, autoSubmit, requestId } = event.data;
    const provider = detectProvider();
    const providerMode = provider === 'google'
      ? normalizeGoogleProviderMode(event.data.providerMode)
      : null;

    if (!provider) {
      console.warn('[Image Injection] Provider not detected');
      return;
    }

    if (provider === 'google' && providerMode === GOOGLE_PROVIDER_MODE_SEARCH) {
      console.warn('[Image Injection] Google Search mode does not support image injection, falling back to text only');
      if (text && text.trim()) {
        handleGoogleTextInjection(text, autoSubmit, providerMode);
      }
      return;
    }

    if (!PROVIDER_IMAGE_SUPPORT[provider]) {
      console.warn('[Image Injection] Provider does not support images:', provider);
      // For providers that don't support images, just inject text
      if (text) {
        injectText(provider, text, autoSubmit, providerMode);
      }
      return;
    }

    if (!images || images.length === 0) {
      console.warn('[Image Injection] No images provided');
      return;
    }

    console.log(`[Image Injection] Injecting ${images.length} images to ${provider}`);

    try {
      if (autoSubmit && requestId) {
        startMultiPanelUserInteractionTracking(requestId, provider);
      } else {
        stopMultiPanelUserInteractionTracking();
      }

      if (provider === 'chatgpt' && autoSubmit && requestId) {
        startChatgptSendTracking(requestId);
      }

      const imageInjectionResults = [];

      // Inject images first
      for (const image of images) {
        imageInjectionResults.push(await injectSingleImage(provider, image));
        // Wait a bit between images
        await sleep(200);
      }

      const allImagesInjected = imageInjectionResults.every(Boolean);
      if (!allImagesInjected) {
        console.warn('[Image Injection] One or more images failed to inject for:', provider);
      }

      // Wait for images to upload
      await sleep(500);

      // Then inject text if provided
      if (text && text.trim()) {
        await sleep(300);
        injectText(provider, text, autoSubmit && allImagesInjected, providerMode);
      } else if (autoSubmit) {
        if (!allImagesInjected) {
          console.warn('[Image Injection] Skipping auto-submit because image injection failed for:', provider);
          return;
        }
        // If no text but autoSubmit is true, click send button
        await sleep(300);
        clickSendButton(provider, providerMode);
      }
    } catch (error) {
      console.error('[Image Injection] Error:', error);
    }
  }

  // Inject a single image to the provider using provider-specific strategy
  async function injectSingleImage(provider, imageData) {
    console.log('[Image Injection] Injecting image to', provider);

    // Use provider-specific strategies
    switch (provider) {
      case 'chatgpt':
        return await injectImageToChatGPT(imageData);
      case 'claude':
        return await injectImageToClaude(imageData);
      case 'gemini':
        return await injectImageToGemini(imageData);
      case 'grok':
      case 'deepseek':
        // These work with drag-drop
        return await tryDragDropUpload(provider, imageData);
      case 'doubao':
        return await injectImageToDoubao(imageData);
      case 'google':
        return await injectImageToGoogle(imageData);
      default:
        // Fallback: try file input first, then drag-drop
        if (await tryFileInputUpload(provider, imageData)) {
          return true;
        }
        return await tryDragDropUpload(provider, imageData);
    }
  }

  // ChatGPT-specific image injection
  async function injectImageToChatGPT(imageData) {
    try {
      // ChatGPT: find and use file input directly
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        const blob = await dataUrlToBlob(imageData.dataUrl);
        const file = new File([blob], imageData.name, { type: imageData.type });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[Image Injection] ChatGPT: File input triggered');
        return true;
      }
      console.warn('[Image Injection] ChatGPT: No file input found');
      return false;
    } catch (error) {
      console.error('[Image Injection] ChatGPT error:', error);
      return false;
    }
  }

  // Claude-specific image injection
  async function injectImageToClaude(imageData) {
    try {
      // Claude: find the file input (it's usually hidden)
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        const blob = await dataUrlToBlob(imageData.dataUrl);
        const file = new File([blob], imageData.name, { type: imageData.type });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[Image Injection] Claude: File input triggered');
        return true;
      }

      // Try clicking the attachment button first
      const attachBtnSelectors = UPLOAD_BUTTON_SELECTORS.claude;
      for (const selector of attachBtnSelectors) {
        const btn = document.querySelector(selector);
        if (btn) {
          btn.click();
          await sleep(300);
          // Now try to find and use the file input
          const input = document.querySelector('input[type="file"]');
          if (input) {
            const blob = await dataUrlToBlob(imageData.dataUrl);
            const file = new File([blob], imageData.name, { type: imageData.type });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[Image Injection] Claude: File input triggered after button click');
            return true;
          }
        }
      }

      console.warn('[Image Injection] Claude: No file input found');
      return false;
    } catch (error) {
      console.error('[Image Injection] Claude error:', error);
      return false;
    }
  }

  // Gemini-specific image injection
  async function injectImageToGemini(imageData) {
    try {
      console.log('[Image Injection] Gemini: Starting image injection');

      // Strategy: Simulate paste event with image
      // Find the editor (Quill editor or contenteditable)
      const editorSelectors = ['.ql-editor', '[contenteditable="true"]', 'div[contenteditable]'];
      let editor = null;
      
      for (const selector of editorSelectors) {
        editor = querySelectorDeep(selector);
        if (editor) {
          console.log('[Image Injection] Gemini: Found editor:', selector);
          break;
        }
      }
      
      if (!editor) {
        console.warn('[Image Injection] Gemini: Editor not found');
        return false;
      }

      // Convert dataUrl to blob
      const blob = await dataUrlToBlob(imageData.dataUrl);
      const file = new File([blob], imageData.name, { type: imageData.type });
      
      // Create DataTransfer for clipboard data
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // Focus the editor first
      editor.focus();
      
      // Simulate paste event with the image
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      
      editor.dispatchEvent(pasteEvent);
      console.log('[Image Injection] Gemini: Paste event dispatched');
      
      // Also try drag-drop as fallback if paste doesn't work
      await sleep(100);
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });
      editor.dispatchEvent(dropEvent);
      console.log('[Image Injection] Gemini: Drop event dispatched');
      
      return true;
    } catch (error) {
      console.error('[Image Injection] Gemini error:', error);
      return false;
    }
  }

  // Google AI Mode image injection
  async function injectImageToGoogle(imageData) {
    try {
      let fileInput = findGoogleFileInput();
      if (!fileInput) {
        fileInput = await openGoogleImagePicker();
      }

      if (fileInput) {
        const blob = await dataUrlToBlob(imageData.dataUrl);
        const file = new File([blob], imageData.name, { type: imageData.type });
        const assigned = assignFilesToInput(fileInput, [file]);
        if (!assigned) {
          return false;
        }
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[Image Injection] Google: File input triggered');
        return true;
      }
      console.warn('[Image Injection] Google: No file input found');
      return false;
    } catch (error) {
      console.error('[Image Injection] Google error:', error);
      return false;
    }
  }

  async function injectImageToDoubao(imageData) {
    try {
      const blob = await dataUrlToBlob(imageData.dataUrl);
      const file = new File([blob], imageData.name, { type: imageData.type });

      for (let attempt = 0; attempt < 3; attempt++) {
        let fileInput = await waitForDoubaoFileInput(500);

        if (!fileInput) {
          const uploadButton = findDeepFirstVisibleElement(UPLOAD_BUTTON_SELECTORS.doubao) ||
            findFirstVisibleElement(UPLOAD_BUTTON_SELECTORS.doubao);

          if (uploadButton) {
            uploadButton.click();
            await sleep(200);
            fileInput = await waitForDoubaoFileInput(800);
          }
        }

        if (!fileInput) {
          console.warn('[Image Injection] Doubao: No file input found on attempt', attempt + 1);
          continue;
        }

        const assigned = assignFilesToInput(fileInput, [file]);
        if (!assigned) {
          await sleep(200);
          continue;
        }

        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        const uploadAccepted = await waitForDoubaoImagePreview(1200);

        if (uploadAccepted) {
          console.log('[Image Injection] Doubao: Image preview detected');
          return true;
        }

        console.warn('[Image Injection] Doubao: Upload did not produce an image preview');
        return false;
      }

      console.warn('[Image Injection] Doubao: Upload did not produce a preview after retries');
      return false;
    } catch (error) {
      console.error('[Image Injection] Doubao error:', error);
      return false;
    }
  }

  async function waitForDoubaoFileInput(timeoutMs = 800) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const fileInput = document.querySelector('#input-engine-container input[type="file"]') ||
        document.querySelector('input[type="file"]');

      if (fileInput) {
        return fileInput;
      }

      await sleep(100);
    }

    return null;
  }

  function hasDoubaoImagePreview() {
    return Boolean(
      document.querySelector('.semi-image-preview-group') ||
      document.querySelector('#input-engine-container img[src^="blob:"]') ||
      document.querySelector('#input-engine-container img[src*="blob:"]')
    );
  }

  async function waitForDoubaoImagePreview(timeoutMs = 1200) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (hasDoubaoImagePreview()) {
        return true;
      }

      await sleep(100);
    }

    return false;
  }

  // Try to upload image via drag-drop event (works for Grok, DeepSeek)
  async function tryDragDropUpload(provider, imageData) {
    try {
      const selectors = PROVIDER_SELECTORS[provider];
      let targetElement = null;

      for (const selector of selectors) {
        targetElement = findTextInputElement(selector);
        if (targetElement) break;
      }

      if (!targetElement) {
        console.warn('[Image Injection] No target element found for drag-drop');
        return false;
      }

      // Convert dataUrl to blob
      const blob = await dataUrlToBlob(imageData.dataUrl);

      // Create File object from blob
      const file = new File([blob], imageData.name, { type: imageData.type });

      // Create DataTransfer with file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Focus the element first
      targetElement.focus();

      // Dispatch drag events sequence
      const dragEnterEvent = new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });

      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });

      targetElement.dispatchEvent(dragEnterEvent);
      targetElement.dispatchEvent(dragOverEvent);
      targetElement.dispatchEvent(dropEvent);

      return true;
    } catch (error) {
      console.error('[Image Injection] Drag-drop upload failed:', error);
      return false;
    }
  }

  // Fallback: Try to upload image via file input
  async function tryFileInputUpload(provider, imageData) {
    try {
      const fileInputSelectors = FILE_INPUT_SELECTORS[provider] || [];

      // First try specific selectors
      let fileInput = null;
      for (const selector of fileInputSelectors) {
        fileInput = document.querySelector(selector);
        if (fileInput) break;
      }

      // If no direct file input, try to find any file input
      if (!fileInput) {
        const allFileInputs = document.querySelectorAll('input[type="file"]');
        for (const input of allFileInputs) {
          if (!input.accept || input.accept.includes('image') || input.accept.includes('*')) {
            fileInput = input;
            break;
          }
        }
      }

      if (!fileInput) {
        console.warn('[Image Injection] No file input found');
        return false;
      }

      // Convert dataUrl to blob
      const blob = await dataUrlToBlob(imageData.dataUrl);

      // Create File object
      const file = new File([blob], imageData.name, { type: imageData.type });

      // Create FileList-like object
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;

      // Trigger change event
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      return true;
    } catch (error) {
      console.error('[Image Injection] File input upload failed:', error);
      return false;
    }
  }

  // Convert data URL to Blob
  function dataUrlToBlob(dataUrl) {
    return new Promise((resolve, reject) => {
      try {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        resolve(new Blob([u8arr], { type: mime }));
      } catch (error) {
        reject(error);
      }
    });
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
  function attemptAutoSubmitWithRetry(provider, providerMode, initialDelay) {
    const RETRY_DELAYS = [initialDelay, 1000, 2000, 3500];
    let attempt = 0;

    function trySubmit() {
      const delay = RETRY_DELAYS[attempt];
      attempt++;

      setTimeout(() => {
        console.log('[Text Injection] Auto-submit attempt', attempt, 'for', provider, 'delay:', delay);
        const clicked = clickSendButton(provider, providerMode);
        if (clicked) {
          console.log('[Text Injection] Send button clicked for', provider, 'on attempt', attempt);
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
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'HEALTH_CHECK_RESULT',
          results,
          panelId: event.data.panelId,
          context: 'multi-panel-health'
        }, '*');
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
          console.log('[Text Injection] Input cleared for', provider, 'mode:', providerMode);
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
            console.log('[Text Injection] Input cleared for', provider);
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
        console.log('[Text Injection] Triggering send for', provider);
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
      console.log('[Text Injection] NEW_CHAT message received, provider:', provider);
      console.log('[Text Injection] Current URL:', window.location.href);
      if (provider) {
        console.log('[Text Injection] Creating new chat for', provider);
        clickNewChatButton(provider, providerMode);
      } else {
        console.warn('[Text Injection] Provider not detected for NEW_CHAT');
      }
      return;
    }

    if (event.data.type === 'ENABLE_TEMP_CHAT' && event.data.context === 'multi-panel') {
      const provider = detectProvider();
      if (provider) {
        void enableTemporaryChat(provider);
      }
      return;
    }

    // Handle INJECT_TEXT_WITH_IMAGES messages
    if (event.data.type === 'INJECT_TEXT_WITH_IMAGES' && event.data.context === 'multi-panel') {
      handleImageInjection(event);
      return;
    }

    // Handle EXTRACT_ANSWER messages (collect AI responses from the page)
    if (event.data.type === 'EXTRACT_ANSWER' && event.data.context === 'multi-panel') {
      const provider = detectProvider();
      const answerText = extractLatestAnswer();
      console.log('[TextInjection] EXTRACT_ANSWER received. provider:', provider, 'answer length:', answerText ? answerText.length : 0);
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'EXTRACTED_ANSWER',
          provider: provider,
          panelId: event.data.panelId,
          answer: answerText,
          requestId: event.data.requestId,
          context: 'multi-panel-answer'
        }, '*');
      }
      return;
    }

    // Handle EXTRACT_DEBUG messages (diagnostic: return phase-by-phase results)
    if (event.data.type === 'EXTRACT_DEBUG' && event.data.context === 'multi-panel') {
      const provider = detectProvider();
      const utils = window.__panelize_extractor_utils;
      const extractors = window.__panelize_extractors || {};
      const debug = { provider, phases: [] };

      // Phase 1
      const d1 = extractByDirectSelector(provider);
      debug.phases.push({ phase: 1, name: 'direct-selector', hit: !!d1, len: d1 ? d1.length : 0 });
      // Phase 2
      if (extractors[provider]) {
        try {
          const d2 = extractors[provider](utils);
          debug.phases.push({ phase: 2, name: 'provider-extractor', hit: !!d2, len: d2 ? d2.length : 0 });
        } catch (e) {
          debug.phases.push({ phase: 2, name: 'provider-extractor', error: e.message });
        }
      } else {
        debug.phases.push({ phase: 2, name: 'provider-extractor', skipped: true });
      }
      // Phase 3
      const d3 = extractByCopyButton(provider);
      debug.phases.push({ phase: 3, name: 'copy-button', hit: !!d3, len: d3 ? d3.length : 0 });
      // Phase 4
      const d4 = extractGenericMarkdownAnswer();
      debug.phases.push({ phase: 4, name: 'generic-markdown', hit: !!d4, len: d4 ? d4.length : 0 });

      if (window.parent !== window) {
        window.parent.postMessage({ type: 'EXTRACT_DEBUG_RESULT', provider, debug, context: 'multi-panel-debug' }, '*');
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
    console.log('[Text Injection] INJECT_TEXT received. provider:', provider, 'context:', context, 'autoSubmit:', autoSubmit, 'textLength:', text.length, 'mergeRequestId:', mergeRequestId);
    if (!provider) {
      console.warn('Unknown provider, cannot inject text');
      if (mergeRequestId && window.parent !== window) {
        window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: false, injectSuccess: false, provider: null, error: 'unknown-provider' }, '*');
      }
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
        console.log('[Text Injection] Text injected into Google using mode:', providerMode);
        return;
      }

      console.warn('[Text Injection] Google editor not found on first try, retrying...');
      [500, 1000].forEach((delay, index, delays) => {
        setTimeout(() => {
          const retried = handleGoogleTextInjection(text, shouldAutoSubmit, providerMode);
          if (!retried && index === delays.length - 1) {
            console.error('[Text Injection] Google editor not found after retries');
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
        console.log('[Text Injection] Found input element with selector:', selector, 'for provider:', provider, 'tagName:', element.tagName, 'isContentEditable:', element.isContentEditable);
        break;
      }
    }

    if (element) {
      const success = injectTextIntoElement(element, text);
      console.log('[Text Injection] injectTextIntoElement result:', success, 'for provider:', provider, 'element value length:', element.value?.length);
      if (mergeRequestId && window.parent !== window) {
        window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: true, injectSuccess: success, provider }, '*');
      }
      if (success) {
        console.log('[Text Injection] Text injected into', provider, 'using selector:', matchedSelector);

        // Auto-submit if requested (only from multi-panel context)
        if (shouldAutoSubmit) {
          // Wait for UI to update, then click send button.
          // Use provider-specific delays whose composer state updates asynchronously,
          // matching the injectText() helper used by image injection.
          const delay = (provider === 'deepseek' || provider === 'kimi' || provider === 'doubao') ? 800 : (provider === 'qianwen' || provider === 'wenxin') ? 1500 : 500;
          attemptAutoSubmitWithRetry(provider, providerMode, delay);
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
              console.log(`[Text Injection] Found input element on retry ${index + 1} with selector:`, selector);
              break;
            }
          }
          if (retryElement) {
            const success = injectTextIntoElement(retryElement, text);
            if (success) {
              console.log('[Text Injection] Text injected on retry into', provider, 'using selector:', retrySelector);
              if (shouldAutoSubmit) {
                const submitDelay = (provider === 'deepseek' || provider === 'kimi' || provider === 'doubao') ? 800 : (provider === 'qianwen' || provider === 'wenxin') ? 1500 : 500;
                attemptAutoSubmitWithRetry(provider, providerMode, submitDelay);
              }
            }
          } else if (index === retryDelays.length - 1) {
            console.error(`[Text Injection] ${provider} editor not found after ${retryDelays.length} retries`);
            console.error('[Text Injection] Available textareas:', document.querySelectorAll('textarea'));
            console.error('[Text Injection] Available contenteditable:', document.querySelectorAll('[contenteditable="true"]'));
            if (mergeRequestId && window.parent !== window) {
              window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: false, injectSuccess: false, provider, error: 'editor-not-found-after-retry' }, '*');
            }
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
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Clean known noise patterns from extracted answer text
  function cleanCopyText(text) {
    const patterns = [
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
      /\n{3,}/g,
    ];
    let cleaned = text;
    for (const p of patterns) {
      cleaned = cleaned.replace(p, '');
    }
    return cleaned.trim();
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
      '[role="log"] .markdown-body',
      '.conversation-container .markdown-body',
    ],
    grok: [
      '.message-content .markdown-body',
      '[role="log"] .markdown-body',
    ],
    deepseek: [
      '.ds-assistant-message-main-content',
      '.ds-chat-message:not([class*="user"]):not([class*="system"])',
    ],
    kimi: ['.kimi-message-content', '.message-list [class*="message"]'],
    doubao: [
      '.md-box-root',
      '.container-qX9Csx.md-box-root',
      '.semi-chat-message-content',
      '.semi-chat-message',
    ],
    qianwen: ['.qk-markdown-complete', '#qk-markdown-react', '.qk-markdown'],
    zhipu: ['.markdown-body.md-body', '.markdown-body', '.content-markdown'],
    wenxin: ['.custom-html.md-stream-desktop', '.md-stream-desktop', '.markdown-body'],
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
          if (!isVisibleElement(elements[i])) continue;
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
    kimi: ['.kimi-message-content', '.markdown-body', '[class*="message-content"]'],
    doubao: ['.semi-chat-message-content', '.markdown-body', '.semi-chat-message'],
    qianwen: ['.markdown-body', '[class*="markdown-body"]'],
    zhipu: ['.markdown-body', '.content-markdown', '[class*="markdown-body"]'],
    wenxin: ['.markdown-body'],
    metaso: ['.markdown-body'],
    chatgpt: ['.markdown-body'],
    claude: ['.markdown-body'],
    gemini: ['.markdown-body'],
    grok: ['.markdown-body']
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
          if (!isVisibleElement(btn)) continue;

          let el = btn.parentElement;
          for (let depth = 0; depth < 10 && el; depth++) {
            for (const as of ansSel) {
              try {
                const matches = el.querySelectorAll(as);
                for (let i = matches.length - 1; i >= 0; i--) {
                  if (!isVisibleElement(matches[i])) continue;
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
      if (!isVisibleElement(bodies[i])) continue;
      if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside, footer, [role="navigation"]')) continue;
      const text = extractText(bodies[i]);
      if (text.length > 0) {
        if (text.length > 50) return text;
      }
    }
    const logAreas = document.querySelectorAll('[role="log"], [role="region"]');
    for (let i = logAreas.length - 1; i >= 0; i--) {
      if (!isVisibleElement(logAreas[i])) continue;
      const text = extractText(logAreas[i]);
      if (text.length > 0) return text;
    }
    return '';
  }

  // Shared fallback extractors used by multiple provider extractors
  function extractFromRoleLog() {
    const logArea = document.querySelector('[role="log"]');
    if (!logArea || !isVisibleElement(logArea)) return '';
    const text = extractText(logArea);
    if (text.length > 0) return text;
    for (let i = logArea.children.length - 1; i >= 0; i--) {
      if (!isVisibleElement(logArea.children[i])) continue;
      const childText = extractText(logArea.children[i]);
      if (childText.length > 0) return childText;
    }
    return '';
  }

  function extractFromRoleList() {
    const lists = document.querySelectorAll('[role="list"]');
    for (let i = lists.length - 1; i >= 0; i--) {
      if (!isVisibleElement(lists[i])) continue;
      const items = lists[i].querySelectorAll('[role="listitem"]');
      for (let j = items.length - 1; j >= 0; j--) {
        if (!isVisibleElement(items[j])) continue;
        if (items[j].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
        const text = extractText(items[j]);
        if (text.length > 0) return text;
      }
    }
    return '';
  }

  // Expose shared utils for per-provider extractor files
  window.__panelize_extractor_utils = {
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
    const utils = window.__panelize_extractor_utils;
    const extractors = window.__panelize_extractors || {};

    // Phase 1: Try provider-specific extractor first (most precise)
    if (extractors[provider]) {
      try {
        const result = extractors[provider](utils);
        if (result) {
          console.log('[Extract] Phase 1 (provider extractor) hit for', provider, 'len:', result.length);
          return result;
        }
        console.log('[Extract] Phase 1 (provider extractor) returned empty for', provider);
      } catch (e) {
        console.warn('[Extract] Phase 1 error for', provider, e);
      }
    } else {
      console.log('[Extract] Phase 1 skipped — no extractor registered for', provider);
    }

    // Phase 2: Try direct answer selectors
    const directResult = extractByDirectSelector(provider);
    if (directResult) {
      console.log('[Extract] Phase 2 (direct selector) hit for', provider, 'len:', directResult.length);
      return directResult;
    }
    console.log('[Extract] Phase 2 miss for', provider);

    // Phase 3: Try copy button approach
    const copyBtnResult = extractByCopyButton(provider);
    if (copyBtnResult) {
      console.log('[Extract] Phase 3 (copy button) hit for', provider, 'len:', copyBtnResult.length);
      return copyBtnResult;
    }
    console.log('[Extract] Phase 3 miss for', provider);

    // Phase 4: Generic markdown body
    const genericResult = extractGenericMarkdownAnswer();
    console.log('[Extract] Phase 4 (generic) for', provider, 'len:', genericResult ? genericResult.length : 0);
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
    const extractors = window.__panelize_extractors || {};
    if (extractors[provider]) {
      try {
        const text = extractors[provider](window.__panelize_extractor_utils);
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
    console.log('Input selectors:', results.input);
    console.log('Send selectors:', results.send);
    console.log('Extract selectors:', results.extract);
    console.log('New chat selectors:', results.newChat);
    console.log('Summary:', results.summary);
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
      'button[aria-label*="stop"]'
    ],
    gemini: [
      'button[aria-label="Stop"]',
      'button[aria-label*="Stop"]',
      'button[mattooltip="Stop"]',
      'button[mattooltip*="stop"]'
    ],
    grok: [
      'button[aria-label="Stop"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="stop"]'
    ],
    deepseek: [
      'button[aria-label="Stop"]',
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
          if (isVisibleElement(el)) {
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

    let targetNode = null;
    for (const sel of selectors) {
      try {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
          if (isVisibleElement(el)) {
            targetNode = el;
            break;
          }
        }
      } catch (_) {}
      if (targetNode) break;
    }

    if (!targetNode) {
      targetNode = document.body;
    }

    const STABLE_DELAY_MS = 3000;

    const resetStableTimer = () => {
      if (completionStableTimer) {
        clearTimeout(completionStableTimer);
      }
      completionStableTimer = setTimeout(() => {
        let hasContent = false;
        for (const sel of selectors) {
          try {
            const elements = document.querySelectorAll(sel);
            for (const el of elements) {
              if (isVisibleElement(el)) {
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

        console.log('[CompletionMonitor] MutationObserver fallback: answer stable for', STABLE_DELAY_MS, 'ms. Provider:', provider);
        stopCompletionMonitor();

        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'COMPLETION_DETECTED',
            provider,
            context: 'multi-panel-completion'
          }, '*');
        }
      }, STABLE_DELAY_MS);
    };

    completionObserver = new MutationObserver(() => {
      resetStableTimer();
    });

    completionObserver.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true
    });

    resetStableTimer();
    console.log('[CompletionMonitor] MutationObserver fallback active for provider:', provider);
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
      console.log('[CompletionMonitor] No stop button selectors for', provider, '— using MutationObserver fallback');
      startMutationFallback(provider);
      return;
    }

    // Helper: check and transition phases
    function evaluateButtonState() {
      const stopPresent = isStopButtonPresent(provider);

      if (completionPhase === 'button-watch-appear' && stopPresent) {
        // Stop button appeared — AI is now generating. Switch to watching for disappearance.
        console.log('[CompletionMonitor] Stop button detected — AI is generating. Watching for completion...');
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

          console.log('[CompletionMonitor] Stop button disappeared — generation complete. Provider:', provider);
          stopCompletionMonitor();

          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'COMPLETION_DETECTED',
              provider,
              context: 'multi-panel-completion'
            }, '*');
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
        console.log('[CompletionMonitor] No stop button appeared within', BUTTON_APPEAR_TIMEOUT_MS, 'ms — falling back to MutationObserver');
        startMutationFallback(provider);
      }, BUTTON_APPEAR_TIMEOUT_MS);
    }

    console.log('[CompletionMonitor] Button-state monitoring started for provider:', provider, 'phase:', completionPhase);
  }

  function startCompletionMonitor() {
    stopCompletionMonitor();

    const provider = detectProvider();
    if (!provider) {
      console.warn('[CompletionMonitor] Provider not detected');
      return;
    }

    startButtonStateMonitor(provider);
  }

  // Listen for messages from the multi-panel host
  window.addEventListener('message', (event) => {
    if (!event || !event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'MONITOR_COMPLETION' && event.data.context === 'multi-panel') {
      startCompletionMonitor();
      return;
    }

    if (event.data.type === 'STOP_MONITORING' && event.data.context === 'multi-panel') {
      stopCompletionMonitor();
      return;
    }

    // Delegate to existing handler
    handleTextInjection(event);
  });
})();
