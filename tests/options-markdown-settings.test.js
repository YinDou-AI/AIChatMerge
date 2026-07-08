import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('options/options.js'), 'utf8');

describe('options markdown settings', () => {
  it('saves remaining boolean markdown select values as booleans, not strings', () => {
    expect(source).toContain("{ id: 'export-initial-merge-select', key: 'exportInitialMerge', type: 'boolean' }");
    expect(source).toMatch(/const value = type === 'boolean' \? e\.target\.value === 'true' : e\.target\.value;[\s\S]*await saveSetting\(key, value\);/);
  });

  it('loads legacy string boolean settings with boolean semantics', () => {
    expect(source).toContain('function readBooleanSetting(value, defaultValue = false)');
    expect(source).toContain('exportInitialMergeSelect.value = String(readBooleanSetting(settings.exportInitialMerge, false));');
  });

  it('does not expose the removed markdown score export setting', () => {
    expect(source).not.toContain('export-score-select');
    expect(source).not.toContain('exportScoreInMarkdown');
  });
});
