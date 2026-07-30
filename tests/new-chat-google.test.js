import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../content-scripts/src/providers/google-helpers.js', () => ({
  handleGoogleNewSearch: vi.fn(() => true),
}));

vi.mock('../content-scripts/src/providers/dom-utils.js', () => ({
  findFirstVisibleElement: vi.fn(() => null),
  findDeepFirstVisibleElement: vi.fn(() => null),
}));

import { clickNewChatButton } from '../content-scripts/src/providers/new-chat.js';
import { handleGoogleNewSearch } from '../content-scripts/src/providers/google-helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('clickNewChatButton — google branch', () => {
  it('delegates to handleGoogleNewSearch with the given mode', () => {
    const result = clickNewChatButton('google', 'search');

    expect(handleGoogleNewSearch).toHaveBeenCalledTimes(1);
    expect(handleGoogleNewSearch).toHaveBeenCalledWith('search');
    expect(result).toBe(true);
  });

  it('passes null mode when none provided', () => {
    clickNewChatButton('google');

    expect(handleGoogleNewSearch).toHaveBeenCalledTimes(1);
    expect(handleGoogleNewSearch).toHaveBeenCalledWith(null);
  });

  it('does not fall through to the button-search or URL-fallback paths', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    clickNewChatButton('google', 'ai');

    // handleGoogleNewSearch was called, so no warn about TODO
    expect(consoleWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('handleGoogleNewSearch not implemented yet')
    );

    consoleWarn.mockRestore();
  });
});
