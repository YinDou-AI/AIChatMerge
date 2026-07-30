import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAllPrompts: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../modules/prompt-manager.js', () => ({
  getAllPrompts: mocks.getAllPrompts,
}));

vi.mock('../aichatmerge-panel/modules/toast.js', () => ({
  showToast: mocks.showToast,
}));

describe('default prompt bar', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="default-prompt-bar" style="display: none;">
        <span id="default-prompt-title"></span>
        <button id="skip-default-prompt-btn">跳过</button>
      </div>
    `;
    mocks.getAllPrompts.mockResolvedValue([
      { id: 1, title: '学习', content: '先按学习方式回答', isDefault: true },
    ]);
  });

  it('hides the default prompt bar after skip and restores it after sending once', async () => {
    const {
      updateDefaultPromptBar,
      bindDefaultPromptEvents,
      sendMessageWithDefaultPrompt,
    } = await import('../aichatmerge-panel/modules/prompting/default-prompt.js');

    await updateDefaultPromptBar();
    expect(document.getElementById('default-prompt-bar').style.display).toBe('flex');

    bindDefaultPromptEvents();
    document.getElementById('skip-default-prompt-btn').click();
    await Promise.resolve();
    expect(document.getElementById('default-prompt-bar').style.display).toBe('none');

    const broadcastMessage = vi.fn();
    await sendMessageWithDefaultPrompt('用户问题', broadcastMessage);

    expect(broadcastMessage).toHaveBeenCalledWith('用户问题', true, null);
    expect(document.getElementById('default-prompt-bar').style.display).toBe('flex');
  });

  it('does not prepend an empty legacy default prompt', async () => {
    mocks.getAllPrompts.mockResolvedValue([
      { id: 2, title: '旧数据', content: null, isDefault: true },
    ]);

    const { prependDefaultPrompt } = await import('../aichatmerge-panel/modules/prompting/default-prompt.js');

    await expect(prependDefaultPrompt('用户问题')).resolves.toBe('用户问题');
  });
});
