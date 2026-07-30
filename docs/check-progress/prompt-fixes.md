# 提示词库问题诊断

## 问题1：加载/选择提示词失败

**原因：** `prompt-library.js` 第496行 `closePromptModal()` 函数引用了不存在的 DOM 元素 `prompt-list-modal-wrapper`。

```javascript
// aichatmerge-panel/modules/prompt-library.js:495-497
function closePromptModal() {
  document.getElementById('prompt-list-modal-wrapper').style.display = 'none'; // BUG: 元素不存在
}
```

HTML 中只有 `prompt-list-modal`（列表容器）和 `prompt-modal`（整个弹窗），没有 `prompt-list-modal-wrapper`。

**影响：**
- 用户点击提示词列表中的某条提示词时，`selectPrompt()` 会先调用 `applyPromptToInput()` 成功将内容填入输入框，然后调用 `closePromptModal()` 抛出 TypeError
- 弹窗无法关闭，控制台报错 "Cannot set properties of null (setting 'style')"
- 变量替换流程（`applyVariables()`）中同样调用了这个错误的函数，也会失败

**旧版 multi-panel.js 对比：** 旧版的 `closePromptModal()` 正确引用了 `prompt-modal`，没有这个问题。重构时遗漏了这个改动。

**修复方案：**

`aichatmerge-panel/modules/prompt-library.js` 第496行，将 `prompt-list-modal-wrapper` 改为 `prompt-modal`：

```javascript
function closePromptModal() {
  document.getElementById('prompt-modal').style.display = 'none';  // 修复：使用正确的元素ID
  document.getElementById('prompt-search').value = '';
}
```

注意：修复后 `closePromptModal` 的行为应与 `event-handlers.js` 中同名函数（第193行）保持一致——隐藏 `prompt-modal` 并清空搜索框、重置过滤状态。当前 prompt-library.js 内部版本缺少重置过滤器的逻辑，建议统一。

---

## 问题2：添加提示词无法保存

**原因：** 经代码审查，`savePromptFromEditor` 函数（prompt-library.js 第443-477行）逻辑完整，无明显语法或逻辑错误：

- 输入校验正确（title/content 必填）
- 新建调用 `savePrompt(promptData)`，编辑调用 `updatePrompt(id, promptData)`
- `prompt-manager.js` 的 `savePrompt` 函数验证、清洗、存储流程完整
- IndexedDB 操作有重试机制（`runWithRetry`）
- 保存后正确调用 `closePromptEditor()` + `renderPromptList()` 刷新列表
- 所有 DOM 元素（`prompt-title-input`、`prompt-content-input`、`prompt-category-input`、`save-prompt-btn`）在 HTML 中均存在
- 事件绑定正确（event-handlers.js 第172行）

**可能的运行时问题（需实际调试确认）：**
1. IndexedDB 配额超限（`QuotaExceededError`）——如果本地已存大量数据
2. 模块加载顺序问题——如果 `prompt-manager.js` 的 `initPromptDB()` 尚未完成时用户就尝试保存
3. 浏览器兼容性——IndexedDB 在某些隐私模式下可能受限

**建议排查方式：**
- 在 `savePromptFromEditor` 函数入口添加 `console.log('savePromptFromEditor called', { title, content, category, editingId: currentEditingPromptId })`
- 在 `savePrompt` 函数（prompt-manager.js 第129行）的 catch 块中添加更详细的错误日志
- 检查浏览器控制台是否有 IndexedDB 相关错误

**确认无代码层面的保存缺陷**，如实际测试仍无法保存，需通过控制台日志定位运行时错误。

---

## 问题3：默认提示词功能不可见

**原因：** 默认提示词功能的代码实现是完整的，但存在可发现性问题。

**已实现的功能清单：**

| 功能 | 文件 | 行号 | 状态 |
|------|------|------|------|
| 默认提示词提示条 HTML | multi-panel.html | 36-43 | 存在 |
| 提示条显示/隐藏逻辑 | prompt-library.js | 275-288 (`updateDefaultPromptBar`) | 正确 |
| 跳过按钮事件绑定 | prompt-library.js | 299-307 (`bindDefaultPromptEvents`) | 正确 |
| 发送时自动追加默认提示词 | prompt-library.js | 309-316 (`sendMessageWithDefaultPrompt`) | 正确 |
| 设为默认/取消默认按钮 | prompt-library.js | 136-150 (renderPromptList中) | 正确 |
| 数据库操作 `setDefaultPrompt` | prompt-manager.js | 164-178 | 正确 |
| 数据库操作 `clearDefaultPrompt` | prompt-manager.js | 181-191 | 正确 |
| 初始化时调用 | multi-panel.js | 37-38 | 正确 |
| CSS 样式 | multi-panel.css | 1545-1609 | 完整 |

**可发现性问题：**
1. "设为默认"按钮（`prompt-set-default-btn`）默认 opacity 为 0，仅在鼠标悬停在提示词条目上时才显示（opacity: 1）。用户不悬停就看不到这个按钮。
2. `default-prompt-bar` 初始 `display: none`，只有当至少有一条提示词被设为默认后才会显示。
3. 没有引导用户发现默认提示词功能的 UI 提示。

**如果确认功能不可用（而非仅仅是找不到），需排查：**
- `updateDefaultPromptBar()` 是否在 init 流程中被正确调用（multi-panel.js 第37行）
- IndexedDB 中 `isDefault` 字段是否正确读写

**如需改善可发现性，建议：**
- 在提示词库弹窗顶部添加一行说明："点击提示词条目上的圆圈图标可设为默认提示词"
- 或将设为默认按钮改为始终可见（opacity 从 0 改为 0.5）

---

## 问题汇总

| # | 问题 | 根因 | 严重程度 | 修复难度 |
|---|------|------|----------|----------|
| 1 | 选择提示词后弹窗不关闭 | `closePromptModal` 引用不存在的元素 | 高（功能中断） | 低（改一行） |
| 2 | 保存失败（待确认） | 代码审查未发现缺陷，需运行时调试 | 待定 | 待定 |
| 3 | 默认提示词功能不可见 | 功能完整但 UI 可发现性差 | 中（功能可用但难发现） | 低（UI 微调） |
