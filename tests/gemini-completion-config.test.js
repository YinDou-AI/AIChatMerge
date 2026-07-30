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
const answerSelectors = readFileSync(
  resolve(process.cwd(), 'content-scripts/src/providers/answer-selectors.js'),
  'utf8'
);

describe('Gemini completion configuration', () => {
  it('starts DOM monitoring immediately so short answers cannot finish before fallback starts', () => {
    expect(injector).toContain("provider === 'gemini'");
    expect(injector).toContain("startMutationFallback(provider);");
  });

  it('recognizes Gemini model-response containers for monitoring and extraction', () => {
    expect(answerSelectors).toContain("'model-response .markdown-main-panel'");
    expect(answerSelectors).toContain("'model-response'");
  });

  it('recognizes localized Gemini stop controls', () => {
    expect(completionConstants).toContain("'button[aria-label*=\"停止\"]'");
    expect(completionConstants).toContain("'button[mattooltip*=\"停止\"]'");
  });
});
