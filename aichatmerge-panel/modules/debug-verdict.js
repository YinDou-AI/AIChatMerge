// debug-verdict.js — 从调试日志生成机器可读结论（verdict）
// 规则库驱动：每修一个新的 bug，把它的失败特征补成下面的一条规则，
// 让同族故障下次能被判定脚本零推理识别。rootCause 只能取这里的枚举键。

import {
  SEND_LIFECYCLE_CODES,
  SEND_LIFECYCLE_STAGES,
  derivePendingSendRequests
} from './send-lifecycle.js';

export const VERDICT_ROOT_CAUSES = {
  'provider-transport-timeout': {
    failedStage: 'transport',
    code: 'INJECTION_RESULT_TIMEOUT',
    meaning: 'provider iframe 里的 content script 没有响应注入请求（页面里没有注入脚本，或注入的是旧版本）',
    suggestedChecks: [
      '确认 chrome://extensions 里重新加载的是预期目录（比较日志中的 expectedBuildId）',
      '确认 manifest content_scripts.matches 覆盖 provider 的实际域名（比较 targetOrigin 与实际站点）',
      '打开 provider iframe 的控制台查看 content script 是否报错'
    ]
  },
  'injection-rejected': {
    failedStage: 'inject',
    code: 'INJECTION_REJECTED',
    meaning: 'content script 响应了，但没有找到输入框或写入失败',
    suggestedChecks: [
      '核对 PROVIDER_SELECTORS 是否匹配 provider 当前 DOM（日志含候选元素摘要）',
      '确认命中的输入框是可见元素而不是隐藏测量节点'
    ]
  },
  'composer-verification-failed': {
    failedStage: 'inject',
    code: 'COMPOSER_VERIFICATION_FAILED',
    meaning: '写入执行了，但写完后输入框内容为空（框架状态未提交或目标元素错误）',
    suggestedChecks: [
      '核对写入目标是否为用户可见的真实输入框',
      '确认注入值的方式触发了框架的 input/change 事件'
    ]
  },
  'send-control-not-found': {
    failedStage: 'submit',
    code: 'SEND_CONTROL_NOT_FOUND',
    meaning: '文本已填入输入框，但当前 provider adapter 没有找到可点击的发送键',
    suggestedChecks: [
      '只打开该 provider adapter 和对应 fixture，核对发送键选择器',
      '添加一个失败 fixture 后运行该 provider 的提交契约测试'
    ]
  },
  'submit-result-timeout': {
    failedStage: SEND_LIFECYCLE_STAGES.TRANSPORT,
    code: SEND_LIFECYCLE_CODES.SUBMIT_RESULT_TIMEOUT,
    meaning: '面板在期限内没有收到对应请求的 SUBMIT_TEXT_DISPATCH_RESULT',
    suggestedChecks: [
      '按 injectionRequestId 检查 messaging.js 是否发出 SUBMIT_TEXT_DISPATCH_RESULT',
      '检查 panel-transport.js 是否接受了同 provider、同 iframe 的结果消息',
      '检查 send-pipeline.js 中对应 pending 请求是否被提前删除或错误关联'
    ]
  },
  'answer-timeout': {
    failedStage: 'answer',
    code: 'ANSWER_TIMEOUT',
    meaning: '发送成功后等待回答超时，部分 provider 没有产出答案',
    suggestedChecks: [
      '检查 missingProviders 对应面板是否仍在生成或卡在登录/验证页',
      '核对答案提取选择器是否匹配 provider 当前 DOM'
    ]
  },
  'completion-not-detected': {
    failedStage: 'answer',
    code: 'COMPLETION_NOT_DETECTED',
    meaning: 'provider 页面内的 completion 监控器 90 秒仍未检测到回答完成（证据含监控阶段与停止按钮/答案选择器命中快照）',
    suggestedChecks: [
      'phase=button-watch-appear 且 sawStopButton=false：停止按钮选择器未命中，核对 STOP_BUTTON_SELECTORS 与该 provider 当前 DOM',
      'composerTextLen>0：文本仍留在输入框里没有发送出去，按发送链路排查',
      'answerSelectors 快照 visible=0 或 textLen=0：答案选择器未命中或元素不可见，核对 DIRECT_ANSWER_SELECTORS'
    ]
  },
  'no-send-activity': {
    failedStage: 'trigger',
    code: 'NO_SEND_ACTIVITY',
    meaning: '日志里没有任何发送动作，测试流程可能没有真正触发',
    suggestedChecks: [
      '确认驱动脚本成功点击了发送按钮',
      '确认面板页面完成了加载'
    ]
  },
  'send-incomplete': {
    failedStage: 'transport',
    code: 'SEND_INCOMPLETE',
    meaning: '发送已发起但导出时还没有任何注入结果，可能是导出太早或注入请求挂起',
    suggestedChecks: [
      '延长发送后到导出前的等待时间',
      '若稳定复现则按 provider-transport-timeout 排查'
    ]
  },
  'unclassified-failure': {
    failedStage: null,
    code: 'UNCLASSIFIED_FAILURE',
    meaning: '存在失败事件但不匹配任何已知规则（新故障模式）',
    suggestedChecks: [
      '把 evidence 中的事件交给修复 agent 人工分析',
      '修复后把该故障特征补充为 VERDICT_ROOT_CAUSES 的新规则'
    ]
  }
};

function getDetails(log) {
  return log && typeof log.details === 'object' && log.details ? log.details : {};
}

function getPanelId(log) {
  const details = getDetails(log);
  return details.panel?.panelId || details.targetId || null;
}

// ===== 历史 bug 回归断言 =====
// 每修一个影响日志形态的 bug，就在这里加一条断言。judge 脚本只搬运
// 结果，分析逻辑全部留在扩展侧，保证判定与运行环境无关
function computeRegressions(list) {
  const regressions = [];

  // 已完成面板：融合逐面板完成 + 融合面板完成
  const completedPanelIds = new Set(
    list
      .filter(log => log.event === 'merge-monitor:panel-complete' || log.event === 'merge-panel:completion-detected')
      .map(getPanelId)
      .filter(Boolean)
  );

  // 看门狗误报：面板已完成却仍触发看门狗 = SSE/STOP_MONITORING
  // 清看门狗的修复发生回归（2026-07-21 曾污染整轮日志）
  const watchdogs = list.filter(log => log.event === 'completion-monitor:watchdog-timeout');
  const falsePositiveWatchdogs = watchdogs.filter(log => completedPanelIds.has(getPanelId(log)));
  const realStalls = watchdogs.filter(log => !completedPanelIds.has(getPanelId(log)));
  regressions.push({
    id: 'watchdog-false-positive',
    status: falsePositiveWatchdogs.length === 0 ? 'pass' : 'fail',
    detail: falsePositiveWatchdogs.length === 0
      ? '正常完成的面板没有看门狗误报'
      : `${falsePositiveWatchdogs.length} 个已完成面板误报 watchdog-timeout`
  });

  // 发送链路：任何 submit-failed 都是发送类修复的回归信号
  const submitFailures = list.filter(log =>
    log.event === 'text-injection:submit-failed' ||
    log.event === 'panel-submit:failed' ||
    log.event === 'panel-submit:timeout'
  );
  regressions.push({
    id: 'submit-path',
    status: submitFailures.length === 0 ? 'pass' : 'fail',
    detail: submitFailures.length === 0
      ? '发送链路无失败'
      : `submit-failed: ${[...new Set(submitFailures.map(log => getProviderId(log) || '?'))].join(', ')}`
  });

  // 会话隔离：每次真实发送滚动调试会话，本轮事件不得早于本轮 broadcast:start
  const broadcastStarts = list.filter(log => log.event === 'broadcast:start');
  if (broadcastStarts.length > 0) {
    const runStart = Math.min(...broadcastStarts.map(log => (typeof log.t === 'number' ? log.t : Infinity)));
    const leaked = list.filter(log => typeof log.t === 'number' && log.t < runStart);
    regressions.push({
      id: 'session-isolation',
      status: leaked.length === 0 ? 'pass' : 'fail',
      detail: leaked.length === 0
        ? '本轮日志与历史运行隔离'
        : `${leaked.length} 条事件早于本轮 broadcast:start（会话未滚动）`
    });
  }

  // 看门狗快照可读性：缺 lastAnswerChangeAgoMs 就无法区分「慢」与「卡死」
  if (watchdogs.length > 0) {
    const unreadable = watchdogs.filter(log => {
      const value = getDetails(log).lastAnswerChangeAgoMs;
      return value === null || value === undefined;
    });
    regressions.push({
      id: 'watchdog-dump-readable',
      status: unreadable.length === 0 ? 'pass' : 'fail',
      detail: unreadable.length === 0
        ? '看门狗快照含流式/卡死判读字段'
        : `${unreadable.length} 个看门狗快照缺 lastAnswerChangeAgoMs`
    });
  }

  return { regressions, realStalls, falsePositiveWatchdogs };
}

function getProviderId(log) {
  const details = getDetails(log);
  return details.panel?.providerId || details.sourceId || details.providerId || null;
}

function formatEvidence(log, extraKeys = []) {
  const details = getDetails(log);
  const parts = [log.event];
  const providerId = getProviderId(log);
  if (providerId) parts.push(`provider=${providerId}`);
  extraKeys.forEach(key => {
    const value = key.split('.').reduce((acc, segment) => acc?.[segment], details);
    if (value !== undefined && value !== null) {
      parts.push(`${key.split('.').pop()}=${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
  });
  return parts.join(' ');
}

function dedupeEvidence(entries) {
  const counts = new Map();
  entries.forEach(entry => counts.set(entry, (counts.get(entry) || 0) + 1));
  return Array.from(counts.entries())
    .slice(0, 5)
    .map(([entry, count]) => (count > 1 ? `${entry} ×${count}` : entry));
}

function buildFailure(rootCause, evidenceEntries) {
  const rule = VERDICT_ROOT_CAUSES[rootCause];
  return {
    status: 'failed',
    stage: rule.failedStage,
    code: rule.code,
    failedStage: rule.failedStage,
    rootCause,
    meaning: rule.meaning,
    suggestedChecks: rule.suggestedChecks,
    evidence: dedupeEvidence(evidenceEntries)
  };
}

const TRANSPORT_TIMEOUT_EVIDENCE_KEYS = ['transportProbe.status', 'transportProbe.readySeen', 'transportProbe.targetOrigin', 'transportProbe.expectedBuildId'];

export function buildDebugVerdict(logs, intent = null, sessionId = null, nowMs = Date.now()) {
  const all = Array.isArray(logs) ? logs : [];
  // 只分析本次会话：日志存储是滚动保留的（含历史会话的旧故障），
  // 不 scope 会把早已修复的历史问题误判为当前失败
  const list = sessionId
    ? all.filter(log => (log.sessionId || 'unknown') === sessionId)
    : all;

  // 规则 1：transport 层 —— content script 无响应（含 give-up 前的 timeout 证据）
  const transportTimeouts = list.filter(log =>
    log.event === 'panel-injection:timeout' &&
    (getDetails(log).transportProbe?.readySeen === false ||
      getDetails(log).transportProbe?.status === 'timeout')
  );
  if (transportTimeouts.length > 0) {
    return finalize(buildFailure(
      'provider-transport-timeout',
      transportTimeouts.map(log => formatEvidence(log, TRANSPORT_TIMEOUT_EVIDENCE_KEYS))
    ), intent, list);
  }

  // 规则 2：transport 层 —— provider 已进入提交流程，但结果消息没有回到面板
  const submitResultTimeouts = list.filter(log => log.event === 'panel-submit:timeout');
  if (submitResultTimeouts.length > 0) {
    return finalize(buildFailure(
      'submit-result-timeout',
      submitResultTimeouts.map(log => formatEvidence(log, ['stage', 'code', 'injectionRequestId']))
    ), intent, list);
  }

  // 规则 3：submit 层 —— 已填入但 provider 提交失败
  const submitFailures = list.filter(log =>
    log.event === 'text-injection:submit-failed' ||
    log.event === 'panel-submit:failed'
  );
  if (submitFailures.length > 0) {
    return finalize(buildFailure(
      'send-control-not-found',
      submitFailures.map(log => formatEvidence(log, ['stage', 'code', 'reason', 'error', 'injectionRequestId', 'sendControl.elementId', 'sendControl.className', 'sendControl.visible']))
    ), intent, list);
  }

  // 规则 4：inject 层 —— 写入后内容为空
  const verificationFailures = list.filter(log => log.event === 'text-injection:composer-verification-failed');
  if (verificationFailures.length > 0) {
    return finalize(buildFailure(
      'composer-verification-failed',
      verificationFailures.map(log => formatEvidence(log, ['matchedSelector', 'expectedLength', 'afterLength']))
    ), intent, list);
  }

  // 规则 5：inject 层 —— content script 明确报告找不到输入框/写入失败
  const injectionFailures = list.filter(log =>
    log.event === 'panel-injection:failed' || log.event === 'panel-injection:give-up'
  );
  if (injectionFailures.length > 0) {
    return finalize(buildFailure(
      'injection-rejected',
      injectionFailures.map(log => formatEvidence(log, ['inputFound', 'injectSuccess', 'recoveryAttempt']))
    ), intent, list);
  }

  // 规则 6：answer 层 —— completion 监控器看门狗（比 merge 超时更精确的现场快照）
  // 已完成面板的看门狗是误报（回归断言会单独标出），不参与判负
  const { realStalls: completionWatchdogs } = computeRegressions(list);
  if (completionWatchdogs.length > 0) {
    return finalize(buildFailure(
      'completion-not-detected',
      completionWatchdogs.map(log => formatEvidence(log, ['phase', 'sawStopButton', 'composerTextLen', 'stopSelectors', 'answerSelectors']))
    ), intent, list);
  }

  // 规则 7：answer 层 —— 等待回答超时
  const answerTimeouts = list.filter(log => log.event === 'merge-monitor:timeout');
  if (answerTimeouts.length > 0) {
    return finalize(buildFailure(
      'answer-timeout',
      answerTimeouts.map(log => formatEvidence(log, ['completedCount', 'totalCount', 'missingProviders']))
    ), intent, list);
  }

  // 未分类：有失败事件但不匹配任何已知规则
  // （看门狗误报不算——它由 watchdog-false-positive 回归断言单独表达）
  const { falsePositiveWatchdogs } = computeRegressions(list);
  // 良性超时：contain "timeout" but are normal fallback/detection paths,
  // not failures. appear-timeout = provider without stop button (doubao/yuanbao),
  // timeout-fallback = start-gate degraded (deepseek). Both complete normally.
  const BENIGN_TIMEOUTS = new Set([
    'completion-monitor:appear-timeout',
    'discussion-start-gate:timeout-fallback',
  ]);
  const otherIssues = list.filter(log =>
    /error|failed|timeout|no-answer|empty|give-up|missing|aborted/i.test(log.event || '') &&
    !BENIGN_TIMEOUTS.has(log.event) &&
    !falsePositiveWatchdogs.includes(log)
  );
  if (otherIssues.length > 0) {
    return finalize(buildFailure(
      'unclassified-failure',
      otherIssues.slice(-5).map(log => formatEvidence(log, ['reason', 'error']))
    ), intent, list);
  }

  // 没有失败终态时再判断 pending。pending 从 start/terminal 事件差集推导，
  // 不额外写轮询日志，避免短报告被重复状态淹没。
  const pendingRequests = derivePendingSendRequests(list, nowMs);
  if (pendingRequests.length > 0) {
    const mostAdvanced = pendingRequests.find(request => request.stage === SEND_LIFECYCLE_STAGES.TRANSPORT) ||
      pendingRequests.find(request => request.stage === SEND_LIFECYCLE_STAGES.SUBMIT) ||
      pendingRequests[0];
    return finalize({
      status: 'pending',
      stage: mostAdvanced.stage,
      code: mostAdvanced.code,
      failedStage: null,
      rootCause: null,
      meaning: `${pendingRequests.length} 个发送请求仍在等待终态`,
      suggestedChecks: ['等待请求完成后重新导出；若超过期限会转为明确的 timeout 错误'],
      evidence: pendingRequests.slice(0, 5)
    }, intent, list);
  }

  // 无失败事件：按测试意图核对预期结果
  if (intent?.expect === 'send-success') {
    const successCount = list.filter(log => log.event === 'panel-submit:success').length;
    if (successCount > 0) {
      return finalize({
        status: 'ok',
        stage: null,
        code: null,
        failedStage: null,
        rootCause: null,
        meaning: `发送链路正常，${successCount} 个面板提交已确认`,
        suggestedChecks: [],
        evidence: []
      }, intent, list);
    }
    const sendStarted = list.some(log => log.event === 'panel-send:start');
    return finalize(buildFailure(
      sendStarted ? 'send-incomplete' : 'no-send-activity',
      []
    ), intent, list);
  }

  return finalize({
    status: 'ok',
    stage: null,
    code: null,
    failedStage: null,
    rootCause: null,
    meaning: '没有发现失败事件',
    suggestedChecks: [],
    evidence: []
  }, intent, list);
}

function finalize(verdict, intent, logs) {
  const finalized = { ...verdict };
  if (intent && typeof intent === 'object') {
    finalized.intentChecked = true;
    if (intent.expect === 'send-success') {
      finalized.intentExpectationMet = verdict.status === 'ok'
        ? true
        : verdict.status === 'pending'
          ? null
          : false;
    } else {
      finalized.intentExpectationMet = null;
    }
  } else {
    finalized.intentChecked = false;
    finalized.intentExpectationMet = null;
  }
  finalized.logCount = logs.length;
  finalized.regressions = computeRegressions(logs).regressions;
  return finalized;
}
