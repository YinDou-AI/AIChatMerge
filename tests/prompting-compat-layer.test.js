/**
 * Regression tests for prompting backward-compat layer.
 *
 * After Task B, multi-panel.js imports from prompting/index.js directly.
 * The compat layer (prompt-library.js) re-exports prompting/index.js
 * for any remaining old import paths.
 *
 * This test verifies:
 * 1. The compat layer re-exports the same API as prompting/index.js
 * 2. Old import path 'prompt-library.js' still resolves correctly
 * 3. No internal state leaks through either path
 */

import { describe, it, expect } from 'vitest';

import * as promptingIndex from '../aichatmerge-panel/modules/prompting/index.js';
import * as promptLibraryCompat from '../aichatmerge-panel/modules/prompt-library.js';

describe('prompting backward-compat layer', () => {
  it('compat layer exports same keys as prompting/index.js', () => {
    const indexKeys = Object.keys(promptingIndex).sort();
    const compatKeys = Object.keys(promptLibraryCompat).sort();
    expect(compatKeys).toEqual(indexKeys);
  });

  it('compat layer exports are functionally identical', () => {
    for (const key of Object.keys(promptingIndex)) {
      expect(promptLibraryCompat[key]).toBe(promptingIndex[key]);
    }
  });

  it('compat layer does not expose internal prompt-state getters/setters', () => {
    const internalNames = [
      'getCurrentPromptFilter', 'setCurrentPromptFilter',
      'getCurrentCategoryFilter', 'setCurrentCategoryFilter',
      'getSelectedPromptForVariables', 'setSelectedPromptForVariables',
      'getSkipDefaultPromptOnce', 'setSkipDefaultPromptOnce',
      'getCurrentEditingPromptId', 'setCurrentEditingPromptId',
    ];
    for (const name of internalNames) {
      expect(promptLibraryCompat[name]).toBeUndefined();
    }
  });

  it('both paths export the same documented public API count', () => {
    // Both should export exactly 22 business action functions
    expect(Object.keys(promptingIndex).length).toBe(22);
    expect(Object.keys(promptLibraryCompat).length).toBe(22);
  });
});
