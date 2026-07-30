import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 完成监控诊断链路的静态约束：content script 上报 → 面板记录 →
// 关键事件分类。任一环节被改断，grok 这类「completion 不触发」的
// 故障在导出日志里又会变回一句没有现场的 answer-timeout
const completionMonitor = readFileSync(
  resolve(process.cwd(), 'content-scripts/src/providers/completion-monitor.js'),
  'utf8'
);
const messaging = readFileSync(
  resolve(process.cwd(), 'content-scripts/src/providers/messaging.js'),
  'utf8'
);
const panelTransport = readFileSync(
  resolve(process.cwd(), 'aichatmerge-panel/modules/panel-transport.js'),
  'utf8'
);
const debugLogUtils = readFileSync(
  resolve(process.cwd(), 'aichatmerge-panel/modules/debug-log-utils.js'),
  'utf8'
);

describe('completion monitor diagnostics', () => {
  it('posts diagnostics over a dedicated message type without injectionRequestId', () => {
    expect(messaging).toContain('export function postCompletionDiagnostic');
    expect(messaging).toContain("type: 'COMPLETION_DIAGNOSTIC'");
    expect(messaging).toContain("context: 'multi-panel-completion-diagnostic'");
  });

  it('arms a watchdog that fires before the panel merge timeout (120s)', () => {
    expect(completionMonitor).toContain('COMPLETION_WATCHDOG_MS = 95000');
    expect(completionMonitor).toContain("postCompletionDiagnostic('watchdog-timeout'");
    expect(completionMonitor).toContain("postCompletionDiagnostic('appear-timeout'");
    expect(completionMonitor).toContain("postCompletionDiagnostic('start'");
  });

  it('dumps selector snapshots so the log shows what the monitor saw', () => {
    expect(completionMonitor).toContain('function describeCompletionStateForLog');
    expect(completionMonitor).toContain('stopSelectors:');
    expect(completionMonitor).toContain('answerSelectors:');
    expect(completionMonitor).toContain('composerTextLen');
    expect(completionMonitor).toContain('sawStopButton: completionSawStopButton');
  });

  it('clears the watchdog when completion is detected', () => {
    // 两个 COMPLETION_DETECTED 上报点都要清看门狗，否则成功路径也会误报
    const clears = completionMonitor.match(/clearCompletionWatchdog\(\);/g) || [];
    expect(clears.length).toBeGreaterThanOrEqual(3);
  });

  it('clears the watchdog on SSE completion and STOP_MONITORING too', () => {
    // SSE 路径完成的 provider 不会走监控器自己的完成分支；
    // 不清看门狗会对每个正常完成的 SSE provider 误报 watchdog-timeout
    const entry = readFileSync(
      resolve(process.cwd(), 'content-scripts/src/text-injection-entry.js'),
      'utf8'
    );
    const sseStart = entry.indexOf("if (event.data.type === '__sse_complete__')");
    expect(sseStart).toBeGreaterThanOrEqual(0);
    expect(entry.slice(sseStart, sseStart + 500)).toContain('clearCompletionWatchdog()');
    const stopStart = entry.indexOf("event.data.type === 'STOP_MONITORING'");
    expect(stopStart).toBeGreaterThanOrEqual(0);
    expect(entry.slice(stopStart, stopStart + 300)).toContain('clearCompletionWatchdog()');
  });

  it('dumps selector snapshots as flat strings that survive export compaction', () => {
    // 嵌套对象会被导出的 compactDebugValue 压成占位符，扁平字符串才能进日志
    expect(completionMonitor).toContain('count=${count} visible=${visible} textLen=${textLen}');
    expect(completionMonitor).not.toContain('return { selector, count, visible, textLen };');
  });

  it('records completion-monitor events on the panel side', () => {
    expect(panelTransport).toContain("data.type === 'COMPLETION_DIAGNOSTIC'");
    expect(panelTransport).toContain('`completion-monitor:${data.event || \'unknown\'}`');
  });

  it('treats stall events as key events so they reach the exported timeline', () => {
    expect(debugLogUtils).toContain('/^completion-monitor:(appear-timeout|watchdog-timeout)/');
    // start 事件只是心跳，不允许进 timeline（12 个面板会刷掉真正的事件）
    expect(debugLogUtils).not.toContain('/^completion-monitor:/');
  });

  it('records an answer snapshot baseline at injection for fast providers', () => {
    // MONITOR_COMPLETION 晚于注入到达，zhipu 这类快 provider 布防前就答完；
    // 与基线的任何文本差异（包括长度相同的新答案）都算观察到变化
    expect(completionMonitor).toContain('export function noteInjectionForCompletion');
    expect(completionMonitor).toContain('injectionAnswerBaseline');
    expect(completionMonitor).toContain('prevAnswerSnapshot !== injectionAnswerSnapshot');
    const entry = readFileSync(
      resolve(process.cwd(), 'content-scripts/src/text-injection-entry.js'),
      'utf8'
    );
    expect(entry).toContain('noteInjectionForCompletion()');
  });

  it('separates stuck monitors from still-streaming ones in the dump', () => {
    // 看门狗快照必须能区分「卡死」和「还在流式生成」——慢 provider
    // （wenxin 深度研究）和真卡死在上层都表现为 merge 超时
    expect(completionMonitor).toContain('lastAnswerChangeAgoMs');
    expect(completionMonitor).toContain('injectionBaseline: injectionAnswerBaseline');
  });

  it('measures answers beyond the iframe viewport (kimi discussion round)', () => {
    // 答案容器可能在小 iframe 可视区域外；测量忽略视口位置否则永远看不到增长
    expect(completionMonitor).toContain('isVisibleElement(el, { ignoreViewport: true })');
  });
});
