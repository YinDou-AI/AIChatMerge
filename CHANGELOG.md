# Changelog

## 1.0 - 2026-06-15

### UI 修复
- 添加面板菜单：点击面板区域现在可以正确关闭菜单（改用 pointerdown 事件）
- 融合提示词：输出格式增加「复述原始问题」步骤，便于后续回顾

### 自动融合功能
- Send All 后自动监控所有 AI 回答完成状态（轮询检测，连续2次内容稳定 = 完成）
- 自动收集所有答案，按模板拼接提示词
- 打开目标 AI 新标签页（最左边），注入提示词并自动发送
- 融合目标 AI 下拉框（7个平台可选）
- 融合按钮支持手动触发
- 最长等待 2 分钟超时保护

### 答案提取器重构
- 提取顺序调整：专用提取器优先于通用选择器，避免匹配到UI元素
- 删除所有长度限制（MIN_ANSWER_LENGTH/MAX_ANSWER_LENGTH），只要 `text.length > 0` 即返回
- 删除文本过滤（cleanCopyText/cleanDoubaoNoise/cleanWenxinNoise），原始文本直接返回
- 新增共享 fallback 函数：`extractFromRoleLog()`、`extractFromRoleList()`
- Kimi 选择器更新为 `.markdown-container` > `.markdown` 优先
- 千问提取器新增推荐卡片移除逻辑（`.qk-md-has-multi-modal` 等）

### UI 调整
- 一键复制按钮从 toolbar 移到底部输入栏，紧跟 Send All 右侧
- 输入框缩小（padding/min-height/max-height/font-size 均减小）

### 国内AI平台支持
- 新增 7 个国内平台专用提取器（DeepSeek/豆包/智谱/文心/千问/Kimi/元宝）
- 新增 4 个平台 Enter 键行为（千问/文心/智谱/秘塔）
- Slate 编辑器注入支持（千问/文心使用 ClipboardEvent paste）
- 元宝暂停开发，相关代码已注释

### 调试功能
- 提取诊断：`EXTRACT_DEBUG` 消息 + `debugExtraction()` 全局函数
- 选择器健康检查：`runHealthCheck()` 函数

### 文件变更
- 新增 12 个提取器/行为文件（content-scripts/answer-extractor-*.js, enter-behavior-*.js）
- 修改 text-injection-all-providers.js（提取逻辑重构）
- 修改 multi-panel.html/js/css（UI 调整 + 调试功能）
- 修改 manifest.json/providers.js/bypass-headers.json（元宝暂停）

## 1.1.1 - 2026-04-13
- Fixed: New Chat for All now preserves temporary chat mode for supported providers.
- Fixed: Gemini and Grok temporary or private chat activation no longer toggles off when already active.
- Fixed: Grok private new-chat detection now avoids offscreen controls in narrow layouts.

## 1.1.0 - 2026-04-07
- Added: One-click temporary chat toggle for supported providers in multi-panel. (#39)
- Added: Global Google mode sync with AI/Search mode switching and repeat send/fill fixes. (#37)
- Fixed: Unified input focus retention after `New Chat for All` and `Send All`. (#36, #38)
- Fixed: Focus trap caused by iframe loading state leaking during multi-panel interactions. (#39)

## 1.0.3 - 2026-03-05
- Fixed: Enter key on standalone Gemini page now works correctly (no longer triggers sidebar menu). (#35)
- Fixed: IME composition Enter key sending message prematurely in multi-panel. (#31)
- Docs: Added zh-CN and ja READMEs with updated store link. (#30)

## 1.0.0 - 2026-02-03
- Multi-panel workspace with flexible layouts up to 1x7.
- Unified input bar to send or fill prompts across all panels.
- Prompt library with import/export, tagging, and variable templates.
- Provider management and per-provider Enter key behavior.
- Context menu send with optional local page content extraction.
- Multilingual UI (10 languages).
- Update checks via GitHub.
