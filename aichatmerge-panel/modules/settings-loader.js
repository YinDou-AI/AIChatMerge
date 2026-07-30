/**
 * Settings loading, window type detection, and state persistence.
 * Extracted from iframe-comm.js to separate concerns.
 *
 * This module handles:
 * - Loading settings from chrome.storage.sync
 * - Detecting popup vs tab window type
 * - Toggling between popup and tab modes
 * - Restoring preserved state after mode switch
 * - Handling pending multi-panel actions (from context menus, etc.)
 *
 * Note: Circular dependencies with iframe-comm are avoided by using
 * callback-based initialization (initSettingsCallbacks) rather than
 * direct imports.
 */

import {
  setCurrentLayout, setCurrentPanelPage,
  setCurrentGoogleProviderMode, setClaudeEntryUrl
} from './state.js';
import { normalizeLayout } from './layout-config.js';
import { setMergeMaxWait, setAutoMergeEnabled } from './merge-monitor.js';
import { normalizeGoogleProviderMode } from '../../modules/google-mode.js';
import { getClaudeCustomEntryUrl } from '../../modules/claude-entry-url.js';
import { DEFAULT_PROVIDER_IDS } from '../../modules/provider-defaults.js';
import { applyPromptToInput } from './prompting/index.js';

// --- State managed by this module ---
let isPopupWindow = false;
let currentOpenMode = 'tab';
let isInitialized = false;

// --- Callbacks set by iframe-comm during initialization ---
let _switchPanelProvider = null;
let _openPromptModal = null;
let _getPanels = null;
let _setIsInitialized = null;
let _updateToggleButton = null;

/**
 * Initialize callback dependencies from iframe-comm.
 * Must be called before any settings-loader functions that use callbacks.
 * This pattern avoids circular imports between iframe-comm and settings-loader.
 */
export function initSettingsCallbacks({ switchPanelProvider, openPromptModal, getPanels, setIsInitialized, updateToggleButton }) {
  _switchPanelProvider = switchPanelProvider;
  _openPromptModal = openPromptModal;
  _getPanels = getPanels;
  _setIsInitialized = setIsInitialized;
  _updateToggleButton = updateToggleButton;
}

// --- Constants ---

const PENDING_MULTI_PANEL_ACTION_KEY = 'pendingMultiPanelAction';

// --- State getters ---
export function getIsInitialized() { return isInitialized; }
export function getIsPopupWindow() { return isPopupWindow; }

// --- Core settings functions ---

/**
 * Load all panel settings from chrome.storage.sync and apply them.
 * @param {object} state - Shared state object from iframe-comm (currentLayout, currentGoogleProviderMode, etc.)
 */
export async function loadSettings(state) {
  try {
    const s = await chrome.storage.sync.get({
      multiPanelLayout: '1x3', multiPanelProviders: DEFAULT_PROVIDER_IDS, openMode: 'tab',
      googleProviderMode: 'ai', currentPanelPage: 0, mergeMaxWait: 120000, autoMergeEnabled: true
    });
    state.currentLayout = normalizeLayout(s.multiPanelLayout);
    setCurrentLayout(state.currentLayout);
    currentOpenMode = s.openMode || 'tab';
    state.currentGoogleProviderMode = normalizeGoogleProviderMode(s.googleProviderMode);
    setCurrentGoogleProviderMode(state.currentGoogleProviderMode);
    state.currentPanelPage = s.currentPanelPage || 0;
    setCurrentPanelPage(state.currentPanelPage);
    const mw = Number(s.mergeMaxWait);
    state.MERGE_MAX_WAIT = Number.isFinite(mw) && mw > 0 ? mw : 120000;
    setMergeMaxWait(state.MERGE_MAX_WAIT);
    state.AUTO_MERGE_ENABLED = s.autoMergeEnabled !== false;
    setAutoMergeEnabled(state.AUTO_MERGE_ENABLED);
    state.claudeCustomEntryUrl = await getClaudeCustomEntryUrl();
    setClaudeEntryUrl(state.claudeCustomEntryUrl);
    document.getElementById('panel-grid').className = `layout-${state.currentLayout}`;
    if (_setIsInitialized) _setIsInitialized(true);
    isInitialized = true;
  } catch (e) { console.error('Error loading settings:', e); }
}

/**
 * Detect whether the current window is a popup or tab,
 * and read the stored open mode preference.
 */
export async function detectWindowType() {
  try {
    isPopupWindow = (await chrome.windows.getCurrent()).type === 'popup';
    currentOpenMode = (await chrome.storage.sync.get({ openMode: 'tab' })).openMode;
    if (_updateToggleButton) _updateToggleButton(isPopupWindow);
  } catch (e) { console.error('Error detecting window type:', e); }
}

/**
 * Switch between popup and tab mode.
 * Saves current state, creates the new window, and closes the old one.
 * @param {object} state - Shared state object from iframe-comm
 */
export async function toggleOpenMode(state) {
  const currentState = {
    inputText: document.getElementById('unified-input')?.value || '',
    currentLayout: state.currentLayout,
    panels: _getPanels ? _getPanels().map(p => ({ providerId: p.providerId })) : [],
    googleProviderMode: state.currentGoogleProviderMode,
    timestamp: Date.now()
  };
  try { await chrome.storage.session.set({ preservedState: currentState }); } catch { await chrome.storage.local.set({ preservedState: currentState }); }
  const newMode = isPopupWindow ? 'tab' : 'popup';
  await chrome.storage.sync.set({ openMode: newMode });
  const url = chrome.runtime.getURL('aichatmerge-panel/multi-panel.html');
  if (isPopupWindow) { await chrome.tabs.create({ url, active: true }); window.close(); }
  else {
    await chrome.windows.create({ url, type: 'popup', width: 1400, height: 900 });
    const tab = await chrome.tabs.getCurrent();
    if (tab) await chrome.tabs.remove(tab.id);
  }
}

/**
 * Restore preserved state after a popup<->tab mode switch.
 * @param {object} state - Shared state object from iframe-comm
 */
export async function restoreStateIfNeeded(state) {
  try {
    let r = await chrome.storage.session.get('preservedState');
    if (!r.preservedState) r = await chrome.storage.local.get('preservedState');
    if (!r.preservedState) return;
    const st = r.preservedState;
    const inp = document.getElementById('unified-input');
    if (inp && st.inputText) inp.value = st.inputText;
    if (st.currentLayout) {
      state.currentLayout = normalizeLayout(st.currentLayout);
      setCurrentLayout(state.currentLayout);
      document.getElementById('panel-grid')?.setAttribute('class', `layout-${state.currentLayout}`);
    }
    if (st.panels?.length) await chrome.storage.sync.set({ multiPanelProviders: st.panels.map(p => p.providerId) });
    if (st.googleProviderMode) await chrome.storage.sync.set({ googleProviderMode: normalizeGoogleProviderMode(st.googleProviderMode) });
    await chrome.storage.session.remove('preservedState');
    await chrome.storage.local.remove('preservedState');
  } catch (e) { console.error('Error restoring state:', e); }
}

// --- Pending multi-panel action handling ---

export async function getPendingMultiPanelAction() {
  try { const r = await chrome.storage.session.get(PENDING_MULTI_PANEL_ACTION_KEY); if (r?.[PENDING_MULTI_PANEL_ACTION_KEY]) return r[PENDING_MULTI_PANEL_ACTION_KEY]; } catch {}
  try { const r = await chrome.storage.local.get(PENDING_MULTI_PANEL_ACTION_KEY); return r?.[PENDING_MULTI_PANEL_ACTION_KEY] || null; } catch { return null; }
}

export async function clearPendingMultiPanelAction() {
  try { await chrome.storage.session.remove(PENDING_MULTI_PANEL_ACTION_KEY); } catch {}
  try { await chrome.storage.local.remove(PENDING_MULTI_PANEL_ACTION_KEY); } catch {}
}

export async function handlePendingMultiPanelAction() {
  const pa = await getPendingMultiPanelAction();
  if (pa?.action && await handleMultiPanelAction(pa.action, pa.payload || {})) await clearPendingMultiPanelAction();
}

export async function handleMultiPanelAction(action, payload = {}) {
  if (action === 'openPromptLibrary') {
    if (payload.selectedText) applyPromptToInput(payload.selectedText);
    if (_openPromptModal) _openPromptModal();
    return true;
  }
  if (action === 'sendToPanel') { if (payload.selectedText) applyPromptToInput(payload.selectedText); return true; }
  if (action === 'switchProvider') {
    const panels = _getPanels ? _getPanels() : [];
    if (payload.providerId && panels.length > 0 && _switchPanelProvider) {
      await _switchPanelProvider(panels[0].id, payload.providerId);
    }
    if (payload.selectedText) applyPromptToInput(payload.selectedText);
    return true;
  }
  return false;
}

/**
 * Register a chrome.runtime.onMessage listener for actions
 * dispatched from background/popup scripts.
 * @param {Function} isInitializedGetter - Returns whether the panel is fully initialized
 */
export function registerRuntimeMessageListener(isInitializedGetter = () => false) {
  if (!chrome?.runtime?.onMessage) return;
  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.action && isInitializedGetter()) handleMultiPanelAction(msg.action, msg.payload || {}).then(h => { if (h) clearPendingMultiPanelAction(); });
  });
}
