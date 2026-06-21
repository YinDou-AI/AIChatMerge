import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const injector = readFileSync(
  resolve(process.cwd(), 'content-scripts/text-injection-all-providers.js'),
  'utf8'
);
const extractor = readFileSync(
  resolve(process.cwd(), 'content-scripts/answer-extractor-gemini.js'),
  'utf8'
);

describe('Gemini completion configuration', () => {
  it('starts DOM monitoring immediately so short answers cannot finish before fallback starts', () => {
    expect(injector).toContain("provider === 'gemini'");
    expect(injector).toContain("startMutationFallback(provider);");
  });

  it('recognizes Gemini model-response containers for monitoring and extraction', () => {
    expect(injector).toContain("'model-response .markdown-main-panel'");
    expect(injector).toContain("'model-response'");
    expect(extractor).toContain("'model-response .markdown-main-panel'");
    expect(extractor).toContain("'model-response'");
  });

  it('recognizes localized Gemini stop controls', () => {
    expect(injector).toContain("'button[aria-label*=\"停止\"]'");
    expect(injector).toContain("'button[mattooltip*=\"停止\"]'");
  });
});
