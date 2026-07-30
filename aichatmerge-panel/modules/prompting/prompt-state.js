/**
 * Prompt module internal state.
 * Separated to avoid circular dependencies between prompt-library and default-prompt.
 *
 * INTERNAL ONLY — do NOT re-export from prompting/index.js.
 * External consumers must use business actions from prompt-library.js / default-prompt.js.
 */

let currentPromptFilter = 'all';
let currentCategoryFilter = '';
let selectedPromptForVariables = null;
let skipDefaultPromptOnce = false;
let currentEditingPromptId = null;

export function getCurrentPromptFilter() { return currentPromptFilter; }
export function setCurrentPromptFilter(v) { currentPromptFilter = v; }
export function getCurrentCategoryFilter() { return currentCategoryFilter; }
export function setCurrentCategoryFilter(v) { currentCategoryFilter = v; }
export function getSelectedPromptForVariables() { return selectedPromptForVariables; }
export function setSelectedPromptForVariables(v) { selectedPromptForVariables = v; }
export function getSkipDefaultPromptOnce() { return skipDefaultPromptOnce; }
export function setSkipDefaultPromptOnce(v) { skipDefaultPromptOnce = v; }
export function getCurrentEditingPromptId() { return currentEditingPromptId; }
export function setCurrentEditingPromptId(v) { currentEditingPromptId = v; }
