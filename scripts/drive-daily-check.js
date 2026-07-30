#!/usr/bin/env node

// drive-daily-check.js — 巡检链路第①段：驱动
// 用系统默认 Chrome 打开带 #selftest 指令的面板 URL，面板内的
// self-test-driver.js 会自动完成"填写 → 发送 → 导出 debug 日志"，
// 本脚本只负责：打开面板 → 等下载目录出现新的 debug JSON（同时收集
// 可能新导出的 md）→ 复制到运行目录 → 调用第③段 judge-debug-log.js
// 并透传退出码。
//
// 为什么不用 WebBridge/Playwright 驱动面板：浏览器扩展无法访问其他扩展的
// chrome-extension:// 页面（Chrome 安全限制），而品牌版 Chrome 137+ 又忽略
// --load-extension，所以"驱动"做进了扩展面板内部，外部只需打开一个 URL。
//
// 用法：
//   node scripts/drive-daily-check.js [--prompt "问题"] [--run-dir 目录]
//        [--send-delay 毫秒] [--export-delay 毫秒] [--timeout 毫秒]
//        [--download-dir 目录] [--extension-id id] [--chrome-path 路径]
//
// 前置条件：系统 Chrome 里加载了本目录的扩展，且各 provider 已登录。

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PROMPT = '用一句话回答：1+1等于几？';
const DEFAULT_SEND_DELAY_MS = 20000;   // 面板等 provider iframe 加载后再发送
const DEFAULT_EXPORT_DELAY_MS = 30000; // 发送后等回答/注入结果落定再导出
const DEFAULT_TIMEOUT_MS = 150000;     // 等 debug 导出文件出现的总预算

function parseArgs(argv) {
  const args = {
    prompt: DEFAULT_PROMPT,
    runDir: null,
    sendDelay: DEFAULT_SEND_DELAY_MS,
    exportDelay: DEFAULT_EXPORT_DELAY_MS,
    timeout: DEFAULT_TIMEOUT_MS,
    downloadDir: null,
    extensionId: null,
    chromePath: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1];
    if (argv[index] === '--prompt' && value) { args.prompt = value; index += 1; }
    else if (argv[index] === '--run-dir' && value) { args.runDir = value; index += 1; }
    else if (argv[index] === '--send-delay' && value) { args.sendDelay = Number(value); index += 1; }
    else if (argv[index] === '--export-delay' && value) { args.exportDelay = Number(value); index += 1; }
    else if (argv[index] === '--timeout' && value) { args.timeout = Number(value); index += 1; }
    else if (argv[index] === '--download-dir' && value) { args.downloadDir = value; index += 1; }
    else if (argv[index] === '--extension-id' && value) { args.extensionId = value; index += 1; }
    else if (argv[index] === '--chrome-path' && value) { args.chromePath = value; index += 1; }
  }
  if (!args.runDir) {
    args.runDir = path.join('runs', new Date().toISOString().slice(0, 10));
  }
  return args;
}

function safeReadDir(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

// 从本机 Chrome profile 里找"加载路径就是当前项目目录"的扩展 id
function detectExtensionId() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
  const cwd = process.cwd().replace(/\//g, '\\').toLowerCase();
  for (const profile of safeReadDir(base).filter(name => /^(Default|Profile)/.test(name))) {
    try {
      const prefs = JSON.parse(fs.readFileSync(path.join(base, profile, 'Secure Preferences'), 'utf8'));
      for (const [id, ext] of Object.entries(prefs.extensions?.settings || {})) {
        const extPath = (ext.path || '').replace(/\//g, '\\').toLowerCase();
        if (extPath && extPath === cwd) return id;
      }
    } catch { /* 跳过不可读的 profile */ }
  }
  return null;
}

function detectDownloadDir() {
  const prefsPath = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'Preferences');
  try {
    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    return prefs.download?.default_directory || prefs.savefile?.default_directory || null;
  } catch {
    return null;
  }
}

function detectChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function waitForNewFile(dir, prefix, knownFiles, timeoutMs, startedAt = Date.now()) {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const match = safeReadDir(dir)
        .filter(name => name.startsWith(prefix) && !name.endsWith('.crdownload') && !knownFiles.has(name))
        .sort()
        .pop() || null;
      if (match) {
        clearInterval(timer);
        resolve(path.join(dir, match));
      } else if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        resolve(null);
      }
    }, 1000);
  });
}

function openPanelInChrome(chromePath, panelUrl) {
  if (chromePath) {
    spawn(chromePath, [panelUrl], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  // 找不到 Chrome 就交给系统默认浏览器
  spawn('cmd', ['/c', 'start', '""', panelUrl], { detached: true, stdio: 'ignore' }).unref();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = path.resolve(args.runDir);
  fs.mkdirSync(runDir, { recursive: true });

  const intent = {
    id: `daily-check-${Date.now()}`,
    expect: 'send-success',
    prompt: args.prompt,
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(runDir, 'intent.json'), JSON.stringify(intent, null, 2));

  const extensionId = args.extensionId || detectExtensionId();
  if (!extensionId) {
    throw new Error('找不到本目录对应的扩展 id，请用 --extension-id 显式指定（chrome://extensions 里查看）');
  }
  const downloadDir = args.downloadDir || detectDownloadDir();
  if (!downloadDir) {
    throw new Error('无法确定浏览器下载目录，请用 --download-dir 显式指定');
  }
  console.log(`[drive] extension id: ${extensionId}, download dir: ${downloadDir}`);

  const hash = new URLSearchParams({
    selftest: '1',
    prompt: args.prompt,
    sendDelay: String(args.sendDelay),
    exportDelay: String(args.exportDelay)
  }).toString();
  const panelUrl = `chrome-extension://${extensionId}/aichatmerge-panel/multi-panel.html#${hash}`;

  const knownDownloads = new Set(safeReadDir(downloadDir));
  openPanelInChrome(args.chromePath || detectChromePath(), panelUrl);
  console.log('[drive] panel opened with selftest directive, waiting for debug export...');

  const debugFile = await waitForNewFile(downloadDir, 'aichatmerge-debug-', knownDownloads, args.timeout);
  if (!debugFile) {
    fs.writeFileSync(path.join(runDir, 'verdict.json'), JSON.stringify({
      status: 'unknown',
      rootCause: 'no-debug-export',
      meaning: '等待超时，扩展没有导出任何 debug 报告',
      suggestedChecks: [
        '确认面板是否成功打开（URL 里应带 #selftest=1）',
        '确认扩展已重新加载到包含 self-test-driver.js 的版本',
        '确认下载目录设置正确、扩展有 downloads 权限'
      ],
      judgedAt: new Date().toISOString()
    }, null, 2));
    console.error('[drive] no debug export produced');
    process.exit(2);
  }

  const localDebugFile = path.join(runDir, path.basename(debugFile));
  fs.copyFileSync(debugFile, localDebugFile);
  console.log(`[drive] debug export: ${localDebugFile}`);

  // 顺手收集本次新导出的 md（若流程触发了 markdown 导出）
  const mdName = safeReadDir(downloadDir).find(name => name.endsWith('.md') && !knownDownloads.has(name));
  if (mdName) {
    fs.copyFileSync(path.join(downloadDir, mdName), path.join(runDir, mdName));
    console.log(`[drive] markdown export: ${path.join(runDir, mdName)}`);
  }

  const judge = spawnSync(process.execPath, [
    path.join('scripts', 'judge-debug-log.js'),
    localDebugFile,
    '--out', runDir
  ], { stdio: 'inherit' });
  // 透传判定结果：0=ok 1=failed 2=unknown
  process.exit(judge.status ?? 2);
}

main().catch(error => {
  console.error(`[drive] ${error.message}`);
  process.exit(2);
});
