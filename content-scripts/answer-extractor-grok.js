// Grok answer extractor
// Grok renders responses in .markdown-body containers
(function() {
  'use strict';
  window.__aichatmerge_extractors = window.__aichatmerge_extractors || {};
  window.__aichatmerge_extractors.grok = function(utils) {
    return utils.extractGenericMarkdownAnswer();
  };
})();
