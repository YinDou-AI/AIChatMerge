# AIChatMerge 选择器健康检查

## 两层架构

| 层 | 运行环境 | 能做什么 | 不能做什么 |
|----|----------|----------|------------|
| 本地 CDP | 你的电脑 + Chrome 运行中 | ✅ 真实登录态，精确检测每个选择器 | ❌ 电脑关了就跑不了 |
| GitHub Actions | 云端，每天自动 | ✅ 检测页面可达性、HTML 结构变化 | ❌ 无法登录，看不到聊天界面 |

**为什么本地 CDP 最准？** 它连接你正在运行的 Chrome，用你的真实会话打开新标签页测试。你看到什么 DOM，它就看到什么 DOM。没有反爬、没有无头浏览器差异。

## 一次性设置

### 1. 本地检测（精确）

```bash
# 双击启动带调试端口的 Chrome:
healthcheck\start-chrome.bat

# 然后测试:
cd healthcheck
node selector-healthcheck.js --baseline

# (可选) 设置 Windows 计划任务，每天自动检测:
healthcheck\setup-scheduled-task.bat   # 需要管理员权限
```

### 2. 云端检测（兜底）

```bash
git add .github/workflows/selector-healthcheck.yml healthcheck/
git commit -m "feat: selector health check"
git push
# 到 GitHub → Actions 确认 workflow 已启用
```

## 日常使用

| 场景 | 操作 |
|------|------|
| 自动检测 | Windows 计划任务每天 10:00 检测（Chrome 开着时）|
| 云端兜底 | GitHub Actions 每天 10:00 检测页面结构变化 |
| 手动检测 | `cd healthcheck && node selector-healthcheck.js` |
| 看报告 | `node selector-healthcheck.js --report` |
| 测单个 | `node selector-healthcheck.js --provider kimi` |
| 更新基线 | `node selector-healthcheck.js --baseline` |

## 启动 Chrome 的方式

日常使用只需把 Chrome 快捷方式改为：

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

这样每次打开 Chrome 都自带调试端口，健康检查随时可用。

## 检测内容

每个提供商检测 5 组选择器：
- `input` — 输入框
- `sendButton` — 发送按钮
- `answer` — 回答区域（聊天界面）
- `newChat` — 新建对话按钮
- `extractor` — answer-extractor-*.js 中的关键选择器

## 文件结构

```
healthcheck/
├── selector-healthcheck.js       # 主检测脚本 (CDP 连接 Chrome)
├── selector-healthcheck-cloud.js # 云端检测脚本 (GitHub Actions)
├── export-cookies.js             # Cookie 导出 (备用)
├── start-chrome.bat              # 启动 Chrome (带调试端口)
├── setup-scheduled-task.bat      # 设置 Windows 计划任务
├── data/
│   ├── baseline.json             # 本地基线
│   ├── baseline-cloud.json       # 云端基线
│   ├── report.json               # 最新报告
│   └── snapshots/                # HTML 快照
```
