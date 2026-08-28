// Temporary content-script side of provider transport diagnostics.
// Disable centrally in modules/diagnostic-config.js for a formal build.

import {
  ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS,
  PROVIDER_TRANSPORT_BUILD_ID,
  PROVIDER_TRANSPORT_PROTOCOL_VERSION
} from '../../../modules/diagnostic-config.js';
import { detectProvider } from './detection.js';
import { postToExtensionParent } from './messaging.js';

function getRuntimeDetails(provider = detectProvider()) {
  return {
    provider,
    protocolVersion: PROVIDER_TRANSPORT_PROTOCOL_VERSION,
    buildId: PROVIDER_TRANSPORT_BUILD_ID,
    pageOrigin: window.location?.origin || null,
    documentReadyState: document.readyState,
    hasRealParent: !!window.__realParent__,
  };
}

export function postProviderTransportReady(provider = detectProvider()) {
  if (!ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS) return;
  postToExtensionParent({
    type: 'CONTENT_SCRIPT_READY',
    context: 'multi-panel-content-script',
    ...getRuntimeDetails(provider)
  });
}

export function handleProviderTransportPing(data, provider = detectProvider()) {
  if (!ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS ||
      data?.type !== 'CONTENT_SCRIPT_PING' ||
      data?.context !== 'multi-panel-content-script') {
    return false;
  }
  if (!data.requestId) return true;
  postToExtensionParent({
    type: 'CONTENT_SCRIPT_PONG',
    context: 'multi-panel-content-script',
    requestId: data.requestId,
    ...getRuntimeDetails(provider)
  });
  return true;
}
