import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// 正式版打包隔离约定：
// 1. build-flags.js 必须保持两个 `= true` 的精确写法，
//    scripts/package-release.js 依赖它做 staging 替换，格式变了会拒绝打包。
// 2. 正式包使用空日志实现，content script 也必须在 staging 中重新构建。
const readSource = (relativePath) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('build flags release isolation', () => {
  it('keeps the exact replaceable flag pattern for package-release', () => {
    const source = readSource('aichatmerge-panel/modules/build-flags.js');
    expect(source).toContain('export const DEBUG_LOGGING_ENABLED = true;');
    expect(source).toContain('export const DEBUG_EXPORT_ENABLED = true;');
  });

  it('gates the panel debug log button on DEBUG_EXPORT_ENABLED', () => {
    const source = readSource('aichatmerge-panel/modules/panel-ui-bindings.js');
    expect(source).toContain('DEBUG_EXPORT_ENABLED');
  });

  it('gates the self-test driver on DEBUG_EXPORT_ENABLED', () => {
    const source = readSource('aichatmerge-panel/multi-panel.js');
    expect(source).toContain('if (DEBUG_EXPORT_ENABLED)');
  });

  it('gates auto debug log download on DEBUG_EXPORT_ENABLED', () => {
    const source = readSource('aichatmerge-panel/modules/debug-log.js');
    expect(source).toContain('if (!DEBUG_EXPORT_ENABLED) return false;');
  });

  it('gates debug persistence before accessing chrome storage', () => {
    const source = readSource('aichatmerge-panel/modules/debug-log.js');
    const functionStart = source.indexOf('export async function recordDebugLog');
    const storageGuard = source.indexOf("typeof chrome === 'undefined'", functionStart);
    const releaseGuard = source.indexOf('if (!DEBUG_LOGGING_ENABLED) return;', functionStart);

    expect(releaseGuard).toBeGreaterThan(functionStart);
    expect(releaseGuard).toBeLessThan(storageGuard);
  });

  it('package-release replaces both panel flags and the content-script flag', () => {
    const source = readSource('scripts/package-release.js');
    expect(source).toContain("'export const DEBUG_LOGGING_ENABLED = true;'");
    expect(source).toContain("'export const DEBUG_LOGGING_ENABLED = false;'");
    expect(source).toContain("'export const DEBUG_EXPORT_ENABLED = true;'");
    expect(source).toContain("'export const DEBUG_EXPORT_ENABLED = false;'");
    expect(source).toContain("'export const ENABLE_CONTENT_SCRIPT_DIAGNOSTICS = true;'");
    expect(source).toContain("'export const ENABLE_CONTENT_SCRIPT_DIAGNOSTICS = false;'");
  });

  it('package-release installs the no-op facade and rebuilds the formal content bundle', () => {
    const source = readSource('scripts/package-release.js');
    expect(source).toContain("'debug-log.release.js'");
    expect(source).toContain("'text-injection-entry.js'");
    expect(source).toContain("'--minify-syntax'");
    expect(source).toContain('assertFormalReleaseStaging(stagingDir)');
    expect(source).toContain("'INJECT_TEXT_RESULT'");
    expect(source).toContain("'INJECTION_DIAGNOSTIC'");
  });

  it('keeps self-test behind a dynamic debug-only import', () => {
    const source = readSource('aichatmerge-panel/multi-panel.js');
    expect(source).not.toContain("import { maybeRunSelfTest } from './modules/self-test-driver.js'");
    expect(source).toContain("await import('./modules/self-test-driver.js')");
  });

  it('marks panel and options debug controls for physical release removal', () => {
    const panelHtml = readSource('aichatmerge-panel/multi-panel.html');
    const optionsHtml = readSource('options/options.html');
    const packageSource = readSource('scripts/package-release.js');

    expect(panelHtml).toContain('<!-- DEBUG_ONLY_START -->');
    expect(panelHtml).toContain('debug-log-btn');
    expect(optionsHtml).toContain('<!-- DEBUG_ONLY_START -->');
    expect(optionsHtml).toContain('debug-auto-download-logs-toggle');
    expect(packageSource).toContain('DEBUG_ONLY_START');
    expect(packageSource).toContain("'debug-log-btn'");
    expect(packageSource).toContain("'debug-auto-download-logs-toggle'");
  });
});
