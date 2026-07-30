/**
 * Temporary provider transport diagnostics.
 *
 * Removal for a formal build is controlled by modules/diagnostic-config.js.
 * This module owns the provider-transport:* log prefix and all READY/PING
 * probe state so diagnostic code does not spread through business modules.
 */

import {
  ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS,
  PROVIDER_TRANSPORT_BUILD_ID,
  PROVIDER_TRANSPORT_PROTOCOL_VERSION
} from '../../modules/diagnostic-config.js';
import { getPanelDebugInfo, recordDebugLog } from './debug-log.js';
import { getIframeTargetOrigin, postToPanelIframe } from './panel-postmessage.js';

const CONTENT_SCRIPT_PROBE_TIMEOUT_MS = 1200;
const pendingContentScriptProbes = new Map();

function sanitizeContentScriptDetails(data = {}) {
  return {
    provider: data.provider || null,
    protocolVersion: data.protocolVersion ?? null,
    buildId: data.buildId || null,
    pageOrigin: data.pageOrigin || null,
    documentReadyState: data.documentReadyState || null,
    hasRealParent: data.hasRealParent === true,
  };
}

function describePanelTransport(panel) {
  return {
    targetOrigin: getIframeTargetOrigin(panel),
    iframeConnected: panel?.iframe?.isConnected !== false,
    readySeen: !!panel?.contentScriptReadiness,
    ready: panel?.contentScriptReadiness || null,
    expectedProtocolVersion: PROVIDER_TRANSPORT_PROTOCOL_VERSION,
    expectedBuildId: PROVIDER_TRANSPORT_BUILD_ID,
  };
}

function noteContentScriptReady(panel, data) {
  if (!panel) return null;
  panel.contentScriptReachable = true;
  panel.contentScriptReadiness = sanitizeContentScriptDetails(data);
  return { status: 'ready', ...describePanelTransport(panel) };
}

function resolveContentScriptPong(panel, data) {
  const entry = pendingContentScriptProbes.get(data?.requestId);
  if (!entry || entry.panel !== panel) return false;
  clearTimeout(entry.timeoutId);
  pendingContentScriptProbes.delete(data.requestId);
  panel.contentScriptReachable = true;
  panel.contentScriptReadiness = sanitizeContentScriptDetails(data);
  entry.resolve({
    status: 'pong',
    requestId: data.requestId,
    ...describePanelTransport(panel),
    pong: sanitizeContentScriptDetails(data),
  });
  return true;
}

export function handleProviderTransportDiagnosticMessage(panel, data) {
  if (data?.context !== 'multi-panel-content-script') return false;
  if (!['CONTENT_SCRIPT_READY', 'CONTENT_SCRIPT_PONG'].includes(data.type)) return false;

  // Swallow diagnostic protocol messages even in a formal build. With the
  // shared switch off, the content script will not emit them.
  if (!ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS || data.provider !== panel?.providerId) return true;

  if (data.type === 'CONTENT_SCRIPT_READY') {
    recordDebugLog('provider-transport:ready', {
      targetId: panel.id,
      sourceId: data.provider,
      panel: getPanelDebugInfo(panel),
      transport: noteContentScriptReady(panel, data),
    });
    return true;
  }

  resolveContentScriptPong(panel, data);
  return true;
}

export function probePanelContentScript(panel, timeoutMs = CONTENT_SCRIPT_PROBE_TIMEOUT_MS) {
  if (!ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS) {
    return Promise.resolve({ status: 'disabled' });
  }

  const requestId = `content-ping-${panel?.id || 'unknown'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise(resolve => {
    if (!panel?.iframe?.contentWindow || !getIframeTargetOrigin(panel)) {
      resolve({ status: 'unavailable', requestId, ...describePanelTransport(panel) });
      return;
    }

    const timeoutId = setTimeout(() => {
      pendingContentScriptProbes.delete(requestId);
      resolve({ status: 'timeout', requestId, ...describePanelTransport(panel) });
    }, timeoutMs);
    pendingContentScriptProbes.set(requestId, { panel, resolve, timeoutId });

    try {
      postToPanelIframe(panel, {
        type: 'CONTENT_SCRIPT_PING',
        context: 'multi-panel-content-script',
        requestId,
        protocolVersion: PROVIDER_TRANSPORT_PROTOCOL_VERSION,
        buildId: PROVIDER_TRANSPORT_BUILD_ID,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      pendingContentScriptProbes.delete(requestId);
      resolve({
        status: 'post-error',
        requestId,
        ...describePanelTransport(panel),
        error: error?.message || String(error),
      });
    }
  });
}
