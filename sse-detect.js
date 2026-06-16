// sse-detect.js — MAIN world脚本，hook fetch检测SSE流结束
// 通过 manifest.json world:"MAIN" 注入，保证早于页面JS执行
// 检测到SSE流结束后 postMessage 通知 content script
(function () {
  'use strict';

  // 防止重复hook
  if (window.__sse_detect_hooked__) return;
  window.__sse_detect_hooked__ = true;

  // ===== 平台检测（从hostname推断provider） =====
  function detectProvider() {
    const host = location.hostname;
    if (host.includes('deepseek')) return 'deepseek';
    if (host.includes('doubao')) return 'doubao';
    if (host.includes('qianwen')) return 'qianwen';
    if (host.includes('yuanbao') || host.includes('tencent.com') && host.includes('yuanbao')) return 'yuanbao';
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

  // ===== 平台SSE URL配置 =====
  const SSE_PATTERNS = {
    deepseek:    ['/api/v0/chat/completion', '/api/chat/completions'],
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

  // ===== 平台完成信号配置 =====
  // doneKeywords: SSE 行中包含这些字符串即判定完成
  // jsonCheck: 可选，对 data: 行的 JSON 做字段级检测
  const PLATFORM_DONE_CONFIG = {
    deepseek: {
      doneKeywords: ['event: close', '"FINISHED"'],
      jsonCheck: (obj) => obj.status === 'FINISHED'
    },
    doubao: {
      doneKeywords: ['SSE_REPLY_END', '[DONE]'],
      jsonCheck: (obj) => obj.end_type === 1 || obj.event === 'SSE_REPLY_END'
    },
    qianwen: {
      doneKeywords: ['event:complete', '[DONE]']
    },
    yuanbao: {
      doneKeywords: ['[DONE]']
    },
    wenxin: {
      doneKeywords: ['[DONE]'],
      jsonCheck: (obj) => obj.is_end === 1
    },
    zhipu: {
      doneKeywords: ['[DONE]']
    },
    kimi: {
      doneKeywords: ['[DONE]']
    },
    chatgpt: {
      doneKeywords: ['[DONE]']
    },
    claude: {
      doneKeywords: ['event: message_stop', 'event: done', '[DONE]']
    },
    gemini: { doneKeywords: [] },
    grok: { doneKeywords: [] },
    metaso: { doneKeywords: [] }
  };

  // ===== SSE响应判定 =====
  function isSSEResponse(requestInfo, response) {
    // 条件1: Content-Type 包含 text/event-stream（最可靠）
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      console.log('[SSE Detect] Content-Type match:', contentType);
      return true;
    }

    // 条件2: URL匹配平台SSE pattern
    const url = typeof requestInfo === 'string' ? requestInfo
      : requestInfo?.url || '';
    for (const patterns of Object.values(SSE_PATTERNS)) {
      for (const pattern of patterns) {
        if (url.includes(pattern)) {
          console.log('[SSE Detect] URL pattern match:', pattern, 'in', url);
          return true;
        }
      }
    }

    // 条件3: Accept header 包含 text/event-stream
    const accept = requestInfo?.headers?.get?.('accept') || '';
    if (accept.includes('text/event-stream')) {
      console.log('[SSE Detect] Accept header match:', accept);
      return true;
    }

    return false;
  }

  // ===== 发送完成信号（带provider标识） =====
  function emitComplete(url, layer) {
    const provider = detectProvider();
    console.log('[SSE Detect] Emitting completion for provider:', provider, 'layer:', layer, 'url:', url);
    window.postMessage({
      type: '__sse_complete__',
      provider: provider,
      url: url || '',
      layer: layer || 'transport',
      timestamp: Date.now()
    }, location.origin);
  }

  // ===== SSE 行级解析 =====
  function parseSSELine(line, providerConfig) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // 关键字匹配（event: close, SSE_REPLY_END, [DONE] 等）
    for (const kw of providerConfig.doneKeywords) {
      if (trimmed.includes(kw)) return true;
    }

    // JSON 字段检测（data: {...} 行）
    if (providerConfig.jsonCheck && trimmed.startsWith('data:')) {
      try {
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr !== '[DONE]') {
          const obj = JSON.parse(jsonStr);
          if (providerConfig.jsonCheck(obj)) return true;
        }
      } catch (_) {}
    }

    return false;
  }

  // ===== Hook fetch =====
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      if (response && response.body && isSSEResponse(args[0], response)) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const provider = detectProvider();
        const config = PLATFORM_DONE_CONFIG[provider];
        console.log('[SSE Detect] Detected SSE response:', url, 'provider:', provider);

        const originalReader = response.body.getReader();
        const decoder = new TextDecoder();
        let detected = false;
        let buffer = '';

        const wrappedStream = new ReadableStream({
          async pull(controller) {
            const { done, value } = await originalReader.read();
            if (done) {
              // Layer 2: 传输层兜底 — 流结束时如果内容层未检测到，触发完成
              if (!detected) {
                detected = true;
                console.log('[SSE Detect] Stream ended (Layer 2 - transport):', url);
                emitComplete(url, 'transport');
              }
              controller.close();
              return;
            }

            controller.enqueue(value);

            // Layer 1: 内容解析 — 逐行匹配平台完成信号
            if (!detected && config && config.doneKeywords.length > 0) {
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop(); // 保留未完成的最后一行

              for (const line of lines) {
                if (parseSSELine(line, config)) {
                  detected = true;
                  console.log('[SSE Detect] Content-layer completion detected (Layer 1):', url, 'line:', line.trim());
                  emitComplete(url, 'content');
                  break;
                }
              }
            }
          }
        });

        return new Response(wrappedStream, { headers: response.headers });
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
    Object.defineProperty(window.EventSource.prototype, 'constructor', {
      value: window.EventSource,
      writable: true,
      configurable: true
    });
    window.EventSource.CONNECTING = OriginalEventSource.CONNECTING;
    window.EventSource.OPEN = OriginalEventSource.OPEN;
    window.EventSource.CLOSED = OriginalEventSource.CLOSED;
  }

  console.log('[SSE Detect] Hook installed successfully');
})();
