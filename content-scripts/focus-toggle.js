// Focus toggle content script
// Handles focus switching between extension UI and main page input

/**
 * Find the AI provider's input element
 * Returns the main input field for the current AI platform
 */
function findProviderInput() {
  const host = window.location.hostname;

  // ChatGPT
  if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
    return document.querySelector('#prompt-textarea') ||
           document.querySelector('textarea[data-id="root"]');
  }

  // Claude
  if (host.includes('claude.ai')) {
    return document.querySelector('[contenteditable="true"].ProseMirror') ||
           document.querySelector('div[contenteditable="true"]') ||
           document.querySelector('textarea');
  }

  // Gemini
  if (host.includes('gemini.google.com')) {
    return document.querySelector('.ql-editor[contenteditable="true"]') ||
           document.querySelector('div.textarea[role="textbox"]') ||
           document.querySelector('textarea');
  }

  // Google AI Mode
  if (host.includes('google.com')) {
    return document.querySelector('textarea.ITIRGe') ||
           document.querySelector('textarea[aria-label="Ask anything"]') ||
           document.querySelector('textarea[maxlength="8192"]');
  }

  // Grok
  if (host.includes('grok.com')) {
    return document.querySelector('.tiptap.ProseMirror') ||
           document.querySelector('div[contenteditable="true"].ProseMirror');
  }

  // DeepSeek
  if (host.includes('chat.deepseek.com')) {
    return document.querySelector('textarea[placeholder*="DeepSeek"]') ||
           document.querySelector('textarea.ds-scroll-area');
  }

  // Kimi
  if (host.includes('kimi.com')) {
    return document.querySelector('.chat-input-editor') ||
           document.querySelector('div[contenteditable="true"].chat-input-editor') ||
           document.querySelector('div[contenteditable="true"]');
  }

  // Doubao
  if (host.includes('doubao.com')) {
    return document.querySelector('#input-engine-container .semi-input-textarea-wrapper textarea') ||
           document.querySelector('.semi-input-textarea-wrapper textarea') ||
           document.querySelector('[data-slate-editor="true"][contenteditable="true"]') ||
           document.querySelector('.flow-chat-editor [contenteditable="true"]');
  }

  // Qianwen
  if (host.includes('qianwen.com')) {
    return document.querySelector('div[data-slate-editor="true"]') ||
           document.querySelector('div[contenteditable="true"][data-slate-editor]') ||
           document.querySelector('textarea[placeholder*="输入"]') ||
           document.querySelector('textarea[placeholder*="提问"]');
  }

  // Zhipu (ChatGLM)
  if (host.includes('chatglm.cn')) {
    return document.querySelector('textarea.scroll-display-none') ||
           document.querySelector('textarea[placeholder*="输入"]') ||
           document.querySelector('textarea[placeholder*="提问"]') ||
           document.querySelector('.chat-input textarea');
  }

  // Wenxin (Baidu)
  if (host.includes('chat.baidu.com')) {
    return document.querySelector('div[data-slate-editor="true"]') ||
           document.querySelector('div[contenteditable="true"][data-slate-editor]') ||
           document.querySelector('textarea[placeholder*="输入"]') ||
           document.querySelector('textarea[placeholder*="提问"]');
  }

  // Yuanbao (Tencent)
  if (host.includes('yuanbao.tencent.com')) {
    return document.querySelector('.ql-editor[contenteditable="true"]') ||
           document.querySelector('.ql-editor') ||
           document.querySelector('textarea[placeholder*="输入"]') ||
           document.querySelector('textarea[placeholder*="提问"]');
  }

  // Metaso
  if (host.includes('metaso.cn')) {
    return document.querySelector('textarea.search-consult-textarea') ||
           document.querySelector('textarea[placeholder*="搜索"]') ||
           document.querySelector('textarea[placeholder*="提问"]');
  }

  // Generic fallback: find any visible textarea or contenteditable
  const textarea = document.querySelector('textarea:not([hidden])');
  if (textarea && textarea.offsetParent !== null) return textarea;

  const contentEditable = document.querySelector('[contenteditable="true"]:not([hidden])');
  if (contentEditable && contentEditable.offsetParent !== null) return contentEditable;

  return null;
}

/**
 * Focus the provider's input element
 */
function focusProviderInput() {
  const input = findProviderInput();
  if (input) {
    input.focus();
    // For contenteditable elements, also set cursor at end
    if (input.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false); // collapse to end
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return true;
  }
  return false;
}

/**
 * Check if the page currently has focus
 */
function checkPageFocus() {
  return document.hasFocus();
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkFocus') {
    sendResponse({ hasFocus: checkPageFocus() });
  } else if (message.action === 'takeFocus') {
    const success = focusProviderInput();
    sendResponse({ success });
  }
  return true; // Keep channel open for async response
});
