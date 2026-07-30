/**
 * Layout constants and pagination helpers.
 * Pure module: no DOM, storage, or panel state dependencies.
 */

export const LAYOUT_PANEL_COUNTS = {
  '1x1': 1,
  '1x2': 2,
  '1x3': 3,
  '1x4': 4,
  '1x5': 5
};

export function normalizeLayout(layout) {
  return LAYOUT_PANEL_COUNTS[layout] ? layout : '1x3';
}

export function getPanelsPerPage(layout) {
  return LAYOUT_PANEL_COUNTS[layout] || 3;
}

export function getPanelPageIndex(panelIndex, layout) {
  return Math.floor(panelIndex / getPanelsPerPage(layout));
}

export function getTotalPages(panelCount, layout) {
  return Math.max(1, Math.ceil(panelCount / getPanelsPerPage(layout)));
}
