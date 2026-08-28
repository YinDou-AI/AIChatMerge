// ChatGPT answer extractor
// ChatGPT renders responses in .markdown-body containers
(function() {
  'use strict';
  window.__aichatmerge_extractors = window.__aichatmerge_extractors || {};
  window.__aichatmerge_extractors.chatgpt = function(utils) {
    return utils.extractGenericMarkdownAnswer();
  };
})();
