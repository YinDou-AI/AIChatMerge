import { describe, expect, it } from 'vitest';

import { buildDebugVerdict, VERDICT_ROOT_CAUSES } from '../aichatmerge-panel/modules/debug-verdict.js';
import { buildDebugAiPayload } from '../aichatmerge-panel/modules/debug-log-utils.js';

function makeLog(event, details = {}, index = 0) {
  return {
    ts: `2026-07-20T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
    t: index * 100,
    sessionId: 'session-a',
    event,
    details
  };
}

const wenxinPanel = { panelId: 'panel-wenxin', providerId: 'wenxin', isMergePanel: false };

describe('debug-verdict rules', () => {
  it('maps transport timeouts with readySeen=false to provider-transport-timeout', () => {
    const logs = [
      makeLog('panel-send:start', { panel: wenxinPanel, injectionRequestId: 'inject-1' }, 0),
      makeLog('panel-injection:timeout', {
        panel: wenxinPanel,
        injectionRequestId: 'inject-1',
        transportProbe: {
          status: 'timeout',
          readySeen: false,
          targetOrigin: 'https://chat.baidu.com',
          expectedBuildId: '1.0.1-transport-1'
        }
      }, 1),
      makeLog('panel-injection:timeout', {
        panel: wenxinPanel,
        injectionRequestId: 'inject-1',
        transportProbe: { status: 'timeout', readySeen: false, targetOrigin: 'https://chat.baidu.com' }
      }, 2),
      makeLog('panel-injection:give-up', { panel: wenxinPanel, recoveryAttempt: 1 }, 3)
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('failed');
    expect(verdict.failedStage).toBe('transport');
    expect(verdict.rootCause).toBe('provider-transport-timeout');
    expect(verdict.suggestedChecks.length).toBeGreaterThan(0);
    expect(verdict.evidence.some(entry => entry.includes('readySeen=false'))).toBe(true);
    // 重复的相同证据合并为一条 ×N
    expect(verdict.evidence.length).toBeLessThanOrEqual(2);
  });

  it('maps submit-failed to send-control-not-found with send control evidence', () => {
    const logs = [
      makeLog('panel-injection:success', { panel: wenxinPanel }, 0),
      makeLog('text-injection:submit-failed', {
        provider: 'wenxin',
        reason: 'send-control-not-found',
        sendControl: { elementId: 'ci-submit-button-ai', visible: true, active: false }
      }, 1)
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('failed');
    expect(verdict.failedStage).toBe('submit');
    expect(verdict.rootCause).toBe('send-control-not-found');
    expect(verdict.code).toBe('SEND_CONTROL_NOT_FOUND');
  });

  it('maps a missing submit result to transport instead of the provider submit stage', () => {
    const logs = [
      makeLog('panel-send:start', {
        panel: wenxinPanel,
        injectionRequestId: 'inject-timeout',
        autoSubmit: true
      }, 0),
      makeLog('panel-injection:success', {
        panel: wenxinPanel,
        injectionRequestId: 'inject-timeout'
      }, 1),
      makeLog('text-injection:submit-confirmed', {
        provider: 'wenxin',
        injectionRequestId: 'inject-timeout'
      }, 2),
      makeLog('panel-submit:timeout', {
        panel: wenxinPanel,
        injectionRequestId: 'inject-timeout',
        stage: 'transport',
        code: 'SUBMIT_RESULT_TIMEOUT'
      }, 3)
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('failed');
    expect(verdict.stage).toBe('transport');
    expect(verdict.failedStage).toBe('transport');
    expect(verdict.code).toBe('SUBMIT_RESULT_TIMEOUT');
    expect(verdict.rootCause).toBe('submit-result-timeout');
  });

  it('maps composer-verification-failed to the inject stage', () => {
    const logs = [
      makeLog('text-injection:composer-verification-failed', {
        provider: 'wenxin',
        matchedSelector: '#chat-textarea',
        expectedLength: 12,
        afterLength: 0
      })
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('failed');
    expect(verdict.failedStage).toBe('inject');
    expect(verdict.rootCause).toBe('composer-verification-failed');
  });

  it('maps explicit injection failures to injection-rejected', () => {
    const logs = [
      makeLog('panel-injection:failed', { panel: wenxinPanel, inputFound: false, injectSuccess: false })
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('failed');
    expect(verdict.failedStage).toBe('inject');
    expect(verdict.rootCause).toBe('injection-rejected');
  });

  it('maps merge-monitor timeouts to answer-timeout', () => {
    const logs = [
      makeLog('panel-injection:success', { panel: wenxinPanel }, 0),
      makeLog('merge-monitor:timeout', { completedCount: 1, totalCount: 2, missingProviders: ['kimi'] }, 1)
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('failed');
    expect(verdict.failedStage).toBe('answer');
    expect(verdict.rootCause).toBe('answer-timeout');
  });

  it('prefers the completion watchdog snapshot over a plain merge timeout', () => {
    const grokPanel = { panelId: 'panel-grok', providerId: 'grok', isMergePanel: false };
    const logs = [
      makeLog('panel-injection:success', { panel: grokPanel }, 0),
      makeLog('completion-monitor:watchdog-timeout', {
        panel: grokPanel,
        sourceId: 'grok',
        phase: 'button-watch-appear',
        sawStopButton: false,
        composerTextLen: 0,
        stopSelectors: [{ selector: 'button[aria-label*="Stop"]', count: 0, visible: 0, textLen: 0 }],
        answerSelectors: [{ selector: '.response-content-markdown', count: 1, visible: 1, textLen: 800 }]
      }, 1),
      makeLog('merge-monitor:timeout', { completedCount: 11, totalCount: 12, missingPanels: [grokPanel] }, 2)
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('failed');
    expect(verdict.failedStage).toBe('answer');
    expect(verdict.rootCause).toBe('completion-not-detected');
    expect(verdict.evidence.some(entry => entry.includes('phase=button-watch-appear'))).toBe(true);
    expect(verdict.evidence.some(entry => entry.includes('sawStopButton=false'))).toBe(true);
    expect(verdict.suggestedChecks.length).toBeGreaterThan(0);
  });

  it('keeps answer-timeout when no watchdog snapshot exists', () => {
    const logs = [
      makeLog('completion-monitor:appear-timeout', { provider: 'grok', phase: 'button-watch-appear' }, 0),
      makeLog('merge-monitor:timeout', { completedCount: 1, totalCount: 2 }, 1)
    ];

    const verdict = buildDebugVerdict(logs);

    // appear-timeout 之后 mutation 兜底仍可能成功，仅凭它不能判 completion 卡死
    expect(verdict.rootCause).toBe('answer-timeout');
  });

  it('does not fail the verdict on a watchdog for an already-completed panel', () => {
    // 看门狗误报（SSE/STOP 清看门狗回归）不能把全绿的轮次判负，
    // 但必须在 regressions 里以 fail 标出
    const grokPanel = { panelId: 'panel-grok', providerId: 'grok', isMergePanel: false };
    const logs = [
      makeLog('broadcast:start', { autoSubmit: true }, 0),
      makeLog('merge-monitor:panel-complete', { panel: grokPanel }, 1),
      makeLog('completion-monitor:watchdog-timeout', {
        panel: grokPanel,
        sourceId: 'grok',
        phase: null,
        lastAnswerChangeAgoMs: 8000
      }, 2)
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('ok');
    const regression = verdict.regressions.find(item => item.id === 'watchdog-false-positive');
    expect(regression?.status).toBe('fail');
  });

  it('marks session isolation fail when events predate this run broadcast:start', () => {
    const logs = [
      makeLog('merge-monitor:panel-complete', { panel: wenxinPanel }, 0),
      makeLog('broadcast:start', { autoSubmit: true }, 1),
      makeLog('panel-injection:success', { panel: wenxinPanel }, 2)
    ];

    const verdict = buildDebugVerdict(logs);

    const regression = verdict.regressions.find(item => item.id === 'session-isolation');
    expect(regression?.status).toBe('fail');
  });

  it('passes all regressions on a clean run', () => {
    const logs = [
      makeLog('broadcast:start', { autoSubmit: true }, 0),
      makeLog('panel-send:start', { panel: wenxinPanel }, 1),
      makeLog('panel-injection:success', { panel: wenxinPanel }, 2),
      makeLog('merge-monitor:panel-complete', { panel: wenxinPanel }, 3)
    ];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('ok');
    expect(verdict.regressions.length).toBeGreaterThan(0);
    expect(verdict.regressions.every(item => item.status === 'pass')).toBe(true);
  });

  it('flags unknown failure events as unclassified instead of guessing', () => {
    const logs = [makeLog('some-brand-new:error', { reason: 'mystery' })];

    const verdict = buildDebugVerdict(logs);

    expect(verdict.status).toBe('failed');
    expect(verdict.rootCause).toBe('unclassified-failure');
    expect(verdict.failedStage).toBeNull();
  });

  it('reports ok when send-success intent is met', () => {
    const logs = [
      makeLog('panel-send:start', { panel: wenxinPanel }, 0),
      makeLog('panel-injection:success', { panel: wenxinPanel }, 1),
      makeLog('panel-submit:success', { panel: wenxinPanel }, 2)
    ];

    const verdict = buildDebugVerdict(logs, { expect: 'send-success', prompt: 'test' });

    expect(verdict.status).toBe('ok');
    expect(verdict.intentChecked).toBe(true);
    expect(verdict.intentExpectationMet).toBe(true);
  });

  it('does not treat injection-only as send success', () => {
    const logs = [
      makeLog('panel-send:start', { panel: wenxinPanel }, 0),
      makeLog('panel-injection:success', { panel: wenxinPanel }, 1)
    ];

    const verdict = buildDebugVerdict(logs, { expect: 'send-success' });

    expect(verdict.status).toBe('failed');
    expect(verdict.rootCause).toBe('send-incomplete');
  });

  it('fails send-success intent when no send activity exists', () => {
    const verdict = buildDebugVerdict([], { expect: 'send-success' });

    expect(verdict.status).toBe('failed');
    expect(verdict.rootCause).toBe('no-send-activity');
    expect(verdict.intentExpectationMet).toBe(false);
  });

  it('fails send-success intent when a send started but never produced a result', () => {
    const logs = [makeLog('panel-send:start', { panel: wenxinPanel })];

    const verdict = buildDebugVerdict(logs, { expect: 'send-success' });

    expect(verdict.status).toBe('failed');
    expect(verdict.rootCause).toBe('send-incomplete');
  });

  it('reports pending without intent when a correlated send has no terminal event', () => {
    const logs = [makeLog('panel-send:start', {
      panel: wenxinPanel,
      injectionRequestId: 'inject-pending',
      autoSubmit: true
    })];

    const verdict = buildDebugVerdict(logs, null, null, Date.parse('2026-07-20T00:00:05.000Z'));

    expect(verdict.status).toBe('pending');
    expect(verdict.stage).toBe('inject');
    expect(verdict.code).toBe('INJECTION_RESULT_PENDING');
    expect(verdict.evidence[0]).toEqual(expect.objectContaining({
      requestId: 'inject-pending',
      provider: 'wenxin',
      elapsedMs: 5000
    }));
    expect(verdict.intentChecked).toBe(false);
  });

  it('reports transport pending after provider confirmation but before the panel result', () => {
    const logs = [
      makeLog('panel-send:start', {
        panel: wenxinPanel,
        injectionRequestId: 'inject-transport-pending',
        autoSubmit: true
      }, 0),
      makeLog('panel-injection:success', {
        panel: wenxinPanel,
        injectionRequestId: 'inject-transport-pending'
      }, 1),
      makeLog('text-injection:submit-confirmed', {
        provider: 'wenxin',
        injectionRequestId: 'inject-transport-pending'
      }, 2)
    ];

    const verdict = buildDebugVerdict(logs, { expect: 'send-success' }, null, Date.parse('2026-07-20T00:00:05.000Z'));

    expect(verdict.status).toBe('pending');
    expect(verdict.stage).toBe('transport');
    expect(verdict.code).toBe('SUBMIT_RESULT_PENDING');
    expect(verdict.intentExpectationMet).toBeNull();
  });

  it('ignores failures from other sessions when a sessionId is given', () => {
    const logs = [
      // 历史会话的旧故障（日志存储滚动保留，含昨天的失败）
      { ...makeLog('panel-injection:timeout', {
        panel: wenxinPanel,
        transportProbe: { status: 'timeout', readySeen: false }
      }, 0), sessionId: 'session-old' },
      // 本次会话完成注入并确认提交
      makeLog('panel-injection:success', { panel: wenxinPanel }, 1),
      makeLog('panel-submit:success', { panel: wenxinPanel }, 2)
    ];

    const verdict = buildDebugVerdict(logs, { expect: 'send-success' }, 'session-a');

    expect(verdict.status).toBe('ok');
    expect(verdict.intentExpectationMet).toBe(true);
  });

  it('every rootCause emitted by rules exists in the legend', () => {
    // 规则与枚举不一致会让判定脚本拿到无法解释的 rootCause
    expect(Object.keys(VERDICT_ROOT_CAUSES)).toEqual(expect.arrayContaining([
      'provider-transport-timeout',
      'injection-rejected',
      'composer-verification-failed',
      'send-control-not-found',
      'submit-result-timeout',
      'answer-timeout',
      'completion-not-detected',
      'no-send-activity',
      'send-incomplete',
      'unclassified-failure'
    ]));
  });
});

describe('debug payload verdict integration', () => {
  it('embeds verdict and intent in the exported payload', () => {
    const logs = [
      makeLog('panel-injection:timeout', {
        panel: wenxinPanel,
        transportProbe: { status: 'timeout', readySeen: false }
      })
    ];
    const intent = { expect: 'send-success', prompt: 'ping' };

    const payload = buildDebugAiPayload(logs, 'session-a', intent);

    expect(payload.intent).toEqual(intent);
    expect(payload.verdict.status).toBe('failed');
    expect(payload.verdict.rootCause).toBe('provider-transport-timeout');
  });
});
