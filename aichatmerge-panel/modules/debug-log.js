// Formal-release replacement for debug-log.js.
//
// Keep this module's public API compatible with the development implementation
// so business modules never need release-only branches. It intentionally has no
// imports, persistence, downloads, timers, listeners, or diagnostic state.

const DISABLED_SESSION_ID = 'diagnostics-disabled';
const RESOLVED_QUEUE = Promise.resolve();

export function rotateDebugSession() {
  return DISABLED_SESSION_ID;
}

export function getDebugSessionId() {
  return DISABLED_SESSION_ID;
}

export function getDebugLogWriteQueue() {
  return RESOLVED_QUEUE;
}

export function setMergePanelIds() {}
export function setDiscussionWillRun() {}
export function getPanelDebugInfo() { return null; }
export function sanitizeDebugDetails() { return {}; }
export async function recordDebugLog() {}
export async function downloadDebugLogs() {}
export async function clearDebugLogs() {}

// Compatibility exports used by debug-only tests and tooling in the source
// tree. They remain inert if an old caller imports them in a formal package.
export function getDebugLogDetails() { return {}; }
export function compactDebugValue() { return null; }
export function compactDebugLog() { return null; }
export function isDebugIssueEvent() { return false; }
export function isDebugKeyEvent() { return false; }
export function buildDebugEventCounts() { return []; }
export function getDebugIssueSeverity() { return null; }
export function extractDebugIssues() { return []; }
export function summarizeDebugSessions() { return []; }
export function buildDebugAiPayload() { return null; }
