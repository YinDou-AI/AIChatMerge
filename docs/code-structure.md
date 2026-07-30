# AIChatMerge 代码结构文档

> 更新时间：2026-07-06
> 用途：供 AI agent 快速定位模块、理解调用链、按日志前缀找到唯一主模块
> 阅读顺序：先读 `../CLAUDE.md`，再读本文件，再读 `docs/repair-spec-2026-07-05.md`。完整导航见 `docs/README.md`。

---

## 一、模块概览表

### 1.1 多面板页面（aichatmerge-panel/）

| 模块 | 文件 | 职责 | 日志前缀 |
|------|------|------|----------|
| 入口 | `multi-panel.js` | 初始化 + 事件绑定入口 | — |
| 状态 | `modules/state.js` | 全局状态集中管理 | — |
| 国际化 | `modules/i18n.js` | 翻译 + 语言检测 | — |
| 主题 | `modules/theme.js` | Material图标 + 品牌文字 | — |
| Toast | `modules/toast.js` | 消息提示 | — |
| 调试日志 | `modules/debug-log.js` | 调试日志记录/下载 | `debug:*` |
| 调试工具 | `modules/debug-log-utils.js` | debug值压缩、AI payload构建、事件分类 | — |
| 异步工具 | `modules/async-utils.js` | sleep 等纯异步工具 | — |
| 面板生命周期 | `modules/panel-lifecycle.js` | 面板增删、渲染当前分页、provider切换 | — |
| 布局配置 | `modules/layout-config.js` | 布局常量、布局规范化、分页计算 | — |
| 焦点管理 | `modules/focus-manager.js` | 统一输入框焦点恢复 + 单面板新建对话后融合协调 | — |
| 设置加载 | `modules/settings-loader.js` | 设置加载、窗口检测、状态恢复 | — |
| 事件绑定 | `modules/event-handlers.js` | 统一入口，re-export子模块 | — |
| UI绑定 | `modules/panel-ui-bindings.js` | DOM事件监听注册 | — |
| 面板菜单 | `modules/panel-menus.js` | provider切换、合并目标、添加面板 | — |
| 布局控制 | `modules/layout-controls.js` | 布局模态框、滚动箭头 | — |
| Markdown导出 | `modules/markdown-export.js` | 手动/自动/初始融合/最终讨论导出 | `markdown-export:*`, `discussion-initial-merge:*`, `discussion-final-answer:*` |
| iframe通信 | `modules/iframe-comm.js` | 统一入口，re-export子模块 | — |
| postMessage工具 | `modules/panel-postmessage.js` | 目标 origin、消息发送（纯工具） | — |
| 临时传输诊断 | `modules/provider-transport-diagnostics.js` | 内容脚本 READY/PING 探测；正式版由统一开关关闭 | `provider-transport:*` |
| Provider内容脚本恢复 | `modules/provider-content-recovery.js` | 文心内容脚本失联时请求后台按 frameId 补注入 | `provider-content-recovery:*` |
| 面板传输 | `modules/panel-transport.js` | 消息路由、存储监听 | — |
| 面板Frame配置 | `modules/panel-frame-config.js` | Provider URL、Google模式、Claude入口 | — |
| 面板健康 | `modules/panel-health.js` | 加载状态、iframe重载、健康检查 | — |
| 面板头部操作 | `modules/panel-header-actions.js` | 头部HTML、按钮绑定、Claude警告 | — |
| 新对话传输 | `modules/panel-new-chat.js` | 向单个面板发送 NEW_CHAT 消息 | — |
| 发送管线 | `modules/send-pipeline.js` | 广播、注入、恢复 | `panel-injection:*`, `panel-send:*`, `broadcast:*` |
| 发送生命周期 | `modules/send-lifecycle.js` | 发送阶段/错误码常量；从已有事件纯推导 pending 请求，不写日志、不推进业务状态 | — |
| 答案提取 | `modules/answer-extractor.js` | 从iframe提取答案 | — |
| 合并状态 | `modules/merge-state.js` | merge target / last question 状态 | — |
| 合并引擎 | `modules/merge-engine.js` | triggerMerge 入口（唯一导出） | `merge:*` |
| 面板构建 | `modules/panel-builder.js` | merge面板DOM构建（从merge-engine提取） | — |
| 合并监控 | `modules/merge-monitor.js` | 合并完成检测、面板移除后的融合状态校验 | `merge-monitor:*` |
| 融合面板注册表 | `modules/merge-panel-registry.js` | 融合面板ID集合、源面板筛选 | — |
| 合并提示词 | `modules/merge-prompt.js` | 构建初始融合/讨论复核/最终融合提示词 | — |
| 讨论引擎 | `modules/discussion-engine.js` | 统一入口，re-export子模块 | — |
| 讨论运行器 | `modules/discussion-runner.js` | 讨论主流程、状态栏、停止 | `discussion:*` |
| 讨论门控 | `modules/discussion-gates.js` | 等待条件、稳定性检测 | `discussion-wait:*`, `discussion-merge-wait:*` |
| 提示词库 | `modules/prompt-library.js` | 兼容层，re-export prompting/index.js | — |
| 提示词入口 | `modules/prompting/index.js` | 公开API（仅业务动作） | — |
| 提示词列表 | `modules/prompting/prompt-library.js` | 列表/搜索/删除确认/筛选切换 | — |
| 提示词编辑器 | `modules/prompting/prompt-editor.js` | 编辑器打开/保存/删除/变量替换（从prompt-library提取） | — |
| 默认提示词 | `modules/prompting/default-prompt.js` | 默认提示词条/前置/跳过 | — |
| 提示词状态 | `modules/prompting/prompt-state.js` | 内部状态getter/setter（不对外暴露） | — |
| 共享工具 | `modules/shared/ui-utils.js` | fitPanelSelectWidth 等 | — |

### 1.2 共享模块（modules/）

| 模块 | 文件 | 职责 |
|------|------|------|
| 提示词数据层 | `prompt-manager.js` | IndexedDB CRUD、导入导出 |
| Provider定义 | `providers.js` | 14个AI provider元数据 |
| Provider默认 | `provider-defaults.js` | 默认provider列表 |
| 设置 | `settings.js` | chrome.storage 封装 |
| 评分管理 | `score-manager.js` | 评分历史保存 |
| 主题管理 | `theme-manager.js` | 深色/浅色主题切换 |
| 国际化 | `i18n.js` | 共享翻译（background用） |
| 消息通信 | `messaging.js` | runtime消息封装 |
| Obsidian导出 | `obsidian-export.js` | Markdown导出逻辑 |
| 文本注入器 | `text-injector.js` | 文本注入工具 |
| Google模式 | `google-mode.js` | Google AI/Search模式 |
| Claude入口 | `claude-entry-url.js` | Claude自定义入口URL |
| URL校验 | `url-validator.js` | URL格式校验 |
| 临时诊断配置 | `diagnostic-config.js` | 正式版统一关闭临时诊断及协议版本 |

### 1.3 设置页（options/）

| 模块 | 文件 | 职责 |
|------|------|------|
| 入口 | `options.js` | 设置页主入口 |
| 通用设置 | `modules/general-settings.js` | DOM事件监听（原event-handlers） |
| 设置显示 | `modules/settings-display.js` | 域命名入口，→ settings-loader.js |
| 设置加载 | `modules/settings-loader.js` | 从storage加载设置并显示 |
| 数据管理 | `modules/data-manager.js` | 提示词导入导出、评分历史 |
| 导入导出 | `modules/import-export-settings.js` | 域命名入口，→ data-manager.js |
| 回车键 | `modules/enter-key.js` | 回车键行为设置 |
| 快捷键 | `modules/shortcut-helpers.js` | 快捷键辅助 |
| UI辅助 | `modules/ui-helpers.js` | 通用UI工具 |

### 1.4 内容脚本（content-scripts/）

| 模块 | 文件 | 职责 |
|------|------|------|
| 主入口 | `src/text-injection-entry.js` | 事件路由 + handleTextInjection |
| Provider检测 | `src/providers/detection.js` | hostname检测 + 选择器常量 |
| 文本注入 | `src/providers/text-injection.js` | textarea/contenteditable/Slate注入，按 provider 分派特殊编辑器 |
| 提交核心 | `src/submission/` | `SendResult`、标准错误码、单次点击、纯 snapshot 确认观察；不得包含 provider/DOM 差异 |
| 提交注册表 | `src/providers/submit-adapter-registry.js` | provider 到新提交 adapter 的唯一映射入口 |
| 豆包提交 | `src/providers/doubao/` | 豆包 composer/发送/停止/回答选择器、adapter、提交延迟策略 |
| Kimi完成策略 | `src/providers/kimi/completion-policy.js` | Kimi精确停止按钮选择器、10秒答案稳定窗口；禁止短暂停止按钮捷径 |
| 发送兼容入口 | `src/providers/click-send.js` | 新 adapter 分派 + 尚未迁移 provider 的旧 DOM 兼容；所有路径最多点击一次 |
| 答案提取 | `src/providers/answer-extraction.js` | 4阶段答案提取 |
| 答案选择器 | `src/providers/answer-selectors.js` | 答案/复制按钮选择器常量（从answer-extraction提取） |
| 完成监控 | `src/providers/completion-monitor.js` | 按钮状态 + MutationObserver；直接选择器失效时复用 provider 答案提取器，Kimi 算力不足错误作为终止信号 |
| 平台终止响应 | `/modules/provider-terminal-responses.js` | 共享“请求已结束但没有有效答案”的文本契约；完成监控用于结束等待，答案提取用于排除错误提示 |
| 完成常量 | `src/providers/completion-constants.js` | 停止按钮/SSE层配置常量（从completion-monitor提取） |
| DOM工具 | `src/providers/dom-utils.js` | 元素可见性、Shadow DOM |
| 消息通信 | `src/providers/messaging.js` | extension通信 + 状态上报 |
| 临时传输诊断 | `src/providers/transport-diagnostics.js` | READY/PONG；正式版由统一开关关闭 |
| Google | `src/providers/google-helpers.js` | Google特殊处理 |
| ChatGPT | `src/providers/chatgpt-tracking.js` | 发送状态追踪 |
| Claude | `src/providers/claude-monitor.js` | 不可用模型检测 |
| Yuanbao | `src/providers/yuanbao-editor.js` | Quill编辑器注入 |
| Gemini | `src/providers/gemini-editor.js` | Quill 编辑器多行注入、完整性校验 |
| 秘塔 | `src/providers/metaso-sidebar.js` | 侧边栏折叠 + 注入 |
| 新对话 | `src/providers/new-chat.js` | 新建对话 + 临时对话 |
| SSE文本 | `src/providers/sse-text.js` | SSE流文本累积 |
| 暗色模式 | `src/providers/dark-mode.js` | iframe暗色模式注入 |

### 1.5 后台（background/）

| 模块 | 文件 | 职责 |
|------|------|------|
| Service Worker | `service-worker.js` | 后台入口、消息路由；文心内容脚本失联时按 frameId 受控补注入 |

---

## 二、核心入口函数表

### 2.1 多面板入口（multi-panel.js）
```
init()
  → applyTheme()
  → detectLocale() + applyI18n()
  → registerRuntimeMessageListener(getIsInitialized)  ← 真实初始化门控
  → registerStorageChangeListener()
  → detectWindowType()                                ← 检测窗口模式并更新toggle按钮
  → restoreStateIfNeeded()
  → loadSettings()                                    ← 设置 isInitialized = true
  → initializePanels()
  → renderCurrentPage()
  → setupEventListeners()
  → focusUnifiedInput()
  → handlePendingMultiPanelAction()
  → updateDefaultPromptBar()
  → bindDefaultPromptEvents()
```

**关键状态桥接说明：**

| 状态 | 真实来源 | 消费方 |
|------|----------|--------|
| `isInitialized` | `settings-loader.js` 内部变量，`loadSettings()` 成功后设为 `true` | `registerRuntimeMessageListener(getIsInitialized)` — 控制运行时消息是否处理 |
| `isPopupWindow` | `settings-loader.js` 内部变量，`detectWindowType()` 从 `chrome.windows.getCurrent()` 读取 | `updateToggleButton(isPopupWindow)` — 控制切换按钮图标 |
| ChatGPT send tracking | `content-scripts/src/providers/chatgpt-tracking.js` | `panel-transport.js` 的 `handleProviderStatusMessage` 接收 `ACM_PROVIDER_IDLE`/`ACM_PROVIDER_BUSY` |
| Auto merge completion session | `merge-monitor.js` 内部 `completionSessionGeneration` + `activeCompletionSessionGeneration` | `handleMergeCompletionDetected()` — 过滤旧会话/讨论轮次迟到的完成事件 |

### 2.2 合并主流程（merge-engine.js → triggerMerge）
```
triggerMerge({ panels, mergePanelIds })
  → extractAllAnswers({ timeoutMs: 2500, excludeUnreachablePanels: true })  // 只等可通信面板，无固定延迟
  → buildMergePrompt()
  → buildMergePanel({ panelId, provider, targetProvider, ... })  // panel-builder.js
  → sendToPanel(mergePanel, mergePrompt)
  → postToPanelIframe(MONITOR_COMPLETION)
  → startDiscussionAfterMerge()  // 如果启用讨论
  → autoExportToMarkdown()       // 如果启用自动导出
```

### 2.2.0 面板构建（panel-builder.js）
```
buildMergePanel({ panelId, provider, targetProvider, question, validAnswers, mergeMode, discussRounds })
  → { panelEl, iframe, panelData }
```

### 2.2.1 自动融合完成监控（merge-monitor.js）
```
setupEventListeners()
  → startMergeMonitor(mergeSessionId, panels, mergePanelIds)
  → postToPanelIframe(MONITOR_COMPLETION) 到每个非融合面板
  → content-scripts/src/providers/completion-monitor.js 检测完成
  → panel-transport.js 注入 panelId fallback
  → handleMergeCompletionDetected(data, panels, mergePanelIds)
    → 校验 activeMergeSessionId
    → 校验 completionSessionGeneration
    → 累加 mergeCompletedPanels
    → 全部完成或 MERGE_MAX_WAIT 超时
    → stopMergeMonitor()
    → triggerMerge({ panels, mergePanelIds })
```

自动融合以旧单体 `D:\D\zcode\AIChatMerge - 副本\aichatmerge-panel\multi-panel.js` 为行为基线。zcode 目录只作为只读参考，修复只修改 `D:\D\cc\AIChatMerge-refactor`。重构后 `merge-monitor.js` 不静态依赖 `merge-engine.js`；自动完成、超时和面板移除补偿都通过动态加载 `merge-engine.js` 触发融合。如果动态加载失败，会记录 `merge-monitor:trigger-load-failed`。

面板删除时，`panel-lifecycle.js` 只负责删除 DOM 和面板数组；源面板删除后的融合状态补偿由 `merge-monitor.js` 的 `reconcileAfterPanelRemoval(removedPanelId, panels, mergePanelIds)` 处理。该函数会移除已完成集合中的删除面板，判断剩余非融合面板是否已全部完成，并在自动融合开启时触发融合。单面板新建对话时，`focus-manager.js` 的 `startFreshChatForPanel` 也会调用同一函数，因为面板回答已清空等效于面板从融合中移除。

### 2.2.2 布局配置（layout-config.js）
```
normalizeLayout(layout) → layout
getPanelsPerPage(layout) → number
getPanelPageIndex(panelIndex, layout) → number
getTotalPages(panelCount, layout) → number
```

`layout-config.js` 是零依赖纯工具模块。布局常量和分页计算不得重新放回 `panel-lifecycle.js`，避免 `send-pipeline.js`、`merge-engine.js`、`panel-ui-bindings.js` 为了读取布局配置而依赖面板生命周期模块。

### 2.2.3 融合面板注册表（merge-panel-registry.js）
```
getMergePanelIds() → Set<string>
isMergePanel(panel) → boolean
getNonMergePanels() → Panel[]
```

`merge-panel-registry.js` 是融合面板 ID 集合的单一状态源。`send-pipeline.js` 为旧引用暂时 re-export 这些函数，但新代码应直接依赖 `merge-panel-registry.js`。不要把 `mergePanelIds` 放回发送管线，否则会重新形成 `send-pipeline ↔ panel-lifecycle` 循环依赖。

### 2.3 讨论主流程（discussion-engine.js → startDiscussionAfterMerge）
```
startDiscussionAfterMerge(mergedPrompt, totalRounds, mergePanel, opts)
  → waitForDiscussionStartGate()        // 等待初始合并完成
  → extractAllAnswers()                 // 提取各面板答案
  → buildDiscussPrompt()                // 构建讨论提示词
  → sendToPanel(各面板, discussPrompt)  // 发送讨论
  → waitForDiscussionPanelsCompletionWithAbort()  // 等待完成
  → buildFinalMergePrompt()             // 构建讨论后的最终融合提示词
  → sendToPanel(mergePanel, mergePrompt) // 发送合并
  → waitForDiscussionMergeCompletionWithFallback() // 等待合并完成
  → exportToMarkdown()                  // 自动导出
```

### 2.3.1 提示词构建（merge-prompt.js）
```
buildMergePrompt(question, answers) → string              // 初始融合：多模型原始回答 → 完整融合答案
buildDiscussPrompt(question, mergedAnswer) → string       // 讨论复核：当前融合答案 → 修正/补充/反对意见
buildFinalMergePrompt(question, previousMergedAnswer, reviewAnswers) → string  // 最终融合：复核意见 → 完整最终答案
```

### 2.4 内容脚本入口（text-injection-entry.js → handleTextInjection）
```
handleTextInjection(event)
  → detectProvider()
  → injectTextIntoElement() / injectTextIntoSlateEditor()
    → injectTextIntoGeminiEditor() // Gemini .ql-editor 多行 paste + DOM 段落兜底
  → postMessage(INJECT_TEXT_RESULT) // 只表示文本注入成功
  → attemptAutoSubmitOnce()
    → captureSubmitBaseline()       // 点击前记录 composer/停止按钮/最新答案
    → clickSendButton()
    → postMessage(SUBMIT_TEXT_DISPATCH_RESULT) // 点击结果，释放串行队列
    → verifySubmitConfirmed()       // 后台单次观察，不重试、不影响发送
  → postMessage(SUBMIT_TEXT_RESULT) // 仅报告确认/未确认诊断
```

---

## 三、事件映射表

### 3.1 多面板事件前缀

| 事件前缀/事件名 | 文件 | 入口函数 | 说明 |
|---|---|---|---|
| `merge:*` | `aichatmerge-panel/modules/merge-engine.js` | `triggerMerge()` | 合并主流程 |
| `merge-monitor:*` | `aichatmerge-panel/modules/merge-monitor.js` | `startMergeMonitor()` | 合并完成监控 |
| `completion:*` | `aichatmerge-panel/modules/merge-monitor.js` | `handleMergeCompletionDetected()` | 完成事件会话校验/忽略原因 |
| `completion-session:*` | `aichatmerge-panel/modules/merge-monitor.js` | `invalidateCompletionSessions()` | 新对话/停止讨论时使旧完成事件失效 |
| `merge-panel:*` | `aichatmerge-panel/modules/merge-monitor.js` | `handleMergeCompletionDetected()` | 融合面板完成事件转发给讨论流程 |
| `discussion:*` | `aichatmerge-panel/modules/discussion-runner.js` | `startDiscussionAfterMerge()` | 讨论主流程 |
| `discussion-wait:*` | `aichatmerge-panel/modules/discussion-gates.js` | `waitForDiscussionStartGate()` | 讨论等待门控 |
| `discussion-merge-wait:*` | `aichatmerge-panel/modules/discussion-gates.js` | `waitForDiscussionMergeCompletionWithFallback()` | 讨论合并等待 |
| `discussion-final-answer:*` | `aichatmerge-panel/modules/discussion-runner.js` | `startDiscussionAfterMerge()` 内部 | 讨论最终答案解析 |
| `discussion-wait:final-merge:*` | `aichatmerge-panel/modules/discussion-gates.js` | `waitForFinalMergeAnswerBeforeExport()` | 等待最终合并答案 |
| `markdown-export:*` | `aichatmerge-panel/modules/markdown-export.js` | `autoExportToMarkdown()` / `handleManualExport()` | Markdown导出 |
| `panel-injection:*` | `aichatmerge-panel/modules/send-pipeline.js` | `handlePanelInjectionResult()` | 注入结果处理 |
| `panel-submit:*` | `aichatmerge-panel/modules/send-pipeline.js` | `handlePanelSubmitDispatchResult()` / `handlePanelSubmitResult()` | 点击业务结果与后台确认诊断 |
| `panel-send:*` | `aichatmerge-panel/modules/send-pipeline.js` | `sendToPanel()` | 面板发送 |
| `broadcast:*` | `aichatmerge-panel/modules/send-pipeline.js` | `broadcastMessage()` | 广播发送 |
| `claude-entry-warning:*` | `aichatmerge-panel/modules/panel-header-actions.js` | `showClaudeEntryWarning()` | Claude入口警告（通过 `iframe-comm.js` re-export） |

### 3.2 内容脚本事件

| 事件名 | 文件 | 函数 | 说明 |
|--------|------|------|------|
| `text-injection:inject:start` | `src/text-injection-entry.js` | `handleTextInjection()` | 开始注入文本 |
| `text-injection:send:click` | `src/providers/click-send.js` | `clickSendButton()` | 点击发送按钮 |
| `text-injection:extract:phase1` | `src/providers/answer-extraction.js` | `extractByDirectSelector()` | 直接选择器提取 |
| `text-injection:completion:detected` | `src/providers/completion-monitor.js` | `notifyCompletion()` | 完成检测 |

### 3.3 postMessage 协议

| type | context | 方向 | 说明 |
|------|---------|------|------|
| `INJECT_TEXT` | `auto-merge` | 面板→内容脚本 | 注入文本 |
| `CLEAR_INPUT` | — | 面板→内容脚本 | 清除输入 |
| `TRIGGER_SEND` | `multi-panel` | 面板→内容脚本 | 不注入文本，直接触发发送，并取消旧自动提交重试 |
| `NEW_CHAT` | `multi-panel` | 面板→内容脚本 | 新建对话 |
| `MONITOR_COMPLETION` | `multi-panel` | 面板→内容脚本 | 开始监控完成 |
| `STOP_MONITORING` | `multi-panel` | 面板→内容脚本 | 停止完成监控，并取消旧自动提交重试 |
| `COMPLETION_DETECTED` | `multi-panel-completion` | 内容脚本→面板 | 完成检测通知 |
| `EXTRACTED_ANSWER` | `multi-panel-answer` | 内容脚本→面板 | 提取的答案 |
| `INJECT_TEXT_RESULT` | `multi-panel-injection` | 内容脚本→面板 | 注入结果 |
| `SUBMIT_TEXT_DISPATCH_RESULT` | `multi-panel-submission-dispatch` | 内容脚本→面板 | 是否找到并点击发送键；用于推进串行队列，正式包保留 |
| `SUBMIT_TEXT_RESULT` | `multi-panel-submission` | 内容脚本→面板 | 点击后的确认观察，仅用于诊断，不触发重试 |
| `HEALTH_CHECK` | `multi-panel` | 面板→内容脚本 | 健康检查 |
| `HEALTH_CHECK_RESULT` | `multi-panel-health` | 内容脚本→面板 | 健康检查结果 |
| `CLAUDE_ENTRY_WARNING` | `claude-entry-warning` | 内容脚本→面板 | Claude入口警告 |
| `ACM_PROVIDER_BUSY` | `multi-panel-provider-status` | 内容脚本→面板 | Provider忙碌 |
| `ACM_PROVIDER_IDLE` | `multi-panel-provider-status` | 内容脚本→面板 | Provider空闲 |

---

## 四、关键调用链

### 4.1 发送消息流程
```
用户输入 → setupEventListeners()
  → startMergeMonitor(mergeSessionId)  // 自动融合开启时
  → 点击发送按钮：sendMessageWithDefaultPrompt(input, broadcastMessage, true)
  → 按 Enter：sendMessageWithDefaultPrompt(input, broadcastMessage, true, mergeSessionId)
  → broadcastMessage(text, true, mergeSessionId?)
  → 串行 sendToPanel(每个面板)
    → probePanelContentScript()
    → 文心无 READY/PONG 时请求 Service Worker 对目标 frame 补注入并重试（不刷新页面）
    → postToPanelIframe(INJECT_TEXT)
    → handlePanelInjectionResult()       // autoSubmit=false 时可结束
    → handlePanelSubmitDispatchResult() // 点击成功/找不到按钮后推进下一面板
    → handlePanelSubmitResult()          // 后台确认诊断，不阻塞队列
```

说明：点击发送按钮路径必须对齐 zcode 单体行为：先启动 `startMergeMonitor()`，再走 `sendMessageWithDefaultPrompt(input.value)`，不要把 `mergeSessionId` 二次传入按钮路径的 `broadcastMessage()`。Enter 路径保留 `mergeSessionId` 参数。

自动提交约定（不建立复杂业务状态机）：

```
串行业务：injecting → clicked | send-control-not-found
后台诊断：clicked → confirmed | unconfirmed
```

- `INJECT_TEXT_RESULT.injectSuccess=true` 只允许进入 `injected`，不能显示“已发送”。
- 页面加载完成是发送前置条件；自动提交只查找一次发送键并最多点击一次。找不到或无法点击统一返回 `SEND_CONTROL_NOT_FOUND`。
- 广播必须串行；只等待当前面板的点击业务结果，不等待提交确认或 AI 回答。
- 提交确认比较点击前后状态，只认可 composer 中本次文本消失、停止按钮从无到有、或最新答案相对基线新增/增长。
- 页面中原本存在的停止按钮、历史回答或隐藏 composer 不能作为本次提交成功证据。
- 点击后未观察到确认只记 `panel-submit:unconfirmed`，不得再次点击，也不得把已经执行的点击改判为业务发送失败。
- `sendToPanel(..., autoSubmit=true)` 收到 `SUBMIT_TEXT_DISPATCH_RESULT.dispatched=true` 即返回 `true` 并推进下一个面板。

豆包已迁移到 adapter 提交框架：

```
click-send.js
  → submit-adapter-registry.js
  → providers/doubao/adapter.js          // 只负责读取/操作豆包 DOM
  → submission/attempt-submit.js         // provider 无关、单次查找与单次点击
  → submission/submit-snapshot.js        // 纯 before/after 比较
  → SendResult { ok, provider, stage, code, requestId, attempt, evidence }
```

`submission/` 禁止出现 provider 名、`document`、选择器和面板 import。豆包
选择器只在 `providers/doubao/selectors.js` 定义；`detection.js`、
`answer-selectors.js`、`completion-constants.js` 只引用该常量。千问、Claude、
Gemini 等尚未迁移平台继续走 `click-send.js` 旧路径，迁移时必须逐个平台使用
同一契约测试，不允许一次性批量改写。

### 4.2 合并流程
```
自动完成/超时 → merge-monitor.js
  → merge-monitor:all-complete-auto-merge 或 merge-monitor:timeout
  → stopMergeMonitor()
  → triggerMerge({ panels, mergePanelIds })
手动合并按钮 → triggerMerge()
  → 按钮进入 busy/disabled，重复点击复用当前任务
  → extractAllAnswers({ timeoutMs: 2500, excludeUnreachablePanels: true })
  → buildMergePrompt()
  → sendToPanel(mergePanel)
  → startMergeMonitor()
    → handleMergeCompletionDetected()
    → autoExportToMarkdown() 或 startDiscussionAfterMerge()
```

### 4.6 自动融合故障排查路径

现象：AI 回答完成后，融合按钮恢复正常但没有出现融合面板。

按日志顺序定位：

| 日志/现象 | 主文件 | 下一步 |
|---|---|---|
| 有 `merge-monitor:start`，没有 `merge-monitor:panel-complete` | `panel-transport.js` / `completion-monitor.js` | 检查 `COMPLETION_DETECTED` 是否到达父页面，是否带上 `panelId` fallback |
| 有 `merge-monitor:panel-complete`，没有 `merge-monitor:all-complete-auto-merge` | `merge-monitor.js` | 检查 `getNonMergePanels()` 数量、`mergeCompletedPanels` 是否按 panelId 去重 |
| 有 `merge-monitor:all-complete-auto-merge` 或 `merge-monitor:timeout`，没有 `merge:trigger-start` | `merge-monitor.js` | 检查动态加载 `merge-engine.js` 是否失败；看是否出现 `merge-monitor:trigger-load-failed` |
| 有 `merge:trigger-start`，随后 `merge:aborted-no-valid-answers` | `answer-extractor.js` / `content-scripts/src/providers/answer-extraction.js` | 检查 `EXTRACTED_ANSWER` 是否返回非空 answer |
| 新对话或停止讨论后仍触发旧融合 | `merge-monitor.js` / `discussion-runner.js` / `send-pipeline.js` / `focus-manager.js` | 检查 `completion-session:invalidate` 和 `completion:ignored-stale-generation` |
| 全部新建会话后融合面板又开始旧融合 | `merge-engine.js` / `merge-monitor.js` | 检查 `merge:aborted-stale-trigger`、`merge:skip-stale-new-panel-load`、`merge:skip-stale-new-panel-inject`；旧 `triggerMerge()` 或新融合面板 load/retry 必须被 completion generation 拦截 |
| 全部新建会话后旧输入又被自动发送 | `content-scripts/src/providers/click-send.js` / `content-scripts/src/text-injection-entry.js` | 检查 `NEW_CHAT`、`CLEAR_INPUT`、`TRIGGER_SEND`、`STOP_MONITORING` 是否调用 `cancelPendingAutoSubmit()`；旧 `attemptAutoSubmitWithRetry()` 定时器不得继续点击发送 |
| `panel-injection:success` 后仍未真正发送 | `click-send.js` / `send-pipeline.js` | 继续检查同一 `injectionRequestId` 的 `text-injection:submit-confirmed`、`panel-submit:success/failed/timeout`；注入成功不代表提交成功 |
| Gemini 只插入提示词第一行或前缀 | `content-scripts/src/providers/text-injection.js` / `content-scripts/src/providers/gemini-editor.js` | `text-injection.js` 必须把 `.ql-editor` 分派给 `injectTextIntoGeminiEditor()`；Gemini 注入需先 paste，失败时按行写入 `<p>`，再用 `hasExpectedGeminiText()` 校验完整文本 |

调试日志导出说明：

- `modules/debug-log.js` 导出的 JSON 是短诊断报告，不是完整原始日志转储。
- `verdict.status` 取 `pending / ok / failed`；优先读取 `stage`、`code`、`evidence[].requestId`。
- `pending` 由 `send-lifecycle.js` 对 `panel-send:start` 与终态事件做差集推导，不写轮询日志。
- `panel-submit:timeout` 表示点击业务回执没有到达，固定归类为 `stage=transport`、`code=SUBMIT_RESULT_TIMEOUT`；它不是“确认没检测到”。
- AI 排障阅读顺序：先看 `summary`，再看 `diagnostics.autoMerge`，再看 `issues`、`sessions`、`timeline`。
- `diagnostics.autoMerge.latestTimeout` 会给出最近一次超时融合的 `completedProviders`、`missingProviders`、`missingPanels` 和 `triggerAfterTimeout`。
- 如果 `triggerAfterTimeout: true`，说明不是“没有触发融合”，而是完成检测未收齐，超时后仍进入了 `merge:trigger-start`。
- `merge-monitor:timeout` 源事件会记录 `missingPanels`，用于定位具体未上报完成的 provider。
- `timeline` 只保留最近 40 条关键事件和排障字段；`rawTail` 只保留 5 条极短尾部样本；`issues` 只保留最近 15 条。不要要求 AI 读取几千行完整日志。
- `discussion:send-results` 在导出报告里必须压缩为 `resultsSummary`，只保留成功/失败计数、provider 列表和失败面板摘要，不展开所有面板结果。
- 导出格式必须保留 panel/provider/answer 摘要，不允许把 `panelId/providerId` 压成无意义占位符。

对应回归测试：

| 测试 | 覆盖 |
|---|---|
| `tests/debug-log.test.js` | 调试日志关键事件识别、超时融合诊断、panel/provider 摘要压缩 |
| `tests/completion-panelid-fallback.test.js` | 完成事件按接收 iframe 的 panelId 归属，并触发自动融合 |
| `tests/merge-state-ownership.test.js` | `merge-monitor.js` 是 merge 状态唯一事实源 |
| `tests/click-send-auto-submit.test.js` | 点击前基线、旧停止按钮、答案增长、吞点击不重试 |
| `tests/doubao-submit-contract.test.js` | 豆包第一次/第二次发送、单次点击、独立确认观察、找不到控件、取消 |
| `tests/doubao-submit-dispatch.test.js` | 豆包从兼容入口进入 Promise adapter，并保留 requestId/取消结果 |
| `tests/submit-snapshot.test.js` | provider/DOM 无关的提交 snapshot 比较 |
| `tests/submission-architecture.test.js` | 核心无 provider/DOM、adapter 不依赖面板、豆包选择器集中 |
| `tests/active-answer-extraction.test.js` | 活跃提取器按 DOM 顺序取最新千问回答并拒绝宽泛 class |
| `tests/send-pipeline.test.js` | 注入/点击/确认协议、广播串行且不等待确认 |
| `tests/merge-engine.test.js` | `triggerMerge()` 创建/复用融合面板并注入融合提示词；新会话后旧融合 trigger/load/retry 不得继续注入 |
| `tests/discussion-runner.test.js` | 讨论流程和 completion session generation 不互相污染 |
| `tests/markdown-export.test.js` | 初始融合导出必须使用 `mode: merge`，最终讨论导出使用 `mode: discuss` |
| `tests/obsidian-export.test.js` | 导出文件名不使用 `AI融合-日期-时间` 内部 fallback 标题，防止 `AI讨论-AI融合-...` |
| `tests/send-pipeline.test.js` | 广播发送、注入结果、非融合面板选择 |
| `tests/module-acyclic.test.js` | `aichatmerge-panel/modules/` 静态 import 循环依赖防回归 |
| `tests/click-send-auto-submit.test.js` | 内容脚本单次自动提交与取消；新发送/新会话后旧定时器不得点击 |
| `tests/doubao-content-script.test.js` | message 路径下 `NEW_CHAT` 取消已排队自动发送 |
| `tests/gemini-editor.test.js` | Gemini `.ql-editor` 多行提示词注入不得截断 |

推荐最小验证命令：

```bash
npm test -- --run tests/panel-ui-bindings-auto-merge.test.js tests/completion-panelid-fallback.test.js tests/merge-state-ownership.test.js tests/merge-engine.test.js tests/discussion-runner.test.js tests/send-pipeline.test.js
```

### 4.3 讨论流程
```
startDiscussionAfterMerge()
  → waitForDiscussionStartGate()  // 轮询等待新答案稳定
  → buildDiscussPrompt()
  → sendToPanel(各面板)
  → exportMergeResult()           // 可选：讨论提示词发送后异步导出初始融合，mode=merge
  → waitForDiscussionPanelsCompletionWithAbort()
  → buildFinalMergePrompt()
  → sendToPanel(mergePanel)
  → waitForDiscussionMergeCompletionWithFallback()
  → exportDiscussionResult()      // 导出最终讨论结果，mode=discuss
```

导出命名/顺序约束：`generateFallbackTitle()` 生成的 `AI融合-YYYY-MM-DD-HHMMSS` 只用于内部兜底显示，不作为 Markdown 文档标题或文件名标题。文件名前缀由导出 `mode` 决定：初始融合是 `AI融合`，最终讨论是 `AI讨论`。讨论模式下必须先向各面板发送讨论提示词，再异步导出初始融合，避免 Markdown 下载阻塞讨论发送。

### 4.4 提示词流程
```
openPromptModal() → loadPromptLibrary() → renderPromptList()       // prompt-library.js
selectPrompt() → detectVariables() → showVariableModal() → applyVariables() → applyPromptToInput()  // prompt-editor.js
openPromptEditor() → loadPromptForEditing() → savePromptFromEditor()  // prompt-editor.js
sendMessageWithDefaultPrompt() → prependDefaultPrompt() → broadcastMessage()  // default-prompt.js
```

### 4.4.0.1 调试日志核心（debug-log.js）
```
recordDebugLog(event, details) → void          // 异步写入 chrome.storage.local
downloadDebugLogs(options?, showToast?) → void  // 导出 JSON 诊断报告
clearDebugLogs(showMessage?) → void             // 清空日志
setMergePanelIds(ids) → void                    // 设置融合面板 ID 集合（供 panel 摘要用）
setDiscussionWillRun(value) → void              // 标记当前轮次是否进入讨论模式，控制自动导出互斥
getDebugSessionId() → string                    // 当前 session ID
```

`setDiscussionWillRun` 由 `merge-engine.js` 在 `triggerMerge()` 内部调用：入口重置为 `false`，进入讨论模式前设为 `true`。调试日志自动下载由 `debugAutoDownloadLogs` 设置控制（调试版默认开启，正式版被 `DEBUG_EXPORT_ENABLED` 闸死），完成事件包括 `merge-panel:completion-detected`（融合完成，讨论模式下跳过——讨论结束的导出已含完整会话日志）、`discussion:completed`（讨论结束）、`markdown-export:auto-success`、`discussion-final-answer-auto-success`、`discussion-final-answer:auto-success`，发送链路失败事件（`panel-injection:give-up`、`text-injection:submit-failed`、`text-injection:composer-verification-failed`）也会触发；同一会话内按「会话+事件」里程碑去重，各里程碑只导一次。下载优先走 `chrome.downloads.download`，回退到临时 `<a>` 下载。

正式版不靠逐个删除调用点关闭日志。`scripts/package-release.js` 在 staging 中执行以下隔离：

1. 将 `DEBUG_LOGGING_ENABLED` 和 `DEBUG_EXPORT_ENABLED` 改为 `false`。
2. 用 `debug-log.release.js` 的无副作用兼容接口替换 `debug-log.js`。
3. 删除日志分析、结论生成和自驱动巡检模块。
4. 将 `ENABLE_CONTENT_SCRIPT_DIAGNOSTICS` 改为 `false`，重新构建正式版 content bundle。
5. 从面板页和设置页 HTML 物理删除 `DEBUG_ONLY` 标记块。
6. 保留 `INJECT_TEXT_RESULT`、`SUBMIT_TEXT_RESULT` 等业务协议，但移除其中的诊断 payload；不再发送 `INJECTION_DIAGNOSTIC`、`COMPLETION_DIAGNOSTIC`、READY/PING/PONG。

`debug-log.release.js` 是发布模板，不是业务模块。新业务代码仍只依赖
`debug-log.js` 的稳定接口，禁止直接 import 发布模板。日志接口不得参与成功或
失败判定；正式版替换为空实现后，发送、完成监控和提取行为必须完全一致。

### 4.4.1 调试日志分析（debug-log-utils.js）
```
compactDebugValue(value, depth) → compacted
buildDebugAiPayload(logs, sessionId) → AI可读报告
buildDebugTimeline(logs) → timeline[]
extractDebugIssues(logs) → issues[]
```

### 4.5 内容脚本调用链
```
message事件 → text-injection-entry.js
  ├→ detection.js (检测provider)
  ├→ text-injection.js (注入文本)
  │   ├→ yuanbao-editor.js
  │   ├→ gemini-editor.js
  │   └→ metaso-sidebar.js
  ├→ google-helpers.js (Google特殊)
  ├→ click-send.js (发送)
  ├→ new-chat.js (新对话)
  ├→ answer-extraction.js (提取答案)
  └→ completion-monitor.js (监控完成)
      └→ sse-text.js (SSE文本累积)
```

---

## 五、IndexedDB 数据模型（prompt-manager.js）

```javascript
{
  id: number,           // 自增主键
  title: string,        // 标题（最大200字符）
  content: string,      // 内容（最大50000字符）
  category: string,     // 分类（最大50字符）
  tags: string[],       // 标签（已废弃，保留空数组）
  variables: string[],  // 变量列表（自动检测）
  isFavorite: boolean,  // 是否收藏
  isDefault: boolean,   // 是否为默认提示词
  createdAt: number,    // 创建时间戳
  lastUsed: number|null,// 最后使用时间
  useCount: number      // 使用次数
}
```

---

## 六、构建说明

| 产物 | 源码 | 构建命令 |
|------|------|----------|
| `content-scripts/text-injection-all-providers.js` | `content-scripts/src/` | `npm run build:content` |

- esbuild IIFE bundle，不手动编辑
- 修改 `src/` 后需重新构建
- `npm run release:package` 会在 staging 内再次构建关闭内容脚本诊断的正式产物；
  不能直接把仓库中的调试 bundle 当作商店发布包

---

## 七、遗留文件与兼容性层说明

### 7.1 兼容性 re-export 层

**规则：新代码不得新增对兼容层的依赖，必须直接引用领域模块。**

活跃业务模块（panel-lifecycle、panel-ui-bindings、send-pipeline、settings-loader 等）已直接依赖领域模块。入口文件 `multi-panel.js` 仍通过兼容层导入（`iframe-comm.js`、`event-handlers.js`），这是遗留引用，未来迁移后可删除兼容层。

| 路径 | 指向 | 说明 |
|------|------|------|
| `aichatmerge-panel/modules/event-handlers.js` | `panel-ui-bindings.js` + `panel-menus.js` + `layout-controls.js` + `markdown-export.js` | 旧导入路径兼容 |
| `aichatmerge-panel/modules/iframe-comm.js` | `panel-transport.js` + `panel-frame-config.js` + `panel-health.js` + `panel-header-actions.js` + `settings-loader.js` | 旧导入路径兼容 + settings-loader 回调桥接 |
| `aichatmerge-panel/modules/discussion-engine.js` | `discussion-runner.js` + `discussion-gates.js` | 旧导入路径兼容 |
| `aichatmerge-panel/modules/prompt-library.js` | `prompting/index.js` | 旧导入路径兼容 |
| `options/modules/event-handlers.js` | `options/modules/general-settings.js` | 旧导入路径兼容 |

### 7.2 旧版遗留文件（不活跃，仅保留供旧测试引用）

| 路径 | 说明 |
|------|------|
| `multi-panel/` | 旧版单文件 UI，活跃代码在 `aichatmerge-panel/`。部分测试（add-panel-menu-config、layout-auto-adjust、release-utils）仍引用此目录 |
| `content-scripts/answer-extractor-*.js` | 旧版单文件，新代码在 `src/providers/` |
| `content-scripts/enter-behavior-*.js` | 旧版单文件，新代码在 `src/providers/` |
| `content-scripts/button-finder-utils.js` | 旧版工具 |
| `content-scripts/provider-detector.js` | 旧版检测 |
| `content-scripts/send-button-finder.js` | 旧版发送 |
| `content-scripts/focus-toggle.js` | 旧版焦点 |
| `content-scripts/page-content-extractor.js` | 旧版提取 |
| `bash.exe.stackdump` | 调试残留，可删除 |
