import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFilePath,
  buildFrontmatter,
  buildMarkdown,
  cleanAnswer,
  escapeYamlString,
  exportToMarkdown,
  extractTitle,
  normalizeExportPath,
  sanitizeFileName
} from '../modules/obsidian-export.js';
import { DEFAULT_MARKDOWN_EXPORT_PATH } from '../modules/settings.js';

describe('obsidian-export helpers', () => {
  it('extracts the last TITLE tag outside code blocks', () => {
    const answer = [
      '正文',
      '```',
      '<<<TITLE:代码里的标题>>>',
      '```',
      '<<<TITLE:最终标题>>>'
    ].join('\n');

    expect(extractTitle(answer)).toBe('最终标题');
  });

  it('falls back to a markdown h1 title', () => {
    expect(extractTitle('前言\n# 猫砂盆除味\n正文')).toBe('猫砂盆除味');
  });

  it('returns null when no title is available', () => {
    expect(extractTitle('只有正文')).toBeNull();
  });

  it('cleans title tags and duplicate h1 heading', () => {
    const cleaned = cleanAnswer('# 猫砂盆除味\n正文\n<<<TITLE:猫砂盆除味>>>', '猫砂盆除味');

    expect(cleaned).not.toContain('<<<TITLE');
    expect(cleaned).not.toContain('# 猫砂盆除味');
    expect(cleaned).toContain('正文');
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
      answer: '# 标题\n答案正文\n<<<TITLE:标题>>>',
      providers: ['DeepSeek'],
      mode: 'merge'
    }, {}, '标题', true);

    expect(markdown).toContain('# 标题');
    expect(markdown).toContain('## 问题');
    expect(markdown).toContain('原问题');
    expect(markdown).toContain('答案正文');
    expect(markdown).not.toContain('<<<TITLE');
  });

  it('builds a vault-relative file path with a sanitized title', () => {
    const filePath = buildFilePath('猫砂盆：除味', { exportPath: 'AI/Merge' }, 'discuss');

    expect(filePath).toMatch(/^AI\/Merge\/AI讨论-\d{4}-\d{2}-\d{2}-猫砂盆除味\.md$/);
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
    expect(result.filePath).toMatch(/^AI\/Merge\/AI融合-/);
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'blob:test',
        filename: expect.stringMatching(/^AI\/Merge\/AI融合-/),
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
    expect(result.filePath).toMatch(/^AIChatMerge\/raw\/AI融合-/);
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
