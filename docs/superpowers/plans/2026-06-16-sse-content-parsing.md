# SSE 内容层完成检测 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 sse-detect.js 中实现 SSE 内容层解析，用三层瀑布检测替代纯传输层检测

**架构：** hook fetch → 创建包装 ReadableStream → pull() 中逐行解码并匹配平台 doneKeywords → 命中则立即触发完成信号。未命中则在流结束时兜底触发。DOM 检测保持不变作为最终安全网。

**技术栈：** Chrome Extension Manifest V3, fetch API, ReadableStream, TextDecoder, postMessage

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `sse-detect.js` | 重写 | MAIN world 脚本：hook fetch，SSE 内容解析 + 传输层兜底，postMessage 通知 |

**不改动的文件：** `sse-bridge.js`、`text-injection-all-providers.js`、`multi-panel.js`、`manifest.json`（已正确配置，无需修改）

---

### 任务 1：添加平台完成信号配置

**文件：**
- 修改：`sse-detect.js`（在 `SSE_PATTERNS` 之后、`isSSEResponse` 之前插入）

- [ ] **步骤 1：在 SSE_PATTERNS 之后插入 PLATFORM_DONE_CONFIG**

在 `const SSE_PATTERNS = { ... };`（第 43 行 `};` 之后）和 `// ===== SSE响应判定 =====`（第 45 行）之间，插入以下代码：

```javascript
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
```

- [ ] **步骤 2：验证语法**

运行：
```bash
node -c "D:/D/cc/AIChatMerge/sse-detect.js"
```
预期：无输出（语法正确）。注意此时文件其余部分尚未修改，可能因后续步骤的占位导致语法错误——这一步只验证插入的配置对象本身语法正确。如果报错，说明插入位置或格式有问题，修正后继续。

---

### 任务 2：添加逐行解析引擎

**文件：**
- 修改：`sse-detect.js`（在 `emitComplete` 函数之后、`// ===== Hook fetch =====` 之前插入）

- [ ] **步骤 1：在 emitComplete 之后插入 parseSSELine 函数**

找到 `emitComplete` 函数的结束 `};`（约第 86 行），在其后、`// ===== Hook fetch =====` 之前插入：

```javascript
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
```

- [ ] **步骤 2：验证语法**

运行：
```bash
node -c "D:/D/cc/AIChatMerge/sse-detect.js"
```
预期：无输出（语法正确）

---

### 任务 3：修改 emitComplete 添加 layer 参数

**文件：**
- 修改：`sse-detect.js:77-86`（`emitComplete` 函数）

- [ ] **步骤 1：给 emitComplete 添加 layer 参数**

找到当前的 `emitComplete` 函数：

```javascript
  function emitComplete(url) {
    const provider = detectProvider();
    console.log('[SSE Detect] Emitting completion for provider:', provider, 'url:', url);
    window.postMessage({
      type: '__sse_complete__',
      provider: provider,
      url: url || '',
      timestamp: Date.now()
    }, location.origin);
  }
```

替换为：

```javascript
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
```

- [ ] **步骤 2：验证语法**

运行：
```bash
node -c "D:/D/cc/AIChatMerge/sse-detect.js"
```
预期：无输出（语法正确）

---

### 任务 4：重写 fetch hook（核心改动）

**文件：**
- 修改：`sse-detect.js:88-127`（`// ===== Hook fetch =====` 到 `// ===== Hook EventSource =====` 之前）

- [ ] **步骤 1：替换整个 fetch hook**

找到从 `// ===== Hook fetch =====` 开始，到 `// ===== Hook EventSource =====` 之前的所有代码（第 88-127 行），整段替换为：

```javascript
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
```

- [ ] **步骤 2：验证语法**

运行：
```bash
node -c "D:/D/cc/AIChatMerge/sse-detect.js"
```
预期：无输出（语法正确）

- [ ] **步骤 3：验证完整文件结构**

确认文件包含以下部分（顺序不能错）：
1. IIFE 开头 + 防重复hook
2. `detectProvider()` 函数
3. `SSE_PATTERNS` 对象
4. `PLATFORM_DONE_CONFIG` 对象（任务 1 新增）
5. `isSSEResponse()` 函数
6. `emitComplete(url, layer)` 函数（任务 3 修改）
7. `parseSSELine()` 函数（任务 2 新增）
8. Hook fetch（任务 4 重写）
9. Hook EventSource（未改动）
10. `console.log` 结尾

运行：
```bash
node -e "const fs = require('fs'); const code = fs.readFileSync('D:/D/cc/AIChatMerge/sse-detect.js','utf8'); const fns = ['detectProvider','SSE_PATTERNS','PLATFORM_DONE_CONFIG','isSSEResponse','emitComplete','parseSSELine','originalFetch','OriginalEventSource']; fns.forEach(f => { if (!code.includes(f)) console.log('MISSING:', f); else console.log('OK:', f); })"
```
预期：全部输出 `OK: xxx`

---

### 任务 5：语法验证 + 完整文件检查

**文件：**
- 无新改动，验证任务 1-4 的成果

- [ ] **步骤 1：最终语法验证**

运行：
```bash
node -c "D:/D/cc/AIChatMerge/sse-detect.js"
```
预期：无输出（语法正确）

- [ ] **步骤 2：检查关键模式存在**

运行：
```bash
node -e "
const fs = require('fs');
const code = fs.readFileSync('D:/D/cc/AIChatMerge/sse-detect.js','utf8');
const checks = [
  ['PLATFORM_DONE_CONFIG', '平台配置对象'],
  ['parseSSELine', '逐行解析函数'],
  ['emitComplete(url, \'content\')', 'Layer 1 内容层触发'],
  ['emitComplete(url, \'transport\')', 'Layer 2 传输层触发'],
  ['decoder.decode(value, { stream: true })', '流式解码'],
  ['buffer.split', '行分割逻辑'],
  ['new ReadableStream', '包装流'],
  ['controller.enqueue(value)', '数据透传给页面'],
  ['wrappedStream', '包装流返回']
];
checks.forEach(([pattern, desc]) => {
  console.log(code.includes(pattern) ? 'PASS' : 'FAIL', desc);
});
"
```
预期：全部输出 `PASS`

- [ ] **步骤 3：检查无遗漏的占位符**

运行：
```bash
node -e "
const fs = require('fs');
const code = fs.readFileSync('D:/D/cc/AIChatMerge/sse-detect.js','utf8');
const bad = ['TODO', 'FIXME', 'HACK', '待定', '待实现', 'placeholder'];
bad.forEach(w => {
  if (code.includes(w)) console.log('WARNING: found', w);
});
if (!bad.some(w => code.includes(w))) console.log('PASS: no placeholders found');
"
```
预期：`PASS: no placeholders found`

---

### 任务 6：Commit

- [ ] **步骤 1：提交所有改动**

```bash
git add sse-detect.js
git commit -m "feat(sse): add content-layer SSE parsing with three-tier waterfall detection

- Add PLATFORM_DONE_CONFIG with completion signals for 9 platforms
- Add parseSSELine() for keyword + JSON field matching
- Rewrite fetch hook to wrap ReadableStream with line-by-line decoding
- Layer 1: content parsing (fastest, triggers before stream ends)
- Layer 2: transport fallback (stream close triggers if Layer 1 misses)
- Layer 3: DOM detection unchanged (button state + MutationObserver)"
```

---

## 验证方案

由于这是 Chrome 扩展的 MAIN world 注入脚本，无法通过 Node.js 单元测试验证完整流程。验证方式：

### 手动验证步骤

1. **加载扩展**：Edge → `edge://extensions/` → 开发者模式 → 加载解压缩的扩展 → 选择 `D:/D/cc/AIChatMerge`

2. **验证注入**：打开 DeepSeek → F12 Console → 应看到 `[SSE Detect] Hook installed successfully`

3. **验证 Layer 1**：发送问题 → Console 应看到：
   - `[SSE Detect] Detected SSE response: ... provider: deepseek`
   - `[SSE Detect] Content-layer completion detected (Layer 1): ... line: event: close`

4. **验证 Layer 2**：选择 Gemini（无 doneKeywords）→ 发送问题 → Console 应看到：
   - `[SSE Detect] Stream ended (Layer 2 - transport): ...`

5. **验证融合触发**：选择 2+ 个平台 → 发送问题 → 确认融合在所有 AI 回答完毕后自动触发

### 预期行为

| 场景 | 预期 |
|------|------|
| DeepSeek 回答完毕 | Layer 1 触发（`event: close`），融合立即触发 |
| 豆包回答完毕 | Layer 1 触发（`SSE_REPLY_END`），融合立即触发 |
| Gemini 回答完毕 | Layer 2 触发（流关闭），融合触发 |
| 网络中断 | Layer 2 触发（流异常关闭），融合触发 |
| 未知平台 | Layer 2 兜底，DOM 兜底 |
