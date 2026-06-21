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
    if (event.data && event.data.type === 'INJECT_TEXT' && event.data.context === 'multi-panel') {
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

  // ===== 平台检测（从hostname推断，作为sse-detect.js的provider字段的后备） =====
  function detectCurrentProvider() {
    const host = window.location.hostname;
    if (host.includes('deepseek')) return 'deepseek';
    if (host.includes('doubao')) return 'doubao';
    if (host.includes('qianwen')) return 'qianwen';
    if (host.includes('yuanbao') || (host.includes('tencent') && host.includes('yuanbao'))) return 'yuanbao';
    if (host.includes('yiyan') || host.includes('wenxin')) return 'wenxin';
    if (host.includes('chatglm')) return 'zhipu';
    if (host.includes('kimi') || host.includes('moonshot')) return 'kimi';
    if (host.includes('chatgpt')) return 'chatgpt';
    if (host.includes('claude')) return 'claude';
    if (host.includes('gemini')) return 'gemini';
    if (host.includes('grok')) return 'grok';
    if (host.includes('metaso')) return 'metaso';
    return 'unknown';
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

    // Wenxin emits several SSE sub-streams for one visible response. A closed
    // sub-stream is not enough to prove that the answer has finished.
    if (provider === 'wenxin' || provider === 'zhipu') {
      console.log('[SSE Bridge] Ignoring', provider, 'SSE completion; waiting for DOM confirmation');
      return;
    }

    const realParent = window.__realParent__ || window.parent;
    console.log('[SSE Bridge] SSE completion detected for:', provider);

    if (realParent !== window) {
      console.log('[SSE Bridge] Sending COMPLETION_DETECTED to parent for provider:', provider);
      try {
        realParent.postMessage({
          type: 'COMPLETION_DETECTED',
          provider: provider,
          mergeSessionId: activeMergeSessionId,
          context: 'multi-panel-completion'
        }, extensionOrigin);
        console.log('[SSE Bridge] postMessage sent for:', provider);
      } catch (err) {
        console.error('[SSE Bridge] postMessage FAILED:', err);
      }
    } else {
      console.warn('[SSE Bridge] realParent === window, cannot send to parent');
    }
  });

  console.log('[SSE Bridge] Loaded (sse-detect.js injected by manifest)');
})();
