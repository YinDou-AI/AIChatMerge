import { describe, expect, it } from 'vitest';

import { buildMergePrompt, buildFinalMergePrompt } from '../aichatmerge-panel/modules/merge-prompt.js';
import { setCurrentLocale } from '../aichatmerge-panel/modules/i18n.js';

describe('merge prompt builders', () => {
  it('includes the original question and the previous merged answer', () => {
    setCurrentLocale('zh');

    const prompt = buildFinalMergePrompt(
      '原始问题',
      '上一版融合结果正文',
      [
        { providerName: 'DeepSeek', answer: '需要修正 A' },
        { providerName: 'Kimi', answer: '同意当前融合结果，无新增修正' }
      ]
    );

    expect(prompt).toContain('[原始问题]\n原始问题');
    expect(prompt).toContain('[上一版融合结果]\n上一版融合结果正文');
    expect(prompt).toContain('[各模型复核意见]');
    expect(prompt).toContain('需要修正 A');
    expect(prompt).not.toContain('以答案综合者的全部答案为底稿');
    expect(prompt).not.toContain('必须保留上一版融合结果中仍然正确');
    expect(prompt).not.toContain('不得因为复核意见没有再次提到就删除');
    expect(prompt).not.toContain('不要只总结复核意见');
  });

  it('requires a first-line title, body, and final-line scores (zh)', () => {
    setCurrentLocale('zh');

    const mergePrompt = buildMergePrompt('问题', [
      { providerName: 'DeepSeek', answer: '回答 A' }
    ]);
    const finalPrompt = buildFinalMergePrompt('问题', '', [
      { providerName: 'Kimi', answer: '意见 B' }
    ]);

    for (const prompt of [mergePrompt, finalPrompt]) {
      expect(prompt).toContain('第一行必须是标题，格式：标题：标题内容（10字以内）');
      expect(prompt).toContain('随后输出完整正文');
      expect(prompt).toContain('最后一行输出评分');
      expect(prompt).not.toContain('不要输出空行');
      expect(prompt).not.toContain('\n\n');
    }
  });

  it('requires a first-line title, body, and final-line scores (en)', () => {
    setCurrentLocale('en');

    const mergePrompt = buildMergePrompt('question', [
      { providerName: 'DeepSeek', answer: 'answer A' }
    ]);
    const finalPrompt = buildFinalMergePrompt('question', '', [
      { providerName: 'Kimi', answer: 'review B' }
    ]);

    for (const prompt of [mergePrompt, finalPrompt]) {
      expect(prompt).toContain('The first line must be the title');
      expect(prompt).toContain('Title: title within 10 words');
      expect(prompt).toContain('then output the complete body');
      expect(prompt).toContain('the last line must be the scores');
      expect(prompt).not.toContain('Do not output blank lines');
      expect(prompt).not.toContain('\n\n');
    }
    expect(finalPrompt).toContain('[Original Question]\nquestion');
    expect(finalPrompt).toContain('[Previous Merged Result]');
    expect(finalPrompt).not.toContain("Use the answer synthesizer's entire answer as the base draft");
    expect(finalPrompt).not.toContain('Preserve all content in the previous merged result');
    expect(finalPrompt).not.toContain('do not merely summarize the review comments');

    setCurrentLocale('zh');
  });
});
