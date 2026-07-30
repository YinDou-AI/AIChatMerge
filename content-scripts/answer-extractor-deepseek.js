// DeepSeek answer extractor
// 不检查可见性（答案可能在视口外），从后往前取第一个有内容的元素
(function() {
  'use strict';
  window.__aichatmerge_extractors = window.__aichatmerge_extractors || {};
  window.__aichatmerge_extractors.deepseek = function(utils) {
    const diag = { provider: 'deepseek', primaryCount: 0, primarySkipped: 0, primaryEmpty: 0, fallbackCount: 0, fallbackSkipped: 0, fallbackEmpty: 0 };

    // Primary: find LAST AI message content
    const allMainContent = document.querySelectorAll('.ds-assistant-message-main-content');
    diag.primaryCount = allMainContent.length;
    for (let i = allMainContent.length - 1; i >= 0; i--) {
      const el = allMainContent[i];
      if (el.closest('textarea, [contenteditable="true"], form, nav, aside')) { diag.primarySkipped++; continue; }
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.ds-markdown-cite, svg').forEach(e => e.remove());
      const text = utils.extractText(clone);
      if (text.length > 0) return text;
      diag.primaryEmpty++;
    }

    // Fallback: last ds-chat-message
    const messages = document.querySelectorAll('.ds-chat-message');
    diag.fallbackCount = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      const el = messages[i];
      if (el.closest('textarea, [contenteditable="true"], form, nav, aside')) { diag.fallbackSkipped++; continue; }
      const text = utils.extractText(el);
      if (text.length > 0) return text;
      diag.fallbackEmpty++;
    }

    console.warn('[DeepSeek Extract] All strategies returned empty:', diag);
    window.__aichatmerge_lastExtractDiag = diag;
    return '';
  };
})();
