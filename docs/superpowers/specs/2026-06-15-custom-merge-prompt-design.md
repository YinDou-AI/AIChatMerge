# 自定义融合提示词设计

> 状态：待实现
> 日期：2026-06-15

---

## 目标

在设置页面让用户自定义融合提示词模板，同时展示默认模板供参考和修改。

## UI 设计

在设置页面「多面板」section 下新增：

```
┌─────────────────────────────────────────────────────┐
│ 融合提示词（中文）                                      │
│ AI裁判的中文评估指令。必须包含 {question} 和 {answers}。  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ [textarea，默认显示内置中文模板，用户可修改]        │  │
│ │                                                 │  │
│ └─────────────────────────────────────────────────┘  │
│ ⚠ 缺少必需占位符: {answers}         [恢复默认]        │
│                                                       │
│ 融合提示词（英文）                                      │
│ AI裁判的英文评估指令。必须包含 {question} 和 {answers}。  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ [textarea，默认显示内置英文模板，用户可修改]        │  │
│ │                                                 │  │
│ └─────────────────────────────────────────────────┘  │
│                                         [恢复默认]    │
└─────────────────────────────────────────────────────┘
```

两个 textarea：中文模板 + 英文模板，分别对应 `currentLocale === 'zh'` 和 `currentLocale === 'en'` 时使用的模板。

## 格式约束

| 约束 | 说明 |
|------|------|
| 必需占位符 | `{question}` 和 `{answers}` 必须同时存在 |
| 最大长度 | 2000 字符 |
| 占位符格式 | `{xxx}` 格式，只能用字母数字下划线 |
| 实时校验 | 输入时实时检查，红色提示缺少哪个占位符 |
| 恢复默认 | 点击按钮恢复为内置模板 |

## 存储

在 `settings.js` 的 `DEFAULT_SETTINGS` 中新增：

```js
mergePromptTemplateZh: null,  // null = 使用内置中文模板
mergePromptTemplateEn: null,  // null = 使用内置英文模板
```

## 数据流

```
设置页 textarea → 校验 → chrome.storage.sync
                              ↓
multi-panel.js buildMergePrompt()
  → 读取 storage
  → 有自定义模板？用自定义 : 用内置默认
  → 替换 {question} 和 {answers}
```

## 验证函数

```js
function validateTemplate(text) {
  if (text.length > 2000) return '模板过长（最多2000字符）';
  if (!text.includes('{question}')) return '缺少 {question} 占位符';
  if (!text.includes('{answers}')) return '缺少 {answers} 占位符';
  return null;
}
```

## 内置默认模板

### 中文默认模板

```
你是一位公正的AI回答裁判。当前日期：{date}。
任务：作为裁判，客观评估以下多个AI模型对同一问题的回答，综合各方观点给出排名和推荐。

【原始问题】
{question}

【各模型回答】
{answers}

裁判规则：
1. 只基于上述回答内容进行评估，不得发表个人观点
2. 以当前日期为基准，识别并标注可能已过时的信息
3. 发现模型间明显矛盾时，标注争议点并说明分歧所在
4. 将观点按核心立场归类，合并重复内容
5. 精简为2-4个核心观点，每个观点必须有模型支撑

输出格式（严格遵守）：
【原始问题】
（用一句话复述原始问题，便于后续回顾时快速理解上下文）

[观点名称]
- 采纳模型：[模型名称列表]
- 核心理由：[基于原文的客观分析，言简意赅]
- 争议说明：[如有模型持不同意见，在此标注；无争议则省略此行]
（逐个观点列出）

【综合建议】
基于以上评估，给出最推荐的方案及理由，重点突出、逻辑清晰。
```

### 英文默认模板

```
You are a fair AI response judge. Today's date: {date}.
Task: As a judge, objectively evaluate responses from multiple AI models to the same question, synthesize perspectives into a ranked recommendation.

[Original Question]
{question}

[Model Responses]
{answers}

Judging Rules:
1. Base your evaluation solely on the provided responses; do not express personal opinions
2. Using today's date as reference, identify and flag potentially outdated information
3. When models clearly contradict each other, mark the dispute and explain the disagreement
4. Group perspectives by core stance, merging duplicate content
5. Distill into 2-4 key viewpoints, each supported by at least one model

Output Format (strictly follow):
[Original Question]
(Restate the original question in one sentence for context)

[Viewpoint Name]
- Supported by: [list of model names]
- Rationale: [objective analysis based on provided text, concise and precise]
- Dispute: [note if models disagree; omit if unanimous]
(list each viewpoint)

[Final Recommendation]
Based on the above evaluation, provide the most recommended approach with reasoning. Be clear and well-structured.
```

## 额外可用占位符

除 `{question}` 和 `{answers}` 外，模板中还可使用：

| 占位符 | 说明 |
|--------|------|
| `{date}` | 当前日期（自动替换） |

## 文件变更

| 文件 | 变更 |
|------|------|
| `options/options.html` | 新增融合提示词设置区域（两个 textarea + 恢复默认按钮） |
| `options/options.js` | 新增模板校验、保存、恢复默认逻辑 |
| `modules/settings.js` | DEFAULT_SETTINGS 新增 mergePromptTemplateZh/En |
| `multi-panel/multi-panel.js` | buildMergePrompt() 读取自定义模板，fallback 到内置默认 |
| `_locales/zh_CN/messages.json` | 新增相关翻译 key |
| `_locales/en/messages.json` | 新增相关翻译 key |
