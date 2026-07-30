import { describe, expect, it } from 'vitest';

import {
  getPanelPageIndex,
  getPanelsPerPage,
  getTotalPages,
  normalizeLayout
} from '../aichatmerge-panel/modules/layout-config.js';

describe('layout-config', () => {
  it('normalizes unknown layouts to the default 1x3 layout', () => {
    expect(normalizeLayout('1x4')).toBe('1x4');
    expect(normalizeLayout('unknown')).toBe('1x3');
    expect(normalizeLayout(null)).toBe('1x3');
  });

  it('returns the panel capacity for known layouts', () => {
    expect(getPanelsPerPage('1x1')).toBe(1);
    expect(getPanelsPerPage('1x3')).toBe(3);
    expect(getPanelsPerPage('1x5')).toBe(5);
  });

  it('falls back to three panels per page for unknown layouts', () => {
    expect(getPanelsPerPage('bad-layout')).toBe(3);
  });

  it('calculates page index for a panel index', () => {
    expect(getPanelPageIndex(0, '1x3')).toBe(0);
    expect(getPanelPageIndex(2, '1x3')).toBe(0);
    expect(getPanelPageIndex(3, '1x3')).toBe(1);
    expect(getPanelPageIndex(7, '1x4')).toBe(1);
  });

  it('keeps total pages at least one', () => {
    expect(getTotalPages(0, '1x3')).toBe(1);
    expect(getTotalPages(1, '1x3')).toBe(1);
    expect(getTotalPages(4, '1x3')).toBe(2);
  });
});
