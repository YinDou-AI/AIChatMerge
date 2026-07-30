# options.js 重构计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 options.js（929行）拆分为5个独立模块，每个≤300行，职责单一。

**架构：** 按功能领域拆分，每个模块对应一组明确的功能。

**技术栈：** JavaScript（原生DOM操作），Chrome Extension Manifest V3

---

## 文件结构

```
options/
  options.js              # 主入口（保留，调用各模块）
  options-helpers.js      # 已有工具函数（不动）
  modules/
    ui-helpers.js         # UI工具、状态/toast
    settings-loader.js    # 设置加载、Claude URL、数据统计
    event-handlers.js     # 事件监听绑定
    data-manager.js       # 数据导出/导入、库导入
    enter-key.js          # 回车键行为
```

---

### 任务1：创建 ui-helpers.js

**文件：**
- 创建：`options/modules/ui-helpers.js`
- 修改：`options/options.js`

- [ ] **步骤1：提取UI工具函数**

```javascript
// options/modules/ui-helpers.js

export function fitSelectWidth(select) {
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

export function setupAutoSizedSelect(select) {
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

export function refreshAutoSizedSelects(root = document) {
  root.querySelectorAll('select').forEach((select) => {
    setupAutoSizedSelect(select);
  });
}

export function showStatus(type, message) {
  const elementId = type === 'error' ? 'status-error' : 'status-success';
  const element = document.getElementById(elementId);

  element.textContent = message;
  element.classList.add('show');

  setTimeout(() => {
    element.classList.remove('show');
  }, 3000);
}

export function showToast(type, messageKey, params = []) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const { t } = await import('../modules/i18n.js');
  const message = t(messageKey, params);

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

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

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
```

- [ ] **步骤2：从options.js中删除这些函数**

删除以下函数：
- fitSelectWidth（行29-62）
- setupAutoSizedSelect（行64-76）
- refreshAutoSizedSelects（行78-82）
- showStatus（行672-682）
- showToast（行685-717）

- [ ] **步骤3：在options.js顶部添加导入**

```javascript
import { fitSelectWidth, setupAutoSizedSelect, refreshAutoSizedSelects, showStatus, showToast } from './modules/ui-helpers.js';
```

- [ ] **步骤4：测试功能正常**

运行：在Chrome中打开扩展选项页面，验证：
- 下拉框自适应宽度正常
- 保存设置后状态提示正常显示
- Toast通知正常显示

- [ ] **步骤5：Commit**

```bash
git add options/modules/ui-helpers.js options/options.js
git commit -m "refactor: extract UI helpers from options.js"
```

---

### 任务2：创建 settings-loader.js

**文件：**
- 创建：`options/modules/settings-loader.js`
- 修改：`options/options.js`

- [ ] **步骤1：创建settings-loader.js**

```javascript
// options/modules/settings-loader.js

import { getSettings } from '../modules/settings.js';
import { getClaudeCustomEntryUrl } from '../modules/claude-entry-url.js';
import { getAllPrompts } from '../modules/prompt-manager.js';
import { t } from '../modules/i18n.js';
import { getCurrentBrowserLanguage } from '../options-helpers.js';
import { fitSelectWidth } from './ui-helpers.js';

export function formatClaudeEntryUrlForDisplay(url) {
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

export function readBooleanSetting(value, defaultValue = false) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return defaultValue;
}

export async function loadClaudeCustomEntryUrl() {
  const input = document.getElementById('claude-custom-entry-url');
  const status = document.getElementById('claude-entry-url-status');
  if (!input || !status) return;

  const value = await getClaudeCustomEntryUrl();
  input.value = value;
  status.textContent = formatClaudeEntryUrlForDisplay(value);
}

export async function loadDataStats() {
  try {
    const prompts = await getAllPrompts();

    document.getElementById('stat-prompts').textContent = prompts.length;

    const promptsSize = JSON.stringify(prompts).length;
    const sizeKB = Math.round(promptsSize / 1024);
    document.getElementById('stat-storage').textContent = `~${sizeKB} KB`;
  } catch (error) {
    document.getElementById('stat-prompts').textContent = '0';
    document.getElementById('stat-storage').textContent = '0 KB';
  }
}

export async function getDefaultLibraryLanguage() {
  try {
    const settings = await chrome.storage.sync.get({ language: null });
    
    if (settings.language === 'zh_CN') {
      return 'zh_CN';
    }
    
    return 'en';
  } catch (error) {
    return 'en';
  }
}

export async function loadSettings() {
  const settings = await getSettings();

  document.getElementById('theme-select').value = settings.theme || 'auto';

  const currentLanguage = settings.language || getCurrentBrowserLanguage();
  document.getElementById('language-select').value = currentLanguage.startsWith('zh') ? 'zh_CN' : 'en';

  const keyboardShortcutEnabled = settings.keyboardShortcutEnabled !== false;
  const shortcutToggle = document.getElementById('keyboard-shortcut-toggle');
  if (shortcutToggle) {
    shortcutToggle.checked = keyboardShortcutEnabled;
  }

  const sourceUrlPlacementSelect = document.getElementById('source-url-placement-select');
  if (sourceUrlPlacementSelect) {
    sourceUrlPlacementSelect.value = settings.sourceUrlPlacement || 'default';
  }

  const openModeSelect = document.getElementById('open-mode-select');
  if (openModeSelect) {
    openModeSelect.value = settings.openMode || 'tab';
  }

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

  const enterBehavior = settings.enterKeyBehavior || {
    enabled: true,
    preset: 'default',
    newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
    sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
  };

  const enterBehaviorToggle = document.getElementById('enter-behavior-toggle');
  if (enterBehaviorToggle) {
    enterBehaviorToggle.checked = enterBehavior.enabled;
  }

  const enterPresetSelect = document.getElementById('enter-preset-select');
  if (enterPresetSelect) {
    enterPresetSelect.value = enterBehavior.preset || 'default';
  }

  await loadClaudeCustomEntryUrl();

  const mergeModeSelect = document.getElementById('merge-mode-select');
  if (mergeModeSelect) {
    mergeModeSelect.value = settings.autoMergeEnabled === false ? 'manual' : (settings.mergeMode || 'merge');
  }

  const markdownExportPath = document.getElementById('markdown-export-path');
  const markdownExportMode = document.getElementById('markdown-export-mode');
  const exportInitialMergeSelect = document.getElementById('export-initial-merge-select');
  if (markdownExportPath) {
    markdownExportPath.value = settings.markdownExportPath || settings.obsidianVaultPath || '';
  }
  if (markdownExportMode) {
    markdownExportMode.value = settings.markdownExportMode || settings.obsidianExportMode || 'auto';
  }
  if (exportInitialMergeSelect) {
    exportInitialMergeSelect.value = String(readBooleanSetting(settings.exportInitialMerge, false));
  }

  refreshAutoSizedSelects();
}
```

- [ ] **步骤2：从options.js中删除这些函数**

删除以下函数：
- formatClaudeEntryUrlForDisplay（行236-247）
- readBooleanSetting（行249-253）
- loadClaudeCustomEntryUrl（行255-263）
- loadDataStats（行266-281）
- getDefaultLibraryLanguage（行284-298）
- loadSettings（行135-234）

- [ ] **步骤3：在options.js顶部添加导入**

```javascript
import { loadSettings, loadDataStats, formatClaudeEntryUrlForDisplay } from './modules/settings-loader.js';
```

- [ ] **步骤4：测试功能正常**

运行：在Chrome中打开扩展选项页面，验证：
- 设置正确加载
- 数据统计正确显示
- Claude入口URL状态正确显示

- [ ] **步骤5：Commit**

```bash
git add options/modules/settings-loader.js options/options.js
git commit -m "refactor: extract settings loader from options.js"
```

---

### 任务3：创建 event-handlers.js

**文件：**
- 创建：`options/modules/event-handlers.js`
- 修改：`options/options.js`

- [ ] **步骤1：创建event-handlers.js**

```javascript
// options/modules/event-handlers.js

import { saveSetting, saveSettings, getSettings } from '../modules/settings.js';
import { applyTheme } from '../modules/theme-manager.js';
import { initializeLanguage, translatePage, t } from '../modules/i18n.js';
import { showStatus } from './ui-helpers.js';
import { loadSettings, loadDataStats } from './settings-loader.js';
import { exportData, importData } from './data-manager.js';
import { clearPrompts, resetSettingsOnly } from './data-manager.js';
import { exportScoreHistory, clearScoreHistory } from '../modules/score-manager.js';
import { openShortcutSettings, updateShortcutHelperVisibility } from './shortcut-helpers.js';
import { applyEnterKeyPreset, updateCustomEnterSettingsVisibility, saveCustomEnterSettings } from './enter-key.js';
import { normalizeClaudeCustomEntryUrl, saveClaudeCustomEntryUrl } from '../modules/claude-entry-url.js';
import { formatClaudeEntryUrlForDisplay } from './settings-loader.js';
import { importDefaultLibraryHandler, importCustomLibraryHandler } from './data-manager.js';
import { getPromptGuidePath, getDefaultLibraryPath, getExtensionResourceUrl } from '../options-helpers.js';
import { getCurrentBrowserLanguage } from '../options-helpers.js';

export function setupEventListeners() {
  document.getElementById('theme-select').addEventListener('change', async (e) => {
    await saveSetting('theme', e.target.value);
    await applyTheme();
    showStatus('success', t('msgThemeUpdated'));
  });

  document.getElementById('language-select').addEventListener('change', async (e) => {
    const newLanguage = e.target.value;
    await saveSetting('language', newLanguage);
    await initializeLanguage(newLanguage);
    translatePage();
    showStatus('success', t('msgLanguageUpdated'));
  });

  const shortcutToggle = document.getElementById('keyboard-shortcut-toggle');
  if (shortcutToggle) {
    shortcutToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await saveSetting('keyboardShortcutEnabled', enabled);
      updateShortcutHelperVisibility(enabled);
      showStatus('success', enabled ? t('msgShortcutEnabled') : t('msgShortcutDisabled'));
    });
  }

  const sourceUrlPlacementSelect = document.getElementById('source-url-placement-select');
  if (sourceUrlPlacementSelect) {
    sourceUrlPlacementSelect.addEventListener('change', async (e) => {
      await saveSetting('sourceUrlPlacement', e.target.value);
      showStatus('success', t('msgSourceUrlPlacementUpdated'));
    });
  }

  document.getElementById('export-btn').addEventListener('click', exportData);

  document.getElementById('import-btn').addEventListener('click', () => {
    const fileInput = document.getElementById('import-file');
    fileInput.value = '';
    fileInput.click();
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await importData(file);
    }
  });

  document.getElementById('clear-prompts-btn').addEventListener('click', clearPrompts);
  document.getElementById('reset-settings-btn').addEventListener('click', resetSettingsOnly);

  document.getElementById('export-score-history-btn')?.addEventListener('click', async () => {
    try {
      const result = await exportScoreHistory();
      if (result.rowCount === 0) {
        alert('暂无评分可导出');
      } else {
        alert(`已导出 ${result.rowCount} 条评分记录`);
      }
    } catch (error) {
      console.error('Failed to export score history:', error);
      alert('导出评分失败: ' + (error.message || 'Unknown error'));
    }
  });

  document.getElementById('clear-score-history-btn')?.addEventListener('click', async () => {
    if (confirm('确定要清空所有评分记录吗？此操作不可撤销。')) {
      try {
        await clearScoreHistory();
        alert('评分记录已清空');
      } catch (error) {
        console.error('Failed to clear score history:', error);
        alert('清空评分失败: ' + (error.message || 'Unknown error'));
      }
    }
  });

  document.getElementById('import-default-library')?.addEventListener('click', importDefaultLibraryHandler);

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

  const enterPresetSelect = document.getElementById('enter-preset-select');
  if (enterPresetSelect) {
    enterPresetSelect.addEventListener('change', async (e) => {
      await applyEnterKeyPreset(e.target.value);
      updateCustomEnterSettingsVisibility(e.target.value);
    });
  }

  ['newline-shift', 'newline-ctrl', 'newline-alt', 'newline-meta',
   'send-shift', 'send-ctrl', 'send-alt', 'send-meta'].forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', saveCustomEnterSettings);
    }
  });

  const openModeSelect = document.getElementById('open-mode-select');
  if (openModeSelect) {
    openModeSelect.addEventListener('change', async (e) => {
      await saveSetting('openMode', e.target.value);
      showStatus('success', t('msgOpenModeUpdated') || 'Open mode updated');
    });
  }

  const mergeTimeoutSelect = document.getElementById('merge-timeout-select');
  if (mergeTimeoutSelect) {
    mergeTimeoutSelect.addEventListener('change', async (e) => {
      await saveSetting('mergeMaxWait', parseInt(e.target.value, 10));
      showStatus('success', t('msgMergeTimeoutUpdated') || 'Merge timeout updated');
    });
  }

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

function updateEnterBehaviorVisibility(enabled) {
  const settingsDiv = document.getElementById('enter-behavior-settings');
  if (settingsDiv) {
    settingsDiv.style.display = enabled ? 'block' : 'none';
  }
}
```

- [ ] **步骤2：从options.js中删除setupEventListeners函数**

删除行300-557的setupEventListeners函数。

- [ ] **步骤3：在options.js顶部添加导入**

```javascript
import { setupEventListeners } from './modules/event-handlers.js';
```

- [ ] **步骤4：测试功能正常**

运行：在Chrome中打开扩展选项页面，验证：
- 所有设置项保存正常
- 导出/导入功能正常
- 主题/语言切换正常

- [ ] **步骤5：Commit**

```bash
git add options/modules/event-handlers.js options/options.js
git commit -m "refactor: extract event handlers from options.js"
```

---

### 任务4：创建 data-manager.js

**文件：**
- 创建：`options/modules/data-manager.js`
- 修改：`options/options.js`

- [ ] **步骤1：创建data-manager.js**

```javascript
// options/modules/data-manager.js

import { getSettings, exportSettings, importSettings, resetSettings } from '../modules/settings.js';
import { exportPrompts, importPrompts, clearAllPrompts, importDefaultLibrary } from '../modules/prompt-manager.js';
import { t } from '../modules/i18n.js';
import { showStatus, showToast } from './ui-helpers.js';
import { loadDataStats, getDefaultLibraryLanguage } from './settings-loader.js';
import { validatePromptStructure, getPromptStructureExample, getDefaultLibraryPath, getExtensionResourceUrl } from '../options-helpers.js';

export async function exportData() {
  try {
    const promptsData = await exportPrompts();
    const settingsData = await exportSettings();

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      prompts: promptsData.prompts,
      settings: settingsData
    };

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

export async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version) {
      throw new Error('Invalid export file format');
    }

    const confirmMsg = t('msgImportConfirm', [
      new Date(data.exportDate).toLocaleString(),
      (data.prompts?.length || 0).toString()
    ]);

    if (!confirm(confirmMsg)) {
      return;
    }

    let promptImportSummary = null;
    if (data.prompts && Array.isArray(data.prompts)) {
      promptImportSummary = await importPrompts({ prompts: data.prompts }, 'skip');
    }

    if (data.settings) {
      const currentSettings = await getSettings();
      const settingsToImport = {
        ...data.settings,
        enabledProviders: currentSettings.enabledProviders
      };
      await importSettings(settingsToImport);
    }

    await loadSettings();
    await loadDataStats();

    if (promptImportSummary && promptImportSummary.imported > 0) {
      showToast('success', 'msgDataImportedWithCount', [promptImportSummary.imported.toString()]);
    } else {
      showToast('success', 'msgDataImported');
    }
  } catch (error) {
    showStatus('error', t('msgDataImportFailed'));
  }
}

export async function clearPrompts() {
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

export async function resetSettingsOnly() {
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

export async function importCustomLibraryHandler(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      showStatus('error', t('msgInvalidPromptFormat'));
      alert(`${t('msgInvalidFormat')}\n\n${getPromptStructureExample()}`);
      return;
    }

    if (data.length > 0) {
      const errors = validatePromptStructure(data[0]);
      if (errors.length > 0) {
        const errorMsg = `${t('msgInvalidPromptStructure')}:\n\n${errors.join('\n')}\n\n${getPromptStructureExample()}`;
        showStatus('error', t('msgInvalidPromptStructure'));
        alert(errorMsg);
        return;
      }
    }

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

    const libraryData = { prompts: data };
    const result = await importDefaultLibrary(libraryData);

    if (result.imported > 0) {
      showToast('success', 'msgCustomPromptsImported', [result.imported.toString(), result.skipped.toString()]);
    } else {
      showToast('info', 'msgAllPromptsExist');
    }

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

export async function importDefaultLibraryHandler() {
  const button = document.getElementById('import-default-library');

  try {
    button.disabled = true;
    button.textContent = t('msgImporting');

    const language = await getDefaultLibraryLanguage();
    const libraryPath = getDefaultLibraryPath(language);

    const response = await fetch(chrome.runtime.getURL(libraryPath));
    const promptsArray = await response.json();

    const libraryData = Array.isArray(promptsArray)
      ? { prompts: promptsArray }
      : promptsArray;

    const result = await importDefaultLibrary(libraryData);

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

    await loadDataStats();

  } catch (error) {
    showStatus('error', t('msgDefaultImportFailed'));
    button.disabled = false;
    button.textContent = t('btnImportDefault');
  }
}
```

- [ ] **步骤2：从options.js中删除这些函数**

删除以下函数：
- exportData（行560-589）
- importData（行592-639）
- clearPrompts（行642-654）
- resetSettingsOnly（行657-669）
- importCustomLibraryHandler（行722-786）
- importDefaultLibraryHandler（行789-832）

- [ ] **步骤3：在options.js顶部添加导入**

```javascript
import { exportData, importData, clearPrompts, resetSettingsOnly, importDefaultLibraryHandler, importCustomLibraryHandler } from './modules/data-manager.js';
```

- [ ] **步骤4：测试功能正常**

运行：在Chrome中打开扩展选项页面，验证：
- 导出数据正常
- 导入数据正常
- 清空提示词正常
- 重置设置正常
- 导入默认库正常
- 导入自定义库正常

- [ ] **步骤5：Commit**

```bash
git add options/modules/data-manager.js options/options.js
git commit -m "refactor: extract data manager from options.js"
```

---

### 任务5：创建 enter-key.js

**文件：**
- 创建：`options/modules/enter-key.js`
- 修改：`options/options.js`

- [ ] **步骤1：创建enter-key.js**

```javascript
// options/modules/enter-key.js

import { getSettings, saveSetting } from '../modules/settings.js';
import { t } from '../modules/i18n.js';
import { showStatus } from './ui-helpers.js';

export function updateEnterBehaviorVisibility(enabled) {
  const settingsDiv = document.getElementById('enter-behavior-settings');
  if (settingsDiv) {
    settingsDiv.style.display = enabled ? 'block' : 'none';
  }
}

export function updateCustomEnterSettingsVisibility(preset) {
  const customDiv = document.getElementById('custom-enter-settings');
  if (customDiv) {
    customDiv.style.display = preset === 'custom' ? 'block' : 'none';
  }
}

export function loadCustomEnterSettings(enterBehavior) {
  document.getElementById('newline-shift').checked = enterBehavior.newlineModifiers.shift || false;
  document.getElementById('newline-ctrl').checked = enterBehavior.newlineModifiers.ctrl || false;
  document.getElementById('newline-alt').checked = enterBehavior.newlineModifiers.alt || false;
  document.getElementById('newline-meta').checked = enterBehavior.newlineModifiers.meta || false;

  document.getElementById('send-shift').checked = enterBehavior.sendModifiers.shift || false;
  document.getElementById('send-ctrl').checked = enterBehavior.sendModifiers.ctrl || false;
  document.getElementById('send-alt').checked = enterBehavior.sendModifiers.alt || false;
  document.getElementById('send-meta').checked = enterBehavior.sendModifiers.meta || false;
}

export async function applyEnterKeyPreset(preset) {
  const settings = await getSettings();
  const enterBehavior = settings.enterKeyBehavior || {};

  enterBehavior.preset = preset;

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

export async function saveCustomEnterSettings() {
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

  const presetSelect = document.getElementById('enter-preset-select');
  if (presetSelect) {
    presetSelect.value = 'custom';
  }

  showStatus('success', t('msgCustomKeyMappingSaved'));
}
```

- [ ] **步骤2：从options.js中删除这些函数**

删除以下函数：
- updateEnterBehaviorVisibility（行835-840）
- updateCustomEnterSettingsVisibility（行842-847）
- loadCustomEnterSettings（行849-861）
- applyEnterKeyPreset（行863-897）
- saveCustomEnterSettings（行899-926）

- [ ] **步骤3：在options.js顶部添加导入**

```javascript
import { updateEnterBehaviorVisibility, updateCustomEnterSettingsVisibility, loadCustomEnterSettings, applyEnterKeyPreset, saveCustomEnterSettings } from './modules/enter-key.js';
```

- [ ] **步骤4：测试功能正常**

运行：在Chrome中打开扩展选项页面，验证：
- 回车键行为设置正常
- 预设选择正常
- 自定义设置保存正常

- [ ] **步骤5：Commit**

```bash
git add options/modules/enter-key.js options/options.js
git commit -m "refactor: extract enter key behavior from options.js"
```

---

### 任务6：创建 shortcut-helpers.js

**文件：**
- 创建：`options/modules/shortcut-helpers.js`
- 修改：`options/options.js`

- [ ] **步骤1：创建shortcut-helpers.js**

```javascript
// options/modules/shortcut-helpers.js

import { isEdgeBrowser } from '../options-helpers.js';

export function openShortcutSettings(browserOverride) {
  const isEdge = browserOverride === 'edge' || (browserOverride !== 'chrome' && isEdgeBrowser());
  const url = isEdge ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';

  try {
    chrome.tabs.create({ url });
  } catch (error) {
    window.open(url, '_blank');
  }
}

export function setupShortcutHelpers() {
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

export function updateShortcutHelperVisibility(isEnabled) {
  const edgeHelper = document.getElementById('edge-shortcut-helper');
  if (!edgeHelper) return;

  if (isEdgeBrowser() && isEnabled) {
    edgeHelper.style.display = 'flex';
  } else {
    edgeHelper.style.display = 'none';
  }
}
```

- [ ] **步骤2：从options.js中删除这些函数**

删除以下函数：
- openShortcutSettings（行84-94）
- setupShortcutHelpers（行96-108）
- updateShortcutHelperVisibility（行110-119）

- [ ] **步骤3：在options.js顶部添加导入**

```javascript
import { setupShortcutHelpers, updateShortcutHelperVisibility } from './modules/shortcut-helpers.js';
```

- [ ] **步骤4：测试功能正常**

运行：在Chrome中打开扩展选项页面，验证：
- 快捷键设置按钮正常
- Edge快捷键帮助正常显示

- [ ] **步骤5：Commit**

```bash
git add options/modules/shortcut-helpers.js options/options.js
git commit -m "refactor: extract shortcut helpers from options.js"
```

---

### 任务7：清理options.js主文件

**文件：**
- 修改：`options/options.js`

- [ ] **步骤1：更新options.js主文件**

重构完成后，options.js应该只包含：

```javascript
// options/options.js

import { applyTheme } from '../modules/theme-manager.js';
import { initializeLanguage, translatePage } from '../modules/i18n.js';
import { loadSettings, loadDataStats } from './modules/settings-loader.js';
import { setupEventListeners } from './modules/event-handlers.js';
import { setupShortcutHelpers } from './modules/shortcut-helpers.js';
import { refreshAutoSizedSelects } from './modules/ui-helpers.js';
import { loadCustomEnterSettings, updateEnterBehaviorVisibility, updateCustomEnterSettingsVisibility } from './modules/enter-key.js';
import { getSettings } from '../modules/settings.js';

async function init() {
  await applyTheme();
  await initializeLanguage();
  translatePage();
  await loadSettings();
  await loadDataStats();
  setupEventListeners();
  setupShortcutHelpers();
  refreshAutoSizedSelects();
  
  const settings = await getSettings();
  const enterBehavior = settings.enterKeyBehavior || { enabled: true, preset: 'default' };
  loadCustomEnterSettings(enterBehavior);
  updateEnterBehaviorVisibility(enterBehavior.enabled);
  updateCustomEnterSettingsVisibility(enterBehavior.preset);
}

init();
```

- [ ] **步骤2：验证文件行数**

options.js应该≤50行。

- [ ] **步骤3：完整测试**

运行：在Chrome中打开扩展选项页面，验证所有功能正常。

- [ ] **步骤4：Commit**

```bash
git add options/options.js
git commit -m "refactor: clean up options.js main file"
```

---

## 验证清单

重构完成后，验证：

- [ ] options.js ≤ 50行
- [ ] 每个模块 ≤ 300行
- [ ] 所有功能正常
- [ ] 导入/导出正常
- [ ] 设置保存/加载正常
- [ ] 快捷键设置正常
- [ ] 回车键行为正常
