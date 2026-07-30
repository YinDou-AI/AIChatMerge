# text-injection-all-providers.js 拆分实施计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 text-injection-all-providers.js（3502行）拆分为 15 个按功能领域组织的模块，用 esbuild bundle 成单个 IIFE

**架构：** 源文件放在 `content-scripts/src/` 下，按功能领域（非技术层级）组织。esbuild 将所有模块 bundle 成 `content-scripts/text-injection-all-providers.js`（单个 IIFE），保持 content script 兼容性。

**技术栈：** esbuild（bundle）、Chrome Extension Manifest V3 content script IIFE

---

## 文件结构

```
content-scripts/
  src/
    text-injection-entry.js              ← 主入口：anti-frame-busting + 事件路由 + handleTextInjection
    providers/
      detection.js                       ← detectProvider + 常量（ACM_PROVIDER_*、SELECTORS、URLS）
      dom-utils.js                       ← isVisibleElement、findFirstVisibleElement、querySelectorDeep 等
      messaging.js                       ← getExtensionOrigin、postToExtensionParent、postInjectionResult 等
      text-injection.js                  ← injectTextIntoElement、injectTextIntoSlateEditor、setFormControlValue 等
      google-helpers.js                  ← Google 搜索/AI 模式特殊处理
      chatgpt-tracking.js                ← ChatGPT 发送状态追踪（startChatgptSendTracking 等）
      claude-monitor.js                  ← Claude 不可用检测（startClaudeUnavailableWarningMonitor 等）
      yuanbao-editor.js                  ← Yuanbao Quill 编辑器注入
      gemini-editor.js                   ← Gemini 编辑器注入
      metaso-sidebar.js                  ← 秘塔侧边栏折叠 + textarea 注入
      click-send.js                      ← clickSendButton + findQianwenScopedSendButton + pressEnter
      new-chat.js                        ← clickNewChatButton + 临时对话（enableTemporaryChat 等）
      answer-extraction.js               ← 4阶段答案提取（extractLatestAnswer + 选择器 + 文本清理）
      completion-monitor.js              ← 完成监控（按钮状态 + MutationObserver + SSE）
      sse-text.js                        ← SSE 文本累积（__sse_text__、__sse_text_reset__）
      dark-mode.js                       ← iframe 暗色模式
  text-injection-all-providers.js        ← esbuild 输出（不手动编辑）
```

**日志事件名前缀映射：**
| 模块 | 事件前缀 |
|------|---------|
| detection.js | `text-injection:detect:*` |
| text-injection.js | `text-injection:inject:*` |
| click-send.js | `text-injection:send:*` |
| new-chat.js | `text-injection:new-chat:*` |
| answer-extraction.js | `text-injection:extract:*` |
| completion-monitor.js | `text-injection:completion:*` |

---

## 任务 1：创建项目骨架 + esbuild 配置

**文件：**
- 创建：`content-scripts/src/text-injection-entry.js`（空壳）
- 创建：`content-scripts/src/providers/` 目录
- 修改：`package.json`（添加 build:content 脚本）

- [ ] **步骤 1：安装 esbuild**

运行：`npm ls esbuild 2>&1 || npm install --save-dev esbuild`
预期：esbuild 已安装或安装成功

- [ ] **步骤 2：创建目录结构**

```bash
mkdir -p content-scripts/src/providers
```

- [ ] **步骤 3：创建空入口文件**

创建 `content-scripts/src/text-injection-entry.js`：
```javascript
// text-injection-entry.js — 主入口
// esbuild 将所有 provider 模块 bundle 成单个 IIFE
console.log('[Text Injection] Entry point loaded (esbuild bundle)');
```

- [ ] **步骤 4：添加 build:content 脚本**

在 `package.json` 的 `scripts` 中添加：
```json
"build:content": "esbuild content-scripts/src/text-injection-entry.js --bundle --format=iife --outfile=content-scripts/text-injection-all-providers.js"
```

- [ ] **步骤 5：运行构建验证**

运行：`npm run build:content`
预期：生成 `content-scripts/text-injection-all-providers.js`，无报错

- [ ] **步骤 6：Commit**

```bash
git add content-scripts/src/ package.json
git commit -m "chore: add esbuild content script build pipeline"
```

---

## 任务 2：提取 detection.js（provider 检测 + 常量）

**文件：**
- 创建：`content-scripts/src/providers/detection.js`
- 来源：text-injection-all-providers.js 第 30-430 行（常量 + detectProvider）

- [ ] **步骤 1：创建 detection.js**

从原文件提取以下内容到 `content-scripts/src/providers/detection.js`：

```javascript
// detection.js — Provider 检测与常量定义
// 日志前缀：text-injection:detect

export const GOOGLE_PROVIDER_MODE_AI = 'ai';
export const GOOGLE_PROVIDER_MODE_SEARCH = 'search';
export const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = 'multi-panel-provider-status';
export const ACM_PROVIDER_BUSY = 'ACM_PROVIDER_BUSY';
export const ACM_PROVIDER_IDLE = 'ACM_PROVIDER_IDLE';
export const ACM_PROVIDER_USER_INTERACTION = 'ACM_PROVIDER_USER_INTERACTION';
export const ACM_TEMP_CHAT_ENABLED = 'ACM_TEMP_CHAT_ENABLED';
export const CHATGPT_STOP_BUTTON_SELECTOR = 'button[data-testid="stop-button"]';
export const CHATGPT_SEND_TRACKING_IDLE_DELAY_MS = 800;
export const CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS = 2000;
export const MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS = 90000;
export const TEMP_CHAT_POLL_INTERVAL_MS = 200;
export const TEMP_CHAT_POLL_TIMEOUT_MS = 1200;
export const CLAUDE_UNAVAILABLE_CONTEXT = 'claude-entry-warning';
export const CLAUDE_UNAVAILABLE_REQUIRED_PATTERNS = [
  /This model isn't available right now/i,
  /You can switch to another model to continue using Claude/i
];
export const CLAUDE_UNAVAILABLE_CONTEXT_PATTERNS = [
  /claude-3-5-haiku-latest/i
];
export const CLAUDE_UNAVAILABLE_CHECK_TIMEOUT_MS = 20000;

// ===== Provider-specific selectors =====
export const PROVIDER_SELECTORS = {
  // ... 原文件第 59-141 行的完整内容
};

export const GOOGLE_AI_INPUT_SELECTORS = [
  'textarea.ITIRGe',
  'textarea[aria-label="Ask anything"]',
  'textarea[maxlength="8192"]'
];

export const GOOGLE_SEARCH_INPUT_SELECTORS = [
  'input[name="q"]',
  'textarea[name="q"]',
  'input.gLFyf',
  'textarea.gLFyf'
];

export const SEND_BUTTON_SELECTORS = {
  // ... 原文件第 158-274 行的完整内容
};

export const NEW_CHAT_BUTTON_SELECTORS = {
  // ... 原文件第 278-355 行的完整内容
};

export const NEW_CHAT_URLS = {
  // ... 原文件第 359-372 行的完整内容
};

export const TEMP_CHAT_BUTTON_SELECTORS = {
  // ... 原文件第 375-383 行的完整内容
};

// ===== Provider detection =====
export function detectProvider() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  if (hostname.includes('claude.ai')) {
    const utilFramePattern = /isolated|segment|embed|widget|frame\.html|extension|sandbox/i;
    if (utilFramePattern.test(pathname)) {
      return null;
    }
  }

  if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) return 'chatgpt';
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('gemini.google.com')) return 'gemini';
  if (hostname.includes('grok.com')) return 'grok';
  if (hostname.includes('deepseek.com')) return 'deepseek';
  if (hostname.includes('kimi.com')) return 'kimi';
  if (hostname.includes('doubao.com')) return 'doubao';
  if (hostname.includes('qianwen.com')) return 'qianwen';
  if (hostname.includes('chatglm.cn')) return 'zhipu';
  if (hostname.includes('chat.baidu.com')) return 'wenxin';
  if (hostname.includes('yuanbao.tencent.com')) return 'yuanbao';
  if (hostname.includes('metaso.cn')) return 'metaso';
  if (hostname.includes('google.com') || hostname.includes('google.') || hostname === 'www.google.com') return 'google';
  return null;
}
```

- [ ] **步骤 2：验证导出**

运行：`node -e "const m = require('./content-scripts/src/providers/detection.js'); console.log(typeof m.detectProvider)"`（或用 esbuild 试 bundle）
预期：无报错

- [ ] **步骤 3：Commit**

```bash
git add content-scripts/src/providers/detection.js
git commit -m "feat(content): extract detection.js — provider detection and selectors"
```

---

## 任务 3：提取 dom-utils.js（DOM 工具函数）

**文件：**
- 创建：`content-scripts/src/providers/dom-utils.js`
- 来源：text-injection-all-providers.js 第 443-700 行

- [ ] **步骤 1：创建 dom-utils.js**

提取以下函数（保持原始实现不变）：
- `isSlateEditor(element)` → boolean
- `isVisibleElement(element)` → boolean
- `findFirstVisibleElement(selectors)` → Element|null
- `getElementAccessibleText(element)` → string
- `findDeepFirstVisibleElement(selectors)` → Element|null
- `findDeepClickableElementByKeywords(keywords)` → Element|null
- `querySelectorDeep(selector, root)` → Element|null
- `querySelectorAllDeep(selector, root)` → Element[]
- `findTextInputElement(selector)` → Element|null
- `isElementEnabled(element)` → boolean

需要从 detection.js 导入 `isExtractMode` 状态（或通过参数传递）。

注意：`isExtractMode` 是模块级状态，通过 message 事件设置。在 dom-utils.js 中需要导入或接收此状态。

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/dom-utils.js
git commit -m "feat(content): extract dom-utils.js — DOM query and visibility helpers"
```

---

## 任务 4：提取 messaging.js（消息通信）

**文件：**
- 创建：`content-scripts/src/providers/messaging.js`
- 来源：text-injection-all-providers.js 第 502-538 行

- [ ] **步骤 1：创建 messaging.js**

提取以下函数：
- `getExtensionOrigin()` → string|null
- `isTrustedExtensionParent(event)` → boolean
- `postToExtensionParent(message)` → void
- `postInjectionResult(injectionRequestId, provider, inputFound, injectSuccess, error)` → void
- `postMultiPanelProviderStatus(type, requestId, phase, provider)` → void
- `postTemporaryChatEnabled(provider)` → void

导出 `extensionOrigin` 常量。

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/messaging.js
git commit -m "feat(content): extract messaging.js — extension messaging helpers"
```

---

## 任务 5：提取 text-injection.js（文本注入核心）

**文件：**
- 创建：`content-scripts/src/providers/text-injection.js`
- 来源：text-injection-all-providers.js 第 451-1891 行

- [ ] **步骤 1：创建 text-injection.js**

提取以下函数：
- `injectTextIntoSlateEditor(element, text)` → boolean
- `setFormControlValue(element, value)` → void
- `dispatchEditorKeyEvent(element, key, code, modifiers)` → void
- `clearRichTextInput(provider, element)` → void
- `normalizeInjectedText(value)` → string
- `hasExpectedMultilineText(actualText, expectedText)` → boolean
- `injectTextIntoElement(element, text)` → boolean

注意：`injectTextIntoElement` 内部调用了 `detectProvider()`、`injectTextIntoYuanbaoEditor`、`injectTextIntoGeminiEditor`、`injectTextIntoMetasoTextarea`。这些需要通过参数或延迟导入解决。

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/text-injection.js
git commit -m "feat(content): extract text-injection.js — core text injection logic"
```

---

## 任务 6：提取 google-helpers.js

**文件：**
- 创建：`content-scripts/src/providers/google-helpers.js`
- 来源：text-injection-all-providers.js 第 432-1045, 1208-1276, 1422-1430, 1893-1914 行

- [ ] **步骤 1：创建 google-helpers.js**

提取以下函数：
- `normalizeGoogleProviderMode(mode)` → string
- `resetGoogleSearchFillSession()` → void
- `getGoogleInputSelectors(mode)` → string[]
- `findGoogleInput(mode)` → Element|null
- `buildGoogleSearchFillValue(currentValue, nextText)` → string
- `clearGoogleInput(mode)` → boolean
- `fillGoogleSearchInput(text)` → boolean
- `navigateToGoogleSearchResults(query)` → boolean
- `clickGoogleSendButton(mode)` → boolean
- `handleGoogleNewSearch(mode)` → boolean
- `handleGoogleTextInjection(text, autoSubmit, providerMode)` → boolean

需要模块级状态 `googleSearchReplaceOnNextFill`。

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/google-helpers.js
git commit -m "feat(content): extract google-helpers.js — Google search/AI mode handling"
```

---

## 任务 7：提取 chatgpt-tracking.js

**文件：**
- 创建：`content-scripts/src/providers/chatgpt-tracking.js`
- 来源：text-injection-all-providers.js 第 812-941 行

- [ ] **步骤 1：创建 chatgpt-tracking.js**

提取以下函数：
- `findChatgptBusyButton()` → Element|null
- `getChatgptComposerRoot()` → Element
- `stopChatgptSendTracking(options)` → void
- `evaluateChatgptSendTrackingState()` → void
- `startChatgptSendTracking(requestId)` → void

需要模块级状态 `chatgptSendTracking`。

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/chatgpt-tracking.js
git commit -m "feat(content): extract chatgpt-tracking.js — ChatGPT send state tracking"
```

---

## 任务 8：提取 claude-monitor.js

**文件：**
- 创建：`content-scripts/src/providers/claude-monitor.js`
- 来源：text-injection-all-providers.js 第 541-613 行

- [ ] **步骤 1：创建 claude-monitor.js**

提取以下函数：
- `getClaudeUnavailableMatch()` → string
- `maybePostClaudeUnavailableWarning()` → boolean
- `startClaudeUnavailableWarningMonitor()` → void

需要模块级状态 `claudeUnavailableWarningPosted`、`claudeUnavailableObserverStarted`。

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/claude-monitor.js
git commit -m "feat(content): extract claude-monitor.js — Claude unavailable detection"
```

---

## 任务 9：提取 yuanbao-editor.js

**文件：**
- 创建：`content-scripts/src/providers/yuanbao-editor.js`
- 来源：text-injection-all-providers.js 第 1606-1656, 1979-1984 行

- [ ] **步骤 1：创建 yuanbao-editor.js**

提取以下函数：
- `normalizeYuanbaoEditorText(value)` → string
- `prepareYuanbaoInputText(text)` → string
- `injectTextIntoYuanbaoEditor(element, text)` → boolean
- `hasExpectedYuanbaoText(expectedText)` → boolean

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/yuanbao-editor.js
git commit -m "feat(content): extract yuanbao-editor.js — Yuanbao Quill editor injection"
```

---

## 任务 10：提取 gemini-editor.js

**文件：**
- 创建：`content-scripts/src/providers/gemini-editor.js`
- 来源：text-injection-all-providers.js 第 1683-1749 行

- [ ] **步骤 1：创建 gemini-editor.js**

提取以下函数：
- `getGeminiEditorText()` → string
- `hasExpectedGeminiText(expectedText)` → boolean
- `injectTextIntoGeminiEditor(element, text)` → boolean

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/gemini-editor.js
git commit -m "feat(content): extract gemini-editor.js — Gemini editor injection"
```

---

## 任务 11：提取 metaso-sidebar.js

**文件：**
- 创建：`content-scripts/src/providers/metaso-sidebar.js`
- 来源：text-injection-all-providers.js 第 1055-1206, 1754-1782 行

- [ ] **步骤 1：创建 metaso-sidebar.js**

提取以下函数：
- `findMetasoSidebarContainer()` → Element|null
- `isMetasoSidebarCollapsed(container)` → boolean
- `findMetasoSidebarToggleButton(container)` → Element|null
- `collapseMetasoSidebarIfNeeded()` → boolean
- `initMetasoSidebarAutoCollapse()` → void
- `injectTextIntoMetasoTextarea(element, text)` → boolean

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/metaso-sidebar.js
git commit -m "feat(content): extract metaso-sidebar.js — Metaso sidebar and textarea"
```

---

## 任务 12：提取 click-send.js

**文件：**
- 创建：`content-scripts/src/providers/click-send.js`
- 来源：text-injection-all-providers.js 第 1281-1420, 1917-2019 行

- [ ] **步骤 1：创建 click-send.js**

提取以下函数：
- `findQianwenScopedSendButton()` → Element|null
- `clickSendButton(provider, providerMode)` → boolean
- `pressEnter(element)` → boolean
- `pressEnterOnProviderInput(provider)` → boolean
- `attemptAutoSubmitWithRetry(provider, providerMode, initialDelay, expectedText)` → void
- `sleep(ms)` → Promise

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/click-send.js
git commit -m "feat(content): extract click-send.js — send button click and auto-submit"
```

---

## 任务 13：提取 new-chat.js

**文件：**
- 创建：`content-scripts/src/providers/new-chat.js`
- 来源：text-injection-all-providers.js 第 1432-1604 行

- [ ] **步骤 1：创建 new-chat.js**

提取以下函数：
- `isTemporaryChatControlActive(element)` → boolean
- `isGeminiTemporaryChatEnabled(control)` → boolean
- `isTemporaryChatAlreadyEnabled(provider, control)` → boolean
- `enableTemporaryChat(provider)` → Promise<boolean>
- `clickNewChatButton(provider, providerMode)` → boolean
- `waitForNewChatButtonReady(timeout)` → Promise<boolean>

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/new-chat.js
git commit -m "feat(content): extract new-chat.js — new chat and temporary chat"
```

---

## 任务 14：提取 answer-extraction.js

**文件：**
- 创建：`content-scripts/src/providers/answer-extraction.js`
- 来源：text-injection-all-providers.js 第 2352-2815 行

- [ ] **步骤 1：创建 answer-extraction.js**

提取以下内容：
- 常量：`DIRECT_ANSWER_SELECTORS`、`COPY_BUTTON_SELECTORS`、`COPY_BUTTON_ANSWER_SELECTORS`
- 函数：
  - `extractText(el)` → string
  - `normalizeExtractedText(text)` → string
  - `appendTextPart(parts, text)` → void
  - `appendLineBreak(parts, forceBlankLine)` → void
  - `extractReadableText(node)` → string
  - `cleanCopyText(text)` → string
  - `addLineBreaks(text)` → string
  - `extractByDirectSelector(provider)` → string|null
  - `extractByCopyButton(provider)` → string|null
  - `extractGenericMarkdownAnswer()` → string
  - `extractFromRoleLog()` → string
  - `extractFromRoleList()` → string
  - `extractLatestAnswer()` → string
- 暴露 `window.__aichatmerge_extractor_utils`

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/answer-extraction.js
git commit -m "feat(content): extract answer-extraction.js — 4-phase answer extraction"
```

---

## 任务 15：提取 completion-monitor.js

**文件：**
- 创建：`content-scripts/src/providers/completion-monitor.js`
- 来源：text-injection-all-providers.js 第 2817-3331 行

- [ ] **步骤 1：创建 completion-monitor.js**

提取以下内容：
- 常量：`STOP_BUTTON_SELECTORS`、`BUTTON_APPEAR_TIMEOUT_MS`、`BUTTON_DISAPPEAR_SETTLE_MS`
- 函数：
  - `handleBeforeUnload()` → void
  - `stopCompletionMonitor()` → void
  - `isStopButtonPresent(provider)` → boolean
  - `startMutationFallback(provider)` → void
  - `startButtonStateMonitor(provider)` → void
  - `acceptsSseCompletion(provider, layer)` → boolean
  - `startCompletionMonitor(mergeSessionId)` → void
- 模块级状态：`completionObserver`、`completionStableTimer`、`completionPhase` 等

- [ ] **步骤 2：Commit**

```bash
git add content-scripts/src/providers/completion-monitor.js
git commit -m "feat(content): extract completion-monitor.js — button-state + mutation completion detection"
```

---

## 任务 16：提取 sse-text.js + dark-mode.js

**文件：**
- 创建：`content-scripts/src/providers/sse-text.js`
- 创建：`content-scripts/src/providers/dark-mode.js`
- 来源：text-injection-all-providers.js 第 2998-3000, 3444-3499 行

- [ ] **步骤 1：创建 sse-text.js**

```javascript
// sse-text.js — SSE 文本累积
// 日志前缀：text-injection:sse

let sseAccumulatedText = '';
let sseAccumulatedThink = '';

export function getSseAccumulatedText() { return sseAccumulatedText; }
export function getSseAccumulatedThink() { return sseAccumulatedThink; }

export function resetSseText() {
  sseAccumulatedText = '';
  sseAccumulatedThink = '';
}

export function accumulateSseText(text, isThink) {
  if (!text) return;
  if (isThink) {
    sseAccumulatedThink += text;
  } else {
    sseAccumulatedText += text;
  }
}
```

- [ ] **步骤 2：创建 dark-mode.js**

从原文件第 3444-3499 行提取 `initDarkMode` IIFE，改为导出函数。

- [ ] **步骤 3：Commit**

```bash
git add content-scripts/src/providers/sse-text.js content-scripts/src/providers/dark-mode.js
git commit -m "feat(content): extract sse-text.js and dark-mode.js"
```

---

## 任务 17：组装主入口 text-injection-entry.js

**文件：**
- 修改：`content-scripts/src/text-injection-entry.js`
- 来源：原文件的 anti-frame-busting IIFE + handleTextInjection + 事件监听

- [ ] **步骤 1：编写主入口**

```javascript
// text-injection-entry.js — 主入口
// esbuild 将所有 provider 模块 bundle 成单个 IIFE
// 日志前缀：text-injection

// ===== Anti frame-busting =====
if ((window.__realParent__ || window.parent) !== window) {
  window.__realParent__ = window.parent;
}
(function() {
  try {
    const host = location.hostname;
    const FRAME_BUSTING_HOSTS = [
      'www.qianwen.com', 'qianwen.com',
      'chatglm.cn', 'www.chatglm.cn',
      'chat.baidu.com', 'www.chat.baidu.com',
      'yuanbao.tencent.com'
    ];
    if (!FRAME_BUSTING_HOSTS.some(h => host === h || host.endsWith('.' + h))) return;
    Object.defineProperty(window, 'top', { get: () => window, configurable: true });
    Object.defineProperty(window, 'parent', { get: () => window.__realParent__ || window, configurable: true });
  } catch(e) {}
})();

// ===== Imports =====
import { detectProvider, PROVIDER_SELECTORS, ... } from './providers/detection.js';
import { isVisibleElement, findFirstVisibleElement, ... } from './providers/dom-utils.js';
import { extensionOrigin, isTrustedExtensionParent, postToExtensionParent, ... } from './providers/messaging.js';
import { injectTextIntoElement, ... } from './providers/text-injection.js';
import { normalizeGoogleProviderMode, handleGoogleTextInjection, ... } from './providers/google-helpers.js';
import { startChatgptSendTracking, stopChatgptSendTracking, ... } from './providers/chatgpt-tracking.js';
import { startClaudeUnavailableWarningMonitor } from './providers/claude-monitor.js';
import { clickSendButton, attemptAutoSubmitWithRetry, ... } from './providers/click-send.js';
import { clickNewChatButton, enableTemporaryChat, ... } from './providers/new-chat.js';
import { extractLatestAnswer, ... } from './providers/answer-extraction.js';
import { startCompletionMonitor, stopCompletionMonitor, ... } from './providers/completion-monitor.js';
import { getSseAccumulatedText, resetSseText, accumulateSseText } from './providers/sse-text.js';
import { runHealthCheck } from './providers/answer-extraction.js';
import { initDarkMode } from './providers/dark-mode.js';

// ===== Extract mode state =====
let isExtractMode = false;

// ===== Claude unavailable monitor (runs on load) =====
startClaudeUnavailableWarningMonitor();

// ===== Listen for extract mode =====
window.addEventListener('message', (event) => {
  if (event?.data?.type === 'SET_EXTRACT_MODE' && isTrustedExtensionParent(event)) {
    isExtractMode = event.data.enabled === true;
  }
});

// ===== handleTextInjection (from原文件第 2022-2350 行) =====
function handleTextInjection(event) {
  // ... 完整的 handleTextInjection 函数，从原文件复制
  // 所有内部调用改为从导入的模块函数调用
}

// ===== Main message listener =====
window.addEventListener('message', (event) => {
  if (!event || !event.data || typeof event.data !== 'object') return;

  const isSameFrameSseMessage = event.source === window &&
    event.origin === window.location.origin &&
    ['__sse_text_reset__', '__sse_text__', '__sse_complete__'].includes(event.data.type);

  if (!isSameFrameSseMessage && !isTrustedExtensionParent(event)) {
    console.warn('[MessageHandler] Rejected message from an untrusted origin');
    return;
  }

  // SSE text reset
  if (event.data.type === '__sse_text_reset__') {
    resetSseText();
    return;
  }

  // SSE text accumulation
  if (event.data.type === '__sse_text__') {
    if (event.data.text) {
      accumulateSseText(event.data.text, event.data.isThink);
    }
    return;
  }

  // SSE completion — stop DOM monitoring
  if (event.data.type === '__sse_complete__') {
    const sseProvider = event.data.provider || detectProvider();
    if (!acceptsSseCompletion(sseProvider, event.data.layer)) return;
    stopCompletionMonitor();
    return;
  }

  if (event.data.type === 'MONITOR_COMPLETION' && event.data.context === 'multi-panel') {
    startCompletionMonitor(event.data.mergeSessionId);
    return;
  }

  if (event.data.type === 'STOP_MONITORING' && event.data.context === 'multi-panel') {
    stopCompletionMonitor();
    return;
  }

  handleTextInjection(event);
});

// ===== Dark mode =====
initDarkMode();
```

- [ ] **步骤 2：验证 bundle**

运行：`npm run build:content`
预期：生成的 IIFE 文件包含所有模块代码，无报错

- [ ] **步骤 3：Commit**

```bash
git add content-scripts/src/text-injection-entry.js
git commit -m "feat(content): assemble main entry point with all module imports"
```

---

## 任务 18：验证 bundle 输出

**文件：**
- 验证：`content-scripts/text-injection-all-providers.js`（esbuild 输出）

- [ ] **步骤 1：比较行数**

运行：`wc -l content-scripts/text-injection-all-providers.js`
预期：输出文件行数 ≈ 3500-4000（包含所有模块 + esbuild wrapper）

- [ ] **步骤 2：验证关键函数存在**

运行：
```bash
grep -c "function detectProvider" content-scripts/text-injection-all-providers.js
grep -c "function handleTextInjection" content-scripts/text-injection-all-providers.js
grep -c "function clickSendButton" content-scripts/text-injection-all-providers.js
grep -c "function extractLatestAnswer" content-scripts/text-injection-all-providers.js
grep -c "function startCompletionMonitor" content-scripts/text-injection-all-providers.js
```
预期：每个输出 1

- [ ] **步骤 3：验证 IIFE 格式**

运行：`head -5 content-scripts/text-injection-all-providers.js`
预期：以 `(function() {` 或类似 IIFE 格式开头

- [ ] **步骤 4：验证 manifest.json 仍指向正确文件**

manifest.json 中 `content_scripts.js` 仍为 `content-scripts/text-injection-all-providers.js`（不变）

- [ ] **步骤 5：Commit**

```bash
git add content-scripts/text-injection-all-providers.js
git commit -m "chore: rebuild text-injection bundle via esbuild"
```

---

## 任务 19：更新 code-structure.md

**文件：**
- 修改：`docs/code-structure.md`

- [ ] **步骤 1：添加 text-injection 模块文档**

在 code-structure.md 中添加：

```markdown
## text-injection（内容脚本 - 文本注入）

### 模块概览
| 模块 | 文件 | 职责（一句话） |
|------|------|---------------|
| 主入口 | src/text-injection-entry.js | 事件路由 + handleTextInjection + anti-frame-busting |
| provider检测 | src/providers/detection.js | hostname检测 + 14个provider的选择器常量 |
| DOM工具 | src/providers/dom-utils.js | 元素可见性、深度查询、Shadow DOM |
| 消息通信 | src/providers/messaging.js | extension parent通信 + 状态上报 |
| 文本注入 | src/providers/text-injection.js | textarea/contenteditable/Slate注入核心 |
| Google | src/providers/google-helpers.js | Google搜索/AI模式特殊处理 |
| ChatGPT追踪 | src/providers/chatgpt-tracking.js | ChatGPT发送状态追踪(busy/idle) |
| Claude监控 | src/providers/claude-monitor.js | Claude不可用模型检测 |
| Yuanbao编辑器 | src/providers/yuanbao-editor.js | Yuanbao Quill编辑器注入 |
| Gemini编辑器 | src/providers/gemini-editor.js | Gemini编辑器注入 |
| 秘塔侧边栏 | src/providers/metaso-sidebar.js | 秘塔侧边栏折叠 + textarea注入 |
| 发送按钮 | src/providers/click-send.js | 点击发送 + 自动提交重试 |
| 新对话 | src/providers/new-chat.js | 新建对话 + 临时对话 |
| 答案提取 | src/providers/answer-extraction.js | 4阶段答案提取(直接选择器→provider→复制按钮→通用) |
| 完成监控 | src/providers/completion-monitor.js | 按钮状态 + MutationObserver + SSE完成检测 |
| SSE文本 | src/providers/sse-text.js | SSE流文本累积 |
| 暗色模式 | src/providers/dark-mode.js | iframe暗色模式注入 |

### 核心函数清单
#### src/text-injection-entry.js
- handleTextInjection(event) → void — 处理INJECT_TEXT/CLEAR_INPUT/NEW_CHAT等消息
- detectProvider() → string|null — 从hostname检测当前AI provider

#### src/providers/detection.js
- detectProvider() → string|null
- PROVIDER_SELECTORS → { [provider]: string[] } — 输入框选择器
- SEND_BUTTON_SELECTORS → { [provider]: string[] } — 发送按钮选择器
- NEW_CHAT_BUTTON_SELECTORS → { [provider]: string[] } — 新对话按钮选择器

#### src/providers/text-injection.js
- injectTextIntoElement(element, text) → boolean — 通用文本注入
- injectTextIntoSlateEditor(element, text) → boolean — Slate编辑器注入
- setFormControlValue(element, value) → void — 表单值设置

#### src/providers/click-send.js
- clickSendButton(provider, providerMode) → boolean — 点击发送按钮
- attemptAutoSubmitWithRetry(provider, providerMode, delay, text) → void — 重试自动提交

#### src/providers/answer-extraction.js
- extractLatestAnswer() → string — 4阶段答案提取
- extractByDirectSelector(provider) → string|null — Phase 1: 直接选择器
- extractByCopyButton(provider) → string|null — Phase 3: 复制按钮
- extractGenericMarkdownAnswer() → string — Phase 4: 通用markdown

#### src/providers/completion-monitor.js
- startCompletionMonitor(mergeSessionId) → void — 启动完成监控
- stopCompletionMonitor() → void — 停止完成监控
- startButtonStateMonitor(provider) → void — 按钮状态监控
- startMutationFallback(provider) → void — MutationObserver兜底

### 事件映射表
| 事件名 | 文件 | 函数 | 说明 |
|--------|------|------|------|
| text-injection:inject:start | text-injection-entry.js | handleTextInjection() | 开始注入文本 |
| text-injection:inject:success | text-injection-entry.js | handleTextInjection() | 注入成功 |
| text-injection:inject:retry | text-injection-entry.js | handleTextInjection() | 注入重试 |
| text-injection:send:click | click-send.js | clickSendButton() | 点击发送按钮 |
| text-injection:send:retry | click-send.js | attemptAutoSubmitWithRetry() | 发送重试 |
| text-injection:extract:phase1 | answer-extraction.js | extractByDirectSelector() | 直接选择器提取 |
| text-injection:extract:phase3 | answer-extraction.js | extractByCopyButton() | 复制按钮提取 |
| text-injection:completion:button | completion-monitor.js | startButtonStateMonitor() | 按钮状态监控启动 |
| text-injection:completion:mutation | completion-monitor.js | startMutationFallback() | MutationObserver兜底 |
| text-injection:completion:detected | completion-monitor.js | notifyCompletion() | 完成检测 |

### 调用关系图
```
message事件 → text-injection-entry.js
  ├→ detection.js (检测provider)
  ├→ text-injection.js (注入文本)
  │   ├→ yuanbao-editor.js (Yuanbao特殊)
  │   ├→ gemini-editor.js (Gemini特殊)
  │   └→ metaso-sidebar.js (Metaso特殊)
  ├→ google-helpers.js (Google特殊)
  ├→ click-send.js (发送)
  ├→ new-chat.js (新对话)
  ├→ answer-extraction.js (提取答案)
  └→ completion-monitor.js (监控完成)
      └→ sse-text.js (SSE文本累积)
```

### 构建
- 源码：`content-scripts/src/`
- 构建命令：`npm run build:content`
- 输出：`content-scripts/text-injection-all-providers.js`（esbuild IIFE bundle）
- 注意：输出文件不手动编辑，修改源码后重新构建
```

- [ ] **步骤 2：Commit**

```bash
git add docs/code-structure.md
git commit -m "docs: add text-injection module structure to code-structure.md"
```

---

## 任务 20：最终验证

- [ ] **步骤 1：完整构建**

运行：`npm run build:content`
预期：成功，无报错

- [ ] **步骤 2：检查所有源文件行数**

运行：
```bash
wc -l content-scripts/src/text-injection-entry.js content-scripts/src/providers/*.js
```
预期：每个文件 50-400 行，无超过 500 行的文件

- [ ] **步骤 3：检查无循环依赖**

运行：`npx esbuild content-scripts/src/text-injection-entry.js --bundle --format=iify --outfile=/dev/null 2>&1 | head -5`
预期：无 circular dependency 警告

- [ ] **步骤 4：最终 Commit**

```bash
git add -A
git commit -m "feat(content): complete text-injection module split via esbuild

Split text-injection-all-providers.js (3502 lines) into 15 modules:
- text-injection-entry.js (main entry + event routing)
- providers/detection.js (provider detection + selectors)
- providers/dom-utils.js (DOM query helpers)
- providers/messaging.js (extension messaging)
- providers/text-injection.js (core injection)
- providers/google-helpers.js (Google mode)
- providers/chatgpt-tracking.js (ChatGPT send tracking)
- providers/claude-monitor.js (Claude unavailable detection)
- providers/yuanbao-editor.js (Yuanbao Quill editor)
- providers/gemini-editor.js (Gemini editor)
- providers/metaso-sidebar.js (Metaso sidebar)
- providers/click-send.js (send button + auto-submit)
- providers/new-chat.js (new chat + temp chat)
- providers/answer-extraction.js (4-phase extraction)
- providers/completion-monitor.js (completion detection)
- providers/sse-text.js (SSE text accumulation)
- providers/dark-mode.js (iframe dark mode)

Build: esbuild bundle → single IIFE (content script compatible)
Docs: Updated code-structure.md with module map and event table"
```
