# 修复下拉列表在 iframe 面板内点击无法关闭

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复融合目标下拉列表和添加面板下拉列表在 AI 面板 iframe 内点击无法关闭的 bug

**架构：** 将两处重复的下拉关闭逻辑抽取为共享函数 `setupDropdownCloseHandler`，使用 `pointerdown`（capture phase）替代 `click` 作为主关闭机制，并增加 `window blur` 监听器处理 iframe 内点击场景

**技术栈：** 原生 JavaScript DOM 事件

---

## 根因

下拉关闭机制依赖 `document.addEventListener('click', ...)`。当用户点击 iframe 面板内部时，点击事件在 iframe 浏览上下文中处理，永远不会冒泡到父文档，导致关闭处理器不被触发。

## 文件结构

| 文件 | 变更 |
|------|------|
| `multi-panel/multi-panel.js` | 抽取共享函数 + 替换两处关闭逻辑 |

---

### 任务 1：抽取共享下拉关闭函数

**文件：**
- 修改：`multi-panel/multi-panel.js`（在 `showMergeTargetMenu` 函数之前插入）

- [ ] **步骤 1：在 `showMergeTargetMenu` 函数之前添加共享函数**

在 `showMergeTargetMenu()` 定义之前（约第 3115 行后），插入以下函数：

```js
/**
 * Set up outside-click/pointerdown close handler for a dropdown.
 * Uses pointerdown (capture phase) instead of click to work across
 * iframe boundaries, plus window blur to handle iframe-internal clicks.
 *
 * @param {HTMLElement} dropdown - The dropdown element to close
 * @param {HTMLElement} btn - The trigger button (clicks on it toggle, not close)
 * @returns {Function} cleanup - Call to remove all listeners
 */
function setupDropdownCloseHandler(dropdown, btn) {
  function close() {
    if (dropdown.parentNode) {
      dropdown.remove();
    }
    cleanup();
  }

  function onPointerDown(e) {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      close();
    }
  }

  function onBlur() {
    // Focus moved to iframe or elsewhere — close dropdown
    close();
  }

  function cleanup() {
    document.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('blur', onBlur);
  }

  // Capture phase: fires before button's bubble-phase stopPropagation
  document.addEventListener('pointerdown', onPointerDown, true);

  // Iframe fallback: when user clicks inside an iframe, window loses focus
  window.addEventListener('blur', onBlur);

  return cleanup;
}
```

- [ ] **步骤 2：Commit**

```bash
git add multi-panel/multi-panel.js
git commit -m "refactor: extract shared dropdown close handler"
```

---

### 任务 2：替换 showMergeTargetMenu 的关闭逻辑

**文件：**
- 修改：`multi-panel/multi-panel.js:3151-3158`（showMergeTargetMenu 函数末尾）

- [ ] **步骤 1：替换 showMergeTargetMenu 中的 setTimeout + click 逻辑**

将以下代码块：

```js
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 0);
```

替换为：

```js
  setupDropdownCloseHandler(dropdown, btn);
```

- [ ] **步骤 2：Commit**

```bash
git add multi-panel/multi-panel.js
git commit -m "fix: merge target dropdown closes on iframe click"
```

---

### 任务 3：替换 showAddPanelMenu 的关闭逻辑

**文件：**
- 修改：`multi-panel/multi-panel.js:3203-3211`（showAddPanelMenu 函数末尾）

- [ ] **步骤 1：替换 showAddPanelMenu 中的 setTimeout + click 逻辑**

将以下代码块：

```js
  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 0);
```

替换为：

```js
  // 点击外部关闭
  setupDropdownCloseHandler(dropdown, btn);
```

- [ ] **步骤 2：Commit**

```bash
git add multi-panel/multi-panel.js
git commit -m "fix: add panel dropdown closes on iframe click"
```

---

### 任务 4：验证

- [ ] **步骤 1：运行现有测试确认无回归**

```bash
cd D:/D/cc/panelize-enhanced && npx vitest run
```

预期：所有测试通过

- [ ] **步骤 2：手动验证（需在浏览器中测试）**

1. 加载扩展，打开 multi-panel 页面
2. 点击"融合目标"按钮 → 下拉列表出现
3. 点击输入框 → 下拉列表关闭
4. 点击"融合目标"按钮 → 下拉列表出现
5. 点击 AI 面板 iframe 内部 → 下拉列表关闭
6. 重复以上步骤验证"添加面板"下拉菜单

- [ ] **步骤 3：最终 Commit（如需修复）**

```bash
git add multi-panel/multi-panel.js
git commit -m "fix: dropdown close handler works with iframe panels"
```
