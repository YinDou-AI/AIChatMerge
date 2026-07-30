import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readJson(relativePath) {
  return JSON.parse(readFileSync(relativePath, 'utf8'));
}

describe('manifest store metadata localization', () => {
  it('resolves the extension name and summary from English and Chinese locales', () => {
    const manifest = readJson('manifest.json');
    const english = readJson('_locales/en/messages.json');
    const chinese = readJson('_locales/zh_CN/messages.json');

    expect(manifest.default_locale).toBe('en');
    expect(manifest.name).toBe('__MSG_extensionName__');
    expect(manifest.description).toBe('__MSG_extensionDescription__');

    expect(english.extensionName?.message).toBeTruthy();
    expect(english.extensionDescription?.message).toBeTruthy();
    expect(chinese.extensionName?.message).toBeTruthy();
    expect(chinese.extensionDescription?.message).toBeTruthy();
  });
});
