// Shared state for aichatmerge-panel modules

// Panel layout state
let currentLayout = '1x3';
let panels = [];
let currentPanelPage = 0;
let loadingPanelIds = new Set();
let isInitializing = false;

// Provider mode state
let currentGoogleProviderMode = 'ai';
let claudeCustomEntryUrl = '';

// Merge state is owned by merge-monitor.js (single source of truth)
// Do NOT duplicate mergeIsActive, lastMergeType, AUTO_MERGE_ENABLED here

// Getters and setters
export function getPanels() { return panels; }
export function setPanels(value) { panels = value; }
export function getCurrentLayout() { return currentLayout; }
export function setCurrentLayout(layout) { currentLayout = layout; }
export function getCurrentPanelPage() { return currentPanelPage; }
export function setCurrentPanelPage(page) { currentPanelPage = page; }
export function getLoadingPanelIds() { return loadingPanelIds; }
export function getIsInitializing() { return isInitializing; }
export function setIsInitializing(val) { isInitializing = val; }
export function getCurrentGoogleProviderMode() { return currentGoogleProviderMode; }
export function setCurrentGoogleProviderMode(mode) { currentGoogleProviderMode = mode; }
export function getClaudeEntryUrl() { return claudeCustomEntryUrl; }
export function setClaudeEntryUrl(url) { claudeCustomEntryUrl = url; }
