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
    if (host.includes('yuanbao')) return 'yuanbao';
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
    gemini:      ['_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate'],
    grok:        ['/rest/app-chat/conversations/'],
    metaso:      ['/api/search/chat']
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

  // ===== 平台文本解析配置 =====
  // parseLine: 从 SSE 行中提取文本内容
  // 返回 { text, isThink, done } 或 null
  const PLATFORM_TEXT_CONFIG = {
    deepseek: {
      urlPattern: '/api/v0/chat/completion',
      parseLine: (function() {
        let currentIsThink = false;
        var fn = function(line) {
          if (line === 'event: close') {
            currentIsThink = false;
            return { text: '', isThink: null, done: true };
          }
          if (!line.startsWith('data: ')) return null;
          var json = line.substring(6).trim();
          if (!json || json === '[DONE]') return null;
          try {
            var d = JSON.parse(json);
            // 完成信号
            if (d.p === 'response/status' && d.o === 'SET' && d.v === 'FINISHED') {
              currentIsThink = false;
              return { text: '', isThink: null, done: true };
            }
            var text = '';
            var hasOutput = false;
            // 片段初始化
            if (d.v && d.v.response && d.v.response.fragments) {
              for (var _i = 0; _i < d.v.response.fragments.length; _i++) {
                var fr = d.v.response.fragments[_i];
                if (fr.content && fr.type !== 'SEARCH') {
                  text += fr.content;
                  currentIsThink = fr.type === 'THINK';
                  hasOutput = true;
                }
              }
            }
            // 增量追加
            if (d.p === 'response/fragments/-1/content' && d.v != null) {
              text = typeof d.v === 'string' ? d.v : String(d.v);
              hasOutput = text.length > 0;
            }
            // 直接字符串
            if (typeof d.v === 'string' && !d.p && !text) {
              text = d.v;
              hasOutput = text.length > 0;
            }
            // API 模式
            if (d.choices && d.choices[0] && d.choices[0].delta) {
              if (d.choices[0].delta.reasoning_content != null) {
                text = String(d.choices[0].delta.reasoning_content);
                currentIsThink = true;
                hasOutput = true;
              } else if (d.choices[0].delta.content != null) {
                text = String(d.choices[0].delta.content);
                currentIsThink = false;
                hasOutput = true;
              }
            }
            if (!hasOutput || !text) return null;
            return { text: text, isThink: currentIsThink, done: false };
          } catch (e) { return null; }
        };
        fn.reset = function() { currentIsThink = false; };
        return fn;
      })()
    },
    doubao: {
      urlPattern: '/chat/completion',
      parseLine: (function() {
        var hasStartedFormalAnswer = false;
        var fn = function(line) {
          if (!line.startsWith('data: ')) return null;
          var json = line.substring(6).trim();
          if (!json || json === '[DONE]') {
            hasStartedFormalAnswer = false;
            return { text: '', isThink: null, done: true };
          }
          try {
            var d = JSON.parse(json);
            if (d.event === 'SSE_REPLY_END' || d.end_type === 1) {
              hasStartedFormalAnswer = false;
              return { text: '', isThink: null, done: true };
            }
            var ops = d.patch_op || [];
            if (Array.isArray(ops)) {
              var formalText;
              for (var _i = 0; _i < ops.length; _i++) {
                var op = ops[_i];
                if (op.patch_object === 111 && op.patch_value && typeof op.patch_value.tts_content === 'string') {
                  formalText = op.patch_value.tts_content;
                  break;
                }
              }
              if (formalText) {
                hasStartedFormalAnswer = true;
                return { text: formalText, isThink: false, done: false };
              }
              if (hasStartedFormalAnswer) return null;
              for (var _j = 0; _j < ops.length; _j++) {
                var op2 = ops[_j];
                var txt;
                if (op2.patch_value && op2.patch_value.content_block && Array.isArray(op2.patch_value.content_block)) {
                  for (var _k = 0; _k < op2.patch_value.content_block.length; _k++) {
                    var cb = op2.patch_value.content_block[_k];
                    if (cb.content && cb.content.text_block && cb.content.text_block.text) { txt = cb.content.text_block.text; break; }
                    if (cb.content && cb.content.thinking_block && cb.content.thinking_block.text) { txt = cb.content.thinking_block.text; break; }
                  }
                }
                if (!txt && op2.patch_value && typeof op2.patch_value.tts_content === 'string') txt = op2.patch_value.tts_content;
                if (!txt && typeof op2.patch_value === 'string') txt = op2.patch_value;
                if (txt) return { text: txt, isThink: true, done: false };
              }
            }
            if (hasStartedFormalAnswer) return null;
            var text;
            if (typeof d.text === 'string') text = d.text;
            else if (typeof d.thinking_text === 'string') text = d.thinking_text;
            else if (typeof d.content === 'string') text = d.content;
            if (text) return { text: text, isThink: true, done: false };
            return null;
          } catch (e) { hasStartedFormalAnswer = false; return null; }
        };
        fn.reset = function() { hasStartedFormalAnswer = false; };
        return fn;
      })()
    },
    qianwen: {
      urlPattern: '/api/v2/chat',
      parseLine: (function() {
        var prevContent = '';
        var prevThink = '';
        function doReset() { prevContent = ''; prevThink = ''; }
        var fn = function(line) {
          line = line.trim();
          if (!line) return null;
          if (line === 'event:complete') { doReset(); return { text: '', isThink: null, done: true }; }
          if (!line.startsWith('data: ')) return null;
          var json = line.substring(6).trim();
          if (!json) return null;
          try {
            var d = JSON.parse(json);
            if (d.error_code && d.error_code !== 0) return null;
            var msgArr = d.data && Array.isArray(d.data.messages) ? d.data.messages : null;
            if (!msgArr || msgArr.length === 0) return null;
            var targetMsg = null;
            for (var _i = msgArr.length - 1; _i >= 0; _i--) {
              if (msgArr[_i] && msgArr[_i].mime_type === 'multi_load/iframe') { targetMsg = msgArr[_i]; break; }
            }
            if (!targetMsg) return null;
            if (targetMsg.meta_data && targetMsg.meta_data.first_packet) { doReset(); }
            // 思考内容
            var thinkContent = null;
            if (targetMsg.meta_data && Array.isArray(targetMsg.meta_data.multi_load)) {
              for (var _j = 0; _j < targetMsg.meta_data.multi_load.length; _j++) {
                var item = targetMsg.meta_data.multi_load[_j];
                if (item && item.type === 'deep_think' && item.content) {
                  thinkContent = item.content.think_content || '';
                  break;
                }
              }
            }
            if (thinkContent !== null && thinkContent.length > prevThink.length) {
              var delta = thinkContent.substring(prevThink.length);
              prevThink = thinkContent;
              if (delta) return { text: delta, isThink: true, done: false };
            }
            // 正式内容
            if (targetMsg.content && typeof targetMsg.content === 'string') {
              var contentStr = targetMsg.content.replace('[(deep_think)]', '').trim();
              if (contentStr.length > prevContent.length) {
                var delta2 = contentStr.substring(prevContent.length);
                prevContent = contentStr;
                if (delta2) return { text: delta2, isThink: false, done: false };
              }
              if (targetMsg.status === 'complete') {
                doReset();
                return { text: '', isThink: null, done: true };
              }
            }
            return null;
          } catch (e) { return null; }
        };
        fn.reset = doReset;
        return fn;
      })()
    },
    wenxin: {
      urlPattern: '/eb/chat/conversation',
      parseLine: (function() {
        var prevThink = '';
        var prevContent = '';
        var fn = function(line) {
          line = line.replace(/\r$/, '');
          if (!line || !line.startsWith('data:')) return null;
          var jsonStr = line.substring(5).trim();
          if (!jsonStr || jsonStr.charAt(0) !== '{') return null;
          try {
            var parsed = JSON.parse(jsonStr);
            if (typeof parsed.thoughts === 'string' && 'thought_index' in parsed) {
              if (parsed.thoughts.length > prevThink.length) {
                var delta = parsed.thoughts.substring(prevThink.length);
                prevThink = parsed.thoughts;
                return delta ? { text: delta, isThink: true, done: false } : null;
              }
              return null;
            }
            if (typeof parsed.code === 'number' && parsed.data && typeof parsed.data === 'object') {
              var data = parsed.data;
              if (data.is_end === 1) { prevThink = ''; prevContent = ''; return { text: '', isThink: false, done: true }; }
              if (typeof data.content === 'string' && data.content.length > prevContent.length) {
                var delta2 = data.content.substring(prevContent.length);
                prevContent = data.content;
                return delta2 ? { text: delta2, isThink: false, done: false } : null;
              }
            }
            return null;
          } catch (e) { return null; }
        };
        fn.reset = function() { prevThink = ''; prevContent = ''; };
        return fn;
      })()
    },
    kimi: {
      urlPattern: '/api/chat/completions',
      parseLine: function(line) {
        if (!line.startsWith('data: ')) return null;
        var json = line.substring(6).trim();
        if (!json || json === '[DONE]') return { text: '', isThink: null, done: true };
        try {
          var d = JSON.parse(json);
          if (d.choices && d.choices[0] && d.choices[0].delta) {
            var delta = d.choices[0].delta;
            if (delta.content != null) return { text: String(delta.content), isThink: false, done: false };
            if (delta.reasoning_content != null) return { text: String(delta.reasoning_content), isThink: true, done: false };
          }
          return null;
        } catch (e) { return null; }
      }
    },
    zhipu: {
      urlPattern: '/api/paas/v4/chat/completions',
      parseLine: function(line) {
        if (!line.startsWith('data: ')) return null;
        var json = line.substring(6).trim();
        if (!json || json === '[DONE]') return { text: '', isThink: null, done: true };
        try {
          var d = JSON.parse(json);
          if (d.choices && d.choices[0] && d.choices[0].delta) {
            var delta = d.choices[0].delta;
            if (delta.content != null) return { text: String(delta.content), isThink: false, done: false };
            if (delta.reasoning_content != null) return { text: String(delta.reasoning_content), isThink: true, done: false };
          }
          return null;
        } catch (e) { return null; }
      }
    },
    chatgpt: {
      urlPattern: '/backend-api/conversation',
      parseLine: function(line) {
        if (!line.startsWith('data: ')) return null;
        var json = line.substring(6).trim();
        if (!json || json === '[DONE]') return { text: '', isThink: null, done: true };
        try {
          var d = JSON.parse(json);
          if (d.choices && d.choices[0] && d.choices[0].delta) {
            var delta = d.choices[0].delta;
            if (delta.content != null) return { text: String(delta.content), isThink: false, done: false };
          }
          return null;
        } catch (e) { return null; }
      }
    },
    claude: {
      urlPattern: '/api/chat',
      parseLine: function(line) {
        if (line === 'event: message_stop' || line === 'event: done') return { text: '', isThink: null, done: true };
        if (!line.startsWith('data: ')) return null;
        var json = line.substring(6).trim();
        if (!json) return null;
        try {
          var d = JSON.parse(json);
          if (d.type === 'message_stop') return { text: '', isThink: null, done: true };
          if (d.type === 'content_block_delta' && d.delta) {
            if (d.delta.type === 'text_delta' && d.delta.text) return { text: d.delta.text, isThink: false, done: false };
            if (d.delta.type === 'thinking_delta' && d.delta.thinking) return { text: d.delta.thinking, isThink: true, done: false };
          }
          return null;
        } catch (e) { return null; }
      }
    },
    gemini: {
      urlPattern: '_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate',
      parseLine: (function() {
        var prevText = '';
        var fn = function(line) {
          line = line.trim();
          if (!line) return null;
          if (/^\d+$/.test(line)) return null;
          try {
            var arr = JSON.parse(line);
            if (!Array.isArray(arr) || !arr[0] || !Array.isArray(arr[0])) return null;
            var inner = arr[0];
            if (inner[0] !== 'wrb.fr' || typeof inner[2] !== 'string') return null;
            var data = JSON.parse(inner[2]);
            if (!Array.isArray(data) || !data[4] || !Array.isArray(data[4])) return null;
            var chunks = data[4];
            if (!chunks[0] || !Array.isArray(chunks[0])) return null;
            var textArr = chunks[0][1];
            if (!Array.isArray(textArr) || textArr.length === 0) return null;
            var fullText = textArr[0];
            if (typeof fullText !== 'string') return null;
            if (fullText.length > prevText.length) {
              var delta = fullText.substring(prevText.length);
              prevText = fullText;
              return { text: delta, isThink: false, done: false };
            }
            return null;
          } catch (e) { return null; }
        };
        fn.reset = function() { prevText = ''; };
        return fn;
      })()
    },
    grok: {
      urlPattern: '/rest/app-chat/conversations/',
      parseLine: function(line) {
        line = line.trim();
        if (!line || !line.startsWith('{')) return null;
        try {
          var d = JSON.parse(line);
          if (!d.result) return null;
          var r = d.result;
          if (r.isSoftStop === true) return { text: '', isThink: null, done: true };
          if (r.messageTag === 'final' && !r.isThinking && typeof r.token === 'string' && r.token) {
            return { text: r.token, isThink: false, done: false };
          }
          return null;
        } catch (e) { return null; }
      }
    },
    metaso: {
      urlPattern: '/api/search/chat',
      parseLine: function(line) {
        if (!line.startsWith('data: ')) return null;
        var json = line.substring(6).trim();
        if (!json || json === '[DONE]') return { text: '', isThink: null, done: true };
        try {
          var d = JSON.parse(json);
          if (d.type === 'heartbeat') return null;
          if (d.choices && d.choices[0] && d.choices[0].delta) {
            var delta = d.choices[0].delta;
            var html = delta.full_html || '';
            if (html) {
              var text = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
              if (text) return { text: text, isThink: false, done: false };
            }
            if (delta.content) return { text: delta.content, isThink: false, done: false };
          }
          return null;
        } catch (e) { return null; }
      }
    },
    yuanbao: {
      urlPattern: '/api/chat/',
      parseLine: (function() {
        var thinkingDone = false;
        var fn = function(line) {
          line = line.trim();
          if (!line) return null;
          if (line === 'data: [DONE]' || line === '[DONE]') { thinkingDone = false; return { text: '', isThink: null, done: true }; }
          if (line.startsWith('event:')) return null;
          if (line.startsWith('data: ')) line = line.substring(6).trim();
          if (!line || line.charAt(0) !== '{') return null;
          try {
            var d = JSON.parse(line);
            if (d.type === 'think' && typeof d.content === 'string' && d.content) {
              thinkingDone = d.status === 2;
              return { text: d.content, isThink: true, done: thinkingDone };
            }
            if (d.type === 'text' && typeof d.msg === 'string' && d.msg) return { text: d.msg, isThink: false, done: false };
            return null;
          } catch (e) { return null; }
        };
        fn.reset = function() { thinkingDone = false; };
        return fn;
      })()
    }
  };

  // ===== SSE 响应判定 =====
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

  // ===== SSE 文本发送 =====
  function emitText(provider, text, isThink) {
    if (!text) return;
    window.postMessage({
      type: '__sse_text__',
      provider: provider,
      text: text,
      isThink: !!isThink,
      timestamp: Date.now()
    }, location.origin);
  }

  function emitTextReset(provider) {
    window.postMessage({
      type: '__sse_text_reset__',
      provider: provider,
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
        const textConfig = PLATFORM_TEXT_CONFIG[provider];
        console.log('[SSE Detect] Detected SSE response:', url, 'provider:', provider);

        // 通知 content script 重置文本累积，并重置 parseLine 闭包状态
        if (textConfig) {
          emitTextReset(provider);
          if (typeof textConfig.parseLine.reset === 'function') {
            textConfig.parseLine.reset();
          }
        }

        const originalReader = response.body.getReader();
        const decoder = new TextDecoder();
        let detected = false;
        let buffer = '';

        const wrappedStream = new ReadableStream({
          async pull(controller) {
            const { done, value } = await originalReader.read();
            if (done) {
              // 流结束时 flush 残留 buffer（最后一条 SSE 事件可能无 \n）
              if (buffer.trim()) {
                // 完成检测
                if (!detected && config && parseSSELine(buffer, config)) {
                  detected = true;
                  console.log('[SSE Detect] Buffer flush completion detected (Layer 1):', url);
                  emitComplete(url, 'content');
                }
                // 文本提取
                if (textConfig && textConfig.parseLine) {
                  try {
                    const result = textConfig.parseLine(buffer);
                    if (result && result.text) {
                      emitText(provider, result.text, result.isThink);
                    }
                  } catch (e) { /* ignore */ }
                }
              }
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

            // 需要行解析时才维护 buffer（完成检测或文本提取任一需要）
            const needLineParsing = (config && config.doneKeywords.length > 0) || textConfig;
            if (!needLineParsing) return;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留未完成的最后一行

            for (const line of lines) {
              // 完成检测
              if (!detected && config && config.doneKeywords.length > 0) {
                if (parseSSELine(line, config)) {
                  detected = true;
                  console.log('[SSE Detect] Content-layer completion detected (Layer 1):', url, 'line:', line.trim());
                  emitComplete(url, 'content');
                  break;
                }
              }
              // 文本提取
              if (textConfig && textConfig.parseLine) {
                try {
                  const result = textConfig.parseLine(line);
                  if (result && result.text) {
                    emitText(provider, result.text, result.isThink);
                  }
                } catch (e) { /* ignore parse errors */ }
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
