# i18n 完整性检查结果

## 状态：❌ 有问题

## 统计
- zh_CN messages.json 中的 key 总数：274
- en messages.json 中的 key 总数：281
- zh_TW messages.json 中的 key 总数：274
- JS 中调用的 t() key 总数：39
- HTML data-i18n 使用的 key 总数：109
- 代码中使用的唯一 key 总数：147
- 三个语言文件都缺失的 key：15
- en 多出但 zh_CN/zh_TW 没有的 key：7
- 冗余的 key（messages.json 中有但代码未使用）：~142（每语言）

## 语言文件 key 一致性

### en 比 zh_CN/zh_TW 多出的 key（7个）
这些 key 只存在于 en messages.json，中文和繁体中缺失：

| Key | en 消息 |
|-----|---------|
| `descMultiPanel` | Compare responses from multiple AI chatbots side by side in one window |
| `labelOpenMultiPanel` | Open Multi-Panel View |
| `descOpenMultiPanel` | Launch the multi-panel comparison interface in a new tab |
| `btnOpenMultiPanel` | Open Multi-Panel |
| `labelDefaultLayout` | Default Layout |
| `descDefaultLayout` | Choose the default panel arrangement |
| `descEnterBehavior2` | Applies to: DeepSeek, Kimi, ChatGPT, and Claude |

**结论：** en 有 7 个 key 在 zh_CN 和 zh_TW 中不存在。这些 key 在代码中也未被使用，属于冗余。

---

## 问题列表

### [I1] 缺失 key — 15 个 key 在三个语言文件中都不存在

这 15 个 key 被 HTML data-i18n 属性引用，但三个 messages.json 中都没有定义，运行时会显示原始 key 文本。

| # | Key | 引用位置 |
|---|-----|----------|
| 1 | `labelMergeMode` | options/options.html:97 |
| 2 | `descMergeMode` | options/options.html:98 |
| 3 | `optionMergeOnly` | options/options.html:104 |
| 4 | `optionMergeAndDiscuss` | options/options.html:105 |
| 5 | `optionManualMerge` | options/options.html:106 |
| 6 | `sectionObsidianExport` | options/options.html:115 |
| 7 | `labelObsidianStoragePath` | options/options.html:119 |
| 8 | `descMarkdownExportPath` | options/options.html:120 |
| 9 | `placeholderObsidianStoragePath` | options/options.html:123 |
| 10 | `labelObsidianExportMode` | options/options.html:129 |
| 11 | `obsidianExportAuto` | options/options.html:133 |
| 12 | `obsidianExportManual` | options/options.html:134 |
| 13 | `labelExportInitialMerge` | options/options.html:141 |
| 14 | `descExportInitialMerge` | options/options.html:142 |
| 15 | `save` | options/options.html:188 |

### [I2] 参数不匹配 — `msgCustomPromptsImported`

- 文件：options/modules/data-manager.js:182
- 调用：`showToast('success', 'msgCustomPromptsImported', [result.imported.toString(), result.skipped.toString()])`
- 期望：1 个参数（placeholder: `$IMPORTED$` → `$1`）
- 实际：2 个参数
- 说明：zh_CN 定义为 `成功导入 $IMPORTED$ 个自定义提示词`，只有 1 个占位符，但代码传了 2 个参数。第 2 个参数会被忽略。

### [I3] 参数不匹配 — `msgDefaultPromptsImported`

- 文件：options/modules/data-manager.js:231
- 调用：`showToast('success', 'msgDefaultPromptsImported', [result.imported.toString(), result.skipped.toString()])`
- 期望：0 个参数（该 key 没有定义 placeholders）
- 实际：2 个参数
- 说明：zh_CN 定义为 `已导入默认提示词`，没有占位符，但代码传了 2 个参数。所有参数会被忽略。

### [I4] 硬编码中文字符串（未使用 i18n）

- 文件：options/modules/event-handlers.js:86-103
- 内容：评分历史相关的 4 个 alert/confirm 消息使用了硬编码中文，未使用 t() 函数：

```
第 86 行: alert('暂无评分可导出')
第 88 行: alert(`已导出 ${result.rowCount} 条评分记录`)
第 92 行: alert('导出评分失败: ' + ...)
第 97 行: confirm('确定要清空所有评分记录吗？此操作不可撤销。')
第 100 行: alert('评分记录已清空')
第 103 行: alert('清空评分失败: ' + ...)
```

虽然 messages.json 中有对应的 key（`msgNoScoresToExport`、`msgScoresExported`、`msgScoreExportFailed`、`msgConfirmClearScores`、`msgScoresCleared`、`msgClearScoresFailed`），但代码中没有使用它们。

---

## 冗余 key 统计

三个语言文件中各约有 142 个 key 在 options/ 和 modules/ 代码中未被使用（通过 t() 或 data-i18n 引用）。这些 key 可能被以下位置使用：
- multi-panel 页面（aichatmerge-panel/）的独立 i18n 模块
- background.js 或 content script
- 其他未扫描的目录

**注意：** 冗余 key 不影响功能，但会增加维护成本。建议确认这些 key 是否在其他地方使用后再清理。

---

## 修复建议

1. **[I1] 立即修复** — 在 zh_CN、en、zh_TW 三个 messages.json 中添加缺失的 15 个 key 的翻译
2. **[I2] 修复** — 修改 `msgCustomPromptsImported` 的 message 添加 `$SKIPPED$` 占位符，或修改代码只传 1 个参数
3. **[I3] 修复** — 修改 `msgDefaultPromptsImported` 的 message 添加占位符以显示 skipped 数量，或修改代码只传 1 个参数
4. **[I4] 修复** — 将 event-handlers.js 中的硬编码中文替换为 t() 函数调用
5. **清理** — 确认 en 多出的 7 个 key 是否需要保留，如不需要则从 en 中删除
