/**
 * Regression tests: mergeIsActive, lastMergeType, AUTO_MERGE_ENABLED
 * must have a SINGLE source of truth (merge-monitor.js).
 *
 * state.js must NOT export these getters/setters — any reintroduction
 * creates a dual-source divergence at runtime.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock merge-monitor.js dependencies so the real module can load
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/send-pipeline.js', () => ({
  getNonMergePanels: vi.fn(() => []),
  isMergePanel: vi.fn(() => false),
}));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: vi.fn(),
  getPanelDebugInfo: vi.fn(() => ({})),
}));
vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({
  acquireExtractMode: vi.fn(),
  releaseExtractMode: vi.fn(),
}));

describe('merge state ownership — no dual source', () => {
  it('state.js must NOT export mergeIsActive getter/setter', async () => {
    const stateMod = await import('../aichatmerge-panel/modules/state.js');
    expect(stateMod.getMergeIsActive).toBeUndefined();
    expect(stateMod.setMergeIsActive).toBeUndefined();
  });

  it('state.js must NOT export lastMergeType getter/setter', async () => {
    const stateMod = await import('../aichatmerge-panel/modules/state.js');
    expect(stateMod.getLastMergeType).toBeUndefined();
    expect(stateMod.setLastMergeType).toBeUndefined();
  });

  it('state.js must NOT export AUTO_MERGE_ENABLED getter/setter', async () => {
    const stateMod = await import('../aichatmerge-panel/modules/state.js');
    expect(stateMod.getAutoMergeEnabled).toBeUndefined();
    expect(stateMod.setAutoMergeEnabled).toBeUndefined();
  });

  it('merge-monitor.js IS the single source for mergeIsActive', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-monitor.js');
    expect(typeof mod.getMergeIsActive).toBe('function');
    expect(typeof mod.setMergeIsActive).toBe('function');

    // Default should be false (no active merge at rest)
    expect(mod.getMergeIsActive()).toBe(false);

    mod.setMergeIsActive(true);
    expect(mod.getMergeIsActive()).toBe(true);

    mod.setMergeIsActive(false);
    expect(mod.getMergeIsActive()).toBe(false);
  });

  it('merge-monitor.js IS the single source for lastMergeType', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-monitor.js');
    expect(typeof mod.getLastMergeType).toBe('function');
    expect(typeof mod.setLastMergeType).toBe('function');

    // Default should be null
    expect(mod.getLastMergeType()).toBeNull();

    mod.setLastMergeType('auto');
    expect(mod.getLastMergeType()).toBe('auto');

    mod.setLastMergeType('timeout');
    expect(mod.getLastMergeType()).toBe('timeout');

    mod.setLastMergeType(null);
    expect(mod.getLastMergeType()).toBeNull();
  });

  it('merge-monitor.js IS the single source for AUTO_MERGE_ENABLED', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-monitor.js');
    expect(typeof mod.getAutoMergeEnabled).toBe('function');
    expect(typeof mod.setAutoMergeEnabled).toBe('function');

    // Default should be true
    expect(mod.getAutoMergeEnabled()).toBe(true);

    mod.setAutoMergeEnabled(false);
    expect(mod.getAutoMergeEnabled()).toBe(false);

    mod.setAutoMergeEnabled(true);
    expect(mod.getAutoMergeEnabled()).toBe(true);
  });
});
