// debug-log-utils.js — 调试日志分析与工具函数
// 从 debug-log.js 拆分

import { buildDebugVerdict } from './debug-verdict.js';
import { SEND_LIFECYCLE_CODES, SEND_LIFECYCLE_STAGES } from './send-lifecycle.js';

const DEBUG_LOG_ISSUE_LIMIT = 10;
const DEBUG_LOG_EVENT_COUNT_LIMIT = 12;

export function getDebugLogDetails(log) {
  return log && typeof log.details === 'object' && log.details ? log.details : {};
}

export function compactDebugValue(value, depth = 0) {
  if (typeof value === 'string') {
    return value.length > 180 ? `${value.slice(0, 180)}…` : value;
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (isPanelDebugObject(value)) {
    return {
      panelId: value.panelId,
      providerId: value.providerId,
      isMergePanel: value.isMergePanel === true
    };
  }
  if (isProviderAnswerSummary(value)) {
    return {
      providerName: value.providerName,
      answerLength: value.answerLength,
      hasAnswer: value.hasAnswer === true
    };
  }
  if (isSendResultSummary(value)) {
    return {
      panel: compactDebugValue(value.panel, depth + 1),
      success: value.success === true,
      error: value.error || value.reason || undefined
    };
  }
  if (Array.isArray(value)) {
    const compact = value.slice(0, getCompactArrayLimit(value)).map(item => compactDebugValue(item, depth + 1));
    if (value.length > compact.length) {
      compact.push(`... ${value.length - compact.length} more`);
    }
    return compact;
  }
  if (depth >= 2) {
    const keys = Object.keys(value);
    return keys.length ? `{${keys.slice(0, 8).join(',')}}` : {};
  }

  const compact = {};
  Object.entries(value).forEach(([key, item]) => {
    compact[key] = compactDebugValue(item, depth + 1);
  });
  return compact;
}

function isPanelDebugObject(value) {
  return value && typeof value === 'object' &&
    typeof value.panelId === 'string' &&
    typeof value.providerId === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'isMergePanel');
}

function isProviderAnswerSummary(value) {
  return value && typeof value === 'object' &&
    typeof value.providerName === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'answerLength') &&
    Object.prototype.hasOwnProperty.call(value, 'hasAnswer');
}

function isSendResultSummary(value) {
  return value && typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, 'panel') &&
    Object.prototype.hasOwnProperty.call(value, 'success');
}

function getCompactArrayLimit(value) {
  if (value.every(item => isPanelDebugObject(item) || typeof item === 'string')) {
    return 20;
  }
  if (value.every(item => isProviderAnswerSummary(item) || isSendResultSummary(item))) {
    return 16;
  }
  return 8;
}

function normalizeDebugProviderName(provider) {
  if (typeof provider === 'string') {
    const normalized = provider.trim();
    if (!normalized || normalized === '[object Object]') return null;
    return normalized;
  }
  if (provider && typeof provider === 'object') {
    const normalized = String(provider.providerId || provider.id || provider.name || '').trim();
    return normalized || null;
  }
  return null;
}

export function compactDebugLog(log) {
  return {
    ts: log.ts,
    t: log.t,
    sessionId: log.sessionId,
    event: log.event,
    details: compactDebugValue(getDebugLogDetails(log))
  };
}

export function isDebugIssueEvent(event) {
  return /error|failed|timeout|no-answer|empty|give-up|missing|aborted|fallback/i.test(event || '');
}

export function isDebugKeyEvent(event) {
  if (!event) return false;
  return isDebugIssueEvent(event) ||
    /^merge:(trigger-start|answers-extracted|prompt-built|reuse-panel|create-panel|auto-export|aborted|skip-stale)/.test(event) ||
    /^merge-monitor:(start|timeout|all-complete|panel-complete|stop|trigger-load-failed)/.test(event) ||
    /^completion:(ignored-session-mismatch|ignored-stale-generation|ignored-inactive|no-panel-found)/.test(event) ||
    /^completion-session:/.test(event) ||
    /^merge-panel:/.test(event) ||
    /^discussion:(start|round-start|prompt-built|send-results|round-answers-extracted|round-merge-answer-extracted|completed|stop)/.test(event) ||
    /^discussion-wait:(start|all-complete|timeout)/.test(event) ||
    /^discussion-final-answer:/.test(event) ||
    /^discussion-initial-merge:/.test(event) ||
    /^discussion-wait:final-merge/.test(event) ||
    /^discussion-start-gate:(start|new-answer-started|text-stable|timeout-fallback|overall-timeout-fallback|begin-discussion)/.test(event) ||
    /^discussion-merge-wait:(start|stable-fallback-complete|completion-wait-ended)/.test(event) ||
    /^markdown-export:/.test(event) ||
    /^panel-injection:(failed|give-up|timeout)/.test(event) ||
    /^panel-submit:/.test(event) ||
    /^completion-monitor:(appear-timeout|watchdog-timeout)/.test(event) ||
    /^text-injection:/.test(event);
}

export function buildDebugEventCounts(logs) {
  const counts = {};
  logs.forEach(log => {
    counts[log.event] = (counts[log.event] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, DEBUG_LOG_EVENT_COUNT_LIMIT)
    .map(([event, count]) => ({ event, count }));
}

export function getDebugIssueSeverity(event) {
  if (/error|failed|give-up/i.test(event || '')) return 'error';
  if (/timeout|no-answer|empty|missing/i.test(event || '')) return 'warning';
  return 'info';
}

/**
 * 从 issue 事件中提取核心诊断字段，每个事件类型只保留最有用的信息。
 * 目标：每个 issue 只占 1-3 行 JSON，AI 一眼能读懂。
 */
function compactIssueDetails(log) {
  const d = getDebugLogDetails(log);
  const e = log.event;
  const provider = d?.panel?.providerId || d?.provider || d?.sourceId || null;

  // submit-failed: 为什么发送失败
  if (e === 'text-injection:submit-failed') {
    return {
      provider,
      reason: d.reason,
      sendFound: d.sendControl?.found,
      sendVisible: d.sendControl?.visible,
      composerLen: d.composer?.afterLength,
      attempts: d.attempts
    };
  }

  if (e === 'panel-submit:failed' || e === 'panel-submit:timeout') {
    const timedOut = e === 'panel-submit:timeout';
    return {
      provider,
      stage: d.stage || (timedOut ? SEND_LIFECYCLE_STAGES.TRANSPORT : SEND_LIFECYCLE_STAGES.SUBMIT),
      code: d.code || (timedOut ? SEND_LIFECYCLE_CODES.SUBMIT_RESULT_TIMEOUT : 'SEND_CONTROL_NOT_FOUND'),
      injectionRequestId: d.injectionRequestId
    };
  }

  // watchdog-timeout: 完成检测超时的快照
  if (e === 'completion-monitor:watchdog-timeout') {
    const ansSel = Array.isArray(d.answerSelectors)
      ? d.answerSelectors.map(s => s.replace(/\s*count=\d+\s*visible=\d+\s*textLen=\d+/, '')).join(', ')
      : null;
    return {
      provider,
      answerLen: d.answerSelectors?.reduce((max, s) => {
        const m = s.match(/textLen=(\d+)/);
        return Math.max(max, m ? +m[1] : 0);
      }, 0) || 0,
      submitStatus: d.submitStatus,
      composerTextLen: d.composerTextLen,
      stopButtonSeen: d.sawStopButton,
      lastChangeAgoMs: d.lastAnswerChangeAgoMs
    };
  }

  // appear-timeout: 答案一直没出现
  if (e === 'completion-monitor:appear-timeout') {
    return { provider, phase: d.phase, stopButtonSeen: d.sawStopButton };
  }

  // discussion-start-gate:empty-answer
  if (e === 'discussion-start-gate:empty-answer') {
    return { provider, elapsedMs: d.elapsedMs };
  }

  // merge-monitor:timeout
  if (e === 'merge-monitor:timeout') {
    return {
      completed: d.completedCount,
      total: d.totalCount,
      missing: d.missingProviders || d.missingPanels?.map(p => p.providerId)
    };
  }

  // discussion-wait:timeout
  if (e === 'discussion-wait:timeout') {
    return {
      completed: d.completedCount,
      total: d.totalCount,
      missing: d.missingPanels?.map(p => p.providerId)
    };
  }

  // 兜底: 只保留 provider 和 reason
  return { provider, reason: d.reason || d.gateReason || undefined };
}

export function extractDebugIssues(logs) {
  return logs
    .filter(log => isDebugIssueEvent(log.event))
    .slice(-DEBUG_LOG_ISSUE_LIMIT)
    .map(log => ({
      event: log.event,
      severity: getDebugIssueSeverity(log.event),
      ts: log.ts,
      ...compactIssueDetails(log)
    }));
}

export function summarizeDebugSessions(logs) {
  const sessions = new Map();
  logs.forEach(log => {
    const sessionId = log.sessionId || 'unknown';
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        sessionId,
        startTs: log.ts,
        endTs: log.ts,
        providers: new Set(),
        finalAnswerLength: null,
        exportStatus: null
      });
    }

    const session = sessions.get(sessionId);
    const details = getDebugLogDetails(log);
    session.endTs = log.ts;
    if (details.exportAnswerLength || details.finalAnswerLength) {
      session.finalAnswerLength = details.exportAnswerLength || details.finalAnswerLength;
    }
    if (Array.isArray(details.providers)) {
      details.providers.forEach(provider => {
        const normalized = normalizeDebugProviderName(provider);
        if (normalized) session.providers.add(normalized);
      });
    }
    if (Array.isArray(details.results)) {
      details.results.forEach(result => {
        const providerId = result?.panel?.providerId;
        if (providerId) session.providers.add(providerId);
      });
    }
    if (log.event && isDebugExportEvent(log.event) &&
        /success|failed|error|no-answer/.test(log.event)) {
      session.exportStatus = log.event;
    }
  });

  return Array.from(sessions.values()).map(session => ({
    sessionId: session.sessionId,
    duration: session.startTs && session.endTs
      ? `${Math.round((new Date(session.endTs) - new Date(session.startTs)) / 1000)}s`
      : null,
    providers: Array.from(session.providers).slice(0, 12),
    finalAnswerLength: session.finalAnswerLength,
    exportStatus: session.exportStatus
  }));
}

function isDebugExportEvent(event) {
  return Boolean(event && (
    event.startsWith('markdown-export:') ||
    event.startsWith('discussion-final-answer:') ||
    event.startsWith('discussion-initial-merge:')
  ));
}

/**
 * 从日志中提取答案提取失败的诊断摘要。
 * 输出扁平结构，AI 可直接阅读，不需要嵌套遍历。
 */
function buildExtractionDiagnosis(logs, currentSessionId) {
  const sessionLogs = currentSessionId
    ? logs.filter(log => log.sessionId === currentSessionId)
    : logs;
  const failures = [];

  sessionLogs.forEach(log => {
    const details = getDebugLogDetails(log);
    if (log.event === 'discussion-start-gate:empty-answer') {
      const diag = details.extractionDiag;
      const provider = diag?.extract?.provider || details?.panel?.providerId || 'unknown';
      const phases = diag?.extract?.phases || [];
      const phaseSummary = phases.map(p => {
        if (p.skipped) return `${p.name}:skipped`;
        if (p.error) return `${p.name}:error(${p.error.slice(0, 40)})`;
        return `${p.name}:${p.hit ? `hit(${p.len})` : 'miss'}`;
      }).join(' → ');

      const extractorDiag = diag?.providerExtractorDiag;
      let extractorSummary = '';
      if (extractorDiag) {
        const parts = [];
        if (extractorDiag.primaryCount !== undefined) parts.push(`primary:${extractorDiag.primaryCount}found/${extractorDiag.primaryEmpty}empty/${extractorDiag.primarySkipped}skipped`);
        if (extractorDiag.fallbackCount !== undefined) parts.push(`fallback:${extractorDiag.fallbackCount}found/${extractorDiag.fallbackEmpty}empty/${extractorDiag.fallbackSkipped}skipped`);
        extractorSummary = parts.join(', ');
      }

      failures.push({
        provider,
        sseLen: diag?.sseLen ?? null,
        domLen: diag?.domLen ?? null,
        winner: diag?.extract?.winner || 'none',
        phases: phaseSummary || 'no-diag',
        extractorDetail: extractorSummary || undefined,
        likelyCause: diag
          ? (extractorDiag?.primaryCount > 0 && extractorDiag?.primaryEmpty > 0
            ? 'elements-found-but-text-empty'
            : extractorDiag?.primaryCount === 0
              ? 'no-elements-found'
              : diag.sseLen === 0 && diag.domLen === 0
                ? 'both-sse-and-dom-empty'
                : 'unknown')
          : 'no-diag-available',
        domSnapshot: diag?.domSnapshot || diag?.extract?.domDump || undefined
      });
    }

    if (log.event === 'text-injection:submit-failed' || log.event === 'panel-submit:failed' || log.event === 'panel-submit:timeout') {
      const provider = details?.provider || details?.panel?.providerId || 'unknown';
      if (!failures.some(f => f.provider === provider && f.type === 'submit-failed')) {
        failures.push({
          provider,
          type: 'submit-failed',
          reason: details?.reason || details?.error || (log.event.endsWith(':timeout') ? 'submit-result-timeout' : 'unknown'),
          sendControlFound: details?.sendControl?.found ?? null,
          sendControlVisible: details?.sendControl?.visible ?? null
        });
      }
    }
  });

  if (failures.length === 0) return null;

  return {
    count: failures.length,
    failures
  };
}

/**
 * 构建精简的事件序列：只保留 issue 事件，每个事件只带核心字段。
 * 用于 AI 理解事件发生的先后顺序和因果关系。
 */
function buildCompactTimeline(logs) {
  return logs
    .filter(log => isDebugIssueEvent(log.event))
    .slice(-15)
    .map(log => {
      const d = getDebugLogDetails(log);
      const provider = d?.panel?.providerId || d?.provider || d?.sourceId || null;
      const item = { ts: log.ts, event: log.event };
      if (provider) item.provider = provider;
      if (d.stage) item.stage = d.stage;
      if (d.code) item.code = d.code;
      if (d.reason) item.reason = d.reason;
      if (d.completedCount !== undefined) item.completed = `${d.completedCount}/${d.totalCount}`;
      if (d.missingProviders) item.missing = d.missingProviders;
      if (d.answerLength !== undefined) item.answerLen = d.answerLength;
      if (d.elapsedMs !== undefined) item.elapsedMs = d.elapsedMs;
      return item;
    });
}

/**
 * 精简 autoMerge 诊断：只保留最近一次超时的核心信息。
 */
function buildCompactAutoMerge(logs) {
  let latestTimeout = null;
  let timeoutCount = 0;

  logs.forEach((log) => {
    const details = getDebugLogDetails(log);
    if (log.event === 'merge-monitor:timeout') {
      timeoutCount++;
      latestTimeout = {
        completed: details.completedCount,
        total: details.totalCount,
        missing: details.missingProviders || details.missingPanels?.map(p => p.providerId)
      };
    }
  });

  if (timeoutCount === 0) return null;
  return { timeoutCount, latest: latestTimeout };
}

export function buildDebugAiPayload(logs, debugSessionId, intent = null) {
  const currentSessionLogs = logs.filter(log => log.sessionId === debugSessionId);
  const issueEvents = logs.filter(log => isDebugIssueEvent(log.event));

  return {
    version: typeof chrome !== 'undefined' ? (chrome.runtime?.getManifest?.().version || 'unknown') : 'unknown',
    exportedAt: new Date().toISOString(),
    intent: intent || null,
    verdict: buildDebugVerdict(logs, intent, debugSessionId || null, Date.now()),
    extractionDiagnosis: buildExtractionDiagnosis(logs, debugSessionId),
    issues: extractDebugIssues(logs),
    timeline: buildCompactTimeline(logs),
    autoMerge: buildCompactAutoMerge(logs),
    eventCounts: buildDebugEventCounts(currentSessionLogs),
    sessions: summarizeDebugSessions(logs)
  };
}
