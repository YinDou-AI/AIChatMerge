// sse-bridge.js — Content script (isolated world)
// 职责：1) 注入 sse-detect.js 到 MAIN world  2) 桥接SSE完成消息到parent
(function () {
  'use strict';

  // 防止重复注入
  if (window.__sse_bridge_loaded__) return;
  window.__sse_bridge_loaded__ = true;

  var extensionOrigin = null;
  var activeMergeSessionId = null;
  try {
    var extensionUrl = new URL(chrome.runtime.getURL('/'));
    extensionOrigin = extensionUrl.origin === 'null'
      ? extensionUrl.protocol + '//' + extensionUrl.host
      : extensionUrl.origin;
  } catch (e) {
    console.warn('[SSE Bridge] Unable to determine extension origin:', e);
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || event.origin !== extensionOrigin) return;
    if (!event.data || event.data.context !== 'multi-panel') return;

    if (event.data.type === 'MONITOR_COMPLETION') {
      activeMergeSessionId = event.data.mergeSessionId || null;
      return;
    }

    if (event.data.type === 'STOP_MONITORING') {
      activeMergeSessionId = null;
      return;
    }

    if (event.data.type === 'INJECT_TEXT') {
      activeMergeSessionId = event.data.mergeSessionId || null;
    }
  });

  // ===== 注入 sse-detect.js 到 MAIN world =====
  // manifest world:"MAIN" 在某些 Chrome 版本/环境下不生效，
  // 改用 script 标签注入确保 sse-detect.js 在页面 JS 上下文运行
  try {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('sse-detect.js');
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[SSE Bridge] Failed to inject sse-detect.js:', e);
  }

  // ===== 平台检测（使用 ProviderDetector，作为sse-detect.js的provider字段的后备） =====
  function detectCurrentProvider() {
    if (window.ProviderDetector) {
      return window.ProviderDetector.detectSimple() || 'unknown';
    }
    // 回退方案（如果 ProviderDetector 未加载）
    console.warn('[SSE Bridge] ProviderDetector not loaded, using fallback detection');
    return 'unknown';
  }

  function acceptsSseCompletion(provider, layer) {
    return window.ACM_SSE_COMPLETION_POLICY?.accepts(provider, layer) === true;
  }

  // ===== 监听SSE完成消息，转发到parent（multi-panel） =====
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== '__sse_complete__') return;
    if (!activeMergeSessionId) return;

    // 优先使用sse-detect.js提供的provider，否则从hostname推断
    const provider = event.data.provider || detectCurrentProvider();
    if (provider === 'unknown') {
      console.warn('[SSE Bridge] Unknown provider, ignoring SSE completion');
      return;
    }

    if (!acceptsSseCompletion(provider, event.data.layer)) {
      return;
    }

    const realParent = window.__realParent__ || window.parent;

    if (realParent !== window) {
      try {
        realParent.postMessage({
          type: 'COMPLETION_DETECTED',
          provider: provider,
          mergeSessionId: activeMergeSessionId,
          context: 'multi-panel-completion'
        }, extensionOrigin);
      } catch (err) {
        console.error('[SSE Bridge] postMessage FAILED:', err);
      }
    } else {
      console.warn('[SSE Bridge] realParent === window, cannot send to parent');
    }
  });

})();
