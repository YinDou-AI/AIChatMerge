import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { detectProvider } from '../content-scripts/src/providers/detection.js';

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));
const bypassRules = JSON.parse(readFileSync(resolve(process.cwd(), 'rules/bypass-headers.json'), 'utf8'));

describe('wenxin.baidu.com domain coverage', () => {
  beforeEach(() => {
    window.happyDOM.setURL('https://wenxin.baidu.com/?enter_type=chat_site');
  });

  it('detects the current Wenxin domain as the wenxin provider', () => {
    expect(detectProvider()).toBe('wenxin');
  });

  it('injects the Wenxin content scripts on the current domain', () => {
    const wenxinEntry = manifest.content_scripts.find((entry) =>
      Array.isArray(entry.matches) && entry.matches.includes('https://chat.baidu.com/*')
    );

    expect(wenxinEntry).toBeTruthy();
    expect(wenxinEntry.matches).toEqual(expect.arrayContaining([
      'https://chat.baidu.com/*',
      'https://wenxin.baidu.com/*',
    ]));
    expect(wenxinEntry.js).toEqual(expect.arrayContaining([
      'content-scripts/enter-behavior-wenxin.js',
      'content-scripts/answer-extractor-wenxin.js',
      'content-scripts/text-injection-all-providers.js',
    ]));
  });

  it('grants host and panel resource access on the current domain', () => {
    expect(manifest.host_permissions).toEqual(expect.arrayContaining([
      '*://chat.baidu.com/*',
      '*://wenxin.baidu.com/*',
    ]));
    expect(manifest.web_accessible_resources[0].matches).toEqual(expect.arrayContaining([
      '*://chat.baidu.com/*',
      '*://wenxin.baidu.com/*',
    ]));
  });

  it('allows Wenxin iframes to be embedded from the current domain', () => {
    expect(bypassRules.some((rule) => rule.condition?.urlFilter === 'https://wenxin.baidu.com/*')).toBe(true);
  });
});
