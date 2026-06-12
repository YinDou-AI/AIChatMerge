// 秘塔AI (Metaso) answer extractor
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.metaso = function(utils) {
    // Primary: result-responsive-layer (CSS Modules hashed, unique to Metaso)
    const containers = document.querySelectorAll('[class*="result-responsive-layer"]');
    let lastVisible = null;
    for (let i = containers.length - 1; i >= 0; i--) {
      if (utils.isVisibleElement(containers[i])) {
        lastVisible = containers[i];
        break;
      }
    }
    if (lastVisible) {
      const markdownBodies = lastVisible.querySelectorAll('.markdown-body');
      for (let i = markdownBodies.length - 1; i >= 0; i--) {
        if (!utils.isVisibleElement(markdownBodies[i])) continue;
        const text = utils.extractText(markdownBodies[i]);
        if (text.length > 0) return text;
      }
    }

    // Fallback: generic markdown-body
    const bodies = document.querySelectorAll('.markdown-body');
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(bodies[i])) continue;
      if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = utils.extractText(bodies[i]);
      if (text.length > 0) return text;
    }

    // Fallback: role="log"
    const logResult = utils.extractFromRoleLog();
    if (logResult) return logResult;

    return '';
  };
})();
