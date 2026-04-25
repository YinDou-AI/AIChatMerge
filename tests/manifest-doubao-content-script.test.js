import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('manifest Doubao content script coverage', () => {
  it('injects the Doubao content scripts for both www and bare domains', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8')
    );

    const doubaoContentScript = manifest.content_scripts.find((entry) =>
      Array.isArray(entry.matches) && entry.matches.includes('https://www.doubao.com/*')
    );

    expect(doubaoContentScript).toBeTruthy();
    expect(doubaoContentScript.matches).toEqual(expect.arrayContaining([
      'https://www.doubao.com/*',
      'https://doubao.com/*',
    ]));
    expect(doubaoContentScript.js).toEqual(expect.arrayContaining([
      'content-scripts/button-finder-utils.js',
      'content-scripts/enter-behavior-doubao.js',
      'content-scripts/text-injection-all-providers.js',
    ]));
  });
});
