/**
 * Merge-related UI state: selected merge target, last sent question.
 * Extracted from merge-engine.js to separate state from action.
 */

let selectedMergeTarget = 'deepseek';
let lastSentQuestion = '';

export function getSelectedMergeTarget() { return selectedMergeTarget; }
export function setSelectedMergeTarget(value) { selectedMergeTarget = value; }
export function getLastSentQuestion() { return lastSentQuestion; }
export function setLastSentQuestion(value) { lastSentQuestion = value; }
