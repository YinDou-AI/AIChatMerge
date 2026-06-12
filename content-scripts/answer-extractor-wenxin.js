// 文心一言 (Wenxin) answer extractor
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.wenxin = function(utils) {
    // Primary: custom-html md-stream-desktop
    const streamRoot = document.querySelector('.custom-html.md-stream-desktop');
    if (streamRoot && utils.isVisibleElement(streamRoot)) {
      const text = utils.extractText(streamRoot);
      if (text.length > 0) return text;
    }

    // Fallback: chatViewer approach
    const viewer = document.querySelector('[class*="chatViewer"]');
    if (!viewer) return '';

    const mdEls = viewer.querySelectorAll('.markdown-body');
    for (let i = mdEls.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(mdEls[i])) continue;
      const text = utils.extractText(mdEls[i]);
      if (text.length > 0) return text;
    }

    const logArea = viewer.querySelector('[role="log"]');
    if (logArea && utils.isVisibleElement(logArea)) {
      const text = utils.extractText(logArea);
      if (text.length > 0) return text;
    }

    return '';
  };
})();
