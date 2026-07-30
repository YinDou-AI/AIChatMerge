import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// grok 注入回归：2026-07-21 日志显示注入兜底把 439 字写进了 grok 页面
// 常驻的隐藏无障碍 textarea（visibility:hidden + aria-hidden="true"），
// tiptap 不知情 → 发送按钮不挂载 → send-unconfirmed。
// 约束：grok 的 textarea 选择器必须排除 aria-hidden 节点
const detection = readFileSync(
  resolve(process.cwd(), 'content-scripts/src/providers/detection.js'),
  'utf8'
);
const entry = readFileSync(
  resolve(process.cwd(), 'content-scripts/src/text-injection-entry.js'),
  'utf8'
);

describe('grok composer targeting', () => {
  it('never targets grok hidden accessibility textarea', () => {
    const grokLine = detection.match(/grok:\s*\[.*/);
    expect(grokLine?.[0]).toContain('textarea:not([aria-hidden="true"])');
    // 裸 textarea 选择器会重新命中那个隐藏节点
    expect(grokLine?.[0]).not.toMatch(/'textarea'/);
  });

  it('retries composer lookup for late-hydrating grok iframes', () => {
    expect(entry).toContain("provider === 'deepseek' || provider === 'grok' ? [1000, 2000] : [1000]");
  });
});
