import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  panels: [{ id: 'panel-a', providerId: 'chatgpt' }],
  mergePanelIds: new Set(['panel-merge']),
  startMergeMonitor: vi.fn(),
  stopMergeMonitor: vi.fn(),
  setLastSentQuestion: vi.fn(),
  sendMessageWithDefaultPrompt: vi.fn(),
  broadcastMessage: vi.fn(),
  triggerMerge: vi.fn(async () => {}),
}));

vi.mock('../aichatmerge-panel/modules/i18n.js', () => ({ t: vi.fn(key => key) }));
vi.mock('../aichatmerge-panel/modules/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../aichatmerge-panel/modules/focus-manager.js', () => ({
  focusUnifiedInput: vi.fn(),
  handleUnifiedInputBlur: vi.fn(),
  shouldPreserveUnifiedInputFocus: vi.fn(() => false),
  isUnifiedInputOrNewChatControl: vi.fn(() => false),
  isUnifiedInputOrSendControl: vi.fn(() => false),
  isPromptEditorInteractiveControl: vi.fn(() => false),
  cancelUnifiedInputFocusRestore: vi.fn(),
  cancelUnifiedInputFocusRestoreAfterSend: vi.fn(),
  isRestoringFocusAfterNewChatGetter: vi.fn(() => false),
  isRestoringFocusAfterSendGetter: vi.fn(() => false),
}));
vi.mock('../aichatmerge-panel/modules/markdown-export.js', () => ({ handleManualExport: vi.fn() }));
vi.mock('../aichatmerge-panel/modules/state.js', () => ({
  getPanels: vi.fn(() => mocks.panels),
  getCurrentLayout: vi.fn(() => '1x3'),
  getCurrentPanelPage: vi.fn(() => 0),
  setCurrentPanelPage: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/layout-config.js', () => ({
  getTotalPages: vi.fn(() => 1),
}));
vi.mock('../aichatmerge-panel/modules/panel-lifecycle.js', () => ({
  renderCurrentPage: vi.fn(),
  setLayout: vi.fn(),
  updateScrollArrows: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/merge-state.js', () => ({
  setLastSentQuestion: mocks.setLastSentQuestion,
}));
vi.mock('../aichatmerge-panel/modules/merge-engine.js', () => ({ triggerMerge: mocks.triggerMerge }));
vi.mock('../aichatmerge-panel/modules/discussion-runner.js', () => ({
  getDiscussionActive: vi.fn(() => false),
  stopDiscussion: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/merge-monitor.js', () => ({
  setLastMergeType: vi.fn(),
  getAutoMergeEnabled: vi.fn(() => true),
  startMergeMonitor: mocks.startMergeMonitor,
  stopMergeMonitor: mocks.stopMergeMonitor,
}));
vi.mock('../aichatmerge-panel/modules/prompting/index.js', () => ({
  searchPromptLibrary: vi.fn(),
  renderPromptList: vi.fn(),
  toggleFavoritesFilter: vi.fn(),
  toggleRecentFilter: vi.fn(),
  setCategoryFilter: vi.fn(),
  closeVariableModal: vi.fn(),
  applyVariables: vi.fn(),
  openPromptEditor: vi.fn(),
  closePromptEditor: vi.fn(),
  savePromptFromEditor: vi.fn(),
  deletePromptFromEditor: vi.fn(),
  openPromptModal: vi.fn(),
  closePromptModal: vi.fn(),
  sendMessageWithDefaultPrompt: mocks.sendMessageWithDefaultPrompt,
}));
vi.mock('../aichatmerge-panel/modules/send-pipeline.js', () => ({
  broadcastMessage: mocks.broadcastMessage,
  newChatAllProviders: vi.fn(),
  getMergePanelIds: vi.fn(() => mocks.mergePanelIds),
}));
vi.mock('../aichatmerge-panel/modules/settings-loader.js', () => ({ toggleOpenMode: vi.fn() }));
vi.mock('../aichatmerge-panel/modules/panel-transport.js', () => ({ handleProviderStatusMessage: vi.fn() }));
vi.mock('../aichatmerge-panel/modules/panel-menus.js', () => ({
  showAddPanelMenu: vi.fn(),
  showMergeTargetMenu: vi.fn(),
}));
vi.mock('../aichatmerge-panel/modules/layout-controls.js', () => ({
  openLayoutModal: vi.fn(),
  closeLayoutModal: vi.fn(),
}));

function buildPanelDom() {
  document.body.innerHTML = `
    <button id="layout-btn"></button>
    <button id="close-layout-modal"></button>
    <button class="layout-option" data-layout="1x3"></button>
    <button id="add-panel-btn"></button>
    <button id="scroll-left-btn"></button>
    <button id="scroll-right-btn"></button>
    <button id="obsidian-export-btn"></button>
    <button id="new-chat-btn"></button>
    <button id="settings-btn"></button>
    <button id="toggle-open-mode-btn"></button>
    <button id="prompt-library-btn"></button>
    <button id="close-prompt-modal"></button>
    <input id="prompt-search">
    <select id="prompt-category-filter"></select>
    <button id="prompt-favorites-btn"></button>
    <button id="prompt-recent-btn"></button>
    <button id="close-variable-modal"></button>
    <button id="cancel-variable-btn"></button>
    <button id="apply-variable-btn"></button>
    <div id="variable-modal"></div>
    <button id="send-all-btn"></button>
    <button id="merge-btn"></button>
    <button id="stop-discussion-btn"></button>
    <button id="merge-target-btn"></button>
    <textarea id="unified-input"></textarea>
    <div id="layout-modal"></div>
    <div id="prompt-modal"></div>
    <button id="close-prompt-editor"></button>
    <button id="cancel-prompt-editor"></button>
    <button id="save-prompt-btn"></button>
    <button id="delete-prompt-btn"></button>
    <button id="new-prompt-btn"></button>
    <div id="prompt-editor-modal"></div>
  `;
}

describe('panel UI auto-merge entry wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildPanelDom();
  });

  it('send button follows zcode path: starts monitor, then sends without passing mergeSessionId', async () => {
    const { setupEventListeners } = await import('../aichatmerge-panel/modules/panel-ui-bindings.js');
    const input = document.getElementById('unified-input');
    input.value = 'hello';

    setupEventListeners();
    document.getElementById('send-all-btn').click();

    expect(mocks.setLastSentQuestion).toHaveBeenCalledWith('hello');
    expect(mocks.startMergeMonitor).toHaveBeenCalledWith(
      expect.stringMatching(/^merge-/),
      mocks.panels,
      mocks.mergePanelIds
    );
    expect(mocks.sendMessageWithDefaultPrompt).toHaveBeenCalledWith(
      'hello',
      mocks.broadcastMessage,
      true
    );
  });

  it('enter key path starts monitor and passes mergeSessionId through the send pipeline', async () => {
    const { setupEventListeners } = await import('../aichatmerge-panel/modules/panel-ui-bindings.js');
    const input = document.getElementById('unified-input');
    input.value = 'hello';

    setupEventListeners();
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));

    const mergeSessionId = mocks.startMergeMonitor.mock.calls[0][0];
    expect(mergeSessionId).toMatch(/^merge-/);
    expect(mocks.sendMessageWithDefaultPrompt).toHaveBeenCalledWith(
      'hello',
      mocks.broadcastMessage,
      true,
      mergeSessionId
    );
  });

  it('disables manual merge while extraction is in progress and ignores repeated clicks', async () => {
    let finishMerge;
    mocks.triggerMerge.mockImplementationOnce(() => new Promise(resolve => {
      finishMerge = resolve;
    }));
    const { setupEventListeners } = await import('../aichatmerge-panel/modules/panel-ui-bindings.js');
    setupEventListeners();

    const mergeBtn = document.getElementById('merge-btn');
    mergeBtn.click();
    mergeBtn.click();

    expect(mergeBtn.disabled).toBe(true);
    expect(mergeBtn.classList.contains('active')).toBe(true);
    expect(mergeBtn.getAttribute('aria-busy')).toBe('true');
    expect(mocks.triggerMerge).toHaveBeenCalledTimes(1);

    finishMerge();
    await Promise.resolve();
    await Promise.resolve();

    expect(mergeBtn.disabled).toBe(false);
    expect(mergeBtn.classList.contains('active')).toBe(false);
    expect(mergeBtn.getAttribute('aria-busy')).toBe('false');
  });
});
