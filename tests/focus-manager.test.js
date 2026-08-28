import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../aichatmerge-panel/modules/state.js', () => ({
  getPanels: vi.fn(() => []),
  getLoadingPanelIds: vi.fn(() => new Set(['loading-panel']))
}));

vi.mock('../aichatmerge-panel/modules/merge-panel-registry.js', () => ({
  getMergePanelIds: vi.fn(() => new Set())
}));

vi.mock('../aichatmerge-panel/modules/panel-new-chat.js', () => ({
  postNewChatToPanel: vi.fn()
}));

import {
  cancelUnifiedInputFocusRestore,
  cancelUnifiedInputFocusRestoreAfterSend,
  handleUnifiedInputBlur,
  isRestoringFocusAfterSendGetter,
  restoreUnifiedInputFocusAfterSend
} from '../aichatmerge-panel/modules/focus-manager.js';

describe('unified input focus ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelUnifiedInputFocusRestore();
    cancelUnifiedInputFocusRestoreAfterSend();
    document.body.innerHTML = `
      <textarea id="unified-input"></textarea>
      <iframe id="provider-frame"></iframe>
    `;
  });

  it('respects a mouse click that moves focus into a provider iframe', () => {
    const input = document.getElementById('unified-input');
    const iframe = document.getElementById('provider-frame');
    vi.spyOn(iframe, 'matches').mockImplementation(selector => selector === ':hover');

    input.focus();
    restoreUnifiedInputFocusAfterSend();
    expect(isRestoringFocusAfterSendGetter()).toBe(true);

    handleUnifiedInputBlur({ relatedTarget: iframe });
    iframe.focus();
    vi.runAllTimers();

    expect(isRestoringFocusAfterSendGetter()).toBe(false);
    expect(document.activeElement).toBe(iframe);
  });

  it('still protects the unified input from an unhovered iframe autofocus', () => {
    const input = document.getElementById('unified-input');
    const iframe = document.getElementById('provider-frame');
    vi.spyOn(iframe, 'matches').mockReturnValue(false);

    input.focus();
    restoreUnifiedInputFocusAfterSend();
    handleUnifiedInputBlur({ relatedTarget: iframe });
    iframe.focus();
    vi.runAllTimers();

    expect(document.activeElement).toBe(input);
  });
});
