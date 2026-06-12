// ChatGPT answer extractor
// ChatGPT renders responses in .markdown-body containers
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.chatgpt = function(utils) {
    return utils.extractGenericMarkdownAnswer();
  };
})();
