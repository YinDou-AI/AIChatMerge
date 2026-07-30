import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanCopyText,
  extractByDirectSelector,
} from '../content-scripts/src/providers/answer-extraction.js';
import { setExtractMode } from '../content-scripts/src/providers/dom-utils.js';

describe('active answer extraction', () => {
  afterEach(() => {
    setExtractMode(false);
    document.body.innerHTML = '';
  });

  it('returns the latest Qianwen answer across fallback selector variants', () => {
    setExtractMode(true);
    document.body.innerHTML = `
      <main>
        <section class="qk-markdown-complete">older but much longer answer that must not win</section>
        <section class="qk-markdown">current answer</section>
      </main>
    `;

    expect(extractByDirectSelector('qianwen')).toBe('current answer');
  });

  it('does not treat generic assistant or answer class names as Qianwen answer nodes', () => {
    setExtractMode(true);
    document.body.innerHTML = `
      <aside class="assistant-sidebar">unrelated assistant navigation</aside>
      <div class="answer-history">entire old conversation</div>
    `;

    expect(extractByDirectSelector('qianwen')).toBeNull();
  });

  it('removes blank lines without joining body, title and scores', () => {
    const answer = [
      '正文内容',
      '',
      '',
      '标题：测试回复汇总  ',
      '',
      '模型评分：Claude=10',
    ].join('\r\n');

    expect(cleanCopyText(answer)).toBe(
      '正文内容\n标题：测试回复汇总\n模型评分：Claude=10'
    );
  });
});
