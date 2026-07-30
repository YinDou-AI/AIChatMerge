// debug-log.js — 调试日志核心录制
// 分析工具函数见 debug-log-utils.js

import {
  buildDebugAiPayload,
  isDebugIssueEvent,
  getDebugLogDetails as _getDebugLogDetails
} from './debug-log-utils.js';
import { DEBUG_EXPORT_ENABLED, DEBUG_LOGGING_ENABLED } from './build-flags.js';

// Re-export all analysis functions for existing importers
export {
  getDebugLogDetails,
  compactDebugValue,
  compactDebugLog,
  isDebugIssueEvent,
  isDebugKeyEvent,
  buildDebugEventCounts,
  getDebugIssueSeverity,
  extractDebugIssues,
  summarizeDebugSessions,
  buildDebugAiPayload
} from './debug-log-utils.js';

const DEBUG_LOG_STORAGE_KEY = 'aichatmergeDebugLogs';
const DEBUG_LOG_MAX_ENTRIES = 800;
const DEBUG_AUTO_DOWNLOAD_DELAY_MS = 1500;
const DEBUG_AUTO_DOWNLOAD_MIN_INTERVAL_MS = 30000;

let debugSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let debugLogWriteQueue = Promise.resolve();
let debugAutoDownloadLogs = false;
let debugAutoDownloadTimerId = null;
let lastDebugAutoDownloadAt = 0;
const debugAutoDownloadedMilestones = new Set();
let discussionWillRun = false;

// 每次真实发送（broadcast autoSubmit）开启一个新的调试会话：
// 「会话」的语义是「一次运行」，否则上一轮的问题事件会污染本轮
// verdict——2026-07-21 实测：复跑全绿，verdict 却被两小时前的
// 看门狗事件判成 failed。里程碑去重与最小导出间隔同样按轮重置，
// 保证每轮都能拿到自己的导出
export function rotateDebugSession() {
  debugSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  debugAutoDownloadedMilestones.clear();
  lastDebugAutoDownloadAt = 0;
  return debugSessionId;
}

export function getDebugSessionId() {
  return debugSessionId;
}

export function getDebugLogWriteQueue() {
  return debugLogWriteQueue;
}

export function setMergePanelIds(ids) {
  if (!ids) return;
  globalThis.__debugMergePanelIds = ids;
}

export function setDiscussionWillRun(value) {
  discussionWillRun = value;
}

export function getPanelDebugInfo(panel) {
  const mergePanelIds = globalThis.__debugMergePanelIds;
  if (!panel) return null;
  return {
    panelId: panel.id,
    providerId: panel.providerId,
    isMergePanel: mergePanelIds ? mergePanelIds.has(panel.id) : false
  };
}

export function sanitizeDebugDetails(details = {}) {
  const safe = {};
  Object.entries(details || {}).forEach(([key, value]) => {
    if (typeof value === 'string') {
      safe[key] = value.length > 300 ? `${value.slice(0, 300)}…` : value;
    } else if (Array.isArray(value)) {
      safe[key] = value.slice(0, 30);
    } else if (value && typeof value === 'object') {
      safe[key] = JSON.parse(JSON.stringify(value));
    } else {
      safe[key] = value;
    }
  });
  return safe;
}

export async function recordDebugLog(event, details = {}) {
  if (!DEBUG_LOGGING_ENABLED) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  const entry = {
    ts: new Date().toISOString(),
    t: Math.round(performance.now()),
    sessionId: debugSessionId,
    event,
    details: sanitizeDebugDetails(details)
  };

  debugLogWriteQueue = debugLogWriteQueue
    .catch(() => {})
    .then(async () => {
      try {
        const result = await chrome.storage.local.get({ [DEBUG_LOG_STORAGE_KEY]: [] });
        const logs = Array.isArray(result[DEBUG_LOG_STORAGE_KEY])
          ? result[DEBUG_LOG_STORAGE_KEY]
          : [];
        logs.push(entry);
        const trimmed = logs.slice(-DEBUG_LOG_MAX_ENTRIES);
        await chrome.storage.local.set({ [DEBUG_LOG_STORAGE_KEY]: trimmed });
      } catch (error) {
        console.warn('[DebugLog] Failed to persist debug log:', error);
      }
    });

  scheduleAutoDebugLogDownload(event);
}

function shouldAutoDownloadDebugLog(event) {
  // 正式版打包时 DEBUG_EXPORT_ENABLED 被改写为 false，日志永不自动导出
  if (!DEBUG_EXPORT_ENABLED) return false;
  if (!event) return false;
  // 融合完成（融合面板的回答生成完毕）即导出；但讨论模式下融合只是中间
  // 步骤，讨论结束的导出已包含完整会话日志，中间这份跳过
  if (event === 'merge-panel:completion-detected') return !discussionWillRun;
  // 讨论结束即导出
  if (event === 'discussion:completed') return true;
  if (event === 'markdown-export:auto-success') return true;
  if (event === 'discussion-final-answer-auto-success') return true;
  if (event === 'discussion-final-answer:auto-success') return true;
  // 发送链路失败也自动导出：自动化巡检跑完就能拿到带 verdict 的报告，
  // 不需要人工再点导出按钮。但讨论模式下不做失败即时导出——讨论结束的
  // 导出已包含这些失败事件，中途再导一份会让一次运行出两份日志
  if (event === 'panel-injection:give-up') return !discussionWillRun;
  if (event === 'text-injection:submit-failed') return !discussionWillRun;
  if (event === 'text-injection:composer-verification-failed') return !discussionWillRun;
  return false;
}

function scheduleAutoDebugLogDownload(event) {
  if (!debugAutoDownloadLogs || !shouldAutoDownloadDebugLog(event)) {
    return;
  }

  const now = Date.now();
  // 按里程碑去重：同一会话内「融合完成」和「讨论结束」各导出一次，
  // 同一事件重复触发（如讨论多轮融合）只导第一次
  const milestone = `${debugSessionId}:${event}`;
  if (debugAutoDownloadedMilestones.has(milestone)) {
    return;
  }

  if (now - lastDebugAutoDownloadAt < DEBUG_AUTO_DOWNLOAD_MIN_INTERVAL_MS) {
    return;
  }

  clearTimeout(debugAutoDownloadTimerId);
  debugAutoDownloadTimerId = setTimeout(() => {
    if (!shouldAutoDownloadDebugLog(event) || debugAutoDownloadedMilestones.has(milestone)) {
      return;
    }
    lastDebugAutoDownloadAt = Date.now();
    debugAutoDownloadedMilestones.add(milestone);
    downloadDebugLogs({ silent: true }).catch((error) => {
      console.warn('[DebugLog] Auto download failed:', error);
      debugAutoDownloadedMilestones.delete(milestone);
    });
  }, DEBUG_AUTO_DOWNLOAD_DELAY_MS);
}

function showDebugToast(showToast, message) {
  if (typeof showToast === 'function') showToast(message);
}

function downloadDebugPayload(payload, fileName) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
      chrome.downloads.download({
        url,
        filename: fileName,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        const error = chrome.runtime?.lastError;
        cleanup();
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve({ downloadId });
      });
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    cleanup();
    resolve({ downloadId: null });
  });
}

export async function downloadDebugLogs(tOrOptions, showToast) {
  if (!DEBUG_EXPORT_ENABLED || !DEBUG_LOGGING_ENABLED) return;
  const options = typeof tOrOptions === 'object' && tOrOptions !== null ? tOrOptions : {};
  const silent = options.silent === true;
  const t = typeof tOrOptions === 'function' ? tOrOptions : ((key) => key);
  try {
    await debugLogWriteQueue.catch(() => {});
    const result = await chrome.storage.local.get({ [DEBUG_LOG_STORAGE_KEY]: [] });
    const logs = Array.isArray(result[DEBUG_LOG_STORAGE_KEY])
      ? result[DEBUG_LOG_STORAGE_KEY]
      : [];
    // 自动导出（silent）只带当前会话日志：每份报告聚焦本次运行，AI 读起来
    // 没有历史噪声；手动点导出按钮仍是全量历史，便于跨会话排查
    const exportLogs = silent ? logs.filter(log => log.sessionId === debugSessionId) : logs;
    if (exportLogs.length === 0) {
      if (!silent) showDebugToast(showToast, t('debugLogsEmpty'));
      return;
    }

    const intent = await loadTestIntent();
    const payload = buildDebugAiPayload(exportLogs, debugSessionId, intent);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await downloadDebugPayload(payload, `aichatmerge-debug-${stamp}.json`);
    if (intent) clearTestIntent();
    if (!silent) showDebugToast(showToast, t('debugLogsDownloaded'));
  } catch (error) {
    console.warn('[DebugLog] Failed to download debug logs:', error);
    if (!silent) showDebugToast(showToast, t('errorOccurred'));
  }
}

export async function clearDebugLogs(showMessage) {
  if (!DEBUG_LOGGING_ENABLED) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [DEBUG_LOG_STORAGE_KEY]: [] });
  if (showMessage) showMessage('Debug logs cleared');
}

// 自动化巡检的测试意图：驱动脚本在发送前写入 chrome.storage.local，
// 导出时随报告一并带出（verdict 据此核对预期结果），导出后即清除
const TEST_INTENT_STORAGE_KEY = 'aichatmergeTestIntent';

async function loadTestIntent() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
  try {
    const result = await chrome.storage.local.get({ [TEST_INTENT_STORAGE_KEY]: null });
    const intent = result[TEST_INTENT_STORAGE_KEY];
    return intent && typeof intent === 'object' ? intent : null;
  } catch {
    return null;
  }
}

function clearTestIntent() {
  try {
    chrome.storage?.local?.remove?.(TEST_INTENT_STORAGE_KEY);
  } catch { /* ignore */ }
}

async function loadDebugAutoDownloadSetting() {
  if (!DEBUG_LOGGING_ENABLED || !DEBUG_EXPORT_ENABLED) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;
  try {
    // 调试版默认开启自动导出（正式版被 DEBUG_EXPORT_ENABLED 闸死，此默认值无效）；
    // 用户仍可在设置页手动关掉
    const settings = await chrome.storage.sync.get({ debugAutoDownloadLogs: DEBUG_EXPORT_ENABLED });
    debugAutoDownloadLogs = settings.debugAutoDownloadLogs === true;
  } catch {
    debugAutoDownloadLogs = false;
  }
}

function registerDebugAutoDownloadSettingListener() {
  if (!DEBUG_LOGGING_ENABLED || !DEBUG_EXPORT_ENABLED) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged?.addListener) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === 'sync' || area === 'local') && changes.debugAutoDownloadLogs) {
      debugAutoDownloadLogs = changes.debugAutoDownloadLogs.newValue === true;
    }
  });
}

loadDebugAutoDownloadSetting();
registerDebugAutoDownloadSettingListener();
