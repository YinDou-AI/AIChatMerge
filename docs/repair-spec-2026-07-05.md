# AIChatMerge 修复规范文档 2026-07-05

> 用途：供 AI agent 直接读取并执行修复
> 依据：`docs/ai-native-dev-standard-full.md` + `docs/code-structure.md`
> 范围：`D:\D\cc\AIChatMerge-refactor`
> 说明：本文件取代 `repair-review-2026-07-05.md` 和 `ai-direction-repair-plan-2026-07-05.md`
> 阅读顺序：先读 `../CLAUDE.md`，再读 `docs/code-structure.md`，再读本文件。完整导航见 `docs/README.md`。

---

## 一、问题概览

本轮重构方向已经符合 AI 读取代码的设计方向：

- 按业务域拆分，而不是按行数拆分
- 增加了 `CLAUDE.md`
- `code-structure.md` 已经同步到新模块结构
- 多个旧大文件已变成薄兼容层

但是当前项目仍然存在一个确认的运行时回归，以及若干会继续干扰 AI 定位代码的结构问题。

当前状态分为两类：

1. **必须先修的运行时问题**
2. **在测试变绿后继续收口的 AI 设计问题**

---

## 二、修复目标

目标不是继续做大重构，而是让 AI 能稳定完成以下流程：

1. 读 `CLAUDE.md`
2. 读 `docs/code-structure.md`
3. 根据日志或测试失败，定位唯一主模块
4. 修改代码
5. 运行测试验证

如果 AI 还需要在多个兼容层、旧目录、内部状态 getter/setter 之间来回跳，说明结构还没有完全收口。

---

## 三、必须先修的问题

### 3.1 ChatGPT idle 状态机回归

| 项目 | 内容 |
|------|------|
| 问题等级 | P0 |
| 现象 | stop button 短暂消失后又重新出现，最终再次消失时，没有发出应有的 `ACM_PROVIDER_IDLE` |
| 失败测试 | `tests/chatgpt-content-script.test.js` |
| 失败用例 | `does not report idle when the stop button briefly reappears` |
| 主文件 | `content-scripts/src/providers/chatgpt-tracking.js` |
| 主函数 | `evaluateChatgptSendTrackingState()` |
| 当前状态 | `2026-07-05` 已修复并补回归验证 |

#### 正确行为

```text
Stop 按钮出现 -> 上报 BUSY
Stop 按钮消失 -> 启动 idle timer
Stop 按钮在 idle delay 内重新出现 -> 取消 idle timer，保持 BUSY
Stop 按钮再次最终消失并稳定超过 idle delay -> 上报一次 IDLE
```

#### AI 修复规则

- 只修状态机，不改测试语义
- 不允许通过删除断言或放宽断言来掩盖问题
- 不允许引入重复 BUSY 或重复 IDLE 上报

#### 修复后必须运行

```bash
npm run build:content
npm test -- --run
```

---

## 四、已落地但需要补验证的桥接修复

这些问题从代码形态上看已经修了，但还缺专项测试，因此暂不视为完全闭环。

### 4.1 Runtime message 初始化门控

| 项目 | 内容 |
|------|------|
| 状态 | 代码已接上，缺专项测试 |
| 入口文件 | `aichatmerge-panel/multi-panel.js` |
| 桥接文件 | `aichatmerge-panel/modules/iframe-comm.js` |
| 状态源 | `aichatmerge-panel/modules/settings-loader.js` |

#### 当前关键入口

```text
multi-panel.js
  -> registerRuntimeMessageListener(getIsInitialized)
```

#### 目标

页面初始化完成后，后台或右键菜单派发的运行时动作必须能进入：

- `handleMultiPanelAction('openPromptLibrary')`
- `handleMultiPanelAction('sendToPanel')`
- `handleMultiPanelAction('switchProvider')`

#### 后续测试建议

新增测试文件：

- `tests/multi-panel-runtime-message.test.js`

建议覆盖：

- 初始化前消息不处理
- 初始化后消息可处理
- 成功处理后能清理 `pendingMultiPanelAction`

---

### 4.2 Popup / Tab toggle 状态桥接

| 项目 | 内容 |
|------|------|
| 状态 | 代码已接上，缺专项测试 |
| 主文件 | `aichatmerge-panel/modules/settings-loader.js` |
| 桥接文件 | `aichatmerge-panel/modules/iframe-comm.js` |
| UI文件 | `aichatmerge-panel/modules/panel-header-actions.js` |

#### 当前目标链路

```text
detectWindowType()
  -> get real isPopupWindow
  -> updateToggleButton(isPopupWindow)
```

#### 后续测试建议

新增测试文件：

- `tests/multi-panel-toggle-mode.test.js`

建议覆盖：

- popup 模式显示 “切回 tab”
- tab 模式显示 “切到 popup”
- 刷新后状态不丢

---

## 五、当前结构问题

这些问题不一定立刻造成功能错误，但会继续影响 AI 读取代码和稳定修改。

### 5.1 `prompting/index.js` 公开了过多内部状态接口

> **2026-07-05 验证更新：此项已落地。**

#### 已完成的改动

`aichatmerge-panel/modules/prompting/index.js` 已经重构为只暴露业务动作：

- `openPromptModal()`
- `closePromptModal()`
- `applyPromptToInput()`
- `sendMessageWithDefaultPrompt()`
- `bindDefaultPromptEvents()`
- `searchPromptLibrary()`
- `openPromptEditor()`
- `savePromptFromEditor()`
- `renderPromptList()`, `loadPromptLibrary()`, `toggleFavorite()`, `deletePromptDirect()`, `selectPrompt()`, `applyVariables()`, `closeVariableModal()`, `closePromptEditor()`, `deletePromptFromEditor()`, `toggleFavoritesFilter()`, `toggleRecentFilter()`, `setCategoryFilter()`
- `updateDefaultPromptBar()`, `prependDefaultPrompt()`

内部状态 getter/setter（如 `getCurrentPromptFilter()`、`setCurrentPromptFilter()` 等）已不再从 `index.js` 导出。`prompt-state.js` 保留为内部实现，不对外暴露。

#### 当前依赖点

| 文件 | 当前依赖 |
|------|----------|
| `panel-ui-bindings.js` | 依赖业务动作函数（已迁移） |
| `prompting/prompt-library.js` | 依赖 `prompt-state.js`（内部） |
| `prompting/default-prompt.js` | 依赖 `prompt-state.js`（内部） |

---

### 5.2 `merge-engine.js` 不再兼任状态仓库

> **2026-07-05 Task A 更新：re-export 已移除，merge-engine.js 仅导出 triggerMerge。**

#### 当前状态

`aichatmerge-panel/modules/merge-engine.js` 唯一导出为 `triggerMerge` 函数。所有状态 getter/setter 和子模块 re-export 已移除。

外部调用链（仅 `triggerMerge`）：
- `panel-lifecycle.js` → 不再静态依赖 `merge-engine.js`；面板移除后的融合状态补偿交给 `merge-monitor.js`
- `panel-ui-bindings.js` → `import { triggerMerge } from './merge-engine.js'`
- `merge-monitor.js` → 自动完成/超时/面板移除补偿通过动态加载 `merge-engine.js` 触发融合

状态归属：
| 状态 | 真实归属模块 |
|------|-------------|
| `getSelectedMergeTarget()` / `setSelectedMergeTarget()` | `merge-state.js` |
| `getLastSentQuestion()` / `setLastSentQuestion()` | `merge-state.js` |
| `getAutoExportWaitController()` / `setAutoExportWaitController()` | `markdown-export.js` |
| `getAutoExportRunId()` / `incrementAutoExportRunId()` | `markdown-export.js` |
| `getAutoExportWriteInProgress()` / `setAutoExportWriteInProgress()` | `markdown-export.js` |
| `getMergeIsActive()` / `setMergeIsActive()` | `merge-monitor.js` |
| `getLastMergeType()` / `setLastMergeType()` | `merge-monitor.js` |
| `getAutoMergeEnabled()` / `setAutoMergeEnabled()` | `merge-monitor.js` |

#### 状态归属已统一

> **2026-07-05 状态去重完成：`merge-monitor.js` 为唯一事实来源。**

`state.js` 不再定义 `mergeIsActive`、`lastMergeType`、`AUTO_MERGE_ENABLED`。所有模块从 `merge-monitor.js` 读取。`merge-engine.js` 和 `discussion-runner.js` 通过 `beginMergeSession()` 统一初始化会话状态。

---

### 5.3 兼容层已存在，但缺少退场规则

> **2026-07-05 文档收尾：此项已落地。**

#### 已完成的改动

`CLAUDE.md` 已明确声明兼容层规则：

```text
兼容层只用于旧引用存活，新代码不得新增对兼容层的依赖
新代码必须直接引用领域模块
```

`docs/code-structure.md` 第七节同步声明：

```text
规则：新代码不得新增对兼容层的依赖，必须直接引用领域模块。
```

#### 当前兼容层

| 文件 | 当前作用 |
|------|----------|
| `aichatmerge-panel/modules/event-handlers.js` | 兼容旧导入路径 |
| `aichatmerge-panel/modules/iframe-comm.js` | 兼容旧导入路径 + bridge |
| `aichatmerge-panel/modules/discussion-engine.js` | 兼容旧导入路径 |
| `aichatmerge-panel/modules/prompt-library.js` | 兼容旧导入路径 |
| `options/modules/event-handlers.js` | 兼容旧导入路径 |

兼容层何时全部删除，取决于入口文件 `multi-panel.js` 的遗留引用何时迁移完成（见 5.4 节）。

---

### 5.4 旧 `multi-panel/` 目录仍然被测试引用

#### 当前问题

活跃代码已经迁移到：

- `aichatmerge-panel/`

但部分测试仍然引用：

- `multi-panel/multi-panel.js`
- `multi-panel/multi-panel.html`

#### 当前已知测试

| 测试文件 | 引用 |
|----------|------|
| `tests/add-panel-menu-config.test.js` | `multi-panel/multi-panel.js` |
| `tests/layout-auto-adjust.test.js` | 旧 `multi-panel` 实现片段 |
| `tests/release-utils.test.js` | `multi-panel/multi-panel.html` |

#### 为什么这是设计问题

AI 看到：

1. 新目录 `aichatmerge-panel/`
2. 旧目录 `multi-panel/`
3. 测试仍引用旧目录

很容易误判旧目录仍是主实现。

#### 当前策略

短期不删旧目录。

先在文档里明确：

- `aichatmerge-panel/` 是活跃实现
- `multi-panel/` 是兼容遗留 + 测试仍引用

等运行时回归全部修完，再迁移旧测试引用。

---

### 5.5 `options/` 仍然是半业务域、半技术层结构

#### 当前活跃入口

- `options/options.js` -> `general-settings.js`

#### 当前剩余技术层命名

- `data-manager.js`
- `settings-loader.js`
- `ui-helpers.js`
- `event-handlers.js` 兼容层

#### 当前问题

对 AI 来说，“评分历史导出”仍然可能要在多个文件间跳转。

#### 目标方向

后续逐步按设置域命名：

- `prompt-library-settings.js`
- `score-history-settings.js`
- `import-export-settings.js`
- `keyboard-shortcuts-settings.js`

这一步排在运行时修复之后。

---

### 5.6 日志前缀 ownership — markdown-export:* 已收口

> **2026-07-05 验证更新：`markdown-export:*` 前缀已只对应 `markdown-export.js` 一个主模块。**

#### 验证结果

grep 验证 `markdown-export:` 前缀在 `discussion-runner.js` 和 `discussion-gates.js` 中**已无任何出现**。这两个文件仅通过 `import { exportDiscussionResult, ... } from './markdown-export.js'` 调用导出业务函数，不再自行发出 `markdown-export:*` 日志。

整个 `aichatmerge-panel/modules/` 目录中，`markdown-export:` 前缀仅出现在 `markdown-export.js`（主模块）和 `debug-log.js`（事件检测逻辑，非事件发射）。

#### 当前仍存在的其他前缀跨模块情况

| 事件前缀 | 出现文件 |
|----------|----------|
| `completion:*` | `merge-monitor.js` |
| `merge-panel:*` | `merge-monitor.js` |

`completion:*` 和 `merge-panel:*` 在 `merge-monitor.js` 内部集中使用，不涉及跨模块散落，符合”一个前缀对应一个主模块”原则。

#### 当前策略

`markdown-export:*` 收口已完成。无需进一步动作。

---

### 5.7 `docs/` 目录仍然存在多入口干扰

> **2026-07-05 文档收尾：此项已落地。**

#### 已完成的改动

`docs/README.md` 已创建，包含：

- AI 阅读顺序（三步主文档）
- 过期的检查过程与实现计划已从公开仓库移除
- 文档分类（主入口文档 / 方法论文档 / 专题分析 / 对外文案）
- 明确声明历史文档仅用于追溯上下文，不用于判断当前行为

`docs/README.md` 同时覆盖了 5.12 节描述的问题（子文档入口分层），无需单独处理。

---

### 5.8 文档声明与实际公开 API 仍有不一致

> **2026-07-05 验证更新：此项已落地。** `prompting/index.js` 已重构为只导出业务动作，内部状态 getter/setter 不再对外暴露。详见 5.1 节。

#### 当前状态

`docs/code-structure.md` 描述 `prompting/index.js` 为”公开 API（仅业务动作）”，与实际代码一致。

`CLAUDE.md` 中”对外暴露业务动作函数，不暴露内部状态 getter/setter”的声明已与实际代码同步。

---

### 5.9 活跃模块仍有较多兼容层依赖

> **2026-07-05 验证更新：活跃业务模块已迁移至直接依赖领域模块。**
> **2026-07-05 校准：入口文件 multi-panel.js 仍通过兼容层导入，此为遗留引用。**

#### 当前状态

经过 grep 验证，活跃业务模块已不再通过兼容层互相调用。所有活跃业务模块直接依赖领域模块：

| 活跃文件 | 当前依赖（全部为领域模块） |
|----------|--------------------------|
| `answer-extractor.js` | `panel-postmessage.js`, `state.js`, `send-pipeline.js` |
| `discussion-runner.js` | `panel-postmessage.js`, `send-pipeline.js`, `markdown-export.js`, `merge-prompt.js`, `merge-monitor.js` |
| `focus-manager.js` | `panel-new-chat.js`, `panel-frame-config.js`, `state.js` |
| `merge-monitor.js` | `panel-postmessage.js`, `answer-extractor.js` |
| `panel-lifecycle.js` | `panel-health.js`, `panel-header-actions.js`, `panel-frame-config.js`, `theme.js`, `layout-controls.js`, `layout-config.js`, `merge-panel-registry.js`, `merge-monitor.js` |
| `panel-ui-bindings.js` | `focus-manager.js`, `markdown-export.js`, `state.js`, `merge-state.js`, `merge-engine.js`（仅 triggerMerge）, `discussion-runner.js`, `merge-monitor.js`, `panel-transport.js`, `panel-menus.js`, `layout-controls.js`, `settings-loader.js` |
| `send-pipeline.js` | `panel-postmessage.js`, `panel-frame-config.js`, `panel-health.js`, `async-utils.js`, `merge-panel-registry.js` |
| `settings-loader.js` | `layout-config.js`, `merge-monitor.js`, `prompting/index.js` |

#### 验证结论

- **零活跃业务模块**从 `iframe-comm.js`、`event-handlers.js`、`discussion-engine.js`、`prompt-library.js`（兼容层）导入
- **入口文件 `multi-panel.js`** 仍从 `iframe-comm.js`、`event-handlers.js` 导入，这是遗留引用，非新依赖
- 唯一从 `merge-engine.js` 导入的是 `triggerMerge()`（业务动作），不涉及状态 getter/setter
- `code-structure.md` 第七节声明”活跃业务模块已直接依赖领域模块，入口文件仍通过兼容层导入”**已验证准确**

#### 兼容层当前状态

兼容层文件仍然存在，仅保留自身 re-export 链和少量桥接逻辑（如 `iframe-comm.js` 的 `initSettingsCallbacks`）。新代码不得新增对兼容层的依赖。

---

### 5.10 `merge-engine.js` 与 `markdown-export.js` 的状态边界

> **2026-07-05 Task A 更新：re-export 已移除，merge-engine.js 仅导出 triggerMerge。**

#### 当前状态

`merge-engine.js` 不再 re-export `markdown-export.js` 的任何内容。所有 auto export 状态（`autoExportWaitController`、`autoExportRunId`、`autoExportWriteInProgress`）完全由 `markdown-export.js` 独占管理。

`merge-engine.js` 唯一导出：`triggerMerge`。

---

### 5.11 `code-structure.md` 兼容层声明已校准

> **2026-07-05 文档校准：措辞已精确化，区分"活跃业务模块"和"入口文件"。**

#### 当前措辞

`docs/code-structure.md` 第七节已更新为：

```text
活跃业务模块（panel-lifecycle、panel-ui-bindings、send-pipeline、settings-loader 等）已直接依赖领域模块。
入口文件 multi-panel.js 仍通过兼容层导入（iframe-comm.js、event-handlers.js），这是遗留引用，未来迁移后可删除兼容层。
```

#### 校准原因

原来的"活跃模块已全部迁移"过于绝对。`multi-panel.js` 作为入口文件仍通过兼容层导入，虽然这是遗留引用而非新依赖，但文档应如实描述。

---

### 5.12 文档目录存在大量历史/检查子文档，缺少入口分层

> **2026-07-05 文档收尾：此项已落地，与 5.7 节同一批次完成。**

#### 已完成的改动

`docs/README.md` 已创建并包含：

- AI 阅读顺序（`CLAUDE.md` -> `code-structure.md` -> `repair-spec-2026-07-05.md`）
- 历史/过程文档明确标记为”不代表当前代码状态”
- 过期的检查过程与实现计划已从公开仓库移除
- 文档分类表（主入口文档 / 方法论文档 / 专题分析 / 对外文案）

---

### 5.13 `debug-log.js` 的关键事件识别状态

> **2026-07-05 Task A 验证更新：所有关键前缀已识别。**

#### 当前状态

`debug-log.js` 的 `isDebugKeyEvent()` 已识别以下前缀（已通过测试验证）：

| 前缀 | 识别状态 |
|------|----------|
| `merge:*` | 已识别 |
| `merge-monitor:*` | 已识别 |
| `discussion:*` | 已识别 |
| `discussion-wait:*` | 已识别 |
| `discussion-final-answer:*` | 已识别 |
| `discussion-wait:final-merge:*` | 已识别 |
| `markdown-export:*` | 已识别 |
| `panel-injection:*` | 已识别 |

`isDebugIssueEvent()` 识别的关键词：`error`, `failed`, `timeout`, `no-answer`, `empty`, `give-up`, `missing`, `aborted`, `fallback`。

#### 结论

所有当前使用的日志前缀均已在 `debug-log.js` 中被正确识别为关键事件或问题事件。无需进一步动作。

---

## 六、事件修复定位表

这一节按 `code-structure.md` 的方式，给后续 AI 一个可直接 grep 的修复入口。

### 6.1 运行时事件

| 事件 / 现象 | 主文件 | 主函数 | 说明 |
|-------------|--------|--------|------|
| ChatGPT idle 不上报 | `content-scripts/src/providers/chatgpt-tracking.js` | `evaluateChatgptSendTrackingState()` | 已修复，需继续全量回归 |
| runtime action 不处理 | `aichatmerge-panel/modules/settings-loader.js` | `registerRuntimeMessageListener()` | 已接线，已有专项测试 |
| popup/tab toggle 状态错误 | `aichatmerge-panel/modules/settings-loader.js` | `detectWindowType()` | 已接线，已有基础专项测试 |
| merge 触发时引用未定义状态 | `aichatmerge-panel/modules/merge-engine.js` | `triggerMerge()` | `2026-07-05` 已修复，并补回归测试 |

### 6.2 结构收口入口

| 结构问题 | 主文件 | 函数/导出 | 当前状态 |
|----------|--------|-----------|----------|
| Prompting API 过宽 | `aichatmerge-panel/modules/prompting/index.js` | `export { get*/set* }` | **已修复** — 仅导出业务动作，内部状态不对外暴露 |
| Merge API 过宽 | `aichatmerge-panel/modules/merge-engine.js` | `get*/set* auto export state` | **已修复** — re-export 已移除，仅导出 triggerMerge |
| 兼容层退场缺规则 | `CLAUDE.md` / `docs/code-structure.md` | 文档规则 | **已补** — CLAUDE.md 和 code-structure.md 均已声明"新代码不得新增对兼容层的依赖" |
| 旧目录误导 AI | `multi-panel/` + 相关测试 | 测试引用 | 待处理 — 运行时稳定后迁移 |
| 日志前缀 ownership 不纯 | `discussion-runner.js` / `discussion-gates.js` / `markdown-export.js` | `recordDebugLog('markdown-export:*')` | **已修复** — `markdown-export:*` 仅在 `markdown-export.js` 发射，discussion 文件已不再散落该前缀 |
| `docs/` 入口分散 | `docs/` | 文档优先级声明 | **已修复** — `docs/README.md` 已创建，含 AI 阅读顺序、文档分类、历史文档标记 |
| 文档与 API 不一致 | `CLAUDE.md` / `docs/code-structure.md` / `prompting/index.js` | 导出清单 | **已修复** — 文档与代码已同步 |
| 活跃模块仍依赖兼容层 | `panel-ui-bindings.js` / `panel-lifecycle.js` / `send-pipeline.js` 等 | import 路径 | **已修复** — 活跃业务模块已直接依赖领域模块，入口文件 multi-panel.js 仍通过兼容层导入（遗留引用） |
| 导出状态边界不稳 | `merge-engine.js` / `markdown-export.js` | auto export state | **已拆分** — 状态在 `markdown-export.js`，merge-engine 仅 re-export |
| 文档过度声明 | `docs/code-structure.md` | 第七节兼容层说明 | **已校准** — 措辞精确区分活跃业务模块与入口文件的兼容层依赖 |
| 历史文档干扰 | `docs/README.md` | 文档入口说明 | **已修复** — 过期检查过程与实现计划已从公开仓库移除 |
| 新日志前缀未进 debug 摘要 | `aichatmerge-panel/modules/debug-log.js` | `isDebugKeyEvent()` 等 | 已同步关键识别，继续补更大范围摘要校验 |

---

## 七、执行顺序

> **2026-07-05 验证更新：多项已完成，以下为当前真实进度。**

1. ~~修 `chatgpt-tracking.js`~~ — **已完成**
2. ~~运行 `npm run build:content` + `npm test -- --run`~~ — **已验证**
3. ~~如果测试全绿，再补两个专项测试~~ — **已完成**，`runtime-message-listener.test.js`（6测试）和 `toggle-button-state.test.js`（4测试）均已通过
4. ~~API 收口：`prompting/index.js`~~ — **已完成**，仅导出业务动作
5. ~~API 收口：`merge-engine.js` re-export 清理~~ — **已完成**，仅导出 triggerMerge
6. ~~迁移活跃模块离开兼容层依赖~~ — **已完成**，活跃业务模块已直接依赖领域模块，入口文件 multi-panel.js 仍通过兼容层导入（遗留引用）
7. ~~修正 `code-structure.md` 的兼容层过度声明~~ — **已完成**，声明已验证准确
8. ~~检查并同步 `debug-log.js` 的新事件前缀识别~~ — **已完成**，所有关键前缀已识别
9. 最后处理：
   - ~~兼容层退场规则~~ — **已完成**，CLAUDE.md 和 code-structure.md 均已声明规则
   - 旧 `multi-panel/` 测试迁移
   - ~~`docs/` 优先级声明统一~~ — **已完成**，`docs/README.md` 已创建
   - ~~`state.js` 与 `merge-monitor.js` 重复状态合并~~ — **已完成**，`merge-monitor.js` 为唯一事实来源

---

## 八、给 AI 的执行规则

后续 AI agent 必须遵守：

1. 新代码不要新增对兼容层的依赖
2. 新代码优先直接依赖领域模块
3. 不要继续把内部状态 getter/setter 暴露给外部模块
4. 行为未稳定前，不要扩大结构调整范围
5. 修复完成后必须同步更新文档
6. 同一日志前缀尽量只保留一个主模块
7. `docs/` 中的非主入口文档必须标注文档类型和阅读优先级
8. 文档中声明为“公开 API”的模块，实际代码必须与声明一致
9. 文档不得声明尚未完成的目标为已完成事实
10. 新增或改名日志前缀时，必须同步 `debug-log.js` 与 `docs/code-structure.md`

---

## 九、验证清单

### 9.1 行为验证

- [x] `npm run build:content` 通过 — 2026-07-05 AI 验证（95.6kb, 9ms）
- [x] `npm test -- --run` 全绿 — 2026-07-05 AI 验证（15文件 159测试 0失败）
- [x] ChatGPT idle tracking 回归消失 — 2026-07-05 AI 验证（chatgpt-content-script.test.js 6测试全绿）
- [x] runtime action 可在初始化后正常处理 — 2026-07-05 AI 验证（runtime-message-listener.test.js 6测试全绿）
- [x] toggle 按钮状态与真实窗口模式一致 — 2026-07-05 AI 验证（toggle-button-state.test.js 4测试全绿）

### 9.2 AI 设计验证

- [x] AI 能从失败测试直接定位主文件 — 2026-07-05 验证：每个测试文件与主模块一一对应（见code-structure.md模块表）
- [x] AI 能从日志 / 现象直接定位事件主模块 — 2026-07-05 验证：一个前缀对应一个主模块（grep确认）
- [x] 新代码不再依赖兼容层 — 2026-07-05 grep 验证通过
- [x] `prompting/index.js` 最终只暴露业务动作 — 2026-07-05 验证通过，仅导出业务函数
- [x] `merge-engine.js` 最终不再是默认状态仓库 — 2026-07-05 验证通过，状态已拆分到 `merge-state.js` 和 `markdown-export.js`
- [x] `markdown-export:*` 最终只对应一个主模块 — 2026-07-05 grep 验证通过，仅 `markdown-export.js` 发射该前缀
- [x] `docs/` 中非主入口文档都标明类型和优先级 — 2026-07-05 `docs/README.md` 已创建，含文档分类表和历史文档标记
- [x] 活跃业务模块最终不再默认依赖兼容层 — 2026-07-05 grep 验证通过，活跃业务模块已直接依赖领域模块，入口文件 multi-panel.js 仍通过兼容层导入（遗留引用）
- [x] 文档声明与实际导出接口一致 — 2026-07-05 验证通过，`prompting/index.js` 导出与 code-structure.md 描述一致
- [x] `docs/code-structure.md` 不再把未完成迁移描述为已完成 — 2026-07-05 校准完成，措辞已精确区分"活跃业务模块"和"入口文件 multi-panel.js"的兼容层依赖状态
- [x] 新增日志前缀能被 debug summary / AI payload 正确识别 — 2026-07-05 验证通过（debug-log.test.js 24测试全绿）

---

## 十、当前结论

> **2026-07-05 最终验收更新：代码层面收工，等待用户手动 smoke test。**

AI 读取路径已完全打通：

```text
读 CLAUDE.md
  -> 读 docs/code-structure.md
  -> 找到主模块
  -> 改代码
  -> 跑测试
  -> 更新文档
```

**已完成：**
- 运行时回归全部修复
- 公开 API 已收紧
- 兼容层规则已明确
- 状态单源已统一（merge-monitor.js）
- 日志前缀 ownership 已纯化
- 文档入口已分层
- 159 测试全绿，build 通过，release dry-run 通过

**仍需用户手动验证：**
- 真实浏览器中的多面板加载、发送、merge、discussion、export、new chat、options 主路径
- 详见”用户手动 smoke test 清单”

**上线后可继续处理：**
- 旧 `multi-panel/` 测试迁移（3个测试文件仍引用旧目录）
- `options/` 目录按设置域命名优化
- 入口文件 multi-panel.js 迁移离开兼容层
