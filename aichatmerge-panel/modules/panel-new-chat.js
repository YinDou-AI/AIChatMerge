/**
 * New-chat postMessage helper.
 * Pure transport helper used by focus/new-chat flows without importing panel-transport.
 */

import { getPanelProviderMode } from './panel-frame-config.js';
import { postToPanelIframe } from './panel-postmessage.js';

export function postNewChatToPanel(panel) {
  if (!panel || !panel.iframe || !panel.iframe.contentWindow) return;
  postToPanelIframe(panel, {
    type: 'NEW_CHAT',
    providerMode: getPanelProviderMode(panel),
    context: 'multi-panel'
  });
}
