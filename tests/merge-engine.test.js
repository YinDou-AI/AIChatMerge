import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Noise suppression for merge-engine tests
//
// Two noise sources are filtered at the console level:
// 1. "[Merge] Provider not found:" — business logic log from a test that
//    deliberately exercises the provider-not-found code path.
// 2. "No response from content script" — diagnostic warn from the merge
//    engine's retry logic (the test mock never sends a response).
//
// Happy-dom DOMException noise from iframe teardown is eliminated at the root
// by using "about:blank" as the iframe URL (see panel-frame-config mock below),
// which prevents the real network requests that produce abort errors.
// ---------------------------------------------------------------------------
const KNOWN_NOISY_CONSOLE_ERRORS = [
  /Provider not found:/,
];
const KNOWN_NOISY_CONSOLE_WARNS = [
  /No response from content script/,
];

let originalConsoleError;
let originalConsoleWarn;

beforeEach(() => {
  // --- console.error: allow real errors through, suppress known noise ---
  originalConsoleError = console.error;
  console.error = (...args) => {
    const msg = args.map(String).join(' ');
    if (KNOWN_NOISY_CONSOLE_ERRORS.some(re => re.test(msg))) return;
    originalConsoleError.call(console, ...args);
  };

  // --- console.warn: same treatment ---
  originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.map(String).join(' ');
    if (KNOWN_NOISY_CONSOLE_WARNS.some(re => re.test(msg))) return;
    originalConsoleWarn.call(console, ...args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({
  extractAllAnswers: vi.fn(async () => []),
}));
vi.mock('../aichatmerge-panel/modules/merge-prompt.js', () => ({
  buildMergePrompt: vi.fn(() => 'merged prompt'),
  getMergeBadgeMeta: vi.fn(() => ({ background: '#000', text: 'MERGE', title: 'merge' })),
}));
vi.mock('../aichatmerge-panel/modules/discussion-runner.js', () => ({
  startDiscussionAfterMerge: vi.fn(async () => {}),
}));
vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  getActiveMergeSessionId: vi.fn(() => null),
  getActiveCompletionSessionGeneration: vi.fn(() => 0),
  getCompletionSessionGeneration: vi.fn(() => 0),
  beginMergeSession: vi.fn(),
  setLastMergeType: vi.fn(),
  getLastMergeType: vi.fn(() => null),
  stopMergeMonitor: vi.fn(),
  getMergeCompletedPanels: vi.fn(() => new Set()),
  addMergeCompletedPanel: vi.fn(),
  removeMergeCompletedPanel: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/merge-state.js', () => ({
  getSelectedMergeTarget: vi.fn(() => 'deepseek'),
  setSelectedMergeTarget: vi.fn(),
  getLastSentQuestion: vi.fn(() => 'test question'),
  setLastSentQuestion: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/markdown-export.js', () => ({
  getAutoExportWaitController: vi.fn(() => null),
  setAutoExportWaitController: vi.fn(),
  getAutoExportRunId: vi.fn(() => 0),
  incrementAutoExportRunId: vi.fn(() => 1),
  getAutoExportWriteInProgress: vi.fn(() => false),
  setAutoExportWriteInProgress: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-header-actions.js', () => ({
  getPanelHeaderRightHtml: vi.fn(() => ''),
  bindPanelHeaderActions: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-frame-config.js', () => ({
  // Use about:blank to avoid real network requests.  Happy-dom's internal
  // Fetch class makes actual HTTP requests when loading iframe URLs like
  // https://example.com.  When the DOM is cleared between tests, the iframe
  // removal aborts in-flight requests and prints DOMException noise to stderr
  // via Node internals that cannot be intercepted at the JS layer.
  getProviderFrameUrl: vi.fn(() => 'about:blank'),
}));
vi.mock('../aichatmerge-panel/modules/state.js', () => ({
  getPanels: vi.fn(() => []),
  getCurrentLayout: vi.fn(() => '1x3'),
  getCurrentPanelPage: vi.fn(() => 0),
  setCurrentPanelPage: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/layout-config.js', () => ({
  getPanelPageIndex: vi.fn((panelIndex) => Math.floor(panelIndex / 3)),
}));
vi.mock('../aichatmerge-panel/modules/panel-lifecycle.js', () => ({
  renderCurrentPage: vi.fn(),
  saveProviderConfiguration: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  getPanelDebugInfo: vi.fn(() => ({})),
  recordDebugLog: vi.fn(),
  setDiscussionWillRun: vi.fn(),
}));
vi.mock('../modules/providers.js', () => ({
  getProviderById: vi.fn(() => ({ id: 'deepseek', name: 'DeepSeek', url: 'https://example.com' })),
}));
vi.mock('../aichatmerge-panel/modules/theme.js', () => ({
  getThemeAwareProviderIcon: vi.fn(() => ''),
  setBrandText: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({
  t: vi.fn(key => key),
}));
vi.mock('../modules/settings.js', () => ({
  getSettings: vi.fn(async () => ({ mergeMode: 'merge' })),
}));
vi.mock('../aichatmerge-panel/modules/toast.js', () => ({
  showToast: vi.fn(),
}));

describe('merge-engine triggerMerge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<textarea id="unified-input"></textarea><div id="panel-grid"></div>';
  });

  it('does not throw when reading merge state before valid answers exist', async () => {
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    await expect(
      triggerMerge({ panels: [], mergePanelIds: new Set() })
    ).resolves.toBeUndefined();
  });

  it('reuses one in-progress manual trigger instead of starting duplicate extraction', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { recordDebugLog } = await import('../aichatmerge-panel/modules/debug-log.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');
    let resolveAnswers;
    extractAllAnswers.mockImplementationOnce(() => new Promise(resolve => {
      resolveAnswers = resolve;
    }));

    const options = { panels: [], mergePanelIds: new Set() };
    const first = triggerMerge(options);
    const second = triggerMerge(options);

    expect(second).toBe(first);
    expect(extractAllAnswers).toHaveBeenCalledTimes(1);
    expect(extractAllAnswers).toHaveBeenCalledWith({
      timeoutMs: 2500,
      excludeUnreachablePanels: true,
    });
    expect(recordDebugLog).toHaveBeenCalledWith('merge:trigger-ignored-busy');

    resolveAnswers([]);
    await first;
  });

  it('reuses existing merge panel and injects prompt', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
    const { beginMergeSession } = await import('../aichatmerge-panel/modules/merge-monitor.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    extractAllAnswers.mockResolvedValueOnce([
      { providerName: 'ChatGPT', answer: 'answer from chatgpt' },
      { providerName: 'DeepSeek', answer: 'answer from deepseek' },
    ]);

    const existingPanel = {
      id: 'panel-merge-1',
      providerId: 'deepseek',
      iframe: { contentWindow: {}, closest: vi.fn(() => ({ scrollIntoView: vi.fn() })) },
    };
    const mergePanelIds = new Set(['panel-merge-1']);

    await triggerMerge({ panels: [existingPanel], mergePanelIds });

    expect(beginMergeSession).toHaveBeenCalled();
    expect(postToPanelIframe).toHaveBeenCalledWith(
      existingPanel,
      expect.objectContaining({
        type: 'MONITOR_COMPLETION',
        context: 'multi-panel',
      })
    );
    expect(postToPanelIframe).toHaveBeenCalledWith(
      existingPanel,
      expect.objectContaining({
        type: 'INJECT_TEXT',
        text: 'merged prompt',
        autoSubmit: true,
        context: 'auto-merge',
      })
    );
  });

  it('creates new merge panel when no existing panel matches', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
    const { beginMergeSession } = await import('../aichatmerge-panel/modules/merge-monitor.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    extractAllAnswers.mockResolvedValueOnce([
      { providerName: 'ChatGPT', answer: 'answer from chatgpt' },
    ]);

    const panels = [];
    const mergePanelIds = new Set();
    const autoExportToMarkdown = vi.fn();

    await triggerMerge({ panels, mergePanelIds, autoExportToMarkdown });

    expect(panels.length).toBe(1);
    expect(panels[0].providerId).toBe('deepseek');
    expect(panels[0].state).toBe('loading');
    expect(mergePanelIds.has(panels[0].id)).toBe(true);

    const panelEl = document.getElementById(panels[0].id);
    expect(panelEl).not.toBeNull();
    expect(panelEl.dataset.providerId).toBe('deepseek');

    expect(beginMergeSession).toHaveBeenCalled();
    expect(autoExportToMarkdown).toHaveBeenCalledWith(panels[0]);
  });

  it('hides the loading overlay and injects after a newly-created merge panel loads', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
    const {
      getActiveMergeSessionId,
      getActiveCompletionSessionGeneration,
      getCompletionSessionGeneration,
      beginMergeSession
    } = await import('../aichatmerge-panel/modules/merge-monitor.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    extractAllAnswers.mockResolvedValueOnce([
      { providerName: 'ChatGPT', answer: 'answer from chatgpt' },
    ]);
    getCompletionSessionGeneration.mockReturnValue(3);
    beginMergeSession.mockImplementationOnce((sessionId, generation) => {
      getActiveMergeSessionId.mockReturnValue(sessionId);
      getActiveCompletionSessionGeneration.mockReturnValue(generation);
    });

    const panels = [];
    await triggerMerge({ panels, mergePanelIds: new Set(), autoExportToMarkdown: vi.fn() });

    const loadingEl = document.getElementById(panels[0].id).querySelector('.panel-loading');
    expect(loadingEl.classList.contains('hidden')).toBe(false);

    panels[0].iframe.dispatchEvent(new Event('load'));

    expect(loadingEl.classList.contains('hidden')).toBe(true);
    expect(postToPanelIframe).toHaveBeenCalledWith(
      panels[0],
      expect.objectContaining({
        type: 'INJECT_TEXT',
        text: 'merged prompt',
        context: 'auto-merge',
      })
    );
  });

  it('does not inject an old merge prompt if a new-chat invalidates the merge output session before iframe load', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
    const {
      getActiveMergeSessionId,
      getActiveCompletionSessionGeneration,
      getCompletionSessionGeneration,
      beginMergeSession
    } = await import('../aichatmerge-panel/modules/merge-monitor.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    extractAllAnswers.mockResolvedValueOnce([
      { providerName: 'ChatGPT', answer: 'answer from chatgpt' },
    ]);
    getCompletionSessionGeneration.mockReturnValue(7);
    beginMergeSession.mockImplementationOnce((sessionId, generation) => {
      getActiveMergeSessionId.mockReturnValue(sessionId);
      getActiveCompletionSessionGeneration.mockReturnValue(generation);
    });

    const panels = [];
    await triggerMerge({ panels, mergePanelIds: new Set(), autoExportToMarkdown: vi.fn() });

    getActiveMergeSessionId.mockReturnValue(null);
    getActiveCompletionSessionGeneration.mockReturnValue(0);
    panels[0].iframe.dispatchEvent(new Event('load'));

    expect(postToPanelIframe).not.toHaveBeenCalledWith(
      panels[0],
      expect.objectContaining({
        type: 'INJECT_TEXT',
        text: 'merged prompt',
        context: 'auto-merge',
      })
    );
  });

  it('does not create or inject a merge panel if new-chat invalidates while answers are being extracted', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
    const { getCompletionSessionGeneration } = await import('../aichatmerge-panel/modules/merge-monitor.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    let resolveAnswers;
    extractAllAnswers.mockImplementationOnce(() => new Promise(resolve => {
      resolveAnswers = resolve;
    }));
    getCompletionSessionGeneration.mockReturnValue(7);

    const panels = [];
    const mergePromise = triggerMerge({ panels, mergePanelIds: new Set(), autoExportToMarkdown: vi.fn() });
    getCompletionSessionGeneration.mockReturnValue(8);
    resolveAnswers([{ providerName: 'ChatGPT', answer: 'answer from chatgpt' }]);
    await mergePromise;

    expect(panels.length).toBe(0);
    expect(document.querySelector('[id^="panel-merge-"]')).toBeNull();
    expect(postToPanelIframe).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'INJECT_TEXT',
        text: 'merged prompt',
        context: 'auto-merge',
      })
    );
  });

  it('returns early when provider is not found', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { getProviderById } = await import('../modules/providers.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    extractAllAnswers.mockResolvedValueOnce([
      { providerName: 'ChatGPT', answer: 'answer from chatgpt' },
    ]);
    getProviderById.mockReturnValueOnce(null);

    const panels = [];
    const mergePanelIds = new Set();

    await triggerMerge({ panels, mergePanelIds });

    expect(panels.length).toBe(0);
    expect(mergePanelIds.size).toBe(0);
  });

  it('triggers discussion in merge+discuss mode', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { startDiscussionAfterMerge } = await import('../aichatmerge-panel/modules/discussion-runner.js');
    const { getSettings } = await import('../modules/settings.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    extractAllAnswers.mockResolvedValueOnce([
      { providerName: 'ChatGPT', answer: 'answer from chatgpt' },
    ]);
    getSettings.mockResolvedValueOnce({ mergeMode: 'merge+discuss' });

    const existingPanel = {
      id: 'panel-merge-1',
      providerId: 'deepseek',
      iframe: { contentWindow: {}, closest: vi.fn(() => ({ scrollIntoView: vi.fn() })) },
    };

    await triggerMerge({ panels: [existingPanel], mergePanelIds: new Set(['panel-merge-1']) });

    expect(startDiscussionAfterMerge).toHaveBeenCalledWith(
      'merged prompt',
      1,
      existingPanel,
      expect.objectContaining({
        panels: [existingPanel],
        mergePanelIds: expect.any(Set),
      })
    );
  });

  it('schedules auto-export in merge mode (not merge+discuss)', async () => {
    const { extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const { triggerMerge } = await import('../aichatmerge-panel/modules/merge-engine.js');

    extractAllAnswers.mockResolvedValueOnce([
      { providerName: 'ChatGPT', answer: 'answer from chatgpt' },
    ]);

    const panels = [];
    const mergePanelIds = new Set();
    const autoExportToMarkdown = vi.fn();

    await triggerMerge({ panels, mergePanelIds, autoExportToMarkdown });

    expect(autoExportToMarkdown).toHaveBeenCalledWith(panels[0]);
  });
});
