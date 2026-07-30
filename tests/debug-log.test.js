import { describe, it, expect } from 'vitest';

import {
  isDebugKeyEvent,
  isDebugIssueEvent,
  buildDebugAiPayload,
  compactDebugValue,
  summarizeDebugSessions,
} from '../aichatmerge-panel/modules/debug-log.js';

describe('debug log event recognition', () => {
  it('treats discussion final answer events as key events', () => {
    expect(isDebugKeyEvent('discussion-final-answer:resolved')).toBe(true);
  });

  it('treats initial merge export events as key events', () => {
    expect(isDebugKeyEvent('discussion-initial-merge:auto-success')).toBe(true);
  });

  it('treats final merge wait events as key events', () => {
    expect(isDebugKeyEvent('discussion-wait:final-merge:complete')).toBe(true);
  });

  it('treats discussion-wait:final-merge as key event', () => {
    expect(isDebugKeyEvent('discussion-wait:final-merge')).toBe(true);
  });

  it('treats discussion-wait:final-merge:timeout-fallback as key event', () => {
    expect(isDebugKeyEvent('discussion-wait:final-merge:timeout-fallback')).toBe(true);
  });

  it('treats merge trigger-start as key event', () => {
    expect(isDebugKeyEvent('merge:trigger-start')).toBe(true);
  });

  it('treats merge answers-extracted as key event', () => {
    expect(isDebugKeyEvent('merge:answers-extracted')).toBe(true);
  });

  it('treats merge prompt-built as key event', () => {
    expect(isDebugKeyEvent('merge:prompt-built')).toBe(true);
  });

  it('treats merge auto-export as key event', () => {
    expect(isDebugKeyEvent('merge:auto-export-scheduled')).toBe(true);
  });

  it('treats merge aborted as key event', () => {
    expect(isDebugKeyEvent('merge:aborted-no-valid-answers')).toBe(true);
  });

  it('treats stale merge output guards as key events', () => {
    expect(isDebugKeyEvent('merge:skip-stale-new-panel-load')).toBe(true);
    expect(isDebugKeyEvent('merge:skip-stale-new-panel-inject')).toBe(true);
  });

  it('treats merge-monitor start as key event', () => {
    expect(isDebugKeyEvent('merge-monitor:start')).toBe(true);
  });

  it('treats merge-monitor timeout as key event', () => {
    expect(isDebugKeyEvent('merge-monitor:timeout')).toBe(true);
  });

  it('treats merge-monitor all-complete as key event', () => {
    expect(isDebugKeyEvent('merge-monitor:all-complete-auto-merge')).toBe(true);
  });

  it('treats merge trigger load failures as key events', () => {
    expect(isDebugKeyEvent('merge-monitor:trigger-load-failed')).toBe(true);
  });

  it('treats completion session diagnostics as key events', () => {
    expect(isDebugKeyEvent('completion-session:invalidate')).toBe(true);
    expect(isDebugKeyEvent('completion:ignored-stale-generation')).toBe(true);
    expect(isDebugKeyEvent('merge-panel:completion-detected')).toBe(true);
  });

  it('treats discussion start as key event', () => {
    expect(isDebugKeyEvent('discussion:start-after-existing-merge')).toBe(true);
  });

  it('treats markdown-export events as key events', () => {
    expect(isDebugKeyEvent('markdown-export:success')).toBe(true);
  });

  it('treats panel-injection failure as key event', () => {
    expect(isDebugKeyEvent('panel-injection:failed')).toBe(true);
    expect(isDebugKeyEvent('panel-submit:success')).toBe(true);
    expect(isDebugKeyEvent('panel-submit:failed')).toBe(true);
    expect(isDebugKeyEvent('panel-submit:timeout')).toBe(true);
  });

  it('keeps input and submit diagnostics in the downloaded timeline', () => {
    expect(isDebugKeyEvent('panel-injection:success')).toBe(false);
    expect(isDebugKeyEvent('broadcast:input-cleared')).toBe(false);
    expect(isDebugKeyEvent('text-injection:composer-verification-failed')).toBe(true);
    expect(isDebugKeyEvent('text-injection:submit-failed')).toBe(true);
  });

  it('does not treat unknown prefix as key event', () => {
    expect(isDebugKeyEvent('unknown-prefix:something')).toBe(false);
  });

  it('does not treat generic info event as key event', () => {
    expect(isDebugKeyEvent('panel-send:injected')).toBe(false);
  });
});

describe('debug log issue event recognition', () => {
  it('treats error as issue', () => {
    expect(isDebugIssueEvent('merge:error')).toBe(true);
  });

  it('treats failed as issue', () => {
    expect(isDebugIssueEvent('panel-injection:failed')).toBe(true);
  });

  it('treats timeout as issue', () => {
    expect(isDebugIssueEvent('merge-monitor:timeout')).toBe(true);
  });

  it('treats no-answer as issue', () => {
    expect(isDebugIssueEvent('discussion-final-answer:no-answer')).toBe(true);
  });

  it('treats aborted as issue', () => {
    expect(isDebugIssueEvent('merge:aborted-no-valid-answers')).toBe(true);
  });

  it('does not treat normal completion as issue', () => {
    expect(isDebugIssueEvent('merge-monitor:panel-complete')).toBe(false);
  });
});

describe('debug log export summary', () => {
  it('summarizes sessions with duration and providers', () => {
    const logs = [
      {
        ts: '2026-07-05T00:00:00.000Z',
        t: 10,
        sessionId: 'session-a',
        event: 'discussion-final-answer:auto-start',
        details: { answerLength: 120 }
      },
      {
        ts: '2026-07-05T00:00:02.000Z',
        t: 12,
        sessionId: 'session-a',
        event: 'discussion-final-answer:auto-success',
        details: { filePath: 'D:/notes/out.md' }
      }
    ];

    const sessions = summarizeDebugSessions(logs);
    expect(sessions[0]?.exportStatus).toBe('discussion-final-answer:auto-success');
    expect(sessions[0]?.duration).toBe('2s');
  });

  it('keeps generated initial merge export events in session summaries', () => {
    const logs = [
      {
        ts: '2026-07-05T00:00:00.000Z',
        t: 10,
        sessionId: 'session-a',
        event: 'discussion-initial-merge:auto-success',
        details: { filePath: 'AIChatMerge/raw/2607061523-AI融合.md' }
      }
    ];

    const sessions = summarizeDebugSessions(logs);
    expect(sessions[0].exportStatus).toBe('discussion-initial-merge:auto-success');
  });

  it('keeps panel and provider summaries readable after compaction', () => {
    const compact = compactDebugValue({
      targetPanels: [
        { panelId: 'panel-a', providerId: 'deepseek', isMergePanel: false },
        { panelId: 'panel-b', providerId: 'kimi', isMergePanel: false }
      ],
      providers: [
        { providerName: 'DeepSeek', answerLength: 1200, hasAnswer: true }
      ],
      results: [
        { panel: { panelId: 'panel-a', providerId: 'deepseek', isMergePanel: false }, success: true }
      ]
    });

    expect(compact.targetPanels[0]).toEqual({
      panelId: 'panel-a',
      providerId: 'deepseek',
      isMergePanel: false
    });
    expect(compact.providers[0]).toEqual({
      providerName: 'DeepSeek',
      answerLength: 1200,
      hasAnswer: true
    });
    expect(compact.results[0].panel.providerId).toBe('deepseek');
  });

  it('builds compact payload with issue-focused timeline', () => {
    const logs = [
      {
        ts: '2026-07-06T00:00:00.000Z',
        t: 1,
        sessionId: 'session-a',
        event: 'merge-monitor:panel-complete',
        details: { mergeSessionId: 'merge-1', panel: { panelId: 'panel-a', providerId: 'deepseek', isMergePanel: false } }
      },
      {
        ts: '2026-07-06T00:02:00.000Z',
        t: 120000,
        sessionId: 'session-a',
        event: 'merge-monitor:timeout',
        details: { mergeSessionId: 'merge-1', completedCount: 1, totalCount: 2, missingProviders: ['kimi'] }
      }
    ];

    const payload = buildDebugAiPayload(logs);

    // timeline only has issue events
    expect(payload.timeline).toHaveLength(1);
    expect(payload.timeline[0].event).toBe('merge-monitor:timeout');
    expect(payload.timeline[0].completed).toBe('1/2');

    // issues are compact
    expect(payload.issues).toHaveLength(1);
    expect(payload.issues[0].event).toBe('merge-monitor:timeout');
    expect(payload.issues[0].completed).toBe(1);

    // autoMerge is compact
    expect(payload.autoMerge.timeoutCount).toBe(1);
    expect(payload.autoMerge.latest.completed).toBe(1);

    // no rawTail, no schemaVersion, no summary nesting
    expect(payload.rawTail).toBeUndefined();
    expect(payload.schemaVersion).toBeUndefined();
    expect(payload.summary).toBeUndefined();
  });

  it('keeps transport stage and code on a submit-result timeout issue', () => {
    const logs = [
      {
        ts: '2026-07-06T00:00:00.000Z',
        t: 1,
        sessionId: 'session-a',
        event: 'panel-submit:timeout',
        details: {
          panel: { panelId: 'panel-a', providerId: 'doubao', isMergePanel: false },
          injectionRequestId: 'inject-a',
          stage: 'transport',
          code: 'SUBMIT_RESULT_TIMEOUT'
        }
      }
    ];

    const payload = buildDebugAiPayload(logs, 'session-a');

    expect(payload.verdict).toEqual(expect.objectContaining({
      status: 'failed',
      stage: 'transport',
      code: 'SUBMIT_RESULT_TIMEOUT',
      rootCause: 'submit-result-timeout'
    }));
    expect(payload.issues[0]).toEqual(expect.objectContaining({
      provider: 'doubao',
      stage: 'transport',
      code: 'SUBMIT_RESULT_TIMEOUT',
      injectionRequestId: 'inject-a'
    }));
    expect(payload.timeline[0]).toEqual(expect.objectContaining({
      stage: 'transport',
      code: 'SUBMIT_RESULT_TIMEOUT'
    }));
  });

  it('filters noisy provider values from session summaries', () => {
    const logs = [
      {
        ts: '2026-07-06T00:00:00.000Z',
        t: 1,
        sessionId: 'session-a',
        event: 'discussion:start',
        details: {
          providers: ['deepseek', '[object Object]', { providerId: 'kimi' }, { name: 'Gemini' }]
        }
      }
    ];

    const sessions = summarizeDebugSessions(logs);
    expect(sessions[0].providers).toEqual(['deepseek', 'kimi', 'Gemini']);
  });
});
