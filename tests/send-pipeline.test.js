/**
 * Regression tests for send-pipeline.js
 * Covers: merge panel tracking, injection result handling, broadcastMessage
 * empty-text path, ensurePanelVisibleBeforeAutoSubmit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/provider-transport-diagnostics.js', () => ({
  probePanelContentScript: vi.fn(() => Promise.resolve({ status: 'pong' })),
}));
vi.mock('../aichatmerge-panel/modules/provider-content-recovery.js', () => ({
  recoverPanelContentScript: vi.fn(() => Promise.resolve({ success: false, reason: 'not-needed' })),
}));
vi.mock('../aichatmerge-panel/modules/panel-frame-config.js', () => ({
  getPanelProviderMode: vi.fn(() => null),
}));
vi.mock('../aichatmerge-panel/modules/panel-health.js', () => ({
  reloadPanelIframe: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/focus-manager.js', () => ({
  restoreUnifiedInputFocusAfterSend: vi.fn(() => 'focus-req-1'),
  getChatgptPanelsWithFrames: vi.fn(() => []),
  startFreshChatForPanel: vi.fn(),
  restoreUnifiedInputFocusAfterNewChat: vi.fn(),
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
}));
vi.mock('../aichatmerge-panel/modules/discussion-runner.js', () => ({
  stopDiscussion: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/discussion-gates.js', () => ({
  sleep: vi.fn(() => Promise.resolve()),
}));
vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  stopMergeMonitor: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: vi.fn(),
  getPanelDebugInfo: vi.fn(() => ({})),
  rotateDebugSession: vi.fn(() => 'session-test'),
}));
vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({
  t: vi.fn((key) => key),
}));
vi.mock('../aichatmerge-panel/modules/toast.js', () => ({
  showToast: vi.fn(),
}));

describe('send-pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <textarea id="unified-input"></textarea>
      <div id="panel-grid"></div>
      <button id="send-all-btn"></button>
      <span id="send-status"></span>
      <button id="new-chat-btn"></button>
    `;
  });

  describe('isMergePanel / getMergePanelIds / getNonMergePanels', () => {
    it('new panel IDs are not merge panels by default', async () => {
      const { isMergePanel, getMergePanelIds } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const panel = { id: 'panel-chatgpt-1' };
      expect(isMergePanel(panel)).toBe(false);
      expect(getMergePanelIds().size).toBe(0);
    });

    it('getNonMergePanels returns all panels when none are merge', async () => {
      const { getNonMergePanels } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { getPanels } = await import('../aichatmerge-panel/modules/state.js');
      getPanels.mockReturnValue([
        { id: 'panel-1' },
        { id: 'panel-2' },
      ]);
      const result = getNonMergePanels();
      expect(result).toHaveLength(2);
    });
  });

  describe('handlePanelInjectionResult', () => {
    it('resolves true only after successful injection and submission', async () => {
      const { handlePanelInjectionResult, handlePanelSubmitDispatchResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const resolve = vi.fn();

      // Simulate a pending injection by calling sendToPanel internals
      // We need to access the pending map via the module — instead, test via the export
      // The simplest way: inject a result with a valid requestId
      // Since we can't directly manipulate the Map, we test through the public API

      // Create a mock panel with iframe
      const panel = { id: 'p1', providerId: 'chatgpt', iframe: { contentWindow: {} } };
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { getPanelProviderMode } = await import('../aichatmerge-panel/modules/panel-frame-config.js');

      // sendToPanel creates a pending entry, then we respond via handlePanelInjectionResult
      // We need to capture the injectionRequestId from the postToPanelIframe call
      let capturedRequestId = null;
      postToPanelIframe.mockImplementation((p, msg) => {
        if (msg.type === 'INJECT_TEXT' && msg.injectionRequestId) {
          capturedRequestId = msg.injectionRequestId;
        }
      });

      // Start the send
      const sendPromise = (await import('../aichatmerge-panel/modules/send-pipeline.js')).sendToPanel(
        panel, 'hello', true, null, 0, null
      );

      // Wait a tick for the postToPanelIframe to be called
      await new Promise(r => setTimeout(r, 10));
      expect(capturedRequestId).toBeTruthy();

      // Now respond with success
      handlePanelInjectionResult({
        injectionRequestId: capturedRequestId,
        inputFound: true,
        injectSuccess: true,
        diagnostics: {
          matchedSelector: '#chat-textarea',
          expectedLength: 5,
          afterLength: 5,
        },
      });
      handlePanelSubmitDispatchResult({
        injectionRequestId: capturedRequestId,
        dispatched: true,
        diagnostics: { signals: ['composer-cleared'] },
      });

      const result = await sendPromise;
      expect(result).toBe(true);
      const { recordDebugLog } = await import('../aichatmerge-panel/modules/debug-log.js');
      expect(recordDebugLog).toHaveBeenCalledWith(
        'panel-injection:success',
        expect.objectContaining({
          diagnostics: expect.objectContaining({ matchedSelector: '#chat-textarea' }),
        })
      );
    });

    it('gives up for non-recoverable provider after failed injection', async () => {
      const { handlePanelInjectionResult, sendToPanel } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');

      const panel = { id: 'p2', providerId: 'chatgpt', iframe: { contentWindow: {} } };
      let capturedRequestId = null;
      postToPanelIframe.mockImplementation((p, msg) => {
        if (msg.type === 'INJECT_TEXT' && msg.injectionRequestId) {
          capturedRequestId = msg.injectionRequestId;
        }
      });

      const sendPromise = sendToPanel(panel, 'hello', true, null, 0, null);
      await new Promise(r => setTimeout(r, 10));

      // Respond with failure
      handlePanelInjectionResult({
        injectionRequestId: capturedRequestId,
        inputFound: false,
        injectSuccess: false,
      });

      const result = await sendPromise;
      expect(result).toBe(false);
    });

    it('does not turn a dispatched click into a send failure when confirmation is absent', async () => {
      const {
        handlePanelInjectionResult,
        handlePanelSubmitResult,
        sendToPanel,
      } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const panel = { id: 'p-submit-fail', providerId: 'claude', iframe: { contentWindow: {} } };
      let injectionRequestId = null;
      postToPanelIframe.mockImplementation((p, message) => {
        if (message.type === 'INJECT_TEXT') injectionRequestId = message.injectionRequestId;
      });

      const sendPromise = sendToPanel(panel, 'second round', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      handlePanelInjectionResult({
        injectionRequestId,
        inputFound: true,
        injectSuccess: true,
      });
      handlePanelSubmitResult({
        injectionRequestId,
        submitSuccess: false,
        error: 'submit-not-confirmed',
      });

      await expect(sendPromise).resolves.toBe(true);
      const { recordDebugLog } = await import('../aichatmerge-panel/modules/debug-log.js');
      expect(recordDebugLog).toHaveBeenCalledWith(
        'panel-submit:unconfirmed',
        expect.objectContaining({
          injectionRequestId,
          error: 'submit-not-confirmed',
        })
      );
    });

    it('does not reload Wenxin after failed input injection', async () => {
      const { handlePanelInjectionResult, sendToPanel } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { reloadPanelIframe } = await import('../aichatmerge-panel/modules/panel-health.js');
      const panel = { id: 'wenxin-1', providerId: 'wenxin', iframe: { contentWindow: {} } };
      let capturedRequestId = null;
      postToPanelIframe.mockImplementation((p, msg) => {
        if (msg.type === 'INJECT_TEXT') capturedRequestId = msg.injectionRequestId;
      });

      const sendPromise = sendToPanel(panel, 'hello', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      handlePanelInjectionResult({
        injectionRequestId: capturedRequestId,
        inputFound: false,
        injectSuccess: false,
      });

      await expect(sendPromise).resolves.toBe(false);
      expect(reloadPanelIframe).not.toHaveBeenCalled();
    });

    it('includes the content-script probe result when an injection times out', async () => {
      vi.useFakeTimers();
      try {
        const { sendToPanel } = await import('../aichatmerge-panel/modules/send-pipeline.js');
        const { probePanelContentScript } = await import('../aichatmerge-panel/modules/provider-transport-diagnostics.js');
        const { recordDebugLog } = await import('../aichatmerge-panel/modules/debug-log.js');
        const panel = { id: 'wenxin-timeout', providerId: 'wenxin', iframe: { contentWindow: {} } };
        probePanelContentScript.mockResolvedValueOnce({
          status: 'timeout',
          readySeen: false,
          targetOrigin: 'https://chat.baidu.com',
          expectedBuildId: '1.0.1-transport-1',
        });

        const sendPromise = sendToPanel(panel, 'hello', true);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(6000);

        await expect(sendPromise).resolves.toBe(false);
        expect(recordDebugLog).toHaveBeenCalledWith(
          'panel-injection:timeout',
          expect.objectContaining({
            transportProbe: expect.objectContaining({
              status: 'timeout',
              readySeen: false,
              targetOrigin: 'https://chat.baidu.com',
            })
          })
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('retries Wenxin injection without reloading after content-script recovery', async () => {
      const { sendToPanel, handlePanelInjectionResult, handlePanelSubmitResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { probePanelContentScript } = await import('../aichatmerge-panel/modules/provider-transport-diagnostics.js');
      const { recoverPanelContentScript } = await import('../aichatmerge-panel/modules/provider-content-recovery.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { reloadPanelIframe } = await import('../aichatmerge-panel/modules/panel-health.js');
      const panel = { id: 'wenxin-recover', providerId: 'wenxin', iframe: { contentWindow: {} } };
      probePanelContentScript.mockResolvedValueOnce({ status: 'timeout', readySeen: false });
      recoverPanelContentScript.mockResolvedValueOnce({ success: true, frameCount: 1 });
      let injectionCount = 0;
      let injectionRequestId;
      postToPanelIframe.mockImplementation((sentPanel, message) => {
        if (message.type !== 'INJECT_TEXT') return;
        injectionCount += 1;
        injectionRequestId = message.injectionRequestId;
        if (injectionCount === 2) {
          handlePanelInjectionResult({
            injectionRequestId,
            inputFound: true,
            injectSuccess: true,
          });
          handlePanelSubmitResult({
            injectionRequestId,
            submitSuccess: true,
          });
        }
      });

      await expect(sendToPanel(panel, 'hello', true)).resolves.toBe(true);
      expect(injectionCount).toBe(2);
      expect(recoverPanelContentScript).toHaveBeenCalledWith(panel);
      expect(reloadPanelIframe).not.toHaveBeenCalled();
    });

    it('does nothing for unknown requestId', async () => {
      const { handlePanelInjectionResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      // Should not throw
      expect(() => handlePanelInjectionResult({
        injectionRequestId: 'nonexistent-req-id',
        inputFound: true,
        injectSuccess: true,
      })).not.toThrow();
    });
  });

  describe('broadcastMessage', () => {
    it('triggers send buttons when text is empty and autoSubmit is true', async () => {
      const { broadcastMessage } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { getPanels } = await import('../aichatmerge-panel/modules/state.js');

      // Provide a non-merge panel with iframe via getPanels
      const panel = {
        id: 'p1', providerId: 'chatgpt',
        iframe: { contentWindow: {} },
      };
      getPanels.mockReturnValue([panel]);

      await broadcastMessage('', true);

      // Should have sent TRIGGER_SEND to the panel
      expect(postToPanelIframe).toHaveBeenCalledWith(
        panel,
        expect.objectContaining({ type: 'TRIGGER_SEND' })
      );
    });

    it('does nothing when text is empty and autoSubmit is false', async () => {
      const { broadcastMessage } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');

      await broadcastMessage('', false);
      expect(postToPanelIframe).not.toHaveBeenCalled();
    });

    it('keeps panels serial but advances immediately after each click acknowledgement', async () => {
      const {
        broadcastMessage,
        handlePanelInjectionResult,
        handlePanelSubmitDispatchResult,
      } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { getPanels } = await import('../aichatmerge-panel/modules/state.js');
      const panels = [
        { id: 'serial-1', providerId: 'doubao', iframe: { contentWindow: {} } },
        { id: 'serial-2', providerId: 'claude', iframe: { contentWindow: {} } },
      ];
      getPanels.mockReturnValue(panels);
      const requestIds = [];
      postToPanelIframe.mockImplementation((panel, message) => {
        if (message.type === 'INJECT_TEXT') {
          requestIds.push({ panelId: panel.id, requestId: message.injectionRequestId });
        }
      });

      const broadcastPromise = broadcastMessage('serial prompt', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(requestIds.map(item => item.panelId)).toEqual(['serial-1']);

      handlePanelInjectionResult({
        injectionRequestId: requestIds[0].requestId,
        inputFound: true,
        injectSuccess: true,
      });
      await Promise.resolve();
      expect(requestIds.map(item => item.panelId)).toEqual(['serial-1']);

      handlePanelSubmitDispatchResult({
        injectionRequestId: requestIds[0].requestId,
        dispatched: true,
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(requestIds.map(item => item.panelId)).toEqual(['serial-1', 'serial-2']);

      handlePanelInjectionResult({
        injectionRequestId: requestIds[1].requestId,
        inputFound: true,
        injectSuccess: true,
      });
      handlePanelSubmitDispatchResult({
        injectionRequestId: requestIds[1].requestId,
        dispatched: true,
      });

      await expect(broadcastPromise).resolves.toBeUndefined();
    });

    it('sends INJECT_TEXT to non-merge panels with non-empty text', async () => {
      const { broadcastMessage, handlePanelInjectionResult, handlePanelSubmitDispatchResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { getPanels } = await import('../aichatmerge-panel/modules/state.js');

      const panel = {
        id: 'p1', providerId: 'chatgpt',
        iframe: { contentWindow: {} },
      };
      getPanels.mockReturnValue([panel]);

      // Capture the injectionRequestId from the INJECT_TEXT message
      let capturedRequestId = null;
      postToPanelIframe.mockImplementation((p, msg) => {
        if (msg.type === 'INJECT_TEXT' && msg.injectionRequestId) {
          capturedRequestId = msg.injectionRequestId;
        }
      });

      // Start broadcast and respond to injection in parallel
      const broadcastPromise = broadcastMessage('Hello AI', true);

      // Wait for the injection request to be captured
      await new Promise(r => setTimeout(r, 10));
      expect(capturedRequestId).toBeTruthy();

      // Respond with success
      handlePanelInjectionResult({
        injectionRequestId: capturedRequestId,
        inputFound: true,
        injectSuccess: true,
      });
      handlePanelSubmitDispatchResult({
        injectionRequestId: capturedRequestId,
        dispatched: true,
      });

      await broadcastPromise;

      expect(postToPanelIframe).toHaveBeenCalledWith(
        panel,
        expect.objectContaining({
          type: 'INJECT_TEXT',
          text: 'Hello AI',
          autoSubmit: true,
        })
      );
    });

    it('clears the dispatched unified input before submit confirmation finishes', async () => {
      const { broadcastMessage, handlePanelInjectionResult, handlePanelSubmitDispatchResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { getPanels } = await import('../aichatmerge-panel/modules/state.js');

      const panel = {
        id: 'p1', providerId: 'chatgpt',
        iframe: { contentWindow: {} },
      };
      getPanels.mockReturnValue([panel]);

      const input = document.getElementById('unified-input');
      input.value = 'Hello AI';

      let capturedRequestId = null;
      postToPanelIframe.mockImplementation((p, msg) => {
        if (msg.type === 'INJECT_TEXT' && msg.injectionRequestId) {
          capturedRequestId = msg.injectionRequestId;
        }
      });

      const broadcastPromise = broadcastMessage('Hello AI', true);
      await new Promise(r => setTimeout(r, 10));
      expect(input.value).toBe('');
      const { recordDebugLog } = await import('../aichatmerge-panel/modules/debug-log.js');
      expect(recordDebugLog).toHaveBeenCalledWith(
        'broadcast:input-cleared',
        expect.objectContaining({
          stage: 'ui',
          code: 'INPUT_CLEARED',
          textLength: 8,
        })
      );
      const recordedEvents = recordDebugLog.mock.calls.map(([event]) => event);
      expect(recordedEvents.indexOf('broadcast:start')).toBeLessThan(
        recordedEvents.indexOf('broadcast:input-cleared')
      );

      handlePanelInjectionResult({
        injectionRequestId: capturedRequestId,
        inputFound: true,
        injectSuccess: true,
      });
      handlePanelSubmitDispatchResult({
        injectionRequestId: capturedRequestId,
        dispatched: true,
      });

      await broadcastPromise;
      expect(input.value).toBe('');
    });

    it('does not erase a newer draft when an earlier send finishes', async () => {
      const { broadcastMessage, handlePanelInjectionResult, handlePanelSubmitDispatchResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { getPanels } = await import('../aichatmerge-panel/modules/state.js');

      const panel = {
        id: 'p-new-draft', providerId: 'doubao',
        iframe: { contentWindow: {} },
      };
      getPanels.mockReturnValue([panel]);

      const input = document.getElementById('unified-input');
      input.value = 'DB-1';
      let capturedRequestId = null;
      postToPanelIframe.mockImplementation((p, msg) => {
        if (msg.type === 'INJECT_TEXT' && msg.injectionRequestId) {
          capturedRequestId = msg.injectionRequestId;
        }
      });

      const broadcastPromise = broadcastMessage('DB-1', true);
      await new Promise(r => setTimeout(r, 10));
      expect(input.value).toBe('');
      input.value = 'DB-2';

      handlePanelInjectionResult({
        injectionRequestId: capturedRequestId,
        inputFound: true,
        injectSuccess: true,
      });
      handlePanelSubmitDispatchResult({
        injectionRequestId: capturedRequestId,
        dispatched: true,
      });

      await broadcastPromise;
      expect(input.value).toBe('DB-2');
    });

    it('restores the submitted draft when every panel reports failure and no newer draft exists', async () => {
      const { broadcastMessage, handlePanelInjectionResult, handlePanelSubmitDispatchResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { getPanels } = await import('../aichatmerge-panel/modules/state.js');

      const panel = {
        id: 'p-restore', providerId: 'doubao',
        iframe: { contentWindow: {} },
      };
      getPanels.mockReturnValue([panel]);

      const input = document.getElementById('unified-input');
      input.value = 'retry me';
      let capturedRequestId = null;
      postToPanelIframe.mockImplementation((p, msg) => {
        if (msg.type === 'INJECT_TEXT' && msg.injectionRequestId) {
          capturedRequestId = msg.injectionRequestId;
        }
      });

      const broadcastPromise = broadcastMessage('retry me', true);
      await new Promise(r => setTimeout(r, 10));
      expect(input.value).toBe('');

      handlePanelInjectionResult({
        injectionRequestId: capturedRequestId,
        inputFound: true,
        injectSuccess: true,
      });
      handlePanelSubmitDispatchResult({
        injectionRequestId: capturedRequestId,
        dispatched: false,
        error: 'SEND_CONTROL_NOT_FOUND',
      });

      await broadcastPromise;
      expect(input.value).toBe('retry me');
    });

    it('does not overwrite a newer draft when the earlier send fails', async () => {
      const { broadcastMessage, handlePanelInjectionResult, handlePanelSubmitDispatchResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { postToPanelIframe } = await import('../aichatmerge-panel/modules/panel-postmessage.js');
      const { getPanels } = await import('../aichatmerge-panel/modules/state.js');

      const panel = {
        id: 'p-failed-new-draft', providerId: 'doubao',
        iframe: { contentWindow: {} },
      };
      getPanels.mockReturnValue([panel]);

      const input = document.getElementById('unified-input');
      input.value = 'DB-1';
      let capturedRequestId = null;
      postToPanelIframe.mockImplementation((p, msg) => {
        if (msg.type === 'INJECT_TEXT' && msg.injectionRequestId) {
          capturedRequestId = msg.injectionRequestId;
        }
      });

      const broadcastPromise = broadcastMessage('DB-1', true);
      await new Promise(r => setTimeout(r, 10));
      input.value = 'DB-2';

      handlePanelInjectionResult({
        injectionRequestId: capturedRequestId,
        inputFound: true,
        injectSuccess: true,
      });
      handlePanelSubmitDispatchResult({
        injectionRequestId: capturedRequestId,
        dispatched: false,
        error: 'SEND_CONTROL_NOT_FOUND',
      });

      await broadcastPromise;
      expect(input.value).toBe('DB-2');
    });
  });

  describe('ensurePanelVisibleBeforeAutoSubmit', () => {
    it('returns immediately when autoSubmit is false', async () => {
      const { ensurePanelVisibleBeforeAutoSubmit } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { setCurrentPanelPage } = await import('../aichatmerge-panel/modules/state.js');

      await ensurePanelVisibleBeforeAutoSubmit({ id: 'p1' }, false, 'send');
      expect(setCurrentPanelPage).not.toHaveBeenCalled();
    });

    it('returns immediately when panel is null', async () => {
      const { ensurePanelVisibleBeforeAutoSubmit } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { setCurrentPanelPage } = await import('../aichatmerge-panel/modules/state.js');

      await ensurePanelVisibleBeforeAutoSubmit(null, true, 'send');
      expect(setCurrentPanelPage).not.toHaveBeenCalled();
    });

    it('does not switch page when panel is already on current page', async () => {
      const { ensurePanelVisibleBeforeAutoSubmit } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { getPanels, getCurrentPanelPage, setCurrentPanelPage } = await import('../aichatmerge-panel/modules/state.js');

      const panel = { id: 'p1' };
      getPanels.mockReturnValue([panel]);
      getCurrentPanelPage.mockReturnValue(0);

      await ensurePanelVisibleBeforeAutoSubmit(panel, true, 'send');
      expect(setCurrentPanelPage).not.toHaveBeenCalled();
    });
  });

  describe('clearAllInputs', () => {
    it('clears unified input and shows toast', async () => {
      const { clearAllInputs } = await import('../aichatmerge-panel/modules/send-pipeline.js');
      const { showToast } = await import('../aichatmerge-panel/modules/toast.js');

      const input = document.getElementById('unified-input');
      input.value = 'some text';

      await clearAllInputs();

      expect(input.value).toBe('');
      expect(showToast).toHaveBeenCalled();
    });
  });
});
