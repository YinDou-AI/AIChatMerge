import { describe, expect, it } from 'vitest';

import {
  derivePendingSendRequests
} from '../aichatmerge-panel/modules/send-lifecycle.js';

function log(event, details, second) {
  return {
    event,
    details,
    ts: `2026-07-29T00:00:${String(second).padStart(2, '0')}.000Z`
  };
}

const panel = { panelId: 'panel-doubao', providerId: 'doubao', isMergePanel: false };

describe('send lifecycle derivation', () => {
  it('derives one compact pending request from existing events', () => {
    const logs = [
      log('panel-send:start', {
        panel,
        autoSubmit: true,
        injectionRequestId: 'inject-1'
      }, 0),
      log('panel-injection:success', {
        panel,
        injectionRequestId: 'inject-1'
      }, 1)
    ];

    expect(derivePendingSendRequests(logs, Date.parse('2026-07-29T00:00:05.000Z'))).toEqual([
      {
        requestId: 'inject-1',
        provider: 'doubao',
        stage: 'submit',
        code: 'SUBMIT_RESULT_PENDING',
        elapsedMs: 5000
      }
    ]);
  });

  it('advances to transport after provider confirmation', () => {
    const logs = [
      log('panel-send:start', {
        panel,
        autoSubmit: true,
        injectionRequestId: 'inject-2'
      }, 0),
      log('panel-injection:success', {
        panel,
        injectionRequestId: 'inject-2'
      }, 1),
      log('text-injection:submit-confirmed', {
        provider: 'doubao',
        injectionRequestId: 'inject-2'
      }, 2)
    ];

    expect(derivePendingSendRequests(logs)[0]).toEqual(expect.objectContaining({
      requestId: 'inject-2',
      stage: 'transport',
      code: 'SUBMIT_RESULT_PENDING'
    }));
  });

  it.each([
    'panel-submit:success',
    'panel-submit:failed',
    'panel-submit:timeout'
  ])('removes the request after terminal event %s', terminalEvent => {
    const logs = [
      log('panel-send:start', {
        panel,
        autoSubmit: true,
        injectionRequestId: 'inject-3'
      }, 0),
      log(terminalEvent, {
        panel,
        injectionRequestId: 'inject-3'
      }, 1)
    ];

    expect(derivePendingSendRequests(logs)).toEqual([]);
  });

  it('treats injection success as terminal when autoSubmit is disabled', () => {
    const logs = [
      log('panel-send:start', {
        panel,
        autoSubmit: false,
        injectionRequestId: 'inject-4'
      }, 0),
      log('panel-injection:success', {
        panel,
        injectionRequestId: 'inject-4'
      }, 1)
    ];

    expect(derivePendingSendRequests(logs)).toEqual([]);
  });
});
