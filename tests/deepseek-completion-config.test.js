import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const injector = readFileSync(
  resolve(process.cwd(), 'content-scripts/text-injection-all-providers.js'),
  'utf8'
);

describe('DeepSeek completion configuration', () => {
  it('recognizes localized DeepSeek stop controls', () => {
    expect(injector).toContain("deepseek: [");
    expect(injector).toContain("'button[aria-label*=\"停止\"]'");
    expect(injector).toContain("'button[aria-label*=\"Stop\"]'");
  });

  it('starts DOM monitoring immediately so short DeepSeek answers cannot finish before fallback starts', () => {
    expect(injector).toContain("provider === 'deepseek'");
    expect(injector).toContain("startMutationFallback(provider);");
  });
});
