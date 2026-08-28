/**
 * Regression tests for merge-engine.js export surface.
 *
 * After Task A, merge-engine.js only exports triggerMerge.
 * No wildcard re-exports, no state re-exports.
 * External callers (panel-lifecycle.js, panel-ui-bindings.js)
 * import { triggerMerge } from './merge-engine.js' — this must keep working.
 */

import { describe, it, expect, vi } from 'vitest';

// Minimal mocks so the module can be imported without DOM errors
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-header-actions.js', () => ({
  getPanelHeaderRightHtml: vi.fn(() => ''),
  bindPanelHeaderActions: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-frame-config.js', () => ({
  getProviderFrameUrl: vi.fn(() => 'https://example.com'),
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
vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({
  extractAllAnswers: vi.fn(async () => []),
}));
vi.mock('../aichatmerge-panel/modules/merge-prompt.js', () => ({
  buildMergePrompt: vi.fn(() => ''),
  getMergeBadgeMeta: vi.fn(() => ({ background: '#000', text: '', title: '' })),
}));
vi.mock('../aichatmerge-panel/modules/discussion-runner.js', () => ({
  startDiscussionAfterMerge: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  getActiveMergeSessionId: vi.fn(() => null),
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
  getLastSentQuestion: vi.fn(() => ''),
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

describe('merge-engine.js export surface', () => {
  it('exports triggerMerge as a function', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-engine.js');
    expect(typeof mod.triggerMerge).toBe('function');
  });

  it('does not re-export state getters from merge-state.js', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-engine.js');
    const stateExportNames = [
      'getSelectedMergeTarget', 'setSelectedMergeTarget',
      'getLastSentQuestion', 'setLastSentQuestion',
    ];
    for (const name of stateExportNames) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it('does not re-export auto-export state from markdown-export.js', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-engine.js');
    const autoExportNames = [
      'getAutoExportWaitController', 'setAutoExportWaitController',
      'getAutoExportRunId', 'incrementAutoExportRunId',
      'getAutoExportWriteInProgress', 'setAutoExportWriteInProgress',
    ];
    for (const name of autoExportNames) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it('does not re-export merge-monitor state', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-engine.js');
    const monitorNames = [
      'getMergeIsActive', 'setMergeIsActive',
      'getLastMergeType', 'setLastMergeType',
      'getAutoMergeEnabled', 'setAutoMergeEnabled',
      'getActiveMergeSessionId', 'setActiveMergeSessionId',
    ];
    for (const name of monitorNames) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it('does not re-export domain helpers from sub-modules', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-engine.js');
    const domainNames = [
      'extractAllAnswers',
      'buildMergePrompt', 'getMergeBadgeMeta',
      'startDiscussionAfterMerge',
      'postToPanelIframe',
      'getPanelDebugInfo', 'recordDebugLog',
    ];
    for (const name of domainNames) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it('total named exports is exactly 1 (triggerMerge)', async () => {
    const mod = await import('../aichatmerge-panel/modules/merge-engine.js');
    const namedExports = Object.keys(mod).filter(k => k !== 'default');
    expect(namedExports).toEqual(['triggerMerge']);
  });
});
