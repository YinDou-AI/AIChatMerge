import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/providers.js', () => ({
  getProviderById: vi.fn(id => ({ id, name: id }))
}));
vi.mock('../aichatmerge-panel/modules/theme.js', () => ({
  getThemeAwareProviderIcon: vi.fn(() => '')
}));
vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({
  t: vi.fn(key => key)
}));
vi.mock('../aichatmerge-panel/modules/state.js', () => ({
  getPanels: vi.fn(() => []),
  getLoadingPanelIds: vi.fn(() => new Set())
}));
vi.mock('../aichatmerge-panel/modules/panel-frame-config.js', () => ({
  getProviderFrameUrl: vi.fn(id => `https://${id}.example/`)
}));
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: vi.fn()
}));

describe('Wenxin panel health', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('does not schedule the legacy iframe reload recovery for Wenxin', async () => {
    const { schedulePanelHealthCheck } = await import('../aichatmerge-panel/modules/panel-health.js');
    const iframe = { contentWindow: {}, src: 'https://chat.baidu.com/' };
    const panel = { id: 'wenxin-panel', providerId: 'wenxin', iframe };

    schedulePanelHealthCheck(panel);
    await vi.advanceTimersByTimeAsync(11000);

    expect(panel.healthCheckRequestId).toBeUndefined();
    expect(panel.healthReloadAttempts).toBeUndefined();
    expect(iframe.src).toBe('https://chat.baidu.com/');
  });
});
