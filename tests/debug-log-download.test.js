import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installChromeMock({ autoDownload } = {}) {
  const store = {
    aichatmergeDebugLogs: []
  };
  const downloads = {
    download: vi.fn((options, callback) => callback?.(101))
  };

  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (defaults) => ({
          ...defaults,
          aichatmergeDebugLogs: store.aichatmergeDebugLogs
        })),
        set: vi.fn(async (values) => {
          Object.assign(store, values);
        })
      },
      sync: {
        // autoDownload 为 undefined 时模拟「存储里没有这项设置」，
        // 只有 defaults 里的默认值生效
        get: vi.fn(async (defaults) => ({
          ...defaults,
          ...(autoDownload === undefined ? {} : { debugAutoDownloadLogs: autoDownload })
        }))
      },
      onChanged: {
        addListener: vi.fn()
      }
    },
    downloads,
    runtime: {
      getManifest: vi.fn(() => ({ version: 'test' })),
      lastError: null
    }
  });

  return { store, downloads };
}

describe('debug log download', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:debug-log'),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses chrome downloads API for debug log exports', async () => {
    const { store, downloads } = installChromeMock();
    store.aichatmergeDebugLogs = [
      {
        ts: '2026-07-10T00:00:00.000Z',
        t: 1,
        sessionId: 'session-a',
        event: 'discussion:completed',
        details: { finalAnswerLength: 12 }
      }
    ];

    // 手动导出（非 silent）是全量历史
    const { downloadDebugLogs } = await import('../aichatmerge-panel/modules/debug-log.js');
    await downloadDebugLogs();

    expect(downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'blob:debug-log',
        filename: expect.stringMatching(/^aichatmerge-debug-.*\.json$/),
        saveAs: false,
        conflictAction: 'uniquify'
      }),
      expect.any(Function)
    );
  });

  it('auto-downloads after final discussion export succeeds', async () => {
    vi.useFakeTimers();
    const { downloads } = installChromeMock({ autoDownload: true });
    const { recordDebugLog } = await import('../aichatmerge-panel/modules/debug-log.js');

    await Promise.resolve();
    await Promise.resolve();
    await recordDebugLog('discussion-final-answer-auto-success', {
      filePath: 'AIChatMerge/raw/final.md'
    });

    await vi.advanceTimersByTimeAsync(1600);

    expect(downloads.download).toHaveBeenCalledTimes(1);
  });

  it('auto-downloads on merge panel completion by default (no stored setting)', async () => {
    vi.useFakeTimers();
    const { downloads } = installChromeMock();
    const { recordDebugLog } = await import('../aichatmerge-panel/modules/debug-log.js');

    await Promise.resolve();
    await Promise.resolve();
    await recordDebugLog('merge-panel:completion-detected', {
      mergeSessionId: 'merge-output-1'
    });

    await vi.advanceTimersByTimeAsync(1600);

    expect(downloads.download).toHaveBeenCalledTimes(1);
  });

  it('downloads once per milestone: merge completion and discussion completion each export', async () => {
    vi.useFakeTimers();
    const { downloads } = installChromeMock({ autoDownload: true });
    const { recordDebugLog } = await import('../aichatmerge-panel/modules/debug-log.js');

    await Promise.resolve();
    await Promise.resolve();

    await recordDebugLog('merge-panel:completion-detected', { mergeSessionId: 'merge-output-1' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(downloads.download).toHaveBeenCalledTimes(1);

    // 同一里程碑重复触发（如讨论多轮融合）不再下载
    await recordDebugLog('merge-panel:completion-detected', { mergeSessionId: 'discussion-merge-1' });
    await vi.advanceTimersByTimeAsync(31000);
    expect(downloads.download).toHaveBeenCalledTimes(1);

    // 讨论结束是另一个里程碑，允许再下载一次
    await recordDebugLog('discussion:completed', { finalAnswerLength: 56 });
    await vi.advanceTimersByTimeAsync(1600);
    expect(downloads.download).toHaveBeenCalledTimes(2);
  });

  it('skips the merge milestone when discussion will run; discussion end still exports', async () => {
    vi.useFakeTimers();
    const { downloads } = installChromeMock({ autoDownload: true });
    const { recordDebugLog, setDiscussionWillRun } = await import('../aichatmerge-panel/modules/debug-log.js');

    await Promise.resolve();
    await Promise.resolve();

    // 讨论模式：融合只是中间步骤，不导出；讨论结束才导出完整日志
    setDiscussionWillRun(true);
    await recordDebugLog('merge-panel:completion-detected', { mergeSessionId: 'merge-output-1' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(downloads.download).toHaveBeenCalledTimes(0);

    await recordDebugLog('discussion:completed', { finalAnswerLength: 56 });
    await vi.advanceTimersByTimeAsync(1600);
    expect(downloads.download).toHaveBeenCalledTimes(1);
  });

  it('defers failure exports in discussion mode so a run yields one log file', async () => {
    // 2026-07-21：yuanbao submit-failed 触发即时导出，讨论结束又导出，
    // 一次运行两份日志。讨论模式下失败事件由讨论结束的导出承载
    vi.useFakeTimers();
    const { downloads } = installChromeMock({ autoDownload: true });
    const { recordDebugLog, setDiscussionWillRun } = await import('../aichatmerge-panel/modules/debug-log.js');

    await Promise.resolve();
    await Promise.resolve();

    setDiscussionWillRun(true);
    await recordDebugLog('text-injection:submit-failed', { provider: 'yuanbao', reason: 'button-not-ready' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(downloads.download).toHaveBeenCalledTimes(0);

    await recordDebugLog('discussion:completed', { finalAnswerLength: 56 });
    await vi.advanceTimersByTimeAsync(1600);
    expect(downloads.download).toHaveBeenCalledTimes(1);
  });

  it('still exports failures immediately in merge-only mode', async () => {
    // 非讨论模式没有「讨论结束」兜底导出，失败必须即时落盘
    vi.useFakeTimers();
    const { downloads } = installChromeMock({ autoDownload: true });
    const { recordDebugLog, setDiscussionWillRun } = await import('../aichatmerge-panel/modules/debug-log.js');

    await Promise.resolve();
    await Promise.resolve();

    setDiscussionWillRun(false);
    await recordDebugLog('text-injection:submit-failed', { provider: 'doubao', reason: 'send-unconfirmed' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(downloads.download).toHaveBeenCalledTimes(1);
  });

  it('auto download exports only the current session, manual export keeps full history', async () => {
    vi.useFakeTimers();
    const { store, downloads } = installChromeMock({ autoDownload: true });
    const blobParts = [];
    vi.stubGlobal('Blob', class {
      constructor(parts) { blobParts.push(parts); }
    });
    store.aichatmergeDebugLogs = [
      { ts: '2026-07-10T00:00:00.000Z', t: 1, sessionId: 'session-old', event: 'panel-send:start' },
      { ts: '2026-07-10T00:01:00.000Z', t: 2, sessionId: 'session-old', event: 'discussion:completed' }
    ];

    const { recordDebugLog, downloadDebugLogs } = await import('../aichatmerge-panel/modules/debug-log.js');
    await Promise.resolve();
    await Promise.resolve();

    // 自动导出：只包含当前会话（recordDebugLog 写入的条目）
    await recordDebugLog('merge-panel:completion-detected', { mergeSessionId: 'merge-output-1' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(downloads.download).toHaveBeenCalledTimes(1);
    const autoPayload = JSON.parse(blobParts.at(-1)[0]);
    expect(autoPayload.eventCounts).toEqual([
      { event: 'merge-panel:completion-detected', count: 1 }
    ]);
    expect(autoPayload.sessions).toHaveLength(1);

    // 手动导出：全量历史（2 条旧会话 + 1 条当前会话）
    await downloadDebugLogs();
    const manualPayload = JSON.parse(blobParts.at(-1)[0]);
    expect(manualPayload.sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('rotateDebugSession isolates a new run from previous-run failures', async () => {
    // 2026-07-21：复跑全绿，verdict 却被上一轮的看门狗事件判成 failed——
    // 会话 id 只在面板加载时生成，跨运行不滚动。修复后每次真实发送
    // 滚动一次，本轮 verdict 只看本轮事件
    vi.useFakeTimers();
    const { downloads } = installChromeMock({ autoDownload: true });
    const blobParts = [];
    vi.stubGlobal('Blob', class {
      constructor(parts) { blobParts.push(parts); }
    });

    const { recordDebugLog, rotateDebugSession, getDebugSessionId, setDiscussionWillRun } =
      await import('../aichatmerge-panel/modules/debug-log.js');
    await Promise.resolve();
    await Promise.resolve();

    // 上一轮：产生失败事件
    const firstSession = getDebugSessionId();
    await recordDebugLog('completion-monitor:watchdog-timeout', { provider: 'wenxin', phase: 'mutation-fallback' });

    // 新一轮运行：滚动会话
    const secondSession = rotateDebugSession();
    expect(secondSession).not.toBe(firstSession);
    setDiscussionWillRun(true);
    await recordDebugLog('discussion:completed', { finalAnswerLength: 56 });
    await vi.advanceTimersByTimeAsync(1600);

    expect(downloads.download).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(blobParts.at(-1)[0]);
    // 上一轮的失败事件不进入本轮导出，verdict 不受污染
    expect(payload.verdict.status).toBe('ok');
  });

});
