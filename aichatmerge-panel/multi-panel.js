/**
 * Multi-Panel AI Comparison - Main JavaScript
 *
 * This module implements the multi-panel AI comparison feature,
 * allowing users to compare responses from multiple AI providers side by side.
 */

import { PROVIDERS, getProviderById, getProviderIcon } from '../modules/providers.js';
import { DEFAULT_PROVIDER_IDS } from '../modules/provider-defaults.js';
import {
  DEFAULT_GOOGLE_PROVIDER_MODE,
  GOOGLE_PROVIDER_MODE_AI,
  GOOGLE_PROVIDER_MODE_SEARCH,
  getGoogleProviderUrl,
  normalizeGoogleProviderMode
} from '../modules/google-mode.js';
import { saveSetting, getSettings } from '../modules/settings.js';
import {
  CLAUDE_CUSTOM_ENTRY_URL_KEY,
  getClaudeCustomEntryUrl
} from '../modules/claude-entry-url.js';
import { applyTheme } from '../modules/theme-manager.js';
import {
  getAllPrompts,
  searchPrompts,
  recordPromptUsage,
  getRecentlyUsedPrompts,
  getFavoritePrompts,
  savePrompt,
  updatePrompt,
  deletePrompt,
  getPrompt,
  setDefaultPrompt,
  clearDefaultPrompt
} from '../modules/prompt-manager.js';
import { exportToMarkdown, extractTitle as markdownExtractTitle, cleanAnswer as markdownCleanAnswer, extractScores } from '../modules/obsidian-export.js';
import { saveScoreHistory } from '../modules/score-manager.js';

function setMaterialIcon(iconEl, iconName) {
  if (!iconEl || !iconName) return;
  iconEl.dataset.icon = iconName;
  iconEl.classList.add('notranslate');
  iconEl.setAttribute('translate', 'no');
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = '';
}

function setBrandText(element, text) {
  if (!element) return;
  element.textContent = text || '';
  element.classList.add('notranslate');
  element.setAttribute('translate', 'no');
}


// ===== I18N System =====
const I18N = {
  zh: {
    // Bottom bar buttons
    sendAll: '发送',
    merge: '融合',
    copy: '复制',
    addPanel: '添加面板',
    newChat: '新建对话',
    layout: '布局',
    settings: '设置',
    mergeTarget: '融合目标',
    switchToPopupMode: '弹窗模式',
    switchToTabMode: '标签页模式',
    switchToPopupModeTitle: '切换到弹窗模式',
    switchToTabModeTitle: '切换到标签页模式',
    // Input area
    inputPlaceholder: '输入你的问题，同时发送给所有AI...',
    promptLibrary: '提示词库',
    sendToAllAI: '发送给所有AI',
    mergeTooltip: '融合总结：收集所有回答并发送给目标 AI 融合',
    mergeTargetAI: '融合目标 AI',
    mergeTimeoutTooltip: '超时触发，可在设置中调整等待时间',
    // Panel header
    copyLink: '复制链接',
    refresh: '刷新',
    home: '回到首页',
    maximize: '放大',
    restore: '还原',
    switchProvider: '切换提供商',
    close: '关闭',
    // Scroll arrows
    prevPage: '上一页',
    nextPage: '下一页',
    // Layout modal
    selectLayout: '选择布局',
    singlePanel: '单面板',
    twoPanels: '两面板',
    threePanels: '三面板',
    fourPanels: '四面板',
    fivePanels: '五面板',
    // Prompt library modal
    promptLibraryTitle: '提示词库',
    newPrompt: '新建提示词',
    searchPrompts: '搜索提示词...',
    allCategories: '所有分类',
    showFavoritesOnly: '仅显示收藏',
    recentUsed: '最近使用',
    noMatchingPrompts: '没有匹配的提示词',
    noPrompts: '暂无提示词',
    failedToLoadPrompts: '加载提示词失败',
    // Prompt editor modal
    editPrompt: '编辑提示词',
    newPromptTitle: '新建提示词',
    title: '标题',
    titlePlaceholder: '输入提示词标题...',
    content: '内容',
    contentPlaceholder: '输入提示词内容... 使用 {variable} 作为变量',
    category: '分类',
    categoryPlaceholder: '例如：写作、编程、调研',
    tags: '标签（逗号分隔）',
    tagsPlaceholder: '例如：写作、创意、博客',
    delete: '删除',
    cancel: '取消',
    save: '保存',
    // Variable modal
    fillVariables: '填写变量',
    variableInstruction: '此提示词包含变量，请填写：',
    apply: '应用',
    // Toast messages
    minOnePanel: '至少需要保留一个面板',
    clearedAllInputs: '已清空所有输入',
    newChatCreated: '已为所有AI创建新对话',
    panelNewChatCreated: '已为当前面板创建新对话',
    promptSaved: '提示词保存成功',
    promptUpdated: '提示词更新成功',
    promptDeleted: '提示词已删除',
    promptSaveFailed: '保存提示词失败',
    promptDeleteFailed: '删除提示词失败',
    promptLoadFailed: '加载提示词失败',
    titleContentRequired: '标题和内容为必填项',
    confirmDeletePrompt: '确定要删除这个提示词吗？',
    loadingProvider: '加载 $1 中...',
    providerLoadFailed: '$1 加载失败',
    allAIAnswered: '所有AI回答完成，开始融合',
    waitTimeout: '等待超时，开始融合',
    claudeEntryWarning: 'Claude 入口异常时，可在高级设置中填写备用页面网址。',
    openSettings: '高级设置',
    dismiss: '暂时关闭',
    // Status messages
    sending: '发送中...',
    filling: '填入中...',
    sentToAI: '已发送',
    filledToInput: '已填入',
    sentToPartial: '已发送',
    filledPartial: '已填入',
    sendFailed: '发送失败',
    fillFailed: '填入失败',
    errorOccurred: '发生错误',
    addedBadge: '已添加',
    varInputPlaceholder: '输入 $1 的值',
    clickToRetry: '点击重试',
    retrying: '正在重试...',
    autoMerge: '自动融合',
    timeoutMerge: '超时融合',
    manualMerge: '手动融合',
    // Markdown export
    obsidianExport: '导出 Markdown',
    obsidianExporting: '正在导出 Markdown...',
    obsidianExportSuccess: '已导出 Markdown: $1',
    obsidianExportFailed: '导出 Markdown 失败: $1',
    discussionProgress: '讨论中',
    discussionProgressInitial: '讨论中',
    stopDiscussion: '停止讨论',
    msgDiscussionStopped: '讨论已停止',
    defaultPromptEnabled: '已启用',
    skipDefaultPrompt: '跳过',
    setDefaultPrompt: '设为默认',
    cancelDefaultPrompt: '取消默认',
  },
  en: {
    // Bottom bar buttons
    sendAll: 'Send All',
    merge: 'Merge',
    copy: 'Copy',
    addPanel: 'Add Panel',
    newChat: 'New Chat',
    layout: 'Layout',
    settings: 'Settings',
    mergeTarget: 'Merge Target',
    switchToPopupMode: 'Popup Mode',
    switchToTabMode: 'Tab Mode',
    switchToPopupModeTitle: 'Switch to popup mode',
    switchToTabModeTitle: 'Switch to tab mode',
    // Input area
    inputPlaceholder: 'Enter your question to send to all AIs...',
    promptLibrary: 'Prompt Library',
    sendToAllAI: 'Send to all AIs',
    mergeTooltip: 'Merge: collect all answers and send to target AI for fusion',
    mergeTargetAI: 'Merge Target AI',
    mergeTimeoutTooltip: 'Timeout triggered. Adjust wait time in settings.',
    // Panel header
    copyLink: 'Copy Link',
    refresh: 'Refresh',
    home: 'Home',
    maximize: 'Maximize',
    restore: 'Restore',
    switchProvider: 'Switch Provider',
    close: 'Close',
    // Scroll arrows
    prevPage: 'Previous Page',
    nextPage: 'Next Page',
    // Layout modal
    selectLayout: 'Select Layout',
    singlePanel: 'Single Panel',
    twoPanels: 'Two Panels',
    threePanels: 'Three Panels',
    fourPanels: 'Four Panels',
    fivePanels: 'Five Panels',
    // Prompt library modal
    promptLibraryTitle: 'Prompt Library',
    newPrompt: 'New Prompt',
    searchPrompts: 'Search prompts...',
    allCategories: 'All Categories',
    showFavoritesOnly: 'Show Favorites Only',
    recentUsed: 'Recently Used',
    noMatchingPrompts: 'No matching prompts',
    noPrompts: 'No prompts yet',
    failedToLoadPrompts: 'Failed to load prompts',
    // Prompt editor modal
    editPrompt: 'Edit Prompt',
    newPromptTitle: 'New Prompt',
    title: 'Title',
    titlePlaceholder: 'Enter prompt title...',
    content: 'Content',
    contentPlaceholder: 'Enter prompt content... Use {variable} for variables',
    category: 'Category',
    categoryPlaceholder: 'e.g. Writing, Coding, Research',
    tags: 'Tags (comma separated)',
    tagsPlaceholder: 'e.g. Writing, Creative, Blog',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save',
    // Variable modal
    fillVariables: 'Fill Variables',
    variableInstruction: 'This prompt contains variables, please fill in:',
    apply: 'Apply',
    // Toast messages
    minOnePanel: 'At least one panel is required',
    clearedAllInputs: 'All inputs cleared',
    newChatCreated: 'New chat created for all AIs',
    panelNewChatCreated: 'New chat created for this panel',
    promptSaved: 'Prompt saved successfully',
    promptUpdated: 'Prompt updated successfully',
    promptDeleted: 'Prompt deleted',
    promptSaveFailed: 'Failed to save prompt',
    promptDeleteFailed: 'Failed to delete prompt',
    promptLoadFailed: 'Failed to load prompt',
    titleContentRequired: 'Title and content are required',
    confirmDeletePrompt: 'Are you sure you want to delete this prompt?',
    loadingProvider: 'Loading $1...',
    providerLoadFailed: '$1 failed to load',
    allAIAnswered: 'All AIs answered, starting merge',
    waitTimeout: 'Wait timeout, starting merge',
    claudeEntryWarning: 'Claude uses the new-chat page by default. If it still fails, set a fallback page URL in Advanced Settings.',
    openSettings: 'Advanced Settings',
    dismiss: 'Dismiss for Now',
    // Status messages
    sending: 'Sending...',
    filling: 'Filling...',
    sentToAI: 'Sent',
    filledToInput: 'Filled',
    sentToPartial: 'Sent',
    filledPartial: 'Filled',
    sendFailed: 'Send failed',
    fillFailed: 'Fill failed',
    errorOccurred: 'An error occurred',
    addedBadge: 'Added',
    varInputPlaceholder: 'Enter value for $1',
    clickToRetry: 'Click to retry',
    retrying: 'Retrying...',
    autoMerge: 'Auto Merge',
    timeoutMerge: 'Timeout Merge',
    manualMerge: 'Manual Merge',
    // Markdown export
    obsidianExport: 'Export Markdown',
    obsidianExporting: 'Exporting Markdown...',
    obsidianExportSuccess: 'Exported Markdown: $1',
    obsidianExportFailed: 'Markdown export failed: $1',
    discussionProgress: 'Discussing',
    discussionProgressInitial: 'Discussing',
    stopDiscussion: 'Stop Discussion',
    msgDiscussionStopped: 'Discussion stopped',
    defaultPromptEnabled: 'Enabled',
    skipDefaultPrompt: 'Skip',
    setDefaultPrompt: 'Set as Default',
    cancelDefaultPrompt: 'Cancel Default',
  }
};

let currentLocale = 'zh';

function t(key, ...subs) {
  let msg = I18N[currentLocale]?.[key] || I18N.zh[key] || key;
  subs.forEach((sub, i) => {
    msg = msg.replace(`$${i + 1}`, sub);
  });
  return msg;
}

function detectLocale() {
  return navigator.language.startsWith('en') ? 'en' : 'zh';
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', t(key));
  });
  // 重新渲染所有面板的 header-right（动态生成的 title 需要更新）
  document.querySelectorAll('.panel-item').forEach(panelEl => {
    const providerId = panelEl.dataset.providerId;
    if (providerId) {
      const headerRight = panelEl.querySelector('.panel-header-right');
      if (headerRight) {
        headerRight.textContent = ''; // clear existing children safely
        headerRight.innerHTML = getPanelHeaderRightHtml(providerId);
        bindPanelHeaderActions(panelEl.id);
      }
    }
  });
}

// ===== State Management =====
let currentLayout = '1x3';
let panels = []; // Array of { id, providerId, iframe, state }
const pendingPanelInjections = new Map();
let currentPanelPage = 0; // 当前页码，从0开始
let loadingPanelIds = new Set(); // Track iframes still loading, used for focus protection
let newChatFocusRestoreTimerIds = [];
let isRestoringFocusAfterNewChat = false;
let sendFocusRestoreTimerIds = [];
let isRestoringFocusAfterSend = false;
let activeSendFocusRequestId = null;
let sendFocusRequestCounter = 0;
let sendFocusActivePanelIds = new Set();
let sendFocusBusyDetectionTimeoutIds = new Map();
let sendFocusHardTimeoutIds = new Map();
let selectedMergeTarget = 'deepseek';
let answerExtractionRequestId = 0;
let pendingAnswerExtractions = new Map();
let isExtractingAnswers = false;
let extractionDepth = 0; // 引用计数，防止并发 extractMode 切换
let pendingExtractionPromise = null; // 并发调用时等待中的调用者可复用
const DEBUG_LOG_STORAGE_KEY = 'aichatmergeDebugLogs';
const DEBUG_LOG_MAX_ENTRIES = 800;
const DEBUG_LOG_RAW_TAIL_ENTRIES = 120;
const DEBUG_LOG_KEY_EVENT_LIMIT = 220;
const DEBUG_LOG_ISSUE_LIMIT = 80;
const DISCUSSION_ROUNDS = 1;
const debugSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let debugLogWriteQueue = Promise.resolve();

function getPanelDebugInfo(panel) {
  if (!panel) return null;
  return {
    panelId: panel.id,
    providerId: panel.providerId,
    isMergePanel: mergePanelIds.has(panel.id)
  };
}

function sanitizeDebugDetails(details = {}) {
  const safe = {};
  Object.entries(details || {}).forEach(([key, value]) => {
    if (typeof value === 'string') {
      safe[key] = value.length > 300 ? `${value.slice(0, 300)}…` : value;
    } else if (Array.isArray(value)) {
      safe[key] = value.slice(0, 30);
    } else if (value && typeof value === 'object') {
      safe[key] = JSON.parse(JSON.stringify(value));
    } else {
      safe[key] = value;
    }
  });
  return safe;
}

async function recordDebugLog(event, details = {}) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  const entry = {
    ts: new Date().toISOString(),
    t: Math.round(performance.now()),
    sessionId: debugSessionId,
    event,
    details: sanitizeDebugDetails(details)
  };

  debugLogWriteQueue = debugLogWriteQueue
    .catch(() => {})
    .then(async () => {
      try {
        const result = await chrome.storage.local.get({ [DEBUG_LOG_STORAGE_KEY]: [] });
        const logs = Array.isArray(result[DEBUG_LOG_STORAGE_KEY])
          ? result[DEBUG_LOG_STORAGE_KEY]
          : [];
        logs.push(entry);
        const trimmed = logs.slice(-DEBUG_LOG_MAX_ENTRIES);
        await chrome.storage.local.set({ [DEBUG_LOG_STORAGE_KEY]: trimmed });
      } catch (error) {
        console.warn('[DebugLog] Failed to persist debug log:', error);
      }
    });
}

function getDebugLogDetails(log) {
  return log && typeof log.details === 'object' && log.details ? log.details : {};
}

function compactDebugValue(value, depth = 0) {
  if (typeof value === 'string') {
    return value.length > 180 ? `${value.slice(0, 180)}…` : value;
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    const compact = value.slice(0, 8).map(item => compactDebugValue(item, depth + 1));
    if (value.length > compact.length) {
      compact.push(`... ${value.length - compact.length} more`);
    }
    return compact;
  }
  if (depth >= 2) {
    const keys = Object.keys(value);
    return keys.length ? `{${keys.slice(0, 8).join(',')}}` : {};
  }

  const compact = {};
  Object.entries(value).forEach(([key, item]) => {
    compact[key] = compactDebugValue(item, depth + 1);
  });
  return compact;
}

function compactDebugLog(log) {
  return {
    ts: log.ts,
    t: log.t,
    sessionId: log.sessionId,
    event: log.event,
    details: compactDebugValue(getDebugLogDetails(log))
  };
}

function isDebugIssueEvent(event) {
  return /error|failed|timeout|no-answer|empty|give-up|missing|aborted|fallback/i.test(event || '');
}

function isDebugKeyEvent(event) {
  if (!event) return false;
  return isDebugIssueEvent(event) ||
    /^merge:(trigger-start|answers-extracted|prompt-built|reuse-panel|create-panel|auto-export|aborted)/.test(event) ||
    /^merge-monitor:(start|timeout|all-complete|panel-complete|stop)/.test(event) ||
    /^discussion:(start|round-start|prompt-built|send-results|round-answers-extracted|round-merge-answer-extracted|completed|stop)/.test(event) ||
    /^discussion-wait:(start|all-complete|timeout)/.test(event) ||
    /^discussion-start-gate:(start|new-answer-started|text-stable|timeout-fallback|overall-timeout-fallback|begin-discussion)/.test(event) ||
    /^discussion-merge-wait:(start|stable-fallback-complete|completion-wait-ended)/.test(event) ||
    /^markdown-export:/.test(event) ||
    /^panel-injection:(failed|give-up|timeout)/.test(event);
}

function buildDebugEventCounts(logs) {
  const counts = {};
  logs.forEach(log => {
    counts[log.event] = (counts[log.event] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([event, count]) => ({ event, count }));
}

function getDebugIssueSeverity(event) {
  if (/error|failed|give-up/i.test(event || '')) return 'error';
  if (/timeout|no-answer|empty|missing/i.test(event || '')) return 'warning';
  return 'info';
}

function extractDebugIssues(logs) {
  return logs
    .filter(log => isDebugIssueEvent(log.event))
    .slice(-DEBUG_LOG_ISSUE_LIMIT)
    .map(log => ({
      severity: getDebugIssueSeverity(log.event),
      ...compactDebugLog(log)
    }));
}

function summarizeDebugSessions(logs) {
  const sessions = new Map();
  logs.forEach(log => {
    const sessionId = log.sessionId || 'unknown';
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        sessionId,
        startTs: log.ts,
        endTs: log.ts,
        logCount: 0,
        issueCount: 0,
        exportStatus: null,
        lastExportFile: null,
        finalAnswerLength: null,
        promptLengths: [],
        providers: new Set(),
        keyEvents: []
      });
    }

    const session = sessions.get(sessionId);
    const details = getDebugLogDetails(log);
    session.endTs = log.ts;
    session.logCount += 1;
    if (isDebugIssueEvent(log.event)) session.issueCount += 1;
    if (isDebugKeyEvent(log.event) && session.keyEvents.length < 30) {
      session.keyEvents.push(log.event);
    }
    if (details.promptLength) session.promptLengths.push(details.promptLength);
    if (details.answerLength || details.exportAnswerLength || details.finalAnswerLength) {
      session.finalAnswerLength = details.exportAnswerLength || details.finalAnswerLength || details.answerLength;
    }
    if (Array.isArray(details.providers)) {
      details.providers.forEach(provider => session.providers.add(String(provider)));
    }
    if (Array.isArray(details.results)) {
      details.results.forEach(result => {
        const providerId = result?.panel?.providerId;
        if (providerId) session.providers.add(providerId);
      });
    }
    if (log.event && log.event.startsWith('markdown-export:') &&
        /success|failed|error|no-answer|start/.test(log.event)) {
      session.exportStatus = log.event;
      if (details.filePath) session.lastExportFile = details.filePath;
    }
  });

  return Array.from(sessions.values()).map(session => ({
    ...session,
    providers: Array.from(session.providers),
    promptLengths: session.promptLengths.slice(-5),
    keyEvents: Array.from(new Set(session.keyEvents))
  }));
}

function buildDebugAiPayload(logs) {
  const currentSessionLogs = logs.filter(log => log.sessionId === debugSessionId);
  const issueEvents = logs.filter(log => isDebugIssueEvent(log.event));
  const keyEvents = logs
    .filter(log => isDebugKeyEvent(log.event))
    .slice(-DEBUG_LOG_KEY_EVENT_LIMIT)
    .map(compactDebugLog);
  const lastExport = [...logs].reverse().find(log => log.event && log.event.startsWith('markdown-export:'));

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 2,
    format: 'ai-readable-debug-summary',
    note: 'Read summary, issues, sessions, and keyEvents first. rawTail is only a short fallback; full raw logs are intentionally omitted to keep this file readable.',
    currentSessionId: debugSessionId,
    version: chrome.runtime?.getManifest?.().version || 'unknown',
    summary: {
      rawLogCount: logs.length,
      currentSessionLogCount: currentSessionLogs.length,
      firstLogAt: logs[0]?.ts || null,
      lastLogAt: logs[logs.length - 1]?.ts || null,
      sessionCount: new Set(logs.map(log => log.sessionId || 'unknown')).size,
      issueCount: issueEvents.length,
      keyEventCount: keyEvents.length,
      rawTailCount: Math.min(logs.length, DEBUG_LOG_RAW_TAIL_ENTRIES),
      lastExport: lastExport ? compactDebugLog(lastExport) : null,
      eventCounts: buildDebugEventCounts(logs)
    },
    issues: extractDebugIssues(logs),
    sessions: summarizeDebugSessions(logs),
    keyEvents,
    rawTail: logs.slice(-DEBUG_LOG_RAW_TAIL_ENTRIES).map(compactDebugLog)
  };
}

function getThemeAwareProviderIcon(provider) {
  return getProviderIcon(provider);
}

function isDarkThemeActive() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function getDropdownThemePalette() {
  if (isDarkThemeActive()) {
    return {
      menuBackground: '#2d2d2d',
      menuBorder: '#444',
      menuText: '#e0e0e0',
      itemHoverBackground: '#3a3a3a',
      selectedBackground: '#1a3a5a',
      selectedText: '#64b5f6'
    };
  }

  return {
    menuBackground: 'white',
    menuBorder: '#e0e0e0',
    menuText: '#333',
    itemHoverBackground: '#f5f5f5',
    selectedBackground: '#e3f2fd',
    selectedText: '#1976d2'
  };
}

function refreshThemeAwareProviderIcons() {
  document.querySelectorAll('img[data-provider-id]').forEach((img) => {
    const provider = getProviderById(img.dataset.providerId);
    if (!provider) return;
    img.src = getThemeAwareProviderIcon(provider);
  });
}
let currentGoogleProviderMode = DEFAULT_GOOGLE_PROVIDER_MODE;

// 提示词编辑器状态
let currentEditingPromptId = null;

// 打开模式状态
let currentOpenMode = 'tab'; // 'tab' 或 'popup'
let isPopupWindow = false;   // 当前窗口是否为弹出窗口
let claudeCustomEntryUrl = '';

const PENDING_MULTI_PANEL_ACTION_KEY = 'pendingMultiPanelAction';
const SEND_FOCUS_RESTORE_DELAYS = [0, 80, 200, 400, 800, 1500, 2500, 4000, 6000, 8000, 10000, 12000];
const SEND_FOCUS_NO_BUSY_TIMEOUT_MS = 2000;
const SEND_FOCUS_HARD_TIMEOUT_MS = 90000;
const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = 'multi-panel-provider-status';
const ACM_PROVIDER_BUSY = 'ACM_PROVIDER_BUSY';
const ACM_PROVIDER_IDLE = 'ACM_PROVIDER_IDLE';
const ACM_PROVIDER_USER_INTERACTION = 'ACM_PROVIDER_USER_INTERACTION';
const LAYOUT_PANEL_COUNTS = {
  '1x1': 1,
  '1x2': 2,
  '1x3': 3,
  '1x4': 4,
  '1x5': 5
};
let isInitialized = false;
let isInitializing = false;

function normalizeLayout(layout) {
  if (LAYOUT_PANEL_COUNTS[layout]) {
    return layout;
  }
  return '1x3';
}

// ===== Initialization =====
async function init() {
  document.addEventListener('aichatmerge:themechange', refreshThemeAwareProviderIcons);
  await applyTheme();

  // Initialize i18n
  const { language } = await chrome.storage.sync.get({ language: null });
  if (language) {
    currentLocale = language.startsWith('zh') ? 'zh' : 'en';
  } else {
    currentLocale = detectLocale();
  }
  applyI18n();

  registerRuntimeMessageListener();
  registerStorageChangeListener();

  // Detect window type and load mode
  await detectWindowType();

  // Restore state if needed (after mode switch)
  await restoreStateIfNeeded();

  // Load saved settings
  await loadSettings();

  // Initialize panels
  await initializePanels();

  // 渲染第一页
  renderCurrentPage();

  // Setup event listeners
  setupEventListeners();
  focusUnifiedInput({ force: true });

  isInitialized = true;
  await handlePendingMultiPanelAction();
  updateDefaultPromptBar();
  bindDefaultPromptEvents();
}

function focusUnifiedInput({ force = false } = {}) {
  const inputTextarea = document.getElementById('unified-input');
  if (!inputTextarea) {
    return;
  }

  const active = document.activeElement;
  const shouldFocus = force || !active || active.tagName === 'IFRAME' || active === document.body;
  if (!shouldFocus) {
    return;
  }

  requestAnimationFrame(() => {
    try {
      inputTextarea.focus({ preventScroll: true });
    } catch {
      inputTextarea.focus();
    }
  });
}

function shouldPreserveUnifiedInputFocus() {
  return loadingPanelIds.size > 0 || isRestoringFocusAfterNewChat || isRestoringFocusAfterSend;
}

function isGoogleProvider(providerId) {
  return providerId === 'google';
}

function isChatgptProvider(providerId) {
  return providerId === 'chatgpt';
}

function getPanelProviderMode(panel) {
  return isGoogleProvider(panel.providerId) ? currentGoogleProviderMode : null;
}

function postNewChatToPanel(panel) {
  if (!panel || !panel.iframe || !panel.iframe.contentWindow) {
    return;
  }

  postToPanelIframe(panel, {
    type: 'NEW_CHAT',
    providerMode: getPanelProviderMode(panel),
    context: 'multi-panel'
  });
}

function getProviderFrameUrl(providerId) {
  const provider = getProviderById(providerId);
  if (!provider) {
    return '';
  }

  // A user-verified Claude page is an explicit compatibility override.  It
  // takes precedence over the normal entry URL, while the existing
  // send/extract logic remains provider-based rather than URL-based.
  if (providerId === 'claude' && claudeCustomEntryUrl) {
    return claudeCustomEntryUrl;
  }

  return isGoogleProvider(providerId)
    ? getGoogleProviderUrl(currentGoogleProviderMode)
    : provider.url;
}

// ===== Security: postMessage targetOrigin =====
// Safely determine the target origin for an iframe before posting a message.
// Returns null if the origin cannot be determined (message is not sent).
function getIframeTargetOrigin(panel) {
  if (!panel || !panel.iframe || !panel.iframe.contentWindow) return null;
  try {
    return new URL(panel.iframe.src || panel.url).origin;
  } catch (error) {
    console.warn('[Security] Cannot determine iframe origin for panel:', panel?.id);
    return null;
  }
}

// Send a postMessage to a panel iframe using its actual origin instead of '*'.
function postToPanelIframe(panel, message) {
  const targetOrigin = getIframeTargetOrigin(panel);
  if (!targetOrigin) return;
  panel.iframe.contentWindow.postMessage(message, targetOrigin);
}

function getGoogleModeSelectHtml(mode = currentGoogleProviderMode) {
  const normalizedMode = normalizeGoogleProviderMode(mode);
  return `
    <select class="panel-google-mode-select" title="Google mode">
      <option value="${GOOGLE_PROVIDER_MODE_AI}" ${normalizedMode === GOOGLE_PROVIDER_MODE_AI ? 'selected' : ''}>AI Mode</option>
      <option value="${GOOGLE_PROVIDER_MODE_SEARCH}" ${normalizedMode === GOOGLE_PROVIDER_MODE_SEARCH ? 'selected' : ''}>Search</option>
    </select>
  `;
}

function fitPanelSelectWidth(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const text = selectedOption?.textContent || select.value || '';
  const sizingProbe = document.createElement('span');
  const computedStyle = window.getComputedStyle(select);

  sizingProbe.textContent = text;
  sizingProbe.style.position = 'absolute';
  sizingProbe.style.visibility = 'hidden';
  sizingProbe.style.whiteSpace = 'pre';
  sizingProbe.style.font = computedStyle.font;
  sizingProbe.style.fontSize = computedStyle.fontSize;
  sizingProbe.style.fontWeight = computedStyle.fontWeight;
  sizingProbe.style.letterSpacing = computedStyle.letterSpacing;

  document.body.appendChild(sizingProbe);
  const measuredWidth = Math.ceil(sizingProbe.getBoundingClientRect().width);
  sizingProbe.remove();

  const horizontalPadding = (parseFloat(computedStyle.paddingLeft) || 0) +
    (parseFloat(computedStyle.paddingRight) || 0);
  const horizontalBorder = (parseFloat(computedStyle.borderLeftWidth) || 0) +
    (parseFloat(computedStyle.borderRightWidth) || 0);
  const safetyAllowance = 6;

  select.style.width = `${Math.max(
    72,
    Math.ceil(measuredWidth + horizontalPadding + horizontalBorder + safetyAllowance)
  )}px`;
}

function getPanelHeaderRightHtml(providerId) {
  const googleModeSelect = isGoogleProvider(providerId)
    ? getGoogleModeSelectHtml()
    : '';

  return `
    ${googleModeSelect}
    <button class="panel-new-chat-btn" title="${t('newChat')}">
      <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="add_comment"></span>
    </button>
    <button class="copy-link-btn" title="${t('copyLink')}">
      <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="content_copy"></span>
    </button>
    <button class="refresh-panel-btn" title="${t('refresh')}">
      <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="refresh"></span>
    </button>
    <button class="home-btn" title="${t('home')}">
      <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="home"></span>
    </button>
    <button class="maximize-btn" title="${t('maximize')}">
      <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="open_in_full"></span>
    </button>
    <button class="switch-provider-btn" title="${t('switchProvider')}">
      <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="swap_horiz"></span>
    </button>
    <button class="close-panel-btn" title="${t('close')}">
      <span class="material-symbols-outlined notranslate" translate="no" aria-hidden="true" data-icon="close"></span>
    </button>
  `;
}

function syncGoogleModeControls() {
  document.querySelectorAll('.panel-google-mode-select').forEach((select) => {
    if (select.value !== currentGoogleProviderMode) {
      select.value = currentGoogleProviderMode;
    }
    fitPanelSelectWidth(select);
  });
}

function showPanelLoadingState(panelEl, provider) {
  const loadingEl = panelEl.querySelector('.panel-loading');
  if (!loadingEl || !provider) {
    return;
  }

  loadingEl.classList.remove('hidden');
  loadingEl.textContent = ''; // clear existing children safely
  const icon = document.createElement('img');
  icon.src = getThemeAwareProviderIcon(provider);
  icon.alt = provider.name;
  icon.className = 'loading-icon';
  icon.dataset.providerId = provider.id;
  const text = document.createElement('span');
  text.className = 'loading-text';
  text.textContent = t('loadingProvider', provider.name);
  loadingEl.appendChild(icon);
  loadingEl.appendChild(text);
}

function reloadPanelIframe(panel, overrideUrl = null) {
  const panelEl = document.getElementById(panel.id);
  const provider = getProviderById(panel.providerId);
  if (!panelEl || !provider) {
    return;
  }

  const iframe = panelEl.querySelector('iframe');
  if (!iframe) {
    return;
  }

  showPanelLoadingState(panelEl, provider);
  loadingPanelIds.add(panel.id);
  iframe.src = overrideUrl || getProviderFrameUrl(panel.providerId);
  panel.iframe = iframe;
}

// Wenxin and Qianwen sometimes finish loading an error shell without firing an
// iframe error event.  Verify that their content script can see an input and
// retry one time automatically when it cannot.
const AUTO_RECOVER_PROVIDERS = new Set(['wenxin', 'qianwen']);

function schedulePanelHealthCheck(panel) {
  if (!panel || !AUTO_RECOVER_PROVIDERS.has(panel.providerId)) return;

  clearTimeout(panel.healthCheckTimer);
  clearTimeout(panel.healthRecoveryTimer);
  const requestId = `health-${panel.id}-${Date.now()}`;
  panel.healthCheckRequestId = requestId;

  panel.healthCheckTimer = setTimeout(() => {
    if (panel.healthCheckRequestId !== requestId || !panel.iframe?.contentWindow) return;
    postToPanelIframe(panel, {
      type: 'HEALTH_CHECK',
      requestId,
      panelId: panel.id,
      context: 'multi-panel'
    });
  }, 4000);

  panel.healthRecoveryTimer = setTimeout(() => {
    if (panel.healthCheckRequestId !== requestId || (panel.healthReloadAttempts || 0) >= 1) return;
    panel.healthReloadAttempts = (panel.healthReloadAttempts || 0) + 1;
    console.warn('[MultiPanel] No healthy input detected; reloading', panel.providerId);
    reloadPanelIframe(panel);
  }, 10000);
}

function handlePanelHealthCheckResult(panel, data) {
  if (!panel || data.requestId !== panel.healthCheckRequestId) return;
  clearTimeout(panel.healthRecoveryTimer);
  panel.healthRecoveryTimer = null;
  const hasUsableInput = data.results?.input?.some(result => result.found && result.visible);
  if (hasUsableInput || (panel.healthReloadAttempts || 0) >= 1) return;

  panel.healthReloadAttempts = (panel.healthReloadAttempts || 0) + 1;
  console.warn('[MultiPanel] Provider input unavailable; reloading', panel.providerId);
  reloadPanelIframe(panel);
}

function bindPanelHeaderActions(panelId) {
  const panel = panels.find(p => p.id === panelId);
  const panelEl = document.getElementById(panelId);
  if (!panel || !panelEl) {
    return;
  }

  const panelNewChatBtn = panelEl.querySelector('.panel-new-chat-btn');
  if (panelNewChatBtn) {
    panelNewChatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startFreshChatForPanel(panel);
      showToast(t('panelNewChatCreated'));
    });
  }

  // 复制链接
  const copyLinkBtn = panelEl.querySelector('.copy-link-btn');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const iframe = panelEl.querySelector('iframe');
        const url = iframe?.src || '';
        await navigator.clipboard.writeText(url);
        const icon = copyLinkBtn.querySelector('.material-symbols-outlined');
        setMaterialIcon(icon, 'check');
        setTimeout(() => { setMaterialIcon(icon, 'content_copy'); }, 1500);
      } catch (err) {
        console.warn('[Panel] Failed to copy link:', err);
      }
    });
  }

  const refreshBtn = panelEl.querySelector('.refresh-panel-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      reloadPanelIframe(panel);
    });
  }

  // 回到首页
  const homeBtn = panelEl.querySelector('.home-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      reloadPanelIframe(panel, getProviderFrameUrl(panel.providerId));
    });
  }

  // 放大/还原
  const maximizeBtn = panelEl.querySelector('.maximize-btn');
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panelItem = panelEl;
      const isMaximized = panelItem.classList.toggle('panel-maximized');
      const icon = maximizeBtn.querySelector('.material-symbols-outlined');
      setMaterialIcon(icon, isMaximized ? 'close_fullscreen' : 'open_in_full');
      maximizeBtn.title = isMaximized ? t('restore') : t('maximize');
    });
  }

  const switchBtn = panelEl.querySelector('.switch-provider-btn');
  if (switchBtn) {
    switchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showProviderSwitcher(panelId);
    });
  }

  // 关闭面板
  const closeBtn = panelEl.querySelector('.close-panel-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panels.length <= 1) {
        showToast(t('minOnePanel'));
        return;
      }
      removePanel(panelId);
    });
  }

  const googleModeSelect = panelEl.querySelector('.panel-google-mode-select');
  if (googleModeSelect) {
    fitPanelSelectWidth(googleModeSelect);
    googleModeSelect.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    googleModeSelect.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    googleModeSelect.addEventListener('change', async (event) => {
      fitPanelSelectWidth(event.target);
      await updateGoogleProviderMode(event.target.value, { persist: true, reloadPanels: true });
    });
  }
}

async function updateGoogleProviderMode(mode, { persist = false, reloadPanels = false } = {}) {
  const normalizedMode = normalizeGoogleProviderMode(mode);
  const modeChanged = currentGoogleProviderMode !== normalizedMode;
  currentGoogleProviderMode = normalizedMode;
  syncGoogleModeControls();

  if (reloadPanels && modeChanged) {
    panels
      .filter(panel => isGoogleProvider(panel.providerId))
      .forEach(panel => reloadPanelIframe(panel));
  }

  if (persist) {
    await saveSetting('googleProviderMode', normalizedMode);
  }
}

function registerStorageChangeListener() {
  if (!chrome?.storage?.onChanged?.addListener) {
    return;
  }

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'sync' && areaName !== 'local') {
      return;
    }

    // Theme change: re-apply theme immediately
    if (changes.theme) {
      await applyTheme();
    }

    // Language change: update locale and re-apply i18n
    if (changes.language) {
      const newLanguage = changes.language.newValue;
      if (newLanguage) {
        currentLocale = newLanguage.startsWith('zh') ? 'zh' : 'en';
      } else {
        currentLocale = detectLocale();
      }
      applyI18n();
    }

    // Keep the current panel in sync when the merge timeout is changed from
    // the options page. Previously this value was only read at panel startup.
    if (changes.mergeMaxWait) {
      const nextMergeMaxWait = Number(changes.mergeMaxWait.newValue);
      if (Number.isFinite(nextMergeMaxWait) && nextMergeMaxWait > 0) {
        MERGE_MAX_WAIT = nextMergeMaxWait;
      }
    }
    if (changes.autoMergeEnabled) {
      AUTO_MERGE_ENABLED = changes.autoMergeEnabled.newValue !== false;
      if (!AUTO_MERGE_ENABLED) {
        stopMergeMonitor();
      }
    }

    if (areaName === 'local' && changes[CLAUDE_CUSTOM_ENTRY_URL_KEY]) {
      claudeCustomEntryUrl = await getClaudeCustomEntryUrl();
    }

    // Google provider mode change
    if (!changes.googleProviderMode || !changes.googleProviderMode.newValue) {
      return;
    }

    const nextMode = normalizeGoogleProviderMode(changes.googleProviderMode.newValue);
    if (nextMode === currentGoogleProviderMode) {
      syncGoogleModeControls();
      return;
    }

    updateGoogleProviderMode(nextMode, { reloadPanels: true }).catch((error) => {
      console.error('Error syncing Google provider mode:', error);
    });
  });
}

function cancelUnifiedInputFocusRestore() {
  newChatFocusRestoreTimerIds.forEach(timerId => clearTimeout(timerId));
  newChatFocusRestoreTimerIds = [];
  isRestoringFocusAfterNewChat = false;
}

function cancelUnifiedInputFocusRestoreAfterSend() {
  sendFocusRestoreTimerIds.forEach(timerId => clearTimeout(timerId));
  sendFocusRestoreTimerIds = [];
  sendFocusBusyDetectionTimeoutIds.forEach(timerId => clearTimeout(timerId));
  sendFocusBusyDetectionTimeoutIds.clear();
  sendFocusHardTimeoutIds.forEach(timerId => clearTimeout(timerId));
  sendFocusHardTimeoutIds.clear();
  sendFocusActivePanelIds.clear();
  activeSendFocusRequestId = null;
  isRestoringFocusAfterSend = false;
}

function startFreshChatForPanel(panel, { invalidateSession = true } = {}) {
  if (!panel) {
    return;
  }
  if (invalidateSession) {
    invalidateCompletionSessions('panel-new-chat');
  }
  stopMergeMonitor();
  postNewChatToPanel(panel);
}

function isUnifiedInputOrNewChatControl(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('#unified-input, #new-chat-btn, #prompt-editor-modal input, #prompt-editor-modal textarea, #prompt-editor-modal button'));
}

function isUnifiedInputOrSendControl(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('#unified-input, #send-all-btn, #prompt-editor-modal input, #prompt-editor-modal textarea, #prompt-editor-modal button'));
}

function isPromptEditorTextControl(target) {
  return target instanceof Element &&
    Boolean(target.closest('#prompt-editor-modal input, #prompt-editor-modal textarea'));
}

function restoreUnifiedInputFocusAfterNewChat() {
  cancelUnifiedInputFocusRestore();
  isRestoringFocusAfterNewChat = true;

  const restoreDelays = [0, 80, 200, 400, 800, 1000, 1200, 1500];
  restoreDelays.forEach((delay, index) => {
    const timerId = setTimeout(() => {
      if (!isRestoringFocusAfterNewChat) {
        return;
      }

      focusUnifiedInput({ force: true });

      if (index === restoreDelays.length - 1) {
        cancelUnifiedInputFocusRestore();
      }
    }, delay);

    newChatFocusRestoreTimerIds.push(timerId);
  });
}

function createSendFocusRequestId() {
  sendFocusRequestCounter += 1;
  return `send-focus-${Date.now()}-${sendFocusRequestCounter}`;
}

function clearSendFocusProviderTimeout(timeoutMap, panelId) {
  const timerId = timeoutMap.get(panelId);
  if (typeof timerId === 'number') {
    clearTimeout(timerId);
  }
  timeoutMap.delete(panelId);
}

function maybeStopSendFocusRestore() {
  if (sendFocusRestoreTimerIds.length > 0) {
    return;
  }

  if (sendFocusActivePanelIds.size > 0) {
    return;
  }

  cancelUnifiedInputFocusRestoreAfterSend();
}

function getChatgptPanelsWithFrames() {
  return panels.filter(panel => (
    isChatgptProvider(panel.providerId) &&
    panel.iframe &&
    panel.iframe.contentWindow
  ));
}

function scheduleChatgptBusyDetectionTimeout(panel, requestId) {
  clearSendFocusProviderTimeout(sendFocusBusyDetectionTimeoutIds, panel.id);

  const timerId = setTimeout(() => {
    if (activeSendFocusRequestId !== requestId) {
      return;
    }

    sendFocusBusyDetectionTimeoutIds.delete(panel.id);
  }, SEND_FOCUS_NO_BUSY_TIMEOUT_MS);

  sendFocusBusyDetectionTimeoutIds.set(panel.id, timerId);
}

function scheduleChatgptHardTimeout(panelId, requestId) {
  clearSendFocusProviderTimeout(sendFocusHardTimeoutIds, panelId);

  const timerId = setTimeout(() => {
    if (activeSendFocusRequestId !== requestId) {
      return;
    }

    console.warn('[Multi-Panel] Releasing send focus protection after ChatGPT hard timeout:', panelId);
    sendFocusActivePanelIds.delete(panelId);
    sendFocusHardTimeoutIds.delete(panelId);
    maybeStopSendFocusRestore();
  }, SEND_FOCUS_HARD_TIMEOUT_MS);

  sendFocusHardTimeoutIds.set(panelId, timerId);
}

function handleSendFocusProviderBusy(panel, requestId) {
  if (activeSendFocusRequestId !== requestId) {
    return;
  }

  clearSendFocusProviderTimeout(sendFocusBusyDetectionTimeoutIds, panel.id);
  sendFocusActivePanelIds.add(panel.id);
  isRestoringFocusAfterSend = true;
  scheduleChatgptHardTimeout(panel.id, requestId);
  focusUnifiedInput({ force: true });
}

function handleSendFocusProviderIdle(panel, requestId) {
  if (activeSendFocusRequestId !== requestId) {
    return;
  }

  clearSendFocusProviderTimeout(sendFocusBusyDetectionTimeoutIds, panel.id);
  clearSendFocusProviderTimeout(sendFocusHardTimeoutIds, panel.id);
  sendFocusActivePanelIds.delete(panel.id);
  maybeStopSendFocusRestore();
}

function restoreUnifiedInputFocusAfterSend(trackedPanels = []) {
  cancelUnifiedInputFocusRestoreAfterSend();
  isRestoringFocusAfterSend = true;
  activeSendFocusRequestId = createSendFocusRequestId();

  trackedPanels.forEach(panel => scheduleChatgptBusyDetectionTimeout(panel, activeSendFocusRequestId));

  const requestId = activeSendFocusRequestId;
  SEND_FOCUS_RESTORE_DELAYS.forEach((delay, index) => {
    const timerId = setTimeout(() => {
      if (!isRestoringFocusAfterSend || activeSendFocusRequestId !== requestId) {
        return;
      }

      focusUnifiedInput({ force: true });

      if (index === SEND_FOCUS_RESTORE_DELAYS.length - 1) {
        sendFocusRestoreTimerIds = [];
        maybeStopSendFocusRestore();
      }
    }, delay);

    sendFocusRestoreTimerIds.push(timerId);
  });

  return requestId;
}

function handleProviderStatusMessage(event) {
  const data = event?.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  // Validate the sender before handling every message type, including answer
  // extraction and completion notifications.
  const panel = panels.find(candidate => candidate.iframe?.contentWindow === event.source);
  if (!panel) {
    return;
  }

  let expectedOrigin;
  try {
    expectedOrigin = new URL(panel.iframe.src || panel.url).origin;
  } catch {
    return;
  }
  if (event.origin !== expectedOrigin) {
    console.warn('[MultiPanel] Rejected message with unexpected origin:', event.origin);
    return;
  }

  if (data.type === 'CLAUDE_ENTRY_WARNING' && data.context === 'claude-entry-warning') {
    if (panel.providerId !== 'claude') return;
    showClaudeEntryWarning(panel, data);
    return;
  }

  // Handle answer extraction responses
  if (data.type === 'EXTRACTED_ANSWER' && data.context === 'multi-panel-answer') {
    handleExtractedAnswer(data);
    return;
  }

  if (data.type === 'INJECT_TEXT_RESULT' && data.context === 'multi-panel-injection') {
    if (data.provider !== panel.providerId) return;
    handlePanelInjectionResult(data);
    return;
  }

  if (data.type === 'HEALTH_CHECK_RESULT' && data.context === 'multi-panel-health') {
    handlePanelHealthCheckResult(panel, data);
    return;
  }

  // Handle completion detection from iframe MutationObserver or SSE bridge
  if (data.type === 'COMPLETION_DETECTED' && data.context === 'multi-panel-completion') {
    handleMergeCompletionDetected({
      ...data,
      panelId: data.panelId || panel.id,
      provider: data.provider || panel.providerId
    });
    return;
  }

  // Handle extraction debug results
  if (data.type === 'EXTRACT_DEBUG_RESULT' && data.context === 'multi-panel-debug') {
    return;
  }

  if (data.context !== MULTI_PANEL_PROVIDER_STATUS_CONTEXT || !data.requestId) {
    return;
  }

  if (data.provider !== panel.providerId) {
    return;
  }

  switch (data.type) {
    case ACM_PROVIDER_BUSY:
      if (!isChatgptProvider(panel.providerId)) {
        return;
      }
      handleSendFocusProviderBusy(panel, data.requestId);
      break;
    case ACM_PROVIDER_IDLE:
      if (!isChatgptProvider(panel.providerId)) {
        return;
      }
      handleSendFocusProviderIdle(panel, data.requestId);
      break;
    case ACM_PROVIDER_USER_INTERACTION:
      if (data.requestId === activeSendFocusRequestId) {
        cancelUnifiedInputFocusRestoreAfterSend();
      }
      break;
    default:
      break;
  }
}

function showClaudeEntryWarning(panel, data = {}) {
  if (!panel || panel.providerId !== 'claude') return;

  const panelEl = document.getElementById(panel.id);
  const iframeContainer = panelEl?.querySelector('.panel-iframe-container');
  if (!iframeContainer) return;

  let warning = iframeContainer.querySelector('.claude-entry-warning');
  if (!warning) {
    warning = document.createElement('div');
    warning.className = 'claude-entry-warning';

    const message = document.createElement('span');
    message.className = 'claude-entry-warning-text';
    warning.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'claude-entry-warning-actions';

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'claude-entry-warning-btn';
    settingsButton.textContent = t('openSettings');
    settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'claude-entry-warning-dismiss';
    dismissButton.textContent = t('dismiss');
    dismissButton.addEventListener('click', () => {
      warning.remove();
    });

    actions.appendChild(settingsButton);
    actions.appendChild(dismissButton);
    warning.appendChild(actions);
    iframeContainer.appendChild(warning);
  }

  const text = warning.querySelector('.claude-entry-warning-text');
  if (text) text.textContent = t('claudeEntryWarning');
  warning.dataset.reason = data.reason || 'unknown';

  recordDebugLog('claude-entry-warning:shown', {
    panel: getPanelDebugInfo(panel),
    reason: data.reason || 'unknown',
    matchedText: data.matchedText || ''
  });
}

async function getPendingMultiPanelAction() {
  try {
    const result = await chrome.storage.session.get(PENDING_MULTI_PANEL_ACTION_KEY);
    if (result && result[PENDING_MULTI_PANEL_ACTION_KEY]) {
      return result[PENDING_MULTI_PANEL_ACTION_KEY];
    }
  } catch (error) {
    // Ignore session storage errors
  }

  try {
    const result = await chrome.storage.local.get(PENDING_MULTI_PANEL_ACTION_KEY);
    return result ? result[PENDING_MULTI_PANEL_ACTION_KEY] : null;
  } catch (error) {
    return null;
  }
}

async function clearPendingMultiPanelAction() {
  try {
    await chrome.storage.session.remove(PENDING_MULTI_PANEL_ACTION_KEY);
  } catch (error) {
    // Ignore session storage errors
  }

  try {
    await chrome.storage.local.remove(PENDING_MULTI_PANEL_ACTION_KEY);
  } catch (error) {
    // Ignore local storage errors
  }
}

async function handlePendingMultiPanelAction() {
  const pendingAction = await getPendingMultiPanelAction();
  if (!pendingAction || !pendingAction.action) {
    return;
  }

  const handled = await handleMultiPanelAction(pendingAction.action, pendingAction.payload || {});
  if (handled) {
    await clearPendingMultiPanelAction();
  }
}

async function handleMultiPanelAction(action, payload = {}) {
  if (action === 'openPromptLibrary') {
    if (payload.selectedText) {
      applyPromptToInput(payload.selectedText);
    }
    openPromptModal();
    return true;
  }

  if (action === 'sendToPanel') {
    if (payload.selectedText) {
      applyPromptToInput(payload.selectedText);
    }
    return true;
  }

  if (action === 'switchProvider') {
    if (payload.providerId && panels.length > 0) {
      await switchPanelProvider(panels[0].id, payload.providerId);
    }
    if (payload.selectedText) {
      applyPromptToInput(payload.selectedText);
    }
    return true;
  }

  return false;
}

function registerRuntimeMessageListener() {
  if (!chrome?.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((message) => {
    if (!message?.action || !isInitialized) {
      return;
    }

    handleMultiPanelAction(message.action, message.payload || {}).then((handled) => {
      if (handled) {
        clearPendingMultiPanelAction();
      }
    });
  });
}

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get({
      multiPanelLayout: '1x3',
      multiPanelProviders: DEFAULT_PROVIDER_IDS,
      openMode: 'tab',
      googleProviderMode: DEFAULT_GOOGLE_PROVIDER_MODE,
      currentPanelPage: 0,
      mergeMaxWait: 120000,
      autoMergeEnabled: true
    });

    currentLayout = normalizeLayout(settings.multiPanelLayout);
    currentOpenMode = settings.openMode || 'tab';
    currentGoogleProviderMode = normalizeGoogleProviderMode(settings.googleProviderMode);
    currentPanelPage = settings.currentPanelPage || 0;
    const storedMergeMaxWait = Number(settings.mergeMaxWait);
    MERGE_MAX_WAIT = Number.isFinite(storedMergeMaxWait) && storedMergeMaxWait > 0
      ? storedMergeMaxWait
      : 120000;
    AUTO_MERGE_ENABLED = settings.autoMergeEnabled !== false;
    claudeCustomEntryUrl = await getClaudeCustomEntryUrl();

    const panelGrid = document.getElementById('panel-grid');
    panelGrid.className = `layout-${currentLayout}`;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// ===== Open Mode Management =====
async function detectWindowType() {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    // popup 类型的窗口 type 为 'popup'
    isPopupWindow = currentWindow.type === 'popup';

    // 读取设置中的模式
    const settings = await chrome.storage.sync.get({ openMode: 'tab' });
    currentOpenMode = settings.openMode;

    updateToggleButton();
  } catch (error) {
    console.error('Error detecting window type:', error);
  }
}

function updateToggleButton() {
  const btn = document.getElementById('toggle-open-mode-btn');
  if (!btn) return;

  const icon = btn.querySelector('.material-symbols-outlined');

  if (isPopupWindow) {
    setMaterialIcon(icon, 'tab');
    btn.title = t('switchToTabModeTitle');
  } else {
    setMaterialIcon(icon, 'open_in_new');
    btn.title = t('switchToPopupModeTitle');
  }
}

function collectCurrentState() {
  const state = {
    inputText: document.getElementById('unified-input')?.value || '',
    currentLayout: currentLayout,
    panels: panels.map(p => ({
      providerId: p.providerId
    })),
    googleProviderMode: currentGoogleProviderMode,
    timestamp: Date.now()
  };
  return state;
}

async function toggleOpenMode() {
  // 1. 收集当前状态
  const state = collectCurrentState();

  // 2. 保存状态到 storage（临时）
  try {
    await chrome.storage.session.set({
      preservedState: state
    });
  } catch (error) {
    console.error('Error saving state:', error);
    // Fallback to local storage if session storage fails
    await chrome.storage.local.set({
      preservedState: state
    });
  }

  // 3. 切换设置
  const newMode = isPopupWindow ? 'tab' : 'popup';
  await chrome.storage.sync.set({ openMode: newMode });

  // 4. 在新模式下打开
  const multiPanelUrl = chrome.runtime.getURL('aichatmerge-panel/multi-panel.html');

  if (isPopupWindow) {
    // 从弹出窗口切换到标签页：创建新标签页，关闭当前窗口
    await chrome.tabs.create({ url: multiPanelUrl, active: true });
    window.close(); // 关闭当前弹出窗口
  } else {
    // 从标签页切换到弹出窗口：创建弹出窗口，关闭当前标签页
    await chrome.windows.create({
      url: multiPanelUrl,
      type: 'popup',
      width: 1400,
      height: 900
    });
    // 获取当前标签页并关闭
    const currentTab = await chrome.tabs.getCurrent();
    if (currentTab) {
      await chrome.tabs.remove(currentTab.id);
    }
  }
}

async function restoreStateIfNeeded() {
  try {
    // Try session storage first, then local storage
    let result = await chrome.storage.session.get('preservedState');
    if (!result.preservedState) {
      result = await chrome.storage.local.get('preservedState');
    }

    if (result.preservedState) {
      const state = result.preservedState;

      // 恢复输入文本
      const input = document.getElementById('unified-input');
      if (input && state.inputText) {
        input.value = state.inputText;
      }

      // 恢复布局
      if (state.currentLayout) {
        currentLayout = normalizeLayout(state.currentLayout);
        const panelGrid = document.getElementById('panel-grid');
        if (panelGrid) {
          panelGrid.className = `layout-${currentLayout}`;
        }
      }

      // 恢复面板配置（保存到 multiPanelProviders）
      if (state.panels && state.panels.length > 0) {
        const providerIds = state.panels.map(p => p.providerId);
        await chrome.storage.sync.set({ multiPanelProviders: providerIds });
      }

      if (state.googleProviderMode) {
        await chrome.storage.sync.set({
          googleProviderMode: normalizeGoogleProviderMode(state.googleProviderMode)
        });
      }

      // 清除已恢复的状态
      await chrome.storage.session.remove('preservedState');
      await chrome.storage.local.remove('preservedState');
    }
  } catch (error) {
    console.error('Error restoring state:', error);
  }
}

async function initializePanels() {
  try {
    const settings = await chrome.storage.sync.get({
      multiPanelProviders: DEFAULT_PROVIDER_IDS
    });

    const providerIds = settings.multiPanelProviders || DEFAULT_PROVIDER_IDS;

    isInitializing = true;
    for (const providerId of providerIds) {
      await addPanel(providerId);
    }
    isInitializing = false;

    saveProviderConfiguration();
    renderCurrentPage();
  } catch (error) {
    isInitializing = false;
    console.error('Error initializing panels:', error);
    // Fallback to default providers
    for (const providerId of DEFAULT_PROVIDER_IDS) {
      await addPanel(providerId);
    }
    saveProviderConfiguration();
    renderCurrentPage();
  }
}

// ===== Panel Management =====

async function addPanel(providerId) {
  const provider = getProviderById(providerId);
  if (!provider) {
    console.error('Provider not found:', providerId);
    return;
  }

  const panelId = `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const panelGrid = document.getElementById('panel-grid');

  // Create panel element (safe DOM construction, no innerHTML)
  const panelEl = document.createElement('div');
  panelEl.className = 'panel-item';
  panelEl.id = panelId;
  panelEl.dataset.providerId = providerId;

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'panel-header-left';

  const headerIcon = document.createElement('img');
  headerIcon.src = getThemeAwareProviderIcon(provider);
  headerIcon.alt = provider.name;
  headerIcon.className = 'provider-icon';
  headerIcon.dataset.providerId = provider.id;

  const headerName = document.createElement('span');
  setBrandText(headerName, provider.name);

  headerLeft.appendChild(headerIcon);
  headerLeft.appendChild(headerName);

  const headerRight = document.createElement('div');
  headerRight.className = 'panel-header-right';
  headerRight.innerHTML = getPanelHeaderRightHtml(providerId);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // Iframe container
  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'panel-iframe-container';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'panel-loading';

  const loadingIcon = document.createElement('img');
  loadingIcon.src = getThemeAwareProviderIcon(provider);
  loadingIcon.alt = provider.name;
  loadingIcon.className = 'loading-icon';
  loadingIcon.dataset.providerId = provider.id;

  const loadingText = document.createElement('span');
  loadingText.className = 'loading-text';
  loadingText.textContent = t('loadingProvider', provider.name); // safe: textContent

  loadingEl.appendChild(loadingIcon);
  loadingEl.appendChild(loadingText);

  const iframe = document.createElement('iframe');
  iframe.src = getProviderFrameUrl(providerId);
  iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';
  iframe.allow = 'clipboard-read; clipboard-write';

  iframeContainer.appendChild(loadingEl);
  iframeContainer.appendChild(iframe);
  panelEl.appendChild(header);
  panelEl.appendChild(iframeContainer);

  panelGrid.appendChild(panelEl);

  // Handle iframe load
  // Grace period after load to catch AI pages that auto-focus after JS init
  const LOAD_GRACE_PERIOD = 3000;
  loadingPanelIds.add(panelId);
  iframe.addEventListener('load', () => {
    loadingEl.classList.add('hidden');
    const panel = panels.find(p => p.id === panelId);
    if (panel) {
      schedulePanelHealthCheck(panel);
    }
    setTimeout(() => {
      loadingPanelIds.delete(panelId);
    }, LOAD_GRACE_PERIOD);
  });

  iframe.addEventListener('error', () => {
    loadingEl.textContent = ''; // clear existing children safely
    const errorIcon = document.createElement('img');
    errorIcon.src = getThemeAwareProviderIcon(provider);
    errorIcon.alt = provider.name;
    errorIcon.className = 'loading-icon';
    errorIcon.dataset.providerId = provider.id;
    const errorText = document.createElement('span');
    errorText.className = 'loading-text';
    errorText.textContent = t('providerLoadFailed', provider.name);
    loadingEl.appendChild(errorIcon);
    loadingEl.appendChild(errorText);
    loadingPanelIds.delete(panelId);
    // Click to retry: reload iframe with original URL
    loadingEl.style.cursor = 'pointer';
    loadingEl.title = t('clickToRetry');
    loadingEl.addEventListener('click', () => {
      const panel = panels.find(p => p.id === panelId);
      if (panel && panel.url) {
        loadingEl.textContent = ''; // clear existing children safely
        const retryIcon = document.createElement('img');
        retryIcon.src = getThemeAwareProviderIcon(provider);
        retryIcon.alt = provider.name;
        retryIcon.className = 'loading-icon';
        retryIcon.dataset.providerId = provider.id;
        const retryText = document.createElement('span');
        retryText.className = 'loading-text';
        retryText.textContent = t('retrying');
        loadingEl.appendChild(retryIcon);
        loadingEl.appendChild(retryText);
        loadingEl.style.cursor = '';
        loadingEl.title = '';
        loadingPanelIds.add(panelId);
        iframe.src = panel.url;
      }
    });
  });

  // Add to panels array
  panels.push({
    id: panelId,
    providerId,
    url: getProviderFrameUrl(providerId),
    iframe,
    state: 'loading'
  });

  bindPanelHeaderActions(panelId);

  // Save provider configuration (skip during init to batch saves)
  if (!isInitializing) {
    await saveProviderConfiguration();
  }

  // 跳转到最后一页显示新面板 (skip during init, rendered once at end)
  if (!isInitializing) {
    const panelsPerPage = LAYOUT_PANEL_COUNTS[currentLayout] || 3;
    currentPanelPage = Math.floor((panels.length - 1) / panelsPerPage);
    renderCurrentPage();
  }
}

function removePanel(panelId) {
  const panelIndex = panels.findIndex(p => p.id === panelId);
  if (panelIndex === -1) return;
  const removedPanel = panels[panelIndex];
  const removedWasSourcePanel = !isMergePanel(removedPanel);

  // Remove from DOM
  const panelEl = document.getElementById(panelId);
  if (panelEl) {
    panelEl.remove();
  }

  // Remove from arrays and sets
  panels.splice(panelIndex, 1);
  loadingPanelIds.delete(panelId);
  mergePanelIds.delete(panelId);

  // A source panel may be closed while a merge session is waiting for answers.
  // Re-evaluate the remaining source panels immediately so an already-complete
  // set does not have to wait for the timeout merely because one bad panel was
  // removed.
  if (removedWasSourcePanel) {
    reconcileMergeMonitorAfterPanelRemoval(panelId);
  }

  // Save configuration
  saveProviderConfiguration();

  renderCurrentPage();
}

function reconcileMergeMonitorAfterPanelRemoval(removedPanelId) {
  // A closed panel must never count as a completed remaining source panel.
  mergeCompletedPanels.delete(removedPanelId);

  if (!mergeIsActive) return;

  const remainingPanels = getNonMergePanels();
  if (remainingPanels.length === 0) {
    stopMergeMonitor();
    return;
  }

  const allRemainingPanelsCompleted = remainingPanels.every(panel =>
    mergeCompletedPanels.has(panel.id)
  );
  if (!allRemainingPanelsCompleted) return;

  if (!AUTO_MERGE_ENABLED) {
    stopMergeMonitor();
    return;
  }

  lastMergeType = 'auto';
  stopMergeMonitor();
  triggerMerge();
}

async function switchPanelProvider(panelId, newProviderId) {
  const panel = panels.find(p => p.id === panelId);
  if (!panel) return;

  const provider = getProviderById(newProviderId);
  if (!provider) return;

  const panelEl = document.getElementById(panelId);
  if (!panelEl) return;

  if (isGoogleProvider(newProviderId)) {
    syncGoogleModeControls();
  }

  // Update panel header
  const headerIcon = panelEl.querySelector('.panel-header-left img');
  const headerName = panelEl.querySelector('.panel-header-left span');
  const headerRight = panelEl.querySelector('.panel-header-right');
  headerIcon.src = getThemeAwareProviderIcon(provider);
  headerIcon.dataset.providerId = provider.id;
  headerIcon.alt = provider.name;
  setBrandText(headerName, provider.name);
  panelEl.dataset.providerId = newProviderId;
  headerRight.textContent = ''; // clear existing children safely
  headerRight.innerHTML = getPanelHeaderRightHtml(newProviderId);

  // Update iframe
  const iframe = panelEl.querySelector('iframe');

  // Update panel data
  panel.providerId = newProviderId;
  panel.iframe = iframe;
  bindPanelHeaderActions(panelId);
  reloadPanelIframe(panel);

  await saveProviderConfiguration();
}

async function saveProviderConfiguration() {
  const providerIds = getNonMergePanels().map(p => p.providerId);
  try {
    await chrome.storage.sync.set({
      multiPanelProviders: providerIds,
      multiPanelLayout: currentLayout,
      currentPanelPage: currentPanelPage
    });
  } catch (error) {
    console.error('Error saving provider configuration:', error);
  }
}

// ===== Merge Panel Detection =====
const mergePanelIds = new Set();

function isMergePanel(panel) {
  return mergePanelIds.has(panel.id);
}

function getNonMergePanels() {
  return panels.filter(p => !isMergePanel(p));
}

// ===== Message Broadcasting =====
async function broadcastMessage(text, autoSubmit = true, mergeSessionId = null) {
  const sendBtn = document.getElementById('send-all-btn');
  const statusEl = document.getElementById('send-status');

  if (!text.trim()) {
    // If input is empty and autoSubmit is true, just trigger send buttons
    // (this happens when user clicks Fill first, then Send All)
    if (autoSubmit) {
      await triggerSendButtons();
      return;
    }
    return;
  }

  const shouldAutoSubmit = autoSubmit;
  const sendFocusRequestId = shouldAutoSubmit
    ? restoreUnifiedInputFocusAfterSend(getChatgptPanelsWithFrames())
    : null;

  try {
    // Disable buttons during send
    sendBtn.disabled = true;
    statusEl.textContent = shouldAutoSubmit ? t('sending') : t('filling');
    statusEl.className = 'send-status';

    // Send to all panels (skip merge panels)
    const targetPanels = getNonMergePanels();
    recordDebugLog('broadcast:start', {
      autoSubmit: shouldAutoSubmit,
      textLength: text.length,
      mergeSessionId,
      targetPanels: targetPanels.map(getPanelDebugInfo)
    });
    const panelResults = [];
    for (const panel of targetPanels) {
      await ensurePanelVisibleBeforeAutoSubmit(panel, shouldAutoSubmit, 'broadcast');
      try {
        const value = await sendToPanel(panel, text, shouldAutoSubmit, sendFocusRequestId, 0, mergeSessionId);
        panelResults.push({ status: 'fulfilled', value });
      } catch (reason) {
        panelResults.push({ status: 'rejected', reason });
      }
    }

    // Count results (panels only)
    const panelSuccessful = panelResults.filter(r => r.status === 'fulfilled' && r.value).length;
    const totalSuccessful = panelSuccessful;
    const totalCount = targetPanels.length;
    const failed = totalCount - totalSuccessful;
    recordDebugLog('broadcast:result', {
      autoSubmit: shouldAutoSubmit,
      mergeSessionId,
      totalCount,
      totalSuccessful,
      failed,
      results: panelResults.map((result, index) => ({
        panel: getPanelDebugInfo(targetPanels[index]),
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : null,
        reason: result.status === 'rejected' ? String(result.reason?.message || result.reason) : null
      }))
    });

    // Update status
    if (failed === 0) {
      statusEl.textContent = shouldAutoSubmit
        ? t('sentToAI', totalSuccessful)
        : t('filledToInput', totalSuccessful);
      statusEl.className = 'send-status success';
    } else if (totalSuccessful > 0) {
      statusEl.textContent = shouldAutoSubmit
        ? t('sentToPartial', totalSuccessful, totalCount)
        : t('filledPartial', totalSuccessful, totalCount);
      statusEl.className = 'send-status partial';
    } else {
      statusEl.textContent = shouldAutoSubmit ? t('sendFailed') : t('fillFailed');
      statusEl.className = 'send-status error';
    }

    // Clear status after delay
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);

    // Clear input and save history
    if (totalSuccessful > 0) {
      var unifiedInput = document.getElementById('unified-input');
      unifiedInput.value = '';
      unifiedInput.style.height = 'auto';
    }
  } catch (error) {
    console.error('Error in broadcastMessage:', error);
    recordDebugLog('broadcast:error', {
      message: error?.message || String(error)
    });
    statusEl.textContent = t('errorOccurred');
    statusEl.className = 'send-status error';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } finally {
    // Always re-enable buttons, even if there was an error
    sendBtn.disabled = false;
  }
}

function handlePanelInjectionResult(data) {
  const entry = pendingPanelInjections.get(data.injectionRequestId);
  if (!entry) return;
  clearTimeout(entry.timeoutId);
  pendingPanelInjections.delete(data.injectionRequestId);

  if (data.inputFound && data.injectSuccess) {
    recordDebugLog('panel-injection:success', {
      panel: getPanelDebugInfo(entry.panel),
      autoSubmit: entry.autoSubmit,
      recoveryAttempt: entry.recoveryAttempt,
      mergeSessionId: entry.mergeSessionId,
      inputFound: data.inputFound,
      injectSuccess: data.injectSuccess
    });
    entry.resolve(true);
    return;
  }
  recordDebugLog('panel-injection:failed', {
    panel: getPanelDebugInfo(entry.panel),
    autoSubmit: entry.autoSubmit,
    recoveryAttempt: entry.recoveryAttempt,
    mergeSessionId: entry.mergeSessionId,
    inputFound: data.inputFound,
    injectSuccess: data.injectSuccess
  });
  recoverFailedPanelInjection(entry);
}

function recoverFailedPanelInjection(entry) {
  const { panel } = entry;
  if (!AUTO_RECOVER_PROVIDERS.has(panel.providerId) || entry.recoveryAttempt >= 1) {
    recordDebugLog('panel-injection:give-up', {
      panel: getPanelDebugInfo(panel),
      recoveryAttempt: entry.recoveryAttempt,
      autoRecoverSupported: AUTO_RECOVER_PROVIDERS.has(panel.providerId),
      mergeSessionId: entry.mergeSessionId
    });
    entry.resolve(false);
    return;
  }

  console.warn('[MultiPanel] Retrying failed injection after reload:', panel.providerId);
  recordDebugLog('panel-injection:retry-after-reload', {
    panel: getPanelDebugInfo(panel),
    recoveryAttempt: entry.recoveryAttempt + 1,
    mergeSessionId: entry.mergeSessionId
  });
  const iframe = panel.iframe;
  const retryTimeout = setTimeout(() => {
    iframe.removeEventListener('load', retryAfterLoad);
    entry.resolve(false);
  }, 15000);
  const retryAfterLoad = () => {
    clearTimeout(retryTimeout);
    sendToPanel(panel, entry.text, entry.autoSubmit, entry.requestId, entry.recoveryAttempt + 1, entry.mergeSessionId)
      .then(entry.resolve);
  };
  iframe.addEventListener('load', retryAfterLoad, { once: true });
  reloadPanelIframe(panel);
}

async function sendToPanel(panel, text, autoSubmit = true, requestId = null, recoveryAttempt = 0, mergeSessionId = null) {
  return new Promise((resolve) => {
    try {
      if (!panel.iframe || !panel.iframe.contentWindow) {
        recordDebugLog('panel-send:missing-iframe', {
          panel: getPanelDebugInfo(panel),
          autoSubmit,
          recoveryAttempt,
          mergeSessionId
        });
        resolve(false);
        return;
      }

      const injectionRequestId = `inject-${panel.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      recordDebugLog('panel-send:start', {
        panel: getPanelDebugInfo(panel),
        autoSubmit,
        textLength: text.length,
        recoveryAttempt,
        mergeSessionId,
        injectionRequestId
      });
      const timeoutId = setTimeout(() => {
        const entry = pendingPanelInjections.get(injectionRequestId);
        if (!entry) return;
        pendingPanelInjections.delete(injectionRequestId);
        recordDebugLog('panel-injection:timeout', {
          panel: getPanelDebugInfo(entry.panel),
          autoSubmit: entry.autoSubmit,
          recoveryAttempt: entry.recoveryAttempt,
          mergeSessionId: entry.mergeSessionId,
          injectionRequestId
        });
        recoverFailedPanelInjection(entry);
      }, 6000);
      pendingPanelInjections.set(injectionRequestId, {
        resolve, panel, text, autoSubmit, requestId, recoveryAttempt, mergeSessionId, timeoutId
      });

      if (mergeSessionId) {
        postToPanelIframe(panel, {
          type: 'MONITOR_COMPLETION',
          mergeSessionId,
          panelId: panel.id,
          context: 'multi-panel'
        });
      }

      postToPanelIframe(panel, {
        type: 'INJECT_TEXT',
        text,
        autoSubmit,
        requestId,
        mergeSessionId,
        injectionRequestId,
        providerMode: getPanelProviderMode(panel),
        context: 'multi-panel'
      });
    } catch (error) {
      console.error(`Error sending to ${panel.providerId}:`, error);
      recordDebugLog('panel-send:error', {
        panel: getPanelDebugInfo(panel),
        autoSubmit,
        recoveryAttempt,
        mergeSessionId,
        message: error?.message || String(error)
      });
      resolve(false);
    }
  });
}

function getPanelPageIndex(panel) {
  const panelIndex = panels.indexOf(panel);
  if (panelIndex < 0) return currentPanelPage;
  const panelsPerPage = LAYOUT_PANEL_COUNTS[currentLayout] || 3;
  return Math.floor(panelIndex / panelsPerPage);
}

async function ensurePanelVisibleBeforeAutoSubmit(panel, autoSubmit, reason = 'send') {
  if (!autoSubmit || !panel) return;

  const targetPage = getPanelPageIndex(panel);
  if (currentPanelPage === targetPage) return;

  recordDebugLog('panel-send:activate-page', {
    panel: getPanelDebugInfo(panel),
    fromPage: currentPanelPage,
    toPage: targetPage,
    reason
  });
  currentPanelPage = targetPage;
  renderCurrentPage();
  await sleep(500);
}

// Clear all input boxes (unified input + all panels)
async function clearAllInputs() {
  // Clear unified input
  var unifiedInput = document.getElementById('unified-input');
  unifiedInput.value = '';
  unifiedInput.style.height = 'auto';

  // Send clear message to all panels (skip merge panels)
  getNonMergePanels().forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      postToPanelIframe(panel, {
        type: 'CLEAR_INPUT',
        providerMode: getPanelProviderMode(panel),
        context: 'multi-panel'
      });
    }
  });
  showToast(t('clearedAllInputs'));
}

// Create new chat for all panels
async function newChatAllProviders() {
  const newChatBtn = document.getElementById('new-chat-btn');

  if (discussionActive || discussionAbortController) {
    stopDiscussion('new-chat');
  }

  invalidateCompletionSessions('new-chat');
  stopMergeMonitor();
  if (autoExportWaitController) {
    autoExportWaitController.abort();
    autoExportWaitController = null;
  }
  autoExportRunId += 1;

  // Disable button during operation
  newChatBtn.disabled = true;

  panels.forEach(panel => {
    startFreshChatForPanel(panel, { invalidateSession: false });
  });

  restoreUnifiedInputFocusAfterNewChat();
  showToast(t('newChatCreated'));

  // Re-enable button
  setTimeout(() => {
    newChatBtn.disabled = false;
  }, 1000);
}

// Trigger send buttons only (no text injection) - used after Fill
async function triggerSendButtons() {
  const sendBtn = document.getElementById('send-all-btn');
  const statusEl = document.getElementById('send-status');
  const sendFocusRequestId = restoreUnifiedInputFocusAfterSend(getChatgptPanelsWithFrames());

  try {
    sendBtn.disabled = true;
    statusEl.textContent = t('sending');
    statusEl.className = 'send-status';

    // Send TRIGGER_SEND message to all panels (skip merge panels)
    const targetPanels = getNonMergePanels();
    targetPanels.forEach(panel => {
      if (panel.iframe && panel.iframe.contentWindow) {
        postToPanelIframe(panel, {
          type: 'TRIGGER_SEND',
          requestId: sendFocusRequestId,
          providerMode: getPanelProviderMode(panel),
          context: 'multi-panel'
        });
      }
    });

    // Update status
    statusEl.textContent = t('sentToAI', targetPanels.length);
    statusEl.className = 'send-status success';

    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } catch (error) {
    console.error('Error in triggerSendButtons:', error);
    statusEl.textContent = t('errorOccurred');
    statusEl.className = 'send-status error';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } finally {
    // Always re-enable buttons
    sendBtn.disabled = false;
  }
}

// ===== Layout Management =====
function updateScrollArrows() {
  const leftBtn = document.getElementById('scroll-left-btn');
  const rightBtn = document.getElementById('scroll-right-btn');
  if (!leftBtn || !rightBtn) return;

  const panelsPerPage = LAYOUT_PANEL_COUNTS[currentLayout] || 3;
  const totalPages = Math.max(1, Math.ceil(panels.length / panelsPerPage));

  leftBtn.style.display = currentPanelPage > 0 ? 'flex' : 'none';
  rightBtn.style.display = currentPanelPage < totalPages - 1 ? 'flex' : 'none';
}

function renderCurrentPage() {
  const panelsPerPage = LAYOUT_PANEL_COUNTS[currentLayout] || 3;
  const totalPages = Math.max(1, Math.ceil(panels.length / panelsPerPage));

  // 确保当前页码有效
  if (currentPanelPage >= totalPages) {
    currentPanelPage = totalPages - 1;
  }
  if (currentPanelPage < 0) {
    currentPanelPage = 0;
  }

  const startIndex = currentPanelPage * panelsPerPage;
  const endIndex = startIndex + panelsPerPage;

  // 显示/隐藏面板
  // 非当前页面板：position:absolute 脱离 grid 流（避免占位），opacity:0 让 iframe 仍能加载
  panels.forEach((panel, index) => {
    const panelEl = document.getElementById(panel.id);
    if (panelEl) {
      if (index >= startIndex && index < endIndex) {
        panelEl.style.position = '';
        panelEl.style.opacity = '';
        panelEl.style.pointerEvents = '';
        panelEl.style.width = '';
        panelEl.style.height = '';
      } else {
        panelEl.style.position = 'absolute';
        panelEl.style.opacity = '0';
        panelEl.style.pointerEvents = 'none';
        panelEl.style.width = '100%';
        panelEl.style.height = '100%';
      }
    }
  });

  // 更新翻页箭头可见性
  updateScrollArrows();
}

function setLayout(layout) {
  if (!LAYOUT_PANEL_COUNTS[layout]) return;
  currentLayout = layout;
  const panelGrid = document.getElementById('panel-grid');
  panelGrid.className = `layout-${layout}`;
  // 更新布局按钮高亮
  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === layout);
  });
  // 重新渲染当前页
  renderCurrentPage();
  saveProviderConfiguration();
  closeLayoutModal();
}

// ===== Prompt Library =====
let currentPromptFilter = 'recent'; // 'recent', 'favorites', 'all'
let currentCategoryFilter = '';
let selectedPromptForVariables = null;

async function loadPromptLibrary() {
  await loadCategoryFilter();
  await renderPromptList();
}

async function loadCategoryFilter() {
  const categorySelect = document.getElementById('prompt-category-filter');
  if (!categorySelect) return;

  try {
    const prompts = await getAllPrompts();
    const categories = [...new Set(prompts.map(p => p.category).filter(Boolean))];

    categorySelect.textContent = ''; // clear existing children safely
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = t('allCategories');
    categorySelect.appendChild(allOption);
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

async function toggleFavorite(promptId) {
  try {
    const prompt = await getPrompt(promptId);
    if (!prompt) return;

    await updatePrompt(promptId, { isFavorite: !prompt.isFavorite });
    renderPromptList(); // 刷新列表
  } catch (error) {
    console.error('[PromptLibrary] Toggle favorite failed:', error);
  }
}

async function deletePromptDirect(promptId) {
  try {
    const prompt = await getPrompt(promptId);
    if (!prompt) return;

    // 显示toast确认
    const toastId = showToast(
      `确认删除 "${prompt.title}"？`,
      {
        type: 'warning',
        duration: 3000,
        actions: [
          {
            label: '删除',
            onClick: async () => {
              await deletePrompt(promptId);
              await renderPromptList();
              await updateDefaultPromptBar();
              showToast('已删除', { type: 'success', duration: 1500 });
            }
          },
          {
            label: '取消',
            onClick: () => {} // 什么都不做
          }
        ]
      }
    );
  } catch (error) {
    console.error('[PromptLibrary] Delete prompt failed:', error);
  }
}

function detectVariables(content) {
  const regex = /\{(\w+)\}/g;
  const variables = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

// 默认提示词相关
let skipDefaultPromptOnce = false;

async function getDefaultPrompt() {
  const prompts = await getAllPrompts();
  return prompts.find(p => p.isDefault === true);
}

async function updateDefaultPromptBar() {
  const bar = document.getElementById('default-prompt-bar');
  const titleSpan = document.getElementById('default-prompt-title');

  if (!bar || !titleSpan) return;

  const defaultPrompt = await getDefaultPrompt();
  if (defaultPrompt) {
    titleSpan.textContent = defaultPrompt.title;
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
  }
}

async function prependDefaultPrompt(userInput) {
  const defaultPrompt = await getDefaultPrompt();
  if (defaultPrompt) {
    const content = defaultPrompt.content.replace(/\n+$/, '');
    return `${content}\n\n${userInput}`;
  }
  return userInput;
}

function bindDefaultPromptEvents() {
  const skipBtn = document.getElementById('skip-default-prompt-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      skipDefaultPromptOnce = true;
      showToast('本次发送将跳过默认提示词', { type: 'info', duration: 2000 });
    });
  }
}

async function sendMessageWithDefaultPrompt(inputValue) {
  let text = inputValue;
  if (!skipDefaultPromptOnce) {
    text = await prependDefaultPrompt(text);
  }
  skipDefaultPromptOnce = false;
  broadcastMessage(text);
}

async function renderPromptList(searchQuery = '') {
  const promptList = document.getElementById('prompt-list-modal');
  if (!promptList) return;

  try {
    let prompts;

    if (searchQuery) {
      prompts = await searchPrompts(searchQuery);
    } else if (currentPromptFilter === 'recent') {
      prompts = await getRecentlyUsedPrompts(20);
      // If no recent prompts, fall back to all
      if (prompts.length === 0) {
        prompts = await getAllPrompts();
      }
    } else if (currentPromptFilter === 'favorites') {
      prompts = await getFavoritePrompts();
    } else {
      prompts = await getAllPrompts();
    }

    // Apply category filter
    if (currentCategoryFilter) {
      prompts = prompts.filter(p => p.category === currentCategoryFilter);
    }

    if (prompts.length === 0) {
      promptList.textContent = ''; // clear existing children safely
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'prompt-empty';
      const emptyIcon = document.createElement('span');
      emptyIcon.className = 'material-symbols-outlined';
      setMaterialIcon(emptyIcon, 'auto_awesome');
      const emptyText = document.createElement('p');
      emptyText.textContent = searchQuery ? t('noMatchingPrompts') : t('noPrompts');
      emptyDiv.appendChild(emptyIcon);
      emptyDiv.appendChild(emptyText);
      promptList.appendChild(emptyDiv);
      return;
    }

    promptList.textContent = ''; // clear existing children safely
    prompts.slice(0, 30).forEach(prompt => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'prompt-item-modal';
      itemDiv.dataset.id = String(prompt.id);

      // 创建星标图标
      const favoriteIcon = document.createElement('span');
      favoriteIcon.className = `prompt-favorite-icon ${prompt.isFavorite ? 'favorited' : ''}`;
      favoriteIcon.textContent = prompt.isFavorite ? '★' : '☆';
      favoriteIcon.title = prompt.isFavorite ? '取消收藏' : '添加收藏';
      favoriteIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止冒泡
        toggleFavorite(prompt.id);
      });
      itemDiv.appendChild(favoriteIcon);

      // 创建删除图标
      const deleteIcon = document.createElement('span');
      deleteIcon.className = 'prompt-delete-icon';
      deleteIcon.textContent = '🗑️';
      deleteIcon.title = '删除';
      deleteIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止冒泡
        deletePromptDirect(prompt.id);
      });
      itemDiv.appendChild(deleteIcon);

      // 创建设为默认按钮
      const setDefaultBtn = document.createElement('button');
      setDefaultBtn.type = 'button';
      setDefaultBtn.className = `prompt-set-default-btn ${prompt.isDefault ? 'active' : ''}`;
      setDefaultBtn.textContent = prompt.isDefault ? '已默认' : '设为默认';
      setDefaultBtn.title = prompt.isDefault ? t('cancelDefaultPrompt') : t('setDefaultPrompt');
      setDefaultBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (prompt.isDefault) {
          await clearDefaultPrompt();
        } else {
          await setDefaultPrompt(prompt.id);
        }
        renderPromptList();
        updateDefaultPromptBar();
      });
      itemDiv.appendChild(setDefaultBtn);

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'prompt-item-content';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'prompt-item-modal-title';
      titleDiv.textContent = prompt.title || '未命名提示词';
      contentWrapper.appendChild(titleDiv);
      itemDiv.appendChild(contentWrapper);
      promptList.appendChild(itemDiv);
    });

    // Add click handlers
    promptList.querySelectorAll('.prompt-item-modal').forEach(item => {
      item.addEventListener('click', async () => {
        const promptId = parseInt(item.dataset.id);
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          await selectPrompt(prompt);
        }
      });
      
      // Double click to edit
      item.addEventListener('dblclick', async () => {
        const promptId = parseInt(item.dataset.id);
        openPromptEditor(promptId);
      });
    });
  } catch (error) {
    console.error('Error loading prompts:', error);
    promptList.textContent = ''; // clear existing children safely
    const errorDiv = document.createElement('div');
    errorDiv.className = 'prompt-empty';
    errorDiv.textContent = t('failedToLoadPrompts');
    promptList.appendChild(errorDiv);
  }
}

async function selectPrompt(prompt) {
  await recordPromptUsage(prompt.id);

  // 自动检测变量（合并已声明的变量和内容中检测到的变量）
  const detectedVars = detectVariables(prompt.content);
  const allVars = [...new Set([...(prompt.variables || []), ...detectedVars])];

  if (allVars.length > 0) {
    selectedPromptForVariables = { ...prompt, variables: allVars };
    showVariableModal({ ...prompt, variables: allVars });
  } else {
    applyPromptToInput(prompt.content);
    closePromptModal();
  }
}

function showVariableModal(prompt) {
  const modal = document.getElementById('variable-modal');
  const inputsContainer = document.getElementById('variable-inputs');

  inputsContainer.textContent = ''; // clear existing children safely
  prompt.variables.forEach(variable => {
    const group = document.createElement('div');
    group.className = 'variable-input-group';

    const label = document.createElement('label');
    label.htmlFor = `var-${variable}`;
    label.textContent = variable;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `var-${variable}`;
    input.dataset.variable = variable;
    input.placeholder = t('varInputPlaceholder', variable);

    group.appendChild(label);
    group.appendChild(input);
    inputsContainer.appendChild(group);
  });

  modal.style.display = 'flex';

  // Focus first input
  const firstInput = inputsContainer.querySelector('input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
}

function applyVariables() {
  if (!selectedPromptForVariables) return;

  let content = selectedPromptForVariables.content;
  const inputs = document.querySelectorAll('#variable-inputs input');

  inputs.forEach(input => {
    const variable = input.dataset.variable;
    const value = input.value || `{${variable}}`;
    // Replace all occurrences of {variable}
    const regex = new RegExp(`\\{${variable}\\}`, 'g');
    content = content.replace(regex, value);
  });

  applyPromptToInput(content);
  closeVariableModal();
  closePromptModal();
  selectedPromptForVariables = null;
}

function applyPromptToInput(content) {
  const input = document.getElementById('unified-input');
  input.value = content;
  input.focus();
}

function closeVariableModal() {
  document.getElementById('variable-modal').style.display = 'none';
  selectedPromptForVariables = null;
}

async function searchPromptLibrary(query) {
  await renderPromptList(query);
}

// ===== Answer Extraction & Copy All =====

function setExtractMode(enabled) {
  panels.forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      postToPanelIframe(panel, {
        type: 'SET_EXTRACT_MODE',
        enabled
      });
    }
  });
}

// 引用计数：多个提取操作可并发，只在首次开启 / 末次关闭 extractMode
function acquireExtractMode() {
  extractionDepth++;
  if (extractionDepth === 1) {
    setExtractMode(true);
  }
}

function releaseExtractMode() {
  extractionDepth--;
  if (extractionDepth <= 0) {
    extractionDepth = 0;
    setExtractMode(false);
  }
}

async function extractAllAnswers() {
  // 并发保护：如果正在提取中，等待当前提取完成并复用结果
  if (isExtractingAnswers && pendingExtractionPromise) {
    console.warn('[CopyAll] Extraction already in progress, waiting for current extraction');
    return pendingExtractionPromise;
  }
  isExtractingAnswers = true;

  const requestId = ++answerExtractionRequestId;

  // 开启提取模式：让所有面板（包括隐藏页的）都能提取到答案
  acquireExtractMode();

  const finish = (answers) => {
    isExtractingAnswers = false;
    pendingExtractionPromise = null;
    return answers;
  };

  pendingExtractionPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const entry = pendingAnswerExtractions.get(requestId);
      if (entry) {
        entry.completed = true;
        if (entry.retryTimer) { clearTimeout(entry.retryTimer); entry.retryTimer = null; }
        const responded = entry.respondedPanels ? entry.respondedPanels.size : 0;
        resolve(finish(entry.answers));
      } else {
        resolve(finish([]));
      }
      pendingAnswerExtractions.delete(requestId);
      releaseExtractMode();
    }, 25000);

    const answers = [];
    pendingAnswerExtractions.set(requestId, {
      resolve,
      timer: timeout,
      answers,
      completed: false,
      retryTimer: null
    });

    const targetPanels = getNonMergePanels();
    let sentCount = 0;
    targetPanels.forEach(panel => {
      if (panel.iframe && panel.iframe.contentWindow) {
        postToPanelIframe(panel, {
          type: 'EXTRACT_ANSWER',
          requestId,
          panelId: panel.id,
          context: 'multi-panel'
        });
        sentCount++;
      }
    });

    if (sentCount === 0) {
      clearTimeout(timeout);
      pendingAnswerExtractions.delete(requestId);
      releaseExtractMode();
      resolve(finish([]));
      return;
    }

    // 3秒后对未响应的面板重试一次（iframe content script 可能还没加载完）
    const retryTimer = setTimeout(() => {
      const entry = pendingAnswerExtractions.get(requestId);
      if (!entry || entry.completed) return; // 已完成或超时
      entry.retryTimer = null;
      const responded = entry.respondedPanels || new Set();
      const missing = targetPanels.filter(p => !responded.has(p.id));
      if (missing.length > 0) {
        missing.forEach(panel => {
          if (panel.iframe && panel.iframe.contentWindow) {
            postToPanelIframe(panel, {
              type: 'EXTRACT_ANSWER',
              requestId,
              panelId: panel.id,
              context: 'multi-panel'
            });
          }
        });
      }
    }, 3000);
    // Store retry timer ID so it can be cleared on early completion
    const entryForRetry = pendingAnswerExtractions.get(requestId);
    if (entryForRetry) entryForRetry.retryTimer = retryTimer;
  });

  return pendingExtractionPromise;
}

// 提取单个面板的答案（用于融合面板）
function extractSinglePanelAnswer(panel) {
  return new Promise((resolve) => {
    if (!panel || !panel.iframe || !panel.iframe.contentWindow) {
      resolve(null);
      return;
    }

    const requestId = `single-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let resolved = false;

    const handler = (event) => {
      if (event?.data?.type === 'EXTRACTED_ANSWER' &&
          event?.data?.context === 'multi-panel-answer' &&
          event?.data?.requestId === requestId) {
        window.removeEventListener('message', handler);
        releaseExtractMode();
        if (!resolved) {
          resolved = true;
          resolve(event.data.answer || null);
        }
      }
    };
    window.addEventListener('message', handler);

    acquireExtractMode();
    postToPanelIframe(panel, {
      type: 'EXTRACT_ANSWER',
      requestId,
      panelId: panel.id,
      context: 'multi-panel'
    });

    setTimeout(() => {
      window.removeEventListener('message', handler);
      releaseExtractMode();
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 15000);
  });
}

function handleExtractedAnswer(data) {
  if (!data.requestId || data.context !== 'multi-panel-answer') return;

  const entry = pendingAnswerExtractions.get(data.requestId);
  if (!entry) {
    console.warn('[CopyAll] Received answer but no pending extraction for requestId:', data.requestId);
    return;
  }

  if (!entry.respondedPanels) {
    entry.respondedPanels = new Set();
  }
  if (data.panelId) {
    entry.respondedPanels.add(data.panelId);
  }

  const hasAnswer = data.answer && data.answer.trim().length > 0;

  if (data.provider && hasAnswer) {
    // 用 Map 去重：同一 panelId 只收集一次答案
    if (!entry.answerMap) entry.answerMap = new Map();
    if (!entry.answerMap.has(data.panelId)) {
      const answerEntry = {
        providerId: data.provider,
        providerName: getProviderById(data.provider)?.name || data.provider,
        answer: data.answer
      };
      entry.answerMap.set(data.panelId, answerEntry);
      entry.answers.push(answerEntry);
    }
  } else if (data.provider && !hasAnswer) {
    console.warn('[CopyAll] Panel responded but answer is empty:', data.provider, 'panelId:', data.panelId);
  }

  const nonMergeCount = getNonMergePanels().length;
  if (entry.respondedPanels.size >= nonMergeCount) {
    entry.completed = true;
    clearTimeout(entry.timer);
    if (entry.retryTimer) { clearTimeout(entry.retryTimer); entry.retryTimer = null; }
    isExtractingAnswers = false;
    pendingExtractionPromise = null;
    entry.resolve(entry.answers);
    pendingAnswerExtractions.delete(data.requestId);
    releaseExtractMode();
  }
}

// Debug extraction - call debugExtraction() from console
window.debugExtraction = function() {
  panels.forEach(panel => {
    const hasIframe = !!panel.iframe;
    const hasContentWindow = hasIframe && !!panel.iframe.contentWindow;
    if (hasIframe && hasContentWindow) {
      postToPanelIframe(panel, {
        type: 'EXTRACT_DEBUG',
        panelId: panel.id,
        context: 'multi-panel'
      });
    }
  });
};

// ===== Auto Merge / Fusion =====

const MERGE_TARGET_URLS = {
  deepseek: 'https://chat.deepseek.com/',
  kimi: 'https://kimi.com/',
  qianwen: 'https://www.qianwen.com/',
  zhipu: 'https://chatglm.cn/',
  wenxin: 'https://chat.baidu.com/',
  doubao: 'https://www.doubao.com/chat/',
  metaso: 'https://metaso.cn/',
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/',
  claude: 'https://claude.ai/',
  grok: 'https://grok.com/'
};

let MERGE_MAX_WAIT = 120000;         // 默认120秒，可从设置读取
let AUTO_MERGE_ENABLED = true;

let mergeCompletedPanels = new Set();
let mergeTimeoutTimer = null;
let mergeIsActive = false;
let activeMergeSessionId = null;
let completionSessionGeneration = 0;
let activeCompletionSessionGeneration = 0;
let autoExportWaitController = null;
let autoExportRunId = 0;
let autoExportWriteInProgress = false;
let lastSentQuestion = '';
let lastMergeType = null; // 'auto' | 'timeout' | 'manual' | null

function getMergeBadgeMeta(type = lastMergeType) {
  if (type === 'auto') {
    return {
      background: '#10b981',
      text: t('autoMerge'),
      title: ''
    };
  }

  if (type === 'manual') {
    return {
      background: '#64748b',
      text: t('manualMerge'),
      title: ''
    };
  }

  return {
    background: '#f59e0b',
    text: t('timeoutMerge'),
    title: t('mergeTimeoutTooltip')
  };
}

function startMergeMonitor(mergeSessionId) {
  stopMergeMonitor();
  mergeIsActive = true;
  activeMergeSessionId = mergeSessionId;
  activeCompletionSessionGeneration = completionSessionGeneration;
  mergeCompletedPanels = new Set();
  const mergeBtn = document.getElementById('merge-btn');
  if (mergeBtn) mergeBtn.classList.add('active');


  // 开启提取模式，让隐藏页的停止按钮也能被检测到
  acquireExtractMode();

  const nonMergePanels = getNonMergePanels();
  recordDebugLog('merge-monitor:start', {
    mergeSessionId,
    autoMergeEnabled: AUTO_MERGE_ENABLED,
    mergeMaxWait: MERGE_MAX_WAIT,
    targetPanels: nonMergePanels.map(getPanelDebugInfo)
  });
  nonMergePanels.forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      postToPanelIframe(panel, {
        type: 'MONITOR_COMPLETION',
        mergeSessionId,
        panelId: panel.id,
        context: 'multi-panel'
      });
    }
  });

  // Safety net: force merge after max wait (from Send All). In manual mode
  // neither a timeout nor all-complete detection may initiate a merge.
  if (AUTO_MERGE_ENABLED) {
    mergeTimeoutTimer = setTimeout(() => {
      if (!mergeIsActive || !AUTO_MERGE_ENABLED) return;
      lastMergeType = 'timeout';
      recordDebugLog('merge-monitor:timeout', {
        mergeSessionId,
        completedCount: mergeCompletedPanels.size,
        totalCount: getNonMergePanels().length,
        completedPanelIds: Array.from(mergeCompletedPanels)
      });
      stopMergeMonitor();
      triggerMerge();
    }, MERGE_MAX_WAIT);
  }
}

function handleMergeCompletionDetected(data) {
  if (data.context !== 'multi-panel-completion') {
    return;
  }

  if (String(data.mergeSessionId || '').startsWith('discussion-round-')) {
    return;
  }

  if (!activeMergeSessionId || data.mergeSessionId !== activeMergeSessionId) {
    recordDebugLog('completion:ignored-session-mismatch', {
      provider: data.provider,
      panelId: data.panelId,
      incomingSessionId: data.mergeSessionId,
      activeMergeSessionId
    });
    return;
  }

  if (activeCompletionSessionGeneration !== completionSessionGeneration) {
    recordDebugLog('completion:ignored-stale-generation', {
      provider: data.provider,
      panelId: data.panelId,
      mergeSessionId: data.mergeSessionId,
      activeCompletionSessionGeneration,
      completionSessionGeneration
    });
    return;
  }

  if (!mergeIsActive) {
    recordDebugLog('completion:ignored-inactive', {
      provider: data.provider,
      panelId: data.panelId,
      mergeSessionId: data.mergeSessionId
    });
    return;
  }

  // 融合面板完成时，发送 MERGE_COMPLETE 事件（供讨论模式使用）
  // 优先用 panelId 精确匹配，避免同 providerId 的源面板被误判为融合面板
  const isFromMergePanel = data.panelId
    ? mergePanelIds.has(data.panelId)
    : !!panels.find(p => p.providerId === data.provider && mergePanelIds.has(p.id));
  if (isFromMergePanel) {
    recordDebugLog('merge-panel:completion-detected', {
      provider: data.provider,
      panelId: data.panelId,
      mergeSessionId: data.mergeSessionId
    });
    window.postMessage({ type: 'MERGE_COMPLETE', answer: null, provider: data.provider }, '*');
    return;
  }

  // 优先用 panelId 精确匹配，回退到 providerId
  const panel = data.panelId
    ? panels.find(p => p.id === data.panelId)
    : panels.find(p => p.providerId === data.provider && !isMergePanel(p));
  if (!panel) {
    console.warn('[Merge] No panel found for provider:', data.provider);
    recordDebugLog('completion:no-panel-found', {
      provider: data.provider,
      panelId: data.panelId,
      mergeSessionId: data.mergeSessionId
    });
    return;
  }

  if (mergeCompletedPanels.has(panel.id)) return;

  mergeCompletedPanels.add(panel.id);
  const nonMergeCount = getNonMergePanels().length;
  recordDebugLog('merge-monitor:panel-complete', {
    panel: getPanelDebugInfo(panel),
    mergeSessionId: data.mergeSessionId,
    completedCount: mergeCompletedPanels.size,
    totalCount: nonMergeCount
  });

  if (mergeCompletedPanels.size >= nonMergeCount) {
    if (!AUTO_MERGE_ENABLED) {
      recordDebugLog('merge-monitor:all-complete-manual-mode', {
        mergeSessionId: data.mergeSessionId,
        totalCount: nonMergeCount
      });
      stopMergeMonitor();
      return;
    }
    lastMergeType = 'auto';
    recordDebugLog('merge-monitor:all-complete-auto-merge', {
      mergeSessionId: data.mergeSessionId,
      totalCount: nonMergeCount
    });
    stopMergeMonitor();
    triggerMerge();
  }
}

function stopMergeMonitor() {
  if (mergeIsActive || activeMergeSessionId) {
    recordDebugLog('merge-monitor:stop', {
      mergeSessionId: activeMergeSessionId,
      completedCount: mergeCompletedPanels.size,
      totalCount: getNonMergePanels().length
    });
  }
  mergeIsActive = false;
  activeMergeSessionId = null;
  activeCompletionSessionGeneration = 0;
  mergeCompletedPanels.clear();
  releaseExtractMode();

  if (mergeTimeoutTimer) {
    clearTimeout(mergeTimeoutTimer);
    mergeTimeoutTimer = null;
  }

  // Tell non-merge panels to stop monitoring
  getNonMergePanels().forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      postToPanelIframe(panel, {
        type: 'STOP_MONITORING',
        context: 'multi-panel'
      });
    }
  });

  const mergeBtn = document.getElementById('merge-btn');
  if (mergeBtn) mergeBtn.classList.remove('active');
}

function clearActiveCompletionSession() {
  mergeIsActive = false;
  activeMergeSessionId = null;
  activeCompletionSessionGeneration = 0;
  mergeCompletedPanels.clear();
}

function beginCompletionSession(mergeSessionId, generation = completionSessionGeneration) {
  activeMergeSessionId = mergeSessionId;
  mergeIsActive = true;
  activeCompletionSessionGeneration = generation;
}

function invalidateCompletionSessions(reason = 'reset') {
  completionSessionGeneration += 1;
  recordDebugLog('completion-session:invalidate', {
    reason,
    completionSessionGeneration
  });
  clearActiveCompletionSession();
}

function generateFallbackTitle() {
  const now = new Date();
  const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `AI融合-${now.toISOString().slice(0, 10)}-${hhmmss}`;
}

function isTrueSetting(value) {
  return value === true || value === 'true';
}

function normalizeAnswerForMerge(answer) {
  return sanitizeMergedAnswerForDiscussion(answer);
}

function buildMergePrompt(question, answers) {
  const isEn = currentLocale === 'en';
  const today = new Date().toLocaleDateString(isEn ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const parts = answers.map(a => `【${a.providerName}】\n${normalizeAnswerForMerge(a.answer)}`).join('\n');

  if (isEn) {
    return `You synthesize multiple model responses. Today: ${today}
[Original Question]
${question}
[Model Responses]
${parts}
Rules:
1. Start by writing the original question exactly
2. Prioritize the most recent information; remove clearly outdated data
3. Synthesize useful content from each response and remove duplicates; when models disagree, preserve each position and cite the source model
4. Use Markdown, no tables
5. Output scores on a separate line starting with "Model scores:", format: Model scores: ModelName=score, ModelName=score
6. Output a title on a separate line starting with "Title:", format: Title: title within 10 words`.replace(/\n{2,}/g, '\n');
  }

  return `你是一位答案综合者。当前日期：${today}
[原始问题]
${question}
[各模型回答]
${parts}
规则：
1. 先原样写出原始问题
2. 以最新的信息为准，删除明显过时的数据
3. 综合各回答的有效内容并去重，有分歧时保留各方立场，注明来源
4. 使用 Markdown 输出，不用表格
5. 单独一行输出评分，必须以“模型评分：”开头，格式：模型评分：模型名=分数，模型名=分数
6. 单独一行输出标题，必须以“标题：”开头，格式：标题：标题内容，标题控制在10字以内`.replace(/\n{2,}/g, '\n');
}

function buildDiscussPrompt(question, mergedAnswer) {
  const isEn = currentLocale === 'en';
  const today = new Date().toLocaleDateString(isEn ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const cleanMergedAnswer = sanitizeMergedAnswerForDiscussion(mergedAnswer);

  if (isEn) {
    return `Task: Review the current merged result. Current date: ${today}
[Original Question]
${question}
[Current Merged Result]
${cleanMergedAnswer}
Output Rules:
1. Do not rewrite the full answer; output only corrections, additions, or objections
2. If there is no objection, output only: Agree with the current merged result; no new corrections
3. Prioritize recent information and flag clearly outdated or unreliable content
4. Do not use tables; use numbered lists for comparisons
5. For each correction or addition, cite evidence, source model, or accurate source channel
6. If there is a conflict, state the conflict, each position, and your judgment`.replace(/\n{2,}/g, '\n');
  }

  return `任务：复核当前融合结果。当前日期：${today}
[原始问题]
${question}
[当前融合结果]
${cleanMergedAnswer}
输出规则：
1. 不要重写完整答案，只输出需要修正、补充或反对的内容
2. 如果没有异议，只输出：同意当前融合结果，无新增修正
3. 以最新信息为准，指出明显过时或不可靠的内容
4. 禁止使用表格；对比内容使用编号列表
5. 每条修正或补充都注明依据、来源模型或准确来源渠道
6. 如存在冲突，说明冲突点、各方立场和你的判断结论`.replace(/\n{2,}/g, '\n');
}

function isMeaninglessStandaloneSymbolLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;

  // Remove orphan Markdown/list separators such as "-", "---", "*", ">", or "——".
  // Keep meaningful values such as "-20%", "1.", "【豆包】", and normal list items.
  return /^[\-–—_*•·.,，、;；:：|/\\()[\]{}<>《》【】"'“”‘’`~!！?？=+^$#@%&]+$/.test(trimmed);
}

function sanitizeMergedAnswerForDiscussion(answer) {
  let inCodeBlock = false;

  return String(answer || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(line => {
      if (/^\s*```/.test(line)) {
        inCodeBlock = !inCodeBlock;
        return true;
      }

      if (inCodeBlock) return true;

      // Remove blank lines, including lines that contain only spaces or tabs.
      if (!String(line || '').trim()) return false;

      return !isMeaninglessStandaloneSymbolLine(line);
    })
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

async function triggerMerge() {
  recordDebugLog('merge:trigger-start', {
    lastMergeType,
    selectedMergeTarget: selectedMergeTarget || 'deepseek'
  });
  const answers = await extractAllAnswers();
  const validAnswers = answers.filter(a => a.answer && a.answer.trim().length > 0);
  recordDebugLog('merge:answers-extracted', {
    totalAnswers: answers.length,
    validAnswers: validAnswers.length,
    providers: answers.map(a => ({
      providerName: a.providerName,
      answerLength: String(a.answer || '').length,
      hasAnswer: Boolean(a.answer && a.answer.trim())
    }))
  });

  if (validAnswers.length === 0) {
    recordDebugLog('merge:aborted-no-valid-answers');
    return;
  }

  const question = lastSentQuestion || document.getElementById('unified-input')?.value || '';
  const prompt = buildMergePrompt(question, validAnswers);
  const targetProvider = selectedMergeTarget || 'deepseek';

  // 获取讨论模式设置
  const settings = await getSettings();
  const mergeMode = settings.mergeMode || 'merge';
  const discussRounds = DISCUSSION_ROUNDS;
  recordDebugLog('merge:prompt-built', {
    targetProvider,
    mergeMode,
    discussRounds,
    promptLength: prompt.length,
    questionLength: question.length,
    sourceProviders: validAnswers.map(a => a.providerName)
  });

  // 查找已有的融合面板（providerId 匹配 + 在 mergePanelIds 中）
  const existingPanel = panels.find(p => p.providerId === targetProvider && mergePanelIds.has(p.id));

  if (existingPanel) {
    recordDebugLog('merge:reuse-panel', {
      panel: getPanelDebugInfo(existingPanel),
      targetProvider,
      mergeMode
    });
    // 导航到融合面板所在的页面
    const panelIndex = panels.indexOf(existingPanel);
    const panelsPerPage = LAYOUT_PANEL_COUNTS[currentLayout] || 3;
    const targetPage = Math.floor(panelIndex / panelsPerPage);
    if (currentPanelPage !== targetPage) {
      currentPanelPage = targetPage;
      renderCurrentPage();
    }

    // 更新融合状态标签
    const existingBadge = document.getElementById(existingPanel.id)?.querySelector('#merge-status-badge');
    if (existingBadge) {
      const badgeMeta = getMergeBadgeMeta();
      existingBadge.style.background = badgeMeta.background;
      existingBadge.textContent = badgeMeta.text;
      existingBadge.title = badgeMeta.title;
    }

    // 复用已有面板：直接注入提示词
    existingPanel.exportData = {
      question,
      providers: validAnswers.map(a => a.providerName),
      mode: mergeMode === 'merge+discuss' ? 'discuss' : 'merge'
    };

    // Diagnostic: listen for response from content script
    const mergeRequestId = `merge-reuse-${Date.now()}`;
    let gotResponse = false;
    const diagHandler = (event) => {
      if (event?.data?.type === 'INJECT_TEXT_RECEIVED' && event?.data?.mergeRequestId === mergeRequestId) {
        gotResponse = true;
        window.removeEventListener('message', diagHandler);
        clearTimeout(diagTimeoutId);
      }
    };
    window.addEventListener('message', diagHandler);

    // 先监听融合面板完成，再发送 INJECT_TEXT，避免普通融合和讨论融合的导出/讨论竞态
    const mergeOutputSessionId = `merge-output-${Date.now()}`;
    beginCompletionSession(mergeOutputSessionId);
    postToPanelIframe(existingPanel, {
      type: 'MONITOR_COMPLETION',
      mergeSessionId: mergeOutputSessionId,
      panelId: existingPanel.id,
      context: 'multi-panel'
    });

    postToPanelIframe(existingPanel, {
      type: 'INJECT_TEXT',
      text: prompt,
      autoSubmit: true,
      context: 'auto-merge',
      mergeRequestId
    });

    // Timeout check: if no response in 3s, log warning
    const diagTimeoutId = setTimeout(() => {
      if (!gotResponse) {
        window.removeEventListener('message', diagHandler);
        console.warn('[Merge] No response from content script after 3s! iframe may not have received the message.');
        console.warn('[Merge] iframe.readyState may be:', existingPanel.iframe?.readyState);
        console.warn('[Merge] iframe src:', existingPanel.iframe?.src);
      }
    }, 3000);

    existingPanel.iframe.closest('.panel-item')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });

    // 仅融合模式：融合完成后自动导出
    if (mergeMode !== 'merge+discuss') {
      recordDebugLog('merge:auto-export-scheduled', {
        panel: getPanelDebugInfo(existingPanel)
      });
      autoExportToMarkdown(existingPanel);
    }

    // 如果是讨论模式，等待融合完成后开始讨论
    if (mergeMode === 'merge+discuss') {
      recordDebugLog('discussion:start-after-existing-merge', {
        panel: getPanelDebugInfo(existingPanel),
        discussRounds
      });
      startDiscussionAfterMerge(prompt, discussRounds, existingPanel).catch(e => {
        console.error('[Discussion] Error:', e);
        showToast(t('errorOccurred'));
      });
    }

    return;
  }

  // 没有已有面板，创建新的
  // 检查是否超过最大面板数
  const provider = getProviderById(targetProvider);
  if (!provider) {
    console.error('[Merge] Provider not found:', targetProvider);
    recordDebugLog('merge:provider-not-found', { targetProvider });
    return;
  }

  const panelId = `panel-merge-${Date.now()}`;
  const panelGrid = document.getElementById('panel-grid');

  // 创建面板元素 (safe DOM construction, no innerHTML)
  const panelEl = document.createElement('div');
  panelEl.className = 'panel-item';
  panelEl.id = panelId;
  panelEl.dataset.providerId = targetProvider;

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'panel-header-left';

  const headerIcon = document.createElement('img');
  headerIcon.src = getThemeAwareProviderIcon(provider);
  headerIcon.alt = provider.name;
  headerIcon.className = 'provider-icon';
  headerIcon.dataset.providerId = provider.id;

  const headerName = document.createElement('span');
  setBrandText(headerName, `${provider.name}(${t('merge')})`);

  const mergeBadge = document.createElement('span');
  mergeBadge.id = 'merge-status-badge';
  const badgeMeta = getMergeBadgeMeta();
  mergeBadge.style.background = badgeMeta.background;
  mergeBadge.style.color = 'white';
  mergeBadge.style.padding = '2px 6px';
  mergeBadge.style.fontSize = '10px';
  mergeBadge.style.fontWeight = '600';
  mergeBadge.style.borderRadius = '3px';
  mergeBadge.style.marginLeft = '6px';
  mergeBadge.style.whiteSpace = 'nowrap';
  mergeBadge.title = badgeMeta.title;
  mergeBadge.textContent = badgeMeta.text;

  headerLeft.appendChild(headerIcon);
  headerLeft.appendChild(headerName);
  headerLeft.appendChild(mergeBadge);

  const headerRight = document.createElement('div');
  headerRight.className = 'panel-header-right';
  headerRight.innerHTML = getPanelHeaderRightHtml(targetProvider);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // Iframe container
  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'panel-iframe-container';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'panel-loading';

  const loadingIcon = document.createElement('img');
  loadingIcon.src = getThemeAwareProviderIcon(provider);
  loadingIcon.alt = provider.name;
  loadingIcon.className = 'loading-icon';
  loadingIcon.dataset.providerId = provider.id;

  const loadingText = document.createElement('span');
  loadingText.className = 'loading-text';
  loadingText.textContent = t('loadingProvider', provider.name);

  loadingEl.appendChild(loadingIcon);
  loadingEl.appendChild(loadingText);

  const iframe = document.createElement('iframe');
  iframe.src = getProviderFrameUrl(targetProvider);
  iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';
  iframe.allow = 'clipboard-read; clipboard-write';

  iframeContainer.appendChild(loadingEl);
  iframeContainer.appendChild(iframe);
  panelEl.appendChild(header);
  panelEl.appendChild(iframeContainer);

  // 插入到最左边（prepend）
  panelGrid.insertBefore(panelEl, panelGrid.firstChild);
  panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  mergePanelIds.add(panelId);
  recordDebugLog('merge:create-panel', {
    panelId,
    targetProvider,
    mergeMode,
    discussRounds
  });

  // 添加到 panels 数组最前面
  panels.unshift({
    id: panelId,
    providerId: targetProvider,
    iframe,
    state: 'loading',
    exportData: {
      question,
      providers: validAnswers.map(a => a.providerName),
      mode: mergeMode === 'merge+discuss' ? 'discuss' : 'merge'
    }
  });

  bindPanelHeaderActions(panelId);
  await saveProviderConfiguration();

  // 跳转到第一页显示融合面板
  currentPanelPage = 0;
  renderCurrentPage();

  // 等 iframe 加载完成后注入提示词（带重试机制）
  const mergeOutputSessionId = `merge-output-${Date.now()}`;

  // 提前设置 mergeSessionId，让普通融合和讨论融合都能收到融合面板完成信号
  beginCompletionSession(mergeOutputSessionId);

  iframe.addEventListener('load', () => {
    loadingEl.classList.add('hidden');
    const mergeRequestId = `merge-new-${Date.now()}`;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let gotResponse = false;
    let pendingRetry = null;

    const diagHandler = (event) => {
      if (event?.data?.type === 'INJECT_TEXT_RECEIVED' && event?.data?.mergeRequestId === mergeRequestId) {
        gotResponse = true;
        window.removeEventListener('message', diagHandler);
        if (pendingRetry) { clearTimeout(pendingRetry); pendingRetry = null; }
      }
    };
    window.addEventListener('message', diagHandler);

    function doInject() {
      const panel = panels.find(p => p.id === panelId);
      if (panel) {
        panel.exportData = {
          question,
          providers: validAnswers.map(a => a.providerName),
          mode: mergeMode === 'merge+discuss' ? 'discuss' : 'merge'
        };
        // 先发送 MONITOR_COMPLETION 再发送 INJECT_TEXT，避免融合完成事件丢失
        postToPanelIframe(panel, {
          type: 'MONITOR_COMPLETION',
          mergeSessionId: mergeOutputSessionId,
          panelId: panel.id,
          context: 'multi-panel'
        });

        postToPanelIframe(panel, {
          type: 'INJECT_TEXT',
          text: prompt,
          autoSubmit: true,
          context: 'auto-merge',
          mergeRequestId
        });
      }
    }

    // Send immediately
    doInject();

    // Schedule retries if no response within 2s
    function scheduleRetry() {
      pendingRetry = setTimeout(() => {
        if (gotResponse || retryCount >= MAX_RETRIES) {
          window.removeEventListener('message', diagHandler);
          if (!gotResponse) {
            console.warn('[Merge] No response from content script after', MAX_RETRIES, 'retries.');
          }
          return;
        }
        retryCount++;
        doInject();
        scheduleRetry();
      }, 2000);
    }
    scheduleRetry();
  });

  // 仅融合模式：等待融合完成后自动导出
  if (mergeMode !== 'merge+discuss') {
    const newPanel = panels.find(p => p.id === panelId);
    recordDebugLog('merge:auto-export-waiting-for-new-panel-completion', {
      panel: getPanelDebugInfo(newPanel)
    });
    autoExportToMarkdown(newPanel);
  }

  // 如果是讨论模式，等待融合完成后开始讨论
  if (mergeMode === 'merge+discuss') {
    const mergePanel = panels.find(p => p.id === panelId);
    recordDebugLog('discussion:start-after-new-merge', {
      panel: getPanelDebugInfo(mergePanel),
      discussRounds
    });
    startDiscussionAfterMerge(prompt, discussRounds, mergePanel).catch(e => {
      console.error('[Discussion] Error:', e);
      showToast(t('errorOccurred'));
    });
  }
}

// ===== Discussion Interruption Infrastructure =====
let discussionAbortController = null;
let discussionActive = false;
let lastDiscussionTitle = '';

function stopDiscussion(reason = 'user') {
  const wasActive = discussionActive || Boolean(discussionAbortController);
  if (discussionAbortController) {
    discussionAbortController.abort();
  }
  invalidateCompletionSessions(`discussion-stop:${reason}`);
  if (wasActive) {
    recordDebugLog('discussion:stop', { reason });
    hideDiscussionStatusBar();
    stopMergeMonitor();
  }
}

function showDiscussionStatusBar(totalRounds) {
  const bar = document.getElementById('discussion-status-bar');
  if (bar) {
    bar.style.display = 'flex';
    const text = document.getElementById('discussion-progress-text');
    if (text) {
      text.textContent = t('discussionProgressInitial', String(totalRounds));
    }
  }
}

function hideDiscussionStatusBar() {
  const bar = document.getElementById('discussion-status-bar');
  if (bar) bar.style.display = 'none';
}

function updateDiscussionProgress(currentRound, totalRounds) {
  const text = document.getElementById('discussion-progress-text');
  if (text) {
    text.textContent = t('discussionProgress', String(currentRound), String(totalRounds));
  }
}

function getCurrentMergeMaxWait() {
  return Number.isFinite(MERGE_MAX_WAIT) && MERGE_MAX_WAIT > 0
    ? MERGE_MAX_WAIT
    : 120000;
}

function waitForDiscussionPanelsCompletionWithAbort(targetPanels, signal, timeoutMs = getCurrentMergeMaxWait(), abortEventName = 'discussion-wait:aborted') {
  return new Promise((resolve) => {
    if (targetPanels.length === 0) { resolve(); return; }
    if (signal.aborted) { resolve(); return; }
    const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
      ? Number(timeoutMs)
      : getCurrentMergeMaxWait();

    const completedPanelIds = new Set();
    const targetPanelIds = new Set(targetPanels.map(p => p.id));
    recordDebugLog('discussion-wait:start', {
      timeoutMs: safeTimeoutMs,
      targetPanels: targetPanels.map(getPanelDebugInfo)
    });

    const handler = (event) => {
      if (event?.data?.type === 'COMPLETION_DETECTED' &&
          event?.data?.context === 'multi-panel-completion') {
        const panelId = event?.data?.panelId;
        if (panelId && targetPanelIds.has(panelId)) {
          completedPanelIds.add(panelId);
        } else if (!panelId) {
          const provider = event?.data?.provider;
          const match = targetPanels.find(p => p.providerId === provider);
          if (match) completedPanelIds.add(match.id);
        }
        recordDebugLog('discussion-wait:panel-complete', {
          provider: event?.data?.provider,
          panelId: event?.data?.panelId,
          completedCount: completedPanelIds.size,
          totalCount: targetPanels.length
        });
        if (completedPanelIds.size >= targetPanels.length) {
          recordDebugLog('discussion-wait:all-complete', {
            completedCount: completedPanelIds.size,
            totalCount: targetPanels.length
          });
          cleanup();
          resolve();
        }
      }
    };

    const onAbort = () => {
      recordDebugLog(abortEventName, {
        completedCount: completedPanelIds.size,
        totalCount: targetPanels.length,
        completedPanelIds: Array.from(completedPanelIds)
      });
      cleanup();
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });

    const timeout = setTimeout(() => {
      console.warn('[Discussion] Round completion timeout after', safeTimeoutMs, 'ms, proceeding with', completedPanelIds.size, '/', targetPanels.length, 'panels completed');
      recordDebugLog('discussion-wait:timeout', {
        timeoutMs: safeTimeoutMs,
        completedCount: completedPanelIds.size,
        totalCount: targetPanels.length,
        completedPanelIds: Array.from(completedPanelIds),
        missingPanels: targetPanels
          .filter(panel => !completedPanelIds.has(panel.id))
          .map(getPanelDebugInfo)
      });
      cleanup();
      resolve();
    }, safeTimeoutMs);

    window.addEventListener('message', handler);

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      signal.removeEventListener('abort', onAbort);
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const DISCUSSION_START_GATE_POLL_MS = 2500;
const DISCUSSION_START_GATE_STABLE_MS = 8000;
const DISCUSSION_START_GATE_MAX_WAIT_MS = 30000;
const DISCUSSION_FINAL_EXPORT_STABLE_MS = 15000;

function getDiscussionStartGateTimeout(timeoutMs) {
  const configuredTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : getCurrentMergeMaxWait();
  return Math.min(configuredTimeoutMs, DISCUSSION_START_GATE_MAX_WAIT_MS);
}

function getDiscussionStartGateOverallTimeout(timeoutMs) {
  return Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : getCurrentMergeMaxWait();
}

function sleepWithAbort(ms, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(cleanup, ms);
    const onAbort = () => cleanup();

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeAnswerForStability(answer) {
  return String(answer || '').replace(/\s+/g, ' ').trim();
}

async function waitForDiscussionStartGate(panel, signal, timeoutMs, baselineText) {
  // Two timers are intentionally separated:
  // 1. overallTimeoutMs: how long we may wait for the merge panel to produce this round's answer.
  // 2. activeTimeoutMs: fallback timer after the new answer has actually started.
  //
  // When reusing a merge panel, old answers remain visible. Counting the 30s fallback from gate:start
  // lets the old visible answer consume most of the budget, so discussion can begin while the new
  // merge answer is still generating. Count the short fallback only after new-answer-started.
  const activeTimeoutMs = getDiscussionStartGateTimeout(timeoutMs);
  const overallTimeoutMs = getDiscussionStartGateOverallTimeout(timeoutMs);
  const startedAt = Date.now();
  let completionEventData = null;
  let completedByEvent = false;
  let latestAnswer = '';
  let latestNormalized = '';
  let stableCandidate = '';
  let stableSince = 0;
  let firstSeenLogged = false;
  const baselineNormalized = normalizeAnswerForStability(baselineText || '');
  let newAnswerStarted = false;
  let newAnswerStartedAt = 0;

  recordDebugLog('discussion-start-gate:start', {
    panel: getPanelDebugInfo(panel),
    timeoutMs: activeTimeoutMs,
    overallTimeoutMs,
    pollMs: DISCUSSION_START_GATE_POLL_MS,
    stableMs: DISCUSSION_START_GATE_STABLE_MS,
    baselineLength: baselineNormalized.length,
    hasBaseline: baselineNormalized.length > 0
  });

  const completionHandler = (event) => {
    if (event?.data?.type !== 'MERGE_COMPLETE') return;
    completedByEvent = true;
    completionEventData = event.data || {};
  };
  window.addEventListener('message', completionHandler);

  try {
    while (!signal.aborted && Date.now() - startedAt < overallTimeoutMs) {
      if (completedByEvent) {
        let eventAnswer = completionEventData?.answer || '';
        if (!eventAnswer && panel) {
          eventAnswer = await extractSinglePanelAnswer(panel) || '';
        }
        const eventNormalized = normalizeAnswerForStability(eventAnswer);

        recordDebugLog('discussion-start-gate:event-complete', {
          panel: getPanelDebugInfo(panel),
          elapsedMs: Date.now() - startedAt,
          answerLength: String(eventAnswer || '').length,
          baselineLength: baselineNormalized.length
        });

        if (eventAnswer && eventAnswer.trim() && (!baselineNormalized || eventNormalized !== baselineNormalized)) {
          return {
            answer: eventAnswer,
            reason: 'event-complete'
          };
        }

        if (baselineNormalized && eventNormalized === baselineNormalized) {
          recordDebugLog('discussion-start-gate:event-ignored-baseline', {
            panel: getPanelDebugInfo(panel),
            elapsedMs: Date.now() - startedAt,
            answerLength: String(eventAnswer || '').length,
            baselineLength: baselineNormalized.length
          });
        }

        completedByEvent = false;
      }

      const currentAnswer = await extractSinglePanelAnswer(panel) || '';
      const currentNormalized = normalizeAnswerForStability(currentAnswer);

      if (currentNormalized) {
        latestAnswer = currentAnswer;
        latestNormalized = currentNormalized;

        if (!firstSeenLogged) {
          firstSeenLogged = true;
          recordDebugLog('discussion-start-gate:text-first-seen', {
            panel: getPanelDebugInfo(panel),
            elapsedMs: Date.now() - startedAt,
            answerLength: currentAnswer.length
          });
        }

        // 检测本轮新答案是否已开始（与 baseline 不同）
        if (!newAnswerStarted) {
          const changedFromBaseline = baselineNormalized
            ? currentNormalized !== baselineNormalized &&
              Math.abs(currentNormalized.length - baselineNormalized.length) > 20
            : Boolean(currentNormalized);
          if (changedFromBaseline) {
            newAnswerStarted = true;
            newAnswerStartedAt = Date.now();
            stableCandidate = '';
            stableSince = 0;
            recordDebugLog('discussion-start-gate:new-answer-started', {
              panel: getPanelDebugInfo(panel),
              elapsedMs: Date.now() - startedAt,
              answerLength: currentAnswer.length,
              baselineLength: baselineNormalized.length
            });
          }
        }

        if (newAnswerStarted) {
          if (currentNormalized !== stableCandidate) {
            stableCandidate = currentNormalized;
            stableSince = Date.now();
            recordDebugLog('discussion-start-gate:text-changed', {
              panel: getPanelDebugInfo(panel),
              elapsedMs: Date.now() - startedAt,
              answerLength: currentAnswer.length
            });
          } else if (Date.now() - stableSince >= DISCUSSION_START_GATE_STABLE_MS) {
            recordDebugLog('discussion-start-gate:text-stable', {
              panel: getPanelDebugInfo(panel),
              elapsedMs: Date.now() - startedAt,
              stableMs: Date.now() - stableSince,
              answerLength: currentAnswer.length
            });
            return {
              answer: currentAnswer,
              reason: 'text-stable'
            };
          }

          if (newAnswerStartedAt && Date.now() - newAnswerStartedAt >= activeTimeoutMs) {
            recordDebugLog('discussion-start-gate:timeout-fallback', {
              panel: getPanelDebugInfo(panel),
              elapsedMs: Date.now() - startedAt,
              activeElapsedMs: Date.now() - newAnswerStartedAt,
              answerLength: currentAnswer.length
            });
            return {
              answer: currentAnswer,
              reason: 'timeout-fallback'
            };
          }
        }
      }

      await sleepWithAbort(DISCUSSION_START_GATE_POLL_MS, signal);
    }

    if (latestNormalized && newAnswerStarted) {
      recordDebugLog('discussion-start-gate:overall-timeout-fallback', {
        panel: getPanelDebugInfo(panel),
        elapsedMs: Date.now() - startedAt,
        activeElapsedMs: newAnswerStartedAt ? Date.now() - newAnswerStartedAt : 0,
        answerLength: latestAnswer.length
      });
      return {
        answer: latestAnswer,
        reason: 'overall-timeout-fallback'
      };
    }

    if (latestNormalized && baselineNormalized && latestNormalized === baselineNormalized) {
      recordDebugLog('discussion-start-gate:timeout-baseline-only', {
        panel: getPanelDebugInfo(panel),
        elapsedMs: Date.now() - startedAt,
        baselineLength: baselineNormalized.length
      });
      return {
        answer: '',
        reason: 'timeout-baseline-only'
      };
    }

    recordDebugLog('discussion-start-gate:empty-answer', {
      panel: getPanelDebugInfo(panel),
      elapsedMs: Date.now() - startedAt
    });
    return {
      answer: '',
      reason: 'empty-answer'
    };
  } finally {
    window.removeEventListener('message', completionHandler);
  }
}

async function waitForDiscussionMergeCompletionWithFallback(panel, signal, timeoutMs, previousAnswer = '') {
  const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : getCurrentMergeMaxWait();
  const startedAt = Date.now();
  const previousNormalized = normalizeAnswerForStability(previousAnswer);
  const baselineAnswer = await extractSinglePanelAnswer(panel) || '';
  const baselineNormalized = normalizeAnswerForStability(baselineAnswer);

  const localController = new AbortController();
  const onExternalAbort = () => localController.abort();
  signal.addEventListener('abort', onExternalAbort, { once: true });

  const completionWait = waitForDiscussionPanelsCompletionWithAbort(
    [panel],
    localController.signal,
    safeTimeoutMs,
    'discussion-wait:cancelled-after-stable-fallback'
  );
  let completionResolved = false;
  completionWait.then(() => { completionResolved = true; });

  let stableCandidate = '';
  let stableSince = 0;
  recordDebugLog('discussion-merge-wait:start', {
    panel: getPanelDebugInfo(panel),
    timeoutMs: safeTimeoutMs,
    previousAnswerLength: String(previousAnswer || '').length,
    baselineLength: baselineNormalized.length
  });

  try {
    while (!signal.aborted && !completionResolved && Date.now() - startedAt < safeTimeoutMs) {
      await sleep(2500);
      if (signal.aborted || completionResolved) break;

      const currentAnswer = await extractSinglePanelAnswer(panel) || '';
      const currentNormalized = normalizeAnswerForStability(currentAnswer);
      if (!currentNormalized ||
          currentNormalized === previousNormalized ||
          (baselineNormalized && currentNormalized === baselineNormalized)) {
        stableCandidate = '';
        stableSince = 0;
        continue;
      }

      if (currentNormalized !== stableCandidate) {
        stableCandidate = currentNormalized;
        stableSince = Date.now();
        recordDebugLog('discussion-merge-wait:answer-changed', {
          panel: getPanelDebugInfo(panel),
          answerLength: currentAnswer.length,
          baselineLength: baselineNormalized.length
        });
        continue;
      }

      if (Date.now() - stableSince >= 8000) {
        recordDebugLog('discussion-merge-wait:stable-fallback-complete', {
          panel: getPanelDebugInfo(panel),
          stableMs: Date.now() - stableSince,
          answerLength: currentAnswer.length
        });
        localController.abort();
        await completionWait;
        return;
      }
    }

    await completionWait;
    recordDebugLog('discussion-merge-wait:completion-wait-ended', {
      panel: getPanelDebugInfo(panel),
      completionResolved
    });
  } finally {
    signal.removeEventListener('abort', onExternalAbort);
  }
}

async function waitForFinalMergeAnswerBeforeExport(panel, signal, timeoutMs) {
  if (!panel || !panel.iframe || !panel.iframe.contentWindow || signal.aborted) return '';

  const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : getCurrentMergeMaxWait();
  const startedAt = Date.now();
  let completionEventSeen = false;
  let latestAnswer = '';
  let stableCandidate = '';
  let stableSince = 0;

  const completionHandler = (event) => {
    if (event?.data?.type !== 'COMPLETION_DETECTED' ||
        event?.data?.context !== 'multi-panel-completion') {
      return;
    }

    const panelId = event?.data?.panelId;
    const provider = event?.data?.provider;
    if ((panelId && panelId === panel.id) || (!panelId && provider === panel.providerId)) {
      completionEventSeen = true;
      recordDebugLog('markdown-export:final-merge-completion-event', {
        panel: getPanelDebugInfo(panel),
        provider,
        panelId
      });
    }
  };

  window.addEventListener('message', completionHandler);
  recordDebugLog('markdown-export:final-merge-wait:start', {
    panel: getPanelDebugInfo(panel),
    timeoutMs: safeTimeoutMs,
    stableMs: DISCUSSION_FINAL_EXPORT_STABLE_MS
  });

  try {
    while (!signal.aborted && Date.now() - startedAt < safeTimeoutMs) {
      await sleepWithAbort(DISCUSSION_START_GATE_POLL_MS, signal);
      if (signal.aborted) break;

      const currentAnswer = await extractSinglePanelAnswer(panel) || '';
      const currentNormalized = normalizeAnswerForStability(currentAnswer);
      if (!currentNormalized) {
        continue;
      }

      latestAnswer = currentAnswer;
      if (currentNormalized !== stableCandidate) {
        stableCandidate = currentNormalized;
        stableSince = Date.now();
        recordDebugLog('markdown-export:final-merge-wait:answer-changed', {
          panel: getPanelDebugInfo(panel),
          answerLength: currentAnswer.length
        });
        continue;
      }

      const stableMs = Date.now() - stableSince;
      if ((completionEventSeen && stableMs >= DISCUSSION_START_GATE_POLL_MS) ||
          stableMs >= DISCUSSION_FINAL_EXPORT_STABLE_MS) {
        recordDebugLog('markdown-export:final-merge-wait:complete', {
          panel: getPanelDebugInfo(panel),
          answerLength: currentAnswer.length,
          stableMs,
          completionEventSeen
        });
        return currentAnswer;
      }
    }

    recordDebugLog('markdown-export:final-merge-wait:timeout', {
      panel: getPanelDebugInfo(panel),
      answerLength: latestAnswer.length,
      timeoutMs: safeTimeoutMs,
      completionEventSeen
    });
    return latestAnswer;
  } finally {
    window.removeEventListener('message', completionHandler);
  }
}

// ===== Discussion Mode Helpers =====
async function startDiscussionAfterMerge(mergedPrompt, totalRounds, mergePanel) {
  if (totalRounds <= 0) return;
  totalRounds = DISCUSSION_ROUNDS;
  const discussionWaitMs = getCurrentMergeMaxWait();
  recordDebugLog('discussion:start', {
    totalRounds,
    discussionWaitMs,
    mergePanel: getPanelDebugInfo(mergePanel),
    mergedPromptLength: String(mergedPrompt || '').length
  });

  discussionAbortController = new AbortController();
  discussionActive = true;
  const signal = discussionAbortController.signal;
  const discussionGeneration = completionSessionGeneration;

  // 快照 providers 列表（用于导出）
  const providersSnapshot = getNonMergePanels().map(p =>
    getProviderById(p.providerId)?.name || p.providerId
  );

  showDiscussionStatusBar(totalRounds);

  try {
    // 快照融合面板当前答案作为 baseline，避免复用面板时旧答案被误判为新答案
    const baselineAnswer = await extractSinglePanelAnswer(mergePanel) || '';

    // 等待初始融合结果。优先使用明确完成事件；如果事件缺失，则用”答案文本稳定”
    // 作为兜底，避免融合答案已生成但讨论流程硬等完整超时时间。
    const initialGateResult = await waitForDiscussionStartGate(mergePanel, signal, discussionWaitMs, baselineAnswer);

    if (signal.aborted) {
      recordDebugLog('discussion:aborted-before-initial-merge-extract');
      return;
    }

    let mergedAnswer = initialGateResult.answer || '';
    if (!mergedAnswer) {
      console.warn('[Discussion] Merge answer is empty, using raw answers as fallback');
      recordDebugLog('discussion:initial-merge-answer-empty-fallback', {
        gateReason: initialGateResult.reason
      });
      const fallbackAnswers = await extractAllAnswers();
      mergedAnswer = fallbackAnswers
        .filter(a => a.answer && a.answer.trim())
        .map(a => `【${a.providerName}】\n${a.answer}`)
        .join('\n\n');
      if (!mergedAnswer) mergedAnswer = mergedPrompt;
    }

    recordDebugLog('discussion-start-gate:begin-discussion', {
      reason: initialGateResult.reason,
      answerLength: mergedAnswer.length
    });

    // 提取标题和评分后再清理；cleanAnswer 会移除末尾的模型评分和标题行。
    const extractedTitle = markdownExtractTitle(mergedAnswer);
    let discussionScores = extractScores(mergedAnswer);
    lastDiscussionTitle = extractedTitle || generateFallbackTitle();
    mergedAnswer = markdownCleanAnswer(mergedAnswer, extractedTitle);

    // 导出初始融合结果（如果启用）
    const settingsForExport = await getSettings();
    const exportModeForInit = settingsForExport.markdownExportMode || settingsForExport.obsidianExportMode || 'auto';
    if (isTrueSetting(settingsForExport.exportInitialMerge) && exportModeForInit === 'auto' && mergedAnswer) {
      try {
        const initialResult = await exportToMarkdown({
          question: lastSentQuestion || '',
          answer: mergedAnswer,
          providers: providersSnapshot,
          title: lastDiscussionTitle,
          mode: 'merge',
          scores: discussionScores
        });
        if (initialResult.success) {
          showToast(t('obsidianExportSuccess', initialResult.filePath), { type: 'success', duration: 3600 });
        }
      } catch (e) {
        console.warn('[Discussion] Initial merge export failed:', e);
      }
    }

    // 停止融合监控器，防止讨论流程的完成事件触发 handleMergeCompletionDetected → triggerMerge 无限循环
    stopMergeMonitor();

    const question = lastSentQuestion || document.getElementById('unified-input')?.value || '';

    for (let round = 1; round <= totalRounds; round++) {
      if (signal.aborted) break;

      updateDiscussionProgress(round, totalRounds);
      recordDebugLog('discussion:round-start', {
        round,
        totalRounds,
        mergedAnswerLength: mergedAnswer.length
      });

      // 清理融合答案中无意义的孤立符号行，避免发给各 AI 讨论时浪费上下文
      const cleanMergedAnswer = sanitizeMergedAnswerForDiscussion(mergedAnswer);

      // 构造讨论提示词
      const discussPrompt = buildDiscussPrompt(question, cleanMergedAnswer);
      recordDebugLog('discussion:prompt-built', {
        round,
        totalRounds,
        cleanMergedAnswerLength: cleanMergedAnswer.length,
        discussPromptLength: discussPrompt.length
      });

      // 向每个非融合面板发送 MONITOR_COMPLETION + INJECT_TEXT
      const currentNonMergePanels = getNonMergePanels();
      const discussionSendResults = [];
      for (const panel of currentNonMergePanels) {
        if (panel.iframe && panel.iframe.contentWindow) {
          const discussionSessionId = `discussion-round-${round}-${panel.id}-${Date.now()}`;
          await ensurePanelVisibleBeforeAutoSubmit(panel, true, 'discussion');
          const success = await sendToPanel(panel, discussPrompt, true, null, 0, discussionSessionId);
          discussionSendResults.push({ panel, success });
        }
      }

      const settledDiscussionSends = discussionSendResults;
      recordDebugLog('discussion:send-results', {
        round,
        results: settledDiscussionSends.map(result => ({
          panel: getPanelDebugInfo(result.panel),
          success: result.success
        }))
      });
      settledDiscussionSends
        .filter(result => !result.success)
        .forEach(result => {
          console.warn('[Discussion] Failed to send discussion prompt to panel:', result.panel?.providerId || result.panel?.id);
        });

      // 等待本轮完成（可被 abort 立即中断）
      await waitForDiscussionPanelsCompletionWithAbort(currentNonMergePanels, signal, discussionWaitMs);

      if (signal.aborted) break;

      // 收集本轮答案
      const roundAnswers = await extractAllAnswers();
      const validRoundAnswers = roundAnswers.filter(a => a.answer && a.answer.trim().length > 0);
      recordDebugLog('discussion:round-answers-extracted', {
        round,
        totalAnswers: roundAnswers.length,
        validAnswers: validRoundAnswers.length,
        providers: roundAnswers.map(a => ({
          providerName: a.providerName,
          answerLength: String(a.answer || '').length,
          hasAnswer: Boolean(a.answer && a.answer.trim())
        }))
      });

      if (validRoundAnswers.length === 0) {
        console.warn('[Discussion] No valid answers in round', round, ', stopping discussion');
        recordDebugLog('discussion:stop-no-valid-round-answers', { round });
        break;
      }

      // 融合本轮答案时，把上一版完整融合稿作为第一条材料，复核意见只提供增量。
      const previousMergeLabel = currentLocale === 'en' ? 'Previous merge result' : '上一版融合结果';
      const roundMergeAnswers = mergedAnswer && mergedAnswer.trim()
        ? [
          { providerName: previousMergeLabel, answer: mergedAnswer },
          ...validRoundAnswers
        ]
        : validRoundAnswers;
      const roundMergePrompt = buildMergePrompt(question, roundMergeAnswers);
      const mergePanelCurrent = panels.find(p => p.providerId === (selectedMergeTarget || 'deepseek') && mergePanelIds.has(p.id));

      if (mergePanelCurrent && mergePanelCurrent.iframe && mergePanelCurrent.iframe.contentWindow) {
        const previousMergedAnswer = mergedAnswer;
        const roundSessionId = `discussion-merge-${round}-${Date.now()}`;
        if (signal.aborted || discussionGeneration !== completionSessionGeneration) {
          recordDebugLog('discussion:skip-stale-merge-session', {
            round,
            discussionGeneration,
            completionSessionGeneration
          });
          break;
        }
        beginCompletionSession(roundSessionId, discussionGeneration);
        postToPanelIframe(mergePanelCurrent, {
          type: 'MONITOR_COMPLETION',
          mergeSessionId: roundSessionId,
          panelId: mergePanelCurrent.id,
          context: 'multi-panel'
        });
        postToPanelIframe(mergePanelCurrent, {
          type: 'INJECT_TEXT',
          text: roundMergePrompt,
          autoSubmit: true,
          context: 'auto-merge',
          mergeRequestId: `discussion-merge-${round}`
        });

        // 等待融合完成。若平台没有发出可靠完成事件，则用“新答案稳定”作为兜底，
        // 避免最后一轮已经完成但停止讨论按钮一直显示到超时。
        try {
          await waitForDiscussionMergeCompletionWithFallback(mergePanelCurrent, signal, discussionWaitMs, previousMergedAnswer);
        } finally {
          if (activeMergeSessionId === roundSessionId &&
              activeCompletionSessionGeneration === discussionGeneration) {
            clearActiveCompletionSession();
          }
        }

        if (signal.aborted) break;

        // 提取融合结果
        const newMergedAnswer = await extractSinglePanelAnswer(mergePanelCurrent) || '';
        if (newMergedAnswer) {
          const newExtractedTitle = markdownExtractTitle(newMergedAnswer);
          discussionScores = extractScores(newMergedAnswer) || discussionScores;
          lastDiscussionTitle = newExtractedTitle || generateFallbackTitle();
          mergedAnswer = markdownCleanAnswer(newMergedAnswer, newExtractedTitle);
          recordDebugLog('discussion:round-merge-answer-extracted', {
            round,
            mergePanel: getPanelDebugInfo(mergePanelCurrent),
            rawAnswerLength: newMergedAnswer.length,
            cleanedAnswerLength: mergedAnswer.length
          });
        }
      }
    }

    if (!signal.aborted) {
      hideDiscussionStatusBar();
      recordDebugLog('discussion:completed', {
        totalRounds,
        finalAnswerLength: mergedAnswer.length
      });
    }

    // 讨论完成，导出（如果 auto 模式）
    if (!signal.aborted) {
      const settings = await getSettings();
      const finalMergePanel = panels.find(p => p.providerId === (selectedMergeTarget || 'deepseek') && mergePanelIds.has(p.id)) || mergePanel;
      let exportAnswer = mergedAnswer || '';
      let latestVisibleAnswer = '';

      if (!exportAnswer && finalMergePanel) {
        latestVisibleAnswer = await waitForFinalMergeAnswerBeforeExport(finalMergePanel, signal, discussionWaitMs) || '';
        if (!latestVisibleAnswer && !signal.aborted) {
          latestVisibleAnswer = await extractSinglePanelAnswer(finalMergePanel) || '';
        }
        if (latestVisibleAnswer && latestVisibleAnswer.trim()) {
          const latestTitle = markdownExtractTitle(latestVisibleAnswer);
          discussionScores = extractScores(latestVisibleAnswer) || discussionScores;
          lastDiscussionTitle = latestTitle || lastDiscussionTitle || generateFallbackTitle();
          exportAnswer = markdownCleanAnswer(latestVisibleAnswer, latestTitle);
        }
        recordDebugLog('markdown-export:discussion-final-answer-resolved', {
          panel: getPanelDebugInfo(finalMergePanel),
          cachedAnswerLength: mergedAnswer.length,
          latestVisibleAnswerLength: latestVisibleAnswer.length,
          exportAnswerLength: exportAnswer.length,
          usedLatestVisibleAnswer: Boolean(latestVisibleAnswer && latestVisibleAnswer.trim())
        });
      } else if (exportAnswer) {
        recordDebugLog('markdown-export:discussion-final-answer-resolved', {
          panel: getPanelDebugInfo(finalMergePanel),
          cachedAnswerLength: mergedAnswer.length,
          latestVisibleAnswerLength: 0,
          exportAnswerLength: exportAnswer.length,
          usedLatestVisibleAnswer: false
        });
      } else {
        recordDebugLog('markdown-export:discussion-final-answer-no-panel', {
          cachedAnswerLength: mergedAnswer.length
        });
      }

      if (!exportAnswer && mergedAnswer) {
        exportAnswer = mergedAnswer;
        recordDebugLog('markdown-export:discussion-final-answer-fallback-cached', {
          cachedAnswerLength: mergedAnswer.length
        });
      }

      await saveMergeScoresIfPresent(finalMergePanel, lastSentQuestion || '', discussionScores);

      const exportMode = settings.markdownExportMode || settings.obsidianExportMode || 'auto';
      if (exportMode === 'auto' && exportAnswer) {
        setMarkdownExportFeedback(true);
        showToast(t('obsidianExporting'), { type: 'info', duration: 1800 });
        recordDebugLog('markdown-export:discussion-auto-start', {
          answerLength: exportAnswer.length,
          providers: providersSnapshot,
          title: lastDiscussionTitle
        });
        try {
          const result = await exportToMarkdown({
            question: lastSentQuestion || '',
            answer: exportAnswer,
            providers: providersSnapshot,
            title: lastDiscussionTitle,
            mode: 'discuss',
            scores: discussionScores
          });

          if (result.success) {
            recordDebugLog('markdown-export:discussion-auto-success', {
              filePath: result.filePath
            });
            showToast(t('obsidianExportSuccess', result.filePath), { type: 'success', duration: 3600 });
          } else {
            recordDebugLog('markdown-export:discussion-auto-failed', {
              error: result.error || 'Unknown error'
            });
            showToast(t('obsidianExportFailed', result.error || 'Unknown error'), { type: 'error', duration: 4200 });
          }
        } catch (e) {
          console.warn('[Discussion] Markdown export failed:', e);
          recordDebugLog('markdown-export:discussion-auto-error', {
            message: e?.message || String(e)
          });
          showToast(t('obsidianExportFailed', e?.message || 'Unknown error'), { type: 'error', duration: 4200 });
        } finally {
          setMarkdownExportFeedback(false);
        }
      }
    }
  } catch (e) {
    console.error('[AIChatMerge] Discussion error:', e);
    recordDebugLog('discussion:error', {
      message: e?.message || String(e)
    });
  } finally {
    discussionActive = false;
    discussionAbortController = null;
    hideDiscussionStatusBar();
  }
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Layout button
  document.getElementById('layout-btn').addEventListener('click', openLayoutModal);
  document.getElementById('close-layout-modal').addEventListener('click', closeLayoutModal);

  // Layout options
  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.addEventListener('click', () => setLayout(btn.dataset.layout));
  });

  // Add panel button
  document.getElementById('add-panel-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showAddPanelMenu();
  });

  // Panel grid scroll arrows
  const scrollLeftBtn = document.getElementById('scroll-left-btn');
  const scrollRightBtn = document.getElementById('scroll-right-btn');

  if (scrollLeftBtn) {
    scrollLeftBtn.addEventListener('click', () => {
      if (currentPanelPage > 0) {
        currentPanelPage--;
        renderCurrentPage();
      }
    });
  }

  if (scrollRightBtn) {
    scrollRightBtn.addEventListener('click', () => {
      const panelsPerPage = LAYOUT_PANEL_COUNTS[currentLayout] || 3;
      const totalPages = Math.max(1, Math.ceil(panels.length / panelsPerPage));
      if (currentPanelPage < totalPages - 1) {
        currentPanelPage++;
        renderCurrentPage();
      }
    });
  }


  // Markdown export button
  document.getElementById('obsidian-export-btn').addEventListener('click', handleManualExport);

  // New Chat button
  const newChatBtn = document.getElementById('new-chat-btn');
  const preserveNewChatButtonFocus = (event) => {
    event.preventDefault();
  };
  newChatBtn.addEventListener('pointerdown', preserveNewChatButtonFocus);
  newChatBtn.addEventListener('mousedown', preserveNewChatButtonFocus);
  newChatBtn.addEventListener('click', newChatAllProviders);

  // Settings button
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Toggle open mode button
  const toggleModeBtn = document.getElementById('toggle-open-mode-btn');
  if (toggleModeBtn) {
    toggleModeBtn.addEventListener('click', toggleOpenMode);
  }

  // Prompt library button
  document.getElementById('prompt-library-btn').addEventListener('click', openPromptModal);
  document.getElementById('close-prompt-modal').addEventListener('click', closePromptModal);

  // Prompt search
  const promptSearch = document.getElementById('prompt-search');
  let searchTimeout;
  promptSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.trim();
      if (query) {
        searchPromptLibrary(query);
      } else {
        renderPromptList();
      }
    }, 300);
  });

  // Prompt category filter
  const categoryFilter = document.getElementById('prompt-category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      currentCategoryFilter = e.target.value;
      renderPromptList();
    });
  }

  // Prompt filter buttons
  const favoritesBtn = document.getElementById('prompt-favorites-btn');
  if (favoritesBtn) {
    favoritesBtn.addEventListener('click', () => {
      currentPromptFilter = currentPromptFilter === 'favorites' ? 'all' : 'favorites';
      favoritesBtn.classList.toggle('active', currentPromptFilter === 'favorites');
      document.getElementById('prompt-recent-btn')?.classList.remove('active');
      renderPromptList();
    });
  }

  const recentBtn = document.getElementById('prompt-recent-btn');
  if (recentBtn) {
    recentBtn.addEventListener('click', () => {
      currentPromptFilter = currentPromptFilter === 'recent' ? 'all' : 'recent';
      recentBtn.classList.toggle('active', currentPromptFilter === 'recent');
      document.getElementById('prompt-favorites-btn')?.classList.remove('active');
      renderPromptList();
    });
  }

  // Variable modal
  document.getElementById('close-variable-modal')?.addEventListener('click', closeVariableModal);
  document.getElementById('cancel-variable-btn')?.addEventListener('click', closeVariableModal);
  document.getElementById('apply-variable-btn')?.addEventListener('click', applyVariables);

  // Variable modal outside click
  document.getElementById('variable-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'variable-modal') {
      closeVariableModal();
    }
  });

  const sendAllBtn = document.getElementById('send-all-btn');
  const preserveSendAllButtonFocus = (event) => {
    event.preventDefault();
  };

  sendAllBtn.addEventListener('pointerdown', preserveSendAllButtonFocus);
  sendAllBtn.addEventListener('mousedown', preserveSendAllButtonFocus);

  // Send All button (fill + auto-send)
  sendAllBtn.addEventListener('click', () => {
    // 如果讨论进行中，先停止
    if (discussionActive) {
      stopDiscussion();
    }
    const input = document.getElementById('unified-input');
    lastSentQuestion = input.value || '';
    // Arm monitoring before sending so a fast response cannot be mistaken for
    // a completion from the previous conversation.
    const mergeSessionId = AUTO_MERGE_ENABLED
      ? `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : null;
    if (mergeSessionId) {
      startMergeMonitor(mergeSessionId);
    } else {
      stopMergeMonitor();
    }
    sendMessageWithDefaultPrompt(input.value);
  });

  // Merge button (manual trigger)
  document.getElementById('merge-btn').addEventListener('click', () => {
    stopMergeMonitor();
    lastMergeType = 'manual';
    triggerMerge();
  });

  // Stop Discussion button
  const stopDiscussionBtn = document.getElementById('stop-discussion-btn');
  if (stopDiscussionBtn) {
    stopDiscussionBtn.addEventListener('click', stopDiscussion);
  }

  // Merge target dropdown (stopPropagation prevents document close listener from firing)
  document.getElementById('merge-target-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showMergeTargetMenu();
  });

  // Input textarea
  const inputTextarea = document.getElementById('unified-input');
  let isInputComposing = false;
  inputTextarea.addEventListener('compositionstart', () => {
    isInputComposing = true;
  });
  inputTextarea.addEventListener('compositionend', () => {
    isInputComposing = false;
  });
  // 自动调整输入框高度（用 requestAnimationFrame 合并重排，避免抖动）
  inputTextarea.addEventListener('input', () => {
    requestAnimationFrame(() => {
      inputTextarea.style.height = '0';
      inputTextarea.style.height = Math.min(inputTextarea.scrollHeight, 150) + 'px';
    });
  });
  inputTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isInputComposing || e.isComposing) {
        return;
      }
      e.preventDefault();
      lastSentQuestion = inputTextarea.value || '';
      const mergeSessionId = AUTO_MERGE_ENABLED
        ? `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : null;
      if (mergeSessionId) {
        startMergeMonitor(mergeSessionId);
      } else {
        stopMergeMonitor();
      }
      broadcastMessage(inputTextarea.value, true, mergeSessionId);
    }
  });

  // Prevent iframes from stealing focus from unified input during page load.
  // Also active during post-send and post-new-chat restore windows.
  inputTextarea.addEventListener('blur', (event) => {
    if (isPromptEditorTextControl(event.relatedTarget)) {
      return;
    }
    if (shouldPreserveUnifiedInputFocus()) {
      focusUnifiedInput();
    }
  });

  const cancelNewChatFocusRestoreOnUserIntent = (event) => {
    if (!isRestoringFocusAfterNewChat) {
      return;
    }

    if (isUnifiedInputOrNewChatControl(event.target)) {
      return;
    }

    cancelUnifiedInputFocusRestore();
  };

  document.addEventListener('pointerdown', cancelNewChatFocusRestoreOnUserIntent, true);
  document.addEventListener('mousedown', cancelNewChatFocusRestoreOnUserIntent, true);
  document.addEventListener('click', cancelNewChatFocusRestoreOnUserIntent, true);
  document.addEventListener('focusin', cancelNewChatFocusRestoreOnUserIntent, true);
  document.addEventListener('keydown', cancelNewChatFocusRestoreOnUserIntent, true);

  const cancelSendFocusRestoreOnUserIntent = (event) => {
    if (!isRestoringFocusAfterSend) {
      return;
    }

    if (isUnifiedInputOrSendControl(event.target)) {
      return;
    }

    cancelUnifiedInputFocusRestoreAfterSend();
  };

  document.addEventListener('pointerdown', cancelSendFocusRestoreOnUserIntent, true);
  document.addEventListener('mousedown', cancelSendFocusRestoreOnUserIntent, true);
  document.addEventListener('click', cancelSendFocusRestoreOnUserIntent, true);
  document.addEventListener('focusin', cancelSendFocusRestoreOnUserIntent, true);
  document.addEventListener('keydown', cancelSendFocusRestoreOnUserIntent, true);
  window.addEventListener('message', handleProviderStatusMessage);

  // Layout modal outside click
  document.getElementById('layout-modal').addEventListener('click', (e) => {
    if (e.target.id === 'layout-modal') {
      closeLayoutModal();
    }
  });

  // Prompt modal outside click
  document.getElementById('prompt-modal').addEventListener('click', (e) => {
    if (e.target.id === 'prompt-modal') {
      closePromptModal();
    }
  });

  // Prompt Editor Modal
  document.getElementById('close-prompt-editor')?.addEventListener('click', closePromptEditor);
  document.getElementById('cancel-prompt-editor')?.addEventListener('click', closePromptEditor);
  document.getElementById('save-prompt-btn')?.addEventListener('click', savePromptFromEditor);
  document.getElementById('delete-prompt-btn')?.addEventListener('click', deletePromptFromEditor);
  
  // New Prompt button
  document.getElementById('new-prompt-btn')?.addEventListener('click', () => openPromptEditor());

  // Prompt Editor Modal outside click
  document.getElementById('prompt-editor-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'prompt-editor-modal') {
      closePromptEditor();
    }
  });

  window.addEventListener('resize', () => {
    if (typeof updateScrollArrows === 'function') {
      updateScrollArrows();
    }
  });
}

// ===== Modal Functions =====
function openLayoutModal() {
  const modal = document.getElementById('layout-modal');
  modal.style.display = 'flex';

  // Mark current layout as active
  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === currentLayout);
  });
}

function closeLayoutModal() {
  document.getElementById('layout-modal').style.display = 'none';
}

function openPromptModal() {
  const modal = document.getElementById('prompt-modal');
  modal.style.display = 'flex';
  loadPromptLibrary();
}

function closePromptModal() {
  document.getElementById('prompt-modal').style.display = 'none';
  document.getElementById('prompt-search').value = '';
  // Reset filters to show all prompts on next open
  currentPromptFilter = 'all';
  currentCategoryFilter = '';
}

// ===== Provider Switcher =====
async function showProviderSwitcher(panelId) {
  const panel = panels.find(p => p.id === panelId);
  if (!panel) return;
  const palette = getDropdownThemePalette();

  // Create a simple dropdown menu
  const menu = document.createElement('div');
  menu.className = 'provider-switcher-menu';
  menu.style.cssText = `
    position: fixed;
    background: ${palette.menuBackground};
    border: 1px solid ${palette.menuBorder};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 200px;
    padding: 8px 0;
  `;

  PROVIDERS.forEach(provider => {
    const item = document.createElement('div');
    item.className = 'provider-switcher-item';
    item.dataset.providerId = provider.id;
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.padding = '10px 16px';
    item.style.cursor = 'pointer';
    item.style.fontSize = '14px';
    item.style.color = provider.id === panel.providerId ? palette.selectedText : palette.menuText;
    if (provider.id === panel.providerId) {
      item.style.background = palette.selectedBackground;
    }

    const img = document.createElement('img');
    img.src = getThemeAwareProviderIcon(provider);
    img.alt = provider.name;
    img.style.width = '20px';
    img.style.height = '20px';
    img.dataset.providerId = provider.id;

    const span = document.createElement('span');
    setBrandText(span, provider.name);

    item.appendChild(img);
    item.appendChild(span);
    menu.appendChild(item);
  });

  // Position menu near the panel
  const panelEl = document.getElementById(panelId);
  const rect = panelEl.querySelector('.switch-provider-btn').getBoundingClientRect();
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.left = rect.left + 'px';

  document.body.appendChild(menu);

  // Keep menu within viewport
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = (rect.top - menuRect.height - 4) + 'px';
  }

  // Handle item clicks
  menu.querySelectorAll('.provider-switcher-item').forEach(item => {
    item.addEventListener('click', () => {
      switchPanelProvider(panelId, item.dataset.providerId);
      menu.remove();
    });

    item.addEventListener('mouseenter', () => {
      if (item.dataset.providerId === panel.providerId) {
        item.style.background = palette.selectedBackground;
        item.style.color = palette.selectedText;
        return;
      }

      item.style.background = palette.itemHoverBackground;
      item.style.color = palette.menuText;
    });
    item.addEventListener('mouseleave', () => {
      if (item.dataset.providerId === panel.providerId) {
        item.style.background = palette.selectedBackground;
        item.style.color = palette.selectedText;
      } else {
        item.style.background = '';
        item.style.color = palette.menuText;
      }
    });
  });

  // Close on outside click
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

/**
 * Set up outside-click/pointerdown close handler for a dropdown.
 * Uses pointerdown (capture phase) instead of click to work across
 * iframe boundaries, plus window blur to handle iframe-internal clicks.
 *
 * @param {HTMLElement} dropdown - The dropdown element to close
 * @param {HTMLElement} btn - The trigger button (clicks on it toggle, not close)
 * @param {{ closeWhenIframeFocused?: boolean }} options - Per-menu iframe policy
 */
let lastInteractionTime = 0;
document.addEventListener('pointerdown', () => { lastInteractionTime = Date.now(); }, true);
document.addEventListener('click', () => { lastInteractionTime = Date.now(); }, true);

function setupDropdownCloseHandler(dropdown, btn, { closeWhenIframeFocused = false } = {}) {
  function close() {
    if (dropdown.parentNode) {
      dropdown.remove();
    }
    cleanup();
  }

  function onPointerDown(e) {
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
      close();
    }
  }

  function onPointerOver(event) {
    // Pointer events do reach the host <iframe> element when the user moves
    // into an AI panel, even though the subsequent click is isolated inside
    // the cross-origin frame.
    if (closeWhenIframeFocused && event.target instanceof HTMLIFrameElement) {
      close();
    }
  }

  function onBlur(event) {
    // A click inside an AI panel iframe does not bubble to this document. It
    // moves focus from the host window to the iframe instead, so close this
    // particular menu after focus has settled. This is intentionally opt-in:
    // other dropdowns retain their existing focus behavior.
    if (closeWhenIframeFocused) {
      setTimeout(() => {
        if (document.activeElement?.tagName === 'IFRAME') {
          close();
        }
      }, 0);
      return;
    }

    // Ignore blur if no recent user interaction (iframe auto-focus during page load)
    if (Date.now() - lastInteractionTime > 200) return;
    const related = event.relatedTarget;
    if (related && (btn.contains(related) || dropdown.contains(related))) {
      return;
    }
    close();
  }

  function cleanup() {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerover', onPointerOver, true);
    window.removeEventListener('blur', onBlur);
  }

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerover', onPointerOver, true);
  window.addEventListener('blur', onBlur);

  return cleanup;
}

let mergeTargetCleanup = null;

function showMergeTargetMenu() {
  const btn = document.getElementById('merge-target-btn');
  const existing = document.querySelector('.merge-target-dropdown');
  if (existing) {
    if (mergeTargetCleanup) { mergeTargetCleanup(); mergeTargetCleanup = null; }
    existing.remove();
    return;
  }

  const MERGE_TARGETS = [
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'gemini', name: 'Gemini' },
    { id: 'kimi', name: 'Kimi' },
    { id: 'qianwen', name: '千问' },
    { id: 'zhipu', name: '智谱清言' },
    { id: 'wenxin', name: '文心一言' },
    { id: 'doubao', name: '豆包' },
    { id: 'metaso', name: '秘塔AI' },
    { id: 'claude', name: 'Claude' },
    { id: 'grok', name: 'Grok' }
  ];

  const dropdown = document.createElement('div');
  dropdown.className = 'merge-target-dropdown';

  MERGE_TARGETS.forEach(target => {
    const item = document.createElement('button');
    item.className = 'merge-target-item' + (target.id === selectedMergeTarget ? ' selected' : '');
    item.textContent = target.name;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedMergeTarget = target.id;
      document.getElementById('merge-target-label').textContent = target.name;
      if (mergeTargetCleanup) { mergeTargetCleanup(); mergeTargetCleanup = null; }
      dropdown.remove();
    });
    item.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    dropdown.appendChild(item);
  });

  btn.style.position = 'relative';
  btn.appendChild(dropdown);

  mergeTargetCleanup = setupDropdownCloseHandler(dropdown, btn);
}

let addPanelCleanup = null;

function showAddPanelMenu() {
  // 移除已有的下拉菜单
  const existing = document.querySelector('.add-panel-menu');
  if (existing) {
    if (addPanelCleanup) { addPanelCleanup(); addPanelCleanup = null; }
    existing.remove();
    return;
  }

  // 统计已添加的提供商（排除融合面板）
  const addedProviders = getNonMergePanels().map(p => p.providerId);

  const dropdown = document.createElement('div');
  dropdown.className = 'add-panel-menu';

  PROVIDERS.forEach(provider => {
    const isAdded = addedProviders.includes(provider.id);
    const item = document.createElement('button');
    item.className = 'add-panel-item' + (isAdded ? ' is-added' : '');

    const providerData = getProviderById(provider.id);
    const iconSrc = getThemeAwareProviderIcon(providerData);

    const iconWrap = document.createElement('div');
    iconWrap.className = 'add-panel-item-icon-wrap';
    const iconImg = document.createElement('img');
    iconImg.src = iconSrc;
    iconImg.alt = provider.name;
    const statusSpan = document.createElement('span');
    statusSpan.className = 'add-panel-item-status';
    statusSpan.textContent = isAdded ? '✓' : '+';
    iconWrap.appendChild(iconImg);
    iconWrap.appendChild(statusSpan);
    item.appendChild(iconWrap);

    const nameSpan = document.createElement('span');
    setBrandText(nameSpan, provider.name);
    item.appendChild(nameSpan);

    item.addEventListener('click', async () => {
      if (addPanelCleanup) { addPanelCleanup(); addPanelCleanup = null; }
      dropdown.remove();
      await addPanel(provider.id);
    });

    dropdown.appendChild(item);
  });

  // 定位到添加按钮上方
  const btn = document.getElementById('add-panel-btn');
  if (btn) {
    btn.style.position = 'relative';
    btn.appendChild(dropdown);
  }

  // 点击外部关闭
  addPanelCleanup = setupDropdownCloseHandler(dropdown, btn, { closeWhenIframeFocused: true });
}

// ===== Utility Functions =====
function showToast(message, options = {}) {
  const { duration = 2600, type = 'default', actions = [] } = options;
  const toast = document.createElement('div');
  const backgroundByType = {
    default: '#333',
    success: '#2563eb',
    error: '#dc2626',
    info: '#374151',
    warning: '#f59e0b'
  };
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: ${backgroundByType[type] || backgroundByType.default};
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  if (actions.length > 0) {
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.style.cssText = `
        background: rgba(255,255,255,0.2);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 4px;
        padding: 4px 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
      `;
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.35)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.2)'; });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toast.remove();
        if (typeof action.onClick === 'function') action.onClick();
      });
      toast.appendChild(btn);
    });
  }

  document.body.appendChild(toast);

  if (actions.length === 0) {
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

function setMarkdownExportFeedback(isExporting) {
  const exportBtn = document.getElementById('obsidian-export-btn');
  const statusEl = document.getElementById('send-status');

  if (exportBtn) {
    exportBtn.disabled = Boolean(isExporting);
    exportBtn.classList.toggle('is-busy', Boolean(isExporting));
    exportBtn.setAttribute('aria-busy', isExporting ? 'true' : 'false');
  }

  if (statusEl) {
    statusEl.textContent = isExporting ? t('obsidianExporting') : '';
    statusEl.className = isExporting ? 'send-status partial' : 'send-status';
  }
}

function buildScoreSignature(question, scores) {
  const scoreText = (scores || [])
    .map(score => `${score.model}:${score.score}`)
    .join('|');
  return `${String(question || '').trim()}::${scoreText}`;
}

async function saveMergeScoresIfPresent(panel, question, scores) {
  if (!scores || scores.length === 0) return null;

  const signature = buildScoreSignature(question, scores);
  if (panel && panel.lastSavedScoreSignature === signature) {
    return null;
  }

  const saved = await saveScoreHistory(question, scores);
  if (saved && panel) {
    panel.lastSavedScoreSignature = signature;
  }
  return saved;
}

// ===== Markdown Export =====
async function handleManualExport() {
  const mergePanel = panels.find(p => mergePanelIds.has(p.id));
  if (!mergePanel) {
    recordDebugLog('markdown-export:manual-no-merge-panel');
    showToast(t('obsidianExportFailed', '请先进行融合操作'));
    return;
  }

  const answer = await extractSinglePanelAnswer(mergePanel);
  if (!answer) {
    recordDebugLog('markdown-export:manual-no-answer', {
      panel: getPanelDebugInfo(mergePanel)
    });
    showToast(t('obsidianExportFailed', 'No answer found'));
    return;
  }

  const exportData = mergePanel.exportData || {};
  setMarkdownExportFeedback(true);
  showToast(t('obsidianExporting'), { type: 'info', duration: 1800 });
  recordDebugLog('markdown-export:manual-start', {
    panel: getPanelDebugInfo(mergePanel),
    answerLength: answer.length,
    providers: exportData.providers || [],
    mode: exportData.mode || 'merge'
  });

  try {
    const scores = extractScores(answer);
    await saveMergeScoresIfPresent(mergePanel, exportData.question || '', scores);
    const result = await exportToMarkdown({
      question: exportData.question || '',
      answer: answer,
      providers: exportData.providers || [],
      mode: exportData.mode || 'merge',
      scores
    });

    if (result.success) {
      recordDebugLog('markdown-export:manual-success', {
        filePath: result.filePath
      });
      showToast(t('obsidianExportSuccess', result.filePath), { type: 'success', duration: 3600 });
    } else {
      recordDebugLog('markdown-export:manual-failed', {
        error: result.error || 'Unknown error'
      });
      showToast(t('obsidianExportFailed', result.error || 'Unknown error'), { type: 'error', duration: 4200 });
    }
  } catch (error) {
    console.warn('[Markdown] Manual export failed:', error);
    recordDebugLog('markdown-export:manual-error', {
      message: error?.message || String(error)
    });
    showToast(t('obsidianExportFailed', error?.message || 'Unknown error'), { type: 'error', duration: 4200 });
  } finally {
    setMarkdownExportFeedback(false);
  }
}

async function autoExportToMarkdown(mergePanel) {
  const settings = await getSettings();
  const exportMode = settings.markdownExportMode || settings.obsidianExportMode || 'auto';
  if (exportMode !== 'auto') return;

  if (autoExportWaitController) {
    autoExportWaitController.abort();
  }
  const exportWaitController = new AbortController();
  autoExportWaitController = exportWaitController;
  const exportRunId = ++autoExportRunId;

  const exportData = mergePanel.exportData || {};
  recordDebugLog('markdown-export:auto-wait-final-answer', {
    panel: getPanelDebugInfo(mergePanel),
    providers: exportData.providers || [],
    mode: exportData.mode || 'merge',
    exportRunId
  });

  const answer = await waitForFinalMergeAnswerBeforeExport(
    mergePanel,
    exportWaitController.signal,
    getCurrentMergeMaxWait()
  );

  if (exportWaitController.signal.aborted || exportRunId !== autoExportRunId) {
    recordDebugLog('markdown-export:auto-cancelled-stale-run', {
      panel: getPanelDebugInfo(mergePanel),
      exportRunId,
      currentExportRunId: autoExportRunId
    });
    return;
  }

  if (!answer) {
    recordDebugLog('markdown-export:auto-no-answer', {
      panel: getPanelDebugInfo(mergePanel),
      exportRunId
    });
    if (autoExportWaitController === exportWaitController) {
      autoExportWaitController = null;
    }
    stopMergeMonitor();
    return;
  }

  setMarkdownExportFeedback(true);
  showToast(t('obsidianExporting'), { type: 'info', duration: 1800 });
  recordDebugLog('markdown-export:auto-start', {
    panel: getPanelDebugInfo(mergePanel),
    answerLength: answer.length,
    providers: exportData.providers || [],
    mode: exportData.mode || 'merge',
    exportRunId
  });

  try {
    if (exportRunId !== autoExportRunId) {
      recordDebugLog('markdown-export:auto-skip-stale-before-write', {
        panel: getPanelDebugInfo(mergePanel),
        exportRunId,
        currentExportRunId: autoExportRunId
      });
      return;
    }

    if (autoExportWriteInProgress) {
      recordDebugLog('markdown-export:auto-skip-write-in-progress', {
        panel: getPanelDebugInfo(mergePanel),
        exportRunId
      });
      return;
    }

    autoExportWriteInProgress = true;
    const scores = extractScores(answer);
    await saveMergeScoresIfPresent(mergePanel, exportData.question || '', scores);
    const result = await exportToMarkdown({
      question: exportData.question || '',
      answer: answer,
      providers: exportData.providers || [],
      mode: exportData.mode || 'merge',
      scores
    });

    if (result.success) {
      recordDebugLog('markdown-export:auto-success', {
        filePath: result.filePath
      });
      showToast(t('obsidianExportSuccess', result.filePath), { type: 'success', duration: 3600 });
    } else {
      recordDebugLog('markdown-export:auto-failed', {
        error: result.error || 'Unknown error'
      });
      showToast(t('obsidianExportFailed', result.error || 'Unknown error'), { type: 'error', duration: 4200 });
    }
  } catch (error) {
    console.warn('[Markdown] Auto export failed:', error);
    recordDebugLog('markdown-export:auto-error', {
      message: error?.message || String(error)
    });
    showToast(t('obsidianExportFailed', error?.message || 'Unknown error'), { type: 'error', duration: 4200 });
  } finally {
    autoExportWriteInProgress = false;
    if (autoExportWaitController === exportWaitController) {
      autoExportWaitController = null;
    }
    if (exportRunId === autoExportRunId) {
      stopMergeMonitor();
    }
    setMarkdownExportFeedback(false);
  }
}

// ===== Prompt Editor Functions =====

// 打开提示词编辑器（新增或编辑）
function openPromptEditor(promptId = null) {
  currentEditingPromptId = promptId;
  const modal = document.getElementById('prompt-editor-modal');
  const title = document.getElementById('prompt-editor-title');
  const deleteBtn = document.getElementById('delete-prompt-btn');

  if (promptId) {
    // 编辑模式
    title.textContent = t('editPrompt');
    deleteBtn.style.display = 'block';
    // 加载现有提示词数据
    loadPromptForEditing(promptId);
  } else {
    // 新增模式
    title.textContent = t('newPromptTitle');
    deleteBtn.style.display = 'none';
    clearPromptEditor();
  }

  modal.style.display = 'flex';
}

// 加载提示词数据到编辑器
async function loadPromptForEditing(promptId) {
  try {
    const prompt = await getPrompt(promptId);
    if (prompt) {
      document.getElementById('prompt-title-input').value = prompt.title || '';
      document.getElementById('prompt-content-input').value = prompt.content || '';
      document.getElementById('prompt-category-input').value = prompt.category || '';
      document.getElementById('prompt-tags-input').value = prompt.tags ? prompt.tags.join(', ') : '';
      const defaultCheckbox = document.getElementById('prompt-default-checkbox');
      if (defaultCheckbox) defaultCheckbox.checked = prompt.isDefault === true;
    }
  } catch (error) {
    console.error('Error loading prompt for editing:', error);
    showToast(t('promptLoadFailed'));
  }
}

// 清空编辑器
function clearPromptEditor() {
  document.getElementById('prompt-title-input').value = '';
  document.getElementById('prompt-content-input').value = '';
  document.getElementById('prompt-category-input').value = '';
  document.getElementById('prompt-tags-input').value = '';
  const defaultCheckbox = document.getElementById('prompt-default-checkbox');
  if (defaultCheckbox) defaultCheckbox.checked = false;
}

// 关闭编辑器
function closePromptEditor() {
  document.getElementById('prompt-editor-modal').style.display = 'none';
  currentEditingPromptId = null;
}

// 保存提示词
async function savePromptFromEditor() {
  const title = document.getElementById('prompt-title-input').value.trim();
  const content = document.getElementById('prompt-content-input').value.trim();
  const category = document.getElementById('prompt-category-input').value.trim();
  const tagsStr = document.getElementById('prompt-tags-input').value.trim();
  const makeDefault = document.getElementById('prompt-default-checkbox')?.checked === true;

  if (!title || !content) {
    alert(t('titleContentRequired'));
    return;
  }

  const tags = tagsStr ? tagsStr.split(',').map(tag => tag.trim()).filter(Boolean) : [];

  // 获取现有提示词的收藏状态
  const existingPrompt = currentEditingPromptId ? await getPrompt(currentEditingPromptId) : null;

  const promptData = {
    title,
    content,
    category,
    tags,
    isFavorite: existingPrompt?.isFavorite || false, // 保留现有收藏状态
    isDefault: makeDefault
  };

  try {
    let savedPrompt = null;
    if (currentEditingPromptId) {
      savedPrompt = await updatePrompt(currentEditingPromptId, promptData);
      if (makeDefault) {
        await setDefaultPrompt(currentEditingPromptId);
      } else if (existingPrompt?.isDefault) {
        await clearDefaultPrompt();
      }
      showToast(t('promptUpdated'));
    } else {
      savedPrompt = await savePrompt(promptData);
      if (makeDefault && savedPrompt?.id) {
        await setDefaultPrompt(savedPrompt.id);
      }
      showToast(t('promptSaved'));
    }

    closePromptEditor();
    await renderPromptList();
    await updateDefaultPromptBar();
  } catch (error) {
    console.error('Error saving prompt:', error);
    showToast(t('promptSaveFailed'));
  }
}

// 删除提示词
async function deletePromptFromEditor() {
  if (!currentEditingPromptId) return;

  if (confirm(t('confirmDeletePrompt'))) {
    try {
      await deletePrompt(currentEditingPromptId);
      showToast(t('promptDeleted'));
      closePromptEditor();
      await renderPromptList();
      await updateDefaultPromptBar();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      showToast(t('promptDeleteFailed'));
    }
  }
}

// Initialize on load
init();

