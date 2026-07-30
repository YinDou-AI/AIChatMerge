// verdict-false-negative.test.js
// 回放 2026-07-22 两份真实日志的事件模式，验证 verdict 不把正常运行判负。
// 需求来源：两轮功能全正常（融合全完成、讨论全完成、零 submit-failed）
// 但 verdict 报 failed unclassified-failure——巡检自动判定失效。

import { describe, expect, it } from 'vitest';
import { buildDebugVerdict } from '../aichatmerge-panel/modules/debug-verdict.js';

function makeLog(event, details = {}, index = 0, sessionId = 'session-current') {
  return {
    ts: `2026-07-22T02:15:${String(index % 60).padStart(2, '0')}.000Z`,
    t: index * 1000,
    sessionId,
    event,
    details
  };
}

const p1 = { panelId: 'p1', providerId: 'wenxin', isMergePanel: false };
const p2 = { panelId: 'p2', providerId: 'deepseek', isMergePanel: false };
const p3 = { panelId: 'p3', providerId: 'zhipu', isMergePanel: false };
const p4 = { panelId: 'p4', providerId: 'doubao', isMergePanel: false };
const p5 = { panelId: 'p5', providerId: 'yuanbao', isMergePanel: false };

// 07-22 第一轮：融合全完成，讨论全完成，有 appear-timeout + zhipu watchdog 误报
function run1Events() {
  return [
    makeLog('broadcast:start', { autoSubmit: true }, 0),
    makeLog('panel-send:start', { panel: p1 }, 1),
    makeLog('panel-send:start', { panel: p2 }, 2),
    makeLog('panel-send:start', { panel: p3 }, 3),
    makeLog('panel-send:start', { panel: p4 }, 4),
    makeLog('panel-send:start', { panel: p5 }, 5),
    makeLog('panel-injection:success', { panel: p1 }, 6),
    makeLog('panel-injection:success', { panel: p2 }, 7),
    makeLog('panel-injection:success', { panel: p3 }, 8),
    makeLog('panel-injection:success', { panel: p4 }, 9),
    makeLog('panel-injection:success', { panel: p5 }, 10),
    // doubao/yuanbao 正常走 fallback（无停止按钮）
    makeLog('completion-monitor:appear-timeout', { panel: p4, sourceId: 'doubao', phase: 'button-watch-appear' }, 11),
    makeLog('completion-monitor:appear-timeout', { panel: p5, sourceId: 'yuanbao', phase: 'button-watch-appear' }, 12),
    // zhipu watchdog 误报（面板已完成但看门狗早了 0.5 秒）
    makeLog('completion-monitor:watchdog-timeout', { panel: p3, sourceId: 'zhipu', phase: 'mutation-fallback', lastAnswerChangeAgoMs: 14506, injectionBaseline: 0 }, 13),
    // 全部完成
    makeLog('merge-monitor:panel-complete', { panel: p1 }, 14),
    makeLog('merge-monitor:panel-complete', { panel: p2 }, 15),
    makeLog('merge-monitor:panel-complete', { panel: p3 }, 16),
    makeLog('merge-monitor:panel-complete', { panel: p4 }, 17),
    makeLog('merge-monitor:panel-complete', { panel: p5 }, 18),
    makeLog('merge-monitor:all-complete-auto-merge', { totalCount: 5 }, 19),
    makeLog('merge:trigger-start', {}, 20),
    // deepseek 讨论启动门超时（正常降级）
    makeLog('discussion-start-gate:timeout-fallback', { panel: p2, sourceId: 'deepseek' }, 21),
    makeLog('discussion:round-start', {}, 22),
    makeLog('discussion-wait:start', { targetPanels: [p1, p2, p3, p4, p5] }, 23),
    makeLog('discussion-wait:all-complete', { completedCount: 5, totalCount: 5 }, 24),
    makeLog('discussion:completed', { finalAnswerLength: 500 }, 25),
  ];
}

// 07-22 第二轮：更干净，只有 appear-timeout
function run2Events() {
  return [
    makeLog('broadcast:start', { autoSubmit: true }, 0),
    makeLog('panel-injection:success', { panel: p1 }, 1),
    makeLog('panel-injection:success', { panel: p2 }, 2),
    makeLog('panel-injection:success', { panel: p3 }, 3),
    makeLog('panel-injection:success', { panel: p4 }, 4),
    makeLog('panel-injection:success', { panel: p5 }, 5),
    makeLog('completion-monitor:appear-timeout', { panel: p4, sourceId: 'doubao', phase: 'button-watch-appear' }, 6),
    makeLog('completion-monitor:appear-timeout', { panel: p5, sourceId: 'yuanbao', phase: 'button-watch-appear' }, 7),
    makeLog('merge-monitor:panel-complete', { panel: p1 }, 8),
    makeLog('merge-monitor:panel-complete', { panel: p2 }, 9),
    makeLog('merge-monitor:panel-complete', { panel: p3 }, 10),
    makeLog('merge-monitor:panel-complete', { panel: p4 }, 11),
    makeLog('merge-monitor:panel-complete', { panel: p5 }, 12),
    makeLog('merge-monitor:all-complete-auto-merge', { totalCount: 5 }, 13),
    makeLog('merge:trigger-start', {}, 14),
    makeLog('discussion:round-start', {}, 15),
    makeLog('completion-monitor:appear-timeout', { panel: p5, sourceId: 'yuanbao', phase: 'button-watch-appear' }, 16),
    makeLog('discussion-wait:start', { targetPanels: [p1, p2, p3, p4, p5] }, 17),
    makeLog('discussion-wait:all-complete', { completedCount: 5, totalCount: 5 }, 18),
    makeLog('discussion:completed', { finalAnswerLength: 400 }, 19),
  ];
}

describe('verdict false-negative on 07-22 logs (diagnosing-bugs feedback loop)', () => {
  it('run 1: verdict should be ok — all flows completed, benign timeouts only', () => {
    const verdict = buildDebugVerdict(run1Events());
    expect(verdict.status).toBe('ok');
    expect(verdict.rootCause).toBeNull();
  });

  it('run 2: verdict should be ok — all flows completed, benign timeouts only', () => {
    const verdict = buildDebugVerdict(run2Events());
    expect(verdict.status).toBe('ok');
    expect(verdict.rootCause).toBeNull();
  });

  it('run 1: regression flags zhipu watchdog false-positive but verdict stays ok', () => {
    const verdict = buildDebugVerdict(run1Events());
    const watchdogRegression = verdict.regressions.find(r => r.id === 'watchdog-false-positive');
    expect(watchdogRegression?.status).toBe('fail');
    // regression 是信息性的，不应让 verdict 判负
    expect(verdict.status).toBe('ok');
  });

  it('run 2: all regressions pass', () => {
    const verdict = buildDebugVerdict(run2Events());
    expect(verdict.regressions.every(r => r.status === 'pass')).toBe(true);
  });

  it('real failures are still caught — appear-timeout alone is benign but submit-failed is not', () => {
    const logs = [
      makeLog('broadcast:start', { autoSubmit: true }, 0),
      makeLog('text-injection:submit-failed', { provider: 'chatgpt', reason: 'send-unconfirmed' }, 1),
      makeLog('completion-monitor:appear-timeout', { panel: p4, sourceId: 'doubao', phase: 'button-watch-appear' }, 2),
      makeLog('merge-monitor:panel-complete', { panel: p1 }, 3),
      makeLog('merge-monitor:all-complete-auto-merge', { totalCount: 1 }, 4),
      makeLog('discussion:completed', { finalAnswerLength: 100 }, 5),
    ];
    const verdict = buildDebugVerdict(logs);
    expect(verdict.status).toBe('failed');
    expect(verdict.rootCause).toBe('send-control-not-found');
  });
});
