// Settings loading and display functions extracted from options.js
import { getSettings, DEFAULT_SOURCE_URL_PLACEMENT, DEFAULT_MARKDOWN_EXPORT_PATH } from '../../modules/settings.js';
import { getClaudeCustomEntryUrl } from '../../modules/claude-entry-url.js';
import { getAllPrompts } from '../../modules/prompt-manager.js';
import { t } from '../../modules/i18n.js';
import { getCurrentBrowserLanguage } from '../options-helpers.js';
import { fitSelectWidth, refreshAutoSizedSelects } from './ui-helpers.js';
import { updateShortcutHelperVisibility } from './shortcut-helpers.js';
import { updateEnterBehaviorVisibility, updateCustomEnterSettingsVisibility, loadCustomEnterSettings } from './enter-key.js';

function formatClaudeEntryUrlForDisplay(url) {
  if (!url) return t('claudeEntryDefaultStatus');
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 16
      ? `${parsed.pathname.slice(0, 12)}…${parsed.pathname.slice(-4)}`
      : parsed.pathname;
    return t('claudeEntryCustomStatus', `${parsed.hostname}${path}`);
  } catch {
    return t('claudeEntryCustomStatus', 'Claude');
  }
}

function readBooleanSetting(value, defaultValue = false) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return defaultValue;
}

async function loadClaudeCustomEntryUrl() {
  const input = document.getElementById('claude-custom-entry-url');
  const status = document.getElementById('claude-entry-url-status');
  if (!input || !status) return;

  const value = await getClaudeCustomEntryUrl();
  input.value = value;
  status.textContent = formatClaudeEntryUrlForDisplay(value);
}

// T056: Load and display data statistics
async function loadDataStats() {
  try {
    const prompts = await getAllPrompts();

    document.getElementById('stat-prompts').textContent = prompts.length;

    // Estimate storage size
    const promptsSize = JSON.stringify(prompts).length;
    const sizeKB = Math.round(promptsSize / 1024);
    document.getElementById('stat-storage').textContent = `~${sizeKB} KB`;
  } catch (error) {
    // Silently handle data stats errors
    document.getElementById('stat-prompts').textContent = '0';
    document.getElementById('stat-storage').textContent = '0 KB';
  }
}

// Get user's preferred language for default library
async function getDefaultLibraryLanguage() {
  try {
    const settings = await getSettings();

    // Only Simplified Chinese gets Chinese prompts
    if (settings.language === 'zh_CN') {
      return 'zh_CN';
    }

    // All other languages (including zh_TW) fall back to English
    return 'en';
  } catch (error) {
    return 'en';
  }
}

// T051: Load and display current settings
async function loadSettings() {
  const settings = await getSettings();

  // Theme
  document.getElementById('theme-select').value = settings.theme || 'auto';

  // Language
  const currentLanguage = settings.language || getCurrentBrowserLanguage();
  document.getElementById('language-select').value = currentLanguage.startsWith('zh') ? 'zh_CN' : 'en';

  const keyboardShortcutEnabled = settings.keyboardShortcutEnabled !== false;
  const shortcutToggle = document.getElementById('keyboard-shortcut-toggle');
  if (shortcutToggle) {
    shortcutToggle.checked = keyboardShortcutEnabled;
  }
  updateShortcutHelperVisibility(keyboardShortcutEnabled);

  const debugAutoDownloadToggle = document.getElementById('debug-auto-download-logs-toggle');
  if (debugAutoDownloadToggle) {
    debugAutoDownloadToggle.checked = settings.debugAutoDownloadLogs === true;
  }

  // Source URL placement setting
  const sourceUrlPlacementSelect = document.getElementById('source-url-placement-select');
  if (sourceUrlPlacementSelect) {
    sourceUrlPlacementSelect.value = settings.sourceUrlPlacement || DEFAULT_SOURCE_URL_PLACEMENT;
  }

  // Open mode setting
  const openModeSelect = document.getElementById('open-mode-select');
  if (openModeSelect) {
    openModeSelect.value = settings.openMode || 'tab';
  }

  // Merge wait mode. Old values not represented by the new fixed options are
  // migrated to the closest available duration instead of leaving the select blank.
  const mergeTimeoutSelect = document.getElementById('merge-timeout-select');
  if (mergeTimeoutSelect) {
    const timeoutOptions = [30000, 60000, 90000, 120000, 180000, 240000, 300000];
    const requestedTimeout = Number(settings.mergeMaxWait) || 120000;
    const closestTimeout = timeoutOptions.reduce((closest, candidate) => (
      Math.abs(candidate - requestedTimeout) < Math.abs(closest - requestedTimeout)
        ? candidate
        : closest
    ), 120000);
    mergeTimeoutSelect.value = String(closestTimeout);
    fitSelectWidth(mergeTimeoutSelect);
  }

  // Enter key behavior settings
  const enterBehavior = settings.enterKeyBehavior || {
    enabled: true,
    preset: 'default',
    newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
    sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
  };

  const enterBehaviorToggle = document.getElementById('enter-behavior-toggle');
  if (enterBehaviorToggle) {
    enterBehaviorToggle.checked = enterBehavior.enabled;
    updateEnterBehaviorVisibility(enterBehavior.enabled);
  }

  const enterPresetSelect = document.getElementById('enter-preset-select');
  if (enterPresetSelect) {
    enterPresetSelect.value = enterBehavior.preset || 'default';
    updateCustomEnterSettingsVisibility(enterBehavior.preset);
  }

  // Load custom settings
  loadCustomEnterSettings(enterBehavior);
  await loadClaudeCustomEntryUrl();

  // Discussion mode settings
  const mergeModeSelect = document.getElementById('merge-mode-select');

  if (mergeModeSelect) {
    mergeModeSelect.value = settings.autoMergeEnabled === false ? 'manual' : (settings.mergeMode || 'merge');
  }

  // 控制"导出初始融合"的可见性
  const exportInitialMergeItem = document.getElementById('export-initial-merge-item');
  function updateExportInitialMergeVisibility() {
    if (!exportInitialMergeItem) return;
    const mode = mergeModeSelect?.value;
    exportInitialMergeItem.style.display = (mode === 'merge+discuss') ? '' : 'none';
  }
  mergeModeSelect?.addEventListener('change', updateExportInitialMergeVisibility);
  updateExportInitialMergeVisibility();

  // Markdown 导出设置
  const markdownExportPath = document.getElementById('markdown-export-path');
  const markdownExportMode = document.getElementById('markdown-export-mode');
  const exportInitialMergeSelect = document.getElementById('export-initial-merge-select');
  if (markdownExportPath) {
    markdownExportPath.value = settings.markdownExportPath || settings.obsidianVaultPath || DEFAULT_MARKDOWN_EXPORT_PATH;
  }
  if (markdownExportMode) {
    markdownExportMode.value = settings.markdownExportMode || settings.obsidianExportMode || 'auto';
  }
  if (exportInitialMergeSelect) {
    exportInitialMergeSelect.value = String(readBooleanSetting(settings.exportInitialMerge, false));
  }

  refreshAutoSizedSelects();
}

export {
  formatClaudeEntryUrlForDisplay,
  readBooleanSetting,
  loadClaudeCustomEntryUrl,
  loadDataStats,
  getDefaultLibraryLanguage,
  loadSettings
};
