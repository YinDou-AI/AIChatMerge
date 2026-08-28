import { describe, it, expect, vi } from 'vitest';

// Reproduces: if prependDefaultPrompt (IndexedDB) rejects, sendMessageWithDefaultPrompt
// swallows it and broadcastMessage is NEVER called. Matches the debug log where
// merge-monitor:start appears but broadcast:start never does.
vi.mock('../modules/prompt-manager.js', () => ({
  getAllPrompts: vi.fn(() => Promise.reject(new Error('IDB open failed'))),
}));

describe('send pipeline resilience to prompt-store failure', () => {
  it('still calls broadcastMessage even if default-prompt lookup rejects', async () => {
    const { sendMessageWithDefaultPrompt } = await import('../aichatmerge-panel/modules/prompting/default-prompt.js');
    const broadcast = vi.fn();
    await sendMessageWithDefaultPrompt('hello world', broadcast);
    expect(broadcast).toHaveBeenCalledWith('hello world', true, null);
  });

  it('preserves the merge session id when broadcasting after default prompt handling', async () => {
    const { sendMessageWithDefaultPrompt } = await import('../aichatmerge-panel/modules/prompting/default-prompt.js');
    const broadcast = vi.fn();
    await sendMessageWithDefaultPrompt('hello world', broadcast, true, 'merge-session-1');
    expect(broadcast).toHaveBeenCalledWith('hello world', true, 'merge-session-1');
  });
});
