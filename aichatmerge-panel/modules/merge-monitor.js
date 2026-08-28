// merge-monitor.js — Merge monitoring and completion detection

import { postToPanelIframe } from './panel-postmessage.js';
import { getPanelDebugInfo, recordDebugLog } from './debug-log.js';
import { acquireExtractMode, releaseExtractMode } from './answer-extractor.js';

// ===== Internal State =====
let mergeCompletedPanels = new Set();
let mergeTimeoutTimer = null;
let mergeIsActive = false;
let activeMergeSessionId = null;
let completionSessionGeneration = 0;
let activeCompletionSessionGeneration = 0;
let lastMergeType = null;
let lastMonitorPanels = [];
let lastMonitorMergePanelIds = new Set();

let MERGE_MAX_WAIT = 120000;
let AUTO_MERGE_ENABLED = true;

function triggerRegisteredMerge(panels, mergePanelIds) {
  import('./merge-engine.js')
    .then(module => module.triggerMerge({ panels, mergePanelIds }))
    .catch(error => {
      console.error('[MergeMonitor] Failed to load merge trigger:', error);
      recordDebugLog('merge-monitor:trigger-load-failed', {
        message: error?.message || String(error)
      });
    });
}

function getNonMergePanelsFrom(panels = [], mergePanelIds = new Set()) {
  return panels.filter(panel => !mergePanelIds.has(panel.id));
}

function rememberMonitorTargets(panels = [], mergePanelIds = new Set()) {
  lastMonitorPanels = panels;
  lastMonitorMergePanelIds = mergePanelIds;
}

function getRememberedPanels(panels) {
  return Array.isArray(panels) ? panels : lastMonitorPanels;
}

function getRememberedMergePanelIds(mergePanelIds) {
  return mergePanelIds instanceof Set ? mergePanelIds : lastMonitorMergePanelIds;
}

// ===== State Getters/Setters =====
export function getMergeIsActive() { return mergeIsActive; }
export function setMergeIsActive(value) { mergeIsActive = value; }
export function getActiveMergeSessionId() { return activeMergeSessionId; }

/**
 * Begin a new merge session: set the session id, mark active, and reset completed panels.
 * Callers (merge-engine, discussion-runner) should use this instead of setting state directly.
 */
export function beginMergeSession(sessionId, generation = completionSessionGeneration) {
  activeMergeSessionId = sessionId;
  mergeIsActive = true;
  activeCompletionSessionGeneration = generation;
  mergeCompletedPanels = new Set();
}
export function getCompletionSessionGeneration() { return completionSessionGeneration; }
export function getActiveCompletionSessionGeneration() { return activeCompletionSessionGeneration; }
export function invalidateCompletionSessions(reason = 'reset') {
  completionSessionGeneration += 1;
  recordDebugLog('completion-session:invalidate', {
    reason,
    completionSessionGeneration
  });
  clearActiveCompletionSession();
}
export function getMergeCompletedPanels() { return mergeCompletedPanels; }
export function addMergeCompletedPanel(panelId) { mergeCompletedPanels.add(panelId); }
export function removeMergeCompletedPanel(panelId) { mergeCompletedPanels.delete(panelId); }
export function getLastMergeType() { return lastMergeType; }
export function setLastMergeType(value) { lastMergeType = value; }
export function setMergeMaxWait(value) { MERGE_MAX_WAIT = value; }
export function getMergeMaxWait() { return MERGE_MAX_WAIT; }
export function setAutoMergeEnabled(value) { AUTO_MERGE_ENABLED = value; }
export function getAutoMergeEnabled() { return AUTO_MERGE_ENABLED; }

// ===== Merge Monitor =====
export function startMergeMonitor(mergeSessionId, panels, mergePanelIds) {
  stopMergeMonitor(panels, mergePanelIds);
  rememberMonitorTargets(panels, mergePanelIds);
  mergeIsActive = true;
  activeMergeSessionId = mergeSessionId;
  activeCompletionSessionGeneration = completionSessionGeneration;
  mergeCompletedPanels = new Set();
  const mergeBtn = document.getElementById('merge-btn');
  if (mergeBtn) mergeBtn.classList.add('active');

  acquireExtractMode();

  const nonMergePanels = getNonMergePanelsFrom(panels, mergePanelIds);
  recordDebugLog('merge-monitor:start', {
    mergeSessionId,
    autoMergeEnabled: AUTO_MERGE_ENABLED,
    mergeMaxWait: MERGE_MAX_WAIT,
    targetPanels: nonMergePanels.map(getPanelDebugInfo)
  });
  nonMergePanels.forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      postToPanelIframe(panel, {
        type: 'MONITOR_COMPLETION',
        mergeSessionId,
        panelId: panel.id,
        context: 'multi-panel'
      });
    }
  });

  if (AUTO_MERGE_ENABLED) {
    mergeTimeoutTimer = setTimeout(() => {
      if (!mergeIsActive || !AUTO_MERGE_ENABLED) return;
      lastMergeType = 'timeout';
      const currentNonMergePanels = getNonMergePanelsFrom(panels, mergePanelIds);
      recordDebugLog('merge-monitor:timeout', {
        mergeSessionId,
        completedCount: mergeCompletedPanels.size,
        totalCount: currentNonMergePanels.length,
        completedPanelIds: Array.from(mergeCompletedPanels),
        missingPanels: currentNonMergePanels
          .filter(panel => !mergeCompletedPanels.has(panel.id))
          .map(getPanelDebugInfo)
      });
      stopMergeMonitor(panels, mergePanelIds);
      triggerRegisteredMerge(panels, mergePanelIds);
    }, MERGE_MAX_WAIT);
  }
}

export function handleMergeCompletionDetected(data, panels, mergePanelIds) {
  if (data.context !== 'multi-panel-completion') {
    return;
  }

  if (String(data.mergeSessionId || '').startsWith('discussion-round-')) {
    return;
  }

  if (!activeMergeSessionId || data.mergeSessionId !== activeMergeSessionId) {
    recordDebugLog('completion:ignored-session-mismatch', {
      provider: data.provider,
      panelId: data.panelId,
      incomingSessionId: data.mergeSessionId,
      activeMergeSessionId
    });
    return;
  }

  if (activeCompletionSessionGeneration !== completionSessionGeneration) {
    recordDebugLog('completion:ignored-stale-generation', {
      provider: data.provider,
      panelId: data.panelId,
      mergeSessionId: data.mergeSessionId,
      activeCompletionSessionGeneration,
      completionSessionGeneration
    });
    return;
  }

  if (!mergeIsActive) {
    recordDebugLog('completion:ignored-inactive', {
      provider: data.provider,
      panelId: data.panelId,
      mergeSessionId: data.mergeSessionId
    });
    return;
  }

  const isFromMergePanel = data.panelId
    ? mergePanelIds.has(data.panelId)
    : !!panels.find(p => p.providerId === data.provider && mergePanelIds.has(p.id));
  if (isFromMergePanel) {
    recordDebugLog('merge-panel:completion-detected', {
      provider: data.provider,
      panelId: data.panelId,
      mergeSessionId: data.mergeSessionId
    });
    // Completion is a signal, not an answer transport. Consumers must extract
    // the latest panel content after receiving it so trailing output is not
    // replaced by an earlier cached snapshot.
    window.postMessage({ type: 'MERGE_COMPLETE', answer: null, provider: data.provider }, '*');
    return;
  }

  const panel = data.panelId
    ? panels.find(p => p.id === data.panelId)
    : panels.find(p => p.providerId === data.provider && !mergePanelIds.has(p.id));
  if (!panel) {
    console.warn('[Merge] No panel found for provider:', data.provider);
    recordDebugLog('completion:no-panel-found', {
      provider: data.provider,
      panelId: data.panelId,
      mergeSessionId: data.mergeSessionId
    });
    return;
  }

  if (mergeCompletedPanels.has(panel.id)) return;

  mergeCompletedPanels.add(panel.id);
  const nonMergeCount = getNonMergePanelsFrom(panels, mergePanelIds).length;
  recordDebugLog('merge-monitor:panel-complete', {
    panel: getPanelDebugInfo(panel),
    mergeSessionId: data.mergeSessionId,
    completedCount: mergeCompletedPanels.size,
    totalCount: nonMergeCount
  });

  if (mergeCompletedPanels.size >= nonMergeCount) {
    if (!AUTO_MERGE_ENABLED) {
      recordDebugLog('merge-monitor:all-complete-manual-mode', {
        mergeSessionId: data.mergeSessionId,
        totalCount: nonMergeCount
      });
      stopMergeMonitor(panels, mergePanelIds);
      return;
    }
    lastMergeType = 'auto';
    recordDebugLog('merge-monitor:all-complete-auto-merge', {
      mergeSessionId: data.mergeSessionId,
      totalCount: nonMergeCount
    });
    stopMergeMonitor(panels, mergePanelIds);
    triggerRegisteredMerge(panels, mergePanelIds);
  }
}

export function reconcileAfterPanelRemoval(removedPanelId, panels = [], mergePanelIds = new Set()) {
  removeMergeCompletedPanel(removedPanelId);

  if (!mergeIsActive) return;

  const remainingPanels = panels.filter(panel => !mergePanelIds.has(panel.id));
  if (remainingPanels.length === 0) {
    stopMergeMonitor(panels, mergePanelIds);
    return;
  }

  const allRemainingPanelsCompleted = remainingPanels.every(panel =>
    mergeCompletedPanels.has(panel.id)
  );
  if (!allRemainingPanelsCompleted) return;

  if (!AUTO_MERGE_ENABLED) {
    stopMergeMonitor(panels, mergePanelIds);
    return;
  }

  lastMergeType = 'auto';
  stopMergeMonitor(panels, mergePanelIds);
  triggerRegisteredMerge(panels, mergePanelIds);
}

export function stopMergeMonitor(panels, mergePanelIds) {
  const targetPanels = getRememberedPanels(panels);
  const targetMergePanelIds = getRememberedMergePanelIds(mergePanelIds);
  const nonMergePanels = getNonMergePanelsFrom(targetPanels, targetMergePanelIds);
  if (mergeIsActive || activeMergeSessionId) {
    recordDebugLog('merge-monitor:stop', {
      mergeSessionId: activeMergeSessionId,
      completedCount: mergeCompletedPanels.size,
      totalCount: nonMergePanels.length
    });
  }
  mergeIsActive = false;
  activeMergeSessionId = null;
  activeCompletionSessionGeneration = 0;
  mergeCompletedPanels.clear();
  releaseExtractMode();

  if (mergeTimeoutTimer) {
    clearTimeout(mergeTimeoutTimer);
    mergeTimeoutTimer = null;
  }

  nonMergePanels.forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      postToPanelIframe(panel, {
        type: 'STOP_MONITORING',
        context: 'multi-panel'
      });
    }
  });

  const mergeBtn = document.getElementById('merge-btn');
  if (mergeBtn) mergeBtn.classList.remove('active');
}

/**
 * Reset merge state without side effects (no timer clear, no STOP_MONITORING messages).
 * Used by discussion-runner between rounds where the monitor must stay silent.
 * For full teardown, use stopMergeMonitor() instead.
 */
export function clearActiveCompletionSession() {
  mergeIsActive = false;
  activeMergeSessionId = null;
  activeCompletionSessionGeneration = 0;
  mergeCompletedPanels.clear();
}
