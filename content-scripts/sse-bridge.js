// sse-bridge.js — Content script (isolated world)
// 职责：1) 注入sse-detect.js到MAIN world  2) 桥接SSE完成消息到parent
(function () {
  'use strict';

  // 防止重复注入
  if (window.__sse_bridge_loaded__) return;
  window.__sse_bridge_loaded__ = true;

  // ===== 注入MAIN world脚本 =====
  function injectSSEDetect() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('sse-detect.js');
      script.onload = function () { this.remove(); };
      (document.head || document.documentElement).appendChild(script);
      console.log('[SSE Bridge] sse-detect.js injected into MAIN world');
    } catch (err) {
      console.warn('[SSE Bridge] Failed to inject sse-detect.js:', err);
    }
  }

  // ===== 平台检测（从hostname推断） =====
  function detectCurrentProvider() {
    const host = window.location.hostname;
    if (host.includes('deepseek')) return 'deepseek';
    if (host.includes('doubao')) return 'doubao';
    if (host.includes('qianwen')) return 'qianwen';
    if (host.includes('yuanbao')) return 'yuanbao';
    if (host.includes('yiyan')) return 'wenxin';
    if (host.includes('chatglm')) return 'zhipu';
    if (host.includes('kimi')) return 'kimi';
    if (host.includes('chatgpt')) return 'chatgpt';
    if (host.includes('claude')) return 'claude';
    if (host.includes('gemini')) return 'gemini';
    if (host.includes('grok')) return 'grok';
    if (host.includes('metaso')) return 'metaso';
    return 'unknown';
  }

  // ===== 监听SSE完成消息，转发到parent（multi-panel） =====
  window.addEventListener('message', (event) => {
    // 只处理来自同源的message（安全考虑）
    if (event.source !== window) return;
    if (!event.data || event.data.type !== '__sse_complete__') return;

    const provider = detectCurrentProvider();
    if (provider === 'unknown') {
      console.warn('[SSE Bridge] Unknown provider, ignoring SSE completion');
      return;
    }

    console.log('[SSE Bridge] SSE completion detected for:', provider);

    // 转发到parent（multi-panel.js会处理）
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'COMPLETION_DETECTED',
        provider: provider,
        context: 'multi-panel-completion'
      }, '*');
    }
  });

  // 启动
  injectSSEDetect();
})();
