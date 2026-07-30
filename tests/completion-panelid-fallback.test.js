import { describe, it, expect, vi, beforeEach } from 'vitest';

// Root cause: iframe COMPLETION_DETECTED carries only `provider`, not `panelId`.
// panel-transport must fall back to the receiving panel's id so completion maps to
// the exact panel. Without it, provider-name matching misfires and completions drop.

const panelA = { id: 'panel-A', providerId: 'deepseek', iframe: { contentWindow: {}, src: 'https://chat.deepseek.com/' } };
const panelB = { id: 'panel-B', providerId: 'kimi', iframe: { contentWindow: {}, src: 'https://www.kimi.com/' } };
const allPanels = [panelA, panelB];
const mergeEngineMocks = vi.hoisted(() => ({
  triggerMerge: vi.fn(),
}));

vi.mock('../aichatmerge-panel/modules/send-pipeline.js', () => ({
  getNonMergePanels: () => allPanels,
  isMergePanel: () => false,
  getMergePanelIds: () => new Set(),
  handlePanelInjectionResult: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: vi.fn(),
  getIframeTargetOrigin: () => 'https://chat.deepseek.com',
}));
vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({
  acquireExtractMode: vi.fn(),
  releaseExtractMode: vi.fn(),
  handleExtractedAnswer: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: vi.fn(),
  getPanelDebugInfo: (p) => ({ panelId: p?.id, providerId: p?.providerId }),
}));
vi.mock('../aichatmerge-panel/modules/merge-engine.js', () => ({
  triggerMerge: mergeEngineMocks.triggerMerge,
}));

describe('merge completion maps to receiving panel when payload lacks panelId', () => {
  let mm;
  beforeEach(async () => {
    vi.resetModules();
    mergeEngineMocks.triggerMerge.mockReset();
    mm = await import('../aichatmerge-panel/modules/merge-monitor.js');
    mm.beginMergeSession('merge-test-1');
  });

  it('counts a panel-scoped completion (panelId supplied via fallback)', () => {
    // Simulate what panel-transport now does: inject panelId from the receiving panel.
    mm.handleMergeCompletionDetected(
      { context: 'multi-panel-completion', mergeSessionId: 'merge-test-1', panelId: panelA.id, provider: panelA.providerId },
      allPanels,
      new Set()
    );
    expect(mm.getMergeCompletedPanels().has(panelA.id)).toBe(true);
  });

  it('reaches all-complete (triggers merge) only when both distinct panels report', async () => {
    mm.handleMergeCompletionDetected(
      { context: 'multi-panel-completion', mergeSessionId: 'merge-test-1', panelId: panelA.id, provider: 'deepseek' },
      allPanels, new Set()
    );
    // One of two done — must NOT trigger yet.
    expect(mergeEngineMocks.triggerMerge).not.toHaveBeenCalled();

    mm.handleMergeCompletionDetected(
      { context: 'multi-panel-completion', mergeSessionId: 'merge-test-1', panelId: panelB.id, provider: 'kimi' },
      allPanels, new Set()
    );
    // Both distinct panels done — auto-merge fires exactly once.
    await vi.waitFor(() => {
      expect(mergeEngineMocks.triggerMerge).toHaveBeenCalledTimes(1);
    });
  });

  it('does not clear a new merge output session started by the trigger callback', async () => {
    mergeEngineMocks.triggerMerge.mockImplementationOnce(() => {
      mm.beginMergeSession('merge-output-1');
    });

    mm.handleMergeCompletionDetected(
      { context: 'multi-panel-completion', mergeSessionId: 'merge-test-1', panelId: panelA.id, provider: 'deepseek' },
      allPanels, new Set()
    );
    mm.handleMergeCompletionDetected(
      { context: 'multi-panel-completion', mergeSessionId: 'merge-test-1', panelId: panelB.id, provider: 'kimi' },
      allPanels, new Set()
    );
    await vi.waitFor(() => {
      expect(mm.getMergeIsActive()).toBe(true);
    });
  });

  it('triggers auto merge when removing the only unfinished source panel', async () => {
    mm.addMergeCompletedPanel(panelB.id);

    mm.reconcileAfterPanelRemoval(panelA.id, [panelB], new Set());
    await vi.waitFor(() => {
      expect(mergeEngineMocks.triggerMerge).toHaveBeenCalledWith({
        panels: [panelB],
        mergePanelIds: new Set()
      });
    });
  });

  it('does not trigger auto merge after panel removal when auto merge is disabled', async () => {
    mm.setAutoMergeEnabled(false);
    mm.addMergeCompletedPanel(panelB.id);

    mm.reconcileAfterPanelRemoval(panelA.id, [panelB], new Set());
    await Promise.resolve();

    expect(mergeEngineMocks.triggerMerge).not.toHaveBeenCalled();
    expect(mm.getMergeIsActive()).toBe(false);
    mm.setAutoMergeEnabled(true);
  });
});
