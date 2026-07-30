// Options Page - Main Entry Point
// Refactored: all logic extracted to modules/

import { applyTheme } from '../modules/theme-manager.js';
import { initializeLanguage, translatePage } from '../modules/i18n.js';
import { loadSettings, loadDataStats } from './modules/settings-display.js';
import { setupEventListeners } from './modules/general-settings.js';
import { setupShortcutHelpers } from './modules/shortcut-helpers.js';
import { refreshAutoSizedSelects } from './modules/ui-helpers.js';

async function init() {
  await applyTheme();
  await initializeLanguage();
  translatePage();
  await loadSettings();
  await loadDataStats();
  setupEventListeners();
  setupShortcutHelpers();
  refreshAutoSizedSelects();
}

init();
