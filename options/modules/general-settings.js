/**
 * General settings: event binding for all settings categories.
 * Renamed from event-handlers.js for domain clarity.
 */

import { getSettings, saveSettings, saveSetting } from '../../modules/settings.js';
import {
  normalizeClaudeCustomEntryUrl,
  saveClaudeCustomEntryUrl
} from '../../modules/claude-entry-url.js';
import { applyTheme } from '../../modules/theme-manager.js';
import { exportScoreHistory, clearScoreHistory } from '../../modules/score-manager.js';
import { t, initializeLanguage, translatePage } from '../../modules/i18n.js';
import {
  getCurrentBrowserLanguage,
  getExtensionResourceUrl,
  getPromptGuidePath
} from '../options-helpers.js';
import { showStatus } from './ui-helpers.js';
import { updateShortcutHelperVisibility } from './shortcut-helpers.js';
import { updateEnterBehaviorVisibility, updateCustomEnterSettingsVisibility, applyEnterKeyPreset, saveCustomEnterSettings } from './enter-key.js';
import { exportData, importData, clearPrompts, resetSettingsOnly, importCustomLibraryHandler, importDefaultLibraryHandler } from './data-manager.js';
import { formatClaudeEntryUrlForDisplay } from './settings-loader.js';

export function setupEventListeners() {
  // Theme change
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) themeSelect.addEventListener('change', async (e) => {
    await saveSetting('theme', e.target.value);
    await applyTheme();
    showStatus('success', t('msgThemeUpdated'));
  });

  // Language change
  const languageSelect = document.getElementById('language-select');
  if (languageSelect) languageSelect.addEventListener('change', async (e) => {
    const newLanguage = e.target.value;
    await saveSetting('language', newLanguage);
    await initializeLanguage(newLanguage);
    translatePage();
    showStatus('success', t('msgLanguageUpdated'));
  });

  // Keyboard shortcut toggle
  const shortcutToggle = document.getElementById('keyboard-shortcut-toggle');
  if (shortcutToggle) {
    shortcutToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await saveSetting('keyboardShortcutEnabled', enabled);
      updateShortcutHelperVisibility(enabled);
      showStatus('success', enabled ? t('msgShortcutEnabled') : t('msgShortcutDisabled'));
    });
  }

  // Source URL placement change
  const sourceUrlPlacementSelect = document.getElementById('source-url-placement-select');
  if (sourceUrlPlacementSelect) {
    sourceUrlPlacementSelect.addEventListener('change', async (e) => {
      await saveSetting('sourceUrlPlacement', e.target.value);
      showStatus('success', t('msgSourceUrlPlacementUpdated'));
    });
  }

  const debugAutoDownloadToggle = document.getElementById('debug-auto-download-logs-toggle');
  if (debugAutoDownloadToggle) {
    debugAutoDownloadToggle.addEventListener('change', async (e) => {
      await saveSetting('debugAutoDownloadLogs', e.target.checked === true);
      showStatus('success', t('msgDebugAutoDownloadLogsUpdated'));
    });
  }

  // Export data
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportData);

  // Import data
  const importBtn = document.getElementById('import-btn');
  if (importBtn) importBtn.addEventListener('click', () => {
    const fileInput = document.getElementById('import-file');
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  });

  const importFile = document.getElementById('import-file');
  if (importFile) importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await importData(file);
    }
  });

  // Danger Zone - Clear buttons
  const clearPromptsBtn = document.getElementById('clear-prompts-btn');
  if (clearPromptsBtn) clearPromptsBtn.addEventListener('click', clearPrompts);
  const resetSettingsBtn = document.getElementById('reset-settings-btn');
  if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', resetSettingsOnly);

  // Score history export and clear buttons
  document.getElementById('export-score-history-btn')?.addEventListener('click', async () => {
    const button = document.getElementById('export-score-history-btn');
    try {
      if (button) button.disabled = true;
      const result = await exportScoreHistory();
      if (result.rowCount === 0) {
        alert(t('msgScoreExportEmpty'));
        return;
      }
      showStatus('success', t('msgScoreExported', result.rowCount.toString()));
    } catch (error) {
      console.error('Failed to export score history:', error);
      alert(t('msgScoreExportFailed', error.message || 'Unknown error'));
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.getElementById('clear-score-history-btn')?.addEventListener('click', async () => {
    if (!confirm(t('msgConfirmClearScoreHistory'))) {
      return;
    }
    const button = document.getElementById('clear-score-history-btn');
    try {
      if (button) button.disabled = true;
      await clearScoreHistory();
      showStatus('success', t('msgScoreHistoryCleared'));
    } catch (error) {
      console.error('Failed to clear score history:', error);
      showStatus('error', t('msgScoreClearFailed', error.message || 'Unknown error'));
    } finally {
      if (button) button.disabled = false;
    }
  });

  // Default library import button
  document.getElementById('import-default-library')?.addEventListener('click', importDefaultLibraryHandler);

  // Custom library import button
  document.getElementById('import-custom-library')?.addEventListener('click', () => {
    const fileInput = document.getElementById('import-custom-library-file');
    fileInput.value = '';
    fileInput.click();
  });

  document.getElementById('import-custom-library-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await importCustomLibraryHandler(file);
    }
  });

  // Custom prompt guide and template
  document.getElementById('open-custom-prompt-guide')?.addEventListener('click', async () => {
    const settings = await getSettings();
    const locale = settings.language || getCurrentBrowserLanguage();
    const guidePath = getPromptGuidePath(locale);
    const url = getExtensionResourceUrl(guidePath);
    window.open(url, '_blank', 'noopener');
  });

  document.getElementById('download-custom-prompt-template')?.addEventListener('click', () => {
    const url = getExtensionResourceUrl('data/prompt-libraries/custom-prompt-template.json');
    const link = document.createElement('a');
    link.href = url;
    link.download = 'custom-prompt-template.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  // Enter key behavior toggle
  const enterBehaviorToggle = document.getElementById('enter-behavior-toggle');
  if (enterBehaviorToggle) {
    enterBehaviorToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      const settings = await getSettings();
      const enterBehavior = settings.enterKeyBehavior || {};
      enterBehavior.enabled = enabled;
      await saveSetting('enterKeyBehavior', enterBehavior);
      updateEnterBehaviorVisibility(enabled);
      showStatus('success', enabled ? t('msgEnterCustomEnabled') : t('msgEnterCustomDisabled'));
    });
  }

  // Preset selection
  const enterPresetSelect = document.getElementById('enter-preset-select');
  if (enterPresetSelect) {
    enterPresetSelect.addEventListener('change', async (e) => {
      await applyEnterKeyPreset(e.target.value);
      updateCustomEnterSettingsVisibility(e.target.value);
    });
  }

  // Custom modifier checkboxes
  ['newline-shift', 'newline-ctrl', 'newline-alt', 'newline-meta',
   'send-shift', 'send-ctrl', 'send-alt', 'send-meta'].forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', saveCustomEnterSettings);
    }
  });

  // Multi-Panel: Open mode selection
  const openModeSelect = document.getElementById('open-mode-select');
  if (openModeSelect) {
    openModeSelect.addEventListener('change', async (e) => {
      await saveSetting('openMode', e.target.value);
      showStatus('success', t('msgOpenModeUpdated') || 'Open mode updated');
    });
  }

  // Multi-Panel: Merge timeout selection
  const mergeTimeoutSelect = document.getElementById('merge-timeout-select');
  if (mergeTimeoutSelect) {
    mergeTimeoutSelect.addEventListener('change', async (e) => {
      await saveSetting('mergeMaxWait', parseInt(e.target.value, 10));
      showStatus('success', t('msgMergeTimeoutUpdated') || 'Merge timeout updated');
    });
  }

  // Merge mode (discussion settings)
  const mergeModeSelect = document.getElementById('merge-mode-select');
  if (mergeModeSelect) {
    mergeModeSelect.addEventListener('change', async (e) => {
      const newMode = e.target.value;
      const manualMode = newMode === 'manual';
      await saveSettings({
        mergeMode: manualMode ? 'merge' : newMode,
        autoMergeEnabled: !manualMode
      });
      showStatus('success', t('msgMergeModeUpdated') || 'Merge mode updated');
    });
  }

  const claudeEntryInput = document.getElementById('claude-custom-entry-url');
  const claudeEntryStatus = document.getElementById('claude-entry-url-status');
  const saveClaudeEntryButton = document.getElementById('save-claude-entry-url');
  const resetClaudeEntryButton = document.getElementById('reset-claude-entry-url');
  const updateClaudeEntryValidation = () => {
    if (!claudeEntryInput || !claudeEntryStatus || !saveClaudeEntryButton) return;
    const normalized = normalizeClaudeCustomEntryUrl(claudeEntryInput.value);
    saveClaudeEntryButton.disabled = !normalized.valid;
    claudeEntryStatus.textContent = normalized.valid
      ? (claudeEntryInput.value.trim() ? t('claudeEntryUrlValid') : t('claudeEntryDefaultStatus'))
      : normalized.error;
    claudeEntryStatus.style.color = normalized.valid ? '' : '#dc2626';
  };

  if (claudeEntryInput) {
    claudeEntryInput.addEventListener('input', updateClaudeEntryValidation);
  }
  if (saveClaudeEntryButton) {
    saveClaudeEntryButton.addEventListener('click', async () => {
      const result = await saveClaudeCustomEntryUrl(claudeEntryInput?.value || '');
      if (!result.valid) {
        if (claudeEntryStatus) {
          claudeEntryStatus.textContent = result.error;
          claudeEntryStatus.style.color = '#dc2626';
        }
        return;
      }
      if (claudeEntryInput) claudeEntryInput.value = result.value;
      if (claudeEntryStatus) {
        claudeEntryStatus.textContent = formatClaudeEntryUrlForDisplay(result.value);
        claudeEntryStatus.style.color = '';
      }
      showStatus('success', t('claudeEntrySaved'));
    });
  }
  if (resetClaudeEntryButton) {
    resetClaudeEntryButton.addEventListener('click', async () => {
      const result = await saveClaudeCustomEntryUrl('');
      if (result.valid) {
        if (claudeEntryInput) claudeEntryInput.value = '';
        if (claudeEntryStatus) {
          claudeEntryStatus.textContent = formatClaudeEntryUrlForDisplay('');
          claudeEntryStatus.style.color = '';
        }
        showStatus('success', t('claudeEntryRestored'));
      }
    });
  }

  // Markdown export settings - save (sync storage)
  const markdownFields = [
    { id: 'markdown-export-path', key: 'markdownExportPath' },
    { id: 'markdown-export-mode', key: 'markdownExportMode' },
    { id: 'export-initial-merge-select', key: 'exportInitialMerge', type: 'boolean' }
  ];
  markdownFields.forEach(({ id, key, type }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async (e) => {
        const value = type === 'boolean' ? e.target.value === 'true' : e.target.value;
        await saveSetting(key, value);
      });
    }
  });
}
