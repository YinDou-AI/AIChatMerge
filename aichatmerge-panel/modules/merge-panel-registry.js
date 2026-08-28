/**
 * Merge panel registry.
 * Single source of truth for panel ids that represent merge output panels.
 */

import { getPanels } from './state.js';

const mergePanelIds = new Set();

export function isMergePanel(panel) {
  return Boolean(panel && mergePanelIds.has(panel.id));
}

export function getMergePanelIds() {
  return mergePanelIds;
}

export function getNonMergePanels() {
  return getPanels().filter(panel => !isMergePanel(panel));
}
