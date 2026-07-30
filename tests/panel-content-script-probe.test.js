import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordDebugLog = vi.hoisted(() => vi.fn());
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog,
  getPanelDebugInfo: panel => ({ panelId: panel.id, providerId: panel.providerId, isMergePanel: false })
}));

import {
  handleProviderTransportDiagnosticMessage,
  probePanelContentScript
} from '../aichatmerge-panel/modules/provider-transport-diagnostics.js';
import {
  PROVIDER_TRANSPORT_BUILD_ID,
  PROVIDER_TRANSPORT_PROTOCOL_VERSION
} from '../modules/diagnostic-config.js';

function createPanel(id) {
  return {
    id,
    providerId: 'wenxin',
    iframe: {
      src: 'https://chat.baidu.com/',
      isConnected: true,
      contentWindow: { postMessage: vi.fn() }
    }
  };
}

function createRuntimeMessage(type, overrides = {}) {
  return {
    type,
    context: 'multi-panel-content-script',
    provider: 'wenxin',
    protocolVersion: PROVIDER_TRANSPORT_PROTOCOL_VERSION,
    buildId: PROVIDER_TRANSPORT_BUILD_ID,
    pageOrigin: 'https://chat.baidu.com',
    documentReadyState: 'complete',
    hasRealParent: true,
    ...overrides,
  };
}

describe('provider content-script transport diagnostics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    recordDebugLog.mockClear();
  });

  it('records READY metadata under one removable log prefix', () => {
    const panel = createPanel('wenxin-ready');

    expect(handleProviderTransportDiagnosticMessage(
      panel,
      createRuntimeMessage('CONTENT_SCRIPT_READY')
    )).toBe(true);

    expect(recordDebugLog).toHaveBeenCalledWith(
      'provider-transport:ready',
      expect.objectContaining({
        targetId: 'wenxin-ready',
        transport: expect.objectContaining({
          status: 'ready',
          readySeen: true,
          targetOrigin: 'https://chat.baidu.com',
        })
      })
    );
  });

  it('resolves a matching PONG with protocol and build diagnostics', async () => {
    const panel = createPanel('wenxin-pong');
    const probePromise = probePanelContentScript(panel, 1200);
    const ping = panel.iframe.contentWindow.postMessage.mock.calls[0][0];

    expect(ping).toEqual(expect.objectContaining({
      type: 'CONTENT_SCRIPT_PING',
      protocolVersion: PROVIDER_TRANSPORT_PROTOCOL_VERSION,
      buildId: PROVIDER_TRANSPORT_BUILD_ID,
    }));

    handleProviderTransportDiagnosticMessage(
      panel,
      createRuntimeMessage('CONTENT_SCRIPT_PONG', { requestId: ping.requestId })
    );

    await expect(probePromise).resolves.toEqual(expect.objectContaining({
      status: 'pong',
      readySeen: true,
      pong: expect.objectContaining({ buildId: PROVIDER_TRANSPORT_BUILD_ID })
    }));
  });

  it('reports a compact timeout when the content script never responds', async () => {
    const panel = createPanel('wenxin-timeout');
    const probePromise = probePanelContentScript(panel, 1200);

    await vi.advanceTimersByTimeAsync(1200);

    await expect(probePromise).resolves.toEqual(expect.objectContaining({
      status: 'timeout',
      readySeen: false,
      iframeConnected: true,
      targetOrigin: 'https://chat.baidu.com',
      expectedProtocolVersion: PROVIDER_TRANSPORT_PROTOCOL_VERSION,
      expectedBuildId: PROVIDER_TRANSPORT_BUILD_ID,
    }));
  });
});
