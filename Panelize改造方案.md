# Panelize 改造方案 v2

> 基于 Panelize Enhanced + AI对撞机SSE检测机制
> 首期目标：AI回答完成检测 + 自动汇总转发

---

## 一、竞品参考

### 1.1 参考项目

| 项目 | 核心借鉴 | 说明 |
|------|---------|------|
| Panelize Enhanced | 代码基础 | 文本注入、回答提取、iframe嵌入、多面板管理 |
| AI对撞机 | SSE四路拦截 | 准确检测AI回答是否完成 |
| FlowChat | 产品思路 | 高亮标注、融合生成（后续阶段） |
| Ask-AI-Together | 主题/语言/iframe加载 | CSS变量主题、自定义i18n、iframe overlay加载 |
| AI-Multi-Ask | Side Panel方案 | Chrome Side Panel + 现有标签页管理 |
| 群问AI | 面板操作按钮 | 复制链接、刷新、关闭等面板操作 |

### 1.2 Panelize Enhanced 已有功能（不动）

- 用户选择AI面板
- Send All统一发送
- 文本注入7种策略容错
- 回答提取4层策略
- iframe嵌入 + 登录态继承
- 10种语言国际化
- Prompt Library / 临时对话

---

## 二、完成检测机制

### 2.1 整体检测流程

```
用户发送问题到多个AI（已有功能）
      ↓
每个AI的iframe中同时启动检测：
├─ SSE拦截器（主）：拦截fetch/XHR/TextDecoder/ReadableStream，解析流式数据
└─ 输出轮询（兜底）：每秒检查回答内容是否有变化
      ↓
单个AI完成判定（满足任一即标记完成）：
├─ SSE检测到done标记（如 event: close）
├─ 5秒内输出无变化 → 标记完成（不判断原因）
└─ 2分钟总超时 → 强制用已有答案
      ↓
全部标记完成 或 2分钟到期 → 触发转发
```

### 2.2 SSE四路拦截（来自AI对撞机）

替换浏览器原生API，在AI页面发起SSE请求时拦截并解析流式数据。四路同时生效，不是选一个：

| 层级 | 方法 | 作用 |
|------|------|------|
| fetch拦截 | 替换window.fetch | 主力，大多数现代AI网站用fetch |
| XHR拦截 | 替换XMLHttpRequest.open/send | 兜底旧式请求 |
| TextDecoder拦截 | 替换TextDecoder.prototype.decode | 兜底所有解码操作 |
| ReadableStream拦截 | 替换ReadableStream.prototype.getReader | 兜底流式读取 |

### 2.3 SSE检测流程（单个AI）

```
AI页面发起API请求
    ↓
拦截器检测URL是否匹配 urlPattern
    ↓
匹配 → 重置SSE状态，开始监听
    ↓
逐行解析SSE数据（parseLine回调）
    ↓
检测 done 标记（如 event: close / FINISHED状态）
    ↓
标记该AI完成
```

### 2.4 全量转增量（IncrementalHelper）

对于不支持SSE的平台（如千问返回全量JSON），用IncrementalHelper：
- 记录上次完整内容长度
- 新内容 = 当前内容.substring(上次长度)
- 检测内容长度不变 + isDone → 标记完成

### 2.5 无输出判定

所有平台通用：如果**5秒内**回答内容长度没有任何变化，直接标记完成。不区分SSE/DOM，不判断原因（可能是没发送成功、思考中断、接口异常等），统一按完成处理。

---

## 三、首期实现：AI总结回复

### 3.1 功能流程

```
用户选择AI面板 → Send All（已有，不动）
      ↓
AI回答中（后台持续检测完成状态）
      ↓
全部完成 或 2分钟超时 → 自动触发
      ↓
读取"融合目标AI"下拉列表的选择（默认DeepSeek）
      ↓
收集答案（专用提取器 + 去掉所有空行）+ 拼接提示词
      ↓
新开目标AI标签页 → 注入提示词 → 自动发送
```

**说明：** "融合目标AI"下拉列表是提前配置的，用户在发送问题前或回答过程中随时可以修改选择。系统在触发融合时读取当前选择。

### 3.2 答案提取

7个国内平台专用提取器，通过iframe postMessage机制收集：

| 平台 | 网址 | 提取器文件 | 主选择器 | 状态 |
|------|------|-----------|---------|------|
| DeepSeek | chat.deepseek.com | answer-extractor-deepseek.js | `.ds-assistant-message-main-content` | 已完成 |
| 豆包 | doubao.com | answer-extractor-doubao.js | `.md-box-root` | 已完成 |
| 智谱清言 | chatglm.cn | answer-extractor-zhipu.js | `.markdown-body.md-body` | 已完成 |
| 文心一言 | yiyan.baidu.com | answer-extractor-wenxin.js | `.custom-html.md-stream-desktop` | 已完成 |
| 元宝 | yuanbao.tencent.com | answer-extractor-yuanbao.js | `.hyc-common-markdown-style` | 已完成 |
| 千问 | qianwen.com | answer-extractor-qianwen.js | `.qk-markdown-complete` | 已完成 |
| Kimi | kimi.com | answer-extractor-kimi.js | `.markdown-container` > `.markdown` | 已完成 |

提取顺序：Phase 1 专用提取器 → Phase 2 通用选择器 → Phase 3 复制按钮 → Phase 4 通用markdown

答案后处理：不做任何过滤，只要 `text.length > 0` 就返回。

### 3.2.1 待改平台DOM结构

#### DeepSeek (chat.deepseek.com)

**HTML结构：**
```html
<div class="ds-markdown ds-assistant-message-main-content">
  <p class="ds-markdown-paragraph"><span>...</span></p>
  <h3><span>...</span></h3>
  <ol>...</ol>
  <ul>...</ul>
  <table>...</table>
  <blockquote>...</blockquote>
</div>
```

**选择器：**
- 根容器：`.ds-assistant-message-main-content`
- 段落：`.ds-markdown-paragraph`
- 粗体：`<strong>`
- 代码：`<code>`

**当前提取器：** 使用 `.ds-assistant-message-main-content`，**无需修改**

---

#### Kimi (kimi.com)

**HTML结构：**
```html
<div data-v-b3358103="" class="markdown-container">
  <div data-v-b3358103="" class="markdown">
    <div class="paragraph">...</div>
    <h2 class="">...</h2>
    <h3 class="">...</h3>
    <ul start="1">
      <li><div class="paragraph">...</div></li>
    </ul>
    <div class="table markdown-table">...</div>
  </div>
</div>
```

**选择器：**
- 根容器：`.markdown-container`
- 内层：`.markdown`
- 段落：`.paragraph`
- 列表项：`<li><div class="paragraph">`
- 代码：`<code class="segment-code-inline">`
- 表格：`.table.markdown-table`
- Vue属性：`data-v-*`（动态，不能用作选择器）

**当前提取器：** 已更新为 `.markdown-container` > `.markdown` 优先

**提取逻辑：**
```javascript
// answer-extractor-kimi.js
1. Primary: .markdown-container（最新选择器）
2. Fallback: .markdown（无容器时）
3. Fallback: .message-list children（兼容旧版）
4. Fallback: utils.extractFromRoleLog()（共享函数）
5. Fallback: .kimi-message-content
```

### 3.3 目标AI选择

默认优先级（用户可修改）：
1. DeepSeek
2. 智谱清言
3. Kimi
4. 千问
5. 文心一言
6. 豆包
7. 元宝

选择逻辑：按优先级取第一个可用AI，新开标签页打开。

### 3.4 提示词模板

```
你是一名专业的AI回答评审员。
【原始问题】
{用户最初发送的问题}
【各AI回答】
--- DeepSeek ---
{DeepSeek的回答}
--- 豆包 ---
{豆包的回答}
...（其他已完成的AI回答）
请对比以上多个AI模型的回答，执行以下任务：
1. 搜索最新信息，去除错误的信息
2. 将相似观点归类合并
3. 按以下格式输出：
【观点名称】
- 支持模型：[列出模型名称]
- 依据：[简述理由]
...（逐个观点列出）
【最终建议】
综合以上分析，给出推荐方案及理由。
```

变量替换：
- `{用户最初发送的问题}` → 从unified-input获取
- `{各AI的回答}` → 从各iframe提取后去掉所有空行

### 3.5 首期支持平台

仅国内8个平台。Panelize Enhanced原有的chatgpt/claude/gemini/grok/google保留但不在首期范围内。

### 3.6 文件变更

#### 新增文件

| 文件 | 说明 |
|------|------|
| `content-scripts/sse-monitor.js` | SSE四路拦截器，运行在AI页面iframe中，检测回答完成 |
| `modules/answer-collector.js` | 答案收集器，通过postMessage汇总各iframe答案 |
| `background/auto-summary.js` | 监听完成事件，拼接提示词，新开标签页并注入 |

#### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `manifest.json` | 新增sse-monitor的content_scripts声明，新增auto-summary的background import |
| `content-scripts/text-injection-all-providers.js` | 集成SSE完成检测回调，复用已有提取器发送答案 |
| `modules/providers.js` | 8个国内平台增加SSE配置字段（urlPattern、detectionKeywords、parseLine） |

### 3.7 通信架构

```
iframe (AI页面)                    background              新标签页 (目标AI)
┌─────────────────┐               ┌──────────┐           ┌──────────────┐
│ sse-monitor.js  │──完成──→      │          │           │              │
│                 │               │ auto-    │──注入──→  │ text-inject  │
│ text-injection  │──答案──→      │ summary  │──发送──→  │ (目标AI页面) │
│ (提取器)        │               │          │           │              │
└─────────────────┘               └──────────┘           └──────────────┘
     postMessage                    chrome.tabs.create      content script
                                    + scripting.executeScript
```

### 3.8 新标签页位置

**放在第一个（最左边）**，原因：
1. 自动触发时用户直接看总结，不需要滚动查找
2. 总结是核心输出，应该最显眼
3. 用户的阅读习惯是从左到右，第一个位置最优先

**实现方式：**
```javascript
// 新标签页插入到最前面
await chrome.tabs.create({
  url: targetUrl,
  active: true,
  index: 0 // 插入到第一个位置
});
```

---

## 四、开发进度

### 4.1 已完成

#### UI组件（multi-panel.html）
- 新增"融合目标AI"按钮
- 新增AI选择下拉列表（7个平台，按优先级排序）
- 新增"一键复制"按钮

#### 样式（multi-panel.css）
- 新增 `.merge-ai-container` 容器样式
- 新增 `.merge-btn` 按钮样式
- 新增 `.merge-select` 下拉框样式
- 新增 `.copy-btn` 按钮样式（含复制成功状态）

#### 答案提取器（text-injection-all-providers.js）
- 移植7个国内平台提取器
- 修改Kimi选择器：`.message-list` → `.markdown-container`
- 添加提取请求监听（postMessage）

| 平台 | 主选择器 | 状态 |
|------|---------|------|
| DeepSeek | `.ds-assistant-message-main-content` | 已完成 |
| Kimi | `.markdown-container` > `.markdown` | 已完成 |
| 智谱清言 | `.markdown-body.md-body` | 已完成 |
| 文心一言 | `.custom-html.md-stream-desktop` | 已完成 |
| 豆包 | `.md-box-root` | 已完成 |
| 千问 | `.qk-markdown-complete` | 已完成 |
| 元宝 | `.hyc-common-markdown-style` | 已完成 |

#### 逻辑（multi-panel.js）
- 实现AI名称映射（aiNames对象）
- 实现融合按钮点击事件
- 实现汇总提示词构建
- 实现新标签页创建和脚本注入
- 通信架构：requestId + pendingAnswerExtractions Map
- 实现 `sendExtractToAllPanels()` - 发送EXTRACT_ANSWER到所有面板，1秒后读取已收集答案
- 实现 `handleExtractedAnswer()` - 收到响应就收集，同一provider不重复，不做等待判断
- 实现 `copyAllAnswers()` - 复制到剪贴板（带fallback）

#### 提供商配置（modules/providers.js）
- 删除海外平台（ChatGPT、Claude、Gemini、Grok、Google）
- 保留国内7个平台

#### 默认配置（modules/provider-defaults.js）
- 更新默认启用的提供商列表

#### 权限（manifest.json）
- 添加 `tabs` 权限
- 添加国内AI平台 `host_permissions`
- 添加国内AI平台 `content_scripts`
- 删除海外平台权限

#### iframe绕过规则（rules/bypass-headers.json）
- 删除海外平台规则（chatgpt、claude、gemini、grok、google）
- 新增国内7个平台的 `X-Frame-Options` 和 `Content-Security-Policy` 移除规则
- 覆盖域名：deepseek、kimi.com/www.kimi.com、doubao.com/www.doubao.com、qianwen.com/www.qianwen.com、chatglm.cn/www.chatglm.cn、yiyan.baidu.com/www.yiyan.baidu.com、yuanbao.tencent.com
- 无此规则会导致AI网站拒绝iframe加载（"拒绝连接"）

#### 发送按钮选择器（SEND_BUTTON_SELECTORS）
- 新增 `qianwen`：Send/发送/发送消息/class*="send"/type="submit"
- 新增 `zhipu`：Send/发送/发送消息/type="submit"
- 新增 `wenxin`：Send/发送/发送消息/type="submit"/class*="send"/role="button"/send-btn
- 新增 `yuanbao`：Send/发送/发送消息/type="submit"/class*="send"

#### 输入框选择器（PROVIDER_SELECTORS）
- 新增 `qianwen`：textarea[class*="input"]、placeholder含"输入"/"提问"、.chat-input textarea、通用textarea、contenteditable
- 新增 `zhipu`：textarea含placeholder、.chat-input textarea、通用textarea、contenteditable
- 新增 `wenxin`：textarea含placeholder、.chat-input textarea、.input-area textarea、通用textarea、contenteditable
- 新增 `yuanbao`：textarea含placeholder、.chat-input textarea、.input-area textarea、通用textarea、contenteditable

#### 平台识别（detectProvider）
- 新增 `qianwen.com` → qianwen
- 新增 `chatglm.cn` → zhipu
- 新增 `yiyan.baidu.com` → wenxin
- 新增 `yuanbao.tencent.com` → yuanbao
- 此前缺失导致4个平台在iframe中返回null，整个注入流程直接退出

#### 内容注入策略（injectTextIntoElement）
- contenteditable分支从简单 execCommand + text node 改为调用 `injectIntoContentEditable` 多策略异步注入
- 新增7种策略逐步尝试：
  1. beforeinput InputEvent（Lexical/Slate/ProseMirror）
  2. execCommand（经典contenteditable）
  3. insertFromPaste InputEvent + DataTransfer（React编辑器）
  4. ClipboardEvent paste
  5. composition events（IME输入法风格）
  6. 逐字符输入
  7. textContent暴力写入 + input事件
- 每种策略后验证 `currentText(el)` 是否有内容，有则返回
- 新增辅助函数：`currentText()`、`selectAllContent()`

#### 发送延迟
- `injectText` 中千问/文心从500ms改为1500ms（contenteditable异步注入需要时间）
- INJECT_TEXT处理中千问/文心同样从500ms改为1500ms（两处：首次注入和重试注入）

#### Enter键发送兜底
- `clickSendButton` 末尾的 Enter key fallback 从 `kimi || doubao` 扩展为 `kimi || doubao || qianwen || zhipu || wenxin || yuanbao`
- 当发送按钮选择器找不到或按钮disabled时，对输入框发送Enter键事件

#### 图片支持配置
- `PROVIDER_IMAGE_SUPPORT` 新增 qianwen/zhipu/wenxin/yuanbao: false
- `FILE_INPUT_SELECTORS` 新增 qianwen/zhipu/wenxin/yuanbao: ['input[type="file"]']

#### 答案提取器（answer-extractor-*.js + text-injection-all-providers.js）
- 7个平台各有独立提取器文件，通过 `window.__panelize_extractors` 注册
- 提取顺序：Phase 1 专用提取器 → Phase 2 通用选择器 → Phase 3 复制按钮 → Phase 4 通用markdown
- 所有长度限制已删除，只要 `text.length > 0` 就返回
- 所有文本过滤已删除（cleanCopyText/cleanDoubaoNoise/cleanWenxinNoise 已移除）
- 新增共享 fallback 函数：`extractFromRoleLog()`、`extractFromRoleList()`
- Kimi 选择器更新为 `.markdown-container` > `.markdown` 优先

#### isVisibleElement 可见性判断修复
- 原逻辑用 `offsetParent === null` 判断不可见，在 `position: fixed`、iframe嵌套、body元素上会误判
- 替换为 `getComputedStyle` 检查 `display:none` / `visibility:hidden`
- 保留 `aria-hidden` 检查和 `getBoundingClientRect` 视口边界检查

#### EXTRACT_ANSWER 消息协议修复
- 删除旧的独立监听器（`PANELIZE_EXTRACT_ANSWER` / `PANELIZE_ANSWER_EXTRACTED`）
- 在 `handleTextInjection` 中新增 `EXTRACT_ANSWER` 处理器，与 multi-panel.js 协议一致
- 接收 `type: 'EXTRACT_ANSWER'` + `context: 'multi-panel'`
- 回复 `type: 'EXTRACTED_ANSWER'` + `context: 'multi-panel-answer'` + `panelId` + `requestId`

#### 状态提示中文化
- `broadcastMessage`：发送中/已发送到X个AI/已填入X个输入/发送失败/填入失败/发生错误
- `triggerSendButtons`：发送中/已发送到X个AI/发生错误

### 4.3 本轮修复的已知问题

| 问题 | 原因 | 修复 |
|------|------|------|
| 千问/文心/智谱/元宝 iframe加载失败（拒绝连接） | bypass-headers.json 缺少国内平台的 X-Frame-Options/CSP 移除规则 | 新增12条国内平台绕过规则 |
| 智谱/千问/文心/元宝 Send All 无效 | detectProvider() 缺少4个平台识别，返回null导致注入流程退出 | detectProvider新增 qianwen/chatglm.cn/yiyan.baidu.com/yuanbao.tencent.com |
| 千问/文心 Send All 无效 | 缺少 ButtonFinderUtils 文本匹配发送 + 缺少 Enter key 兜底 | clickSendButton新增 qianwen/wenxin 特殊处理 + tryEnterKeySend 函数 |
| 智谱/元宝 Send All 无效 | Enter key fallback 只覆盖 kimi/doubao，不含智谱/元宝 | Enter key fallback 扩展为所有6个国内平台 |
| 所有contenteditable平台注入失败 | injectTextIntoElement 只用简单execCommand，不兼容各框架 | 移植 injectIntoContentEditable 7策略异步注入 |
| 千问/文心 发送过快（文本未就绪） | injectText延迟500ms，contenteditable异步注入需更长时间 | 延迟改为1500ms |
| 4个平台输入框选择器缺失 | PROVIDER_SELECTORS 没有 qianwen/zhipu/wenxin/yuanbao 条目 | 补全4个平台的 textarea/contenteditable 选择器 |
| 4个平台发送按钮选择器缺失 | SEND_BUTTON_SELECTORS 没有 qianwen/zhipu/wenxin/yuanbao 条目 | 补全4个平台的按钮选择器 |
| 一键复制完全无响应 | content script 监听 `PANELIZE_EXTRACT_ANSWER`，multi-panel.js 发送 `EXTRACT_ANSWER`，消息类型不匹配 | 删除旧监听器，在 handleTextInjection 中新增 EXTRACT_ANSWER 处理器，回复 EXTRACTED_ANSWER + context |
| 元宝提取失败 | extractYuanbaoAnswer 只有2层策略，缺少 ARIA fallback | 补全 `[class*="markdown-body"]`、`[role="log"]`、`[role="list"]` 3个fallback |
| 文心提取失败 | extractWenxinAnswer 缺少 cleanWenxinNoise 和多个 fallback | 补全噪音清理函数、`[role="log"]`、viewer children、`.markdown-body` 全局、`[role="list"]` fallback |
| 豆包提取失败 | extractDoubaoAnswer 缺少 cleanDoubaoNoise 和 ARIA fallback | 补全噪音清理函数、`[role="log"]`、`[role="list"]`、`.markdown-body` fallback |
| 千问提取失败 | extractQianwenAnswer 缺少 CSS Modules 和 ARIA fallback | 补全 `[class*="markdown-body"]`、`[role="list"]`、`[role="log"]` fallback |
| Kimi提取失败 | extractKimiAnswer 选择器顺序不对，缺少 .kimi-message-content | 调整为 .message-list 优先（backup策略），新增 .kimi-message-content fallback |
| 状态提示为英文 | broadcastMessage 和 triggerSendButtons 中状态文案为英文 | 全部改为中文（发送中/已发送到X个AI/已填入X个输入/发送失败/发生错误） |
| 部分平台一键复制取不到值 | isVisibleElement 用 `offsetParent === null` 判断可见性，在 `position: fixed` 和 iframe 中误判为不可见，导致提取器第一层选择器就被跳过 | 替换为 `getComputedStyle` 检查 `display:none` / `visibility:hidden`，不再依赖 offsetParent |
| 一键复制逻辑过度复杂 | 原逻辑有20秒超时、settled判断、panelsWithContent计数、2秒buffer等，增加复杂度且不能解决根本问题 | 简化为：发EXTRACT_ANSWER → 等1秒 → 读已收集答案 → 复制。handleExtractedAnswer只做收集，不做任何等待判断 |

### 4.3.1 本轮改动（文本提取重构 + 提取器合并）

#### 提取顺序调整
- 原顺序：Phase 1 通用选择器 → Phase 2 专用提取器
- 新顺序：Phase 1 专用提取器 → Phase 2 通用选择器
- 原因：通用选择器（DIRECT_ANSWER_SELECTORS）容易匹配到UI元素（按钮文字等），专用提取器更精确

#### 删除长度过滤
- 所有提取器的 `text.length > MIN_ANSWER_LENGTH && text.length < MAX_ANSWER_LENGTH` 改为 `text.length > 0`
- `copyAllAnswers` 的 `>= 5` 过滤改为 `> 0`
- 只要取到内容就返回，不再因长度丢弃答案

#### 删除文本过滤
- 移除 `cleanCopyText`（通用噪音清理）从 `extractByDirectSelector` 和 `extractByCopyButton`
- 移除 `cleanDoubaoNoise` 从豆包提取器
- 移除 `cleanWenxinNoise` 从文心提取器
- 原始文本直接返回，不做任何后处理

#### 共享 fallback 函数
新增两个公共函数到 `window.__panelize_extractor_utils`：

| 函数 | 用途 | 使用的提取器 |
|------|------|------------|
| `extractFromRoleLog()` | 遍历 `[role="log"]` 及其子元素 | doubao、kimi、metaso、qianwen、yuanbao |
| `extractFromRoleList()` | 遍历 `[role="list"]` 的 `[role="listitem"]` | doubao、qianwen、yuanbao |

各提取器调用 `utils.extractFromRoleLog()` / `utils.extractFromRoleList()` 代替重复的遍历代码。

#### Kimi 选择器更新
- 旧：`.message-list` 优先
- 新：`.markdown-container` > `.markdown` 优先（按改造方案文档）
- 保留 `.message-list` 作为 legacy fallback

#### isVisibleElement 修复
- `offsetParent === null` → `getComputedStyle` 检查 `display:none` / `visibility:hidden`
- 修复 `position: fixed`、iframe嵌套中元素被误判为不可见的问题

#### UI 调整
- 一键复制按钮从 toolbar 移到底部输入栏，紧跟 Send All 右侧
- 输入框缩小：padding 10px→6px，min-height 40px→32px，max-height 150px→80px，字号 14px→13px

#### 调试功能
- `EXTRACT_DEBUG` 消息：诊断每个提取阶段的匹配情况
- `debugExtraction()` 全局函数：从 Console 触发诊断
- `[Extract]` 日志：每个阶段的 hit/miss 和提取长度
- `[CopyAll]` 日志：面板响应状态和超时检测

### 4.4 当前已知问题

| 问题 | 状态 |
|------|------|
| Kimi 提取返回空 | 已更新选择器为 `.markdown-container`，待测试验证 |
| 通用选择器匹配到UI元素（36-38字符） | 已调整提取顺序，专用提取器优先 |
| `debugExtraction()` 无日志输出 | 模块作用域问题，改用复制按钮测试 |

### 4.5 自动融合功能（已完成 + 已迭代4轮）

#### 功能概述
Send All 发送问题到多个 AI → 等待所有 AI 回答完成 → 自动收集答案 → 在最左边创建融合面板 → 注入总结提示词 → 自动发送。

#### 最终功能流程
```
用户提问 → Send All（只发给普通面板）
      ↓
按钮状态监控（只监控普通面板）
      ↓
所有普通面板完成 → 收集答案 → 拼接提示词
      ↓
┌─ 有匹配的融合面板？
├─ YES → 直接注入+发送（不开新会话）
└─ NO  → 创建新融合面板 → 注入+发送
```

#### 融合面板双标识体系

融合面板由两个标识共同定义：
- `providerId` — 哪个 AI（如 deepseek、kimi）
- `mergePanelIds` Set — 是否为融合面板（面板 id 在此 Set 中即为融合面板）

判断逻辑：
- `isMergePanel(panel)` — 检查 `mergePanelIds.has(panel.id)`
- `getNonMergePanels()` — 返回 `!isMergePanel(p)` 的面板列表

#### 融合面板隔离策略

融合面板**完全隔离**于批量操作：
- **Send All** — 只发给普通面板，融合面板不接收
- **Fill** — 只填普通面板
- **Clear** — 只清普通面板
- **New Chat** — 只对普通面板开新会话，融合面板不受影响

完成检测（按钮状态监控）也只监控普通面板，融合面板不参与完成计数。

#### 融合面板复用逻辑（最终版）

当融合触发时：
1. 查找已有融合面板：`providerId 匹配` + `panel.id 在 mergePanelIds 中`
2. **找到匹配的融合面板** → **直接注入提示词 + 自动发送**（不开新会话，追加到当前对话）
3. **没找到** → 在最左边创建新融合面板 → iframe 加载后注入提示词 + 自动发送

融合面板**永久保留**，每次新的总结都追加到同一个对话中，形成持续的评审记录。

时序示例：
- 第1次选 DeepSeek → 创建 "DeepSeek (融合)" 面板 → 注入总结1
- 第2次选 DeepSeek → 复用已有面板 → 直接注入总结2（追加到同一对话）
- 第3次选豆包 → 创建 "豆包 (融合)" 面板（不同 provider）

#### 完成检测机制（最终版：按钮状态监控）
**方案演进：**
1. **v1 轮询检测**：每5秒 extractAllAnswers()，连续2次相同=完成。问题：提取本身不可靠，且浪费资源。
2. **v2 MutationObserver**：每个 iframe 监控 DOM 变化，3秒无变化=完成。问题：页面动态内容多，容易误判。
3. **v3 按钮状态监控（最终版）**：检测停止按钮的出现/消失。
   - Phase 1：等停止按钮出现（AI 开始生成）
   - Phase 2：等停止按钮消失（AI 完成）→ 500ms 确认 → 发送 COMPLETION_DETECTED
   - Fallback：20秒内无停止按钮 → 退回 MutationObserver

**为什么用按钮状态监控（参考 AI 对撞机）：**
- AI 对撞机用 SSE 拦截（拦截 fetch/XHR/TextDecoder/ReadableStream），能精确知道流式响应何时结束
- 但 SSE 拦截需要每个平台单独配置 urlPattern 和 parseLine，实现复杂
- 按钮状态监控是通用方案：所有 AI 在生成时都会显示"停止"按钮，完成后消失
- 比 DOM 变化检测更可靠，比 SSE 拦截更简单

#### 注入问题修复（根因分析 + 修复）

**问题1：原始问题为空**
- 根因：Enter 键发送路径没有设置 `lastSentQuestion`，没有调用 `startMergeMonitor()`
- 修复：Enter keydown handler 增加 `lastSentQuestion = input.value` + `startMergeMonitor()`

**问题2：自动发送不生效**
- 根因1：`setFormControlValue` 用 `new Event('input')`，React 16+ 不识别（只响应 `InputEvent` 带 `inputType`），框架内部状态没更新 → 发送按钮一直是 disabled
- 修复1：改为 `new InputEvent('input', { inputType: 'insertText', data: value })`
- 根因2：`clickSendButton` 遇到 disabled 按钮就跳过，不尝试 Enter 键
- 修复2：检测到 disabled 按钮后立即尝试 Enter 键兜底（参考 AI 对撞机的 `_send` 方法）

**参考对比：**
| | AI 对撞机 | Panelize（修复前） | Panelize（修复后） |
|---|---|---|---|
| 文本注入 | `nativeSetter` + `Event` | `nativeSetter` + `Event` | `nativeSetter` + `InputEvent` |
| ContentEditable | `execCommand` + `ClipboardEvent` | `ClipboardEvent` + `execCommand` | 同左 + `InputEvent('insertFromPaste')` |
| disabled 按钮 | 降级到 `simulateEnter` | 返回 false | 降级到 `pressEnterOnProviderInput` |
| Enter 模拟 | `keydown` only | `keydown` + `keypress` + `keyup` | 不变（已正确） |

#### 提示词模板（最终版）
```
今天是{日期}，你是一名专业的AI回答评审员。
【原始问题】
{用户问题}
【各AI回答】
【DeepSeek】
{回答}
【千问】
{回答}
...
请对比以上多个AI模型的回答，执行以下任务：
1. 根据今天日期，搜索最新信息，去除过时或错误的信息
2. 将相似观点归类合并，只总结推荐排名前50%的方案，至少保留3个最佳选择
3. 按以下格式输出：
【观点名称】
- 支持模型：[列出模型名称]
- 依据：[简述理由]
...（逐个观点列出）
【最终建议】
综合以上分析，给出推荐方案及理由。
```

#### UI 元素
- 融合目标 AI 下拉框（7个平台可选，默认 DeepSeek）
- 融合按钮（绿色，手动触发；橙色脉冲 = 自动监控中）
- Temporary Chat 按钮已隐藏（国内 AI 不支持）

#### 文件变更
| 文件 | 变更 |
|------|------|
| multi-panel.html | 新增融合下拉框 + 按钮，隐藏 Temporary Chat |
| multi-panel.css | 融合 UI 样式（含 dark theme + 脉冲动画） |
| multi-panel.js | 融合逻辑（监控 + 提示词 + 面板创建/复用 + 面板隔离） |
| text-injection-all-providers.js | 按钮状态监控 + InputEvent 修复 + Enter 降级 + auto-merge 白名单 |

#### 提示词模板（最终版）
```
今天是{日期}，你是一名专业的AI回答评审员。
【原始问题】
{用户问题}
【各AI回答】
【DeepSeek】
{回答}
【千问】
{回答}
...
请对比以上多个AI模型的回答，执行以下任务：
1. 根据今天日期，搜索最新信息，去除过时或错误的信息
2. 将相似观点归类合并，只总结推荐排名前50%的方案，至少保留3个最佳选择
3. 按以下格式输出：
【观点名称】
- 支持模型：[列出模型名称]
- 依据：[简述理由]
...（逐个观点列出）
【最终建议】
综合以上分析，给出推荐方案及理由。
```

#### UI 元素
- 融合目标 AI 下拉框（7个平台可选，默认 DeepSeek）
- 融合按钮（绿色，手动触发；橙色脉冲 = 自动监控中）
- Temporary Chat 按钮已隐藏（国内 AI 不支持）

#### 融合触发状态提示（待实现）

用户无法区分融合是"正常完成触发"还是"超时强制触发"，需要在触发时显示 toast 提示。

**实现方案：**

在 `handleMergeCompletionDetected()` 中（正常完成路径）：
```javascript
if (mergeCompletedPanels.size >= nonMergeCount) {
  showToast('所有AI回答完成，开始融合');
  stopMergeMonitor();
  triggerMerge();
}
```

在 `startMergeMonitor()` 的超时回调中（超时路径）：
```javascript
mergeTimeoutTimer = setTimeout(() => {
  if (!mergeIsActive) return;
  showToast('等待超时，开始融合');
  stopMergeMonitor();
  triggerMerge();
}, MERGE_MAX_WAIT);
```

**效果：**
- 正常完成：显示 `"所有AI回答完成，开始融合"`
- 超时触发：显示 `"等待超时，开始融合"`

用户一眼就能看出融合是哪种情况触发的。

#### 文件变更
| 文件 | 变更 |
|------|------|
| multi-panel.html | 新增融合下拉框 + 按钮，隐藏 Temporary Chat |
| multi-panel.css | 融合 UI 样式（含 dark theme + 脉冲动画） |
| multi-panel.js | 融合逻辑（监控 + 提示词 + 面板创建/复用 + 面板隔离） |
| text-injection-all-providers.js | 按钮状态监控 + InputEvent 修复 + Enter 降级 + auto-merge 白名单 |

### 4.6 待完成

- [ ] 端到端测试完整融合流程
- [ ] 融合面板关闭时的清理逻辑
- [ ] 多面板模式下融合面板的位置优化

### 4.7 提示词模板更新（已实现）

输出格式新增「复述原始问题」步骤：

**中文模板：**
```
输出格式（严格遵守）：
【原始问题】
（用一句话复述原始问题，便于后续回顾时快速理解上下文）

【观点名称】
...
```

**英文模板：**
```
Output Format (strictly follow):
[Original Question]
(Restate the original question in one sentence for context)

[Viewpoint Name]
...
```

目的：融合答案自包含，过段时间回看仍能理解上下文，导出到 Obsidian 后笔记也完整。

### 4.8 添加面板菜单修复（已实现）

**问题：** 点击面板区域无法关闭添加面板菜单，只能点击+号或输入框行关闭。

**根因：** 原代码用 `click` 事件 + `e.target !== btn` 判断，面板区域的 `stopPropagation` 导致事件未到达 document。

**修复：** 改用 `pointerdown` 事件（比 click 更早触发，不受 stopPropagation 影响），判断条件改为 `!btn.contains(e.target)` 更准确。

### 4.9 自定义融合提示词（待实现）

详细设计见 `docs/superpowers/specs/2026-06-15-custom-merge-prompt-design.md`。

**功能：** 在设置页面让用户自定义融合提示词模板（中文 + 英文各一个 textarea），展示默认模板供参考和修改。

**格式约束：**
- 必需占位符：`{question}` 和 `{answers}` 必须同时存在
- 最大长度：2000 字符
- 实时校验 + 恢复默认按钮

**存储：** `mergePromptTemplateZh` / `mergePromptTemplateEn`，null = 使用内置默认。

**文件变更：** options.html、options.js、settings.js、multi-panel.js、locales。

---

## 五、UI重构（已完成）

### 5.1 已完成的改动

| 改动 | 说明 |
|------|------|
| 删除顶部工具栏 | 不再有 Panelize 文字、面板标签栏 |
| 面板标签栏删除 | 不显示 DeepSeek × Kimi × 那一行 |
| 添加面板按钮移到底部 | 在融合按钮右边，点 + 弹出AI选择菜单 |
| 分页系统 | 布局(1x3)控制每页显示面板数，左右箭头翻页 |
| 面板右上角操作按钮 | 复制链接、刷新、回到首页、放大、关闭 |
| 所有英文UI中文化 | 按钮、提示、设置页面全部中文 |
| 删除Fill按钮 | 不再需要 |
| 布局简化为1x1到1x5 | 删除1x6到4x2等复杂布局 |
| 删除设置中的AI提供商和默认布局选项 | 不再需要用户配置 |
| 面板状态恢复 | 关闭再打开恢复上次面板列表和页码 |

### 5.2 提取模式（isExtractMode）

分页导致隐藏页面的面板无法提取答案和检测完成状态。解决方案：

- 内容脚本新增 `isExtractMode` 标志
- 开启时 `isVisibleElement` 始终返回 true，`clickSendButton` 跳过 `isElementEnabled` 检查
- `extractAllAnswers()` 提取前开启，完成后关闭
- `startMergeMonitor()` 开启，`stopMergeMonitor()` 关闭

### 5.3 已知问题

| 问题 | 状态 |
|------|------|
| 文心一言/智谱选择器过时 | 待更新CSS选择器（需真实页面诊断） |
| 文心一言不自动加载 | 已修复：position:absolute + opacity:0 |
| 多语言未在多面板页面生效 | 已修复：自定义I18N系统 + applyI18n() |
| 主题切换不完善 | 已修复：CSS变量 + data-theme + @media兜底 |
| 自动融合失效 | 已修复：纯MutationObserver方案（5秒稳定延迟） |
| 设置不同步 | 已修复：chrome.storage.onChanged实时监听 |
| 面板数量限制8个 | 已修复：移除MAX_PANELS限制 |
| 底部按钮外观不一致 | 已修复：统一36x36，去掉文字只保留图标 |
| 深色模式面板网页仍白色 | 方案评估完成：见5.4节。推荐方案A（content_script注入CSS filter） |
| 英文模式面板header按钮仍中文 | 已修复：applyI18n()中重新渲染所有面板header-right + 面板添加data-providerId |
| 版本更新功能失效 | 已处理：相关代码已注释保留，不生效 |

### 5.4 深色模式 iframe 方案评估

**问题：** 面板框架（标题栏、边框、背景）已支持深色，但 iframe 内部的 AI 网站仍然是白色。

**方案评估：**

| 方案 | 原理 | 优点 | 缺点 | 推荐度 |
|------|------|------|------|--------|
| A. content_script 注入 CSS | 利用已有的 content_scripts 配置，注入 `filter: invert(1) hue-rotate(180deg)` | 稳定、可控、仅深色模式激活 | 图片/视频会被反转（需额外回转处理） | ★★★ |
| B. iframe 外层 CSS filter | 在 multi-panel.css 对 iframe 容器加 `filter: invert(1)` | 最简单 | 副作用大，图片全反转 | ★★ |
| C. prefers-color-scheme | 依赖 AI 网站自身支持 | 无需代码 | 多数 AI 不支持 | ★ |

**推荐方案A：content_script 注入 dark mode CSS**

实现思路：
1. 新增 `content-scripts/dark-mode.css`：定义反转样式
2. 在 manifest.json 的每个 AI 站点 content_scripts 中添加该 CSS（仅深色模式时注入）
3. 用 `chrome.storage.sync` 读取主题设置，动态注入/移除 CSS
4. 对 `img`, `video`, `svg` 等元素做回转处理（`filter: invert(1) hue-rotate(180deg)`）

关键发现：
- 扩展已有 `scripting` 权限和各 AI 站点的 `host_permissions`
- `all_frames: true` 已启用，CSS 会自动注入到 iframe
- 参考 Dark Reader 的反转+回转模式

**待实现：** 需要新建 CSS 文件和修改 manifest.json。

### 5.5 版本更新功能讨论

**现状：**
- 版本检查指向 `Manho/Panelize`（原作者仓库），不是当前 fork 仓库
- 本地版本 `1.1.1`，原仓库可能是不同版本，检查结果不可靠
- 更新下载链接指向原仓库 zip，下载的是原版不是增强版
- version-checker.js 使用 `chrome.i18n` 的 `t()` 函数，与 multi-panel 页面的自定义 I18N 系统不一致

**结论：版本更新功能已失效，建议移除。**

原因：
1. 这是 fork 项目，更新应由开发者手动管理，不应指向原仓库
2. 用户手动安装的扩展无法自动更新（Chrome 限制非商店扩展）
3. 检查原仓库的版本号没有意义（两个独立项目）
4. 代码维护成本：version-checker.js、service-worker.js 中的版本检查逻辑、options.html 中的更新 UI

**建议操作：**
- 移除 version-checker.js 模块
- 移除 options.html 中的"检查更新"按钮和"下载最新版本"链接
- 移除 service-worker.js 中的版本检查消息处理
- 保留 manifest.json 中的版本号（用于显示当前版本）

---

## 六、主题与多语言方案（已完成）

### 6.1 竞品参考：Ask-AI-Together

GitHub: [Junyu06/Ask-AI-Together](https://github.com/Junyu06/Ask-AI-Together)

#### 主题方案

使用 CSS 变量 + `data-theme` 属性：

```css
:root {
  --bg: #f7f7f7;
  --surface: #ffffff;
  --text: #111111;
  --text-muted: #666666;
  --accent: #2563eb;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f0f0f;
  --surface: #181818;
  --text: #f5f5f5;
  --accent: #60a5fa;
}
```

JS 切换逻辑：

```javascript
let themeMode = "system"; // "system" | "light" | "dark"
const mediaDark = window.matchMedia("(prefers-color-scheme: dark)");

function getEffectiveTheme() {
  if (themeMode === "system") {
    return mediaDark.matches ? "dark" : "light";
  }
  return themeMode;
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", getEffectiveTheme());
}

// 监听系统主题变化
mediaDark.addEventListener("change", () => {
  if (themeMode === "system") applyTheme();
});
```

持久化：`chrome.storage.local.set({ themeMode: mode })`

#### 多语言方案

自定义 i18n，不使用 `chrome.i18n` API：

```javascript
const I18N = {
  zh: {
    settings_title: "设置",
    send_all: "发送",
    merge: "融合",
    // ... 所有UI文字
  },
  en: {
    settings_title: "Settings",
    send_all: "Send All",
    merge: "Merge",
    // ...
  }
};

let locale = "zh";
let localeMode = "auto"; // "auto" | "zh" | "en"

function t(key) {
  return I18N[locale]?.[key] || I18N.en[key] || key;
}

function detectLocale() {
  if (localeMode === "zh" || localeMode === "en") return localeMode;
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

function applyI18n() {
  locale = detectLocale();
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
}
```

持久化：`chrome.storage.local.set({ localeMode: mode })`

### 6.2 当前Panelize的问题

| 问题 | 原因 | 修复方案 |
|------|------|---------|
| 多面板页面多语言不生效 | `translatePage()` 未调用 | 在 `init()` 中调用 `translatePage()` |
| 主题只支持 dark/light | 没有"跟随系统"选项 | 新增 system 模式，监听 `prefers-color-scheme` |
| CSS 硬编码颜色值 | 每个元素单独写颜色 | 改为 CSS 变量，统一管理 |
| 设置页面语言切换不完整 | 部分 key 缺失或不匹配 | 已修复 `optTabMode`/`sectionMultiPanel` |

### 6.3 实现计划

1. **CSS 变量化**：将所有硬编码颜色改为 CSS 变量（`--bg`, `--surface`, `--text` 等）
2. **主题系统**：3种模式（跟随系统/浅色/深色），`data-theme` 属性控制
3. **多语言系统**：自定义 I18N 字典 + `data-i18n` 属性扫描，3种模式（自动/中文/英文）
4. **设置页面**：新增主题和语言选项
5. **持久化**：`chrome.storage.local` 保存用户选择

---

## 七、iframe加载策略（已修复）

采用 position:absolute + opacity:0 方案。隐藏面板脱离 grid 文档流（避免占位错乱），opacity:0 让 iframe 仍能正常加载。

### 7.1 问题

分页用 `display: none` 隐藏面板，导致：
- 文心一言等页面不自动加载
- 需要手动切换到该页面才加载
- 其他AI（DeepSeek等）没有此问题

### 7.2 竞品方案：Ask-AI-Together

**核心思路**：所有 iframe 立即创建并加载，用 CSS overlay 控制可见性，不用 `display: none`。

```javascript
function createPane(site) {
  const pane = document.createElement("div");
  pane.className = "pane is-loading";
  pane.innerHTML = `<iframe src="${url}" allow="clipboard-read; clipboard-write"></iframe>`;
  
  const frame = pane.querySelector("iframe");
  frame.addEventListener("load", () => {
    pane.classList.remove("is-loading");
  });
  // 安全超时：12秒后即使load事件没触发也移除加载遮罩
  setTimeout(() => pane.classList.remove("is-loading"), 12000);
  
  return pane;
}
```

CSS 加载遮罩：

```css
.pane::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--surface);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s;
  z-index: 1;
}

.pane.is-loading::before {
  opacity: 1; /* 加载时遮盖iframe */
}
```

**关键细节**：面板缓存（`paneCacheBySite` Map），切换布局时移动已有面板 DOM 而不是重建，避免 iframe 刷新丢失状态。

### 7.3 当前Panelize的分页方案

```javascript
// renderCurrentPage() 的当前实现
panels.forEach((panel, index) => {
  const panelEl = document.getElementById(panel.id);
  if (index >= startIndex && index < endIndex) {
    panelEl.style.display = '';    // 显示
  } else {
    panelEl.style.display = 'none'; // 隐藏 → 导致iframe不加载
  }
});
```

### 7.4 修复方案

**方案A：visibility代替display（推荐）**

```javascript
panels.forEach((panel, index) => {
  const panelEl = document.getElementById(panel.id);
  if (index >= startIndex && index < endIndex) {
    panelEl.style.display = '';
    panelEl.style.visibility = '';
    panelEl.style.position = '';
  } else {
    panelEl.style.display = '';
    panelEl.style.visibility = 'hidden';
    panelEl.style.position = 'absolute';
    panelEl.style.pointerEvents = 'none';
  }
});
```

iframe 保持在 DOM 中且可见（对浏览器而言），会正常加载。但用户看不到。

**方案B：CSS Grid + overflow隐藏**

```css
#panel-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  overflow: hidden;
}
```

所有面板始终渲染，通过 `transform: translateX()` 或 `grid-column` 偏移控制哪些面板可见。

**方案C：预加载后隐藏**

初始化时先显示所有面板，等所有 iframe 触发 `load` 事件后再应用分页隐藏。

### 7.5 推荐方案

采用**方案A**，原因：
- 改动最小，只需修改 `renderCurrentPage()` 函数
- iframe 保持在 DOM 中，浏览器会正常加载
- `visibility: hidden` 不影响布局计算
- `pointer-events: none` 防止隐藏面板接收点击事件
- 不需要改 CSS Grid 结构

---

## 八、文心一言/智谱选择器更新（待实现）

### 8.1 问题

文心一言和智谱的CSS选择器过时，4个提取阶段全部返回空：
- Phase 1 (provider extractor): returned empty
- Phase 2 (direct selector): miss
- Phase 3 (copy button): miss
- Phase 4 (generic markdown): len: 0

豆包和千问的选择器正确，但 `isVisibleElement` 误判不可见（已修复）。

### 8.2 诊断结果

| 平台 | 主选择器 | 诊断结果 |
|------|---------|---------|
| 豆包 | `.md-box-root` | 32个元素 ✓（isVisibleElement已修复） |
| 千问 | `.qk-markdown-complete` | 32个元素 ✓（isVisibleElement已修复） |
| 文心 | `.custom-html.md-stream-desktop` | 0个元素 ✗ |
| 智谱 | `.markdown-body.md-body` | 0个元素 ✗ |

### 8.3 修复步骤

1. 在文心一言页面 Console 运行诊断命令找到新选择器
2. 在智谱页面 Console 运行诊断命令找到新选择器
3. 更新 `answer-extractor-wenxin.js` 和 `answer-extractor-zhipu.js`
4. 更新 `DIRECT_ANSWER_SELECTORS` 和 `COPY_BUTTON_SELECTORS`

---

## 九、海外平台重新接入（待实现）

### 9.1 目标

将 ChatGPT、Claude、Gemini、Grok、Google 重新加入 Panelize Enhanced，支持国内外 AI 同时对比。

### 9.2 现有基础设施

海外平台的底层代码**仍然完整存在**，只是在 providers.js 和 provider-defaults.js 中被移除注册。以下文件无需修改：

| 文件 | 状态 |
|------|------|
| `content-scripts/answer-extractor-chatgpt.js` | 完整 |
| `content-scripts/answer-extractor-claude.js` | 完整 |
| `content-scripts/answer-extractor-gemini.js` | 完整 |
| `content-scripts/answer-extractor-grok.js` | 完整 |
| `content-scripts/answer-extractor-google.js` | 完整 |
| `content-scripts/enter-behavior-chatgpt.js` | 完整 |
| `content-scripts/enter-behavior-claude.js` | 完整 |
| `content-scripts/enter-behavior-gemini.js` | 完整 |
| `content-scripts/enter-behavior-grok.js` | 完整 |
| `content-scripts/enter-behavior-google.js` | 完整 |
| `content-scripts/button-finder-utils.js` | 通用 |
| `content-scripts/focus-toggle.js` | 已含海外平台检测 |
| `content-scripts/text-injection-all-providers.js` | 已含所有平台逻辑 |
| `modules/google-mode.js` | 完整 |
| `icons/providers/{chatgpt,claude,gemini,grok,google}.png` | 存在 |
| `icons/providers/dark/{chatgpt,claude,gemini,grok,google}.png` | 存在 |

### 9.3 需修改的文件

#### 9.3.1 `modules/providers.js` — 新增 5 个 provider 条目

```js
{ id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com',
  icon: '/icons/providers/chatgpt.png', iconDark: '/icons/providers/dark/chatgpt.png', enabled: true },
{ id: 'claude', name: 'Claude', url: 'https://claude.ai',
  icon: '/icons/providers/claude.png', iconDark: '/icons/providers/dark/claude.png', enabled: true },
{ id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/',
  icon: '/icons/providers/gemini.png', iconDark: '/icons/providers/dark/gemini.png', enabled: true },
{ id: 'grok', name: 'Grok', url: 'https://grok.com/',
  icon: '/icons/providers/grok.png', iconDark: '/icons/providers/dark/grok.png', enabled: true },
{ id: 'google', name: 'Google', url: 'https://www.google.com/search?udm=50',
  icon: '/icons/providers/google.png', iconDark: '/icons/providers/dark/google.png', enabled: true }
```

#### 9.3.2 `modules/provider-defaults.js` — 更新默认列表

```js
export const DEFAULT_PROVIDER_IDS = [
  'chatgpt', 'claude', 'gemini', 'grok',  // 海外
  'deepseek', 'kimi', 'doubao', 'qianwen', 'zhipu', 'wenxin',  // 国内
  'google', 'metaso'
];
```

已有用户的迁移逻辑：`migrateEnabledProvidersOnUpdate` 会检测默认列表变化，自动为未自定义过的用户添加新平台。

#### 9.3.3 `manifest.json` — 新增 host_permissions + content_scripts

host_permissions 新增：
```json
"*://chatgpt.com/*", "*://claude.ai/*",
"*://gemini.google.com/*", "*://grok.com/*", "*://www.google.com/*"
```

content_scripts 新增 5 个条目，每个加载对应平台的 enter-behavior、answer-extractor、text-injection-all-providers、focus-toggle。`run_at: "document_end"`，`all_frames: true`。

#### 9.3.4 `rules/bypass-headers.json` — 新增 iframe 绕过规则

为 5 个海外平台各添加 `X-Frame-Options` 和 `Content-Security-Policy` 移除规则（ID 9-13）。

#### 9.3.5 `multi-panel/multi-panel.js` — 更新 MERGE_TARGET_URLS

```js
chatgpt: 'https://chatgpt.com/',
claude: 'https://claude.ai/new',
gemini: 'https://gemini.google.com/',
grok: 'https://grok.com/',
google: 'https://www.google.com/search?udm=50'
```

### 9.4 已知风险

| 风险 | 说明 |
|------|------|
| iframe 加载失败 | ChatGPT、Gemini 有较强反嵌套保护，可能需要额外绕过规则 |
| 深色模式 | 需确认 content_scripts 注入到海外平台 iframe 后深色模式正常工作 |

### 9.5 实现顺序

**第一优先级：ChatGPT + Gemini**（有账号可测试）

1. providers.js + provider-defaults.js（先加 chatgpt 和 gemini）
2. manifest.json（host_permissions + content_scripts）
3. bypass-headers.json
4. multi-panel.js（MERGE_TARGET_URLS）
5. 测试 iframe 加载 → 文本注入 → Send All → 答案提取
6. 测试深色模式
7. 测试融合功能

**第二优先级：Claude + Grok + Google**（需账号后验证）

8. 添加剩余 3 个平台
9. 逐平台测试

---

## 十、浏览器商店上架准备

### 10.1 目标商店

| 商店 | 注册费 | 审核周期 | 实名认证 |
|------|--------|---------|---------|
| Chrome Web Store | $5（一次性） | 1-7 工作日 | 不需要（仅付费） |
| Microsoft Edge Add-ons | $19（一次性） | 1-7 工作日 | 不需要（仅付费） |
| QQ 浏览器扩展商店 | 免费 | 1-7 工作日 | 需要（身份证/营业执照） |
| 360 浏览器扩展商店 | 免费 | 1-7 工作日 | 需要（身份证/营业执照） |
| GitHub Releases | 免费 | 无需审核 | 不需要 |

### 10.2 各商店上架要求

#### Chrome Web Store
- 开发者注册：$5 一次性费用
- 必需素材：128x128 图标、1280x800 截图（至少 1 张）、440x280 小磁贴、1400x560 大磁贴
- 描述：标题最多 45 字符，短描述最多 132 字符，详细描述最多 16000 字符
- 隐私政策：必须提供（如果收集用户数据）
- MV3 必须：Manifest V2 已于 2024 年弃用
- 敏感权限（tabs、host_permissions 等）需额外审查

#### Microsoft Edge Add-ons
- 开发者注册：$19 一次性费用
- 兼容性：同一份 manifest.json 可直接使用，无需修改
- 必需素材：300x300 商店图标、1280x800 截图、1400x560 推广图
- 审核：1-7 工作日，与 Chrome 类似但有微软特定策略

#### QQ 浏览器扩展商店
- 开发者注册：免费，需要实名认证（个人身份证或企业营业执照）
- MV3 支持：QQ 浏览器 14+（Chromium 108+）支持 MV3
- 商店描述需中文
- 需遵守中国网络安全法和个人信息保护法

#### 360 浏览器扩展商店
- 开发者注册：免费，需要实名认证
- MV3 支持：360 安全浏览器 15+ 支持 MV3
- 商店描述需中文
- 360 自有安全引擎会扫描扩展

#### GitHub Releases
- 打包为 .zip，附在 Release 中
- 用户手动下载 → chrome://extensions → 开发者模式 → 加载已解压的扩展程序
- 无自动更新机制

### 10.3 隐私政策

所有商店（除 GitHub）都要求隐私政策。需公开托管（如 GitHub Pages），内容包括：
- 收集什么数据
- 如何使用数据
- 是否与第三方共享
- 联系方式

项目已有 `PRIVACY.md` 文件，可部署为 GitHub Pages。

---

## 十一、品牌资产清单

### 11.1 已有资产

| 资产 | 位置 | 用途 |
|------|------|------|
| icon-16/32/48/128.png | `icons/` | 扩展图标（manifest 声明） |
| icon.svg | `assets/` | 128x128 源 SVG（深色背景 + 几何 "P" 图案） |
| panelize-marquee.png | `assets/screenshots/` | README 头图（700px 宽） |
| main-panel.png | `assets/screenshots/` | 主界面截图 |
| select-layout.png | `assets/screenshots/` | 布局选择器截图 |
| settings.png | `assets/screenshots/` | 设置页面截图 |
| 14 个平台图标（亮色+暗色） | `icons/providers/` | 平台选择器显示 |

### 11.2 缺失资产

| 资产 | 所需尺寸 | 用途 |
|------|---------|------|
| 256x256 图标 | 256x256 PNG | Firefox/Edge 商店 |
| 512x512 图标 | 512x512 PNG | Firefox 商店、高分屏 |
| 96x96 图标 | 96x96 PNG | Firefox 商店标准尺寸 |
| Chrome 小磁贴 | 440x280 PNG | Chrome Web Store 推广 |
| Chrome 大磁贴 | 1400x560 PNG | Chrome Web Store 推广 |
| Edge 商店图标 | 300x300 PNG | Edge Add-ons 商店 |
| Edge 推广图 | 1400x560 PNG | Edge Add-ons 推广 |
| Firefox 预览图 | 1200x900 PNG | Firefox Add-ons 预览 |
| 商店截图 | 1280x800 PNG（各商店） | 商店列表展示 |

### 11.3 待办

1. 从 `assets/icon.svg` 导出 16/32/48/96/128/256/512 全尺寸 PNG
2. 制作 440x280 小磁贴和 1400x560 大磁贴
3. 制作 300x300 Edge 商店图标
4. 验证现有截图尺寸是否符合 1280x800 要求
5. 准备中文版商店描述

---

## 十二、ChatGPT 和 Gemini 详细接入方案

### 12.1 ChatGPT 接入

#### DOM 结构与选择器

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 输入框 | `#prompt-textarea`（ProseMirror contenteditable） | 主输入区域，需要特殊注入策略 |
| 发送按钮 | `button[data-testid="send-button"]` | 主发送按钮 |
| 停止按钮 | `button[data-testid="stop-button"]` | AI 生成中显示，用于完成检测 |
| 文件上传 | `input[type="file"][data-testid="file-upload-input"]` | 图片上传 |
| 临时对话 | `button[aria-label="Turn on temporary chat"]` | 临时对话开关 |

#### 文本注入策略

ChatGPT 使用 ProseMirror 编辑器，标准 `execCommand` 无效。已有注入策略（`text-injection-all-providers.js`）：

1. **nativeSetter + InputEvent** — 通过 `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set` 设置值，触发 `InputEvent`
2. **ProseMirror 专用** — 使用 `ClipboardEvent('paste')` + `DataTransfer` 注入
3. **contenteditable 多策略** — 7 种策略逐步尝试（beforeinput、execCommand、insertFromPaste、ClipboardEvent、composition events、逐字符、textContent）
4. **发送延迟** — 注入后等待 500ms 再点击发送按钮

#### Enter 键行为

`enter-behavior-chatgpt.js` 实现了 Enter/Shift+Enter 行为交换：
- ProseMirror 输入框：检测 `#prompt-textarea` + `contentEditable="true"` + `ProseMirror` class
- 发送按钮查找：优先 `data-testid="send-button"`，fallback 到 aria-label/textContent
- IME 兼容：检测 `event.isComposing` 避免干扰中文输入

#### 完成检测

- **按钮状态监控**：检测 `button[data-testid="stop-button"]` 出现/消失
- **ChatGPT 专用追踪**：`chatgptSendTracking` 对象 + `MutationObserver` 监控 composer root
- **空闲判定**：停止按钮消失后 800ms 确认空闲，2000ms 无忙碌按钮判定完成

#### 答案提取

```js
// answer-extractor-chatgpt.js
window.__panelize_extractors.chatgpt = function(utils) {
  return utils.extractGenericMarkdownAnswer(); // 通用 markdown 提取
};
```

ChatGPT 使用 `.markdown-body` 容器，通用提取器即可覆盖。

#### 已知风险

| 风险 | 说明 |
|------|------|
| iframe 嵌套 | ChatGPT 有较强的 CSP 保护，`X-Frame-Options` 和 `Content-Security-Policy` 移除可能不够 |
| ProseMirror 注入 | 如果 ChatGPT 更新编辑器版本，注入策略可能失效 |
| 登录态 | iframe 中需要继承用户登录态，`sandbox="allow-same-origin"` 必须保留 |

### 12.2 Gemini 接入

#### DOM 结构与选择器

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 输入框 | Quill 编辑器（`.ql-editor` contenteditable div） | 主输入区域 |
| 发送按钮 | `button[aria-label*="Send"]` 或 `button.send-button` | 通过 aria-label 或 class 查找 |
| 编辑按钮 | `button` 文本为 "Update" 或 class 为 `update-button` | 编辑旧消息时的更新按钮 |
| 文件上传 | `input[type="file"]` | 文件上传 |

#### 文本注入策略

Gemini 使用 **Quill 编辑器**（contenteditable div），注入策略：

1. **nativeSetter** — 对 textarea 类型的编辑框使用 value setter
2. **Quill contenteditable** — 检测 `.ql-editor` 或 `role="textbox"` 的 div
3. **contenteditable 多策略** — 与 ChatGPT 共用 7 种策略（beforeinput、execCommand、insertFromPaste 等）
4. **insertLineBreak** — Quill 编辑器使用 `document.execCommand('insertLineBreak')` 插入换行

#### Enter 键行为

`enter-behavior-gemini.js` 的特殊处理：
- **Quill 编辑器检测**：`tagName === "DIV"` + `contentEditable === "true"` + (`ql-editor` class 或 `role="textbox"`)
- **换行插入**：Quill 使用 `execCommand('insertLineBreak')`，需要在末尾额外插入一个 `<br>` 元素
- **发送按钮查找**：优先 `aria-label*="Send"`，fallback 到 `button.send-button`，再 fallback 到 `mat-icon[fonticon="send"]`
- **编辑模式**：从 textarea 向上遍历 5 层查找 "Update" 按钮
- **默认行为保留**：preset 为 `default` 时不拦截 Enter（Gemini 原生 Enter=发送）

#### 完成检测

与 ChatGPT 类似，使用按钮状态监控：
- 检测停止按钮出现/消失
- MutationObserver 兜底

#### 答案提取

```js
// answer-extractor-gemini.js
window.__panelize_extractors.gemini = function(utils) {
  return utils.extractGenericMarkdownAnswer(); // 通用 markdown 提取
};
```

Gemini 使用 `.markdown-body` 容器，通用提取器即可。

#### 已知风险

| 风险 | 说明 |
|------|------|
| iframe 嵌套 | Google 有较强的反嵌套保护，可能需要额外的 bypass 规则 |
| Quill 编辑器 | 如果 Gemini 升级 Quill 版本，注入策略可能需要调整 |
| Google 账号 | 需要 Google 账号登录，iframe 中的登录态继承是关键 |

### 12.3 ChatGPT vs Gemini 注入对比

| 方面 | ChatGPT | Gemini |
|------|---------|--------|
| 输入框类型 | ProseMirror (contenteditable) | Quill (contenteditable div) |
| 注入难度 | 高（7 种策略兜底） | 中（Quill 有 execCommand 支持） |
| 发送按钮 | `data-testid="send-button"` | `aria-label*="Send"` 或 `button.send-button` |
| Enter 键处理 | ProseMirror 特殊处理 | Quill `insertLineBreak` + `<br>` 补充 |
| 答案容器 | `.markdown-body` | `.markdown-body` |
| 临时对话 | "Turn on temporary chat" | 无（Google 不支持临时对话） |
| 文件上传 | `data-testid="file-upload-input"` | `input[type="file"]` |
| 编辑消息 | ProseMirror 原生支持 | 需查找 "Update" 按钮 |

### 12.4 实现步骤（优先级排序）

1. **providers.js** — 添加 chatgpt 和 gemini 条目
2. **manifest.json** — 添加 host_permissions 和 content_scripts
3. **bypass-headers.json** — 添加 iframe 绕过规则
4. **测试 iframe 加载** — 这是最关键的一步，如果 iframe 加载失败其他都白费
5. **测试文本注入** — 验证 ProseMirror（ChatGPT）和 Quill（Gemini）注入
6. **测试 Send All** — 验证发送按钮点击和 Enter 键兜底
7. **测试答案提取** — 验证通用 markdown 提取器在两个平台上的效果
8. **测试深色模式** — 验证 CSS filter 在两个平台 iframe 中的效果
9. **测试融合功能** — 选择 ChatGPT 或 Gemini 作为融合目标

---

## 十三、开源协议与署名

### 13.1 当前协议

项目使用 **MIT 协议**，原始版权归属：
- Copyright (c) 2025 Xiaolai
- Copyright (c) 2025-2026 Wenhao

### 13.2 MIT 协议要求

MIT 协议要求很简单：
1. **保留原始版权声明** — LICENSE 文件不能删除或修改已有版权行
2. **保留 MIT 协议文本** — LICENSE 文件本身要保留
3. **可以添加新版权声明** — 在 LICENSE 中追加即可

**不需要**：
- 列出修改了什么
- 公开修改内容
- 说明改了多少

### 13.3 建议操作

在 LICENSE 文件末尾追加：

```
Copyright (c) 2026 你的名字
```

这样就完全合规。修改范围大小不影响协议要求——MIT 就是这么宽松。

### 13.4 README 署名建议

虽然法律上不要求，但作为开源社区的良好实践，建议在 README 中注明：

```markdown
## 致谢

本项目基于 [Panelize](https://github.com/Manho/Panelize) 开源项目修改而来。
原始项目作者：Xiaolai, Wenhao。
```

这是可选的，但有助于社区透明度。

---

## 十四、上线前待办清单

### 代码层面

- [ ] 海外平台重新接入（第九章）
- [ ] 文心一言/智谱选择器更新（第八章）
- [ ] 深色模式 iframe 验证（已实现，需测试）
- [ ] 融合功能端到端测试
- [ ] 版本号更新（1.1.1 → 1.2.0）
- [ ] CHANGELOG.md 更新

### 商店素材

- [ ] 从 SVG 导出全尺寸图标（16-512）
- [ ] 制作商店推广图（小磁贴、大磁贴）
- [ ] 验证/调整截图尺寸为 1280x800
- [ ] 准备中英文商店描述
- [ ] 部署隐私政策到 GitHub Pages

### 账号注册

- [ ] Chrome Web Store 开发者注册（$5）
- [ ] Microsoft Edge Add-ons 开发者注册（$19）
- [ ] QQ 浏览器扩展开放平台注册（实名认证）
- [ ] 360 浏览器扩展开放平台注册（实名认证）
- [ ] GitHub Release 创建

### 测试验证

- [ ] 各平台 iframe 加载测试
- [ ] 文本注入 + Send All 测试
- [ ] 答案提取测试
- [ ] 融合功能测试
- [ ] 深色模式测试
- [ ] 多语言测试
- [ ] 各浏览器兼容性测试（Chrome、Edge、QQ、360）

---

## 十五、GitHub 仓库发布准备

### 15.1 README.md 结构

```markdown
# Panelize Enhanced

> 同时对比多个 AI 的回答，一键融合最佳答案

## 功能特性
- 支持 9 个 AI 平台（DeepSeek、Kimi、豆包、千问、智谱、文心、秘塔、ChatGPT、Gemini）
- 多面板并排对比
- 智能融合：AI 裁判自动评估多个回答
- 深色模式 / 10 种语言
- 支持 Chrome、Edge、QQ 浏览器、360 浏览器

## 安装方式
### Chrome Web Store
[安装链接]

### 手动安装
1. 下载最新 Release
2. 解压
3. chrome://extensions → 开发者模式 → 加载已解压的扩展程序

## 使用方法
[配 GIF 动图或截图]

## 截图
[主界面截图、设置截图、融合结果截图]

## 技术架构
[架构图]

## 开发
npm install → npm run build → 加载扩展

## 致谢
基于 [Panelize Enhanced](https://github.com/xiancolin0608/Panelize-Enhanced) by Xiaolai & Wenhao

## License
MIT
```

### 15.2 必备素材

| 素材 | 用途 | 建议 |
|------|------|------|
| Demo GIF | README 展示 | 用 ScreenToGif 录一段 30 秒操作流程 |
| 架构图 | README + 面试 | draw.io 画，展示扩展 → iframe → AI 平台的架构 |
| 截图 | README + 商店 | 至少 3 张：主界面、设置、融合结果 |
| Logo | 仓库头图 | 从 SVG 导出 PNG |

### 15.3 GitHub Release 注意事项

- 版本号语义化：v1.2.0（新功能），v1.2.1（修复）
- Release Notes 写清楚改了什么
- 附上 .zip 包（用户可直接下载安装）
- 打 Tag：`git tag v1.2.0 && git push origin v1.2.0`

### 15.4 隐私政策部署

```bash
# 在 GitHub 仓库中
# 1. 把 PRIVACY.md 放到 gh-pages 分支
# 2. 或者直接用 GitHub Pages 托管
# 访问地址：https://username.github.io/panelize-enhanced/privacy.html
```

所有商店上架都需要隐私政策 URL，必须公开可访问。

### 15.5 开源协议注意事项

- 保留原项目 MIT License 和原始版权（Xiaolai, Wenhao）
- 在 LICENSE 文件中添加自己的版权行
- README 中注明基于哪个项目 fork
- 不需要列出所有修改项

---

## 十六、ChatGPT + Gemini 接入代码块

以下是接入 ChatGPT 和 Gemini 需要修改的 5 个文件的具体代码。直接复制粘贴即可。

### 15.1 `modules/providers.js` — 添加 provider 条目

在 metaso 条目后面、`];` 前面添加：

```javascript
// 在 metaso 条目后添加：
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    icon: '/icons/providers/chatgpt.png',
    iconDark: '/icons/providers/dark/chatgpt.png',
    enabled: true
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    icon: '/icons/providers/gemini.png',
    iconDark: '/icons/providers/dark/gemini.png',
    enabled: true
  }
];
```

### 15.2 `modules/provider-defaults.js` — 更新默认列表

```javascript
export const DEFAULT_PROVIDER_IDS = [
  'deepseek',
  'kimi',
  'doubao',
  'qianwen',
  'zhipu',
  'wenxin',
  // 'yuanbao',
  'metaso',
  'chatgpt',
  'gemini',
];
```

### 15.3 `manifest.json` — host_permissions + content_scripts

**host_permissions 新增：**
```json
"*://chatgpt.com/*",
"*://gemini.google.com/*",
```

**content_scripts 新增两个条目（在 doubao 条目后面添加）：**
```json
{
  "matches": ["https://chatgpt.com/*"],
  "js": [
    "content-scripts/button-finder-utils.js",
    "content-scripts/enter-behavior-utils.js",
    "content-scripts/enter-behavior-chatgpt.js",
    "content-scripts/answer-extractor-chatgpt.js",
    "content-scripts/text-injection-all-providers.js",
    "content-scripts/focus-toggle.js"
  ],
  "run_at": "document_start",
  "all_frames": true
},
{
  "matches": ["https://gemini.google.com/*"],
  "js": [
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

### 15.4 `rules/bypass-headers.json` — iframe 绕过规则

在 kimi 规则（ID 8）后面添加：
```json
{
  "id": 9,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "responseHeaders": [
      { "header": "X-Frame-Options", "operation": "remove" },
      { "header": "Content-Security-Policy", "operation": "remove" }
    ]
  },
  "condition": {
    "urlFilter": "https://chatgpt.com/*",
    "resourceTypes": ["sub_frame"]
  }
},
{
  "id": 10,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "responseHeaders": [
      { "header": "X-Frame-Options", "operation": "remove" },
      { "header": "Content-Security-Policy", "operation": "remove" }
    ]
  },
  "condition": {
    "urlFilter": "https://gemini.google.com/*",
    "resourceTypes": ["sub_frame"]
  }
}
```

### 15.5 `multi-panel/multi-panel.js` — MERGE_TARGET_URLS

```javascript
const MERGE_TARGET_URLS = {
  deepseek: 'https://chat.deepseek.com/',
  kimi: 'https://kimi.com/',
  qianwen: 'https://www.qianwen.com/',
  zhipu: 'https://chatglm.cn/',
  wenxin: 'https://yiyan.baidu.com/',
  doubao: 'https://www.doubao.com/chat/',
  metaso: 'https://metaso.cn/',
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/'
};
```

### 15.6 改动总结

| 文件 | 改动 |
|------|------|
| `modules/providers.js` | 新增 chatgpt、gemini 两个 provider 条目 |
| `modules/provider-defaults.js` | 默认列表追加 chatgpt、gemini |
| `manifest.json` | host_permissions +2，content_scripts +2 |
| `rules/bypass-headers.json` | iframe 绕过规则 +2（ID 9-10） |
| `multi-panel/multi-panel.js` | MERGE_TARGET_URLS +2 |

图标文件（`icons/providers/chatgpt.png` 等）和内容脚本（`enter-behavior-chatgpt.js` 等）**已存在**，无需新增。

---

## 十七、完整待办清单（42 项）

### A. 代码变更

- [ ] ChatGPT + Gemini provider 注册（第十五章代码块）
- [ ] Claude + Grok + Google provider 注册（第二优先级）
- [ ] 元宝 (yuanbao) 重新启用（当前全部注释）
- [ ] 文心一言/智谱 CSS 选择器更新（需真实页面诊断）
- [ ] 检查 manifest.json 是否缺少 `tabs` 权限

### B. 版本与发布

- [ ] manifest.json 版本号 1.1.1 → 1.2.0
- [ ] CHANGELOG.md 修正版本号（当前有 2.0.0 应改为 1.2.0）
- [ ] CHANGELOG.md 补充海外平台、深色模式、融合 toast 等变更记录

### C. 协议与署名

- [ ] LICENSE 文件追加 `Copyright (c) 2026 <你的名字>`
- [ ] README.md 添加致谢（原始 Panelize 项目 by Xiaolai, Wenhao）
- [ ] README.zh-CN.md 添加同等致谢

### D. 品牌素材

- [ ] 从 icon.svg 导出全尺寸 PNG（16/32/48/96/128/256/512）
- [ ] 制作 Chrome 小磁贴 440x280
- [ ] 制作 Chrome 大磁贴 1400x560
- [ ] 制作 Edge 商店图标 300x300
- [ ] 制作 Edge 推广图 1400x560
- [ ] 验证现有截图是否为 1280x800
- [ ] 准备中文商店描述
- [ ] 准备英文商店描述
- [ ] 用猫照片替换 icon.svg 作为新 logo

### E. 隐私政策

- [ ] 部署 PRIVACY.md 到 GitHub Pages
- [ ] 更新 PRIVACY.md 中的平台列表（补充国内平台）
- [ ] 更新 PRIVACY.md 的 "Last Updated" 日期

### F. 商店注册

- [ ] Chrome Web Store 注册（$5）
- [ ] Edge Add-ons 注册（$19）
- [ ] QQ 浏览器注册（免费 + 实名）
- [ ] 360 浏览器注册（免费 + 实名）
- [ ] GitHub Release 创建

### G. 测试

**单元测试（已有）：**
- merge-feature.test.js ✓
- providers.test.js ✓
- provider-defaults.test.js ✓
- chatgpt-content-script.test.js ✓
- doubao-content-script.test.js ✓
- google-content-script.test.js ✓
- text-injector.test.js ✓
- messaging.test.js ✓
- html-utils.test.js ✓
- settings.test.js ✓
- service-worker.test.js ✓

**单元测试（缺失）：**
- [ ] DeepSeek content script 测试
- [ ] Kimi content script 测试
- [ ] 千问 content script 测试
- [ ] 智谱 content script 测试
- [ ] 文心 content script 测试
- [ ] 秘塔 content script 测试
- [ ] 深色模式 CSS 注入测试
- [ ] 答案提取器测试（按平台）
- [ ] 多语言/i18n 测试
- [ ] manifest 校验测试（所有平台）

**手动/E2E 测试：**
- [ ] 各平台 iframe 加载
- [ ] 文本注入 + Send All
- [ ] 答案提取
- [ ] 融合功能端到端
- [ ] 深色模式 iframe 渲染
- [ ] 多语言切换
- [ ] 跨浏览器兼容（Chrome、Edge、QQ、360）

---

## 十八、MCP 集成（后续规划，暂缓）

> **优先级：先上线，后迭代。** 此功能在 v1.2.0 上线后再做。

### 18.1 目标

将 Panelize 从「浏览器扩展」升级为「AI 编排工具」。用户在 Claude Code / Cursor 等 AI IDE 中直接调用 Panelize 的多模型能力，无需手动操作浏览器。

### 18.2 架构

```
Claude Code (MCP Client)
    ↓ 调用 MCP Tool
Panelize MCP Server (本地 Node.js 进程)
    ↓ Chrome Extension Messaging
Panelize Chrome Extension (注入到 AI 页面)
    ↓ iframe PostMessage
各 AI 面板 (ChatGPT, Gemini, DeepSeek...)
    ↓ 自动提取回答
Panelize MCP Server → 返回给 Claude Code
```

### 18.3 实现方案

**Step 1：扩展暴露 API**

在 `multi-panel.js` 中注入 `window.panelizeAPI`：

```javascript
window.panelizeAPI = {
  // 批量发送问题到所有面板
  async sendBatch(question) { ... },
  // 获取所有面板的回答
  async getAnswers() { ... },
  // 获取指定面板的回答
  async getAnswer(providerId) { ... },
  // 获取面板状态
  getStatus() { ... },
  // 触发融合
  async merge() { ... }
};
```

**Step 2：MCP Server**

创建 `mcp-server/` 目录，使用 `@modelcontextprotocol/sdk`：

```javascript
// mcp-server/index.js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'panelize', version: '1.0.0' });

// Tool: 批量提问
server.tool('panelize_ask', 'Send a question to multiple AI models', {
  question: z.string()
}, async ({ question }) => {
  // 通过 Chrome Extension Messaging 发送到扩展
  const answers = await sendToExtension('sendBatch', { question });
  return { content: [{ type: 'text', text: JSON.stringify(answers) }] };
});

// Tool: 获取回答
server.tool('panelize_get_answers', 'Get all AI answers', {}, async () => {
  const answers = await sendToExtension('getAnswers', {});
  return { content: [{ type: 'text', text: JSON.stringify(answers) }] };
});
```

**Step 3：Chrome Extension Messaging 桥接**

MCP Server 通过 WebSocket 或 Native Messaging 与扩展通信：

```javascript
// MCP Server 端
const ws = new WebSocket('ws://localhost:1982');
ws.send(JSON.stringify({ method: 'sendBatch', params: { question } }));

// 扩展 Service Worker 端
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'MCP_REQUEST') {
    // 转发到 content script
    chrome.tabs.sendMessage(tabId, msg.payload, sendResponse);
  }
});
```

### 18.4 MCP Tools 列表

| Tool | 参数 | 说明 |
|------|------|------|
| `panelize_ask` | question: string | 批量发送问题到所有 AI |
| `panelize_ask_to` | question, providers[] | 发送到指定 AI 子集 |
| `panelize_get_answers` | — | 获取所有面板最新回答 |
| `panelize_get_answer` | providerId | 获取指定面板回答 |
| `panelize_merge` | — | 触发融合并返回结果 |
| `panelize_status` | — | 获取所有面板状态 |

### 18.5 用户体验

```
# 在 Claude Code 中
> 帮我对比一下 React 和 Vue 的优劣

Claude Code 自动调用 panelize_ask →
  扩展发送到 ChatGPT + Gemini + DeepSeek + Kimi...
  等待所有回答完成
  自动提取 + 融合
  返回综合结果给 Claude Code

# 用户看到的是 Claude Code 直接给出综合了多个 AI 的回答
```

---

## 十九、Obsidian 导出（后续规划，暂缓）

> **优先级：先上线，后迭代。** 此功能在 v1.2.0 上线后再做。

### 19.1 目标

融合完成后，自动将问答记录写入 Obsidian 知识库，形成可搜索、可链接的知识卡片。

### 19.2 用户体验

```
Panelize 融合完成
  ↓ 自动调用 Obsidian API
Obsidian vault/Panelize/2026-06-15-React和Vue哪个好.md
  ↓ 打开 Obsidian 即可看到
带 frontmatter、标签、分类的完整笔记
```

### 19.3 方案对比

| 方案 | 自动化 | 浏览器兼容 | 依赖 | 推荐度 |
|------|--------|-----------|------|--------|
| Local REST API 插件 | 全自动 | Chrome/Edge/Firefox/Safari | Obsidian + 插件 | ★★★★★ |
| File System Access API | 全自动 | 仅 Chrome/Edge | 无 | ★★★★ |
| 手动导出 .md | 手动 | 全平台 | 无 | ★★★ |
| Obsidian URI Scheme | 半自动 | 全平台 | Obsidian 必须打开 | ★★ |

### 19.4 推荐方案：三重降级策略

融合完成后自动导出，按优先级依次尝试：

**方案 A：Obsidian Local REST API（全自动，需 Obsidian 打开）**

用户在 Obsidian 安装 `Local REST API` 社区插件（30万+ 下载），在 Panelize 设置里填入 API 地址（默认 `http://localhost:27123`）。

```javascript
async function exportViaRestApi(path, content) {
  const settings = await chrome.storage.sync.get(['obsidianApiUrl', 'obsidianApiKey']);
  const url = settings.obsidianApiUrl || 'http://localhost:27123';

  const resp = await fetch(`${url}/vault/${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/markdown',
      'Authorization': `Bearer ${settings.obsidianApiKey}`
    },
    body: content
  });
  return resp.ok;
}
```

优点：全平台兼容，支持 CRUD
缺点：Obsidian 必须打开（最小化到托盘即可）

**方案 B：File System Access API（全自动，无需 Obsidian 打开）**

用户首次使用时授权 Obsidian Vault 目录，之后直接写文件。Obsidian 打开后自动检测新文件并加载。

```javascript
async function exportViaFileSystem(path, content) {
  // 首次使用时获取目录句柄并存到 IndexedDB
  const rootHandle = await getStoredRootHandle(); // 从 IndexedDB 读取
  if (!rootHandle) return false;

  // 确保 Panelize 子目录存在
  const dirHandle = await rootHandle.getDirectoryHandle('Panelize', { create: true });

  // 写入文件
  const fileHandle = await dirHandle.getFileHandle(path, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
}
```

优点：不依赖 Obsidian 打开，直接写文件
缺点：仅 Chrome/Edge 支持，需用户授权一次目录

**方案 C：手动导出（兜底）**

面板右键菜单加「导出为 Markdown」，下载 .md 文件，用户手动拖入 Obsidian。

**主函数：自动降级**

```javascript
async function exportToObsidian(question, answers, mergedResult) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = question.slice(0, 50).replace(/[\/\\:*?"<>|]/g, '_');
  const path = `${date}-${safeName}.md`;
  const content = generateMarkdown(question, answers, mergedResult);

  // 方案 A：Local REST API
  if (await exportViaRestApi(`Panelize/${path}`, content)) return;

  // 方案 B：File System Access API
  if (await exportViaFileSystem(path, content)) return;

  // 方案 C：手动导出（下载文件）
  downloadFile(path, content);
}
```

调用时机：`triggerMerge()` 完成后自动调用。

### 19.5 Markdown 模板

```markdown
---
date: 2026-06-15
tags: [panelize, ai-comparison]
models: [ChatGPT, Gemini, DeepSeek]
---

# React和Vue哪个好

## ChatGPT
（回答内容）

## Gemini
（回答内容）

## 融合结论
（综合回答）

---
*导出自 Panelize Enhanced*
```

### 19.6 浏览器兼容性

| 浏览器 | Local REST API | File System Access API |
|--------|---------------|----------------------|
| Chrome | 支持 | 支持 |
| Edge | 支持 | 支持 |
| Firefox | 支持 | 不支持 |
| Safari | 支持 | 不支持 |

Local REST API 全平台兼容，是最佳选择。

---

## 二十、MCP vs Obsidian：深度对比分析（暂缓）

> **策略：先上线 v1.2.0，再做 MCP 和 Obsidian 集成。** 以下分析保留供后续参考。

### 20.1 背景

Panelize 完成多 AI 回答收集后，有两个后续方向值得探讨：
- **方向 A**：通过 MCP 连接 Claude Code，让 AI IDE 直接调用 Panelize 的多模型能力
- **方向 B**：自动将问答记录导出到 Obsidian 知识库

两者并不互斥，但开发资源有限，需要评估优先级。

### 20.2 FlowChat 调研发现（重要）

**关键发现：FlowChat 并没有使用 MCP。**

FlowChat（github.com/gitTreeYoung/FlowChat）的实际架构：

```
Claude Code
  ↓ agent-browser --auto-connect eval（浏览器自动化）
FlowChat Chrome Extension（暴露 window.FlowChatAPI）
  ↓ iframe PostMessage
各 AI 面板
```

FlowChat 的做法：
1. 扩展在页面注入 `window.FlowChatAPI`，提供 `ask()`、`getResponses()` 等方法
2. Claude Code 通过 `agent-browser eval` 执行 JavaScript 调用这个 API
3. **没有 MCP Server**，没有 Node.js 中间层，纯浏览器自动化

这意味着：FlowChat 的方案依赖 `agent-browser` 工具（Claude Code 的浏览器自动化能力），而不是标准 MCP 协议。

### 20.3 方案 A：MCP 集成详解

#### 架构

```
Claude Code（MCP Client）
    ↓ stdio/SSE
Panelize MCP Server（本地 Node.js 进程）
    ↓ WebSocket / HTTP localhost
Panelize Chrome Extension（Service Worker）
    ↓ chrome.tabs.sendMessage
Content Script（multi-panel.js）
    ↓ iframe PostMessage
各 AI 面板
```

#### 实现方式

**方式 A1：标准 MCP Server（推荐）**

```javascript
// mcp-server/index.js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'panelize', version: '1.0.0' });

server.tool('panelize_ask', 'Send question to multiple AIs', {
  question: z.string()
}, async ({ question }) => {
  // 通过 WebSocket 发到扩展
  const answers = await sendToExtension('sendBatch', { question });
  return { content: [{ type: 'text', text: JSON.stringify(answers) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

用户使用：`npx panelize-mcp` 启动，然后在 Claude Code 的 MCP 配置里添加。

**方式 A2：FlowChat 式（浏览器自动化）**

```markdown
# ~/.claude/skills/panelize.md
---
name: panelize
description: Multi-AI comparison via Panelize extension
triggers: ["compare", "multi-ai"]
---

When the user asks to compare AI answers:
1. Use agent-browser to navigate to Panelize extension page
2. Execute: window.panelizeAPI.ask(question)
3. Wait for completion: window.panelizeAPI.waitForCompletion()
4. Get results: window.panelizeAPI.getAnswers()
```

#### 优缺点

| 维度 | 评估 |
|------|------|
| 用户体验 | ★★★ 需要安装 Node.js + 启动 MCP Server |
| 技术复杂度 | ★★★★ 需要维护 MCP Server + WebSocket 桥接 |
| 稳定性 | ★★★ MV3 Service Worker 会休眠，需重连逻辑 |
| 跨平台 | ★★★★ Node.js 跨平台 |
| 差异化价值 | ★★★★★ 「AI 管理 AI」概念，面试亮点 |
| 开发周期 | 约 3-5 天 |

#### 核心问题

1. **MV3 Service Worker 休眠**：Chrome 扩展的后台脚本最多运行 5 分钟就会被杀掉，WebSocket 连接会断开。需要在 MCP Server 端实现重连逻辑。
2. **用户安装门槛**：需要用户安装 Node.js，运行 `npx panelize-mcp`，配置 Claude Code 的 MCP 设置。对非技术用户不友好。
3. **安全审计**：Chrome Web Store 审核时，`externally_connectable` 权限可能会被质疑。

### 20.4 方案 B：Obsidian 自动导出详解

#### 架构

```
Panelize Chrome Extension
  ↓ 融合完成后
  ↓ 选择导出方式
  ├─ 方式 B1: Obsidian Local REST API（推荐）
  │   ↓ fetch('http://localhost:27123/vault/Panelize/xxx.md')
  │   ↓ POST 创建笔记
  │   Obsidian Vault 自动同步
  │
  ├─ 方式 B2: File System Access API（备选）
  │   ↓ await fileHandle.createWritable()
  │   ↓ 直接写入 .md 文件
  │   Obsidian 检测到文件变化自动加载
  │
  └─ 方式 B3: 手动导出（兜底）
      ↓ 下载 .md 文件
      用户拖入 Obsidian
```

#### 三种子方案对比

| 维度 | B1: Local REST API | B2: File System Access | B3: 手动导出 |
|------|-------------------|----------------------|-------------|
| 自动化程度 | 全自动 | 全自动 | 手动 |
| 用户配置 | 安装 Obsidian 插件 + 填 API 地址 | 点一次授权目录 | 零配置 |
| 浏览器兼容 | Chrome/Edge/Firefox/Safari | 仅 Chrome/Edge | 全平台 |
| 稳定性 | ★★★★★ | ★★★★（权限可能过期） | ★★★★★ |
| 安全性 | ★★★★★ | ★★★★ | ★★★★★ |
| 依赖 | Obsidian + 插件 | 无 | 无 |

#### 推荐方案：B1 + B3 组合

**主方案 B1：Obsidian Local REST API**

用户在 Obsidian 安装 `Local REST API` 插件（社区热门插件，30万+ 下载），然后在 Panelize 设置里填入 API 地址（默认 `http://localhost:27123`）。

融合完成后自动写入：

```javascript
async function exportToObsidian(question, answers, mergedResult) {
  const settings = await chrome.storage.sync.get(['obsidianApiUrl', 'obsidianApiKey']);
  const url = settings.obsidianApiUrl || 'http://localhost:27123';

  const date = new Date().toISOString().slice(0, 10);
  const safeName = question.slice(0, 50).replace(/[\/\\:*?"<>|]/g, '_');
  const path = `Panelize/${date}-${safeName}.md`;

  const content = `---
date: ${date}
tags: [panelize, ai-comparison]
models: [${answers.map(a => a.providerName).join(', ')}]
---

# ${question}

${answers.map(a => `## ${a.providerName}\n\n${a.answer}`).join('\n\n')}

## 融合结论

${mergedResult}

---
*导出自 Panelize Enhanced*`;

  await fetch(`${url}/vault/${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/markdown',
      'Authorization': `Bearer ${settings.obsidianApiKey}`
    },
    body: content
  });
}
```

**备选方案 B3：手动导出**

在面板右键菜单加「导出为 Markdown」，下载 .md 文件。适用于没装 Obsidian 插件的用户。

#### 优缺点

| 维度 | 评估 |
|------|------|
| 用户体验 | ★★★★★ 配置一次，永久自动 |
| 技术复杂度 | ★★ 简单的 HTTP 请求 |
| 稳定性 | ★★★★★ 无 WebSocket/Service Worker 问题 |
| 跨平台 | ★★★★★ 全平台 |
| 差异化价值 | ★★★ 实用功能，但不算创新 |
| 开发周期 | 约 1-2 天 |

### 20.5 综合对比

| 维度 | MCP 集成 | Obsidian 导出 | 胜出 |
|------|---------|-------------|------|
| 技术难度 | 高（WebSocket + MV3 限制） | 低（HTTP 请求） | Obsidian |
| 用户门槛 | 高（需装 Node.js） | 低（装个 Obsidian 插件） | Obsidian |
| 稳定性 | 中（Service Worker 休眠） | 高（无状态依赖） | Obsidian |
| 面试价值 | 极高（AI 编排概念） | 中等（实用功能） | MCP |
| 开发周期 | 3-5 天 | 1-2 天 | Obsidian |
| 创新性 | 高（国内首个） | 低（常规导出） | MCP |
| 用户需求强度 | 中（开发者才用） | 高（知识管理刚需） | Obsidian |

### 20.6 推荐策略

**分阶段实施：**

**阶段 1（当前）：Obsidian 导出**
- 开发周期短，用户需求明确
- 作为 Panelize 的差异化功能之一
- 面试时可以展示「产品思维」——不只是做技术，还考虑用户实际使用场景

**阶段 2（后续）：MCP 集成**
- 等扩展用户量起来后再做
- 作为「AI 编排」概念的落地
- 面试时重点讲架构设计——「通过 MCP 让 AI 助手调度多个 AI 平台」

**面试叙事线：**
> Panelize 不只是一个浏览器扩展，它是一个 **AI 能力编排平台**。短期通过 Obsidian 集成解决知识管理需求，中期通过 MCP 协议让 AI IDE 直接调用多模型能力，最终实现「AI 管理 AI」的愿景。这和豆包手机助手的理念一致——让 AI 成为用户的智能中枢。

### 20.7 两个方案可以同时存在

技术上完全不冲突：
- Obsidian 导出：扩展内部逻辑，独立运行
- MCP 集成：扩展 + 外部 MCP Server，独立运行
- 两者共享同一套数据源（`extractAllAnswers()`）

建议先做 Obsidian（1-2 天），再做 MCP（3-5 天），总开发周期约一周。
