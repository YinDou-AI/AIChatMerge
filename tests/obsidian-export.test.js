import { describe, expect, it, vi } from 'vitest';
import {
  buildFilePath,
  cleanAnswer,
  extractScores,
  isGeneratedFallbackTitle,
  resolveExportTitle,
  sanitizeFileName
} from '../modules/obsidian-export.js';

describe('obsidian-export helpers', () => {
  it('detects generated merge fallback titles', () => {
    expect(isGeneratedFallbackTitle('AI融合-2026-07-06-152306')).toBe(true);
    expect(isGeneratedFallbackTitle('M5 Air高负载实测')).toBe(false);
  });

  it('does not use generated fallback titles as exported document titles', () => {
    expect(resolveExportTitle({
      title: 'AI融合-2026-07-06-152306',
      answer: '融合正文，没有标题'
    })).toBeNull();
  });

  it('keeps explicit natural titles for exported documents', () => {
    expect(resolveExportTitle({
      title: 'M5 Air高负载实测',
      answer: '正文'
    })).toBe('M5 Air高负载实测');
  });

  it('keeps generated fallback titles out of discussion filenames', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 6, 15, 23, 6));

    const filePath = buildFilePath(resolveExportTitle({
      title: 'AI融合-2026-07-06-152306',
      answer: '正文'
    }), { exportPath: 'AIChatMerge/raw' }, 'discuss');

    expect(filePath).toBe('AIChatMerge/raw/2607061523-AI讨论.md');
    expect(filePath).not.toContain('AI讨论-AI融合');

    vi.useRealTimers();
  });

  it('sanitizes punctuation in file titles', () => {
    expect(sanitizeFileName('猫砂盆：除味/方案')).toBe('猫砂盆除味方案');
  });

  it('uses a trailing natural title in the discussion filename', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29, 15, 40, 0));

    const answer = [
      '最终正文',
      '标题：AI硬件公司终稿',
      '模型评分：文心一言=9.2，豆包=9.5，DeepSeek=9.6'
    ].join('\n');
    const title = resolveExportTitle({
      title: 'AI融合-2026-07-29-154000',
      answer
    });

    expect(title).toBe('AI硬件公司终稿');
    expect(buildFilePath(title, { exportPath: 'AIChatMerge/raw' }, 'discuss'))
      .toBe('AIChatMerge/raw/2607291540-AI讨论-AI硬件公司终稿.md');

    vi.useRealTimers();
  });

  it('prefers the first standalone title under the first-line title contract', () => {
    expect(resolveExportTitle({
      answer: [
        '标题：测试回复汇总',
        '正文中保留旧资料标题：不应覆盖第一行',
        '标题：兼容性尾部标题'
      ].join('\n')
    })).toBe('测试回复汇总');
  });

  it('recovers a first-line title when provider extraction drops the title label', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29, 21, 26, 0));

    const answer = [
      '：双轨重塑',
      'AI 学习机在两个领域形成了不同的产品逻辑。'
    ].join('\n');
    const title = resolveExportTitle({ answer });

    expect(title).toBe('双轨重塑');
    expect(cleanAnswer(answer, title))
      .toBe('\nAI 学习机在两个领域形成了不同的产品逻辑。');
    expect(buildFilePath(title, { exportPath: 'AIChatMerge/raw' }, 'merge'))
      .toBe('AIChatMerge/raw/2607292126-AI融合-双轨重塑.md');

    vi.useRealTimers();
  });

  it('extracts decimal model scores between 0 and 10', () => {
    expect(extractScores(
      '模型评分：文心一言=9.2，豆包=9.5，Kimi=9.0，DeepSeek=9.6'
    )).toEqual([
      { model: '文心一言', score: 9.2 },
      { model: '豆包', score: 9.5 },
      { model: 'Kimi', score: 9 },
      { model: 'DeepSeek', score: 9.6 }
    ]);
  });
});
