# AI原生开发规范

> 纯 AI 读取。规则、模板、模式、检查清单。
> 每个项目必须创建 CLAUDE.md + docs/code-structure.md。

---

## 一、必须文件

### 1.1 CLAUDE.md

放在项目根目录。必须包含以下结构：

```markdown
# 项目名称

## 一句话描述
[这个项目是干什么的]

## 技术栈
- 语言：
- 框架：
- 构建工具：
- 测试框架：

## 关键入口
| 入口 | 文件 | 说明 |
|------|------|------|

## 构建与测试
```bash
npm install                  # 安装依赖
npm test -- --run            # 运行测试
npm run build                # 构建产物
```

## 日志字段约定
- `targetId`：被操作对象 ID（项目自定义）
- `sourceId`：事件来源（项目自定义）

## 重要约束
- [构建产物、旧版遗留、兼容层等]
```

每次架构变更后更新。

### 1.2 code-structure.md

放在 `docs/` 目录。必须包含以下结构：

```markdown
# 代码结构

## 模块概览
| 模块 | 文件 | 职责 | 日志前缀 |
|------|------|------|----------|

## 核心入口函数表
### module.js
functionName(params) → returnType

## 事件映射表
| 事件前缀 | 文件 | 入口函数 | 说明 |
|----------|------|----------|------|

## 关键调用链
用户操作 → moduleA → moduleB → moduleC

## postMessage 协议
| type | context | 方向 | 说明 |
|------|---------|------|------|
```

每次函数增删时更新。一个函数一行，只写签名和用途。

### 1.3 README.md

给人看。包含项目简介、安装步骤、使用方法。

---

## 二、文件组织

按功能领域组织，不按技术层级组织：

```
src/
  auth/           # 认证
  users/          # 用户
  shared/         # 共享工具
```

命名规则：
- 文件名：`kebab-case.js`
- 测试文件：`*.test.js`
- 一个文件只做一件事

---

## 三、命名

| 类型 | 规范 | 示例 |
|------|------|------|
| 函数 | camelCase | `getUserById()` |
| 常量 | UPPER_SNAKE_CASE | `MAX_SIZE` |
| 布尔 | is/has/can 前缀 | `isActive` |
| 文件 | kebab-case | `user-service.js` |

函数名必须自解释。`handleMergeTimeout(panelId)` 是好的，`check(p)` 是坏的。

---

## 四、模块设计规则

### 4.1 深度模块

对外暴露的函数越少越好。一个入口函数隐藏整个流程：

```javascript
// 正确：一个 triggerMerge 隐藏融合全流程
export function triggerMerge({ panels, mergePanelIds }) {
  const answers = extractAllAnswers(panels);
  const prompt = buildMergePrompt(question, answers);
  sendToPanel(mergePanel, prompt);
  startDiscussionAfterMerge(...);
}

// 错误：每个内部步骤都暴露
export function getAnswers(panels) { ... }
export function buildPrompt(question, answers) { ... }
export function send(mergePanel, prompt) { ... }
```

### 4.2 依赖注入

模块接受参数，不创建依赖：

```javascript
// 正确
function processOrder(order, paymentGateway) { ... }

// 错误
function processOrder(order) {
  const gateway = new StripeGateway();
}
```

### 4.3 返回结果

优先返回值，不产生副作用：

```javascript
// 正确
function calculateDiscount(cart) { return { total: ... }; }

// 错误
function applyDiscount(cart) { cart.total -= discount; }
```

---

## 五、循环依赖

### 5.1 预防

静态 import 图必须无环。用测试守护：

```javascript
// tests/module-acyclic.test.js
it('has no static import cycles', () => {
  const graph = buildModuleGraph('src/modules');
  expect(findStaticImportCycles(graph)).toEqual([]);
});
```

### 5.2 解法

按优先级：

1. **提取零依赖模块** — 把共享常量/配置移到无依赖的新模块
2. **移动函数** — 把造成环路的函数移到正确的归属模块
3. **动态导入** — `import('./module.js')` 替代静态 `import`

---

## 六、兼容层

模块拆分后旧引用路径失效时，用 re-export 兼容层：

```javascript
// event-handlers.js — 兼容层
export { setupPanelEventListeners } from './panel-ui-bindings.js';
export { setupPanelMenus } from './panel-menus.js';
```

规则：
- 新代码不得新增对兼容层的依赖
- 新代码必须直接引用领域模块
- 所有引用迁移完成后删除兼容层

---

## 七、日志驱动

### 7.1 日志格式

每条日志必须包含：

```javascript
recordLog('事件名', {
  targetId: 'xxx',        // 必填
  sourceId: 'xxx',        // 必填
  timestamp: Date.now(),  // 必填
  details: { ... }        // 可选
});
```

`targetId` 和 `sourceId` 含义在 CLAUDE.md 中声明。

### 7.2 模块对应

日志事件名前缀 = 模块名：

```
merge-monitor:*  → merge-monitor.js
markdown-export:* → markdown-export.js
panel-injection:* → send-pipeline.js
```

### 7.3 同步规则

- 新增事件 → 同步更新 code-structure.md 事件映射表
- 删除事件 → 同步删除映射条目
- 事件名变更 → 同步更新映射条目

---

## 八、postMessage 协议

跨 iframe 通信必须在 code-structure.md 维护协议表。

安全规则：
- 接收方必须校验 `event.origin` 或 `isTrustedExtensionParent(event)`
- 不接受 `*` 作为 origin
- 每个消息类型有明确的 `context` 字段

---

## 九、测试

### 9.1 命名

```javascript
describe('merge-engine', () => {
  it('should create merge panel when none exists', () => { ... });
  it('should abort stale trigger after new chat', () => { ... });
});
```

### 9.2 守护架构

关键架构约束用测试守护：

```javascript
// 无环依赖
it('has no static import cycles', () => { ... });

// 不重复导出
it('merge-engine only exports triggerMerge', () => { ... });

// 兼容层不被新代码引用
it('new code does not import from compatibility layers', () => { ... });
```

---

## 十、反模式

| 禁止 | 正确做法 |
|------|---------|
| 大文件 | 按职责拆分 |
| 隐式依赖 | 依赖注入 |
| 魔法数字 | 提取为常量 |
| 注释代码 | 删除，git 有历史 |
| 过期文档 | 及时更新或删除 |
| 循环依赖 | 提取公共模块或动态导入 |

---

## 十一、重构策略

分阶段，每阶段可独立验证：

1. **结构重构** — 拆分文件，移动函数 → 测试通过
2. **命名优化** — 统一命名风格 → 测试通过
3. **日志规范化** — 统一格式和事件命名 → 测试通过

---

## 十二、检查清单

### 开始前
- [ ] CLAUDE.md 存在且完整
- [ ] code-structure.md 存在
- [ ] README.md 存在

### 编码中
- [ ] 文件按功能领域组织
- [ ] 函数名自解释
- [ ] 静态 import 无环路
- [ ] 新代码不引用兼容层
- [ ] 日志格式包含 targetId + sourceId

### 完成后
- [ ] 所有测试通过
- [ ] code-structure.md 已同步更新
- [ ] 事件映射表已同步更新
