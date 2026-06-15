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
      const scriptUrl = chrome.runtime.getURL('sse-detect.js');
      console.log('[SSE Bridge] Injecting sse-detect.js from:', scriptUrl);
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.onload = function () {
        console.log('[SSE Bridge] sse-detect.js loaded successfully');
        this.remove();
      };
      script.onerror = function (e) {
        console.error('[SSE Bridge] sse-detect.js failed to load:', e);
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {
      console.warn('[SSE Bridge] Failed to inject sse-detect.js:', err);
    }
  }

  // ===== 平台检测（从hostname推断） =====
  function detectCurrentProvider() {
    const host = window.location.hostname;
    if (host === 'chat.deepseek.com' || host.endsWith('.deepseek.com')) return 'deepseek';
    if (host === 'www.doubao.com' || host === 'doubao.com' || host.endsWith('.doubao.com')) return 'doubao';
    if (host === 'www.qianwen.com' || host === 'qianwen.com' || host.endsWith('.qianwen.com')) return 'qianwen';
    if (host.endsWith('.tencent.com') && host.includes('yuanbao')) return 'yuanbao';
    if (host.endsWith('.baidu.com') && host.includes('yiyan')) return 'wenxin';
    if (host === 'chatglm.cn' || host.endsWith('.chatglm.cn')) return 'zhipu';
    if (host === 'kimi.com' || host === 'www.kimi.com' || host.endsWith('.kimi.com') || host.endsWith('.moonshot.cn')) return 'kimi';
    if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) return 'chatgpt';
    if (host === 'claude.ai' || host.endsWith('.claude.ai')) return 'claude';
    if (host === 'gemini.google.com' || host.endsWith('.gemini.google.com')) return 'gemini';
    if (host === 'grok.com' || host.endsWith('.grok.com')) return 'grok';
    if (host === 'metaso.cn' || host.endsWith('.metaso.cn')) return 'metaso';
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
