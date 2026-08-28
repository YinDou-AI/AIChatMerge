/**
 * Panel transport: postMessage communication, message routing, storage listener.
 * Extracted from iframe-comm.js for domain separation.
 */

import { normalizeGoogleProviderMode } from '../../modules/google-mode.js';
import { CLAUDE_CUSTOM_ENTRY_URL_KEY, getClaudeCustomEntryUrl } from '../../modules/claude-entry-url.js';
import { applyTheme } from '../../modules/theme-manager.js';
import {
  getPanels,
  getCurrentGoogleProviderMode, setClaudeEntryUrl
} from './state.js';
import {
  cancelUnifiedInputFocusRestoreAfterSend,
  handleSendFocusProviderBusy, handleSendFocusProviderIdle,
  activeSendFocusRequestIdGetter
} from './focus-manager.js';
import {
  handleMergeCompletionDetected,
  stopMergeMonitor, setMergeMaxWait,
  setAutoMergeEnabled
} from './merge-monitor.js';
import { handleExtractedAnswer } from './answer-extractor.js';
import { setCurrentLocale, applyI18n, detectLocale } from './i18n.js';
import { handlePanelInjectionResult, handlePanelSubmitDispatchResult, handlePanelSubmitResult, getMergePanelIds } from './send-pipeline.js';
import { handlePanelHealthCheckResult } from './panel-health.js';
import { showClaudeEntryWarning, updateGoogleProviderMode } from './panel-header-actions.js';
import { isChatgptProvider } from './panel-frame-config.js';
import { getPanelDebugInfo, recordDebugLog } from './debug-log.js';
import { handleProviderTransportDiagnosticMessage } from './provider-transport-diagnostics.js';

export { getIframeTargetOrigin, postToPanelIframe } from './panel-postmessage.js';
export { postNewChatToPanel } from './panel-new-chat.js';

// --- ChatGPT panel queries ---

export function getChatgptPanelsWithFrames() {
  const panels = getPanels();
  return panels.filter(p => isChatgptProvider(p.providerId) && p.iframe && p.iframe.contentWindow);
}

// --- Provider status message handling ---

const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = 'multi-panel-provider-status';
const ACM_PROVIDER_BUSY = 'ACM_PROVIDER_BUSY';
const ACM_PROVIDER_IDLE = 'ACM_PROVIDER_IDLE';
const ACM_PROVIDER_USER_INTERACTION = 'ACM_PROVIDER_USER_INTERACTION';

export function handleProviderStatusMessage(event) {
  const data = event?.data;
  if (!data || typeof data !== 'object') return;
  const panels = getPanels();
  const panel = panels.find(c => c.iframe?.contentWindow === event.source);
  if (!panel) return;
  let origin;
  try { origin = new URL(panel.iframe.src || panel.url).origin; } catch { return; }
  if (event.origin !== origin) return;
  if (data.type === 'CLAUDE_ENTRY_WARNING' && data.context === 'claude-entry-warning') {
    if (panel.providerId === 'claude') showClaudeEntryWarning(panel, data);
    return;
  }
  if (data.type === 'EXTRACTED_ANSWER' && data.context === 'multi-panel-answer') { handleExtractedAnswer(data); return; }
  if (data.type === 'INJECT_TEXT_RESULT' && data.context === 'multi-panel-injection') {
    if (data.provider === panel.providerId) handlePanelInjectionResult(data);
    return;
  }
  if (data.type === 'SUBMIT_TEXT_RESULT' && data.context === 'multi-panel-submission') {
    if (data.provider === panel.providerId) handlePanelSubmitResult(data);
    return;
  }
  if (data.type === 'SUBMIT_TEXT_DISPATCH_RESULT' && data.context === 'multi-panel-submission-dispatch') {
    if (data.provider === panel.providerId) handlePanelSubmitDispatchResult(data);
    return;
  }
  if (handleProviderTransportDiagnosticMessage(panel, data)) return;
  if (data.type === 'INJECTION_DIAGNOSTIC' && data.context === 'multi-panel-injection-diagnostic') {
    if (data.provider === panel.providerId) {
      recordDebugLog(`text-injection:${data.event || 'unknown'}`, {
        targetId: panel.id,
        sourceId: data.provider || 'text-injection',
        panel: getPanelDebugInfo(panel),
        injectionRequestId: data.injectionRequestId,
        ...(data.details && typeof data.details === 'object' ? data.details : {})
      });
    }
    return;
  }
  if (data.type === 'COMPLETION_DIAGNOSTIC' && data.context === 'multi-panel-completion-diagnostic') {
    if (data.provider === panel.providerId) {
      recordDebugLog(`completion-monitor:${data.event || 'unknown'}`, {
        targetId: panel.id,
        sourceId: data.provider || 'completion-monitor',
        panel: getPanelDebugInfo(panel),
        ...(data.details && typeof data.details === 'object' ? data.details : {})
      });
    }
    return;
  }
  if (data.type === 'HEALTH_CHECK_RESULT' && data.context === 'multi-panel-health') { handlePanelHealthCheckResult(panel, data); return; }
  if (data.type === 'COMPLETION_DETECTED' && data.context === 'multi-panel-completion') {
    // The iframe's COMPLETION_DETECTED payload carries only `provider`, not `panelId`.
    // Fall back to the receiving panel (matched via event.source) so completion maps to
    // the exact panel instead of a provider-name guess, which misfires when multiple
    // panels share a provider. Without this, most completion signals are dropped and
    // auto-merge never reaches the "all panels complete" threshold.
    handleMergeCompletionDetected(
      { ...data, panelId: data.panelId || panel.id, provider: data.provider || panel.providerId },
      getPanels(),
      getMergePanelIds()
    );
    return;
  }
  if (data.type === 'EXTRACT_DEBUG_RESULT' && data.context === 'multi-panel-debug') return;
  if (data.context !== MULTI_PANEL_PROVIDER_STATUS_CONTEXT || !data.requestId || data.provider !== panel.providerId) return;
  if (data.type === ACM_PROVIDER_BUSY && isChatgptProvider(panel.providerId)) handleSendFocusProviderBusy(panel, data.requestId);
  else if (data.type === ACM_PROVIDER_IDLE && isChatgptProvider(panel.providerId)) handleSendFocusProviderIdle(panel, data.requestId);
  else if (data.type === ACM_PROVIDER_USER_INTERACTION && data.requestId === activeSendFocusRequestIdGetter()) cancelUnifiedInputFocusRestoreAfterSend();
}

// --- Storage change listener ---

export function registerStorageChangeListener() {
  if (!chrome?.storage?.onChanged?.addListener) return;
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'sync' && area !== 'local') return;
    if (changes.theme) await applyTheme();
    if (changes.language) {
      const newLocale = changes.language.newValue?.startsWith('zh') ? 'zh' : (changes.language.newValue || detectLocale());
      setCurrentLocale(newLocale);
      applyI18n();
    }
    if (changes.mergeMaxWait) {
      const v = Number(changes.mergeMaxWait.newValue);
      if (Number.isFinite(v) && v > 0) setMergeMaxWait(v);
    }
    if (changes.autoMergeEnabled) {
      const enabled = changes.autoMergeEnabled.newValue !== false;
      setAutoMergeEnabled(enabled);
      if (!enabled) stopMergeMonitor();
    }
    if (area === 'local' && changes[CLAUDE_CUSTOM_ENTRY_URL_KEY]) {
      const url = await getClaudeCustomEntryUrl();
      setClaudeEntryUrl(url);
    }
    if (!changes.googleProviderMode?.newValue) return;
    const nm = normalizeGoogleProviderMode(changes.googleProviderMode.newValue);
    const currentGoogleProviderMode = getCurrentGoogleProviderMode();
    if (nm === currentGoogleProviderMode) return;
    updateGoogleProviderMode(nm, { reloadPanels: true }).catch(() => {});
  });
}
