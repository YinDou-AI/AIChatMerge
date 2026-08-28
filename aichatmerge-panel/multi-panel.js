// Multi-Panel Main Entry Point
// Refactored: all logic extracted to modules/

import { applyTheme } from '../modules/theme-manager.js';
import { setCurrentLocale, detectLocale, applyI18n } from './modules/i18n.js';
import { registerRuntimeMessageListener, registerStorageChangeListener, detectWindowType, loadSettings, restoreStateIfNeeded, handlePendingMultiPanelAction, getIsInitialized, getPanelHeaderRightHtml, bindPanelHeaderActions } from './modules/iframe-comm.js';
import { initializePanels, renderCurrentPage } from './modules/panel-lifecycle.js';
import { setupEventListeners } from './modules/event-handlers.js';
import { focusUnifiedInput } from './modules/focus-manager.js';
import { updateDefaultPromptBar, bindDefaultPromptEvents } from './modules/prompting/index.js';
import { refreshThemeAwareProviderIcons } from './modules/theme.js';

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
}

init();
