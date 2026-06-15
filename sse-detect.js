// sse-detect.js — MAIN world脚本，hook fetch检测SSE流结束
// 通过 <script> 标签注入到AI页面的MAIN world
// 检测到SSE流结束后 postMessage 通知 content script
(function () {
  'use strict';

  // 防止重复hook
  if (window.__sse_detect_hooked__) return;
  window.__sse_detect_hooked__ = true;

  // ===== 平台SSE URL配置 =====
  const SSE_PATTERNS = {
    deepseek:    ['/api/v0/chat/completion'],
    doubao:      ['/chat/completion'],
    qianwen:     ['/api/v2/chat'],
    yuanbao:     ['/api/chat/'],
    wenxin:      ['/eb/chat/conversation'],
    zhipu:       ['/api/paas/v4/chat/completions'],
    kimi:        ['/api/chat/completions'],
    chatgpt:     ['/backend-api/conversation'],
    claude:      ['/api/chat'],
    gemini:      [],  // 待验证，先走DOM兜底
    grok:        [],  // 待验证，先走DOM兜底
    metaso:      []   // 待验证，先走DOM兜底
  };

  // ===== SSE响应判定 =====
  function isSSEResponse(requestInfo, response) {
    // 条件1: Content-Type 包含 text/event-stream
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) return true;

    // 条件2: URL匹配平台SSE pattern
    const url = typeof requestInfo === 'string' ? requestInfo
      : requestInfo?.url || '';
    for (const patterns of Object.values(SSE_PATTERNS)) {
      for (const pattern of patterns) {
        if (url.includes(pattern)) return true;
      }
    }

    // 条件3: Accept header 包含 text/event-stream
    const accept = requestInfo?.headers?.get?.('accept') || '';
    if (accept.includes('text/event-stream')) return true;

    return false;
  }

  // ===== 发送完成信号 =====
  function emitComplete(url) {
    window.postMessage({
      type: '__sse_complete__',
      url: url || '',
      timestamp: Date.now()
    }, '*');
  }

  // ===== Hook fetch =====
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      if (response && response.body && isSSEResponse(args[0], response)) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        console.log('[SSE Detect] Detected SSE response:', url);

        // 需要clone响应，因为原始Response的body只能被读取一次
        // 我们返回克隆体给页面，自己读原始体
        const clonedResponse = response.clone();
        const originalReader = response.body.getReader();

        // 在后台读取原始流，检测结束
        (async () => {
          try {
            while (true) {
              const { done } = await originalReader.read();
              if (done) {
                console.log('[SSE Detect] SSE stream ended:', url);
                emitComplete(url);
                break;
              }
            }
          } catch (err) {
            console.warn('[SSE Detect] Stream read error:', err);
          }
        })();

        // 返回克隆的响应给页面（页面无感知）
        return clonedResponse;
      }
    } catch (err) {
      console.warn('[SSE Detect] Hook error:', err);
    }

    return response;
  };

  // ===== Hook EventSource（处理使用原生EventSource的平台） =====
  const OriginalEventSource = window.EventSource;
  if (OriginalEventSource) {
    window.EventSource = function (url, config) {
      const es = new OriginalEventSource(url, config);
      console.log('[SSE Detect] EventSource created:', url);

      es.addEventListener('open', () => {
        console.log('[SSE Detect] EventSource opened:', url);
      });

      es.addEventListener('error', () => {
        // EventSource在流结束时会触发error事件（readyState变为CLOSED）
        if (es.readyState === OriginalEventSource.CLOSED) {
          console.log('[SSE Detect] EventSource closed (stream ended):', url);
          emitComplete(url);
        }
      });

      return es;
    };
    window.EventSource.prototype = OriginalEventSource.prototype;
    window.EventSource.CONNECTING = OriginalEventSource.CONNECTING;
    window.EventSource.OPEN = OriginalEventSource.OPEN;
    window.EventSource.CLOSED = OriginalEventSource.CLOSED;
  }

  console.log('[SSE Detect] Hook installed successfully');
})();
