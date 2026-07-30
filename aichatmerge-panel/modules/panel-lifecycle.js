/**
 * Panel CRUD and lifecycle management.
 * Extracted from multi-panel.js
 */

import { getProviderById } from '../../modules/providers.js';
import { DEFAULT_PROVIDER_IDS } from '../../modules/provider-defaults.js';
import { getGoogleProviderUrl } from '../../modules/google-mode.js';
import { schedulePanelHealthCheck, reloadPanelIframe } from './panel-health.js';
import { bindPanelHeaderActions, getPanelHeaderRightHtml, initPanelHeaderActionCallbacks } from './panel-header-actions.js';
import { syncGoogleModeControls } from './panel-frame-config.js';
import { getThemeAwareProviderIcon, setBrandText } from './theme.js';
import { closeLayoutModal } from './layout-controls.js';
import { t } from './i18n.js';
import { isMergePanel, getNonMergePanels, getMergePanelIds } from './merge-panel-registry.js';
import {
  LAYOUT_PANEL_COUNTS,
  normalizeLayout,
  getPanelsPerPage,
  getTotalPages
} from './layout-config.js';
import {
  getPanels, getCurrentLayout, setCurrentLayout,
  getCurrentPanelPage, setCurrentPanelPage,
  getLoadingPanelIds,
  getIsInitializing, setIsInitializing,
  getCurrentGoogleProviderMode,
  getClaudeEntryUrl
} from './state.js';

export { LAYOUT_PANEL_COUNTS, normalizeLayout };

export async function initializePanels() {
  try {
    const settings = await chrome.storage.sync.get({
      multiPanelProviders: DEFAULT_PROVIDER_IDS
    });

    const providerIds = settings.multiPanelProviders || DEFAULT_PROVIDER_IDS;

    setIsInitializing(true);
    for (const providerId of providerIds) {
      await addPanel(providerId);
    }
    setIsInitializing(false);

    saveProviderConfiguration();
    renderCurrentPage();
  } catch (error) {
    setIsInitializing(false);
    console.error('Error initializing panels:', error);
    for (const providerId of DEFAULT_PROVIDER_IDS) {
      await addPanel(providerId);
    }
    saveProviderConfiguration();
    renderCurrentPage();
  }
}

export async function addPanel(providerId) {
  const provider = getProviderById(providerId);
  if (!provider) {
    console.error('Provider not found:', providerId);
    return;
  }

  const panelId = `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const panelGrid = document.getElementById('panel-grid');

  const panelEl = document.createElement('div');
  panelEl.className = 'panel-item';
  panelEl.id = panelId;
  panelEl.dataset.providerId = providerId;

  const header = document.createElement('div');
  header.className = 'panel-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'panel-header-left';

  const headerIcon = document.createElement('img');
  headerIcon.src = getThemeAwareProviderIcon(provider);
  headerIcon.alt = provider.name;
  headerIcon.className = 'provider-icon';
  headerIcon.dataset.providerId = provider.id;

  const headerName = document.createElement('span');
  setBrandText(headerName, provider.name);

  headerLeft.appendChild(headerIcon);
  headerLeft.appendChild(headerName);

  const headerRight = document.createElement('div');
  headerRight.className = 'panel-header-right';
  headerRight.innerHTML = getPanelHeaderRightHtml(providerId);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'panel-iframe-container';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'panel-loading';

  const loadingIcon = document.createElement('img');
  loadingIcon.src = getThemeAwareProviderIcon(provider);
  loadingIcon.alt = provider.name;
  loadingIcon.className = 'loading-icon';
  loadingIcon.dataset.providerId = provider.id;

  const loadingText = document.createElement('span');
  loadingText.className = 'loading-text';
  loadingText.textContent = t('loadingProvider', provider.name);

  loadingEl.appendChild(loadingIcon);
  loadingEl.appendChild(loadingText);

  const iframe = document.createElement('iframe');
  iframe.src = getProviderFrameUrl(providerId);
  iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';
  iframe.allow = 'clipboard-read; clipboard-write';

  iframeContainer.appendChild(loadingEl);
  iframeContainer.appendChild(iframe);
  panelEl.appendChild(header);
  panelEl.appendChild(iframeContainer);

  panelGrid.appendChild(panelEl);

  const LOAD_GRACE_PERIOD = 3000;
  getLoadingPanelIds().add(panelId);
  iframe.addEventListener('load', () => {
    loadingEl.classList.add('hidden');
    const panel = getPanels().find(p => p.id === panelId);
    if (panel) {
      schedulePanelHealthCheck(panel);
    }
    setTimeout(() => {
      getLoadingPanelIds().delete(panelId);
    }, LOAD_GRACE_PERIOD);
  });

  iframe.addEventListener('error', () => {
    loadingEl.textContent = '';
    const errorIcon = document.createElement('img');
    errorIcon.src = getThemeAwareProviderIcon(provider);
    errorIcon.alt = provider.name;
    errorIcon.className = 'loading-icon';
    errorIcon.dataset.providerId = provider.id;
    const errorText = document.createElement('span');
    errorText.className = 'loading-text';
    errorText.textContent = t('providerLoadFailed', provider.name);
    loadingEl.appendChild(errorIcon);
    loadingEl.appendChild(errorText);
    getLoadingPanelIds().delete(panelId);
    loadingEl.style.cursor = 'pointer';
    loadingEl.title = t('clickToRetry');
    loadingEl.addEventListener('click', () => {
      const panel = getPanels().find(p => p.id === panelId);
      if (panel && panel.url) {
        loadingEl.textContent = '';
        const retryIcon = document.createElement('img');
        retryIcon.src = getThemeAwareProviderIcon(provider);
        retryIcon.alt = provider.name;
        retryIcon.className = 'loading-icon';
        retryIcon.dataset.providerId = provider.id;
        const retryText = document.createElement('span');
        retryText.className = 'loading-text';
        retryText.textContent = t('retrying');
        loadingEl.appendChild(retryIcon);
        loadingEl.appendChild(retryText);
        loadingEl.style.cursor = '';
        loadingEl.title = '';
        getLoadingPanelIds().add(panelId);
        iframe.src = panel.url;
      }
    });
  });

  getPanels().push({
    id: panelId,
    providerId,
    url: getProviderFrameUrl(providerId),
    iframe,
    state: 'loading'
  });

  bindPanelHeaderActions(panelId);

  if (!getIsInitializing()) {
    await saveProviderConfiguration();
  }

  if (!getIsInitializing()) {
    const panelsPerPage = getPanelsPerPage(getCurrentLayout());
    setCurrentPanelPage(Math.floor((getPanels().length - 1) / panelsPerPage));
    renderCurrentPage();
  }
}

export function removePanel(panelId) {
  const panelIndex = getPanels().findIndex(p => p.id === panelId);
  if (panelIndex === -1) return;
  const removedPanel = getPanels()[panelIndex];
  const removedWasSourcePanel = !isMergePanel(removedPanel);

  const panelEl = document.getElementById(panelId);
  if (panelEl) {
    panelEl.remove();
  }

  getPanels().splice(panelIndex, 1);
  getLoadingPanelIds().delete(panelId);
  getMergePanelIds().delete(panelId);

  if (removedWasSourcePanel) {
    import('./merge-monitor.js')
      .then(module => module.reconcileAfterPanelRemoval(panelId, getPanels(), getMergePanelIds()))
      .catch(error => console.warn('[PanelLifecycle] Failed to reconcile merge monitor after panel removal:', error));
    import('./discussion-gates.js')
      .then(module => module.notifyDiscussionPanelRemoved(panelId))
      .catch(error => console.warn('[PanelLifecycle] Failed to notify discussion wait after panel removal:', error));
  }

  saveProviderConfiguration();
  renderCurrentPage();
}

export async function switchPanelProvider(panelId, newProviderId) {
  const panel = getPanels().find(p => p.id === panelId);
  if (!panel) return;

  const provider = getProviderById(newProviderId);
  if (!provider) return;

  const panelEl = document.getElementById(panelId);
  if (!panelEl) return;

  if (newProviderId === 'google') {
    syncGoogleModeControls();
  }

  const headerIcon = panelEl.querySelector('.panel-header-left img');
  const headerName = panelEl.querySelector('.panel-header-left span');
  const headerRight = panelEl.querySelector('.panel-header-right');
  headerIcon.src = getThemeAwareProviderIcon(provider);
  headerIcon.dataset.providerId = provider.id;
  headerIcon.alt = provider.name;
  setBrandText(headerName, provider.name);
  panelEl.dataset.providerId = newProviderId;
  headerRight.textContent = '';
  headerRight.innerHTML = getPanelHeaderRightHtml(newProviderId);

  const iframe = panelEl.querySelector('iframe');

  panel.providerId = newProviderId;
  panel.iframe = iframe;
  bindPanelHeaderActions(panelId);
  reloadPanelIframe(panel);

  await saveProviderConfiguration();
}

export async function saveProviderConfiguration() {
  const providerIds = getNonMergePanels().map(p => p.providerId);
  try {
    await chrome.storage.sync.set({
      multiPanelProviders: providerIds,
      multiPanelLayout: getCurrentLayout(),
      currentPanelPage: getCurrentPanelPage()
    });
  } catch (error) {
    console.error('Error saving provider configuration:', error);
  }
}

export function updateScrollArrows() {
  const leftBtn = document.getElementById('scroll-left-btn');
  const rightBtn = document.getElementById('scroll-right-btn');
  if (!leftBtn || !rightBtn) return;

  const totalPages = getTotalPages(getPanels().length, getCurrentLayout());

  leftBtn.style.display = getCurrentPanelPage() > 0 ? 'flex' : 'none';
  rightBtn.style.display = getCurrentPanelPage() < totalPages - 1 ? 'flex' : 'none';
}

export function renderCurrentPage() {
  const panelsPerPage = getPanelsPerPage(getCurrentLayout());
  const totalPages = getTotalPages(getPanels().length, getCurrentLayout());

  if (getCurrentPanelPage() >= totalPages) {
    setCurrentPanelPage(totalPages - 1);
  }
  if (getCurrentPanelPage() < 0) {
    setCurrentPanelPage(0);
  }

  const startIndex = getCurrentPanelPage() * panelsPerPage;
  const endIndex = startIndex + panelsPerPage;

  getPanels().forEach((panel, index) => {
    const panelEl = document.getElementById(panel.id);
    if (panelEl) {
      if (index >= startIndex && index < endIndex) {
        panelEl.style.position = '';
        panelEl.style.opacity = '';
        panelEl.style.pointerEvents = '';
        panelEl.style.width = '';
        panelEl.style.height = '';
      } else {
        panelEl.style.position = 'absolute';
        panelEl.style.opacity = '0';
        panelEl.style.pointerEvents = 'none';
        panelEl.style.width = '100%';
        panelEl.style.height = '100%';
      }
    }
  });

  updateScrollArrows();
}

export function setLayout(layout) {
  if (!LAYOUT_PANEL_COUNTS[layout]) return;
  setCurrentLayout(layout);
  const panelGrid = document.getElementById('panel-grid');
  panelGrid.className = `layout-${layout}`;
  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === layout);
  });
  renderCurrentPage();
  saveProviderConfiguration();
  closeLayoutModal();
}

function getProviderFrameUrl(providerId) {
  const provider = getProviderById(providerId);
  if (!provider) {
    return '';
  }

  if (providerId === 'claude' && getClaudeEntryUrl()) {
    return getClaudeEntryUrl();
  }

  if (providerId === 'google') {
    return getGoogleProviderUrl(getCurrentGoogleProviderMode());
  }

  return provider.url;
}

initPanelHeaderActionCallbacks({ removePanel });
