// 千问 (Qianwen) answer extractor
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};

  // Remove recommendation cards (video/note/web cards) before extracting text
  function cleanQianwenClone(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(
      '.qk-md-has-multi-modal, ' +
      '[data-card-type], ' +
      '.card_card_video, ' +
      '.video_note_list_item_list, ' +
      '.note-item, ' +
      '.web-item, ' +
      'script, style'
    ).forEach(e => e.remove());
    return clone;
  }

  window.__panelize_extractors.qianwen = function(utils) {
    // Primary: qk-markdown container (clean recommendation cards)
    const qkRoots = document.querySelectorAll('.qk-markdown-complete');
    for (let i = qkRoots.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(qkRoots[i])) continue;
      if (qkRoots[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const clone = cleanQianwenClone(qkRoots[i]);
      const text = utils.extractText(clone);
      if (text.length > 0) return text;
    }

    // Fallback: markdown-body
    let bodies = document.querySelectorAll('.markdown-body');
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(bodies[i])) continue;
      if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const clone = cleanQianwenClone(bodies[i]);
      const text = utils.extractText(clone);
      if (text.length > 0) return text;
    }

    // Fallback: CSS Modules hashed
    bodies = document.querySelectorAll('[class*="markdown-body"]');
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(bodies[i])) continue;
      if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const clone = cleanQianwenClone(bodies[i]);
      const text = utils.extractText(clone);
      if (text.length > 0 && !text.includes('发送')) return text;
    }

    // Fallback: role="list"
    const listResult = utils.extractFromRoleList();
    if (listResult) return listResult;

    // Fallback: role="log"
    const logResult = utils.extractFromRoleLog();
    if (logResult) return logResult;

    return '';
  };
})();
