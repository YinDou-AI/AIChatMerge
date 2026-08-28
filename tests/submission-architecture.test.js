import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = relativePath =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('submission architecture boundaries', () => {
  it('keeps provider names and DOM access out of submission core', () => {
    const coreFiles = [
      'content-scripts/src/submission/send-error-codes.js',
      'content-scripts/src/submission/send-result.js',
      'content-scripts/src/submission/submit-snapshot.js',
      'content-scripts/src/submission/attempt-submit.js'
    ];
    const source = coreFiles.map(readSource).join('\n').toLowerCase();

    for (const forbidden of ['doubao', 'qianwen', 'claude', 'gemini']) {
      expect(source).not.toContain(forbidden);
    }
    expect(readSource('content-scripts/src/submission/submit-snapshot.js'))
      .not.toMatch(/\bdocument\b|\bwindow\b|querySelector|setTimeout/);
  });

  it('keeps the provider adapter independent from panel business code', () => {
    const adapter = readSource('content-scripts/src/providers/doubao/adapter.js');
    expect(adapter).not.toContain('aichatmerge-panel');
    expect(adapter).not.toContain('debug-log');
    expect(adapter).not.toContain('merge-engine');
  });

  it('centralizes Doubao submit selectors in its provider folder', () => {
    const detection = readSource('content-scripts/src/providers/detection.js');
    const clickSend = readSource('content-scripts/src/providers/click-send.js');
    const selectorSource = readSource('content-scripts/src/providers/doubao/selectors.js');

    expect(selectorSource).toContain('#flow-end-msg-send');
    expect(detection).toContain('doubao: DOUBAO_SEND_CONTROL_SELECTORS');
    expect(detection).not.toContain("'#flow-end-msg-send'");
    expect(clickSend).not.toContain("'#flow-end-msg-send'");
  });
});
