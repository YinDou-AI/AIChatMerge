import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('discussion message context', () => {
  it('uses the trusted multi-panel context for discussion INJECT_TEXT auto-submit', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).not.toContain("context: 'discussion'");
    expect(source).toMatch(/sendToPanel\(panel,\s*discussPrompt,\s*true,\s*null,\s*0,\s*discussionSessionId\)/);
    expect(source).toMatch(/type:\s*'INJECT_TEXT'[\s\S]*providerMode:\s*getPanelProviderMode\(panel\)[\s\S]*context:\s*'multi-panel'/);
  });

  it('binds discussion send retries and completion monitoring to the same session', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toMatch(/if\s*\(mergeSessionId\)\s*{[\s\S]*type:\s*'MONITOR_COMPLETION'[\s\S]*mergeSessionId[\s\S]*panelId:\s*panel\.id[\s\S]*context:\s*'multi-panel'/);
    expect(source).toMatch(/const discussionSessionId = `discussion-round-\$\{round\}-\$\{panel\.id\}-\$\{Date\.now\(\)\}`;/);
    expect(source).toContain('const settledDiscussionSends = await Promise.all(discussionSendResults);');
  });
});
