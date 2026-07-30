#!/usr/bin/env node

// judge-debug-log.js — 巡检链路第③段：判定
// 读取扩展导出的 debug JSON，把其中的 verdict 原样落成 verdict.json，
// 并用退出码表达结论：0=ok 1=failed 2=unknown/无法判定。
// 本脚本不含任何分析逻辑：所有智能都在扩展侧的 debug-verdict.js 规则库里，
// 这样判定结果与运行它的环境（脚本/任意模型 agent）无关。

import fs from 'node:fs';
import path from 'node:path';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_UNKNOWN = 2;

function parseArgs(argv) {
  const args = { file: null, outDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out' && argv[index + 1]) {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (!args.file) {
      args.file = argv[index];
    }
  }
  return args;
}

function writeVerdict(outDir, verdict) {
  if (!outDir) return;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'verdict.json'), JSON.stringify(verdict, null, 2));
}

function emit(verdict, exitCode, outDir) {
  writeVerdict(outDir, verdict);
  console.log(`[judge] status=${verdict.status}` +
    (verdict.rootCause ? ` rootCause=${verdict.rootCause}` : '') +
    (verdict.failedStage ? ` stage=${verdict.failedStage}` : ''));
  if (verdict.meaning) console.log(`[judge] ${verdict.meaning}`);
  (verdict.suggestedChecks || []).forEach(check => console.log(`[judge]   → ${check}`));
  // 历史 bug 回归断言（扩展侧 verdict 计算，本脚本只搬运）：
  // 任何一条 fail 都意味着已修复的 bug 复发，整体判 failed
  const regressions = Array.isArray(verdict.regressions) ? verdict.regressions : [];
  regressions.forEach(item => {
    console.log(`[judge] regression ${item.id}: ${item.status} — ${item.detail}`);
  });
  const regressionFailed = regressions.some(item => item.status === 'fail');
  process.exit(regressionFailed ? EXIT_FAILED : exitCode);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node scripts/judge-debug-log.js <debug.json> [--out <dir>]');
    process.exit(EXIT_UNKNOWN);
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  } catch (error) {
    emit({ status: 'unknown', rootCause: 'debug-file-unreadable', meaning: error.message }, EXIT_UNKNOWN, args.outDir);
  }

  const verdict = payload?.verdict;
  if (!verdict || typeof verdict.status !== 'string') {
    // schemaVersion < 4 的旧报告没有 verdict：无法查表，交回人工/agent 分析
    emit({
      status: 'unknown',
      rootCause: 'verdict-missing',
      meaning: `该报告 schemaVersion=${payload?.schemaVersion ?? 'n/a'}，没有 verdict 块（旧格式或导出异常）`,
      suggestedChecks: ['用包含 debug-verdict.js 的扩展版本重新导出日志'],
      sourceFile: path.basename(args.file)
    }, EXIT_UNKNOWN, args.outDir);
  }

  const result = {
    ...verdict,
    sourceFile: path.basename(args.file),
    exportedAt: payload.exportedAt || null,
    extensionVersion: payload.version || null,
    judgedAt: new Date().toISOString()
  };

  if (verdict.status === 'ok') emit(result, EXIT_OK, args.outDir);
  if (verdict.status === 'failed') emit(result, EXIT_FAILED, args.outDir);
  emit(result, EXIT_UNKNOWN, args.outDir);
}

main();
