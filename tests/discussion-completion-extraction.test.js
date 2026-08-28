import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const extractSinglePanelAnswer = vi.fn();

vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: vi.fn(),
  getPanelDebugInfo: vi.fn(panel => ({
    panelId: panel?.id,
    providerId: panel?.providerId,
  })),
}));

vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({
  extractSinglePanelAnswer: (...args) => extractSinglePanelAnswer(...args),
  getLastSingleExtractionDiag: vi.fn(() => null),
}));

vi.mock('../aichatmerge-panel/modules/merge-prompt.js', () => ({
  normalizeAnswerForStability: vi.fn(answer => String(answer || '').trim()),
}));

vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  getMergeMaxWait: vi.fn(() => 60000),
}));

describe('discussion completion extraction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    extractSinglePanelAnswer.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('extracts from the panel after MERGE_COMPLETE instead of using its cached answer', async () => {
    const { waitForDiscussionStartGate } =
      await import('../aichatmerge-panel/modules/discussion-gates.js');
    const panel = {
      id: 'merge-panel',
      providerId: 'claude',
      iframe: { contentWindow: {} },
    };
    const controller = new AbortController();

    extractSinglePanelAnswer.mockResolvedValueOnce('旧答案');
    const waitPromise = waitForDiscussionStartGate(
      panel,
      controller.signal,
      60000,
      '旧答案'
    );
    await vi.advanceTimersByTimeAsync(1);

    extractSinglePanelAnswer.mockResolvedValue(
      '完整正文\n\n标题：测试回复修正\n模型评分：Claude=10'
    );
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'MERGE_COMPLETE',
        provider: 'claude',
        answer: '较早缓存的正文',
      },
    }));

    await vi.advanceTimersByTimeAsync(2500);

    await expect(waitPromise).resolves.toEqual({
      answer: '完整正文\n\n标题：测试回复修正\n模型评分：Claude=10',
      reason: 'event-complete',
    });
    expect(extractSinglePanelAnswer).toHaveBeenCalledTimes(2);
  });
});
