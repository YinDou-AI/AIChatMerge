// Gemini answer extractor. Gemini's UI has moved between class-based
// containers and the stable <model-response> custom element several times.
(function() {
  'use strict';
  window.__aichatmerge_extractors = window.__aichatmerge_extractors || {};
  window.__aichatmerge_extractors.gemini = function(utils) {
    const selectors = [
      'model-response .markdown-main-panel',
      'model-response .markdown',
      'model-response',
      '.model-response-text',
      '.response-content .markdown',
      '.markdown-main-panel',
      '[data-message-author-role="model"]'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (let index = elements.length - 1; index >= 0; index -= 1) {
          const element = elements[index];
          if (utils.isVisibleElement && !utils.isVisibleElement(element)) continue;
          const text = utils.extractText(element);
          if (text.length > 0) return text;
        }
      } catch (_) {}
    }

    return utils.extractGenericMarkdownAnswer();
  };
})();
