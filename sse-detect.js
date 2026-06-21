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
    // 修复 #3：原 '/apiv2/' 过于宽泛，会匹配 Kimi 所有 APIv2 端点（设置、历史、文件等非 SSE 请求），
    // 导致非 SSE 请求被 hook Response body、误设 __sse_fetch_active__ 阻塞兜底 hook。
    // 收窄到真正的对话 SSE 端点。
    kimi:        ['/apiv2/chat/completions'],
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
      // `event: close` may end an intermediate DeepSeek stream. Only the
      // explicit response status is safe to treat as the final answer.
      doneKeywords: [],
      jsonCheck: (obj) => obj && (
        obj.status === 'FINISHED' ||
        (obj.p === 'response/status' && obj.o === 'SET' && obj.v === 'FINISHED')
      )
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
    // 注意：这三家在一次回答过程中会发出多个 SSE 子流（思考/搜索/生成各自一个 HTTP 请求），
    // 每个子流都会带 [DONE]。如果用 [DONE] 作为完成关键字，第一个子流（往往只是思考阶段）
    // 结束就会误判为"回答完成"，导致自动融合提前触发、答案不完整。
    // 正确做法：用协议里"真正回答结束"的字段判定（仅最终帧才出现）。
    wenxin: {
      doneKeywords: [],
      // 文心最终帧：data.is_end === 1（中间搜索流不带 is_end:1）
      jsonCheck: (obj) => obj && obj.data && typeof obj.data === 'object' && obj.data.is_end === 1
    },
    zhipu: {
      doneKeywords: [],
      // 智谱最终帧：choices[0].finish_reason === 'stop'（中间子流没有 finish_reason）
      jsonCheck: (obj) => obj && obj.choices && obj.choices[0] &&
        obj.choices[0].finish_reason === 'stop'
    },
    kimi: {
      doneKeywords: [],
      // Kimi 最终帧：choices[0].finish_reason === 'stop'
      jsonCheck: (obj) => obj && obj.choices && obj.choices[0] &&
        obj.choices[0].finish_reason === 'stop'
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
        // 注意：[DONE] 不再标记完成。Kimi 在思考→生成的多子流场景下每个子流都带 [DONE]，
        // 仅靠 [DONE] 会导致提前完成。真正的结束信号是 finish_reason === 'stop'，
        // 由 PLATFORM_DONE_CONFIG.jsonCheck 判定（见 parseSSELine）。
        if (!json || json === '[DONE]') return null;
        try {
          var d = JSON.parse(json);
          // 最终帧：finish_reason === 'stop'（此时通常无 delta 内容）
          if (d.choices && d.choices[0] && d.choices[0].finish_reason === 'stop') {
            return { text: '', isThink: null, done: true };
          }
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
        // 同 kimi：[DONE] 不再标记完成，改用 finish_reason === 'stop'
        if (!json || json === '[DONE]') return null;
        try {
          var d = JSON.parse(json);
          if (d.choices && d.choices[0] && d.choices[0].finish_reason === 'stop') {
            return { text: '', isThink: null, done: true };
          }
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

  // ===== 平台检测关键词（用于 TextDecoder/ReadableStream 兜底识别 SSE 流） =====
  const DETECTION_KEYWORDS = {
    deepseek: ['event: ready', 'data: {"v"', 'data: {"p"', 'response_message_id', 'event: close'],
    doubao: ['SSE_REPLY_END', 'patch_object', 'tts_content', 'end_type'],
    qianwen: ['"messages":', '"error_code":', 'event:complete'],
    yuanbao: ['data: {"type":', 'event: speech_type', 'data: [DONE]'],
    wenxin: ['event:thought', 'event:message', 'is_end'],
    zhipu: ['finish_reason', '"choices"', 'chat/completions'],
    kimi: ['finish_reason', '"choices"', 'chat/completions'],
    chatgpt: ['[DONE]'],
    claude: ['event: message_stop', 'event: done', 'content_block_delta'],
    gemini: ['wrb.fr'],
    grok: ['isSoftStop', 'messageTag'],
    metaso: ['[DONE]', 'heartbeat']
  };

  // ===== URL 匹配（检查是否为 SSE 请求 URL） =====
  function isCompletionUrl(url) {
    if (!url) return false;
    const provider = detectProvider();
    const patterns = SSE_PATTERNS[provider];
    if (patterns) {
      for (var i = 0; i < patterns.length; i++) {
        if (url.includes(patterns[i])) return true;
      }
    }
    return false;
  }

  // ===== 检查文本是否包含检测关键词（用于兜底 hook 识别 SSE 流） =====
  function shouldTrackSSE(text) {
    if (!text) return false;
    var provider = detectProvider();
    var keywords = DETECTION_KEYWORDS[provider];
    if (!keywords) return false;
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
  }

  // ===== SSE 响应判定（用于 fetch hook） =====
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
    if (isCompletionUrl(url)) {
      console.log('[SSE Detect] URL pattern match:', url);
      return true;
    }

    // 条件3: Accept header 包含 text/event-stream
    const accept = requestInfo?.headers?.get?.('accept') || '';
    if (accept.includes('text/event-stream')) {
      console.log('[SSE Detect] Accept header match:', accept);
      return true;
    }

    return false;
  }

  // ===== 多子流平台判定 =====
  // 这些平台在一次回答过程中会发出多个 SSE 子流（思考/搜索/生成各自一个 HTTP 请求），
  // 每个子流关闭时都会走到 transport 层兜底。如果允许兜底强行发完成信号，
  // 第一个子流（往往只是思考阶段）关闭就会误判为"回答完成"，导致自动融合提前触发。
  // 因此对多子流平台：必须以内容层（协议字段）信号为准，禁止 transport 兜底强行完成。
  const MULTI_STREAM_PROVIDERS = ['wenxin', 'zhipu', 'kimi'];

  function isMultiStreamProvider(provider) {
    return MULTI_STREAM_PROVIDERS.indexOf(provider) >= 0;
  }

  // ===== 修复 #8：多子流平台的延迟 transport 兜底 =====
  // 原实现：transport 兜底对多子流平台完全禁用，一旦协议变更导致 jsonCheck（finish_reason/is_end）
  // 失效，SSE 4 层 hook 全部静默，只能靠 DOM 兜底（~10-25s）或超时（60s）。
  // 新实现：多子流平台流关闭后不立即发完成，而是延迟 DEFERRED_TRANSPORT_MS 确认。
  // 确认前若新的 SSE 流开始（__sse_fetch_active__ 再次变 true），则取消本次完成信号。
  // 这样既保留了对"多子流提前完成"的防护，又为协议变更提供了降级路径。
  const DEFERRED_TRANSPORT_MS = 3000;
  let deferredTransportTimer = null;

  function scheduleDeferredTransportComplete(url, provider) {
    if (deferredTransportTimer) clearTimeout(deferredTransportTimer);
    console.log('[SSE Detect] Scheduling deferred transport completion (multi-stream):', url);
    deferredTransportTimer = setTimeout(function () {
      deferredTransportTimer = null;
      // 确认窗口结束：若期间有新的 SSE 流开始，__sse_fetch_active__ 会是 true，跳过本次完成
      if (window.__sse_fetch_active__) {
        console.log('[SSE Detect] Deferred transport cancelled (new SSE stream active):', url);
        return;
      }
      console.log('[SSE Detect] Deferred transport confirmed (no new stream within', DEFERRED_TRANSPORT_MS, 'ms):', url);
      emitComplete(url, 'transport-deferred');
    }, DEFERRED_TRANSPORT_MS);
  }

  // 新的 SSE 流开始时应取消挂起的延迟兜底（在 fetch hook 设置 __sse_fetch_active__ 处调用）
  function cancelDeferredTransportComplete() {
    if (deferredTransportTimer) {
      clearTimeout(deferredTransportTimer);
      deferredTransportTimer = null;
      console.log('[SSE Detect] Deferred transport cancelled by new SSE stream start');
    }
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

        // 标记 fetch hook 正在处理，让 TextDecoder/ReadableStream 兜底 hook 跳过
        window.__sse_fetch_active__ = true;
        // 修复 #8：新 SSE 流开始时，取消挂起的延迟 transport 兜底（说明上一个子流不是最终流）
        cancelDeferredTransportComplete();

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
            // 修复 #2：pull() 内部异常时重置 __sse_fetch_active__
            let done, value;
            try {
              ({ done, value } = await originalReader.read());
            } catch (readErr) {
              window.__sse_fetch_active__ = false;
              // 修复 #8：多子流平台改为延迟确认（同 stream done 路径）
              if (!detected) {
                if (isMultiStreamProvider(provider)) {
                  detected = true;
                  scheduleDeferredTransportComplete(url, provider);
                } else {
                  detected = true;
                  console.warn('[SSE Detect] pull() read error, emitting fallback completion:', readErr);
                  emitComplete(url, 'transport');
                }
              }
              try { controller.error(readErr); } catch (_) {}
              return;
            }
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
              // 修复 #8：多子流平台不再完全禁用，而是改为延迟确认（scheduleDeferredTransportComplete），
              // 等待 DEFERRED_TRANSPORT_MS 内无新 SSE 流才发完成，作为 jsonCheck 失效时的降级路径。
              if (!detected) {
                if (isMultiStreamProvider(provider)) {
                  // 注意：此时 __sse_fetch_active__ 还是 true，延迟确认逻辑内部会重新检查
                  detected = true; // 标记本流已处理，避免重复
                  scheduleDeferredTransportComplete(url, provider);
                } else {
                  detected = true;
                  console.log('[SSE Detect] Stream ended (Layer 2 - transport):', url);
                  emitComplete(url, 'transport');
                }
              }
              window.__sse_fetch_active__ = false;
              controller.close();
              return;
            }

            controller.enqueue(value);

            // 需要行解析时才维护 buffer（完成检测或文本提取任一需要）
            const needLineParsing = (config && config.doneKeywords.length > 0) || textConfig;
            if (!needLineParsing) return;

            // 修复 #7：把 buffer 拼接、行解析、parseLine 调用包在 try-catch 里。
            // 这些步骤（decoder.decode / buffer.split / parseLine）一旦抛异常，done 还是 false，
            // 原代码不会清除 __sse_fetch_active__，导致 TextDecoder/ReadableStream 兜底 hook
            // 永久跳过 SSE 检测。此处异常时清除标志并向上抛出（让 ReadableStream 进入 error 态）。
            try {
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop(); // 保留未完成的最后一行

              for (const line of lines) {
                // 完成检测
                // 修复 #1：多子流平台 doneKeywords 为空数组，原条件 config.doneKeywords.length > 0
                // 会阻止 parseSSELine 被调用，导致 jsonCheck（真正的完成检测）永远不执行。
                // 增加对 jsonCheck 的支持：有 doneKeywords 或 jsonCheck 任一存在时都需进入。
                if (!detected && config && (config.doneKeywords.length > 0 || config.jsonCheck)) {
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
            } catch (e) {
              // 修复 #7：buffer 处理异常时清除标志，避免 __sse_fetch_active__ 泄漏
              window.__sse_fetch_active__ = false;
              throw e;
            }
          }
        });

        return new Response(wrappedStream, { headers: response.headers });
      }
    } catch (err) {
      window.__sse_fetch_active__ = false;
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
          // 修复 #2 + #8：多子流平台改为延迟确认，与 fetch/XHR/ReadableStream 保持一致。
          const provider = detectProvider();
          if (isMultiStreamProvider(provider)) {
            console.log('[SSE Detect] EventSource closed, deferring (multi-stream provider):', url);
            scheduleDeferredTransportComplete(url, provider);
          } else {
            console.log('[SSE Detect] EventSource closed (stream ended):', url);
            emitComplete(url);
          }
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

  // ===== 保存原始方法引用（在 hook 之前） =====
  const rawGetReader = ReadableStream.prototype.getReader;
  const rawDecode = TextDecoder.prototype.decode;

  // ===== Hook XMLHttpRequest（ai-clash 核心：很多平台用 XHR 发 SSE） =====
  var origXhrOpen = XMLHttpRequest.prototype.open;
  var origXhrSend = XMLHttpRequest.prototype.send;
  var rtDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');

  XMLHttpRequest.prototype.open = function (method, url) {
    this._sseDetect = { url: typeof url === 'string' ? url : '', pos: 0, ended: false };
    return origXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var ab = this._sseDetect;
    if (!ab || !isCompletionUrl(ab.url)) {
      return origXhrSend.apply(this, arguments);
    }

    var provider = detectProvider();
    var config = PLATFORM_DONE_CONFIG[provider];
    var textConfig = PLATFORM_TEXT_CONFIG[provider];
    var detected = false;
    var xhr = this;

    console.log('[SSE Detect] XHR hook matched:', ab.url, 'provider:', provider);

    // 重置 parseLine 闭包状态
    if (textConfig && typeof textConfig.parseLine.reset === 'function') {
      textConfig.parseLine.reset();
    }
    if (textConfig) emitTextReset(provider);

    var processNew = function (fullText) {
      if (typeof fullText !== 'string' || fullText.length <= ab.pos) return;
      var newData = fullText.substring(ab.pos);
      ab.pos = fullText.length;
      var lines = newData.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (!t) continue;
        // 完成检测
        if (!detected && config) {
          if (parseSSELine(t, config)) {
            detected = true;
            console.log('[SSE Detect] XHR completion detected (Layer 1):', ab.url);
            emitComplete(ab.url, 'content');
          }
        }
        // 文本提取
        if (textConfig && textConfig.parseLine) {
          try {
            var result = textConfig.parseLine(t);
            if (result && result.text) {
              emitText(provider, result.text, result.isThink);
            }
            // 修复 #4：parseLine.done 路径增加多子流平台守卫。
            // parseLine 是各平台自己的解析逻辑，与 PLATFORM_DONE_CONFIG.jsonCheck 是独立路径。
            // 多子流平台统一由 parseSSELine/jsonCheck 做完成判定，parseLine.done 不再触发完成，
            // 防止协议变更导致中间子流误报 done:true。
            if (result && result.done && !detected && !isMultiStreamProvider(provider)) {
              detected = true;
              console.log('[SSE Detect] XHR parseLine done:', ab.url);
              emitComplete(ab.url, 'content');
            }
          } catch (e) { /* ignore */ }
        }
      }
    };

    var poller = setInterval(function () {
      try {
        var txt = rtDesc && rtDesc.get ? rtDesc.get.call(xhr) : xhr.responseText;
        if (txt) processNew(txt);
      } catch (_) { clearInterval(poller); }
      if (xhr.readyState === 4) clearInterval(poller);
    }, 100);

    // 修复 #1：网络错误/超时/中止时也清除轮询
    xhr.addEventListener('error', function () { clearInterval(poller); });
    xhr.addEventListener('timeout', function () { clearInterval(poller); });
    xhr.addEventListener('abort', function () { clearInterval(poller); });

    xhr.addEventListener('loadend', function () {
      clearInterval(poller);
      try {
        var txt = rtDesc && rtDesc.get ? rtDesc.get.call(xhr) : xhr.responseText;
        if (txt) processNew(txt);
      } catch (_) {}
      if (!ab.ended) {
        ab.ended = true;
        // 修复 #8：多子流平台改为延迟确认（同 fetch stream done 路径）
        if (!detected) {
          if (isMultiStreamProvider(provider)) {
            detected = true;
            scheduleDeferredTransportComplete(ab.url, provider);
          } else {
            detected = true;
            console.log('[SSE Detect] XHR stream ended (Layer 2 - transport):', ab.url);
            emitComplete(ab.url, 'transport');
          }
        }
      }
    });

    return origXhrSend.apply(this, arguments);
  };

  // ===== Hook TextDecoder（兜底：拦截解码层，识别 SSE 流） =====
  var origDecode = TextDecoder.prototype.decode;
  var decoderStates = new WeakMap();

  TextDecoder.prototype.decode = function (input, options) {
    var result = origDecode.apply(this, arguments);
    if (!result || result.length < 5) return result;
    // 如果 fetch hook 已经在处理，跳过
    if (window.__sse_fetch_active__) return result;

    var st = decoderStates.get(this);
    if (!st) { st = { tracked: false, rejected: false, buf: '', n: 0 }; decoderStates.set(this, st); }
    if (st.rejected) return result;

    var provider = detectProvider();
    var config = PLATFORM_DONE_CONFIG[provider];
    var textConfig = PLATFORM_TEXT_CONFIG[provider];

    if (!st.tracked) {
      if (shouldTrackSSE(result)) {
        st.tracked = true;
        st.provider = provider;
        console.log('[SSE Detect] TextDecoder hook detected SSE stream for:', provider);
        if (textConfig && typeof textConfig.parseLine.reset === 'function') {
          textConfig.parseLine.reset();
        }
        if (textConfig) emitTextReset(provider);
      } else {
        st.n++;
        if (st.n > 3) st.rejected = true;
        return result;
      }
    }

    var detected = st.detected || false;
    st.buf += result;
    var lines = st.buf.split('\n');
    st.buf = lines.pop() || '';
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) continue;
      // 完成检测
      if (!detected && config) {
        if (parseSSELine(t, config)) {
          detected = true;
          st.detected = true;
          console.log('[SSE Detect] TextDecoder completion detected (Layer 1)');
          emitComplete('', 'content');
        }
      }
      // 文本提取
      if (textConfig && textConfig.parseLine) {
        try {
          var res = textConfig.parseLine(t);
          if (res && res.text) {
            emitText(provider, res.text, res.isThink);
          }
          // 修复 #4：多子流平台禁用 parseLine.done 触发完成（同 XHR）
          if (res && res.done && !detected && !isMultiStreamProvider(provider)) {
            detected = true;
            st.detected = true;
            console.log('[SSE Detect] TextDecoder parseLine done');
            emitComplete('', 'content');
          }
        } catch (e) { /* ignore */ }
      }
    }
    return result;
  };

  // ===== Hook ReadableStream.getReader（兜底：拦截流读取层） =====
  var origGetReader = ReadableStream.prototype.getReader;
  ReadableStream.prototype.getReader = function () {
    var reader = origGetReader.apply(this, arguments);
    var origRead = reader.read.bind(reader);
    var st = { tracked: false, rejected: false, buf: '', dec: new TextDecoder('utf-8'), n: 0, detected: false };

    var provider = detectProvider();
    var config = PLATFORM_DONE_CONFIG[provider];
    var textConfig = PLATFORM_TEXT_CONFIG[provider];

    reader.read = function () {
      return origRead().then(function (result) {
        if (st.rejected || window.__sse_fetch_active__) return result;
        if (result.done) {
          if (st.tracked && !st.detected) {
            if (st.buf.trim()) {
              // flush 残留 buffer
              if (config) {
                if (parseSSELine(st.buf.trim(), config)) {
                  st.detected = true;
                  console.log('[SSE Detect] ReadableStream buffer flush completion');
                  emitComplete('', 'content');
                }
              }
              if (textConfig && textConfig.parseLine) {
                try {
                  var res = textConfig.parseLine(st.buf.trim());
                  if (res && res.text) emitText(provider, res.text, res.isThink);
                } catch (e) { /* ignore */ }
              }
            }
            // 修复 #8：多子流平台改为延迟确认（同 fetch/XHR 路径）
            if (!st.detected) {
              if (isMultiStreamProvider(provider)) {
                st.detected = true;
                scheduleDeferredTransportComplete('', provider);
              } else {
                st.detected = true;
                console.log('[SSE Detect] ReadableStream stream ended (Layer 2)');
                emitComplete('', 'transport');
              }
            }
          }
          return result;
        }
        if (!result.value) return result;

        var text;
        try {
          text = typeof result.value === 'string' ? result.value : rawDecode.call(st.dec, result.value, { stream: true });
        } catch (_) {
          st.rejected = true;
          return result;
        }

        if (!st.tracked) {
          if (shouldTrackSSE(text)) {
            st.tracked = true;
            console.log('[SSE Detect] ReadableStream hook detected SSE stream for:', provider);
            if (textConfig && typeof textConfig.parseLine.reset === 'function') {
              textConfig.parseLine.reset();
            }
            if (textConfig) emitTextReset(provider);
          } else {
            st.n++;
            if (st.n > 3) st.rejected = true;
            return result;
          }
        }

        st.buf += text;
        var lines = st.buf.split('\n');
        st.buf = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
          var t = lines[i].trim();
          if (!t) continue;
          // 完成检测
          if (!st.detected && config) {
            if (parseSSELine(t, config)) {
              st.detected = true;
              console.log('[SSE Detect] ReadableStream completion detected (Layer 1)');
              emitComplete('', 'content');
            }
          }
          // 文本提取
          if (textConfig && textConfig.parseLine) {
            try {
              var res2 = textConfig.parseLine(t);
              if (res2 && res2.text) {
                emitText(provider, res2.text, res2.isThink);
              }
              // 修复 #4：多子流平台禁用 parseLine.done 触发完成（同 XHR/TextDecoder）
              if (res2 && res2.done && !st.detected && !isMultiStreamProvider(provider)) {
                st.detected = true;
                console.log('[SSE Detect] ReadableStream parseLine done');
                emitComplete('', 'content');
              }
            } catch (e) { /* ignore */ }
          }
        }
        return result;
      });
    };
    return reader;
  };

  console.log('[SSE Detect] 4-layer hook installed (fetch + XHR + TextDecoder + ReadableStream)');
})();
