// Gemini answer extractor
// Gemini renders responses in .markdown-body containers
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.gemini = function(utils) {
    return utils.extractGenericMarkdownAnswer();
  };
})();
