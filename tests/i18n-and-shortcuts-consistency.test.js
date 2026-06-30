import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readText(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

describe('i18n and shortcut consistency', () => {
  const zh = readJson('_locales/zh_CN/messages.json');
  const en = readJson('_locales/en/messages.json');

  it('uses locale keys that exist for keyboard and prompt-library status messages', () => {
    const optionsSource = readText('options/options.js');

    expect(optionsSource).not.toContain('msgCustomMappingSaved');
    expect(optionsSource).not.toContain('msgValidationErrors');
    expect(optionsSource).toContain("t('msgCustomKeyMappingSaved')");
    expect(optionsSource).toContain("t('errValidationErrors'");

    for (const locale of [zh, en]) {
      expect(locale.msgCustomKeyMappingSaved?.message).toBeTruthy();
      expect(locale.errValidationErrors?.message).toContain('$COUNT$');
    }
  });

  it('shows imported and skipped counts for custom and default prompt imports', () => {
    for (const locale of [zh, en]) {
      expect(locale.msgCustomPromptsImported?.message).toContain('$IMPORTED$');
      expect(locale.msgCustomPromptsImported?.message).toContain('$SKIPPED$');
      expect(locale.msgCustomPromptsImported?.placeholders?.imported?.content).toBe('$1');
      expect(locale.msgCustomPromptsImported?.placeholders?.skipped?.content).toBe('$2');

      expect(locale.msgDefaultPromptsImported?.message).toContain('$IMPORTED$');
      expect(locale.msgDefaultPromptsImported?.message).toContain('$SKIPPED$');
      expect(locale.msgDefaultPromptsImported?.placeholders?.imported?.content).toBe('$1');
      expect(locale.msgDefaultPromptsImported?.placeholders?.skipped?.content).toBe('$2');
    }
  });

  it('keeps toolbar action independent from the keyboard-shortcut toggle', () => {
    const serviceWorkerSource = readText('background/service-worker.js');
    const actionStart = serviceWorkerSource.indexOf('chrome.action.onClicked.addListener');
    const actionListenerSource = serviceWorkerSource.slice(
      actionStart,
      serviceWorkerSource.indexOf('chrome.storage.onChanged.addListener', actionStart)
    );

    expect(actionListenerSource).toContain('await openMultiPanel();');
    expect(actionListenerSource).not.toContain('keyboardShortcutEnabled');
  });

  it('does not keep undeclared toggle-focus command dead code', () => {
    const manifest = readJson('manifest.json');
    const serviceWorkerSource = readText('background/service-worker.js');

    expect(manifest.commands).not.toHaveProperty('toggle-focus');
    expect(serviceWorkerSource).not.toContain("command === 'toggle-focus'");
  });

  it('internationalizes the default browser action command description', () => {
    const manifest = readJson('manifest.json');

    expect(manifest.commands._execute_action.description).toBe('__MSG_commandOpenAIChatMerge__');
    expect(zh.commandOpenAIChatMerge?.message).toBeTruthy();
    expect(en.commandOpenAIChatMerge?.message).toBeTruthy();
  });

  it('uses a shared default for source URL placement', () => {
    const settingsSource = readText('modules/settings.js');
    const optionsSource = readText('options/options.js');
    const serviceWorkerSource = readText('background/service-worker.js');

    expect(settingsSource).toContain("export const DEFAULT_SOURCE_URL_PLACEMENT = 'none';");
    expect(optionsSource).toContain('DEFAULT_SOURCE_URL_PLACEMENT');
    expect(serviceWorkerSource).toContain('DEFAULT_SOURCE_URL_PLACEMENT');
    expect(optionsSource).not.toContain("sourceUrlPlacement || 'none'");
    expect(serviceWorkerSource).not.toContain("sourceUrlPlacement: 'none'");
  });
});
