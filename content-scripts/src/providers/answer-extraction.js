// answer-extraction.js — 4阶段答案提取
// 日志前缀：text-injection:extract

import { detectProvider, PROVIDER_SELECTORS, SEND_BUTTON_SELECTORS, NEW_CHAT_BUTTON_SELECTORS } from './detection.js';
import { isVisibleElement } from './dom-utils.js';
import {
  DIRECT_ANSWER_SELECTORS,
  COPY_BUTTON_SELECTORS,
  COPY_BUTTON_ANSWER_SELECTORS
} from './answer-selectors.js';

// Re-export selectors for existing importers
export { DIRECT_ANSWER_SELECTORS, COPY_BUTTON_SELECTORS, COPY_BUTTON_ANSWER_SELECTORS } from './answer-selectors.js';

export function extractText(el) {
  if (!el) return '';
  const clone = el.cloneNode(true);
  clone.querySelectorAll('script, style, noscript, svg').forEach(e => e.remove());
  return normalizeExtractedText(extractReadableText(clone));
}

function normalizeExtractedText(text) {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function appendTextPart(parts, text) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (normalized) parts.push(normalized);
}

function appendLineBreak(parts, forceBlankLine = false) {
  if (parts.length === 0) return;
  const last = parts[parts.length - 1];
  if (last === '\n\n') return;
  if (forceBlankLine) {
    if (last === '\n') parts[parts.length - 1] = '\n\n';
    else parts.push('\n\n');
    return;
  }
  if (last !== '\n') parts.push('\n');
}

function extractReadableText(node) {
  const parts = [];
  const blockTags = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'DT', 'DD',
    'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5',
    'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION',
    'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
  ]);

  function walk(current) {
    if (!current) return;

    if (current.nodeType === Node.TEXT_NODE) {
      appendTextPart(parts, current.nodeValue);
      return;
    }

    if (current.nodeType !== Node.ELEMENT_NODE) return;

    const tag = current.tagName;
    if (tag === 'BR') {
      appendLineBreak(parts);
      return;
    }

    if (tag === 'HR') {
      appendLineBreak(parts, true);
      parts.push('---');
      appendLineBreak(parts, true);
      return;
    }

    if (tag === 'PRE' || tag === 'CODE') {
      const raw = current.textContent || '';
      if (raw.trim()) parts.push(raw);
      appendLineBreak(parts, tag === 'PRE');
      return;
    }

    if (/^H[1-6]$/.test(tag)) {
      appendLineBreak(parts, true);
      parts.push(`${'#'.repeat(Number(tag[1]))} `);
      for (const child of current.childNodes) {
        walk(child);
      }
      appendLineBreak(parts, true);
      return;
    }

    const isBlock = blockTags.has(tag);
    if (isBlock) appendLineBreak(parts);

    if (tag === 'LI') {
      const textBefore = parts.join('').trimEnd();
      if (!/(\n|^)[-*]\s*$/.test(textBefore)) {
        parts.push('- ');
      }
    }

    for (const child of current.childNodes) {
      walk(child);
    }

    if (isBlock) appendLineBreak(parts, tag !== 'LI');
  }

  walk(node);
  return parts.join('');
}

// Clean known noise patterns from extracted answer text
export function cleanCopyText(text) {
  const patterns = [
    /(?:\[]?\(?@?mark_underline=\d+\)?|\[citation:\d+\]|\[\])+/g,
    /<grok:render[^>]*>[\s\S]*?<\/grok:render>/g,
    /Request interrupted by user\s*/g,
    /以上内容为 AI 生成，不代表开发者立场，请勿删除或修改本标记\s*/g,
    /以上内容为 AI 生成，仅供参考，请仔细甄别\s*/g,
    /内容由AI生成，仅供参考\s*/g,
    /内容由 AI 生成，仅供/g,
    /内容由AI生成，请仔细甄别/g,
    /内容由 AI 生成，请仔细甄别/g,
    /NaN\/\s*/g,
    /Scroll to the (top|bottom)\s*/gi,
    /View.*sources?\s*/gi,
    /Ask follow-up\s*/gi,
    /[ \t]+$/gm,
  ];
  let cleaned = text;
  for (const p of patterns) {
    cleaned = cleaned.replace(p, '');
  }
  // Remove blank lines while preserving the line boundary. Replacing repeated
  // newlines with an empty string would glue body, title and scores together.
  return cleaned
    .replace(/\r\n?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// 为 SSE 文本注入换行符（SSE 流式文本没有段落结构）
export function addLineBreaks(text) {
  if (!text) return text;
  return text
    // 中文句号/问号/感叹号 + 后续中文字符 → 加换行
    .replace(/([。！？])([一-鿿])/g, '$1\n$2')
    // 英文句号/问号/感叹号 + 空格 + 大写字母 → 加换行
    .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
    // 编号列表 (1. 2. 3. 或 1、2、3、) → 加换行
    .replace(/(\d+[.、])\s*/g, '\n$1 ')
    // 项目符号 → 加换行
    .replace(/([•·\-])\s+/g, '\n$1 ')
    // 清理多余空行
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Phase 1: Try direct answer selectors for the given provider.
 * Returns the LAST visible match's text (most recent answer).
 * Strips citation markers before extracting text.
 */
export function extractByDirectSelector(provider) {
  const selectors = DIRECT_ANSWER_SELECTORS[provider];
  if (!selectors) return null;

  let elements = [];
  try {
    // A union query preserves document order across fallback selectors. Looping
    // selector-by-selector could return an older answer matched by a preferred
    // selector before seeing the current answer matched by a fallback.
    elements = [...document.querySelectorAll(selectors.join(','))];
  } catch (_) {
    elements = selectors.flatMap(selector => {
      try { return [...document.querySelectorAll(selector)]; } catch { return []; }
    });
    elements = [...new Set(elements)];
    elements.sort((a, b) => {
      if (a === b) return 0;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  for (let i = elements.length - 1; i >= 0; i--) {
    if (!isVisibleElement(elements[i])) continue;
    if (elements[i].closest('textarea, [contenteditable="true"], form, nav, aside, footer, [role="navigation"]')) continue;
    const clone = elements[i].cloneNode(true);
    clone.querySelectorAll(
      '.ds-markdown-cite, .ds-markdown-cite *, ' +
      '._2ed5dee, .options-item-Yv7oFR, ' +
      '.hyc-common-markdown__ref-list, .qk-md-has-multi-modal, ' +
      'script, style, sup, a[href] sup, ' +
      '[class*="citation"], [class*="reference"], [class*="footnote"], ' +
      'a[class*="cite"], [class*="options-item"]'
    ).forEach(el => el.remove());
    clone.querySelectorAll('svg').forEach(el => el.remove());
    const text = extractText(clone);
    if (text.length > 0) {
      return text;
    }
  }
  return null;
}

/**
 * Run only the provider-owned extractor.
 *
 * Completion monitoring uses this as a narrow fallback when the provider's
 * direct selectors no longer match. Keeping this separate from
 * extractLatestAnswer avoids treating generic page text (including the user's
 * prompt) as a newly generated answer.
 */
export function extractByProviderExtractor(provider) {
  const extractor = window.__aichatmerge_extractors?.[provider];
  if (typeof extractor !== 'function') return null;

  try {
    const result = extractor(window.__aichatmerge_extractor_utils);
    return typeof result === 'string' && result.trim() ? result : null;
  } catch (error) {
    console.warn('[Extract] Provider extractor error for', provider, error);
    return null;
  }
}

/**
 * Phase 3: Find copy button, walk up DOM, use provider-specific selectors scoped to container.
 */
export function extractByCopyButton(provider) {
  const btnSelectors = COPY_BUTTON_SELECTORS[provider];
  if (!btnSelectors) return null;

  const ansSel = COPY_BUTTON_ANSWER_SELECTORS[provider] || ['.markdown-body'];

  for (const btnSel of btnSelectors) {
    try {
      const btns = document.querySelectorAll(btnSel);
      for (const btn of btns) {
        let el = btn.parentElement;
        for (let depth = 0; depth < 10 && el; depth++) {
          for (const as of ansSel) {
            try {
              const matches = el.querySelectorAll(as);
              for (let i = matches.length - 1; i >= 0; i--) {
                if (matches[i].contains(btn) || btn.contains(matches[i])) continue;
                const t = extractText(matches[i]);
                if (t.length > 0) {
                  return t;
                }
              }
            } catch (_) {}
          }
          el = el.parentElement;
        }
      }
    } catch (_) {}
  }
  return null;
}

export function extractGenericMarkdownAnswer() {
  const bodies = document.querySelectorAll('.markdown-body');
  for (let i = bodies.length - 1; i >= 0; i--) {
    if (bodies[i].closest('textarea, [contenteditable="true"], form, nav, aside, footer, [role="navigation"]')) continue;
    const text = extractText(bodies[i]);
    if (text.length > 0) {
      if (text.length > 50) return text;
    }
  }
  const logAreas = document.querySelectorAll('[role="log"], [role="region"]');
  for (let i = logAreas.length - 1; i >= 0; i--) {
    const text = extractText(logAreas[i]);
    if (text.length > 0) return text;
  }
  return '';
}

// Shared fallback extractors used by multiple provider extractors
export function extractFromRoleLog() {
  const logArea = document.querySelector('[role="log"]');
  if (!logArea) return '';
  const text = extractText(logArea);
  if (text.length > 0) return text;
  for (let i = logArea.children.length - 1; i >= 0; i--) {
    const childText = extractText(logArea.children[i]);
    if (childText.length > 0) return childText;
  }
  return '';
}

export function extractFromRoleList() {
  const lists = document.querySelectorAll('[role="list"]');
  for (let i = lists.length - 1; i >= 0; i--) {
    const items = lists[i].querySelectorAll('[role="listitem"]');
    for (let j = items.length - 1; j >= 0; j--) {
      if (items[j].closest('textarea, [contenteditable="true"], form, nav, aside')) continue;
      const text = extractText(items[j]);
      if (text.length > 0) return text;
    }
  }
  return '';
}

export function extractLatestAnswer() {
  const provider = detectProvider();
  const utils = window.__aichatmerge_extractor_utils;
  const extractors = window.__aichatmerge_extractors || {};
  const diag = { provider, phases: [], winner: null, finalLen: 0 };

  // Phase 1: Try provider-specific extractor first (most precise)
  if (extractors[provider]) {
    const result = extractByProviderExtractor(provider);
    if (result) {
      diag.phases.push({ phase: 1, name: 'provider-extractor', hit: true, len: result.length });
      diag.winner = 'provider-extractor';
      diag.finalLen = result.length;
      window.__aichatmerge_lastExtractDiag = diag;
      return result;
    }
    diag.phases.push({ phase: 1, name: 'provider-extractor', hit: false, len: 0 });
  } else {
    diag.phases.push({ phase: 1, name: 'provider-extractor', skipped: true, reason: 'no-extractor' });
  }

  // Phase 2: Try direct answer selectors
  const directResult = extractByDirectSelector(provider);
  if (directResult) {
    diag.phases.push({ phase: 2, name: 'direct-selector', hit: true, len: directResult.length });
    diag.winner = 'direct-selector';
    diag.finalLen = directResult.length;
    window.__aichatmerge_lastExtractDiag = diag;
    return directResult;
  }
  diag.phases.push({ phase: 2, name: 'direct-selector', hit: false, len: 0 });

  // Phase 3: Try copy button approach
  const copyBtnResult = extractByCopyButton(provider);
  if (copyBtnResult) {
    diag.phases.push({ phase: 3, name: 'copy-button', hit: true, len: copyBtnResult.length });
    diag.winner = 'copy-button';
    diag.finalLen = copyBtnResult.length;
    window.__aichatmerge_lastExtractDiag = diag;
    return copyBtnResult;
  }
  diag.phases.push({ phase: 3, name: 'copy-button', hit: false, len: 0 });

  // Phase 4: Generic markdown body
  const genericResult = extractGenericMarkdownAnswer();
  if (genericResult) {
    diag.winner = 'generic-markdown';
    diag.finalLen = genericResult.length;
  }
  diag.phases.push({ phase: 4, name: 'generic-markdown', hit: !!genericResult, len: genericResult ? genericResult.length : 0 });

  // 所有阶段都失败时，dump 页面实际 DOM 结构用于诊断
  if (!genericResult) {
    try {
      const dsClasses = new Set();
      document.querySelectorAll('[class*="ds-"]').forEach(el => {
        if (typeof el.className === 'string') {
          el.className.split(/\s+/).filter(c => c.startsWith('ds-')).forEach(c => dsClasses.add(c));
        }
      });
      diag.domDump = {
        bodyTextLen: (document.body?.innerText || '').length,
        bodyChildCount: document.body?.children?.length || 0,
        assistantMessages: document.querySelectorAll('[class*="assistant"]').length,
        messageContainers: document.querySelectorAll('[class*="message"]').length,
        markdownBodies: document.querySelectorAll('.markdown-body').length,
        dsClasses: [...dsClasses].slice(0, 30),
        iframeCount: document.querySelectorAll('iframe').length,
        shadowHosts: (() => { let c = 0; document.querySelectorAll('*').forEach(el => { if (el.shadowRoot) c++; }); return c; })(),
        topChildren: Array.from(document.body?.children || []).slice(0, 10).map(el =>
          `${el.tagName}.${(el.className || '').toString().split(/\s+/).slice(0, 2).join('.')}`
        ),
        // 千问专用诊断
        qianwenDiag: (() => {
          if (provider !== 'qianwen') return null;
          const qkSelectors = ['.qk-markdown-complete', '#qk-markdown-react', '.qk-markdown', '[class*="qk-markdown"]', '[class*="markdown-body"]', '.markdown-body'];
          return qkSelectors.map(sel => {
            try {
              const els = document.querySelectorAll(sel);
              return {
                selector: sel,
                count: els.length,
                textLens: [...els].map(el => (el.textContent || '').trim().length).slice(0, 5),
              };
            } catch (_) { return { selector: sel, error: true }; }
          });
        })(),
      };
    } catch (_) {}
  }

  window.__aichatmerge_lastExtractDiag = diag;
  return genericResult;
}

// 暴露共享工具
window.__aichatmerge_extractor_utils = {
  isVisibleElement,
  extractText,
  cleanCopyText,
  extractByDirectSelector,
  extractByCopyButton,
  extractGenericMarkdownAnswer,
  extractFromRoleLog,
  extractFromRoleList
};

// Trigger via: postMessage({ type: 'HEALTH_CHECK', context: 'multi-panel' })
export function runHealthCheck() {
  const provider = detectProvider();
  if (!provider) {
    console.warn('[Health Check] Unknown provider');
    return { provider: null, status: 'unknown-provider' };
  }

  const results = { provider, input: [], send: [], extract: [], newChat: [] };

  // Check input selectors
  const inputSelectors = PROVIDER_SELECTORS[provider] || [];
  for (const sel of inputSelectors) {
    try {
      const el = document.querySelector(sel);
      results.input.push({ selector: sel, found: !!el, visible: el ? isVisibleElement(el) : false });
    } catch (e) {
      results.input.push({ selector: sel, error: e.message });
    }
  }

  // Check send button selectors
  const sendSelectors = SEND_BUTTON_SELECTORS[provider] || [];
  for (const sel of sendSelectors) {
    try {
      const el = document.querySelector(sel);
      results.send.push({ selector: sel, found: !!el, visible: el ? isVisibleElement(el) : false });
    } catch (e) {
      results.send.push({ selector: sel, error: e.message });
    }
  }

  // Check answer extraction selectors
  const directSelectors = DIRECT_ANSWER_SELECTORS[provider] || [];
  for (const sel of directSelectors) {
    try {
      const els = document.querySelectorAll(sel);
      const visibleCount = [...els].filter(e => isVisibleElement(e)).length;
      results.extract.push({ selector: sel, count: els.length, visibleCount });
    } catch (e) {
      results.extract.push({ selector: sel, error: e.message });
    }
  }

  // Check provider-specific extractor
  const extractors = window.__aichatmerge_extractors || {};
  if (extractors[provider]) {
    try {
      const text = extractors[provider](window.__aichatmerge_extractor_utils);
      results.extract.push({ extractor: provider, returned: text.length > 0, length: text.length });
    } catch (e) {
      results.extract.push({ extractor: provider, error: e.message });
    }
  }

  // Check new chat button selectors
  const newChatSelectors = NEW_CHAT_BUTTON_SELECTORS[provider] || [];
  for (const sel of newChatSelectors) {
    try {
      const el = document.querySelector(sel);
      results.newChat.push({ selector: sel, found: !!el, visible: el ? isVisibleElement(el) : false });
    } catch (e) {
      results.newChat.push({ selector: sel, error: e.message });
    }
  }

  // Summary
  const hasInput = results.input.some(s => s.visible);
  const hasSend = results.send.some(s => s.visible);
  const hasExtract = results.extract.some(s => (s.visibleCount > 0) || (s.returned === true));

  results.summary = {
    inputOk: hasInput,
    sendOk: hasSend,
    extractOk: hasExtract,
    verdict: hasInput && hasSend ? (hasExtract ? 'OK' : 'EXTRACTION_NEEDED') : 'BROKEN'
  };

  console.log(`[Health Check] ${provider}:`, results.summary);

  return results;
}
