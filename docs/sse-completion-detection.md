> **文档类型：专题分析** | AI 修复执行请优先阅读：`CLAUDE.md` → `docs/code-structure.md` → `docs/repair-spec-2026-07-05.md`

# SSE 完成检测方案 — 问题分析与解决路径

> 2026-06-16 编写，基于对 AI对撞机（Edge Store ID: `khjmihaeihajagobgbdhlbjeobdpmfkm`）源码逆向分析

---

## 一、核心问题

AIChatMerge 需要在多面板（multi-panel）模式下，**准确检测**各个 AI 平台（DeepSeek、豆包、Kimi 等）何时完成回答，以便自动触发融合（merge）。检测必须满足：

1. **准确性** — 不能误判（AI 还在生成时就触发融合）
2. **及时性** — 不能太晚（AI 已经完成但检测延迟过大会影响体验）
3. **稳定性** — 所有 13 个平台都能工作，不能因平台更新选择器就失效
4. **容错性** — 网络异常、连接中断不能误判为完成

---

## 二、当前架构（三层检测流水线）

### 第 1 层：SSE 流结束检测（`sse-detect.js` — MAIN world）

通过 `manifest.json` 声明 `"world": "MAIN"` + `"run_at": "document_start"` 注入，运行在页面 JS 上下文中。

**机制：**
- Hook `window.fetch` → 检测 SSE 响应 → 克隆 Response → 后台读取原始 ReadableStream → `reader.read().done` 时发出完成信号
- Hook `window.EventSource` → 监听 `error` 事件 → `readyState === CLOSED` 时发出完成信号

**问题：只检测了传输层结束，没有解析 SSE 数据内容。**

```
AI平台发送 SSE 流：
  data: {"content": "正在思考..."}     ← 我们看到了但不解析
  data: {"content": "答案内容..."}     ← 我们看到了但不解析
  event: close                         ← 这是真正的完成信号，但我们没检测
  [连接保持打开]                        ← 连接可能还没关闭
```

我们只在 `reader.read()` 返回 `done: true`（传输层流结束）时才发出信号，而平台实际完成可能在流结束之前或之后。

### 第 2 层：跨 world 桥接（`content-scripts/sse-bridge.js` — isolated world）

因为 `sse-detect.js` 运行在 MAIN world，无法直接 `postMessage` 到 multi-panel parent（跨 origin iframe 边界），所以需要桥接脚本把 `__sse_complete__` 转发为 `COMPLETION_DETECTED`。

### 第 3 层：DOM 兜底检测（`content-scripts/text-injection-all-providers.js`）

独立的 DOM 检测机制，与 SSE 并行运行：

**Phase 1 — 按钮状态监控（主要）：**
- 观察"停止生成"按钮的出现（AI 开始生成）和消失（AI 完成）
- 使用平台特定选择器（`STOP_BUTTON_SELECTORS`）
- 超时 20 秒未出现按钮则进入 Phase 2

**Phase 2 — MutationObserver 文本稳定性：**
- 监听答案容器的 DOM 变化
- 追踪 `prevAnswerLen` 与当前长度
- 内容稳定 5 秒无变化 → 判定完成

**SSE 优先级：** 当 `__sse_complete__` 到达时，DOM 监控被停止（SSE 更快更可靠，优先使用）。

### 融合调度器（`multi-panel/multi-panel.js`）

- 向所有面板发送 `MONITOR_COMPLETION`
- 收到所有面板的 `COMPLETION_DETECTED` 后触发融合
- 120 秒超时强制融合（标记为 `timeout`）

---

## 三、AI对撞机的做法（参考标杆）

AI对撞机采用**SSE 数据行级解析** + **平台特定完成信号**，架构完全不同：

### 核心设计：每个平台一个 `parseLine()` 函数

AI对撞机为每个平台定义了 SSE 配置：

```javascript
{
  sse: {
    urlPattern: "/api/v0/chat/completion",        // URL 匹配
    detectionKeywords: ["event: close", ...],      // 关键字检测
    parseLine: (line) => {                         // 逐行解析
      if (line === "event: close") {
        return { text: "", isThink: null, done: true };  // ← 精确完成信号
      }
      // ... 解析内容
    }
  }
}
```

### 各平台完成信号

| 平台 | SSE URL Pattern | 完成信号 | 信号类型 |
|------|----------------|---------|---------|
| **DeepSeek** | `/api/v0/chat/completion` | `event: close` 或 `status === "FINISHED"` | SSE event 类型 |
| **豆包(Doubao)** | `/chat/completion` | `data: [DONE]` 或 `event === "SSE_REPLY_END"` 或 `end_type === 1` | SSE data 内容 |
| **千问(Qianwen)** | `/api/v2/chat` | `event:complete` | SSE event 类型 |
| **元宝(Yuanbao)** | `/api/chat/` | `data: [DONE]` | SSE data 内容 |
| **文心一言(Wenxin)** | `/eb/chat/conversation` | `data.is_end === 1` | JSON 字段 |
| **小米MiMo** | `/open-apis/bot/chat` | `data.content === "[DONE]"` | JSON 字段 |

### SSE 拦截机制（三层 Hook）

AI对撞机同时 Hook 三个层面：

1. **`window.fetch`** — 用自定义 `ReadableStream` 包装响应体，在 `pull()` 中解码并解析每一行
2. **`XMLHttpRequest`** — 每 50ms 轮询 `responseText`（兼容使用 XHR 的平台）
3. **`TextDecoder.prototype.decode`** — 拦截所有文本解码，捕获流经解码器的 SSE 内容

### 状态机维护

```javascript
sseState = {
  chunkCount: 0,           // 已接收的 chunk 数量
  endSent: false,          // 是否已发送完成信号
  fullThinkingText: "",    // 完整思考文本
  fullResponseText: "",    // 完整回答文本
  completeCalled: false    // 是否已调用完成回调
}
```

---

## 四、差距分析

| 维度 | AIChatMerge（当前） | AI对撞机（目标） |
|------|-------------------|----------------|
| **SSE 行解析** | 无。只检测传输层流结束 | 有。逐行解析，理解每个平台的线格式 |
| **完成信号** | 通用：流关闭就完成。连接断开 vs 正常完成无法区分 | 平台特定：`event: close`、`SSE_REPLY_END`、`event:complete` 等 |
| **思考/回答分离** | 无感知。无法区分思考内容和回答内容 | 每个 provider 有 `isThink` 标志，分别追踪 |
| **XHR 支持** | 无。只 Hook 了 `fetch` 和 `EventSource` | 有。Hook XHR + 50ms 轮询 |
| **内容级提前检测** | 无法在传输关闭前检测完成 | 在流内检测完成信号（如 DeepSeek 的 `event: close` 在连接关闭前触发） |
| **错误区分** | 无法区分正常完成 vs 连接错误 | 检测错误状态（如千问的 `error_code !== 0`） |
| **DOM 兜底** | 有。按钮状态 + MutationObserver（较完善） | 无。完全依赖 SSE 解析 |

### 根本差距

AIChatMerge 的 SSE 检测是**传输层**的 — 知道"流结束了"，但不知道"AI 回答完了"。

AI对撞机的 SSE 检测是**内容层**的 — 读取每一行 SSE 数据，精确理解平台在说什么（思考中、回答中、已完成、出错了）。

---

## 五、已实施的修复（结构性改进）

在分析 AI对撞机之前，已实施了以下结构性修复：

### 1. MAIN world 声明注入（修复时机竞态）

**问题：** 之前用动态 `<script>` 标签注入 `sse-detect.js`，与页面 JS 存在竞态——页面 JS 可能在 Hook 安装前就调用了 `fetch`。

**修复：** 在 `manifest.json` 中声明 `"world": "MAIN"` + `"run_at": "document_start"`，由浏览器引擎保证在页面 JS 之前执行。

### 2. Provider 检测增强

**问题：** 之前 SSE 检测不知道当前是哪个平台。

**修复：** 添加 `detectProvider()` 从 `location.hostname` 推断平台，每个 `__sse_complete__` 消息携带 `provider` 字段。

### 3. 跨 world 桥接简化

**修复：** `sse-bridge.js` 移除了动态脚本注入逻辑，改为纯消息转发。`text-injection-all-providers.js` 的 `__sse_complete__` 处理只调用 `stopCompletionMonitor()`，不再重复发送 `COMPLETION_DETECTED`。

### 4. DeepSeek 备用 URL

**修复：** 在 `SSE_PATTERNS` 中为 DeepSeek 添加 `/api/chat/completions`（备用 API 路径）。

---

## 六、待实施的核心改进

### 改进 1：SSE 行级内容解析（最高优先级）

在 `sse-detect.js` 中实现 AI对撞机式的 `parseLine()` 架构：

```
当前流程：
  fetch hook → 检测SSE响应 → 读取流 → done时发出信号

目标流程：
  fetch hook → 检测SSE响应 → 创建新ReadableStream → pull()中解码每行
    → 平台parseLine()解析 → done信号 → emitComplete()
    → 透传数据给原始消费者（页面无感知）
```

需要实现的 `parseLine` 函数：

1. **DeepSeek** — 检测 `event: close` 和 `status === "FINISHED"`
2. **豆包** — 检测 `SSE_REPLY_END` 和 `end_type === 1`
3. **千问** — 检测 `event:complete`
4. **元宝** — 检测 `data: [DONE]`
5. **文心一言** — 检测 `data.is_end === 1`
6. **Kimi** — 需逆向确认 SSE 格式
7. **智谱** — 需逆向确认 SSE 格式
8. **ChatGPT** — 检测 `data: [DONE]`
9. **Claude** — 需逆向确认 SSE 格式

### 改进 2：XMLHttpRequest Hook

当前只 Hook 了 `fetch` 和 `EventSource`。部分平台可能使用 XHR 传输 SSE。需要添加 XHR Hook（参考 AI对撞机的 50ms 轮询方式）。

### 改进 3：DOM 兜底降级

当前 DOM 检测和 SSE 检测是并列关系。改进后应将 DOM 检测降级为纯兜底：
- SSE 解析检测到完成 → 立即触发
- SSE 未检测到（平台未覆盖或 Hook 失败）→ 回退到 DOM 检测
- DOM 检测始终作为最后的安全网运行，120 秒超时触发

---

## 七、已知问题

### 秘塔AI（Metaso）

在 iframe 中报 React Error #185，秘塔检测 iframe 环境并拒绝运行。这是平台限制，非扩展 bug。可能需要探索 `sandbox` iframe 属性或其他绕过方案。

### Claude

用户无账户，未实际测试。配置已完整，需注册免费账户验证。

### 平台更新风险

SSE 格式可能随平台版本更新而变化。AI对撞机通过 `detectionKeywords` 数组做关键字匹配，比硬编码单个信号更健壮。建议我们也采用关键字数组 + 主信号双重检测。

---

## 八、参考资源

- **AI对撞机源码：** `C:\Users\huawei\AppData\Local\Microsoft\Edge\User Data\Default\Extensions\khjmihaeihajagobgbdhlbjeobdpmfkm\1.2.1_0\packages\inject\dist\standalone.js`
- **AIChatMerge SSE 检测：** `sse-detect.js`（MAIN world，162 行）
- **AIChatMerge 桥接：** `content-scripts/sse-bridge.js`（61 行）
- **AIChatMerge DOM 兜底：** `content-scripts/text-injection-all-providers.js`（3309 行，完成逻辑在 2863-3245 行）
- **AIChatMerge 融合调度：** `multi-panel/multi-panel.js`（3447 行，融合逻辑在 2384-2504 行）
