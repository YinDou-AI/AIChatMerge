// Kimi answer extractor
// Kimi uses .markdown-container > .markdown as primary structure
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.kimi = function(utils) {
    // Primary: .markdown-container > .markdown
    const markdownContainer = document.querySelector('.markdown-container');
    if (markdownContainer && utils.isVisibleElement(markdownContainer)) {
      const text = utils.extractText(markdownContainer);
      if (text.length > 0) return text;
    }

    // Fallback: .markdown (without container)
    const markdownEls = document.querySelectorAll('.markdown');
    for (let i = markdownEls.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(markdownEls[i])) continue;
      if (markdownEls[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = utils.extractText(markdownEls[i]);
      if (text.length > 0) return text;
    }

    // Fallback: .message-list children (legacy)
    const msgList = document.querySelector('.message-list');
    if (msgList) {
      const children = msgList.children;
      for (let i = children.length - 1; i >= 0; i--) {
        if (!utils.isVisibleElement(children[i])) continue;
        const text = utils.extractText(children[i]);
        if (text.length > 0) return text;
      }
    }

    // Fallback: role="log"
    const logResult = utils.extractFromRoleLog();
    if (logResult) return logResult;

    // Fallback: .kimi-message-content
    const contents = document.querySelectorAll('.kimi-message-content');
    for (let i = contents.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(contents[i])) continue;
      const text = utils.extractText(contents[i]);
      if (text.length > 0) return text;
    }

    return '';
  };
})();
