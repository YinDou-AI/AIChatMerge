import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const contentScriptSource = readFileSync(
  resolve(process.cwd(), 'content-scripts/text-injection-all-providers.js'),
  'utf8'
);

describe('answer text formatting', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: () => 'chrome-extension://test-id/'
      },
      storage: {
        sync: {
          get: () => {}
        },
        onChanged: {
          addListener: () => {}
        }
      }
    });
    window.__aichatmerge_extractors = {};
    window.eval(contentScriptSource);
  });

  it('preserves paragraphs, list items, and explicit line breaks from answer DOM', () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant">
        <div class="markdown-body">
          <p>第一段<strong>重点</strong></p>
          <p>第二段<br>换行</p>
          <ul>
            <li>要点 A</li>
            <li>要点 B</li>
          </ul>
        </div>
      </article>
    `;

    const text = window.__aichatmerge_extractor_utils.extractText(
      document.querySelector('.markdown-body')
    );

    expect(text).toContain('第一段重点');
    expect(text).toContain('第二段\n换行');
    expect(text).toContain('- 要点 A\n- 要点 B');
    expect(text).not.toContain('\n\n');
    expect(text).not.toContain('第一段 重点 第二段 换行 - 要点 A - 要点 B');
  });

  it('keeps rendered markdown block boundaries from answer DOM', () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant">
        <div class="markdown-body">
          <h3>综合答案</h3>
          <p>正文</p>
          <hr>
          <h4>第一组：测试</h4>
        </div>
      </article>
    `;

    const text = window.__aichatmerge_extractor_utils.extractText(
      document.querySelector('.markdown-body')
    );

    expect(text).toContain('### 综合答案');
    expect(text).toContain('正文\n---\n#### 第一组：测试');
    expect(text).not.toContain('\n\n');
  });
});
