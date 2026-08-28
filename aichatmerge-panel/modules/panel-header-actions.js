/**
 * Panel header actions: header HTML, button bindings, toggle, state collection.
 * Extracted from iframe-comm.js for domain separation.
 */

import { getProviderById } from '../../modules/providers.js';
import { saveSetting } from '../../modules/settings.js';
import { normalizeGoogleProviderMode } from '../../modules/google-mode.js';
import {
  getPanels,
  getCurrentLayout,
  getCurrentGoogleProviderMode, setCurrentGoogleProviderMode,
  getLoadingPanelIds
} from './state.js';
import { getThemeAwareProviderIcon, setMaterialIcon } from './theme.js';
import { t } from './i18n.js';
import { recordDebugLog, getPanelDebugInfo } from './debug-log.js';
import { showToast } from './toast.js';
import { getProviderFrameUrl, isGoogleProvider, getGoogleModeSelectHtml, syncGoogleModeControls, fitPanelSelectWidth } from './panel-frame-config.js';
import { postToPanelIframe } from './panel-postmessage.js';
import { reloadPanelIframe } from './panel-health.js';

let _removePanel = null;
let _startFreshChatForPanel = null;

export function initPanelHeaderActionCallbacks({ removePanel, startFreshChatForPanel } = {}) {
  _removePanel = removePanel || _removePanel;
  _startFreshChatForPanel = startFreshChatForPanel || _startFreshChatForPanel;
}

// --- Google mode update (moved from frame-config to avoid circular dep with health) ---

export async function updateGoogleProviderMode(mode, { persist = false, reloadPanels = false } = {}) {
  const nm = normalizeGoogleProviderMode(mode);
  const currentGoogleProviderMode = getCurrentGoogleProviderMode();
  const changed = currentGoogleProviderMode !== nm;
  setCurrentGoogleProviderMode(nm);
  syncGoogleModeControls();
  if (reloadPanels && changed) getPanels().filter(p => isGoogleProvider(p.providerId)).forEach(p => reloadPanelIframe(p));
  if (persist) await saveSetting('googleProviderMode', nm);
}

// --- Panel header HTML ---

export function getPanelHeaderRightHtml(providerId) {
  const gm = isGoogleProvider(providerId) ? getGoogleModeSelectHtml() : '';
  return `${gm}<button class="panel-new-chat-btn" title="${t('newChat')}"><span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="add_comment"></span></button><button class="copy-link-btn" title="${t('copyLink')}"><span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="content_copy"></span></button><button class="refresh-panel-btn" title="${t('refresh')}"><span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="refresh"></span></button><button class="home-btn" title="${t('home')}"><span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="home"></span></button><button class="maximize-btn" title="${t('maximize')}"><span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="open_in_full"></span></button><button class="switch-provider-btn" title="${t('switchProvider')}"><span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="swap_horiz"></span></button><button class="close-panel-btn" title="${t('close')}"><span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="close"></span></button>`;
}

// --- Panel header button bindings ---

export function bindPanelHeaderActions(panelId) {
  const panel = getPanels().find(p => p.id === panelId);
  const el = document.getElementById(panelId);
  if (!panel || !el) return;
  el.querySelector('.panel-new-chat-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    if (_startFreshChatForPanel) {
      await _startFreshChatForPanel(panel);
    } else {
      const module = await import('./focus-manager.js');
      await module.startFreshChatForPanel(panel);
    }
    showToast(t('panelNewChatCreated'));
  });
  el.querySelector('.copy-link-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    try {
      const url = el.querySelector('iframe')?.src || '';
      await navigator.clipboard.writeText(url);
      const ic = el.querySelector('.copy-link-btn .material-symbols-outlined');
      setMaterialIcon(ic, 'check');
      setTimeout(() => setMaterialIcon(ic, 'content_copy'), 1500);
    } catch {}
  });
  el.querySelector('.refresh-panel-btn')?.addEventListener('click', e => { e.stopPropagation(); reloadPanelIframe(panel); });
  el.querySelector('.home-btn')?.addEventListener('click', e => { e.stopPropagation(); reloadPanelIframe(panel, getProviderFrameUrl(panel.providerId)); });
  el.querySelector('.maximize-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    const max = el.classList.toggle('panel-maximized');
    setMaterialIcon(el.querySelector('.maximize-btn .material-symbols-outlined'), max ? 'close_fullscreen' : 'open_in_full');
    el.querySelector('.maximize-btn').title = max ? t('restore') : t('maximize');
  });
  el.querySelector('.switch-provider-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    import('./panel-menus.js').then(module => module.showProviderSwitcher(panelId));
  });
  el.querySelector('.close-panel-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    if (getPanels().length <= 1) { showToast(t('minOnePanel')); return; }
    if (_removePanel) _removePanel(panelId);
  });
  const gmSel = el.querySelector('.panel-google-mode-select');
  if (gmSel) {
    fitPanelSelectWidth(gmSel);
    gmSel.addEventListener('click', ev => ev.stopPropagation());
    gmSel.addEventListener('mousedown', ev => ev.stopPropagation());
    gmSel.addEventListener('change', async ev => {
      fitPanelSelectWidth(ev.target);
      await updateGoogleProviderMode(ev.target.value, { persist: true, reloadPanels: true });
    });
  }
}

// --- Claude entry warning ---

export function showClaudeEntryWarning(panel, data = {}) {
  if (!panel || panel.providerId !== 'claude') return;
  const container = document.getElementById(panel.id)?.querySelector('.panel-iframe-container');
  if (!container) return;
  let w = container.querySelector('.claude-entry-warning');
  if (!w) {
    w = document.createElement('div');
    w.className = 'claude-entry-warning';
    const msg = document.createElement('span');
    msg.className = 'claude-entry-warning-text';
    w.appendChild(msg);
    const acts = document.createElement('div');
    acts.className = 'claude-entry-warning-actions';
    const sb = document.createElement('button');
    sb.type = 'button'; sb.className = 'claude-entry-warning-btn';
    sb.textContent = t('openSettings');
    sb.addEventListener('click', () => chrome.runtime.openOptionsPage());
    const db = document.createElement('button');
    db.type = 'button'; db.className = 'claude-entry-warning-dismiss';
    db.textContent = t('dismiss');
    db.addEventListener('click', () => w.remove());
    acts.appendChild(sb); acts.appendChild(db);
    w.appendChild(acts); container.appendChild(w);
  }
  const txt = w.querySelector('.claude-entry-warning-text');
  if (txt) txt.textContent = t('claudeEntryWarning');
  w.dataset.reason = data.reason || 'unknown';
  recordDebugLog('claude-entry-warning:shown', { panel: getPanelDebugInfo(panel), reason: data.reason || 'unknown', matchedText: data.matchedText || '' });
}

// --- Toggle button ---

export function updateToggleButton(isPopupWindow) {
  const btn = document.getElementById('toggle-open-mode-btn');
  if (!btn) return;
  const ic = btn.querySelector('.material-symbols-outlined');
  setMaterialIcon(ic, isPopupWindow ? 'tab' : 'open_in_new');
  btn.title = isPopupWindow ? t('switchToTabModeTitle') : t('switchToPopupModeTitle');
}

// --- State collection ---

export function collectCurrentState() {
  return {
    inputText: document.getElementById('unified-input')?.value || '',
    currentLayout: getCurrentLayout(),
    panels: getPanels().map(p => ({ providerId: p.providerId })),
    googleProviderMode: getCurrentGoogleProviderMode(), timestamp: Date.now()
  };
}
