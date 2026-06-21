// DeepSeek answer extractor
// 不检查可见性（答案可能在视口外），从后往前取第一个有内容的元素
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.deepseek = function(utils) {
    // Primary: find LAST AI message content
    const allMainContent = document.querySelectorAll('.ds-assistant-message-main-content');
    for (let i = allMainContent.length - 1; i >= 0; i--) {
      const el = allMainContent[i];
      if (el.closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.ds-markdown-cite, svg').forEach(e => e.remove());
      const text = utils.extractText(clone);
      if (text.length > 0) return text;
    }

    // Fallback: last ds-chat-message
    const messages = document.querySelectorAll('.ds-chat-message');
    for (let i = messages.length - 1; i >= 0; i--) {
      const el = messages[i];
      if (el.closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = utils.extractText(el);
      if (text.length > 0) return text;
    }

    return '';
  };
})();
