import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8'));

describe('Grok content-script configuration', () => {
  it('does not inject the Enter-key interceptor into Grok', () => {
    const grokEntry = manifest.content_scripts.find(entry =>
      entry.matches?.includes('https://grok.com/*')
    );

    expect(grokEntry).toBeDefined();
    expect(grokEntry.js).not.toContain('content-scripts/enter-behavior-grok.js');
    expect(grokEntry.js).toContain('content-scripts/text-injection-all-providers.js');
  });
});
