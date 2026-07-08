// modules/obsidian-export.js
// Markdown export module for AIChatMerge Chrome extension.
// The filename is kept for compatibility with existing imports.

import { DEFAULT_MARKDOWN_EXPORT_PATH } from './settings.js';

const NATURAL_TITLE_RE = /(?:^|\n)[ \t]*(?:标题|Title)\s*[:：]\s*(.+?)[ \t]*(?=\n|$)/gi;
const NATURAL_TITLE_RE_GLOBAL = /(?:^|\n)[ \t]*(?:标题|Title)\s*[:：]\s*.+?[ \t]*(?=\n|$)/gi;
const NATURAL_SCORES_RE = /(?:^|\n)[ \t]*(?:模型评分|评分|Model scores?|Scores?)\s*[:：]\s*(.+?)[ \t]*(?=\n|$)/gi;
const NATURAL_SCORES_RE_GLOBAL = /(?:^|\n)[ \t]*(?:模型评分|评分|Model scores?|Scores?)\s*[:：]\s*.+?[ \t]*(?=\n|$)/gi;
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]+`/g;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractScores(answer) {
  if (!answer || typeof answer !== 'string') return null;
  const withoutCode = answer.replace(CODE_BLOCK_RE, '').replace(INLINE_CODE_RE, '');
  const matches = [...withoutCode.matchAll(NATURAL_SCORES_RE)];
  if (matches.length === 0) return null;

  const scoreText = matches[matches.length - 1][1];
  const scores = [];
  const pairRe = /^\s*([^:=：＝,，;；\n|]+?)\s*[:：=＝]\s*(10|[1-9])(?:\s*分)?\s*$/;
  for (const part of scoreText.split(/[,，;；、|]+/)) {
    const match = part.match(pairRe);
    if (!match) continue;
    const model = match[1]
      .replace(/^[\s\-*•·、]+/, '')
      .trim();
    const score = Number.parseInt(match[2], 10);
    if (model && Number.isFinite(score)) {
      scores.push({ model, score });
    }
  }

  if (scores.length === 0) return null;
  return scores;
}

function isEnabledSetting(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue;
  if (value === false || value === 'false') return false;
  return true;
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function extractTitle(answer) {
  if (!answer || typeof answer !== 'string') return null;

  const withoutCode = answer
    .replace(CODE_BLOCK_RE, '')
    .replace(INLINE_CODE_RE, '');

  const naturalTitleMatches = [...withoutCode.matchAll(NATURAL_TITLE_RE)];
  if (naturalTitleMatches.length > 0) {
    const last = naturalTitleMatches[naturalTitleMatches.length - 1];
    const extracted = last[1].replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
    if (extracted) return extracted;
  }

  const headingMatch = answer.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    const extracted = headingMatch[1].trim();
    if (extracted) return extracted;
  }

  return null;
}

export function cleanAnswer(answer, extractedTitle) {
  if (!answer || typeof answer !== 'string') return '';
  let cleaned = answer
    .replace(NATURAL_TITLE_RE_GLOBAL, '\n')
    .replace(NATURAL_SCORES_RE_GLOBAL, '\n')
    .replace(/\n{3,}/g, '\n\n');

  if (extractedTitle) {
    cleaned = cleaned.replace(new RegExp(`^#\\s+${escapeRegExp(extractedTitle)}\\s*$`, 'm'), '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  }

  return cleaned;
}

export function sanitizeFileName(title) {
  if (!title || typeof title !== 'string') return '';

  let sanitized = title
    .replace(/[\/\\:*?"<>|：​‌‍﻿]/g, '')
    .trim();

  if (sanitized.length <= 30) return sanitized;

  const maxLen = 30;
  const breakChars = /[\s，。、；,.;]/;
  let breakAt = -1;
  for (let i = maxLen - 1; i >= 0; i--) {
    if (breakChars.test(sanitized[i])) {
      breakAt = i;
      break;
    }
  }

  sanitized = breakAt > 0 ? sanitized.slice(0, breakAt) : sanitized.slice(0, maxLen);
  return sanitized.trim();
}

export function escapeYamlString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

export function normalizeExportPath(path) {
  const normalized = String(path || DEFAULT_MARKDOWN_EXPORT_PATH)
    .replace(/\\/g, '/')
    .replace(/^[a-zA-Z]:\//, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
    .trim();

  return normalized || DEFAULT_MARKDOWN_EXPORT_PATH;
}

export function buildFrontmatter(data, title) {
  const now = new Date();
  const date = formatLocalDate(now);
  const created = now.toISOString();
  const source = 'AIChatMerge';
  const mode = data.mode || 'merge';
  const providersYaml = (data.providers || [])
    .map(p => `  - "${escapeYamlString(p)}"`)
    .join('\n');

  let yaml = '---\n';
  yaml += `date: "${escapeYamlString(date)}"\n`;
  yaml += `created: "${escapeYamlString(created)}"\n`;
  yaml += `source: "${escapeYamlString(source)}"\n`;
  yaml += 'status: "raw"\n';
  yaml += 'processed: false\n';
  yaml += `providers:\n${providersYaml}\n`;
  yaml += `mode: "${escapeYamlString(mode)}"\n`;
  if (title) {
    yaml += `title: "${escapeYamlString(title)}"\n`;
  }
  if (data.question && data.question.trim()) {
    yaml += `question: "${escapeYamlString(data.question.trim())}"\n`;
  }
  yaml += '---\n';
  return yaml;
}

export function buildMarkdown(data, config, title, includeQuestion, scores) {
  const parts = [];

  parts.push(buildFrontmatter(data, title));
  parts.push('');

  if (title) {
    parts.push(`# ${title}`);
    parts.push('');
  }

  if (includeQuestion && data.question && data.question.trim()) {
    parts.push('## 问题');
    parts.push('');
    parts.push(data.question.trim());
    parts.push('');
  }

  const providersStr = (data.providers || []).join(', ');
  parts.push(`> 融合自: ${providersStr}`);
  parts.push('');
  parts.push(cleanAnswer(data.answer, title));

  if (scores && scores.length > 0) {
    parts.push('');
    parts.push('## 评分');
    [...scores]
      .sort((a, b) => b.score - a.score)
      .forEach(s => {
      parts.push(`- ${s.model}: ${s.score}分`);
    });
  }

  return parts.join('\n');
}

export function buildFilePath(title, config, mode) {
  const prefix = mode === 'discuss' ? 'AI讨论' : 'AI融合';
  const now = new Date();
  const ts = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0')
  ].join('');
  const exportPath = normalizeExportPath(config?.exportPath || config?.vaultPath);

  if (title) {
    const safeTitle = sanitizeFileName(title);
    if (safeTitle) {
      return `${exportPath}/${ts}-${prefix}-${safeTitle}.md`;
    }
  }

  return `${exportPath}/${ts}-${prefix}.md`;
}

function downloadMarkdown(filePath, markdown) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
      chrome.downloads.download({
        url,
        filename: filePath,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        const error = chrome.runtime?.lastError;
        cleanup();
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve({ downloadId });
      });
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filePath;
    document.body.appendChild(a);
    a.click();
    a.remove();
    cleanup();
    resolve({ downloadId: null });
  });
}

export async function exportToMarkdown(data) {
  try {
    const syncData = await chrome.storage.sync.get({
      markdownExportPath: DEFAULT_MARKDOWN_EXPORT_PATH,
      obsidianVaultPath: ''
    });

    const exportPath = normalizeExportPath(syncData.markdownExportPath || syncData.obsidianVaultPath);
    const config = {
      exportPath
    };
    const title = data.title || extractTitle(data.answer);
    const scores = data.scores || null;
    const markdown = buildMarkdown(data, config, title, false, scores);
    const filePath = buildFilePath(title, config, data.mode);
    const result = await downloadMarkdown(filePath, markdown);

    return { success: true, filePath, downloadId: result.downloadId, markdown };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
