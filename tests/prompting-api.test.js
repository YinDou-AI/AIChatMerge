import { describe, it, expect } from 'vitest';

import * as promptingApi from '../aichatmerge-panel/modules/prompting/index.js';

describe('prompting API surface', () => {
  const publicApi = [
    'renderPromptList',
    'loadPromptLibrary',
    'toggleFavorite',
    'deletePromptDirect',
    'selectPrompt',
    'applyVariables',
    'applyPromptToInput',
    'openPromptModal',
    'closeVariableModal',
    'searchPromptLibrary',
    'openPromptEditor',
    'closePromptEditor',
    'savePromptFromEditor',
    'deletePromptFromEditor',
    'closePromptModal',
    'toggleFavoritesFilter',
    'toggleRecentFilter',
    'setCategoryFilter',
    'updateDefaultPromptBar',
    'prependDefaultPrompt',
    'bindDefaultPromptEvents',
    'sendMessageWithDefaultPrompt',
  ];

  it('exports all documented public functions', () => {
    for (const name of publicApi) {
      expect(typeof promptingApi[name]).toBe('function');
    }
  });

  it('does not expose internal prompt-state getters/setters', () => {
    const internalState = [
      'getCurrentPromptFilter',
      'setCurrentPromptFilter',
      'getCurrentCategoryFilter',
      'setCurrentCategoryFilter',
      'getSelectedPromptForVariables',
      'setSelectedPromptForVariables',
      'getSkipDefaultPromptOnce',
      'setSkipDefaultPromptOnce',
      'getCurrentEditingPromptId',
      'setCurrentEditingPromptId',
    ];
    for (const name of internalState) {
      expect(promptingApi[name]).toBeUndefined();
    }
  });

  it('does not re-export prompt-state module directly', () => {
    const keys = Object.keys(promptingApi);
    // prompt-state functions should not appear in the public API at all
    const leaked = keys.filter(k => k.startsWith('getCurrent') || k.startsWith('setCurrent') || k.startsWith('getSkip') || k.startsWith('setSkip'));
    expect(leaked).toHaveLength(0);
  });

  it('total exported count matches documented surface', () => {
    const keys = Object.keys(promptingApi);
    expect(keys.length).toBe(publicApi.length);
  });
});
