import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

// answer-extractor-zhipu.js is a self-contained IIFE that registers its
// extractor function on window.__aichatmerge_extractors.  It has no ES module
// exports because it must run as a plain script in a Chrome content script
// context.  window.eval() is the correct approach to load it in tests.
const extractorSource = readFileSync(
  resolve(process.cwd(), 'content-scripts/answer-extractor-zhipu.js'),
  'utf8'
);

const utils = {
  extractText: (element) => (element.textContent || '').replace(/\s+/g, ' ').trim(),
};

describe('Zhipu answer extractor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.__aichatmerge_extractors = {};
    window.eval(extractorSource);
  });

  it('extracts every markdown block from one long latest answer', () => {
    document.body.innerHTML = `
      <section class="conversation">
        <article class="message-item"><div class="markdown-body md-body">上一轮回答</div></article>
        <article class="message-item">
          <div class="markdown-body md-body">第一部分：完整方案。</div>
          <div class="markdown-body md-body">第二部分：执行细节。</div>
          <div class="markdown-body md-body">最后一段：总结结论。</div>
        </article>
      </section>
    `;

    const answer = window.__aichatmerge_extractors.zhipu(utils);
    expect(answer).toContain('第一部分：完整方案。');
    expect(answer).toContain('第二部分：执行细节。');
    expect(answer).toContain('最后一段：总结结论。');
  });

  it('does not include the previous conversation turn', () => {
    document.body.innerHTML = `
      <section class="conversation">
        <article data-message-id="old"><div class="markdown-body">旧回答，不能被拼接。</div></article>
        <article data-message-id="latest">
          <div class="markdown-body">本轮第一段。</div>
          <div class="markdown-body">本轮最后一段。</div>
        </article>
      </section>
    `;

    const answer = window.__aichatmerge_extractors.zhipu(utils);
    expect(answer).toContain('本轮第一段。');
    expect(answer).toContain('本轮最后一段。');
    expect(answer).not.toContain('旧回答，不能被拼接。');
  });

  it('keeps the markdown block itself when no message container is available', () => {
    document.body.innerHTML = '<div class="markdown-body">独立回答内容。</div>';

    expect(window.__aichatmerge_extractors.zhipu(utils)).toBe('独立回答内容。');
  });
});
