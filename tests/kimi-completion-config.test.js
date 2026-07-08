import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const injector = readFileSync(
  resolve(process.cwd(), 'content-scripts/text-injection-all-providers.js'),
  'utf8'
);
const bridge = readFileSync(
  resolve(process.cwd(), 'content-scripts/sse-bridge.js'),
  'utf8'
);
const policy = readFileSync(
  resolve(process.cwd(), 'content-scripts/sse-completion-policy.js'),
  'utf8'
);

describe('Kimi completion configuration', () => {
  it('tracks merge sessions from MONITOR_COMPLETION so auto-merge SSE completion can reach the parent', () => {
    expect(bridge).toContain("event.data.type === 'MONITOR_COMPLETION'");
    expect(bridge).toContain('activeMergeSessionId = event.data.mergeSessionId || null;');
    expect(bridge).toContain("event.data.type === 'STOP_MONITORING'");
    expect(bridge).toContain('activeMergeSessionId = null;');
    expect(bridge).toMatch(/event\.data\.type === 'INJECT_TEXT'[\s\S]*activeMergeSessionId = event\.data\.mergeSessionId \|\| null;/);
    expect(bridge).not.toContain("event.data.type === 'INJECT_TEXT' && event.data.mergeSessionId");
  });

  it('does not treat Kimi SSE completion frames as final answers', () => {
    expect(policy).toContain("kimi: [],");
    expect(bridge).toContain('ACM_SSE_COMPLETION_POLICY');
    expect(injector).toContain('ACM_SSE_COMPLETION_POLICY');
  });

  it('uses conservative DOM quiet windows for long Kimi answers', () => {
    expect(injector).toContain("provider === 'wenxin'");
    expect(injector).toContain("provider === 'zhipu'");
    expect(injector).toContain("provider === 'kimi'");
    expect(injector).toContain("provider === 'gemini'");
    expect(injector).toContain('}, 3000);');
  });
});
