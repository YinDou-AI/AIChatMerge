import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLAUDE_ENTRY_URL,
  normalizeClaudeCustomEntryUrl
} from '../modules/claude-entry-url.js';

describe('Claude custom entry URL', () => {
  it('uses the documented default entry URL', () => {
    expect(DEFAULT_CLAUDE_ENTRY_URL).toBe('https://claude.ai/new');
  });

  it('accepts and normalizes a Claude conversation URL', () => {
    expect(normalizeClaudeCustomEntryUrl(' https://claude.ai/chat/example#fragment ')).toEqual({
      valid: true,
      value: 'https://claude.ai/chat/example'
    });
  });

  it('allows an empty value to restore the default entry', () => {
    expect(normalizeClaudeCustomEntryUrl('   ')).toEqual({ valid: true, value: '' });
  });

  it.each([
    'http://claude.ai/chat/example',
    'https://claude.ai.evil.example/chat/example',
    'javascript:alert(1)',
    'https://user:pass@claude.ai/chat/example'
  ])('rejects an unsafe or non-Claude URL: %s', (value) => {
    expect(normalizeClaudeCustomEntryUrl(value).valid).toBe(false);
  });
});
