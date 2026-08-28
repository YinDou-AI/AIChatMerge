/**
 * Discussion engine — thin re-export layer.
 * Actual code split into:
 *   - discussion-runner.js  (main discussion flow, status bar, stop)
 *   - discussion-gates.js   (wait conditions, stability detection)
 *
 * This file re-exports for backward compatibility.
 * New code should import directly from the domain modules.
 */

export * from './discussion-runner.js';
export * from './discussion-gates.js';
