import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  panelPostMessage: vi.fn(),
  contentPostMessage: vi.fn(),
  recordDebugLog: vi.fn(),
}));

vi.mock('../modules/diagnostic-config.js', () => ({
  ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS: false,
  PROVIDER_TRANSPORT_PROTOCOL_VERSION: 1,
  PROVIDER_TRANSPORT_BUILD_ID: 'formal-build',
}));
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  getIframeTargetOrigin: vi.fn(() => 'https://chat.baidu.com'),
  postToPanelIframe: mocks.panelPostMessage,
}));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: mocks.recordDebugLog,
  getPanelDebugInfo: vi.fn(() => ({})),
}));
vi.mock('../content-scripts/src/providers/messaging.js', () => ({
  postToExtensionParent: mocks.contentPostMessage,
}));
vi.mock('../content-scripts/src/providers/detection.js', () => ({
  detectProvider: vi.fn(() => 'wenxin'),
}));

import { probePanelContentScript } from '../aichatmerge-panel/modules/provider-transport-diagnostics.js';
import {
  handleProviderTransportPing,
  postProviderTransportReady
} from '../content-scripts/src/providers/transport-diagnostics.js';

describe('formal build provider transport diagnostics switch', () => {
  it('disables both panel probes and content-script READY/PONG from one switch', async () => {
    const panel = {
      id: 'wenxin-formal',
      providerId: 'wenxin',
      iframe: { contentWindow: {} }
    };

    await expect(probePanelContentScript(panel)).resolves.toEqual({ status: 'disabled' });
    postProviderTransportReady('wenxin');
    expect(handleProviderTransportPing({
      type: 'CONTENT_SCRIPT_PING',
      context: 'multi-panel-content-script',
      requestId: 'ping-formal'
    }, 'wenxin')).toBe(false);

    expect(mocks.panelPostMessage).not.toHaveBeenCalled();
    expect(mocks.contentPostMessage).not.toHaveBeenCalled();
    expect(mocks.recordDebugLog).not.toHaveBeenCalled();
  });
});
