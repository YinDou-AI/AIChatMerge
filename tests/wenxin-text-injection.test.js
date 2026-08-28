import { afterEach, describe, expect, it } from 'vitest';

import { injectTextIntoElement } from '../content-scripts/src/providers/text-injection.js';
import { PROVIDER_SELECTORS } from '../content-scripts/src/providers/detection.js';

describe('Wenxin text injection recovery', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('replaces a stuck textarea prompt instead of appending the next send', () => {
    window.happyDOM.setURL('https://chat.baidu.com/');
    const textarea = document.createElement('textarea');
    textarea.value = 'failed previous prompt';
    document.body.appendChild(textarea);

    expect(injectTextIntoElement(textarea, 'next prompt')).toBe(true);
    expect(textarea.value).toBe('next prompt');
  });

  it('prioritizes Wenxin current textarea over legacy editors', () => {
    expect(PROVIDER_SELECTORS.wenxin[0]).toBe('#chat-textarea');

    document.body.innerHTML = `
      <div data-slate-editor="true" contenteditable="true"></div>
      <div id="ci-area">
        <textarea id="chat-textarea" class="ci-textarea ci-scroll-style"></textarea>
      </div>
    `;

    expect(document.querySelector(PROVIDER_SELECTORS.wenxin[0])?.id).toBe('chat-textarea');
  });
});
