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

describe('Kimi completion behavior', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    window.happyDOM.setURL('https://www.kimi.com/');
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });
    postToExtensionParent.mockClear();
    const { setExtractMode } = await import('../content-scripts/src/providers/dom-utils.js');
    setExtractMode(true);
  });

  afterEach(async () => {
    const monitor = await import('../content-scripts/src/providers/completion-monitor.js');
    const { setExtractMode } = await import('../content-scripts/src/providers/dom-utils.js');
    monitor.stopCompletionMonitor();
    setExtractMode(false);
    vi.useRealTimers();
  });

  it('waits for the Kimi 10-second answer stability window', async () => {
    document.body.innerHTML = '<div class="markdown-container">旧答案</div>';
    const answer = document.querySelector('.markdown-container');
    const monitor = await import('../content-scripts/src/providers/completion-monitor.js');

    monitor.noteInjectionForCompletion();
    monitor.startCompletionMonitor('kimi-long-answer');
    answer.textContent = 'Kimi仍在生成的长回答第一阶段';
    await vi.advanceTimersByTimeAsync(1);

    await vi.advanceTimersByTimeAsync(9000);
    expect(completionEvents()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(2000);
    expect(completionEvents()).toHaveLength(1);
    expect(completionEvents()[0][0]).toMatchObject({
      provider: 'kimi',
      mergeSessionId: 'kimi-long-answer',
    });
  });
});
