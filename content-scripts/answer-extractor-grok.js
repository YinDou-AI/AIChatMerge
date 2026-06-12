// Grok answer extractor
// Grok renders responses in .markdown-body containers
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.grok = function(utils) {
    return utils.extractGenericMarkdownAnswer();
  };
})();
