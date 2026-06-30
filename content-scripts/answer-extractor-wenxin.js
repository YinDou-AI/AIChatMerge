// 文心一言 (Wenxin) answer extractor
(function() {
  'use strict';
  window.__aichatmerge_extractors = window.__aichatmerge_extractors || {};
  window.__aichatmerge_extractors.wenxin = function(utils) {
    // Primary: new layout (2026+) - .cosd-markdown-content
    // querySelectorAll + reverse: pick the LAST visible match (latest reply)
    const cosdEls = document.querySelectorAll('.cosd-markdown-content');
    for (let i = cosdEls.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(cosdEls[i])) continue;
      const text = utils.extractText(cosdEls[i]);
      if (text.length > 0) return text;
    }

    // Fallback: .ai-entry-block.ai-markdown
    const aiEls = document.querySelectorAll('.ai-entry-block.ai-markdown');
    for (let i = aiEls.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(aiEls[i])) continue;
      const text = utils.extractText(aiEls[i]);
      if (text.length > 0) return text;
    }

    // Fallback: old layout - custom-html md-stream-desktop
    const streamEls = document.querySelectorAll('.custom-html.md-stream-desktop');
    for (let i = streamEls.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(streamEls[i])) continue;
      const text = utils.extractText(streamEls[i]);
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
