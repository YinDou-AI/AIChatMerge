import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

// Mirrors aichatmerge-panel/multi-panel.js sanitizeMergedAnswerForDiscussion.
function isMeaninglessStandaloneSymbolLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;
  return /^[\-–—_*•·.,，、;；:：|/\\()[\]{}<>《》【】"'“”‘’`~!！?？=+^$#@%&]+$/.test(trimmed);
}

function sanitizeMergedAnswerForDiscussion(answer) {
  let inCodeBlock = false;

  return String(answer || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(line => {
      if (/^\s*```/.test(line)) {
        inCodeBlock = !inCodeBlock;
        return true;
      }

      if (inCodeBlock) return true;
      if (!String(line || '').trim()) return false;
      return !isMeaninglessStandaloneSymbolLine(line);
    })
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

describe('discussion answer cleanup', () => {
  it('removes orphan symbol-only lines before sending merged answers to discussion', () => {
    const input = `【豆包】【DeepSeek】：
-
功耗限制：拉低至-20%
到-30%
---
核心频率：下限锁定800MHz，上限1200MHz
*
显存频率：下限500MHz`;

    expect(sanitizeMergedAnswerForDiscussion(input)).toBe(`【豆包】【DeepSeek】：
功耗限制：拉低至-20%
到-30%
核心频率：下限锁定800MHz，上限1200MHz
显存频率：下限500MHz`);
  });

  it('keeps meaningful negative values, provider labels, and code block content', () => {
    const input = `-20%
【豆包】：
\`\`\`md
-
---
\`\`\`
- 正常列表项`;

    expect(sanitizeMergedAnswerForDiscussion(input)).toBe(input);
  });

  it('removes blank lines without joining non-empty content lines', () => {
    const input = `第一行

   
第二行
	     
第三行`;

    expect(sanitizeMergedAnswerForDiscussion(input)).toBe(`第一行
第二行
第三行`);
  });

  it('wires cleanup into discussion prompt creation', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toContain('function sanitizeMergedAnswerForDiscussion(answer)');
    expect(source).toContain('const cleanMergedAnswer = sanitizeMergedAnswerForDiscussion(mergedAnswer);');
    expect(source).not.toContain("mergedAnswer.replace(/^\\s*\\n/gm, '')");
    expect(source).not.toContain(".replace(/\\n{3,}/g, '\\n\\n')");
  });
});
