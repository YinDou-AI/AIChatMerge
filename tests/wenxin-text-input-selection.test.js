import { beforeEach, describe, expect, it } from 'vitest';

import { findTextInputElement } from '../content-scripts/src/providers/dom-utils.js';

function markVisible(element) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      top: 100,
      left: 100,
      right: 500,
      bottom: 160,
      width: 400,
      height: 60,
    }),
  });
}

describe('wenxin text input selection', () => {
  beforeEach(() => {
    window.happyDOM.setURL('https://wenxin.baidu.com/');
    document.body.innerHTML = '';
  });

  it('skips hidden helper textareas and returns the visible composer', () => {
    document.body.innerHTML = `
      <textarea aria-hidden="true" style="visibility:hidden;height:0;"></textarea>
      <textarea id="chat-textarea" class="ci-textarea ci-scroll-style" placeholder="有问题，尽管问"></textarea>
    `;

    const visibleComposer = document.querySelector('#chat-textarea');
    markVisible(visibleComposer);

    expect(findTextInputElement('textarea')).toBe(visibleComposer);
  });
});
