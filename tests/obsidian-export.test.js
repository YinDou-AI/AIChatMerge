import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFilePath,
  buildFrontmatter,
  buildMarkdown,
  cleanAnswer,
  escapeYamlString,
  exportToMarkdown,
  extractScores,
  extractTitle,
  normalizeExportPath,
  sanitizeFileName
} from '../modules/obsidian-export.js';
import { DEFAULT_MARKDOWN_EXPORT_PATH } from '../modules/settings.js';

describe('obsidian-export helpers', () => {
  it('extracts the last natural title line outside code blocks', () => {
    const answer = [
      '正文',
      '```',
      '标题：代码里的标题',
      '```',
      '标题：最终标题'
    ].join('\n');

    expect(extractTitle(answer)).toBe('最终标题');
  });

  it('extracts and cleans natural title lines', () => {
    const answer = '正文\n标题：四校定位与中科院资源解析';

    expect(extractTitle(answer)).toBe('四校定位与中科院资源解析');
    expect(cleanAnswer(answer, '四校定位与中科院资源解析')).not.toContain('标题：');
  });

  it('falls back to a markdown h1 title', () => {
    expect(extractTitle('前言\n# 猫砂盆除味\n正文')).toBe('猫砂盆除味');
  });

  it('returns null when no title is available', () => {
    expect(extractTitle('只有正文')).toBeNull();
  });

  it('cleans natural title lines and duplicate h1 heading', () => {
    const cleaned = cleanAnswer('# 猫砂盆除味\n正文\n标题：猫砂盆除味', '猫砂盆除味');

    expect(cleaned).not.toContain('标题：');
    expect(cleaned).not.toContain('# 猫砂盆除味');
    expect(cleaned).toContain('正文');
  });

  it('keeps raw prose formatting for downstream markdown cleanup', () => {
    const cleaned = cleanAnswer([
      '分歧仅在于跌幅的具体幅度。-',
      '上调全系列终端售价-；联想涨价-。',
      '正常-20% 不应改',
      '-',
      '### 原始问题用户补充：直接给出具体的问题---### 综合答案正文。**问题2：模糊需求**'
    ].join('\n'), null);

    expect(cleaned).toContain('分歧仅在于跌幅的具体幅度。-');
    expect(cleaned).toContain('上调全系列终端售价-；联想涨价-。');
    expect(cleaned).toContain('正常-20% 不应改');
    expect(cleaned).toContain('\n-\n');
    expect(cleaned).toContain('### 原始问题用户补充：直接给出具体的问题---### 综合答案正文。**问题2：模糊需求**');
  });

  it('preserves paragraph blank lines while trimming excessive empty space', () => {
    const cleaned = cleanAnswer('第一段\n\n第二段\n\n\n\n第三段', null);

    expect(cleaned).toContain('第一段\n\n第二段');
    expect(cleaned).toContain('第二段\n\n第三段');
    expect(cleaned).not.toContain('\n\n\n');
  });

  it('sanitizes and truncates unsafe file names', () => {
    expect(sanitizeFileName('猫砂盆：除味/清洁*方案?')).toBe('猫砂盆除味清洁方案');
    expect(sanitizeFileName('这是一个非常非常非常非常非常长的标题，需要被截断').length).toBeLessThanOrEqual(30);
  });

  it('escapes YAML strings', () => {
    expect(escapeYamlString('a"b\\c\n下一行')).toBe('a\\"b\\\\c\\n下一行');
  });

  it('builds frontmatter without null title', () => {
    const frontmatter = buildFrontmatter({
      question: '',
      providers: ['DeepSeek', 'Kimi'],
      mode: 'merge'
    }, null);

    expect(frontmatter).toContain('providers:');
    expect(frontmatter).toContain('  - "DeepSeek"');
    expect(frontmatter).toContain('source: "AIChatMerge"');
    expect(frontmatter).toContain('status: "raw"');
    expect(frontmatter).toContain('processed: false');
    expect(frontmatter).not.toContain('title:');
  });

  it('uses the same local date in frontmatter and titled file paths', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 2, 0, 8, 45));

    const frontmatter = buildFrontmatter({
      question: '',
      providers: ['DeepSeek'],
      mode: 'discuss'
    }, '标题');
    const filePath = buildFilePath('标题', { exportPath: 'AIChatMerge/raw' }, 'discuss');

    expect(frontmatter).toContain('date: "2026-07-02"');
    expect(filePath).toContain('2607020008-AI讨论-标题.md');

    vi.useRealTimers();
  });

  it('does not expose discussion rounds in exported markdown metadata', () => {
    const frontmatter = buildFrontmatter({
      question: '问题',
      providers: ['DeepSeek'],
      mode: 'discuss',
      rounds: 2
    }, '标题');

    expect(frontmatter).toContain('mode: "discuss"');
    expect(frontmatter).not.toContain('rounds:');
  });

  it('builds markdown with optional question', () => {
    const markdown = buildMarkdown({
      question: '原问题',
      answer: '# 标题\n答案正文\n标题：标题',
      providers: ['DeepSeek'],
      mode: 'merge'
    }, {}, '标题', true);

    expect(markdown).toContain('# 标题');
    expect(markdown).toContain('## 问题');
    expect(markdown).toContain('原问题');
    expect(markdown).toContain('答案正文');
    expect(markdown).not.toContain('标题：');
  });

  it('extracts scores from natural score lines and strips them from answers', () => {
    const answer = [
      '正文',
      '模型评分：DeepSeek=10，Kimi=8，ChatGPT=9'
    ].join('\n');

    expect(extractScores(answer)).toEqual([
      { model: 'DeepSeek', score: 10 },
      { model: 'Kimi', score: 8 },
      { model: 'ChatGPT', score: 9 }
    ]);
    expect(cleanAnswer(answer, null)).not.toContain('模型评分：');
  });

  it('exports scores whenever score data is provided', () => {
    const data = {
      question: '问题',
      answer: '答案',
      providers: ['DeepSeek'],
      mode: 'merge'
    };
    const scores = [{ model: 'DeepSeek', score: 9 }];

    expect(buildMarkdown(data, {}, null, false, scores)).toContain('## 评分');
  });

  it('sorts exported score rows by score without mutating extracted order', () => {
    const data = {
      question: '问题',
      answer: '答案',
      providers: ['DeepSeek', 'Kimi', 'ChatGPT'],
      mode: 'merge'
    };
    const scores = [
      { model: 'DeepSeek', score: 8 },
      { model: 'Kimi', score: 10 },
      { model: 'ChatGPT', score: 9 }
    ];
    const markdown = buildMarkdown(data, {}, null, false, scores);

    expect(markdown.indexOf('- Kimi: 10分')).toBeLessThan(markdown.indexOf('- ChatGPT: 9分'));
    expect(markdown.indexOf('- ChatGPT: 9分')).toBeLessThan(markdown.indexOf('- DeepSeek: 8分'));
    expect(scores.map(s => s.model)).toEqual(['DeepSeek', 'Kimi', 'ChatGPT']);
  });

  it('builds a vault-relative file path with a sanitized title', () => {
    const filePath = buildFilePath('猫砂盆：除味', { exportPath: 'AI/Merge' }, 'discuss');

    expect(filePath).toMatch(/^AI\/Merge\/\d{10}-AI讨论-猫砂盆除味\.md$/);
  });

  it('normalizes export paths for Chrome downloads', () => {
    expect(normalizeExportPath('D:\\AIChatMerge\\raw')).toBe('AIChatMerge/raw');
    expect(normalizeExportPath('/AIChatMerge//raw/')).toBe('AIChatMerge/raw');
    expect(normalizeExportPath('')).toBe(DEFAULT_MARKDOWN_EXPORT_PATH);
  });
});

describe('exportToMarkdown', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    global.URL.revokeObjectURL = vi.fn();
    globalThis.chrome = {
      runtime: {},
      downloads: {
        download: vi.fn((options, callback) => callback(123))
      },
      storage: {
        sync: {
          get: vi.fn()
        }
      }
    };
  });

  it('downloads markdown to the configured export folder', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      markdownExportPath: 'AI/Merge'
    });

    const result = await exportToMarkdown({
      question: '问题',
      answer: '答案',
      providers: ['DeepSeek'],
      mode: 'merge'
    });

    expect(result.success).toBe(true);
    expect(result.filePath).toMatch(/^AI\/Merge\/\d{10}-AI融合/);
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'blob:test',
        filename: expect.stringMatching(/^AI\/Merge\/\d{10}-AI融合/),
        saveAs: false
      }),
      expect.any(Function)
    );
  });

  it('uses default export path when sync settings were never saved', async () => {
    chrome.storage.sync.get.mockResolvedValue({});

    const result = await exportToMarkdown({
      question: 'Question',
      answer: 'Answer',
      providers: ['DeepSeek'],
      mode: 'merge',
    });

    expect(result.success).toBe(true);
    expect(result.filePath).toMatch(/^AIChatMerge\/raw\/\d{10}-AI融合/);
  });

  it('exports raw markdown metadata for downstream processing', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      markdownExportPath: DEFAULT_MARKDOWN_EXPORT_PATH
    });

    const result = await exportToMarkdown({
      question: 'Question',
      answer: 'Answer',
      providers: ['DeepSeek'],
      mode: 'discuss',
      rounds: 3
    });

    expect(result.markdown).toContain('status: "raw"');
    expect(result.markdown).toContain('processed: false');
    expect(result.markdown).not.toContain('rounds:');
  });
});
