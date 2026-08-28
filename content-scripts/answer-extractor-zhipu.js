// 智谱清言 (ChatGLM) answer extractor
// 不检查可见性（答案可能在视口外）。智谱会把一条长回答拆成多个
// markdown 块；因此需要优先取该回答的消息容器，而不能只取最后一块。
(function() {
  'use strict';
  window.__aichatmerge_extractors = window.__aichatmerge_extractors || {};

  const MESSAGE_CONTAINER_SELECTOR = [
    '[data-message-id]',
    '[data-message-role="assistant"]',
    '[role="listitem"]',
    'article',
    '[class*="message-item"]',
    '[class*="messageItem"]',
    '[class*="chat-message"]',
    '[class*="chatMessage"]',
    '[class*="message-content"]',
    '[class*="messageContent"]'
  ].join(', ');

  function extractWholeLatestZhipuAnswer(root, utils) {
    const rootText = utils.extractText(root);
    const container = root.closest(MESSAGE_CONTAINER_SELECTOR);
    if (!container || container === root) return rootText;
    if (container.closest('textarea, [contenteditable="true"], form, nav, aside')) return rootText;

    const containerText = utils.extractText(container);
    // Only use a message-level container when it actually adds content. This
    // preserves the old narrow extraction for unexpected page structures.
    return containerText.length > rootText.length ? containerText : rootText;
  }

  window.__aichatmerge_extractors.zhipu = function(utils) {
    const selectors = ['.markdown-body.md-body', '.markdown-body', '.content-markdown'];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
        const text = extractWholeLatestZhipuAnswer(el, utils);
        if (text.length > 0) {
          return text;
        }
      }
    }

    return '';
  };
})();
