# AI 提供商界面自动诊断与受控修复方案

> 状态：设计文档，尚未完整实现<br>
> 日期：2026-07-18<br>
> 适用项目：`D:\D\zcode\AIChatMerge-debug-log-test-refactor-fixed`<br>
> 目标：当文心一言、Kimi 等第三方聊天页面改版或通信异常时，程序能够先准确判断故障阶段，再生成可验证的修复建议；所有代码修改只允许在本地完成和提交，不推送网络。

## 一、结论

当前项目已经修复了一批文心发送相关的具体问题，也增加了精简诊断日志，但还没有实现“自动找到类似问题并自动修改代码”的完整流程。

后续不应直接开发一个“发现新输入框就修改选择器”的脚本。更可靠的方案分为两层：

1. **扩展运行时自动诊断**：确认内容脚本是否加载、消息能否往返、输入框是否找到、文本是否真正写入、按钮是否可用、点击后是否产生发送效果。
2. **本地受控修复工具**：只在故障被明确分类为选择器失效后，扫描候选元素、生成稳定选择器、创建最小 DOM fixture、运行构建和测试，并在人工确认后修改源码和创建本地提交。

日志用于提供证据和分类故障，本身不会修复问题。

## 二、当前问题是什么

### 2.1 用户看到的现象

- 文心一言的内容没有进入输入框。
- 发送失败后，内容可能留在输入框或发送流程卡住。
- 一个提供商失败后，后续发送也可能被等待、超时或状态未清理影响。
- 发送期间页面曾被刷新，进一步破坏输入状态。
- 页面实际 DOM 已变为：

```html
<div id="ci-area">
  <textarea id="chat-textarea" class="ci-textarea ci-scroll-style"></textarea>
</div>

<span class="ci-submit-button">
  <img id="ci-submit-button-ai" class="ci-submit-button-ai-active">
</span>
```

### 2.2 最新日志说明的问题

`aichatmerge-debug-2026-07-18T09-01-05-637Z.json` 中，文心出现的是：

```text
panel-injection:timeout
panel-injection:give-up
```

但没有出现文心对应的：

```text
matchedSelector
composer-verification-failed
submit-failed
```

这说明当时不能简单认定为“`#chat-textarea` 失效”。更靠前的内容脚本消息处理可能根本没有响应，所以输入框查找和写入代码可能尚未执行。

因此必须先区分两种完全不同的故障：

| 故障 | 表面现象 | 正确处理 |
|------|----------|----------|
| 消息链路失败 | 内容没有进入输入框，最终超时 | 检查内容脚本加载、iframe 来源、消息目标和版本 |
| DOM/选择器失败 | 消息已到达，但找不到输入框或按钮 | 扫描候选、更新 provider 选择器和测试 |

如果不先分类，自动工具很可能把通信故障误判为网页改版，并错误修改选择器。

### 2.3 当前已完成的修复

以下修改已经存在于本地提交中：

| 本地提交 | 作用 |
|----------|------|
| `0cff1f2` | 发送失败后恢复文心输入状态，避免一次失败永久阻塞后续发送 |
| `7b4d094` | 支持当前文心发送控件 |
| `3555d9e` | 同步文心健康检查选择器 |
| `6a2d7ba` | 修复健康检查批处理文件编码/路径问题 |
| `e042c5b` | 点击文心发送控件的外层容器 |
| `eb29b36` | 注入失败后不再自动刷新文心页面 |
| `ebd076c` | 优先使用当前输入框 `#chat-textarea` |
| `f8675d4` | 增加精简的输入失败诊断日志 |
| `ac27c77` | 接受可信扩展来源，修复特殊 iframe 环境下的消息来源识别 |

最后一项消息通信修复发生在上述最新日志产生之后。因此代码已针对该证据修改，但还需要重新加载未打包扩展并在真实文心页面验证，不能把它标记为已经通过真实环境验收。

### 2.4 当前还没有实现的能力

- 内容脚本启动时的 `READY` 握手。
- 每次发送前的 `PING/PONG` 链路检查。
- 面板与内容脚本的协议版本或 `buildId` 一致性检查。
- 对发送全过程统一分阶段并记录唯一失败阶段。
- 对输入框候选进行稳定性评分。
- 自动生成最小 DOM fixture。
- 自动生成源码补丁或修复计划。
- 人工批准后自动构建、测试和本地提交。

## 三、为什么现有日志和健康检查还不够

### 3.1 日志已经能做什么

当前精简日志可以在内容脚本确实执行后记录：

- 命中的选择器。
- 元素标签、ID、class、placeholder。
- 元素是否可见或禁用。
- 期望写入长度、写入前长度、写入后长度。
- 找不到输入框时的候选数量和少量安全候选摘要。
- 重试完成后的最终失败，而不是记录每一次重试。

这些信息适合 AI 阅读，也避免把用户完整提示词写入日志。

### 3.2 日志还不能解决什么

- 如果内容脚本没有加载，内容脚本内部不会产生诊断日志。
- 如果消息没有送达，无法知道是来源校验、目标窗口、页面重载还是旧 bundle 导致。
- 找到 DOM 元素不等于框架内部状态已更新。
- 点击按钮不等于网站接受了发送。
- 页面可能处于未登录、验证码、弹窗遮挡或限流状态。
- 日志不会自动修改源码、生成测试或证明修复正确。

### 3.3 现有 `selector-healthcheck.js` 的边界

现有脚本已经可以：

- 连接带 CDP 调试端口的真实 Chrome。
- 使用真实登录状态检查 provider 页面。
- 检测 input、sendButton、answer、newChat、extractor 等选择器。
- 保存基线、报告和 HTML 快照。
- 显示有限的候选 class。

但它主要回答“选择器是否命中”，还不能完整回答：

- 扩展内容脚本是否加载。
- 面板消息能否到达内容脚本。
- 输入事件是否被 React/Vue 等框架接受。
- 点击后是否真的开始发送。
- 应该修改哪个源文件、如何生成测试、修改是否安全。

## 四、目标诊断状态机

每次发送都应产生一个 `injectionRequestId`，并按同一状态机推进：

```text
FRAME_LOADED
  → CONTENT_SCRIPT_READY
  → TRANSPORT_REACHABLE
  → COMPOSER_FOUND
  → TEXT_WRITE_VERIFIED
  → SEND_CONTROL_READY
  → SEND_ACTION_TRIGGERED
  → SEND_EFFECT_VERIFIED
```

每个阶段只允许成功进入下一阶段，或者结束为一个明确的失败码：

| 阶段 | 建议失败码 | 含义 |
|------|------------|------|
| FRAME_LOADED | `frame-load-timeout` | iframe 本身没有完成加载 |
| CONTENT_SCRIPT_READY | `content-script-not-ready` | 页面存在，但 bundle 没有报告就绪 |
| TRANSPORT_REACHABLE | `transport-ping-timeout` | 内容脚本存在性未知或消息无法往返 |
| COMPOSER_FOUND | `composer-not-found` | 消息已到达，但没有匹配输入框 |
| TEXT_WRITE_VERIFIED | `composer-write-rejected` | 找到元素，但写入后内容为空或长度不符 |
| SEND_CONTROL_READY | `send-control-not-ready` | 按钮不存在、隐藏或禁用 |
| SEND_ACTION_TRIGGERED | `send-action-error` | 触发 click/keyboard 时发生异常 |
| SEND_EFFECT_VERIFIED | `send-effect-timeout` | 已点击，但输入框未清空且回答未开始 |

必须保证一次发送只产生一个最终失败分类，避免日志臃肿和多个模块对同一故障重复判断。

## 五、第一层：扩展运行时自动诊断

这是优先级最高的开发工作，因为它决定后续修复工具能否正确分类。

### 5.1 READY 握手

内容脚本初始化完成后，向所属面板发送：

```js
{
  type: 'CONTENT_SCRIPT_READY',
  context: 'multi-panel-transport',
  provider: 'wenxin',
  protocolVersion: 1,
  buildId: '1.0.1-protocol-1'
}
```

要求：

- 面板必须按 iframe 的真实 `event.source` 识别对应 panel。
- 仍然执行来源校验，不能接受普通网页或其他扩展伪造的 READY。
- 重复 READY 应幂等处理，因为页面路由或脚本初始化可能触发多次。
- 正常 READY 不进入短诊断报告；只记录缺失、版本不一致等异常。

### 5.2 PING/PONG

发送文本前，面板先发一个短超时 PING：

```js
{
  type: 'CONTENT_SCRIPT_PING',
  requestId,
  protocolVersion: 1,
  buildId: '1.0.1-protocol-1'
}
```

内容脚本返回：

```js
{
  type: 'CONTENT_SCRIPT_PONG',
  requestId,
  provider: 'wenxin',
  protocolVersion: 1,
  buildId: '1.0.1-protocol-1'
}
```

建议 PING 超时为 800～1500ms，明显短于正式注入超时。PING 失败时，不应继续等待输入框注入超时，而应直接报告 `transport-ping-timeout`。

### 5.3 buildId / 协议版本

仅使用 `manifest.json` 版本还不够，因为开发期间重新构建 bundle 时扩展版本可能没有变化。建议使用稳定、可复现的组合：

```text
manifestVersion + transportProtocolVersion
```

不要使用每次构建时的时间戳，否则生成文件每次都会无意义变化。

如果后续需要严格确认 bundle 是否最新，可以在构建脚本中计算源文件内容哈希，但应保证相同源码得到相同 buildId。

发现版本不一致时，应明确提示：

```text
扩展面板与内容脚本不是同一次构建，请重新执行 build:content 并重新加载扩展。
```

不要自动把它归类成选择器失效。

### 5.4 写入验证

找到输入框后，不以“执行了赋值语句”作为成功标准，而应验证：

- `textarea/input` 的 `value` 长度与期望一致。
- `contenteditable` 的 `innerText/textContent` 与期望一致。
- 已触发网站需要的 `input`、`change` 或 beforeinput 事件。
- 必要时等待一个微任务或短暂渲染周期后再次读取。

只记录长度、元素摘要和失败原因，不记录用户完整内容。

### 5.5 发送效果验证

点击成功不是最终成功。至少观察以下任意一种效果：

- 输入框内容被清空。
- 用户消息出现在对话区域。
- provider 进入 busy/生成状态。
- 停止按钮或生成指示器出现。

如果点击后在限定时间内没有任何效果，报告 `send-effect-timeout`。不要立即刷新页面，也不要让该 provider 的失败永久锁住其他 provider。

### 5.6 预计修改位置

优先在现有领域模块内完成，避免不必要的结构调整：

| 位置 | 职责 |
|------|------|
| `content-scripts/src/providers/messaging.js` | READY、PONG 和诊断消息的统一发送 |
| `content-scripts/src/text-injection-entry.js` | 处理 PING，并接入注入状态机 |
| `aichatmerge-panel/modules/panel-transport.js` | 识别 READY/PONG、按 panel 管理请求和超时 |
| `aichatmerge-panel/modules/send-pipeline.js` | 发送前链路检查、失败隔离和最终结果归类 |
| `tests/` | 消息握手、版本不匹配、超时和 provider 隔离测试 |

修改 `content-scripts/src/` 后必须执行 `npm run build:content`。

## 六、第二层：本地受控修复工具

不要新建一套与现有健康检查重复的独立系统。建议扩展：

```text
healthcheck/selector-healthcheck.js
```

新增模式可以设计为：

```powershell
node healthcheck\selector-healthcheck.js --provider wenxin --repair-plan
```

第一阶段只生成计划，不修改代码。

### 6.1 允许进入自动候选分析的前置条件

必须同时满足：

- 页面 URL 和 provider 匹配。
- 页面加载完成且不是错误页。
- 登录/验证码状态已经明确。
- 内容脚本 READY 正常。
- PING/PONG 正常。
- 已知输入框或发送按钮选择器确实失效。

任一条件不满足时，只输出诊断，不生成源码修改建议。

### 6.2 候选元素扫描

输入候选至少包括：

```css
textarea
input[type="text"]
[contenteditable="true"]
[role="textbox"]
```

发送候选至少包括：

```css
button
[role="button"]
input[type="submit"]
```

还要考虑：

- Shadow DOM。
- iframe 内嵌套页面。
- 外层容器拥有 click handler、内层图片只负责显示的情况。
- 同一页面存在搜索框、标题输入框、反馈框等干扰候选。

### 6.3 候选评分

建议评分因素：

| 因素 | 倾向 |
|------|------|
| 可见、尺寸合理、未禁用 | 加分 |
| 位于主要聊天区域或页面下部 | 加分 |
| `placeholder`/`aria-label` 包含提问、消息、发送语义 | 加分 |
| 与发送按钮空间距离近 | 加分 |
| 写入探针后能够读取回来 | 大幅加分 |
| 同一选择器只匹配一个元素 | 大幅加分 |
| ID 或稳定 `data-*` 属性 | 加分 |
| 哈希 class、构建编号、随机后缀 | 大幅减分 |
| 隐藏、零尺寸、位于模板或弹窗外 | 减分 |

候选评分只能生成建议，不能单独证明真实发送成功。

### 6.4 稳定选择器生成规则

优先级建议：

1. 唯一、语义明确且稳定的 ID，例如 `#chat-textarea`。
2. 稳定容器加语义元素，例如 `#ci-area textarea`。
3. 稳定 `data-*`、`aria-label` 或 `role` 组合。
4. 多个稳定 class 的最小组合。

默认拒绝：

- 带长哈希或时间戳的 class。
- `nth-child()` 形成的脆弱路径。
- 从 `html > body > ...` 开始的完整 DOM 路径。
- 同时匹配多个可见编辑器的选择器。

### 6.5 安全写入探针

候选验证可以写入一个短探针文本，但默认不得点击发送按钮，避免给真实网站或联系人发送测试内容。

探针流程：

1. 保存输入框原值。
2. 写入短标记并触发必要事件。
3. 读取并验证值。
4. 恢复原值并再次触发事件。
5. 确认页面没有产生发送行为。

真实发送效果验证应使用明确的 `--allow-test-send` 开关，并要求测试账号或人工确认。

### 6.6 repair plan 输出

建议输出 `healthcheck/data/repair-plan.json`：

```json
{
  "provider": "wenxin",
  "failureStage": "composer-selector",
  "oldSelectors": [".old-input"],
  "proposedSelector": "#chat-textarea",
  "confidence": 0.98,
  "unique": true,
  "visible": true,
  "writeVerified": true,
  "sendWasNotTriggered": true,
  "sourceFile": "content-scripts/src/providers/detection.js",
  "requiresHumanApproval": true
}
```

报告不得包含完整输入内容、Cookie、token 或大段页面 HTML。DOM 快照如果保留，必须本地存储并检查敏感信息。

## 七、最小 DOM fixture 与回归测试

### 7.1 fixture 的用途

fixture 保存与故障相关的最小结构，用来证明：

- 新选择器能找到正确输入框。
- 文本注入函数能写入并读回。
- 发送按钮状态可以识别。
- 应点击正确的外层/内层元素。
- 后续修改不会重新破坏该 provider。

### 7.2 fixture 不能证明什么

- 真实网站框架状态一定更新。
- 登录态、验证码和限流正常。
- 网站后端接受发送请求。
- iframe 消息链路正常。

因此 fixture 测试必须与运行时 PING、真实页面健康检查共同使用。

### 7.3 文心最小示例

```html
<div id="ci-area">
  <textarea id="chat-textarea" class="ci-textarea ci-scroll-style"></textarea>
</div>
<span class="ci-submit-button">
  <img id="ci-submit-button-ai" class="ci-submit-button-ai-active">
</span>
```

至少覆盖以下测试：

1. 优先匹配 `#chat-textarea`。
2. 注入后 `value.length === expectedLength`。
3. active 图片存在时判定发送控件可用。
4. 实际 click 目标为 `.ci-submit-button`。
5. 输入失败后清理本次状态，下一次请求仍可执行。
6. 文心失败不阻塞其他 provider。

## 八、受控应用与本地提交

自动修复必须拆成“生成计划”和“应用计划”两个命令。建议未来提供：

```powershell
# 只分析，不写代码
node healthcheck\selector-healthcheck.js --provider wenxin --repair-plan

# 人工检查 repair-plan.json 后才允许应用
node healthcheck\selector-healthcheck.js --apply-repair-plan healthcheck\data\repair-plan.json
```

应用阶段应执行以下防护：

1. 确认工作目录是当前项目根目录。
2. 确认计划中的 sourceFile 位于当前项目内。
3. 检查源码自生成计划后没有变化，避免覆盖新修改。
4. 只修改对应 provider 的源文件和新增 fixture/测试。
5. 不直接编辑 `content-scripts/text-injection-all-providers.js`。
6. 执行 `npm run build:content`。
7. 执行目标测试。
8. 执行 `npm test -- --run`。
9. 可选执行 `npm run lint`。
10. 查看 `git diff --check` 和实际 diff。
11. 只有全部验证通过才创建本地 commit。
12. 永远不执行 `git push`。

如果工作区已有无关修改，工具只能暂存本次明确生成的文件，不能使用 `git add .`。

## 九、实施顺序

### 阶段 0：真实环境复测当前文心修复

操作：

1. 打开 `chrome://extensions/`。
2. 对未打包扩展点击“重新加载”。
3. 关闭并重新打开 AIChatMerge 多面板，确保 iframe 使用新 bundle。
4. 清空旧调试日志。
5. 单独向文心发送一条短文本。
6. 再执行一次包含文心和其他 provider 的统一发送。
7. 下载新调试日志。

验收：

- 文本确实进入 `#chat-textarea`。
- 页面不因注入失败自动刷新。
- 点击后输入框清空或文心开始回答。
- 文心失败时其他 AI 仍能继续发送。
- 日志不再只有无法分类的 `panel-injection:timeout`。

### 阶段 1：实现 READY + PING/PONG + buildId

优先级：P0。

测试要求：

- 正常 READY 被正确关联到 panel。
- 伪造来源被拒绝。
- PING 与 PONG 的 requestId 对应。
- 超时能快速返回 `transport-ping-timeout`。
- buildId 不一致能明确提示重新加载扩展。
- 一个 panel PING 失败不阻塞其他 panel。

### 阶段 2：统一发送状态机和效果验证

优先级：P0/P1。

测试要求：

- 每个请求只产生一个最终故障分类。
- 输入框命中但写入为零时报告 `composer-write-rejected`。
- 点击后无任何效果时报告 `send-effect-timeout`。
- 失败清理 request、timer 和 busy 状态。
- 后续请求仍可执行。

### 阶段 3：扩展健康检查候选评分

优先级：P1。

先只生成报告，不修改源码。至少选择文心和 Kimi 两个已知案例校验评分是否合理。

### 阶段 4：自动生成 fixture 和 repair plan

优先级：P1/P2。

生成的 fixture 必须最小化并脱敏；repair plan 必须包含故障阶段、证据、置信度、目标源文件和拒绝自动应用的原因。

### 阶段 5：人工批准后的自动应用

优先级：P2。

只有在前四阶段稳定后再实现。初期建议工具生成补丁但不自动 commit；流程成熟后，才允许测试全绿时自动创建本地 commit。

## 十、主要困难

### 10.1 页面 DOM 是动态的

第三方网站可能使用随机 class、A/B 测试、延迟渲染、响应式布局和不同账号界面。同一 provider 在不同用户、窗口宽度或日期下可能出现不同 DOM。

对策：使用多个稳定属性组合、等待条件而非固定 sleep、保存基线，并把“唯一可见候选”作为重要条件。

### 10.2 找到元素不等于框架接受写入

React、Vue 或自定义编辑器可能维护自己的状态。直接设置 `value` 或 `textContent` 后，肉眼看到文本不代表发送按钮或内部状态已经更新。

对策：使用原生 setter、派发框架需要的事件，并在渲染后复读；最终仍要检查发送效果。

### 10.3 发送按钮可能是复合控件

文心当前结构就是外层 `span` 负责交互、内层 `img` 表示 active 状态。只找带图标的元素可能点击无效，只找外层又可能无法判断是否可发送。

对策：把“状态元素”和“点击元素”分开建模，不假设它们是同一个 DOM 节点。

### 10.4 iframe 和来源校验复杂

provider 页面可能重写 parent/top、发生跨域导航或重新创建 iframe。为兼容这些页面而放宽来源校验又可能引入安全问题。

对策：要求扩展 origin 精确匹配，并记住实际可信 `event.source`；READY/PING 必须沿相同可信通道返回。

### 10.5 登录态、验证码和限流会制造假故障

未登录页可能也有 textarea 或按钮，但它们不是聊天输入框；验证码或服务限流也可能表现成“点击无反应”。

对策：先分类页面状态，检测 URL、登录标志、验证码和错误提示。状态不明确时禁止生成自动补丁。

### 10.6 自动真实发送有副作用

健康检查如果自动点击发送，会消耗额度、污染聊天历史，甚至向不期望的目标发送内容。

对策：默认只做可恢复的写入探针，不点击发送。真实发送必须使用显式开关和测试账号。

### 10.7 快照可能包含敏感信息

完整 HTML 可能包含用户对话、账号信息或 token。把大快照直接放入 Git 或日志存在风险。

对策：默认只保存必要 DOM 片段，移除文本、Cookie、脚本、隐藏字段和长属性；任何快照加入 Git 前必须人工检查。

### 10.8 自动修改代码可能覆盖本地工作

项目可能已有未提交修改。自动工具如果使用整文件重写、`git add .` 或强制恢复，会破坏用户工作。

对策：记录生成计划时的文件哈希，只应用小范围补丁，只暂存明确文件；检测到目标文件已变化就停止。

## 十一、日志设计要求

下载日志是给 AI 快速诊断使用，不应膨胀成完整录屏或 DOM dump。

保留：

- requestId、panelId、providerId。
- 最终失败阶段和耗时。
- buildId/protocolVersion 是否匹配。
- 安全的元素摘要。
- expected/before/after 长度。
- 候选数量和最多少量候选摘要。

不保留：

- 完整用户提示词和回答。
- Cookie、token、请求头。
- 完整页面 HTML。
- 每次轮询和每次重试的重复日志。

正常成功阶段可以用于内存状态和统计，但短诊断报告只突出异常及其前置证据。

### 11.1 当前临时传输诊断

当前只有一组临时诊断：provider 内容脚本通信链路的 READY/PING/PONG 探测。

| 项目 | 位置或约定 |
|---|---|
| 统一开关 | `modules/diagnostic-config.js` 中的 `ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS` |
| 面板端实现 | `aichatmerge-panel/modules/provider-transport-diagnostics.js` |
| 内容脚本实现 | `content-scripts/src/providers/transport-diagnostics.js` |
| 日志前缀 | `provider-transport:*` |
| 超时摘要 | `panel-injection:timeout.details.transportProbe` |

该诊断不记录提示词、回答、Cookie、token 或完整 URL。

### 11.2 正式版关闭与移除

正式版推荐保留代码并关闭统一开关：

1. 把 `ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS` 改为 `false`。
2. 执行 `npm run build:content`，让 content script bundle 同步关闭诊断。
3. 执行 `npm test -- --run`。
4. 确认不再产生 `provider-transport:*`，超时摘要中的 `transportProbe.status` 为 `disabled`。

如果正式版要求从源码物理删除诊断：

1. 删除面板端和内容脚本端两个 `provider-transport-diagnostics.js`。
2. 删除 `modules/diagnostic-config.js` 中对应开关、协议版本和 buildId；没有其他诊断时可删除整个文件。
3. 从 `send-pipeline.js` 删除 `probePanelContentScript` 的导入、调用和 `transportProbe` 字段。
4. 从 `panel-transport.js` 删除 `handleProviderTransportDiagnosticMessage` 的导入和调用。
5. 从 `text-injection-entry.js` 删除 `handleProviderTransportPing`、`postProviderTransportReady` 的导入和调用。
6. 删除 `tests/panel-content-script-probe.test.js`，并清理其他测试中的对应 mock 和断言。
7. 更新 `docs/code-structure.md`，重新构建 content script 并执行完整测试。

不要通过搜索并删除所有“日志”字样来清理，这可能误删正式功能所需的错误处理。应按统一开关、专用模块和固定日志前缀处理。

## 十二、完成定义

只有同时满足以下条件，才能认为自动诊断和受控修复功能完成：

- 能明确区分内容脚本未加载、消息超时、选择器失效、写入失败、按钮失效和点击无效果。
- 文心失败不会阻塞其他 AI 或下一次发送。
- 选择器候选具有可解释评分，并拒绝明显脆弱的选择器。
- 默认不会在真实网站自动发送测试内容。
- 能生成脱敏的最小 fixture 和 repair plan。
- 修改的是 `content-scripts/src/` 源码，并重新生成 bundle。
- 目标测试和完整测试通过。
- 已有无关工作区修改不被暂存或覆盖。
- 只创建本地提交，不执行任何网络推送。

## 十三、下一次开发建议

阶段 1 的 READY/PING/PONG、buildId 和统一诊断开关已经实现。下一步先重新加载未打包扩展、关闭旧的 AIChatMerge 页面并在真实文心页面复测。

如果新日志的 `transportProbe.status` 为 `pong`，继续定位输入框写入和发送效果；如果为 `timeout`，根据 `readySeen` 判断是内容脚本未加载，还是 iframe 导航后监听器失效。真实环境证据明确后，再进入阶段 2；不要直接自动修改选择器。
