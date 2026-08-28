// send-lifecycle.js — 发送请求生命周期的纯常量与日志推导
// 不读取 DOM、不写日志、不推进业务状态；仅供面板发送与短诊断报告共享语义。

export const SEND_LIFECYCLE_STAGES = Object.freeze({
  UI: 'ui',
  INJECT: 'inject',
  SUBMIT: 'submit',
  TRANSPORT: 'transport',
  ANSWER: 'answer'
});

export const SEND_LIFECYCLE_CODES = Object.freeze({
  INPUT_CLEARED: 'INPUT_CLEARED',
  INJECTION_RESULT_PENDING: 'INJECTION_RESULT_PENDING',
  SUBMIT_RESULT_PENDING: 'SUBMIT_RESULT_PENDING',
  SUBMIT_RESULT_TIMEOUT: 'SUBMIT_RESULT_TIMEOUT'
});

const TERMINAL_EVENTS = new Set([
  'panel-injection:failed',
  'panel-injection:give-up',
  'panel-injection:timeout',
  'panel-submit:success',
  'panel-submit:failed',
  'panel-submit:unconfirmed',
  'panel-submit:timeout',
  'text-injection:submit-failed'
]);

function getDetails(log) {
  return log && typeof log.details === 'object' && log.details ? log.details : {};
}

function getRequestId(log) {
  return getDetails(log).injectionRequestId || null;
}

function getProvider(log) {
  const details = getDetails(log);
  return details.panel?.providerId || details.provider || details.sourceId || null;
}

function getTimestampMs(log) {
  const value = Date.parse(log?.ts || '');
  return Number.isFinite(value) ? value : null;
}

/**
 * 从已有的低频业务事件推导尚未结束的请求，不产生新的 pending 日志。
 */
export function derivePendingSendRequests(logs, nowMs = Date.now()) {
  const requests = new Map();

  for (const log of Array.isArray(logs) ? logs : []) {
    const requestId = getRequestId(log);
    if (!requestId) continue;
    const details = getDetails(log);

    if (log.event === 'panel-send:start') {
      requests.set(requestId, {
        requestId,
        provider: getProvider(log),
        autoSubmit: details.autoSubmit !== false,
        stage: SEND_LIFECYCLE_STAGES.INJECT,
        code: SEND_LIFECYCLE_CODES.INJECTION_RESULT_PENDING,
        startedAtMs: getTimestampMs(log)
      });
      continue;
    }

    const request = requests.get(requestId);
    if (!request) continue;

    if (TERMINAL_EVENTS.has(log.event)) {
      requests.delete(requestId);
      continue;
    }

    if (log.event === 'panel-injection:success') {
      if (!request.autoSubmit) {
        requests.delete(requestId);
      } else {
        request.stage = SEND_LIFECYCLE_STAGES.SUBMIT;
        request.code = SEND_LIFECYCLE_CODES.SUBMIT_RESULT_PENDING;
      }
      continue;
    }

    if (log.event === 'text-injection:submit-confirmed') {
      request.stage = SEND_LIFECYCLE_STAGES.TRANSPORT;
      request.code = SEND_LIFECYCLE_CODES.SUBMIT_RESULT_PENDING;
    }
  }

  return Array.from(requests.values()).map(request => ({
    requestId: request.requestId,
    provider: request.provider,
    stage: request.stage,
    code: request.code,
    elapsedMs: request.startedAtMs === null
      ? null
      : Math.max(0, Math.round(nowMs - request.startedAtMs))
  }));
}
