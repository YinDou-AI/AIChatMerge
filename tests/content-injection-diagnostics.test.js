import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isTrustedExtensionParent,
  postInjectionDiagnostic,
  postInjectionResult,
} from '../content-scripts/src/providers/messaging.js';
import {
  handleProviderTransportPing,
  postProviderTransportReady,
} from '../content-scripts/src/providers/transport-diagnostics.js';
import {
  PROVIDER_TRANSPORT_BUILD_ID,
  PROVIDER_TRANSPORT_PROTOCOL_VERSION,
} from '../modules/diagnostic-config.js';

describe('content injection diagnostics transport', () => {
  let parentWindow;

  beforeEach(() => {
    parentWindow = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => parentWindow,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => window,
    });
  });

  it('returns composer diagnostics without requiring prompt content', () => {
    const diagnostics = {
      matchedSelector: '#chat-textarea',
      expectedLength: 12,
      afterLength: 12,
      visible: true,
    };

    postInjectionResult('inject-1', 'wenxin', true, true, null, diagnostics);

    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INJECT_TEXT_RESULT',
        provider: 'wenxin',
        diagnostics,
      }),
      'chrome-extension://test-extension'
    );
  });

  it('returns only the final submit failure state to the existing panel log pipeline', () => {
    postInjectionDiagnostic('submit-failed', 'inject-1', 'wenxin', {
      attempts: 4,
      clicked: false,
      sendControl: { active: false },
    });

    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INJECTION_DIAGNOSTIC',
        event: 'submit-failed',
        injectionRequestId: 'inject-1',
        provider: 'wenxin',
      }),
      'chrome-extension://test-extension'
    );
  });

  it('reports compact READY and PONG transport metadata', () => {
    postProviderTransportReady('wenxin');
    handleProviderTransportPing({
      type: 'CONTENT_SCRIPT_PING',
      context: 'multi-panel-content-script',
      requestId: 'ping-1',
    }, 'wenxin');

    expect(parentWindow.postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'CONTENT_SCRIPT_READY',
        provider: 'wenxin',
        protocolVersion: PROVIDER_TRANSPORT_PROTOCOL_VERSION,
        buildId: PROVIDER_TRANSPORT_BUILD_ID,
      }),
      'chrome-extension://test-extension'
    );
    expect(parentWindow.postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'CONTENT_SCRIPT_PONG',
        requestId: 'ping-1',
        provider: 'wenxin',
      }),
      'chrome-extension://test-extension'
    );
  });

  it('trusts the actual extension message source even when window.parent identity differs', () => {
    const actualExtensionSource = { postMessage: vi.fn() };

    expect(isTrustedExtensionParent({
      origin: 'chrome-extension://test-extension',
      source: actualExtensionSource,
    })).toBe(true);

    postInjectionResult('inject-2', 'wenxin', true, true, null, {
      matchedSelector: '#chat-textarea',
    });

    expect(actualExtensionSource.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INJECT_TEXT_RESULT',
        injectionRequestId: 'inject-2',
      }),
      'chrome-extension://test-extension'
    );
    expect(parentWindow.postMessage).not.toHaveBeenCalled();
  });
});
