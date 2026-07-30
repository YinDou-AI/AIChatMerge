/**
 * Panel frame config: provider URLs, Google mode, Claude entry URL.
 * Extracted from iframe-comm.js for domain separation.
 */

import { getProviderById } from '../../modules/providers.js';
import {
  GOOGLE_PROVIDER_MODE_AI,
  GOOGLE_PROVIDER_MODE_SEARCH,
  getGoogleProviderUrl,
  normalizeGoogleProviderMode
} from '../../modules/google-mode.js';
import { getCurrentGoogleProviderMode, getClaudeEntryUrl } from './state.js';
import { fitPanelSelectWidth } from './shared/ui-utils.js';

// --- Provider type checks ---

export function isGoogleProvider(providerId) { return providerId === 'google'; }
export function isChatgptProvider(providerId) { return providerId === 'chatgpt'; }

export function getPanelProviderMode(panel) {
  return isGoogleProvider(panel.providerId) ? getCurrentGoogleProviderMode() : null;
}

// --- Provider frame URL ---

export function getProviderFrameUrl(providerId) {
  const provider = getProviderById(providerId);
  if (!provider) return '';
  if (providerId === 'claude') {
    const claudeCustomEntryUrl = getClaudeEntryUrl();
    if (claudeCustomEntryUrl) return claudeCustomEntryUrl;
  }
  return isGoogleProvider(providerId) ? getGoogleProviderUrl(getCurrentGoogleProviderMode()) : provider.url;
}

// --- Google mode controls ---

export function getGoogleModeSelectHtml(mode = getCurrentGoogleProviderMode()) {
  const m = normalizeGoogleProviderMode(mode);
  return `<select class="panel-google-mode-select" title="Google mode"><option value="${GOOGLE_PROVIDER_MODE_AI}" ${m === GOOGLE_PROVIDER_MODE_AI ? 'selected' : ''}>AI Mode</option><option value="${GOOGLE_PROVIDER_MODE_SEARCH}" ${m === GOOGLE_PROVIDER_MODE_SEARCH ? 'selected' : ''}>Search</option></select>`;
}

export function syncGoogleModeControls() {
  const currentGoogleProviderMode = getCurrentGoogleProviderMode();
  document.querySelectorAll('.panel-google-mode-select').forEach(s => {
    if (s.value !== currentGoogleProviderMode) s.value = currentGoogleProviderMode;
    fitPanelSelectWidth(s);
  });
}

export { fitPanelSelectWidth } from './shared/ui-utils.js';
