/**
 * Panel postMessage utilities: origin resolution and message posting.
 * Pure utility with zero internal dependencies — breaks circular imports.
 */

export function getIframeTargetOrigin(panel) {
  if (!panel || !panel.iframe || !panel.iframe.contentWindow) return null;
  try { return new URL(panel.iframe.src || panel.url).origin; } catch { return null; }
}

export function postToPanelIframe(panel, message) {
  const targetOrigin = getIframeTargetOrigin(panel);
  if (!targetOrigin) return;
  panel.iframe.contentWindow.postMessage(message, targetOrigin);
}
