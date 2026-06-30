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

describe('Kimi completion configuration', () => {
  it('does not treat Kimi SSE completion frames as final answers', () => {
    expect(bridge).toContain("kimi: [],");
    expect(injector).toContain("kimi: [],");
  });

  it('uses conservative DOM quiet windows for long Kimi answers', () => {
    expect(injector).toContain("provider === 'wenxin' || provider === 'zhipu' || provider === 'kimi' || provider === 'gemini'");
    expect(injector).toContain('}, 3000);');
  });
});
