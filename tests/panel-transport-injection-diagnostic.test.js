import { describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => {
  const source = {};
  return {
    source,
    panel: {
      id: 'wenxin-1',
      providerId: 'wenxin',
      iframe: { contentWindow: source, src: 'https://chat.baidu.com/' },
    },
    recordDebugLog: vi.fn(),
  };
});

vi.mock('../aichatmerge-panel/modules/state.js', () => ({
  getPanels: () => [fixtures.panel],
  getCurrentGoogleProviderMode: () => 'ai',
  setClaudeEntryUrl: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/focus-manager.js', () => ({
  cancelUnifiedInputFocusRestoreAfterSend: vi.fn(),
  handleSendFocusProviderBusy: vi.fn(),
  handleSendFocusProviderIdle: vi.fn(),
  activeSendFocusRequestIdGetter: () => null,
}));
vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  handleMergeCompletionDetected: vi.fn(),
  stopMergeMonitor: vi.fn(),
  setMergeMaxWait: vi.fn(),
  setAutoMergeEnabled: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/answer-extractor.js', () => ({ handleExtractedAnswer: vi.fn() }));
vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({
  setCurrentLocale: vi.fn(), applyI18n: vi.fn(), detectLocale: () => 'en',
}));
vi.mock('../aichatmerge-panel/modules/send-pipeline.js', () => ({
  handlePanelInjectionResult: vi.fn(),
  handlePanelSubmitDispatchResult: vi.fn(),
  handlePanelSubmitResult: vi.fn(),
  getMergePanelIds: () => new Set(),
}));
vi.mock('../aichatmerge-panel/modules/panel-health.js', () => ({ handlePanelHealthCheckResult: vi.fn() }));
vi.mock('../aichatmerge-panel/modules/panel-header-actions.js', () => ({
  showClaudeEntryWarning: vi.fn(), updateGoogleProviderMode: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-frame-config.js', () => ({ isChatgptProvider: () => false }));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: fixtures.recordDebugLog,
  getPanelDebugInfo: panel => ({ panelId: panel.id, providerId: panel.providerId, isMergePanel: false }),
}));
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  getIframeTargetOrigin: vi.fn(),
  postToPanelIframe: vi.fn(),
}));
vi.mock('../modules/google-mode.js', () => ({ normalizeGoogleProviderMode: value => value }));
vi.mock('../modules/claude-entry-url.js', () => ({
  CLAUDE_CUSTOM_ENTRY_URL_KEY: 'claudeCustomEntryUrl', getClaudeCustomEntryUrl: vi.fn(),
}));
vi.mock('../modules/theme-manager.js', () => ({ applyTheme: vi.fn() }));

import { handleProviderStatusMessage } from '../aichatmerge-panel/modules/panel-transport.js';

describe('panel transport injection diagnostics', () => {
  it('records trusted content-script diagnostics in the downloadable debug log', () => {
    handleProviderStatusMessage({
      source: fixtures.source,
      origin: 'https://chat.baidu.com',
      data: {
        type: 'INJECTION_DIAGNOSTIC',
        context: 'multi-panel-injection-diagnostic',
        event: 'submit-failed',
        provider: 'wenxin',
        injectionRequestId: 'inject-1',
        details: { attempts: 4, reason: 'button-not-ready' },
      },
    });

    expect(fixtures.recordDebugLog).toHaveBeenCalledWith(
      'text-injection:submit-failed',
      expect.objectContaining({
        targetId: 'wenxin-1',
        sourceId: 'wenxin',
        panel: expect.objectContaining({ providerId: 'wenxin' }),
        injectionRequestId: 'inject-1',
        attempts: 4,
        reason: 'button-not-ready',
      })
    );
  });

  it('records compact content-script READY metadata for the matching panel', async () => {
    handleProviderStatusMessage({
      source: fixtures.source,
      origin: 'https://chat.baidu.com',
      data: {
        type: 'CONTENT_SCRIPT_READY',
        context: 'multi-panel-content-script',
        provider: 'wenxin',
        protocolVersion: 1,
        buildId: '1.0.1-transport-1',
        pageOrigin: 'https://chat.baidu.com',
      },
    });

    expect(fixtures.recordDebugLog).toHaveBeenCalledWith(
      'provider-transport:ready',
      expect.objectContaining({
        targetId: 'wenxin-1',
        sourceId: 'wenxin',
        transport: expect.objectContaining({ status: 'ready' }),
      })
    );
  });

  it('routes the final submission result separately from injection', async () => {
    const { handlePanelSubmitResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
    handleProviderStatusMessage({
      source: fixtures.source,
      origin: 'https://chat.baidu.com',
      data: {
        type: 'SUBMIT_TEXT_RESULT',
        context: 'multi-panel-submission',
        provider: 'wenxin',
        injectionRequestId: 'inject-2',
        submitSuccess: true,
      },
    });

    expect(handlePanelSubmitResult).toHaveBeenCalledWith(expect.objectContaining({
      injectionRequestId: 'inject-2',
      submitSuccess: true,
    }));
  });

  it('routes the click acknowledgement separately from confirmation', async () => {
    const { handlePanelSubmitDispatchResult } = await import('../aichatmerge-panel/modules/send-pipeline.js');
    handleProviderStatusMessage({
      source: fixtures.source,
      origin: 'https://chat.baidu.com',
      data: {
        type: 'SUBMIT_TEXT_DISPATCH_RESULT',
        context: 'multi-panel-submission-dispatch',
        provider: 'wenxin',
        injectionRequestId: 'inject-dispatch',
        dispatched: true,
      },
    });

    expect(handlePanelSubmitDispatchResult).toHaveBeenCalledWith(expect.objectContaining({
      injectionRequestId: 'inject-dispatch',
      dispatched: true,
    }));
  });
});
