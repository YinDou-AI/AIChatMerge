/**
 * Panel health: loading state, iframe reload, health checks.
 * Extracted from iframe-comm.js for domain separation.
 */

import { getProviderById } from '../../modules/providers.js';
import { getThemeAwareProviderIcon } from './theme.js';
import { t } from './i18n.js';
import { getPanels, getLoadingPanelIds } from './state.js';
import { getProviderFrameUrl } from './panel-frame-config.js';
import { postToPanelIframe } from './panel-postmessage.js';

// Wenxin has its own content-script recovery in send-pipeline.js. Reloading
// its iframe here destroys the composer and can invalidate the frame while
// that recovery is running. Keep the legacy reload recovery for Qianwen only.
const AUTO_RECOVER_PROVIDERS = new Set(['qianwen']);

// --- Panel loading ---

export function showPanelLoadingState(panelEl, provider) {
  const el = panelEl?.querySelector('.panel-loading');
  if (!el || !provider) return;
  el.classList.remove('hidden');
  el.textContent = '';
  const icon = document.createElement('img');
  icon.src = getThemeAwareProviderIcon(provider);
  icon.alt = provider.name;
  icon.className = 'loading-icon';
  icon.dataset.providerId = provider.id;
  const txt = document.createElement('span');
  txt.className = 'loading-text';
  txt.textContent = t('loadingProvider', provider.name);
  el.appendChild(icon);
  el.appendChild(txt);
}

export function reloadPanelIframe(panel, overrideUrl = null) {
  const panelEl = document.getElementById(panel.id);
  const provider = getProviderById(panel.providerId);
  if (!panelEl || !provider) return;
  const iframe = panelEl.querySelector('iframe');
  if (!iframe) return;
  showPanelLoadingState(panelEl, provider);
  const loadingPanelIds = getLoadingPanelIds();
  loadingPanelIds.add(panel.id);
  iframe.src = overrideUrl || getProviderFrameUrl(panel.providerId);
  panel.iframe = iframe;
}

// --- Health checks ---

export function schedulePanelHealthCheck(panel) {
  if (!panel || !AUTO_RECOVER_PROVIDERS.has(panel.providerId)) return;
  clearTimeout(panel.healthCheckTimer);
  clearTimeout(panel.healthRecoveryTimer);
  const rid = `health-${panel.id}-${Date.now()}`;
  panel.healthCheckRequestId = rid;
  panel.healthCheckTimer = setTimeout(() => {
    if (panel.healthCheckRequestId !== rid || !panel.iframe?.contentWindow) return;
    postToPanelIframe(panel, { type: 'HEALTH_CHECK', requestId: rid, panelId: panel.id, context: 'multi-panel' });
  }, 4000);
  panel.healthRecoveryTimer = setTimeout(() => {
    if (panel.healthCheckRequestId !== rid || (panel.healthReloadAttempts || 0) >= 1) return;
    panel.healthReloadAttempts = (panel.healthReloadAttempts || 0) + 1;
    reloadPanelIframe(panel);
  }, 10000);
}

export function handlePanelHealthCheckResult(panel, data) {
  if (!panel || data.requestId !== panel.healthCheckRequestId) return;
  clearTimeout(panel.healthRecoveryTimer);
  panel.healthRecoveryTimer = null;
  if (data.results?.input?.some(r => r.found && r.visible) || (panel.healthReloadAttempts || 0) >= 1) return;
  panel.healthReloadAttempts = (panel.healthReloadAttempts || 0) + 1;
  reloadPanelIframe(panel);
}
