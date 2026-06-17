// sse-bridge.js — Content script (isolated world)
// 职责：桥接SSE完成消息到parent（sse-detect.js由manifest world:"MAIN"注入）
(function () {
  'use strict';

  // 防止重复注入
  if (window.__sse_bridge_loaded__) return;
  window.__sse_bridge_loaded__ = true;

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

    // 优先使用sse-detect.js提供的provider，否则从hostname推断
    const provider = event.data.provider || detectCurrentProvider();
    if (provider === 'unknown') {
      console.warn('[SSE Bridge] Unknown provider, ignoring SSE completion');
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
          context: 'multi-panel-completion'
        }, '*');
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
