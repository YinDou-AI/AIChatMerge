import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const injector = readFileSync(
  resolve(process.cwd(), 'content-scripts/src/providers/completion-monitor.js'),
  'utf8'
);
const completionConstants = readFileSync(
  resolve(process.cwd(), 'content-scripts/src/providers/completion-constants.js'),
  'utf8'
);
const kimiPolicy = readFileSync(
  resolve(process.cwd(), 'content-scripts/src/providers/kimi/completion-policy.js'),
  'utf8'
);
const bridge = readFileSync(
  resolve(process.cwd(), 'content-scripts/sse-bridge.js'),
  'utf8'
);

describe('Kimi completion configuration', () => {
  it('does not treat Kimi SSE completion frames as final answers', () => {
    expect(bridge).toContain("kimi: [],");
    expect(completionConstants).toContain("kimi: [],");
  });

  it('uses a dedicated conservative completion policy for long Kimi answers', () => {
    expect(completionConstants).toContain("import { KIMI_STOP_BUTTON_SELECTORS } from './kimi/completion-policy.js'");
    expect(injector).toContain('KIMI_COMPLETION_POLICY,');
    expect(injector).toContain('getKimiTerminalResponseSignature');
    expect(injector).toContain("} from './kimi/completion-policy.js'");
    expect(kimiPolicy).toContain('answerStableMs: 10000');
    expect(kimiPolicy).not.toContain("'[class*=\"stop\"]'");
    expect(injector).not.toContain('Kimi stop button disappeared and answer settled for 800ms.');
  });
});
