// T050-T064: Settings Page Implementation
import { getSettings, saveSettings, saveSetting, resetSettings, exportSettings, importSettings, DEFAULT_SOURCE_URL_PLACEMENT, DEFAULT_MARKDOWN_EXPORT_PATH } from '../modules/settings.js';
import {
  getClaudeCustomEntryUrl,
  normalizeClaudeCustomEntryUrl,
  saveClaudeCustomEntryUrl
} from '../modules/claude-entry-url.js';
import { applyTheme } from '../modules/theme-manager.js';
import {
  getAllPrompts,
  exportPrompts,
  importPrompts,
  clearAllPrompts,
  importDefaultLibrary
} from '../modules/prompt-manager.js';
import { t, translatePage, initializeLanguage } from '../modules/i18n.js';
import {
  getCurrentBrowserLanguage,
  isEdgeBrowser,
  getExtensionResourceUrl,
  getPromptGuidePath,
  getDefaultLibraryPath,
  validatePromptStructure,
  getPromptStructureExample
} from './options-helpers.js';


function fitSelectWidth(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const text = selectedOption?.textContent || select.value || '';
  const sizingProbe = document.createElement('span');
  const computedStyle = window.getComputedStyle(select);

  sizingProbe.textContent = text;
  sizingProbe.style.position = 'absolute';
  sizingProbe.style.visibility = 'hidden';
  sizingProbe.style.whiteSpace = 'pre';
  sizingProbe.style.font = computedStyle.font;
  sizingProbe.style.fontSize = computedStyle.fontSize;
  sizingProbe.style.fontWeight = computedStyle.fontWeight;
  sizingProbe.style.letterSpacing = computedStyle.letterSpacing;

  document.body.appendChild(sizingProbe);
  const measuredWidth = Math.ceil(sizingProbe.getBoundingClientRect().width);
  sizingProbe.remove();

  const horizontalPadding = (parseFloat(computedStyle.paddingLeft) || 0) +
    (parseFloat(computedStyle.paddingRight) || 0);
  const horizontalBorder = (parseFloat(computedStyle.borderLeftWidth) || 0) +
    (parseFloat(computedStyle.borderRightWidth) || 0);
  const safetyAllowance = 8;

  select.style.width = `${Math.max(
    56,
    Math.ceil(measuredWidth + horizontalPadding + horizontalBorder + safetyAllowance)
  )}px`;
}

function setupAutoSizedSelect(select) {
  if (!(select instanceof HTMLSelectElement) || select.dataset.autoSizeBound === 'true') {
    fitSelectWidth(select);
    return;
  }

  select.dataset.autoSizeBound = 'true';
  select.addEventListener('change', () => {
    fitSelectWidth(select);
  });

  fitSelectWidth(select);
}

function refreshAutoSizedSelects(root = document) {
  root.querySelectorAll('select').forEach((select) => {
    setupAutoSizedSelect(select);
  });
}

function openShortcutSettings(browserOverride) {
  const isEdge = browserOverride === 'edge' || (browserOverride !== 'chrome' && isEdgeBrowser());
  const url = isEdge ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';

  try {
    chrome.tabs.create({ url });
  } catch (error) {
    // Fallback to window.open if chrome.tabs unavailable
    window.open(url, '_blank');
  }
}

function setupShortcutHelpers() {
  const openShortcutsBtn = document.getElementById('open-shortcuts-btn');
  if (openShortcutsBtn) {
    openShortcutsBtn.addEventListener('click', () => openShortcutSettings());
  }

  const edgeHelper = document.getElementById('edge-shortcut-helper');
  const edgeButton = document.getElementById('open-edge-shortcuts-btn');

  if (edgeHelper && edgeButton) {
    edgeButton.addEventListener('click', () => openShortcutSettings('edge'));
  }
}

function updateShortcutHelperVisibility(isEnabled) {
  const edgeHelper = document.getElementById('edge-shortcut-helper');
  if (!edgeHelper) return;

  if (isEdgeBrowser() && isEnabled) {
    edgeHelper.style.display = 'flex';
  } else {
    edgeHelper.style.display = 'none';
  }
}


// T050: Initialize settings page
async function init() {
  await applyTheme();  // Apply theme first
  await initializeLanguage();  // Initialize language from user settings
  translatePage();  // Translate all static text
  await loadSettings();
  await loadDataStats();
  setupEventListeners();
  setupShortcutHelpers();
  refreshAutoSizedSelects();
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
  const discussRoundsSelect = document.getElementById('discuss-rounds-select');
  const discussRoundsSetting = document.getElementById('discuss-rounds-setting');

  if (mergeModeSelect) {
    mergeModeSelect.value = settings.autoMergeEnabled === false ? 'manual' : (settings.mergeMode || 'merge');
    if (discussRoundsSetting) {
      discussRoundsSetting.style.display = mergeModeSelect.value === 'merge+discuss' ? 'flex' : 'none';
    }
  }

  if (discussRoundsSelect) {
    discussRoundsSelect.value = settings.discussRounds || 3;
  }

  // Markdown 导出设置
  const markdownExportPath = document.getElementById('markdown-export-path');
  const markdownExportMode = document.getElementById('markdown-export-mode');
  if (markdownExportPath) {
    markdownExportPath.value = settings.markdownExportPath || settings.obsidianVaultPath || DEFAULT_MARKDOWN_EXPORT_PATH;
  }
  if (markdownExportMode) {
    markdownExportMode.value = settings.markdownExportMode || settings.obsidianExportMode || 'auto';
  }

  refreshAutoSizedSelects();
}

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
    const settings = await chrome.storage.sync.get({ language: null });
    
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

// T057-T064: Setup event listeners
function setupEventListeners() {
  // Theme change
  document.getElementById('theme-select').addEventListener('change', async (e) => {
    await saveSetting('theme', e.target.value);
    await applyTheme();  // Re-apply theme immediately
    showStatus('success', t('msgThemeUpdated'));
  });

  // Language change
  document.getElementById('language-select').addEventListener('change', async (e) => {
    const newLanguage = e.target.value;
    await saveSetting('language', newLanguage);

    // Reload translations with new language
    await initializeLanguage(newLanguage);

    // Re-translate the entire page
    translatePage();

    // Show success message (now in the new language)
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

  // Export data
  document.getElementById('export-btn').addEventListener('click', exportData);

  // Import data
  document.getElementById('import-btn').addEventListener('click', () => {
    const fileInput = document.getElementById('import-file');
    fileInput.value = ''; // Reset file input before opening to allow re-importing same file
    fileInput.click();
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await importData(file);
    }
  });

  // Danger Zone - Clear buttons
  document.getElementById('clear-prompts-btn').addEventListener('click', clearPrompts);
  document.getElementById('reset-settings-btn').addEventListener('click', resetSettingsOnly);

  // Default library import button
  document.getElementById('import-default-library')?.addEventListener('click', importDefaultLibraryHandler);

  // Custom library import button
  document.getElementById('import-custom-library')?.addEventListener('click', () => {
    const fileInput = document.getElementById('import-custom-library-file');
    fileInput.value = ''; // Reset file input before opening to allow re-importing same file
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
      const discussRoundsSetting = document.getElementById('discuss-rounds-setting');
      if (discussRoundsSetting) {
        discussRoundsSetting.style.display = newMode === 'merge+discuss' ? 'flex' : 'none';
      }
      showStatus('success', t('msgMergeModeUpdated') || 'Merge mode updated');
    });
  }

  const discussRoundsSelect = document.getElementById('discuss-rounds-select');
  if (discussRoundsSelect) {
    discussRoundsSelect.addEventListener('change', async (e) => {
      const newRounds = parseInt(e.target.value, 10);
      await saveSetting('discussRounds', newRounds);
      showStatus('success', t('msgDiscussRoundsUpdated') || 'Discuss rounds updated');
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

  // Markdown 导出设置 - 保存（sync 存储）
  const markdownFields = [
    { id: 'markdown-export-path', key: 'markdownExportPath' },
    { id: 'markdown-export-mode', key: 'markdownExportMode' }
  ];
  markdownFields.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async (e) => {
        await saveSetting(key, e.target.value);
      });
    }
  });

}

// T057: Export all data
async function exportData() {
  try {
    // Export prompts
    const promptsData = await exportPrompts();

    // Export settings
    const settingsData = await exportSettings();

    // Combine into single export file
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      prompts: promptsData.prompts,
      settings: settingsData
    };

    // Create download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aichatmerge-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showStatus('success', t('msgDataExported'));
  } catch (error) {
    showStatus('error', t('msgDataExportFailed'));
  }
}

// T058-T062: Import data from file
async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version) {
      throw new Error('Invalid export file format');
    }

    // Confirm import
    const confirmMsg = t('msgImportConfirm', [
      new Date(data.exportDate).toLocaleString(),
      (data.prompts?.length || 0).toString()
    ]);

    if (!confirm(confirmMsg)) {
      return;
    }

    // Import prompts
    let promptImportSummary = null;
    if (data.prompts && Array.isArray(data.prompts)) {
      promptImportSummary = await importPrompts({ prompts: data.prompts }, 'skip');
    }

    // Import settings (but preserve current enabled providers)
    if (data.settings) {
      const currentSettings = await getSettings();
      const settingsToImport = {
        ...data.settings,
        enabledProviders: currentSettings.enabledProviders // Don't overwrite provider settings
      };
      await importSettings(settingsToImport);
    }

    await loadSettings();
    await loadDataStats();

    // Show success toast
    if (promptImportSummary && promptImportSummary.imported > 0) {
      showToast('success', 'msgDataImportedWithCount', [promptImportSummary.imported.toString()]);
    } else {
      showToast('success', 'msgDataImported');
    }
  } catch (error) {
    showStatus('error', t('msgDataImportFailed'));
  }
}

// Danger Zone: Clear Prompts
async function clearPrompts() {
  if (!confirm(t('msgConfirmClearPrompts'))) {
    return;
  }

  try {
    await clearAllPrompts();
    await loadDataStats();
    showStatus('success', t('msgPromptsCleared'));
  } catch (error) {
    showStatus('error', t('msgClearPromptsFailed'));
  }
}

// Danger Zone: Reset Settings
async function resetSettingsOnly() {
  if (!confirm(t('msgConfirmResetSettings'))) {
    return;
  }

  try {
    await resetSettings();
    await loadSettings();
    showStatus('success', t('msgSettingsReset'));
  } catch (error) {
    showStatus('error', t('msgResetSettingsFailed'));
  }
}

// Status message helpers
function showStatus(type, message) {
  const elementId = type === 'error' ? 'status-error' : 'status-success';
  const element = document.getElementById(elementId);

  element.textContent = message;
  element.classList.add('show');

  setTimeout(() => {
    element.classList.remove('show');
  }, 3000);
}

// Toast notification helper - lightweight, non-intrusive notifications
function showToast(type, messageKey, params = []) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Get translated message
  const message = t(messageKey, params);

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '•'}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}



// Import Custom Prompt Library
async function importCustomLibraryHandler(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Check if it's an array
    if (!Array.isArray(data)) {
      showStatus('error', t('msgInvalidPromptFormat'));
      alert(`${t('msgInvalidFormat')}\n\n${getPromptStructureExample()}`);
      return;
    }

    // Validate first prompt as a sample
    if (data.length > 0) {
      const errors = validatePromptStructure(data[0]);
      if (errors.length > 0) {
        const errorMsg = `${t('msgInvalidPromptStructure')}:\n\n${errors.join('\n')}\n\n${getPromptStructureExample()}`;
        showStatus('error', t('msgInvalidPromptStructure'));
        alert(errorMsg);
        return;
      }
    }

    // Validate all prompts
    const validationErrors = [];
    data.forEach((prompt, index) => {
      const errors = validatePromptStructure(prompt);
      if (errors.length > 0) {
        validationErrors.push(`Prompt #${index + 1}: ${errors.join(', ')}`);
      }
    });

    if (validationErrors.length > 0) {
      const errorMsg = t('errValidationErrors', validationErrors.length.toString()) + `:\n\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? '\n...' : ''}\n\n${getPromptStructureExample()}`;
      showStatus('error', t('errValidationErrors', validationErrors.length.toString()));
      alert(errorMsg);
      return;
    }

    // Wrap in expected format
    const libraryData = { prompts: data };

    // Import using the prompt manager
    const result = await importDefaultLibrary(libraryData);

    // Show results with toast notification
    if (result.imported > 0) {
      showToast('success', 'msgCustomPromptsImported', [result.imported.toString(), result.skipped.toString()]);
    } else {
      showToast('info', 'msgAllPromptsExist');
    }

    // Refresh stats
    await loadDataStats();

  } catch (error) {
    if (error instanceof SyntaxError) {
      showStatus('error', t('msgInvalidJSON'));
      alert(`${t('msgJSONParseError')}\n\n${getPromptStructureExample()}`);
    } else {
      showStatus('error', t('msgCustomImportFailed'));
      console.error('Import error:', error);
    }
  }
}

// Import Default Prompt Library
async function importDefaultLibraryHandler() {
  const button = document.getElementById('import-default-library');

  try {
    button.disabled = true;
    button.textContent = t('msgImporting');

    // Get user's language preference
    const language = await getDefaultLibraryLanguage();
    const libraryPath = getDefaultLibraryPath(language);

    // Fetch the default library data
    const response = await fetch(chrome.runtime.getURL(libraryPath));
    const promptsArray = await response.json();

    // Wrap array in expected format { prompts: [...] }
    const libraryData = Array.isArray(promptsArray)
      ? { prompts: promptsArray }
      : promptsArray;

    // Import using the prompt manager
    const result = await importDefaultLibrary(libraryData);

    // Update UI
    if (result.imported > 0) {
      button.textContent = t('msgImported');
      button.style.background = '#4caf50';
      button.style.color = 'white';
      showToast('success', 'msgDefaultPromptsImported', [result.imported.toString(), result.skipped.toString()]);
    } else {
      button.textContent = t('msgAlreadyImported');
      button.disabled = true;
      showToast('info', 'msgAllPromptsExist');
    }

    // Refresh stats
    await loadDataStats();

  } catch (error) {
    showStatus('error', t('msgDefaultImportFailed'));
    button.disabled = false;
    button.textContent = t('btnImportDefault');
  }
}

// Enter Key Behavior Helper Functions
function updateEnterBehaviorVisibility(enabled) {
  const settingsDiv = document.getElementById('enter-behavior-settings');
  if (settingsDiv) {
    settingsDiv.style.display = enabled ? 'block' : 'none';
  }
}

function updateCustomEnterSettingsVisibility(preset) {
  const customDiv = document.getElementById('custom-enter-settings');
  if (customDiv) {
    customDiv.style.display = preset === 'custom' ? 'block' : 'none';
  }
}

function loadCustomEnterSettings(enterBehavior) {
  // Load newline modifiers
  document.getElementById('newline-shift').checked = enterBehavior.newlineModifiers.shift || false;
  document.getElementById('newline-ctrl').checked = enterBehavior.newlineModifiers.ctrl || false;
  document.getElementById('newline-alt').checked = enterBehavior.newlineModifiers.alt || false;
  document.getElementById('newline-meta').checked = enterBehavior.newlineModifiers.meta || false;

  // Load send modifiers
  document.getElementById('send-shift').checked = enterBehavior.sendModifiers.shift || false;
  document.getElementById('send-ctrl').checked = enterBehavior.sendModifiers.ctrl || false;
  document.getElementById('send-alt').checked = enterBehavior.sendModifiers.alt || false;
  document.getElementById('send-meta').checked = enterBehavior.sendModifiers.meta || false;
}

async function applyEnterKeyPreset(preset) {
  const settings = await getSettings();
  const enterBehavior = settings.enterKeyBehavior || {};

  enterBehavior.preset = preset;

  // Define preset configurations
  const presets = {
    default: {
      newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
      sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
    },
    swapped: {
      newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
      sendModifiers: { shift: true, ctrl: false, alt: false, meta: false }
    },
    slack: {
      newlineModifiers: { shift: false, ctrl: true, alt: false, meta: false },
      sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
    },
    discord: {
      newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
      sendModifiers: { shift: false, ctrl: true, alt: false, meta: false }
    }
  };

  if (preset !== 'custom' && presets[preset]) {
    enterBehavior.newlineModifiers = presets[preset].newlineModifiers;
    enterBehavior.sendModifiers = presets[preset].sendModifiers;
    loadCustomEnterSettings(enterBehavior);
  }

  await saveSetting('enterKeyBehavior', enterBehavior);
  showStatus('success', t('msgPresetChanged', preset));
}

async function saveCustomEnterSettings() {
  const settings = await getSettings();
  const enterBehavior = settings.enterKeyBehavior || {};

  enterBehavior.preset = 'custom';
  enterBehavior.newlineModifiers = {
    shift: document.getElementById('newline-shift').checked,
    ctrl: document.getElementById('newline-ctrl').checked,
    alt: document.getElementById('newline-alt').checked,
    meta: document.getElementById('newline-meta').checked
  };
  enterBehavior.sendModifiers = {
    shift: document.getElementById('send-shift').checked,
    ctrl: document.getElementById('send-ctrl').checked,
    alt: document.getElementById('send-alt').checked,
    meta: document.getElementById('send-meta').checked
  };

  await saveSetting('enterKeyBehavior', enterBehavior);

  // Update preset dropdown to show custom
  const presetSelect = document.getElementById('enter-preset-select');
  if (presetSelect) {
    presetSelect.value = 'custom';
  }

  showStatus('success', t('msgCustomKeyMappingSaved'));
}

// Initialize on load
init();
