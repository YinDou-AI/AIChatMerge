import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('manifest Google content script coverage', () => {
  it('injects the Google content scripts on the search homepage and results pages', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8')
    );

    const googleContentScript = manifest.content_scripts.find((entry) =>
      Array.isArray(entry.matches) && entry.matches.includes('https://www.google.com/search*')
    );

    expect(googleContentScript).toBeTruthy();
    expect(googleContentScript.matches).toEqual(expect.arrayContaining([
      'https://www.google.com/',
      'https://www.google.com/search*',
    ]));
  });
});
