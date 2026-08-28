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

  it('replaces {variable} in the default prompt content with the user input on send', async () => {
    mocks.getAllPrompts.mockResolvedValue([
      { id: 3, title: '模板', content: '不需要图表{variable}不需要图表', isDefault: true },
    ]);

    const { prependDefaultPrompt } = await import('../aichatmerge-panel/modules/prompting/default-prompt.js');

    // 模板模式：{variable} 替换为输入内容，整个提示词作为发送内容
    await expect(prependDefaultPrompt('测试,回复1')).resolves.toBe('不需要图表测试,回复1不需要图表');
  });

  it('keeps the constraint behavior for default prompts without {variable}', async () => {
    mocks.getAllPrompts.mockResolvedValue([
      { id: 4, title: '约束', content: '先按学习方式回答', isDefault: true },
    ]);

    const { prependDefaultPrompt } = await import('../aichatmerge-panel/modules/prompting/default-prompt.js');

    await expect(prependDefaultPrompt('用户问题')).resolves.toBe('先按学习方式回答\n\n用户问题');
  });
});
