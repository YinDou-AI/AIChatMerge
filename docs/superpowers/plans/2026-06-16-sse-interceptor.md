# SSE拦截完成检测 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在MAIN world注入fetch hook，检测SSE流结束信号，替代DOM轮询作为完成检测主路径

**架构：** sse-detect.js在MAIN world hook fetch检测SSE流结束 → sse-bridge.js在isolated world桥接消息 → 转发COMPLETION_DETECTED到multi-panel → 现有DOM检测保留为兜底

**技术栈：** Chrome Extension Manifest V3, fetch API, ReadableStream, postMessage

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `sse-detect.js` | 新建（根目录） | MAIN world脚本：hook fetch，检测SSE URL pattern，监控ReadableStream结束，postMessage通知 |
| `sse-bridge.js` | 新建（content-scripts/） | Content script：注入sse-detect.js到MAIN world，监听`__sse_complete__`消息，转发COMPLETION_DETECTED到parent |
| `manifest.json` | 修改 | 添加sse-detect.js到web_accessible_resources，每个AI平台content_scripts添加sse-bridge.js |
| `content-scripts/text-injection-all-providers.js` | 修改 | 监听`__sse_complete__`消息调用stopCompletionMonitor()防重复 |

---

### 任务 1：创建 sse-detect.js（MAIN world hook脚本）

**文件：**
- 创建：`sse-detect.js`（扩展根目录，非content-scripts子目录，因web_accessible_resources路径相对于扩展根）

- [ ] **步骤 1：创建sse-detect.js，包含fetch hook和SSE检测逻辑**

```javascript
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
```

- [ ] **步骤 2：确认文件位置和语法**

运行：检查文件是否存在且无语法错误
```bash
node -c "D:/D/cc/AIChatMerge/sse-detect.js"
```
预期：无输出（语法正确）

- [ ] **步骤 3：Commit**

```bash
git add sse-detect.js
git commit -m "feat(sse): add sse-detect.js - MAIN world fetch hook for SSE stream completion detection"
```

---

### 任务 2：创建 sse-bridge.js（Content script桥接）

**文件：**
- 创建：`content-scripts/sse-bridge.js`

- [ ] **步骤 1：创建sse-bridge.js，负责注入MAIN world脚本和消息桥接**

```javascript
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
```

- [ ] **步骤 2：确认文件语法**

运行：
```bash
node -c "D:/D/cc/AIChatMerge/content-scripts/sse-bridge.js"
```
预期：无输出（语法正确）

- [ ] **步骤 3：Commit**

```bash
git add content-scripts/sse-bridge.js
git commit -m "feat(sse): add sse-bridge.js - content script for injecting MAIN world hook and bridging messages"
```

---

### 任务 3：更新 manifest.json

**文件：**
- 修改：`manifest.json`（3处改动）

- [ ] **步骤 1：添加sse-detect.js到web_accessible_resources**

在 `manifest.json` 的 `web_accessible_resources[0].resources` 数组末尾（`"multi-panel/multi-panel.css"` 之后）添加一行：

```json
"sse-detect.js"
```

改动后该数组末尾部分变为：
```json
        "multi-panel/multi-panel.js",
        "multi-panel/multi-panel.css",
        "sse-detect.js"
```

- [ ] **步骤 2：为每个AI平台的content_scripts添加sse-bridge.js**

需要修改11个平台的content_scripts配置。每个平台的 `js` 数组**开头**添加 `"content-scripts/sse-bridge.js"`（要在 `document_start` 时尽早注入）。

以下列出每个需要修改的平台及其当前 `matches` 值：

**通义千问**（第71-85行附近）：
```json
{
  "matches": ["https://www.qianwen.com/*", "https://qianwen.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-qianwen.js",
    "content-scripts/answer-extractor-qianwen.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

**智谱ChatGLM**（第87-98行附近）：
```json
{
  "matches": ["https://chatglm.cn/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-zhipu.js",
    "content-scripts/answer-extractor-zhipu.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_end",
  "all_frames": true
}
```
注意：此平台是 `document_end`，改为 `document_start` 以确保SSE hook在页面代码前执行。

**文心一言**（第100-112行附近）：
```json
{
  "matches": ["https://yiyan.baidu.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-wenxin.js",
    "content-scripts/answer-extractor-wenxin.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```
注意：此平台原来是 `document_end`，改为 `document_start`。

**腾讯元宝**（第114-128行附近）：
```json
{
  "matches": ["https://yuanbao.tencent.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-yuanbao.js",
    "content-scripts/answer-extractor-yuanbao.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

**秘塔搜索**（第130-141行附近）：
```json
{
  "matches": ["https://metaso.cn/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-metaso.js",
    "content-scripts/answer-extractor-metaso.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```
注意：此平台原来是 `document_end`，改为 `document_start`。

**DeepSeek**（第143-157行附近）：
```json
{
  "matches": ["https://chat.deepseek.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-deepseek.js",
    "content-scripts/answer-extractor-deepseek.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

**Kimi**（第159-173行附近）：
```json
{
  "matches": ["https://www.kimi.com/*", "https://kimi.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-kimi.js",
    "content-scripts/answer-extractor-kimi.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

**豆包**（第175-189行附近）：
```json
{
  "matches": ["https://www.doubao.com/*", "https://doubao.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-doubao.js",
    "content-scripts/answer-extractor-doubao.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

**ChatGPT**（第191-202行附近）：
```json
{
  "matches": ["https://chatgpt.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-chatgpt.js",
    "content-scripts/answer-extractor-chatgpt.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

**Gemini**（第204-215行附近）：
```json
{
  "matches": ["https://gemini.google.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-gemini.js",
    "content-scripts/answer-extractor-gemini.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

**Claude**（第217-228行附近）：
```json
{
  "matches": ["https://claude.ai/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-claude.js",
    "content-scripts/answer-extractor-claude.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

**Grok**（第230-241行附近）：
```json
{
  "matches": ["https://grok.com/*"],
  "js": [
    "content-scripts/sse-bridge.js",
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-grok.js",
    "content-scripts/answer-extractor-grok.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
}
```

- [ ] **步骤 3：验证manifest.json格式**

运行：
```bash
node -e "JSON.parse(require('fs').readFileSync('D:/D/cc/AIChatMerge/manifest.json','utf8')); console.log('JSON valid')"
```
预期：输出 `JSON valid`

- [ ] **步骤 4：Commit**

```bash
git add manifest.json
git commit -m "feat(sse): add sse-detect.js to web_accessible_resources and sse-bridge.js to all AI platform content_scripts"
```

---

### 任务 4：更新 text-injection-all-providers.js（防重复集成）

**文件：**
- 修改：`content-scripts/text-injection-all-providers.js`（第3182-3198行附近）

- [ ] **步骤 1：在message listener中添加__sse_complete__处理**

在现有的 `window.addEventListener('message', ...)` 回调中（约第3183行），在处理 `MONITOR_COMPLETION` 之前添加对 `__sse_complete__` 的监听：

找到这段代码（约第3183-3198行）：
```javascript
  // Listen for messages from the multi-panel host
  window.addEventListener('message', (event) => {
    if (!event || !event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'MONITOR_COMPLETION' && event.data.context === 'multi-panel') {
      startCompletionMonitor();
      return;
    }
```

替换为：
```javascript
  // Listen for messages from the multi-panel host and SSE bridge
  window.addEventListener('message', (event) => {
    if (!event || !event.data || typeof event.data !== 'object') return;

    // SSE检测完成：停止DOM监控，防止重复发送COMPLETION_DETECTED
    if (event.data.type === '__sse_complete__') {
      console.log('[CompletionMonitor] SSE completion received, stopping DOM monitor');
      stopCompletionMonitor();
      return;
    }

    if (event.data.type === 'MONITOR_COMPLETION' && event.data.context === 'multi-panel') {
      startCompletionMonitor();
      return;
    }
```

- [ ] **步骤 2：验证修改后的文件语法**

运行：
```bash
node -c "D:/D/cc/AIChatMerge/content-scripts/text-injection-all-providers.js"
```
预期：无输出（语法正确）

- [ ] **步骤 3：Commit**

```bash
git add content-scripts/text-injection-all-providers.js
git commit -m "feat(sse): add __sse_complete__ listener to stop DOM monitor and prevent duplicate COMPLETION_DETECTED signals"
```

---

### 任务 5：集成测试验证

- [ ] **步骤 1：在Edge中加载扩展并验证基本功能**

1. 打开Edge，访问 `edge://extensions/`
2. 开启"开发者模式"
3. 点击"加载解压缩的扩展"，选择 `D:/D/cc/AIChatMerge` 目录
4. 确认扩展加载成功，无报错

- [ ] **步骤 2：验证sse-detect.js注入成功**

1. 打开任意AI平台（如 `https://chat.deepseek.com`）
2. 打开DevTools → Console
3. 检查是否有 `[SSE Detect] Hook installed successfully` 日志
4. 如果有，说明MAIN world注入成功

- [ ] **步骤 3：验证SSE完成检测触发**

1. 打开AIChatMerge面板
2. 选择2-3个AI平台（如DeepSeek + Kimi）
3. 发送一个问题
4. 观察Console：
   - 应看到 `[SSE Detect] Detected SSE response: ...` 日志
   - AI回答完毕后应看到 `[SSE Detect] SSE stream ended: ...` 日志
   - 应看到 `[SSE Bridge] SSE completion detected for: ...` 日志
5. 确认融合在所有AI回答完毕后自动触发（不再需要等超时）

- [ ] **步骤 4：验证DOM兜底仍然工作**

1. 选择一个SSE pattern为空的平台（如Gemini或Grok）
2. 发送问题
3. 确认这些平台仍然通过DOM检测（stop按钮/MutationObserver）完成
4. 融合正常触发

- [ ] **步骤 5：最终Commit（如有修复）**

如果测试中发现问题并修复：
```bash
git add -A
git commit -m "fix(sse): address integration issues found during testing"
```
