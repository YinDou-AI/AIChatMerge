// 千问 (Qianwen) answer extractor
(function() {
  'use strict';
  window.__panelize_extractors = window.__panelize_extractors || {};

  // Remove non-answer UI (source cards and follow-up question suggestions)
  // before extracting text.  Keep the surrounding paragraph: Qianwen may put
  // a real final point and a card in the same paragraph container.
  function cleanQianwenClone(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(
      '[data-card-type], ' +
      '.card_card_video, ' +
      '.video_note_list_item_list, ' +
      '.note-item, ' +
      '.web-item, ' +
      '.recommend-query-wrap, [class*="recommend-query-wrap"], ' +
      '[class*="source"], [class*="reference"], [class*="citation"], ' +
      '[data-source-id], [data-reference-id], ' +
      'button, [role="button"], ' +
      'script, style'
    ).forEach(e => e.remove());
    return clone;
  }

  // 千问会把正文和末尾「总结」拆成相邻分段。旧逻辑命中最后一个
  // .qk-markdown-complete 后立即返回，因此同一条回答中位于外层容器的
  // 总结节点会被遗漏。向上寻找当前回答的完整容器，既能带回总结，
  // 又不会把历史回答拼进来。
  function extractWholeLatestQianwenAnswer(root, utils) {
    let bestText = utils.extractText(cleanQianwenClone(root));
    let container = root.parentElement;

    for (let depth = 0; container && depth < 10; depth++, container = container.parentElement) {
      if (container.closest('textarea, [contenteditable="true"], form, nav, aside')) {
        break;
      }

      const completedAnswers = container.querySelectorAll('.qk-markdown-complete');
      // More than one completed answer means this is a conversation-level
      // wrapper. Do not cross that boundary into previous turns.
      if (completedAnswers.length > 1) {
        break;
      }

      const text = utils.extractText(cleanQianwenClone(container));
      if (text.length > bestText.length) {
        bestText = text;
      }

      // Prefer the complete assistant-message wrapper when the page exposes
      // one. Do not keep climbing into the conversation shell afterward.
      if (container.matches(
        '[data-message-id], [data-message-role="assistant"], [role="listitem"], article, ' +
        '[class*="message-item"], [class*="messageItem"], [class*="chat-message"], [class*="chatMessage"]'
      )) {
        break;
      }
    }

    return bestText;
  }

  window.__panelize_extractors.qianwen = function(utils) {
    // Primary: extract the full latest response container. This preserves
    // independent trailing sections such as "总结".
    const qkRoots = document.querySelectorAll('.qk-markdown-complete');
    for (let i = qkRoots.length - 1; i >= 0; i--) {
      if (!utils.isVisibleElement(qkRoots[i])) continue;
      if (qkRoots[i].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = extractWholeLatestQianwenAnswer(qkRoots[i], utils);
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
