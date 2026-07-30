// Kimi completion policy.
// Kimi can pause between search, reasoning, and final rendering, so short
// stop-button or DOM-quiet shortcuts must not mark the response complete.

import { getProviderTerminalResponseSignature } from '../../../../modules/provider-terminal-responses.js';

export const KIMI_STOP_BUTTON_SELECTORS = Object.freeze([
  'button[aria-label="停止生成"]',
  'button[aria-label*="停止生成"]',
  'button[aria-label="Stop generating"]',
  'button[aria-label*="Stop generating"]',
  'button:has(svg[name="Stop"])'
]);

export const KIMI_COMPLETION_POLICY = Object.freeze({
  answerStableMs: 10000
});

/**
 * Returns a compact signature for Kimi's terminal capacity-error response.
 * The occurrence count lets the completion monitor distinguish a newly
 * appended error card from the same error left in an older conversation turn.
 */
export function getKimiTerminalResponseSignature(root = document) {
  const pageText = root?.body?.textContent || root?.body?.innerText || '';
  return getProviderTerminalResponseSignature('kimi', pageText);
}
