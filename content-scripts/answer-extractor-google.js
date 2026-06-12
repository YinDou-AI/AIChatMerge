// Google AI Mode answer extractor
// Google renders responses in .markdown-body containers
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.google = function(utils) {
    return utils.extractGenericMarkdownAnswer();
  };
})();
