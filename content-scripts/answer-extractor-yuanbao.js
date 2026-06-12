// 元宝 (Yuanbao) answer extractor
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.yuanbao = function(utils) {
    // Primary: hyc-common-markdown-style
    const hycRoots = document.querySelectorAll('.hyc-common-markdown-style');
    for (let i = hycRoots.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(hycRoots[i])) continue;
      if (hycRoots[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = utils.extractText(hycRoots[i]);
      if (text.length > 0) return text;
    }

    // Fallback: markdown-body
    let bodies = document.querySelectorAll('.markdown-body');
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(bodies[i])) continue;
      if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = utils.extractText(bodies[i]);
      if (text.length > 0) return text;
    }

    // Fallback: CSS Modules hashed
    bodies = document.querySelectorAll('[class*="markdown-body"]');
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(bodies[i])) continue;
      if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = utils.extractText(bodies[i]);
      if (text.length > 0) return text;
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
