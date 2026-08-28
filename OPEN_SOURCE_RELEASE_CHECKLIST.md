# 开源发布检查清单

本仓库在提交和推送前，遵循以下规则。

## 不提交到公开仓库

- 本地依赖、浏览器生成目录和测试产物：`node_modules/`、`_metadata/`、`test-results/`、`coverage/`。
- 密钥和本地配置：`.env.*`（保留 `.env.example`）、Cookie、访问令牌、账号会话、私钥、证书。
- 崩溃与临时文件：`*.stackdump`、`*.log`、`*.tmp`、`*.bak`。
- 用户数据、测试账号资料、浏览器导出和个人截图。
- 内部工作记录与未公开的产品规划，例如 `AIChatMerge改造方案.md`。

## 提交前检查

1. 检查 `git status --short`，确认没有意外的本地文件。
2. 检查新增或修改文件中不存在 API Key、Cookie、令牌、密码、私钥或个人信息。
3. 确认截图没有真实账号、聊天记录、个人头像、邮箱或其他敏感信息。
4. 执行相关测试，并运行 `git diff --check`。
5. 只暂存与本次功能或修复直接相关的文件。

## 应保留的公开内容

- 源代码、扩展清单、依赖清单和测试代码。
- `README.md`、`README.zh-CN.md`、`LICENSE`、`PRIVACY.md`。
- README 正在引用且已完成隐私检查的产品截图。

## 品牌与说明

本项目是独立的浏览器扩展，与 ChatGPT、Claude、Gemini、Grok、元宝及其他接入服务均无隶属关系。相关名称和商标归其各自权利人所有；用户应自行登录并遵守各服务的使用条款。

---

## GitHub 首次上线清单

> 当前项目版本固定为 **1.0.0**。除非项目维护者明确要求，不主动修改 `manifest.json`、`package.json`、`package-lock.json`、`data/version-info.json`、README 徽章或 CHANGELOG 中的当前版本号。

### 1. 项目身份与仓库主页

- [ ] 确定 GitHub 仓库的最终地址、Issues 地址和维护者联系方式。
- [ ] README 首页写明项目定位：在一个浏览器多面板内向多个已登录 AI 网页发送同一问题、比较回答，并支持融合。
- [ ] 写明目标用户、核心功能、当前支持的平台和已知限制。
- [ ] 明确说明：本扩展不是任何 AI 服务商的官方产品，也不提供这些模型的账号、额度或 API。
- [ ] 所有 README、PRIVACY、`package.json`、GitHub About、Issue 模板和下载链接使用同一个正式仓库地址；不得保留旧 AIChatMerge、Manho 或失效商店链接。

### 2. 版权、来源与截图

- [ ] 保留 MIT LICENSE 中已有的上游版权声明；若项目基于上游代码修改，不删除原作者署名。
- [ ] 增加本项目维护者的版权/致谢说明（仅在维护者确认名称或主体后填写）。
- [ ] 检查 README 的每一张截图：不得含真实账号、邮箱、头像、对话内容、Cookie、会话 URL、API Key 或私人文件路径。
- [ ] 无法确认来源或不是当前产品界面的截图，替换为自己使用当前版本制作的截图。
- [ ] 截图中的产品名、平台数量、功能文案必须与当前实现一致；不要用“支持”描述尚未稳定的功能。

### 3. 文档必须更新

- [ ] `README.md` 与 `README.zh-CN.md`：项目介绍、12 个支持平台、安装方式、常见问题、贡献方式、正式链接。
- [ ] 公开界面只维护简体中文与英文；删除 README 中的失效语言链接，旧语言设置应回退到简体中文或英文。
- [ ] `PRIVACY.md`：删除已不存在的“GitHub 自动检查更新”等描述；更新仓库、Issues、维护者和最后修订日期。
- [ ] 说明嵌入式面板的安全边界：扩展为加载 AI 页面会对指定 AI 子 iframe 移除 `X-Frame-Options` / CSP；用户需自行登录并遵守平台条款。
- [ ] 增加 `CONTRIBUTING.md`：本地加载扩展、运行测试、如何新增平台选择器、如何提交 Bug。
- [ ] 增加简短架构文档：多面板、内容注入、SSE/DOM 完成检测、答案提取、融合的职责边界。
- [ ] `CHANGELOG.md` 保持按版本从新到旧排序；当前版本固定为 `1.0.0`，后续仅在维护者明确发布时新增版本。

### 4. 安全与隐私发布前复核

- [ ] 复查 `manifest.json` 的 `host_permissions`、content scripts 和 `web_accessible_resources`；确认每项都有功能必要性。
- [ ] 评估将 `web_accessible_resources.matches` 从 `<all_urls>` 收紧为实际 AI 平台域名白名单；修改后必须逐平台验证 SSE 注入、发送和完成检测。
- [ ] 不上传 `.env`、Token、Cookie、浏览器 profile、会话 URL、真实聊天导出或个人调试日志。
- [ ] 复查 `unsafeHtml()` 的所有调用方；只允许传入已审核的静态或已清洗 HTML。
- [ ] 不因“安全清理”直接删除 iframe 嵌入或 frame-busting 兼容逻辑；这类变更必须单独测试所有平台。

### 5. 发布前功能验证

- [ ] 在 Chrome 中以“加载已解压的扩展程序”重新加载，确认 `manifest.json` 无报错。
- [ ] 使用至少两个国内平台和两个海外平台验证：填入、发送、收到回答、提取回答、手动融合。
- [ ] 单独验证自动融合：短回答、长回答、分段暂停、超时、选择“不自动融合”。
- [ ] 特别回归 Gemini、千问、文心、Kimi、Claude；这些平台历史上改动较多。
- [ ] 验证设置页：Claude 自定义页面网址保存、恢复默认入口、英文/中文显示。
- [ ] 验证刷新、添加/关闭面板、临时对话（若启用）和提示词库不会破坏统一输入框焦点。

### 6. 自动化检查与打包

- [ ] 运行 `npm test`；失败项必须记录原因，不能仅因“本地能用”跳过。
- [ ] 运行 `git diff --check`。
- [ ] 运行 `npm run release:prepare:dry-run -- --version <维护者明确指定的下一版本> --changelog "..."`；只有明确决定发布新版本时才执行。
- [ ] 运行 `npm run release:package`，检查 ZIP 中包含 manifest 引用的文件，且不包含 `node_modules`、测试、日志、个人资料和内部规划文档。
- [ ] 在新的 Chrome 用户配置或干净 profile 中加载打包产物，完成一次基础发送与融合回归。

### 7. GitHub 发布步骤

- [ ] 创建公开仓库前再次检查 `git status --short` 与暂存区内容。
- [ ] 推送 `main` 后检查 GitHub 文件列表、README 渲染、LICENSE、PRIVACY 和 Releases 页面。
- [ ] 配置 GitHub Issues 标签：`bug`、`provider-compatibility`、`auto-merge`、`documentation`、`security`。
- [ ] 创建 Bug Report 模板，要求提交者填写浏览器版本、平台、是否在 iframe、多面板日志和复现步骤；禁止要求其提交 Cookie 或完整会话 URL。
- [ ] 首次 Release 附上 ZIP、版本说明、已知限制和回滚方式。
