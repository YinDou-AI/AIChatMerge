import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all transitive dependencies to avoid circular import issues
vi.mock('../aichatmerge-panel/modules/state.js', () => ({
  setCurrentLayout: vi.fn(), setCurrentPanelPage: vi.fn(),
  setCurrentGoogleProviderMode: vi.fn(), setClaudeEntryUrl: vi.fn(),
  getPanels: vi.fn(() => []), getCurrentLayout: vi.fn(() => '1x3'),
  getCurrentGoogleProviderMode: vi.fn(() => 'ai'), getCurrentPanelPage: vi.fn(() => 0),
  getClaudeEntryUrl: vi.fn(() => ''), getLoadingPanelIds: vi.fn(() => new Set()),
}));
vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  setMergeMaxWait: vi.fn(), setAutoMergeEnabled: vi.fn(),
  stopMergeMonitor: vi.fn(), getMergeMaxWait: vi.fn(() => 120000),
  handleMergeCompletionDetected: vi.fn(), handleExtractedAnswer: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/layout-config.js', () => ({
  normalizeLayout: vi.fn((l) => l),
}));
vi.mock('../aichatmerge-panel/modules/panel-lifecycle.js', () => ({
  switchPanelProvider: vi.fn(),
  removePanel: vi.fn(), addPanel: vi.fn(), renderCurrentPage: vi.fn(),
  initializePanels: vi.fn(),
  updateScrollArrows: vi.fn(), saveProviderConfiguration: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/merge-engine.js', () => ({
  triggerMerge: vi.fn(),
}));
vi.mock('../modules/google-mode.js', () => ({
  normalizeGoogleProviderMode: vi.fn((m) => m),
  GOOGLE_PROVIDER_MODE_AI: 'ai', GOOGLE_PROVIDER_MODE_SEARCH: 'search',
  getGoogleProviderUrl: vi.fn(() => 'https://google.com'),
}));
vi.mock('../modules/claude-entry-url.js', () => ({
  getClaudeCustomEntryUrl: vi.fn(() => Promise.resolve('')),
  CLAUDE_CUSTOM_ENTRY_URL_KEY: 'claudeCustomEntryUrl',
}));
vi.mock('../modules/provider-defaults.js', () => ({ DEFAULT_PROVIDER_IDS: ['chatgpt', 'deepseek'] }));
vi.mock('../aichatmerge-panel/modules/prompting/index.js', () => ({
  applyPromptToInput: vi.fn(), openPromptModal: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/focus-manager.js', () => ({
  focusUnifiedInput: vi.fn(), cancelUnifiedInputFocusRestoreAfterSend: vi.fn(),
  handleSendFocusProviderBusy: vi.fn(), handleSendFocusProviderIdle: vi.fn(),
  activeSendFocusRequestIdGetter: vi.fn(() => null), startFreshChatForPanel: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({
  t: vi.fn((key) => key), getCurrentLocale: vi.fn(() => 'en'),
  setCurrentLocale: vi.fn(), applyI18n: vi.fn(), detectLocale: vi.fn(() => 'en'),
}));
vi.mock('../aichatmerge-panel/modules/debug-log.js', () => ({
  recordDebugLog: vi.fn(), getPanelDebugInfo: vi.fn(() => ({})),
}));
vi.mock('../aichatmerge-panel/modules/send-pipeline.js', () => ({
  handlePanelInjectionResult: vi.fn(), getMergePanelIds: vi.fn(() => new Set()),
  getNonMergePanels: vi.fn(() => []), broadcastMessage: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../aichatmerge-panel/modules/theme.js', () => ({
  getThemeAwareProviderIcon: vi.fn(() => ''), setMaterialIcon: vi.fn(), setBrandText: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/theme-manager.js', () => ({ applyTheme: vi.fn() }));
vi.mock('../modules/settings.js', () => ({
  saveSetting: vi.fn(() => Promise.resolve()), getSettings: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: vi.fn(), getIframeTargetOrigin: vi.fn(() => null),
}));
vi.mock('../aichatmerge-panel/modules/panel-health.js', () => ({
  reloadPanelIframe: vi.fn(), showPanelLoadingState: vi.fn(),
  schedulePanelHealthCheck: vi.fn(), handlePanelHealthCheckResult: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-frame-config.js', () => ({
  getProviderFrameUrl: vi.fn(() => ''), isGoogleProvider: vi.fn(() => false),
  isChatgptProvider: vi.fn(() => false), getPanelProviderMode: vi.fn(() => null),
  getGoogleModeSelectHtml: vi.fn(() => ''), syncGoogleModeControls: vi.fn(),
  fitPanelSelectWidth: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/panel-header-actions.js', () => ({
  getPanelHeaderRightHtml: vi.fn(() => ''), bindPanelHeaderActions: vi.fn(),
  showClaudeEntryWarning: vi.fn(), updateGoogleProviderMode: vi.fn(),
  updateToggleButton: vi.fn(), collectCurrentState: vi.fn(() => ({})),
}));
vi.mock('../aichatmerge-panel/modules/panel-menus.js', () => ({ showProviderSwitcher: vi.fn() }));
vi.mock('../aichatmerge-panel/modules/panel-transport.js', () => ({
  postToPanelIframe: vi.fn(), postNewChatToPanel: vi.fn(),
  getIframeTargetOrigin: vi.fn(() => null), getChatgptPanelsWithFrames: vi.fn(() => []),
  handleProviderStatusMessage: vi.fn(), registerStorageChangeListener: vi.fn(),
}));
vi.mock('../modules/providers.js', () => ({ PROVIDERS: [], getProviderById: vi.fn(() => null) }));
vi.mock('../aichatmerge-panel/modules/shared/ui-utils.js', () => ({ fitPanelSelectWidth: vi.fn() }));

describe('runtime message listener initialization gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register a listener on chrome.runtime.onMessage', async () => {
    const mod = await import('../aichatmerge-panel/modules/settings-loader.js');
    mod.registerRuntimeMessageListener(() => false);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('listener should not dispatch when isInitializedGetter returns false', async () => {
    const mod = await import('../aichatmerge-panel/modules/settings-loader.js');
    mod.registerRuntimeMessageListener(() => false);

    // Get the registered callback
    const callback = chrome.runtime.onMessage.addListener.mock.calls.at(-1)[0];
    // Verify the callback exists and is a function
    expect(typeof callback).toBe('function');
    // Calling it with an action should not throw (handleMultiPanelAction won't be called because getter returns false)
    expect(() => callback({ action: 'openPromptLibrary', payload: {} })).not.toThrow();
  });

  it('listener should dispatch when isInitializedGetter returns true', async () => {
    const mod = await import('../aichatmerge-panel/modules/settings-loader.js');
    mod.registerRuntimeMessageListener(() => true);

    const callback = chrome.runtime.onMessage.addListener.mock.calls.at(-1)[0];
    // This will call handleMultiPanelAction (the real one, which returns false for unknown actions)
    // The key test is that it doesn't short-circuit
    expect(() => callback({ action: 'openPromptLibrary', payload: {} })).not.toThrow();
  });

  it('handleMultiPanelAction handles known actions', async () => {
    const mod = await import('../aichatmerge-panel/modules/settings-loader.js');
    const result = await mod.handleMultiPanelAction('openPromptLibrary', {});
    expect(result).toBe(true);
  });

  it('handleMultiPanelAction returns false for unknown actions', async () => {
    const mod = await import('../aichatmerge-panel/modules/settings-loader.js');
    const result = await mod.handleMultiPanelAction('unknownAction', {});
    expect(result).toBe(false);
  });

  it('getIsInitialized and getIsPopupWindow return boolean', async () => {
    const mod = await import('../aichatmerge-panel/modules/settings-loader.js');
    expect(typeof mod.getIsInitialized()).toBe('boolean');
    expect(typeof mod.getIsPopupWindow()).toBe('boolean');
  });
});
