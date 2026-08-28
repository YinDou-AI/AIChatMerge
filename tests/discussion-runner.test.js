/**
 * Regression tests for discussion-runner.js
 * Covers: stop flow, status bar, abort handling, zero-rounds guard.
 * Log prefix: discussion:*
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/send-pipeline.js', () => ({
  getNonMergePanels: vi.fn(() => []),
  isMergePanel: vi.fn(() => false),
  ensurePanelVisibleBeforeAutoSubmit: vi.fn(),
  sendToPanel: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: vi.fn(),
  getPanelDebugInfo: vi.fn(() => ({})),
}));
vi.mock('../modules/providers.js', () => ({
  getProviderById: vi.fn(() => ({ id: 'deepseek', name: 'DeepSeek' })),
}));
vi.mock('../modules/obsidian-export.js', () => ({
  cleanAnswer: vi.fn((a) => a),
  extractTitle: vi.fn(() => ''),
  extractScores: vi.fn(() => []),
}));
vi.mock('../aichatmerge-panel/modules/markdown-export.js', () => ({
  exportDiscussionResult: vi.fn(),
  exportMergeResult: vi.fn(),
  saveMergeScoresIfPresent: vi.fn(),
}));
vi.mock('../modules/settings.js', () => ({
  getSettings: vi.fn(async () => ({ mergeMode: 'merge', markdownExportMode: 'auto' })),
}));
vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({
  extractAllAnswers: vi.fn(async () => []),
  extractSinglePanelAnswer: vi.fn(async () => ''),
}));
vi.mock('../aichatmerge-panel/modules/merge-prompt.js', () => ({
  buildFinalMergePrompt: vi.fn(() => 'final-merge-prompt'),
  buildDiscussPrompt: vi.fn(() => 'discuss-prompt'),
  sanitizeMergedAnswerForDiscussion: vi.fn((a) => a),
  generateFallbackTitle: vi.fn(() => 'Fallback Title'),
  isTrueSetting: vi.fn((v) => v === true || v === 'true'),
}));
vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  stopMergeMonitor: vi.fn(),
  clearActiveCompletionSession: vi.fn(),
  beginMergeSession: vi.fn(),
  invalidateCompletionSessions: vi.fn(),
  getActiveMergeSessionId: vi.fn(() => 'discussion-merge-1'),
  getCompletionSessionGeneration: vi.fn(() => 0),
  getActiveCompletionSessionGeneration: vi.fn(() => 0),
}));
vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({
  t: vi.fn((key) => key),
  getCurrentLocale: vi.fn(() => 'en'),
}));
vi.mock('../aichatmerge-panel/modules/discussion-gates.js', () => ({
  getCurrentMergeMaxWait: vi.fn(() => 5000),
  waitForDiscussionStartGate: vi.fn(async () => ({ answer: 'gate answer', reason: 'text-stable' })),
  waitForDiscussionPanelsCompletionWithAbort: vi.fn(async () => {}),
  waitForDiscussionMergeCompletionWithFallback: vi.fn(async () => {}),
  waitForFinalMergeAnswerBeforeExport: vi.fn(async () => 'final answer'),
}));
vi.mock('../aichatmerge-panel/modules/merge-state.js', () => ({
  getSelectedMergeTarget: vi.fn(() => 'deepseek'),
  getLastSentQuestion: vi.fn(() => 'test question'),
}));
vi.mock('../aichatmerge-panel/modules/toast.js', () => ({
  showToast: vi.fn(),
}));

describe('discussion-runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="discussion-status-bar" style="display:none">
        <span id="discussion-progress-text"></span>
      </div>
    `;
  });

  describe('stopDiscussion', () => {
    it('is a no-op when no discussion is active', async () => {
      const { stopDiscussion, getDiscussionActive } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const { invalidateCompletionSessions, stopMergeMonitor } = await import('../aichatmerge-panel/modules/merge-monitor.js');
      expect(getDiscussionActive()).toBe(false);
      stopDiscussion('manual');
      expect(getDiscussionActive()).toBe(false);
      expect(invalidateCompletionSessions).toHaveBeenCalledWith('discussion-stop:manual');
      expect(stopMergeMonitor).not.toHaveBeenCalled();
    });
  });

  describe('status bar', () => {
    it('showDiscussionStatusBar displays the bar and sets initial text', async () => {
      const { showDiscussionStatusBar } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const bar = document.getElementById('discussion-status-bar');
      expect(bar.style.display).toBe('none');

      showDiscussionStatusBar(3);
      expect(bar.style.display).toBe('flex');
      const text = document.getElementById('discussion-progress-text');
      // t() mock returns the key; the important thing is the bar is visible and text is set
      expect(text.textContent).toBe('discussionProgressInitial');
    });

    it('hideDiscussionStatusBar hides the bar', async () => {
      const { showDiscussionStatusBar, hideDiscussionStatusBar } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      showDiscussionStatusBar(3);
      hideDiscussionStatusBar();
      const bar = document.getElementById('discussion-status-bar');
      expect(bar.style.display).toBe('none');
    });

    it('updateDiscussionProgress updates the text', async () => {
      const { updateDiscussionProgress } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const text = document.getElementById('discussion-progress-text');
      updateDiscussionProgress(2, 5);
      // t() mock returns the key; the important thing is the text element gets updated
      expect(text.textContent).toBe('discussionProgress');
    });

    it('showDiscussionStatusBar does not throw when bar element is missing', async () => {
      document.body.innerHTML = '';
      const { showDiscussionStatusBar } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      expect(() => showDiscussionStatusBar(3)).not.toThrow();
    });

    it('hideDiscussionStatusBar does not throw when bar element is missing', async () => {
      document.body.innerHTML = '';
      const { hideDiscussionStatusBar } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      expect(() => hideDiscussionStatusBar()).not.toThrow();
    });
  });

  describe('getDiscussionActive / title', () => {
    it('returns false when no discussion has run', async () => {
      const { getDiscussionActive, getLastDiscussionTitle } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      expect(getDiscussionActive()).toBe(false);
      expect(getLastDiscussionTitle()).toBe('');
    });

    it('setLastDiscussionTitle updates the title', async () => {
      const { setLastDiscussionTitle, getLastDiscussionTitle } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      setLastDiscussionTitle('My Title');
      expect(getLastDiscussionTitle()).toBe('My Title');
    });
  });

  describe('startDiscussionAfterMerge', () => {
    it('returns early when totalRounds <= 0', async () => {
      const { startDiscussionAfterMerge, getDiscussionActive } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const mergePanel = { id: 'panel-1', providerId: 'deepseek', iframe: {} };
      await startDiscussionAfterMerge('prompt', 0, mergePanel, {
        panels: [], mergePanelIds: new Set(), autoExportToMarkdown: vi.fn(),
        selectedMergeTarget: 'deepseek', lastSentQuestion: 'q',
      });
      expect(getDiscussionActive()).toBe(false);
    });

    it('completes a single-round discussion and sets discussionActive false', async () => {
      const { startDiscussionAfterMerge, getDiscussionActive } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const { extractSinglePanelAnswer } = await import('../aichatmerge-panel/modules/answer-extractor.js');
      const { waitForDiscussionStartGate } = await import('../aichatmerge-panel/modules/discussion-gates.js');

      // Provide a merge panel that exists in panels array
      const mergePanel = {
        id: 'panel-merge-1',
        providerId: 'deepseek',
        iframe: { contentWindow: {}, closest: vi.fn(() => ({ scrollIntoView: vi.fn() })) },
      };
      const nonMergePanel = {
        id: 'panel-chatgpt',
        providerId: 'chatgpt',
        iframe: { contentWindow: {} },
      };

      // extractSinglePanelAnswer returns a baseline for the merge panel
      extractSinglePanelAnswer.mockResolvedValueOnce('baseline');
      // After discussion completes, extractSinglePanelAnswer returns the final merged answer
      extractSinglePanelAnswer.mockResolvedValueOnce('final merged');

      // startGate returns new answer
      waitForDiscussionStartGate.mockResolvedValueOnce({ answer: 'gate answer', reason: 'text-stable' });

      const sendToPanel = (await import('../aichatmerge-panel/modules/send-pipeline.js')).sendToPanel;
      sendToPanel.mockResolvedValue(true);

      await startDiscussionAfterMerge('prompt', 1, mergePanel, {
        panels: [mergePanel, nonMergePanel],
        mergePanelIds: new Set(['panel-merge-1']),
        autoExportToMarkdown: vi.fn(),
        selectedMergeTarget: 'deepseek',
        lastSentQuestion: 'test question',
      });

      expect(getDiscussionActive()).toBe(false);
    });

    it('discussionActive is false even when an error occurs', async () => {
      const { waitForDiscussionStartGate } = await import('../aichatmerge-panel/modules/discussion-gates.js');
      waitForDiscussionStartGate.mockRejectedValueOnce(new Error('gate failed'));

      const { startDiscussionAfterMerge, getDiscussionActive } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const mergePanel = {
        id: 'panel-1', providerId: 'deepseek',
        iframe: { contentWindow: {} },
      };

      await startDiscussionAfterMerge('prompt', 1, mergePanel, {
        panels: [mergePanel], mergePanelIds: new Set(['panel-1']),
        autoExportToMarkdown: vi.fn(), selectedMergeTarget: 'deepseek', lastSentQuestion: 'q',
      });

      expect(getDiscussionActive()).toBe(false);
    });

    it('sends discussion prompts to non-merge panels via sendToPanel', async () => {
      const { startDiscussionAfterMerge, getDiscussionActive } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const { extractSinglePanelAnswer, extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
      const {
        waitForDiscussionStartGate,
        waitForDiscussionPanelsCompletionWithAbort,
      } = await import('../aichatmerge-panel/modules/discussion-gates.js');
      const { getNonMergePanels, sendToPanel } = await import('../aichatmerge-panel/modules/send-pipeline.js');

      const mergePanel = {
        id: 'panel-merge-1',
        providerId: 'deepseek',
        iframe: { contentWindow: {}, closest: vi.fn(() => ({ scrollIntoView: vi.fn() })) },
      };
      const nonMergePanel = {
        id: 'panel-chatgpt',
        providerId: 'chatgpt',
        iframe: { contentWindow: {} },
      };

      getNonMergePanels.mockReturnValue([nonMergePanel]);

      // extractSinglePanelAnswer: baseline → round merge result
      extractSinglePanelAnswer.mockResolvedValueOnce('baseline');
      extractSinglePanelAnswer.mockResolvedValueOnce('merged-round1');

      waitForDiscussionStartGate.mockResolvedValueOnce({ answer: 'gate answer', reason: 'text-stable' });

      // extractAllAnswers for round 1 — must return valid answers
      extractAllAnswers.mockResolvedValueOnce([
        { providerName: 'ChatGPT', answer: 'discuss answer r1' },
      ]);

      sendToPanel.mockResolvedValue(true);

      await startDiscussionAfterMerge('prompt', 1, mergePanel, {
        panels: [mergePanel, nonMergePanel],
        mergePanelIds: new Set(['panel-merge-1']),
        autoExportToMarkdown: vi.fn(),
        selectedMergeTarget: 'deepseek',
        lastSentQuestion: 'test question',
      });

      expect(getDiscussionActive()).toBe(false);
      expect(sendToPanel).toHaveBeenCalledTimes(1);
      expect(sendToPanel).toHaveBeenCalledWith(
        nonMergePanel,
        'discuss-prompt',
        true,
        null,
        0,
        expect.stringContaining('discussion-round-1')
      );
      expect(waitForDiscussionPanelsCompletionWithAbort).toHaveBeenCalledWith(
        [nonMergePanel],
        expect.any(AbortSignal),
        5000,
        'discussion-wait:aborted',
        expect.any(Map)
      );
      expect(waitForDiscussionPanelsCompletionWithAbort.mock.invocationCallOrder[0])
        .toBeLessThan(sendToPanel.mock.invocationCallOrder[0]);
      const expectedSessions = waitForDiscussionPanelsCompletionWithAbort.mock.calls[0][4];
      expect(expectedSessions.get(nonMergePanel.id)).toBe(sendToPanel.mock.calls[0][5]);
    });

    it('calls exportDiscussionResult after discussion completes', async () => {
      const { startDiscussionAfterMerge, getDiscussionActive } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const { extractSinglePanelAnswer, extractAllAnswers } = await import('../aichatmerge-panel/modules/answer-extractor.js');
      const {
        waitForDiscussionStartGate,
        waitForFinalMergeAnswerBeforeExport,
      } = await import('../aichatmerge-panel/modules/discussion-gates.js');
      const { exportDiscussionResult } = await import('../aichatmerge-panel/modules/markdown-export.js');
      const { getNonMergePanels, sendToPanel } = await import('../aichatmerge-panel/modules/send-pipeline.js');

      const mergePanel = {
        id: 'panel-merge-1',
        providerId: 'deepseek',
        iframe: { contentWindow: {}, closest: vi.fn(() => ({ scrollIntoView: vi.fn() })) },
      };

      // getNonMergePanels must return at least one panel for the loop to run
      getNonMergePanels.mockReturnValue([{ id: 'panel-chatgpt', providerId: 'chatgpt', iframe: { contentWindow: {} } }]);

      // extractSinglePanelAnswer: baseline → round merge result (called twice)
      extractSinglePanelAnswer.mockImplementation(async (...args) => {
        const callNum = extractSinglePanelAnswer.mock.calls.length;
        if (callNum === 0) return 'baseline';
        return 'final merged answer';
      });
      waitForDiscussionStartGate.mockResolvedValueOnce({ answer: 'gate answer', reason: 'text-stable' });
      // extractAllAnswers for round 1 — must return valid answers so the round completes
      // Note: extractAllAnswers is also called for providersSnapshot, so use mockImplementation
      extractAllAnswers.mockImplementation(async () => [
        { providerName: 'ChatGPT', answer: 'discuss answer' },
      ]);
      sendToPanel.mockResolvedValue(true);

      await startDiscussionAfterMerge('prompt', 1, mergePanel, {
        panels: [mergePanel],
        mergePanelIds: new Set(['panel-merge-1']),
        autoExportToMarkdown: vi.fn(),
        selectedMergeTarget: 'deepseek',
        lastSentQuestion: 'test question',
      });

      expect(getDiscussionActive()).toBe(false);
      // exportDiscussionResult is called at least once after discussion completes
      expect(exportDiscussionResult).toHaveBeenCalled();
      const exportCall = exportDiscussionResult.mock.calls.find(
        call => call[1]?.question === 'test question'
      );
      expect(exportCall).toBeDefined();
      expect(exportCall[1]).toMatchObject({
        question: 'test question',
        providers: expect.any(Array),
      });
      expect(waitForFinalMergeAnswerBeforeExport).toHaveBeenCalled();
    });

    it('exports the initial merge after discussion prompts are sent', async () => {
      const { startDiscussionAfterMerge } = await import('../aichatmerge-panel/modules/discussion-runner.js');
      const { getSettings } = await import('../modules/settings.js');
      const { waitForDiscussionStartGate } = await import('../aichatmerge-panel/modules/discussion-gates.js');
      const { getNonMergePanels, sendToPanel } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { exportDiscussionResult, exportMergeResult } = await import('../aichatmerge-panel/modules/markdown-export.js');

      getSettings.mockResolvedValueOnce({
        markdownExportMode: 'auto',
        exportInitialMerge: true,
      });
      waitForDiscussionStartGate.mockResolvedValueOnce({
        answer: 'initial merged answer',
        reason: 'completion-event',
      });
      const nonMergePanel = {
        id: 'panel-chatgpt',
        providerId: 'chatgpt',
        iframe: { contentWindow: {} },
      };
      getNonMergePanels.mockReturnValue([nonMergePanel]);
      sendToPanel.mockResolvedValue(true);

      const mergePanel = {
        id: 'panel-merge-1',
        providerId: 'deepseek',
        iframe: { contentWindow: {} },
      };

      await startDiscussionAfterMerge('prompt', 1, mergePanel, {
        panels: [mergePanel],
        mergePanelIds: new Set(['panel-merge-1']),
        autoExportToMarkdown: vi.fn(),
        selectedMergeTarget: 'deepseek',
        lastSentQuestion: 'test question',
      });

      expect(sendToPanel).toHaveBeenCalledWith(
        nonMergePanel,
        'discuss-prompt',
        true,
        null,
        0,
        expect.stringContaining('discussion-round-1')
      );
      expect(exportMergeResult).toHaveBeenCalledWith(
        'initial merged answer',
        expect.objectContaining({
          question: 'test question',
          title: '',
        })
      );
      expect(sendToPanel.mock.invocationCallOrder[0]).toBeLessThan(
        exportMergeResult.mock.invocationCallOrder[0]
      );
      expect(exportDiscussionResult).not.toHaveBeenCalledWith(
        'initial merged answer',
        expect.anything()
      );
    });
  });
});
