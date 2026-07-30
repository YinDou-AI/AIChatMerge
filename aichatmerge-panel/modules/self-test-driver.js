// self-test-driver.js — 面板内自驱动巡检（仅调试版）
// WebBridge 等外部浏览器桥无法访问其他扩展的 chrome-extension:// 页面，
// 所以自动化巡检的"驱动"放在面板内部：用带 hash 的 URL 打开面板即可触发。
//
//   chrome-extension://<id>/aichatmerge-panel/multi-panel.html
//     #selftest=1&prompt=<encodeURIComponent>&sendDelay=20000&exportDelay=30000
//
// 流程：等 sendDelay → 填 #unified-input → 点 #send-all-btn → 等 exportDelay
// → 静默导出 debug 日志。发送链路失败时失败事件会提前触发自动导出。
// 正式发布隔离时本模块随 debug 模块一并移除。

import { recordDebugLog, downloadDebugLogs } from './debug-log.js';

const DEFAULT_SEND_DELAY_MS = 20000;
const DEFAULT_EXPORT_DELAY_MS = 30000;

function parseSelfTestHash() {
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  if (params.get('selftest') !== '1') return null;
  return {
    prompt: params.get('prompt') || '用一句话回答：1+1等于几？',
    sendDelay: Number(params.get('sendDelay')) || DEFAULT_SEND_DELAY_MS,
    exportDelay: Number(params.get('exportDelay')) || DEFAULT_EXPORT_DELAY_MS
  };
}

function disarmSelfTestHash() {
  // 触发后立刻清掉 hash 并打 sessionStorage 标记，防止面板刷新时重复执行
  try {
    window.sessionStorage.setItem('aichatmergeSelfTestRan', '1');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch { /* ignore */ }
}

export function maybeRunSelfTest() {
  if (typeof window === 'undefined') return false;
  let config = null;
  try {
    if (window.sessionStorage.getItem('aichatmergeSelfTestRan') === '1') return false;
  } catch { /* ignore */ }
  config = parseSelfTestHash();
  if (!config) return false;

  disarmSelfTestHash();

  const intent = {
    id: `self-test-${Date.now()}`,
    expect: 'send-success',
    prompt: config.prompt,
    createdAt: new Date().toISOString()
  };

  recordDebugLog('self-test:start', {
    promptLength: config.prompt.length,
    sendDelay: config.sendDelay,
    exportDelay: config.exportDelay
  });

  // 开启失败自动导出 + 写入测试意图（随导出报告带出，导出后自动清除）
  try {
    chrome.storage?.sync?.set?.({ debugAutoDownloadLogs: true });
    chrome.storage?.local?.set?.({ aichatmergeTestIntent: intent });
  } catch { /* ignore */ }

  setTimeout(() => {
    const input = document.getElementById('unified-input');
    const sendBtn = document.getElementById('send-all-btn');
    if (!input || !sendBtn) {
      recordDebugLog('self-test:failed', { reason: 'composer-or-send-button-missing' });
      return;
    }
    input.value = config.prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    recordDebugLog('self-test:sending', { promptLength: config.prompt.length });
    sendBtn.click();

    setTimeout(() => {
      recordDebugLog('self-test:exporting', {});
      downloadDebugLogs({ silent: true }).catch(error => {
        console.warn('[SelfTest] export failed:', error);
      });
    }, config.exportDelay);
  }, config.sendDelay);

  return true;
}
