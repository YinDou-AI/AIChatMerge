# AIChatMerge 长期维护手册

## 1. 维护目标

这个项目依赖第三方网页 DOM，平台更新不可避免。维护工作的目标不是让选择器永远不变，而是让变化发生时：

1. 能从日志判断故障属于注入、提交、生成、完成检测还是答案提取。
2. 修改只影响对应 provider 和对应阶段。
3. 同类问题能被自动化测试拦截，不重复回归。

## 2. 发送与回答的契约

发送链路必须保持以下阶段独立：

| 阶段 | 成功条件 | 典型失败 |
|---|---|---|
| 注入 | 本次文本进入可见 composer | `injection-failed` |
| 提交 | 相对点击前基线出现新信号 | `submit-not-confirmed` |
| 通信 | 面板收到同一 `injectionRequestId` 的 `SUBMIT_TEXT_RESULT` | `SUBMIT_RESULT_TIMEOUT` |
| 生成 | 本轮停止按钮出现或本轮答案增长 | `generation-timeout` |
| 完成 | 已观察到本轮变化，随后进入稳定状态 | `completion-timeout` |
| 提取 | 返回本轮最新助手消息 | `answer-not-found` |

禁止用前一阶段的成功替代后一阶段。尤其禁止把 `injectSuccess` 当作“已发送”。

### 2.1 新提交框架

豆包提交故障的固定入口：

1. 查看 `SUBMIT_TEXT_RESULT` 或诊断事件的 `stage`、`code`、`requestId`。
2. 打开 `content-scripts/src/providers/doubao/adapter.js`。
3. 打开 `tests/fixtures/doubao/` 中对应 fixture。
4. 运行 `tests/doubao-submit-contract.test.js`。
5. 先增加一个能复现故障的脱敏 fixture，再修改
   `providers/doubao/` 内文件。

正常的豆包选择器修复不得修改 `send-pipeline.js`、`merge-engine.js`、
`panel-transport.js` 或其他 provider。通用状态机问题才允许修改
`content-scripts/src/submission/`，并且必须同时增加纯单元测试。

标准提交失败码：

| code | 含义 | 首要检查位置 |
|---|---|---|
| `SEND_CONTROL_NOT_FOUND` | 没找到可见发送控件 | `doubao/selectors.js` |
| `SEND_CONTROL_DISABLED` | 找到但尚未就绪 | `doubao/adapter.js`、fixture 状态 |
| `SUBMIT_NOT_CONFIRMED` | 点击后没有新状态变化 | fixture、snapshot 信号 |
| `SUBMIT_CANCELLED` | 新发送/新会话主动取消旧任务 | 调用方取消时机 |
| `SUBMIT_ADAPTER_ERROR` | adapter 读取或操作 DOM 异常 | `doubao/adapter.js` |
| `SUBMIT_RESULT_TIMEOUT` | provider 可能已提交，但面板没收到结果消息 | `messaging.js`、`panel-transport.js`、`send-pipeline.js` |

## 3. 选择器修改规则

1. 优先使用稳定语义属性，例如 `data-*`、`aria-*` 和明确的消息角色。
2. 回答选择器必须限定到回答正文，避免全局 `[class*="assistant"]`、`[class*="answer"]`、`[class*="message"]`。
3. fallback 应按 DOM 顺序选择最新节点，不能选择文本最长的节点。
4. 新增 fallback 前先保存脱敏后的最小 DOM fixture，并写一个修复前失败的测试。
5. 选择器命中后仍需检查可见性，并排除 composer、表单、导航栏、侧边栏和页脚。

## 4. 每次故障的处理流程

```
下载短诊断日志
→ summary
→ diagnostics.autoMerge
→ issues
→ sessions
→ timeline
→ 确定失败阶段
→ 添加最小复现测试
→ 做单阶段最小修改
→ 运行目标测试
→ 运行全量测试
→ npm run build:content
→ 连续两轮真实网页冒烟测试
→ 保存成功日志作对照
```

没有“修复前失败、修复后通过”的测试，不应把问题标记为已修复。

## 5. 必测场景

每个平台至少覆盖：

- 新会话第一次发送。
- 同一会话第二次发送。
- composer 已注入但点击被页面吞掉。
- 页面残留旧停止按钮。
- 历史回答比本轮回答更长。
- 本轮回答复用旧 DOM 节点并持续增长。
- 本轮回答创建新 DOM 节点。
- 页面重载、路由切换或 composer 节点被替换。

发版前真实网页冒烟测试至少包含豆包、千问、Claude、Gemini 两轮连续发送和答案复制。

## 6. 日志要求

一次发送必须使用同一个 `injectionRequestId` 串联：

- `panel-send:start`
- `panel-injection:success/failed/timeout`
- `text-injection:submit-confirmed/submit-failed`
- `panel-submit:success/failed/timeout`

日志只记录诊断所需信息：文本长度、状态变化、命中选择器、attempt、耗时和短摘要。不要记录完整问题、回答或用户隐私。

日志数量约束：

- 一次用户广播最多新增一条 `broadcast:input-cleared`，它只表示 UI 草稿已处理。
- 禁止记录轮询中的重复 `pending` 事件；短报告在导出时从已有 start/terminal 事件推导 pending。
- `verdict.status=pending` 不是失败；查看 `stage`、`code`、`requestId` 后等待终态。
- `stage=transport, code=SUBMIT_RESULT_TIMEOUT` 只检查消息回传链，不修改 provider adapter。

### 6.1 正式版隔离规则

- 业务结果与诊断事件必须分开：`INJECT_TEXT_RESULT`、`SUBMIT_TEXT_RESULT`
  属于业务协议，不能随日志删除。
- 业务模块只依赖 `debug-log.js` 稳定接口，不得直接依赖
  `debug-log.release.js`、`debug-log-utils.js` 或 `debug-verdict.js`。
- 日志只能观察业务结果，禁止用日志内容推进状态机或决定成功。
- 正式版由 `npm run release:package` 自动安装无副作用日志接口；不要人工逐文件
  删除 `recordDebugLog()` 调用。
- content script 必须在 staging 中使用关闭后的诊断开关重新构建。只修改
  `modules/diagnostic-config.js` 而继续复用旧 bundle，视为发布失败。

正式包检查：

```text
DEBUG_LOGGING_ENABLED=false
DEBUG_EXPORT_ENABLED=false
ENABLE_CONTENT_SCRIPT_DIAGNOSTICS=false
debug-log.js 不包含 chrome.storage、chrome.downloads、Blob 或定时器
不包含 debug-log-utils.js、debug-verdict.js、self-test-driver.js
面板和设置页不包含调试日志按钮、开关或全局清理入口
业务提交结果消息仍存在，诊断事件消息不再产生
```

## 7. 提交前检查

```bash
npm test -- --run
npm test -- --run tests/doubao-submit-contract.test.js tests/doubao-submit-dispatch.test.js tests/submit-snapshot.test.js tests/submission-architecture.test.js
npm run build:content
npm run release:package
git diff --check
npm run lint
```

`content-scripts/src/` 有任何修改都必须重新生成
`content-scripts/text-injection-all-providers.js`。如果 lint 存在历史基线错误，交付说明中必须区分“本次新增”和“已有问题”。

建议每个问题单独提交：

```text
fix(doubao): confirm submission against pre-click baseline
fix(qianwen): extract the latest assistant answer
test(claude): cover stale stop button on second send
```

禁止通过删除断言、延长无依据超时或把失败改成成功预期来让测试变绿。
