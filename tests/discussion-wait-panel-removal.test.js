import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 讨论等待期间删除面板：2026-07-21 用户删除卡死的 chatgpt 面板后，
// 讨论仍然干等 120 秒超时——merge-monitor 有 reconcile，讨论等待没有
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: vi.fn(),
  getPanelDebugInfo: vi.fn(panel => ({ panelId: panel?.id, providerId: panel?.providerId })),
}));
vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({
  extractSinglePanelAnswer: vi.fn(async () => ''),
}));
vi.mock('../aichatmerge-panel/modules/merge-prompt.js', () => ({
  normalizeAnswerForStability: vi.fn(a => a),
}));
vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  getMergeMaxWait: vi.fn(() => 60000),
}));

function makeAbortSignal() {
  const controller = new AbortController();
  return controller.signal;
}

describe('discussion wait panel removal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves early when a missing panel is removed and the rest completed', async () => {
    const { waitForDiscussionPanelsCompletionWithAbort, notifyDiscussionPanelRemoved } =
      await import('../aichatmerge-panel/modules/discussion-gates.js');

    const panels = [
      { id: 'p1', providerId: 'deepseek' },
      { id: 'p2', providerId: 'chatgpt' },
    ];
    const waitPromise = waitForDiscussionPanelsCompletionWithAbort(panels, makeAbortSignal(), 60000);
    let resolved = false;
    waitPromise.then(() => { resolved = true; });

    // p1 正常完成
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'COMPLETION_DETECTED', context: 'multi-panel-completion', panelId: 'p1', provider: 'deepseek' }
    }));
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);

    // 用户删除卡死的 p2：等待应立即结束而不是干等 60 秒
    notifyDiscussionPanelRemoved('p2');
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(true);
  });

  it('still waits for remaining panels after an unrelated removal', async () => {
    const { waitForDiscussionPanelsCompletionWithAbort, notifyDiscussionPanelRemoved } =
      await import('../aichatmerge-panel/modules/discussion-gates.js');

    const panels = [
      { id: 'p1', providerId: 'deepseek' },
      { id: 'p2', providerId: 'kimi' },
    ];
    const waitPromise = waitForDiscussionPanelsCompletionWithAbort(panels, makeAbortSignal(), 60000);
    let resolved = false;
    waitPromise.then(() => { resolved = true; });

    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'COMPLETION_DETECTED', context: 'multi-panel-completion', panelId: 'p1', provider: 'deepseek' }
    }));
    // 删除一个不在等待列表里的面板：不影响等待
    notifyDiscussionPanelRemoved('p-other');
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);

    // p2 完成后正常结束
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'COMPLETION_DETECTED', context: 'multi-panel-completion', panelId: 'p2', provider: 'kimi' }
    }));
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(true);
  });

  it('resolves immediately when the last missing panel is removed', async () => {
    const { waitForDiscussionPanelsCompletionWithAbort, notifyDiscussionPanelRemoved } =
      await import('../aichatmerge-panel/modules/discussion-gates.js');

    const panels = [{ id: 'p1', providerId: 'chatgpt' }];
    const waitPromise = waitForDiscussionPanelsCompletionWithAbort(panels, makeAbortSignal(), 60000);
    let resolved = false;
    waitPromise.then(() => { resolved = true; });

    notifyDiscussionPanelRemoved('p1');
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(true);
  });

  it('ignores stale completion events from another discussion round', async () => {
    const { waitForDiscussionPanelsCompletionWithAbort } =
      await import('../aichatmerge-panel/modules/discussion-gates.js');

    const panels = [
      { id: 'p1', providerId: 'doubao' },
      { id: 'p2', providerId: 'claude' },
    ];
    const expectedSessions = new Map([
      ['p1', 'discussion-round-2-p1-current'],
      ['p2', 'discussion-round-2-p2-current'],
    ]);
    const waitPromise = waitForDiscussionPanelsCompletionWithAbort(
      panels,
      makeAbortSignal(),
      60000,
      'discussion-wait:aborted',
      expectedSessions
    );
    let resolved = false;
    waitPromise.then(() => { resolved = true; });

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'COMPLETION_DETECTED',
        context: 'multi-panel-completion',
        panelId: 'p1',
        provider: 'doubao',
        mergeSessionId: 'discussion-round-1-p1-stale',
      }
    }));
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'COMPLETION_DETECTED',
        context: 'multi-panel-completion',
        panelId: 'p2',
        provider: 'claude',
        mergeSessionId: 'discussion-round-2-p2-current',
      }
    }));
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'COMPLETION_DETECTED',
        context: 'multi-panel-completion',
        panelId: 'p1',
        provider: 'doubao',
        mergeSessionId: 'discussion-round-2-p1-current',
      }
    }));
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(true);
  });
});
