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
  const CHATGPT_STOP_BUTTON_SELECTOR = 'button[data-testid="stop-button"]';
  const CHATGPT_SEND_TRACKING_IDLE_DELAY_MS = 800;
  const CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS = 2000;
  const MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS = 90000;
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
    google: [
      'textarea.ITIRGe',
      'textarea[aria-label="Ask anything"]',
      'textarea[maxlength="8192"]'
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
    google: true  // Google AI Mode supports images
  };

  // Provider-specific file input selectors for image upload
  const FILE_INPUT_SELECTORS = {
    chatgpt: ['input[type="file"][data-testid="file-upload-input"]', 'input[type="file"]'],
    claude: ['input[type="file"]'],
    gemini: ['input[type="file"]'],
    grok: ['input[type="file"]'],
    deepseek: ['input[type="file"]'],
    kimi: ['input[type="file"]'],
    google: ['input[type="file"]']
  };

  // Provider-specific upload button selectors (to click before file input)
  const UPLOAD_BUTTON_SELECTORS = {
    chatgpt: ['button[aria-label="Attach files"]', 'button[data-testid="composer-attach-button"]', 'button:has(svg path[d*="M9"])'],
    claude: ['button[aria-label="Attach file"]', 'button[aria-label="Upload file"]', 'fieldset button:has(svg)'],
    gemini: ['button[aria-label="Upload file"]', 'button[mattooltip="Upload file"]', '.add-button', 'button:has(mat-icon)'],
    grok: [],
    deepseek: [],
    kimi: [],  // Kimi supports drag-drop for images
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
    google: [
      'button[data-xid="input-plate-send-button"]',
      'button[aria-label="Send"]',
      'button.OEueve'
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
      '.sidebar a[href="/"]',
      'button:has-text("新建会话")',
      'a:has-text("新建会话")'
    ],
    google: [
      'button[aria-label="New search"]',
      'a[aria-label="Google"]',
      'a[href^="/search"][href*="udm="]'
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
    google: 'https://www.google.com/search?udm=50'
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

  function isVisibleElement(element) {
    return Boolean(
      element &&
      element.offsetParent !== null &&
      element.getAttribute('aria-hidden') !== 'true'
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

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    if (typeof element.value === 'string') {
      element.selectionStart = element.selectionEnd = element.value.length;
    }
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

    input.focus();
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    input.dispatchEvent(enterEvent);
    return true;
  }

  // Find and click send button
  function clickSendButton(provider, providerMode = null) {
    if (provider === 'google') {
      return clickGoogleSendButton(providerMode);
    }

    const selectors = SEND_BUTTON_SELECTORS[provider];
    if (!selectors) {
      console.warn('[Text Injection] No send button selectors for provider:', provider);
      return false;
    }

    console.log('[Text Injection] Attempting to click send button for provider:', provider);

    // Try each selector
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`[Text Injection] Found ${elements.length} elements with selector:`, selector);

        for (const element of elements) {
          // Handle SVG elements - try to find parent button
          let targetElement = element;
          if (element.tagName === 'svg' || element.tagName === 'SVG') {
            // Look for parent button or clickable container
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
              if (parent.tagName === 'BUTTON' || 
                  parent.role === 'button' || 
                  parent.classList.contains('send-button-container') ||
                  parent.onclick ||
                  parent.getAttribute('role') === 'button') {
                targetElement = parent;
                break;
              }
              parent = parent.parentElement;
            }
          }
          
          // Check if element or its parent is disabled
          const isDisabled = targetElement.disabled || 
                            targetElement.getAttribute('aria-disabled') === 'true' ||
                            targetElement.classList.contains('disabled');
          
          if (!isDisabled) {
            console.log('[Text Injection] Clicking send button:', selector, targetElement);
            targetElement.click();
            return true;
          } else {
            console.log('[Text Injection] Button found but disabled:', selector);
          }
        }
      } catch (error) {
        console.warn('[Text Injection] Error finding button with selector:', selector, error);
      }
    }

    // Special handling for DeepSeek - trigger Enter key if button not found
    if (provider === 'deepseek') {
      console.log('[Text Injection] DeepSeek send button not found, trying Enter key');
      try {
        const inputSelectors = PROVIDER_SELECTORS.deepseek;
        for (const selector of inputSelectors) {
          const input = document.querySelector(selector);
          if (input) {
            console.log('[Text Injection] Triggering Enter key on DeepSeek input');
            // Trigger multiple events for better compatibility
            const events = [
              new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
              new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
              new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })
            ];

            events.forEach(event => input.dispatchEvent(event));
            return true;
          }
        }
      } catch (error) {
        console.warn('[Text Injection] Error in DeepSeek Enter key fallback:', error);
      }
    }

    // Special handling for Kimi - trigger Enter key if button not found
    if (provider === 'kimi') {
      console.log('[Text Injection] Kimi send button not found, trying Enter key on input');
      try {
        const inputSelectors = PROVIDER_SELECTORS.kimi;
        for (const selector of inputSelectors) {
          const input = document.querySelector(selector);
          if (input) {
            console.log('[Text Injection] Triggering Enter key on Kimi input');
            // Focus first
            input.focus();
            // Trigger multiple events for better compatibility
            const events = [
              new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
              new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
              new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })
            ];

            events.forEach(event => input.dispatchEvent(event));
            return true;
          }
        }
      } catch (error) {
        console.warn('[Text Injection] Error in Kimi Enter key fallback:', error);
      }
    }

    console.warn('[Text Injection] Send button not found or disabled for:', provider);
    console.warn('[Text Injection] Available buttons:', document.querySelectorAll('button'));
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
    for (const selector of selectors) {
      try {
        const button = document.querySelector(selector);
        if (button) {
          console.log('[Text Injection] Clicking new chat button:', selector);
          button.click();
          return true;
        }
      } catch (error) {
        console.warn('[Text Injection] Error finding new chat button with selector:', selector, error);
      }
    }

    // Fallback: Try to find any link or button containing "new" text
    try {
      const allButtons = document.querySelectorAll('button, a, div[role="button"]');
      for (const elem of allButtons) {
        const text = (elem.textContent || '').toLowerCase();
        const ariaLabel = (elem.getAttribute('aria-label') || '').toLowerCase();
        const href = elem.getAttribute('href') || '';

        if (text.includes('new chat') ||
            text.includes('start new') ||
            ariaLabel.includes('new chat') ||
            ariaLabel.includes('start new') ||
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

      if (isTextarea) {
        // For textarea/input elements
        const currentValue = element.value || '';
        const newValue = currentValue + text;

        setFormControlValue(element, newValue);
      } else {
        // For contenteditable elements - append text without clearing existing content
        element.focus();

        // Move cursor to end first
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false); // Collapse to end
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          // Ignore selection errors in cross-origin context
        }

        // Use execCommand insertText to append - works well with ProseMirror/Lexical/Quill
        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, text);
        } catch (e) {
          // execCommand not available in some contexts
        }

        if (!inserted) {
          // Fallback: manually append text node
          const textNode = document.createTextNode(text);
          element.appendChild(textNode);
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
            // Use longer delay for DeepSeek/Kimi to ensure DOM is ready
            const delay = (provider === 'deepseek' || provider === 'kimi') ? 800 : 500;
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

      // Inject images first
      for (const image of images) {
        await injectSingleImage(provider, image);
        // Wait a bit between images
        await sleep(200);
      }

      // Wait for images to upload
      await sleep(500);

      // Then inject text if provided
      if (text && text.trim()) {
        await sleep(300);
        injectText(provider, text, autoSubmit, providerMode);
      } else if (autoSubmit) {
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

  // Handle text injection message
  function handleTextInjection(event) {
    // Validate event data structure
    if (!event || !event.data || typeof event.data !== 'object') {
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
              // For contenteditable elements
              element.focus();

              // Special handling for Kimi (Lexical editor): simulate Ctrl+A + Backspace
              // Lexical maintains internal state, so we must use keyboard events
              if (provider === 'kimi') {
                // Dispatch Ctrl+A (Select All)
                element.dispatchEvent(new KeyboardEvent('keydown', {
                  key: 'a',
                  code: 'KeyA',
                  keyCode: 65,
                  which: 65,
                  ctrlKey: true,
                  metaKey: true,  // For Mac
                  bubbles: true,
                  cancelable: true
                }));

                // Use execCommand to select all (works with Lexical)
                document.execCommand('selectAll', false, null);

                // Small delay then delete
                setTimeout(() => {
                  element.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Backspace',
                    code: 'Backspace',
                    keyCode: 8,
                    which: 8,
                    bubbles: true,
                    cancelable: true
                  }));
                  document.execCommand('delete', false, null);
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                }, 10);
              } else {
                element.innerHTML = '';
                // Trigger multiple events for React/Vue compatibility
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
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

    // Handle INJECT_TEXT_WITH_IMAGES messages
    if (event.data.type === 'INJECT_TEXT_WITH_IMAGES' && event.data.context === 'multi-panel') {
      handleImageInjection(event);
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

    // Security check: Only allow autoSubmit from multi-panel context
    // This prevents other contexts from accidentally auto-submitting when
    // multi-panel sends messages to its iframes
    const shouldAutoSubmit = autoSubmit && context === 'multi-panel';

    const provider = detectProvider();
    if (!provider) {
      console.warn('Unknown provider, cannot inject text');
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
        console.log('[Text Injection] Found input element with selector:', selector, 'for provider:', provider);
        break;
      }
    }

    if (element) {
      const success = injectTextIntoElement(element, text);
      if (success) {
        console.log('[Text Injection] Text injected into', provider, 'using selector:', matchedSelector);

        // Auto-submit if requested (only from multi-panel context)
        if (shouldAutoSubmit) {
          // Wait for UI to update, then click send button
          // Use longer delay for DeepSeek to ensure DOM is ready
          const delay = provider === 'deepseek' ? 800 : 500;
          setTimeout(() => {
            console.log('[Text Injection] Attempting to click send button for', provider);
            const clicked = clickSendButton(provider, providerMode);
            if (!clicked) {
              console.warn('[Text Injection] Failed to click send button for', provider);
            }
          }, delay);
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
                const submitDelay = provider === 'deepseek' ? 800 : 500;
                setTimeout(() => {
                  console.log('[Text Injection] Attempting to click send button for', provider, 'after retry');
                  clickSendButton(provider, providerMode);
                }, submitDelay);
              }
            }
          } else if (index === retryDelays.length - 1) {
            console.error(`[Text Injection] ${provider} editor not found after ${retryDelays.length} retries`);
            console.error('[Text Injection] Available textareas:', document.querySelectorAll('textarea'));
            console.error('[Text Injection] Available contenteditable:', document.querySelectorAll('[contenteditable="true"]'));
          }
        }, delay);
      });
    }
  }

  // Listen for messages from the multi-panel host
  window.addEventListener('message', handleTextInjection);
})();
