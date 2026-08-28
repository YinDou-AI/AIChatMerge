import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postToExtensionParent = vi.fn();

vi.mock('../content-scripts/src/providers/messaging.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    postToExtensionParent: (...args) => postToExtensionParent(...args),
    postCompletionDiagnostic: vi.fn(),
  };
});

function completionEvents() {
  return postToExtensionParent.mock.calls.filter(
    args => args[0]?.type === 'COMPLETION_DETECTED'
  );
}

describe('completion provider-extractor fallback', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });
    postToExtensionParent.mockClear();
    window.__aichatmerge_extractors = {};
    const { setExtractMode } = await import('../content-scripts/src/providers/dom-utils.js');
    setExtractMode(true);
  });

  afterEach(async () => {
    const monitor = await import('../content-scripts/src/providers/completion-monitor.js');
    const { setExtractMode } = await import('../content-scripts/src/providers/dom-utils.js');
    monitor.stopCompletionMonitor();
    monitor.clearCompletionWatchdog();
    setExtractMode(false);
    delete window.__aichatmerge_extractors;
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('uses the provider extractor when Yuanbao has no direct completion selectors', async () => {
    window.happyDOM.setURL('https://yuanbao.tencent.com/chat/');
    document.body.innerHTML = '<div class="provider-answer">旧答案</div>';
    window.__aichatmerge_extractors.yuanbao = () =>
      document.querySelector('.provider-answer')?.textContent || '';

    const monitor = await import('../content-scripts/src/providers/completion-monitor.js');
    monitor.noteInjectionForCompletion();
    monitor.startMutationFallback('yuanbao');

    document.querySelector('.provider-answer').textContent = '元宝的新答案';
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(10000);

    expect(completionEvents()).toHaveLength(1);
    expect(completionEvents()[0][0]).toMatchObject({
      provider: 'yuanbao',
      cachedAnswer: '元宝的新答案',
    });
  });

  it('finishes immediately when Kimi appends a terminal capacity response', async () => {
    window.happyDOM.setURL('https://www.kimi.com/');
    document.body.innerHTML = '<div>旧对话</div>';

    const monitor = await import('../content-scripts/src/providers/completion-monitor.js');
    monitor.noteInjectionForCompletion();
    monitor.startCompletionMonitor('kimi-capacity');

    document.body.insertAdjacentHTML(
      'beforeend',
      '<div>不好意思，刚刚和Kimi聊的人太多了。高峰期算力不足，请耐心等待。</div>'
    );
    await vi.advanceTimersByTimeAsync(501);

    expect(completionEvents()).toHaveLength(1);
    expect(completionEvents()[0][0]).toMatchObject({
      provider: 'kimi',
      mergeSessionId: 'kimi-capacity',
    });
  });
});
