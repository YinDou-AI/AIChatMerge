// modules/obsidian-export.js
// Markdown export module for AIChatMerge Chrome extension.
// The filename is kept for compatibility with existing imports.

import { DEFAULT_MARKDOWN_EXPORT_PATH } from './settings.js';

const TITLE_RE = /<<<\s*TITLE\s*:\s*(.+?)\s*>>>/i;
const TITLE_RE_GLOBAL = /<<<\s*TITLE\s*:\s*.+?\s*>>>/gi;
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]+`/g;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractTitle(answer) {
  if (!answer || typeof answer !== 'string') return null;

  const withoutCode = answer
    .replace(CODE_BLOCK_RE, '')
    .replace(INLINE_CODE_RE, '');

  const titleMatches = [...withoutCode.matchAll(new RegExp(TITLE_RE.source, 'gi'))];
  if (titleMatches.length > 0) {
    const last = titleMatches[titleMatches.length - 1];
    const extracted = last[1].trim();
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
    .replace(TITLE_RE_GLOBAL, '')
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

export function generateFallbackFileName(mode) {
  const prefix = mode === 'discuss' ? 'AI讨论' : 'AI融合';
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${prefix}-${date}-${hh}${mm}${ss}.md`;
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
  const date = now.toISOString().slice(0, 10);
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

export function buildMarkdown(data, config, title, includeQuestion) {
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

  return parts.join('\n');
}

export function buildFilePath(title, config, mode) {
  const prefix = mode === 'discuss' ? 'AI讨论-' : 'AI融合-';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;
  const exportPath = normalizeExportPath(config?.exportPath || config?.vaultPath);

  if (title) {
    const safeTitle = sanitizeFileName(title);
    if (safeTitle) {
      return `${exportPath}/${prefix}${date}-${safeTitle}.md`;
    }
  }

  return `${exportPath}/${generateFallbackFileName(mode)}`;
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
    const config = { exportPath };
    const title = data.title || extractTitle(data.answer);
    const markdown = buildMarkdown(data, config, title, false);
    const filePath = buildFilePath(title, config, data.mode);
    const result = await downloadMarkdown(filePath, markdown);

    return { success: true, filePath, downloadId: result.downloadId, markdown };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
