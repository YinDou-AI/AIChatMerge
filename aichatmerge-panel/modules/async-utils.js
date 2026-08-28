/**
 * Async timing helpers.
 * Pure module for shared delay logic.
 */

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
