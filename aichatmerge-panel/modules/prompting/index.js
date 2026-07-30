/**
 * Prompting module — public API.
 *
 * External consumers should import from this file.
 * Internal structure:
 *   - prompt-state.js     (internal state getters/setters — NOT exported)
 *   - prompt-library.js   (list, search, editor, variables, modal)
 *   - default-prompt.js   (default prompt bar, prepend, skip, send)
 */

export {
  renderPromptList,
  loadPromptLibrary,
  toggleFavorite,
  deletePromptDirect,
  selectPrompt,
  applyVariables,
  applyPromptToInput,
  openPromptModal,
  closeVariableModal,
  searchPromptLibrary,
  openPromptEditor,
  closePromptEditor,
  savePromptFromEditor,
  deletePromptFromEditor,
  closePromptModal,
  toggleFavoritesFilter,
  toggleRecentFilter,
  setCategoryFilter
} from './prompt-library.js';

export {
  updateDefaultPromptBar,
  prependDefaultPrompt,
  bindDefaultPromptEvents,
  sendMessageWithDefaultPrompt
} from './default-prompt.js';
