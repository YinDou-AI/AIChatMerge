// Doubao (豆包) answer extractor
(function() {
  'use strict';
  window.__aichatmerge_extractors = window.__aichatmerge_extractors || {};
  window.__aichatmerge_extractors.doubao = function(utils) {
    // Primary: md-box-root
    const mdRoots = document.querySelectorAll('.md-box-root');
    for (let i = mdRoots.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(mdRoots[i])) continue;
      const text = utils.extractText(mdRoots[i]);
      if (text.length > 0) return text;
    }

    // Fallback: Semi Design selectors
    const semiSelectors = [
      '.semi-chat-message',
      '.semi-chat-messageItem',
      '.semi-chat-message-item',
      '.semi-chat-message-content',
      '.semi-chat-message-list'
    ];
    for (const selector of semiSelectors) {
      const elements = document.querySelectorAll(selector);
      for (let i = elements.length - 1; i >= 0; i--) {
        if (!utils.isVisibleElement(elements[i])) continue;
        const text = utils.extractText(elements[i]);
        if (text.length > 0) return text;
      }
    }

    // Fallback: role="log"
    const logResult = utils.extractFromRoleLog();
    if (logResult) return logResult;

    // Fallback: role="list"
    const listResult = utils.extractFromRoleList();
    if (listResult) return listResult;

    return '';
  };
})();
