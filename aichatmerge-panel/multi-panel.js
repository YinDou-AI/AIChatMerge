// Multi-Panel Main Entry Point
// Refactored: all logic extracted to modules/

import { applyTheme } from '../modules/theme-manager.js';
import { setCurrentLocale, detectLocale, applyI18n } from './modules/i18n.js';
import { recordDebugLog, getPanelDebugInfo, clearDebugLogs } from './modules/debug-log.js';
import { registerRuntimeMessageListener, registerStorageChangeListener, detectWindowType, loadSettings, restoreStateIfNeeded, handlePendingMultiPanelAction, getIsInitialized, getPanelHeaderRightHtml, bindPanelHeaderActions } from './modules/iframe-comm.js';
import { initializePanels, renderCurrentPage } from './modules/panel-lifecycle.js';
import { setupEventListeners } from './modules/event-handlers.js';
import { focusUnifiedInput } from './modules/focus-manager.js';
import { updateDefaultPromptBar, bindDefaultPromptEvents } from './modules/prompting/index.js';
import { refreshThemeAwareProviderIcons } from './modules/theme.js';
import { DEBUG_EXPORT_ENABLED } from './modules/build-flags.js';

async function init() {
  document.addEventListener('aichatmerge:themechange', refreshThemeAwareProviderIcons);
  await applyTheme();

  const locale = detectLocale();
  setCurrentLocale(locale);
  applyI18n((panelEl, providerId, headerRight) => {
    headerRight.innerHTML = getPanelHeaderRightHtml(providerId);
    bindPanelHeaderActions(panelEl.id);
  });

  registerRuntimeMessageListener(getIsInitialized);
  registerStorageChangeListener();

  detectWindowType();
  await restoreStateIfNeeded();
  await loadSettings();
  await initializePanels();
  renderCurrentPage();
  setupEventListeners();
  focusUnifiedInput({ force: true });
  await handlePendingMultiPanelAction();
  await updateDefaultPromptBar();
  bindDefaultPromptEvents();

  // 自动化巡检入口：仅调试版且 URL 带 #selftest=1 时触发，正常打开无影响
  if (DEBUG_EXPORT_ENABLED) {
    window.clearAIChatMergeDebugLogs = clearDebugLogs;
    const { maybeRunSelfTest } = await import('./modules/self-test-driver.js');
    maybeRunSelfTest();
  }
}

init();
