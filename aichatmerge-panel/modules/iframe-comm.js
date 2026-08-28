/**
 * iframe-comm.js — compatibility layer & callback bridge.
 *
 * This file has two responsibilities:
 *   1. Re-export domain functions consumed by multi-panel.js (transitional)
 *   2. Initialize settings-loader callbacks to break circular deps
 *
 * Domain modules (import these directly in new code):
 *   - panel-transport.js      (postMessage, storage listener)
 *   - panel-frame-config.js   (provider URLs, Google mode)
 *   - panel-health.js         (loading state, iframe reload)
 *   - panel-header-actions.js (header HTML, button bindings)
 *   - settings-loader.js      (settings, window type, state persistence)
 */

// --- Re-export domain functions consumed by multi-panel.js (transitional) ---
// panel-transport
export { registerStorageChangeListener } from './panel-transport.js';
// panel-header-actions
export { getPanelHeaderRightHtml, bindPanelHeaderActions } from './panel-header-actions.js';
// settings-loader (only functions multi-panel.js actually calls)
export { registerRuntimeMessageListener, detectWindowType, loadSettings, restoreStateIfNeeded, handlePendingMultiPanelAction } from './settings-loader.js';

import { getPanels } from './state.js';
import { switchPanelProvider } from './panel-lifecycle.js';
import { openPromptModal } from './prompting/index.js';
import { initSettingsCallbacks, getIsInitialized } from './settings-loader.js';
import { updateToggleButton } from './panel-header-actions.js';

// --- Initialize settings-loader callbacks (avoids circular imports) ---
initSettingsCallbacks({
  switchPanelProvider,
  openPromptModal,
  getPanels,
  setIsInitialized: () => {},
  updateToggleButton: (isPopupWindow) => updateToggleButton(isPopupWindow)
});

// --- Expose state getter consumed by multi-panel.js ---
export { getIsInitialized };
