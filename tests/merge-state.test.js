import { describe, it, expect, beforeEach } from 'vitest';

import {
  getSelectedMergeTarget,
  setSelectedMergeTarget,
  getLastSentQuestion,
  setLastSentQuestion,
} from '../aichatmerge-panel/modules/merge-state.js';

describe('merge-state getter/setter', () => {
  beforeEach(() => {
    // Reset to known defaults before each test
    setSelectedMergeTarget('deepseek');
    setLastSentQuestion('');
  });

  it('has correct default merge target', () => {
    expect(getSelectedMergeTarget()).toBe('deepseek');
  });

  it('has correct default last sent question', () => {
    expect(getLastSentQuestion()).toBe('');
  });

  it('setSelectedMergeTarget updates getSelectedMergeTarget', () => {
    setSelectedMergeTarget('chatgpt');
    expect(getSelectedMergeTarget()).toBe('chatgpt');
  });

  it('setLastSentQuestion updates getLastSentQuestion', () => {
    setLastSentQuestion('What is AI?');
    expect(getLastSentQuestion()).toBe('What is AI?');
  });

  it('handles empty string for merge target', () => {
    setSelectedMergeTarget('');
    expect(getSelectedMergeTarget()).toBe('');
  });

  it('handles empty string for last sent question', () => {
    setLastSentQuestion('previous question');
    setLastSentQuestion('');
    expect(getLastSentQuestion()).toBe('');
  });
});
