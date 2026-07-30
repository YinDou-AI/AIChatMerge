> **文档类型：历史记录** | AI 修复执行请优先阅读：`CLAUDE.md` → `docs/code-structure.md` → `docs/repair-spec-2026-07-05.md`

# 重构记录 2026-07-04

> 记录 AIChatMerge 项目拆分重构的文件变更

---

## 一、大文件拆分（3个 monolith → 模块化）

### 1. `aichatmerge-panel/multi-panel.js`（5654行 → 16个模块）

| 模块 | 行数 | 职责 |
|------|------|------|
| `modules/discussion-engine.js` | 845 | 讨论引擎核心逻辑 |
| `modules/event-handlers.js` | 521 | UI事件绑定与处理 |
| `modules/prompt-library.js` | 503 | 提示词库管理 |
| `modules/merge-engine.js` | 399 | 回答合并引擎 |
| `modules/panel-lifecycle.js` | 385 | 面板初始化与销毁 |
| `modules/send-pipeline.js` | 379 | 发送流水线 |
| `modules/iframe-comm.js` | 363 | iframe通信协议 |
| `modules/debug-log.js` | 286 | 调试日志工具 |
| `modules/i18n.js` | 286 | 内嵌中英文翻译 |
| `modules/focus-manager.js` | 236 | 焦点管理 |
| `modules/answer-extractor.js` | 218 | 回答提取 |
| `modules/merge-monitor.js` | 201 | 合并状态监控 |
| `modules/settings-loader.js` | 200 | 设置加载 |
| `modules/merge-prompt.js` | 149 | 合并提示词 |
| `modules/theme.js` | 55 | 主题切换 |
| `modules/state.js` | 38 | 全局状态 |
| **合计** | **5064** | |

### 2. `content-scripts/text-injection-all-providers.js`（3502行 → 17个模块）

使用 esbuild 打包为单个 IIFE bundle（`npm run build:content`）。

| 模块 | 行数 | 职责 |
|------|------|------|
| `src/text-injection-entry.js` | 430 | 入口：消息监听、主函数、dark mode初始化 |
| `providers/answer-extraction.js` | 551 | 4阶段回答提取 |
| `providers/completion-monitor.js` | 487 | 完成状态监控 |
| `providers/detection.js` | 440 | Hostname检测 + 选择器常量 |
| `providers/text-injection.js` | 237 | 通用注入 + Slate编辑器 |
| `providers/click-send.js` | 218 | 点击发送按钮 |
| `providers/new-chat.js` | 195 | 新建对话 |
| `providers/metaso-sidebar.js` | 188 | Metaso侧边栏 |
| `providers/dom-utils.js` | 155 | DOM工具函数 |
| `providers/google-helpers.js` | 155 | Google搜索/AI模式 |
| `providers/messaging.js` | 149 | 消息通信 + 用户交互追踪 |
| `providers/chatgpt-tracking.js` | 138 | ChatGPT发送状态追踪 |
| `providers/claude-monitor.js` | 92 | Claude不可用模型检测 |
| `providers/yuanbao-editor.js` | 64 | Yuanbao编辑器注入 |
| `providers/gemini-editor.js` | 64 | Gemini编辑器注入 |
| `providers/dark-mode.js` | 53 | iframe dark mode注入 |
| `providers/sse-text.js` | 22 | SSE文本累积 |
| **合计** | **3638** | |

构建产物：`dist/text-injection-bundle.js`（2672行，93.9kb IIFE）

### 3. `options/options.js`（929行 → 6个模块）

| 模块 | 行数 | 职责 |
|------|------|------|
| `modules/event-handlers.js` | 272 | 事件绑定与处理 |
| `modules/data-manager.js` | 246 | 数据导入导出管理 |
| `modules/settings-loader.js` | 185 | 设置加载与保存 |
| `modules/enter-key.js` | 126 | 回车键行为配置 |
| `modules/ui-helpers.js` | 117 | Toast提示、URL格式化等UI工具 |
| `modules/shortcut-helpers.js` | 54 | 快捷键管理 |
| **合计** | **1000** | |

---

## 二、配套修改的文件（6个）

### 4. `sse-detect.js`（1117行，原地修改）

**变更内容：**
- 删除了约 30 行调试 `console.log` 语句
- 在 `detectProvider()` 函数上方添加注释，说明此函数在 MAIN world 运行，无法访问 content script 中的 ProviderDetector，需与 `content-scripts/provider-detector.js` 保持同步

**删除的 console.log 示例：**
```
- console.log('[SSE Detect] Content-Type match:', contentType);
- console.log('[SSE Detect] URL pattern match:', url);
- console.log('[SSE Detect] Accept header match:', accept);
- console.log('[SSE Detect] Emitting completion for provider:', provider, ...);
- console.log('[SSE Detect] 4-layer hook installed (fetch + XHR + TextDecoder + ReadableStream)');
// ... 共约 30 处
```

### 5. `background/service-worker.js`（278行，原地修改）

**变更内容：**
- context menu 的 `sendToPanel` 调用新增 `autoSend: true` 参数（支持右键菜单自动发送）
- 删除已禁用的版本更新功能（`handleFetchLatestCommit` 及相关注释代码，共45行）

**具体改动：**
```diff
- dispatchToMultiPanel('sendToPanel', { selectedText: contentToSend });
+ dispatchToMultiPanel('sendToPanel', { selectedText: contentToSend, autoSend: true });
```

### 6. `modules/prompt-manager.js`（449行，原地修改）

**变更内容：**
- DB 版本升级 5 → 6：删除不再需要的 `tags` 索引（查询改为内存扫描）
- 新增 `isDefault` 字段：支持标记默认提示词
- 新增 `setDefaultPrompt(id)` 和 `clearDefaultPrompt()` 函数
- 删除未使用的函数：`getPromptsByCategory`、`toggleFavorite`、`getAllCategories`、`getAllTags`、`getTopFavorites`

**新增函数：**
```javascript
// 设置默认提示词（同时取消其他默认）
export async function setDefaultPrompt(promptId) { ... }

// 清除所有默认提示词
export async function clearDefaultPrompt() { ... }
```

### 7. `modules/settings.js`（157行，原地修改）

**变更内容：**
- 新增 3 个默认常量：`DEFAULT_SOURCE_URL_PLACEMENT`、`DEFAULT_MARKDOWN_EXPORT_PATH`、`DEFAULT_OBSIDIAN_VAULT_PATH`
- `DEFAULT_SETTINGS` 新增字段：`sourceUrlPlacement`、`mergeMode`、`discussRounds`、`markdownExportPath`、`markdownExportMode`、`exportInitialMerge`
- 修复 `resetSettings` 中 `chrome.storage.local.remove` 调用：参数从字符串改为数组

### 8. `modules/html-utils.js`（79行，已删除）

功能已废弃或移到其他模块，直接删除。

### 9. `modules/version-checker.js`（119行，已删除）

版本检查功能已禁用（`service-worker.js` 中对应的监听代码也一并删除），直接删除。

---

## 三、变更统计

| 类型 | 文件数 | 原始行数 | 拆分/修改后行数 |
|------|--------|----------|----------------|
| 大文件拆分 | 3 | 10085 | 9702（39个模块） |
| 配套修改 | 4 | 1999 | 1927（净减72行） |
| 配套删除 | 2 | 198 | 0 |
| **合计** | **9** | **12282** | **11629** |

净减少代码量：653行（-5.3%）
