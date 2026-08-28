/**
 * Prompt library — thin re-export layer.
 * Actual code moved to prompting/ subdirectory:
 *   - prompting/prompt-library.js  (list, search, editor, variables, modal)
 *   - prompting/default-prompt.js  (default prompt bar, prepend, skip, send)
 *   - prompting/prompt-state.js    (internal state)
 *
 * This file re-exports for backward compatibility.
 * New code should import from './prompting/index.js'.
 */

export * from './prompting/index.js';
