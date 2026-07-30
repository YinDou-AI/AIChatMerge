import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/diagnostic-config.js', () => ({
  ENABLE_CONTENT_SCRIPT_DIAGNOSTICS: false,
  ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS: false,
  PROVIDER_TRANSPORT_PROTOCOL_VERSION: 1,
  PROVIDER_TRANSPORT_BUILD_ID: 'formal-build'
}));

import {
  postCompletionDiagnostic,
  postInjectionDiagnostic,
  postInjectionResult,
  postSubmitDispatchResult,
  postSubmitResult
} from '../content-scripts/src/providers/messaging.js';

describe('formal content-script diagnostics', () => {
  let parentWindow;

  beforeEach(() => {
    parentWindow = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => parentWindow
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => window
    });
  });

  it('keeps business result messages but removes diagnostic payloads and events', () => {
    postInjectionResult('inject-1', 'doubao', true, true, null, {
      matchedSelector: '#private-composer'
    });
    postSubmitResult('inject-1', 'doubao', true, null, {
      signals: ['composer-cleared']
    });
    postSubmitDispatchResult('inject-1', 'doubao', true);
    postInjectionDiagnostic('submit-confirmed', 'inject-1', 'doubao', {
      composerText: 'private prompt'
    });
    postCompletionDiagnostic('watchdog-timeout', 'doubao', {
      answerText: 'private answer'
    });

    expect(parentWindow.postMessage).toHaveBeenCalledTimes(3);
    expect(parentWindow.postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'INJECT_TEXT_RESULT',
        injectionRequestId: 'inject-1',
        diagnostics: null
      }),
      'chrome-extension://test-extension'
    );
    expect(parentWindow.postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'SUBMIT_TEXT_RESULT',
        injectionRequestId: 'inject-1',
        diagnostics: null
      }),
      'chrome-extension://test-extension'
    );
    expect(parentWindow.postMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: 'SUBMIT_TEXT_DISPATCH_RESULT',
        injectionRequestId: 'inject-1',
        dispatched: true
      }),
      'chrome-extension://test-extension'
    );
  });
});
