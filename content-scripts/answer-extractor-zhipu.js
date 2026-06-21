// 智谱清言 (ChatGLM) answer extractor
// 不检查可见性（答案可能在视口外），从后往前取第一个有内容的元素
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};
  window.__panelize_extractors.zhipu = function(utils) {
    const selectors = ['.markdown-body.md-body', '.markdown-body', '.content-markdown'];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
        const text = utils.extractText(el);
        if (text.length > 0) {
          console.log('[Zhipu Extractor] Selected index', i, 'len:', text.length);
          return text;
        }
      }
    }

    console.log('[Zhipu Extractor] No content found');
    return '';
  };
})();
