import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

describe('add-panel menu dismissal', () => {
  it('opts into closing the add-panel menu when an AI iframe receives focus', () => {
    expect(source).toContain('setupDropdownCloseHandler(dropdown, btn, { closeWhenIframeFocused: true })');
    expect(source).toContain("document.activeElement?.tagName === 'IFRAME'");
  });
});
