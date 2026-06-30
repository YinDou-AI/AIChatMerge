import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

// answer-extractor-qianwen.js is a self-contained IIFE that registers its
// extractor function on window.__aichatmerge_extractors.  It has no ES module
// exports because it must run as a plain script in a Chrome content script
// context.  window.eval() is the correct approach to load it in tests.
const extractorSource = readFileSync(
  resolve(process.cwd(), 'content-scripts/answer-extractor-qianwen.js'),
  'utf8'
);

const utils = {
  isVisibleElement: () => true,
  extractText: (element) => (element.textContent || '').trim(),
  extractFromRoleList: () => '',
  extractFromRoleLog: () => '',
};

describe('Qianwen answer extractor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.__aichatmerge_extractors = {};
    window.eval(extractorSource);
  });

  it('includes a trailing summary rendered beside the latest markdown node', () => {
    document.body.innerHTML = `
      <div class="conversation">
        <article class="message-item"><div class="qk-markdown-complete">旧回答</div></article>
        <article class="message-item">
          <div class="qk-markdown-complete">正文内容</div>
          <section class="answer-summary">总结：完整结论</section>
          <button>复制</button>
        </article>
      </div>
    `;

    const answer = window.__aichatmerge_extractors.qianwen(utils);
    expect(answer).toContain('正文内容');
    expect(answer).toContain('总结：完整结论');
  });

  it('does not combine a previous answer from the conversation wrapper', () => {
    document.body.innerHTML = `
      <div class="conversation">
        <article><div class="qk-markdown-complete">上一轮回答</div></article>
        <article><div class="qk-markdown-complete">本轮正文</div><div>总结：本轮结论</div></article>
      </div>
    `;

    const answer = window.__aichatmerge_extractors.qianwen(utils);
    expect(answer).toContain('本轮正文');
    expect(answer).toContain('总结：本轮结论');
    expect(answer).not.toContain('上一轮回答');
  });

  it('keeps a final section while excluding source-card text from the same response', () => {
    document.body.innerHTML = `
      <article data-message-id="latest">
        <div><div class="qk-markdown-complete">观点 1 至观点 4</div></div>
        <div class="qk-markdown-complete">
          <div class="qk-md-paragraph qk-md-has-multi-modal">
            观点 5：保持通风并定期更换猫砂。
            <div data-card-type="video_note_list" class="card_card_video">6篇来源深圳潮湿天气如何保持猫砂盆干燥？</div>
          </div>
        </div>
      </article>
    `;

    const answer = window.__aichatmerge_extractors.qianwen(utils);
    expect(answer).toContain('观点 5：保持通风并定期更换猫砂。');
    expect(answer).not.toContain('6篇来源');
  });

  it('excludes follow-up question suggestions after the real final sentence', () => {
    document.body.innerHTML = `
      <div class="chat-answers-card-wrap">
        <div class="qk-markdown-complete">
          只要坚持“勤清理、深洗盆、强吸附、调饮食”这套组合拳，
          就能从源头上长期解决猫砂盆的异味问题。
        </div>
        <div class="message-card-j_n6rq">
          <div class="recommend-query-wrap animate">
            猫砂盆深度清洁的具体步骤是什么？
            混合砂和膨润土猫砂怎么选？
            纳米矿晶除味效果比小苏打好吗？
          </div>
        </div>
      </div>
    `;

    const answer = window.__aichatmerge_extractors.qianwen(utils);
    expect(answer).toContain('只要坚持“勤清理、深洗盆、强吸附、调饮食”这套组合拳');
    expect(answer).not.toContain('猫砂盆深度清洁的具体步骤是什么？');
    expect(answer).not.toContain('纳米矿晶除味效果比小苏打好吗？');
  });
});
