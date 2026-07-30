> **文档类型：历史记录** | AI 修复执行请优先阅读：`CLAUDE.md` → `docs/code-structure.md` → `docs/repair-spec-2026-07-05.md`

# AIChatMerge 稳定性修复记录

> 日期：2026-06-17
> 目标：修复生产级稳定性问题，确保商用可靠性

---

## 修复清单

| # | 优先级 | 问题 | 状态 |
|---|--------|------|------|
| 1 | 必须 | XHR 轮询泄漏 | ✅ 已修复 |
| 2 | 必须 | `__sse_fetch_active__` 卡死 | ✅ 已修复 |
| 3 | 必须 | 闭包状态污染 | ✅ 已修复 |
| 4 | 应该 | iframe 崩溃无恢复 | ✅ 已修复 |
| 5 | 应该 | 融合面板硬编码延迟 | ✅ 已修复 |
| 6 | 应该 | extractAllAnswers 状态泄漏 | ✅ 已修复 |
| 7 | 建议 | postMessage 无 origin 验证 | ✅ 已修复 |
| 8 | 建议 | MutationObserver 不清理 | ✅ 已修复 |
| 9 | 建议 | 50ms 轮询 CPU 压力 | ✅ 已修复 |

---

## 修复详情

### 1. XHR 轮询泄漏

**文件**：`sse-detect.js`
**原因**：`setInterval(50ms)` 只在 `readyState === 4` 时清除。网络断开/CORS 错误时 readyState 不会到 4，轮询永不停止。
**修复**：添加 `onerror`/`ontimeout`/`onabort` 事件清除轮询。

---

### 2. `__sse_fetch_active__` 卡死

**文件**：`sse-detect.js`
**原因**：fetch hook 的 `pull()` 内部如果 `originalReader.read()` 抛异常（网络中断），`__sse_fetch_active__` 不会被重置，TextDecoder/ReadableStream 兜底 hook 永久失效。
**修复**：在 `pull()` 的 catch 中重置 `__sse_fetch_active__`。

---

### 3. 闭包状态污染

**文件**：`sse-detect.js`
**原因**：各平台的 `parseLine` 使用闭包变量（如 `currentIsThink`、`prevContent`），如果新 SSE 流在 `reset()` 调用前开始，旧状态会污染新流。
**修复**：在 fetch hook 和 XHR hook 检测到新 SSE 流时，确保先调用 `reset()`。

---

### 4. iframe 崩溃无恢复

**文件**：`multi-panel.js`
**原因**：iframe 只有 `load` 事件处理，没有 `error` 事件监听。页面崩溃后面板永远卡在加载状态。
**修复**：添加 iframe error 事件监听，显示错误状态并提供重试按钮。

---

### 5. 融合面板硬编码延迟

**文件**：`multi-panel.js`
**原因**：新建融合面板后用 `setTimeout(2000)` 等待 iframe 加载，慢网络下 content script 未就绪导致注入失败。
**修复**：改用 content script 就绪确认机制（HEALTH_CHECK 消息），最多重试 3 次。

---

### 6. extractAllAnswers 状态泄漏

**文件**：`multi-panel.js`
**原因**：25 秒超时和正常完成路径存在竞态。超时 resolve 后 3 秒重试定时器仍会触发，向已响应的面板重复发送请求。
**修复**：超时/完成时清除重试定时器，用标志位防止重复处理。

---

### 7. postMessage 无 origin 验证

**文件**：`text-injection-all-providers.js`、`multi-panel.js`
**原因**：所有 `postMessage` 使用 `'*'` 作为 targetOrigin。恶意 iframe 可以伪造 `INJECT_TEXT`、`COMPLETION_DETECTED` 等消息。
**修复**：接收端验证 `event.source` 是否为预期的 iframe window。

---

### 8. MutationObserver 不清理

**文件**：`text-injection-all-providers.js`
**原因**：`startMutationFallback` 创建的 MutationObserver 在 SPA 导航时不会断开，导致内存泄漏。
**修复**：添加 `beforeunload` 事件清理 observer，监听 URL 变化时重置监控。

---

### 9. 50ms 轮询 CPU 压力

**文件**：`sse-detect.js`
**原因**：每个 XHR SSE 请求创建 50ms 轮询。3-5 个面板同时请求时，每秒 60-100 次轮询。
**修复**：将轮询间隔从 50ms 改为 100ms（SSE 数据到达频率通常 < 10/s，100ms 足够）。
