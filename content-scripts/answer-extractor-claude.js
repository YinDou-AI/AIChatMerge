// Claude answer extractor
// Claude renders responses in .markdown-body containers
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.claude = function(utils) {
    return utils.extractGenericMarkdownAnswer();
  };
})();
