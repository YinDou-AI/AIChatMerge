// Claude answer extractor
// Claude renders responses using test IDs, custom font classes, and turn-based structure
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.claude = function(utils) {
    // 优先使用Claude专用选择器提取回答
    const claudeSelectors = [
      '[data-testid="assistant-message"]',
      '[data-message-role="assistant"]',
      '.font-claude-message',
      '[class*="AssistantTurn"]',
      '[class*="assistant-turn"]',
      '.prose',
      '.markdown-body'
    ];

    for (const sel of claudeSelectors) {
      try {
        const elements = document.querySelectorAll(sel);
        for (let i = elements.length - 1; i >= 0; i--) {
          const el = elements[i];
          if (!utils.isVisibleElement || utils.isVisibleElement(el)) {
            const text = (el.textContent || '').trim();
            if (text.length > 10) {
              return text;
            }
          }
        }
      } catch (_) {}
    }

    // 兜底：通用markdown提取
    return utils.extractGenericMarkdownAnswer();
  };
})();
