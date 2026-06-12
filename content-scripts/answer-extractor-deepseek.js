// DeepSeek answer extractor
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.deepseek = function(utils) {
    // Helper: clone and strip citations
    function extractClean(el) {
      if (!utils.isVisibleElement(el)) return '';
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.ds-markdown-cite, svg').forEach(e => e.remove());
      return utils.extractText(clone);
    }

    // Primary: find LAST visible AI message content
    const allMainContent = document.querySelectorAll('.ds-assistant-message-main-content');
    for (let i = allMainContent.length - 1; i >= 0; i--) {
      const text = extractClean(allMainContent[i]);
      if (text.length > 0) return text;
    }

    // Fallback: last visible ds-chat-message
    const messages = document.querySelectorAll('.ds-chat-message');
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(messages[i])) continue;
      const text = utils.extractText(messages[i]);
      if (text.length > 0) return text;
    }

    return '';
  };
})();
