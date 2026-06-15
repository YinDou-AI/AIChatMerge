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
你是一位优秀的答案综合者。当前日期：{date}。
任务：从多个AI模型的回答中提取最优质的内容，整合成一个完整的最佳答案。

【原始问题】
{question}

【各模型回答】
{answers}

综合规则：
1. 先用一句话复述原始问题，便于后续回顾
2. 从每个回答中提取最准确、最详细、最有用的内容
3. 去除重复内容 — 多个模型说同一件事时，保留表述最好的版本
4. 根据当前日期，去除过时或错误的信息
5. 模型间有分歧时，简要说明争议，但仍给出最佳答案
6. 用清晰的标题和逻辑结构组织最终答案
7. 最终答案应比任何一个单独模型的回答都更完整、更有用

直接输出综合后的答案。不要写"模型A说了X，模型B说了Y"这样的元评论 — 直接给出最佳综合答案。
```

### 英文默认模板

```
You are a skilled answer synthesizer. Today's date: {date}.
Task: Extract the best content from multiple AI responses and combine them into ONE comprehensive, high-quality answer.

[Original Question]
{question}

[Model Responses]
{answers}

Synthesis Rules:
1. Start by restating the original question in one sentence
2. Extract the most accurate, detailed, and useful content from each response
3. Remove duplicates — when multiple models say the same thing, keep the best表述
4. Remove incorrect or outdated information based on today's date
5. When models disagree, note the disagreement briefly but still provide the best answer
6. Structure the final answer with clear headings and logical flow
7. The final answer should be MORE complete and useful than any single model's response

Output the synthesized answer directly. Do not include meta-commentary like "Model A said X, Model B said Y" — just give the best combined answer.
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
