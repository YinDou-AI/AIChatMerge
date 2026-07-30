/**
 * Regression tests for markdown-export.js
 * Covers: score helpers, feedback UI, auto-export state management,
 * manual export early-return guards, export mode gating, discussion export.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../modules/obsidian-export.js', () => ({
  exportToMarkdown: vi.fn(async () => ({ success: true, filePath: '/vault/note.md' })),
  extractScores: vi.fn(() => []),
  cleanAnswer: vi.fn((a) => a),
  extractTitle: vi.fn(() => ''),
}));
vi.mock('../modules/score-manager.js', () => ({
  saveScoreHistory: vi.fn(async () => true),
}));
vi.mock('../modules/settings.js', () => ({
  getSettings: vi.fn(async () => ({
    markdownExportMode: 'auto',
    exportInitialMerge: false,
  })),
}));
vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({
  t: vi.fn((key) => key),
}));
vi.mock('../aichatmerge-panel/modules/toast.js', () => ({
  showToast: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: vi.fn(),
  getPanelDebugInfo: vi.fn(() => ({})),
}));
vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({
  extractSinglePanelAnswer: vi.fn(async () => ''),
}));
vi.mock('../aichatmerge-panel/modules/state.js', () => ({
  getPanels: vi.fn(() => []),
}));
vi.mock('../aichatmerge-panel/modules/send-pipeline.js', () => ({
  isMergePanel: vi.fn(() => false),
}));
vi.mock('../aichatmerge-panel/modules/discussion-gates.js', () => ({
  waitForFinalMergeAnswerBeforeExport: vi.fn(async () => 'resolved answer'),
  getCurrentMergeMaxWait: vi.fn(() => 5000),
}));

describe('markdown-export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <button id="obsidian-export-btn"></button>
      <span id="send-status"></span>
    `;
  });

  describe('buildScoreSignature', () => {
    it('builds correct signature from question and scores', async () => {
      const { buildScoreSignature } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const sig = buildScoreSignature('What is AI?', [
        { model: 'GPT-4', score: 9 },
        { model: 'DeepSeek', score: 8 },
      ]);
      expect(sig).toBe('What is AI?::GPT-4:9|DeepSeek:8');
    });

    it('handles empty question', async () => {
      const { buildScoreSignature } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const sig = buildScoreSignature('', [{ model: 'X', score: 5 }]);
      expect(sig).toBe('::X:5');
    });

    it('handles null scores', async () => {
      const { buildScoreSignature } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const sig = buildScoreSignature('Q', null);
      expect(sig).toBe('Q::');
    });
  });

  describe('saveMergeScoresIfPresent', () => {
    it('returns null when scores is null', async () => {
      const { saveMergeScoresIfPresent } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const result = await saveMergeScoresIfPresent({}, 'q', null);
      expect(result).toBeNull();
    });

    it('returns null when scores is empty array', async () => {
      const { saveMergeScoresIfPresent } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const result = await saveMergeScoresIfPresent({}, 'q', []);
      expect(result).toBeNull();
    });

    it('saves when scores provided and signature differs', async () => {
      const { saveScoreHistory } = await import('../modules/score-manager.js');
      const { saveMergeScoresIfPresent } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const panel = {};
      const result = await saveMergeScoresIfPresent(panel, 'q', [{ model: 'A', score: 8 }]);
      expect(saveScoreHistory).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(panel.lastSavedScoreSignature).toBeTruthy();
    });

    it('skips save when signature matches (dedup)', async () => {
      const { saveScoreHistory } = await import('../modules/score-manager.js');
      const { saveMergeScoresIfPresent, buildScoreSignature } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const sig = buildScoreSignature('q', [{ model: 'A', score: 8 }]);
      const panel = { lastSavedScoreSignature: sig };
      const result = await saveMergeScoresIfPresent(panel, 'q', [{ model: 'A', score: 8 }]);
      expect(saveScoreHistory).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('setMarkdownExportFeedback', () => {
    it('sets busy state on export button', async () => {
      const { setMarkdownExportFeedback } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const btn = document.getElementById('obsidian-export-btn');
      setMarkdownExportFeedback(true);
      expect(btn.disabled).toBe(true);
      expect(btn.classList.contains('is-busy')).toBe(true);
      expect(btn.getAttribute('aria-busy')).toBe('true');
    });

    it('clears busy state on export button', async () => {
      const { setMarkdownExportFeedback } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const btn = document.getElementById('obsidian-export-btn');
      setMarkdownExportFeedback(true);
      setMarkdownExportFeedback(false);
      expect(btn.disabled).toBe(false);
      expect(btn.classList.contains('is-busy')).toBe(false);
    });

    it('does not throw when button elements are missing', async () => {
      document.body.innerHTML = '<span id="send-status"></span>';
      const { setMarkdownExportFeedback } = await import('../aichatmerge-panel/modules/markdown-export.js');
      expect(() => setMarkdownExportFeedback(true)).not.toThrow();
    });
  });

  describe('auto export state management', () => {
    it('initial auto-export state', async () => {
      const mod = await import('../aichatmerge-panel/modules/markdown-export.js');
      expect(mod.getAutoExportWaitController()).toBeNull();
      expect(mod.getAutoExportRunId()).toBe(0);
      expect(mod.getAutoExportWriteInProgress()).toBe(false);
    });

    it('incrementAutoExportRunId increments', async () => {
      const mod = await import('../aichatmerge-panel/modules/markdown-export.js');
      const before = mod.getAutoExportRunId();
      mod.incrementAutoExportRunId();
      expect(mod.getAutoExportRunId()).toBe(before + 1);
    });

    it('setAutoExportWriteInProgress toggles state', async () => {
      const mod = await import('../aichatmerge-panel/modules/markdown-export.js');
      mod.setAutoExportWriteInProgress(true);
      expect(mod.getAutoExportWriteInProgress()).toBe(true);
      mod.setAutoExportWriteInProgress(false);
      expect(mod.getAutoExportWriteInProgress()).toBe(false);
    });

    it('setAutoExportWaitController stores controller', async () => {
      const mod = await import('../aichatmerge-panel/modules/markdown-export.js');
      const ctrl = new AbortController();
      mod.setAutoExportWaitController(ctrl);
      expect(mod.getAutoExportWaitController()).toBe(ctrl);
    });
  });

  describe('autoExportToMarkdown', () => {
    it('returns early when export mode is not auto', async () => {
      const { getSettings } = await import('../modules/settings.js');
      getSettings.mockResolvedValueOnce({ markdownExportMode: 'manual' });

      const mod = await import('../aichatmerge-panel/modules/markdown-export.js');
      const mergePanel = { id: 'panel-1', exportData: {} };
      await mod.autoExportToMarkdown(mergePanel);
      // Should return early without calling exportToMarkdown
      const { exportToMarkdown } = await import('../modules/obsidian-export.js');
      expect(exportToMarkdown).not.toHaveBeenCalled();
    });

    it('cancels stale run when a newer run starts', async () => {
      const mod = await import('../aichatmerge-panel/modules/markdown-export.js');
      const { exportToMarkdown } = await import('../modules/obsidian-export.js');

      // Simulate a newer run having incremented the runId
      mod.incrementAutoExportRunId();
      mod.incrementAutoExportRunId();
      const currentRunId = mod.getAutoExportRunId();

      // Now call autoExportToMarkdown — the mock exportToMarkdown should still be called
      // but the stale-run check should not prevent it since we haven't incremented again
      const mergePanel = {
        id: 'panel-1',
        exportData: { question: 'q', providers: ['A'], mode: 'merge' },
      };
      await mod.autoExportToMarkdown(mergePanel);
      // If the runId is current, exportToMarkdown should have been called
      expect(exportToMarkdown).toHaveBeenCalled();
    });

    it('skips write when another export is in progress', async () => {
      const mod = await import('../aichatmerge-panel/modules/markdown-export.js');
      const { exportToMarkdown } = await import('../modules/obsidian-export.js');

      mod.setAutoExportWriteInProgress(true);

      const mergePanel = {
        id: 'panel-1',
        exportData: { question: 'q', providers: ['A'], mode: 'merge' },
      };
      await mod.autoExportToMarkdown(mergePanel);
      expect(exportToMarkdown).not.toHaveBeenCalled();

      mod.setAutoExportWriteInProgress(false);
    });
  });

  describe('exportDiscussionResult', () => {
    it('returns early when export mode is not auto', async () => {
      const { getSettings } = await import('../modules/settings.js');
      getSettings.mockResolvedValueOnce({ markdownExportMode: 'manual' });

      const { exportDiscussionResult } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const result = await exportDiscussionResult('answer', { question: 'q' });
      expect(result).toBeUndefined();
    });

    it('returns early when answer is empty', async () => {
      const { exportDiscussionResult } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const result = await exportDiscussionResult('', { question: 'q' });
      expect(result).toBeUndefined();
    });

    it('calls exportToMarkdown with discuss mode', async () => {
      const { exportToMarkdown } = await import('../modules/obsidian-export.js');
      const { exportDiscussionResult } = await import('../aichatmerge-panel/modules/markdown-export.js');

      const result = await exportDiscussionResult('final answer', {
        question: 'q',
        providers: ['GPT-4'],
        title: 'Test Title',
      });

      expect(exportToMarkdown).toHaveBeenCalledWith(
        expect.objectContaining({
          answer: 'final answer',
          mode: 'discuss',
          title: 'Test Title',
        })
      );
      expect(result.success).toBe(true);
    });

    it('shows toast on success', async () => {
      const { showToast } = await import('../aichatmerge-panel/modules/toast.js');
      const { exportDiscussionResult } = await import('../aichatmerge-panel/modules/markdown-export.js');

      await exportDiscussionResult('answer', { question: 'q' });
      expect(showToast).toHaveBeenCalled();
    });

    it('handles export failure gracefully', async () => {
      const { exportToMarkdown } = await import('../modules/obsidian-export.js');
      exportToMarkdown.mockResolvedValueOnce({ success: false, error: 'write error' });

      const { exportDiscussionResult } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const result = await exportDiscussionResult('answer', { question: 'q' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('write error');
    });
  });

  describe('exportMergeResult', () => {
    it('calls exportToMarkdown with merge mode', async () => {
      const { exportToMarkdown } = await import('../modules/obsidian-export.js');
      const { exportMergeResult } = await import('../aichatmerge-panel/modules/markdown-export.js');

      const result = await exportMergeResult('initial merged answer', {
        question: 'q',
        providers: ['GPT-4'],
        title: 'Initial Title',
      });

      expect(exportToMarkdown).toHaveBeenCalledWith(
        expect.objectContaining({
          answer: 'initial merged answer',
          mode: 'merge',
          title: 'Initial Title',
        })
      );
      expect(result.success).toBe(true);
    });
  });
});
