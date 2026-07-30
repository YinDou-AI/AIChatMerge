import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock DOM environment
beforeEach(() => {
  document.body.innerHTML = '';
});

// Mock dependencies
vi.mock('../aichatmerge-panel/modules/panel-frame-config.js', () => ({
  getProviderFrameUrl: (provider) => `https://example.com/${provider}`
}));

vi.mock('../aichatmerge-panel/modules/panel-header-actions.js', () => ({
  getPanelHeaderRightHtml: () => '<button>test</button>'
}));

vi.mock('../aichatmerge-panel/modules/theme.js', () => ({
  getThemeAwareProviderIcon: (provider) => provider?.icon || 'icon.png',
  setBrandText: (el, text) => { el.textContent = text; }
}));

vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({
  t: (key, ...args) => `${key}:${args.join(',')}`
}));

vi.mock('../aichatmerge-panel/modules/merge-prompt.js', () => ({
  getMergeBadgeMeta: () => ({ background: '#10b981', text: 'Auto', title: '' })
}));

import { buildMergePanel } from '../aichatmerge-panel/modules/panel-builder.js';

describe('panel-builder', () => {
  const defaultProps = {
    panelId: 'panel-merge-123',
    provider: { id: 'deepseek', name: 'DeepSeek', icon: 'ds.png' },
    targetProvider: 'deepseek',
    question: 'test question',
    validAnswers: [{ providerName: 'GPT' }, { providerName: 'Claude' }],
    mergeMode: 'merge',
    discussRounds: 0
  };

  it('should return panelEl, iframe, and panelData', () => {
    const result = buildMergePanel(defaultProps);
    expect(result.panelEl).toBeDefined();
    expect(result.iframe).toBeDefined();
    expect(result.panelData).toBeDefined();
  });

  it('should set correct panel ID and provider dataset', () => {
    const { panelEl } = buildMergePanel(defaultProps);
    expect(panelEl.id).toBe('panel-merge-123');
    expect(panelEl.dataset.providerId).toBe('deepseek');
    expect(panelEl.className).toBe('panel-item');
  });

  it('should create iframe with correct src and sandbox', () => {
    const { iframe } = buildMergePanel(defaultProps);
    expect(iframe.src).toContain('deepseek');
    expect(iframe.sandbox).toContain('allow-same-origin');
    expect(iframe.sandbox).toContain('allow-scripts');
  });

  it('should create panelData with correct structure', () => {
    const { panelData } = buildMergePanel(defaultProps);
    expect(panelData.id).toBe('panel-merge-123');
    expect(panelData.providerId).toBe('deepseek');
    expect(panelData.state).toBe('loading');
    expect(panelData.exportData.question).toBe('test question');
    expect(panelData.exportData.providers).toEqual(['GPT', 'Claude']);
    expect(panelData.exportData.mode).toBe('merge');
  });

  it('should set discuss mode for merge+discuss', () => {
    const { panelData } = buildMergePanel({ ...defaultProps, mergeMode: 'merge+discuss' });
    expect(panelData.exportData.mode).toBe('discuss');
  });

  it('should create header with merge badge', () => {
    const { panelEl } = buildMergePanel(defaultProps);
    const badge = panelEl.querySelector('#merge-status-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Auto');
  });

  it('should create loading indicator', () => {
    const { panelEl } = buildMergePanel(defaultProps);
    const loading = panelEl.querySelector('.panel-loading');
    expect(loading).not.toBeNull();
    const loadingText = loading.querySelector('.loading-text');
    expect(loadingText.textContent).toContain('loadingProvider');
  });
});
