// 智谱 (ChatGLM) answer extractor
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.zhipu = function(utils) {
    // Primary: specific md-body class
    const specificBodies = document.querySelectorAll('.markdown-body.md-body');
    for (let i = specificBodies.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(specificBodies[i])) continue;
      if (specificBodies[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = utils.extractText(specificBodies[i]);
      if (text.length > 0) return text;
    }

    // Fallback: generic markdown-body
    const bodies = document.querySelectorAll('.markdown-body');
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(bodies[i])) continue;
      if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = utils.extractText(bodies[i]);
      if (text.length > 0) return text;
    }

    // Fallback: content-markdown
    const mdContents = document.querySelectorAll('.content-markdown');
    for (let i = mdContents.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(mdContents[i])) continue;
      const text = utils.extractText(mdContents[i]);
      if (text.length > 0) return text;
    }

    return '';
  };
})();
