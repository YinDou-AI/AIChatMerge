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
import { saveSetting } from '../modules/settings.js';
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
  getPrompt
} from '../modules/prompt-manager.js';


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
    uploadImage: '上传图片',
    sendToAllAI: '发送给所有AI',
    mergeTooltip: '融合总结：收集所有回答并发送给目标 AI 对比',
    mergeTargetAI: '融合目标 AI',
    copyAllAnswers: '复制所有回答',
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
    selectImageFile: '请选择图片文件',
    imageSizeLimit: '图片大小不能超过20MB',
    maxImagesReached: '最多允许上传 $1 张图片',
    addImageFailed: '添加图片失败',
    clearedAllInputs: '已清空所有输入',
    noAnswersFound: '未找到回答，请确认AI已回复',
    copiedAnswers: '已复制 $1 个回答到剪贴板',
    copiedAnswersPartial: '已复制 $1/$2 个回答（$3 个不完整，请重新打开面板后重试）',
    copiedAnswersPartialShort: '已复制 $1/$2 个回答',
    newChatCreated: '已为所有AI创建新对话',
    tempChatDisabled: '临时对话已关闭',
    tempChatEnabled: '已在支持的平台启用临时对话',
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
    // Status messages
    sending: '发送中...',
    filling: '填入中...',
    sentToAI: '已发送到 $1 个AI',
    filledToInput: '已填入 $1 个输入',
    sentToPartial: '已发送到 $1/$2',
    filledPartial: '已填入 $1/$2',
    sendFailed: '发送失败',
    fillFailed: '填入失败',
    errorOccurred: '发生错误',
    inputOrUploadImage: '请输入消息或上传图片',
    addedBadge: '已添加',
    varInputPlaceholder: '输入 $1 的值',
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
    uploadImage: 'Upload Image',
    sendToAllAI: 'Send to all AIs',
    mergeTooltip: 'Merge: collect all answers and send to target AI for comparison',
    mergeTargetAI: 'Merge Target AI',
    copyAllAnswers: 'Copy All Answers',
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
    selectImageFile: 'Please select an image file',
    imageSizeLimit: 'Image size cannot exceed 20MB',
    maxImagesReached: 'Maximum $1 images allowed',
    addImageFailed: 'Failed to add image',
    clearedAllInputs: 'All inputs cleared',
    noAnswersFound: 'No answers found, please confirm AIs have replied',
    copiedAnswers: 'Copied $1 answers to clipboard',
    copiedAnswersPartial: 'Copied $1/$2 answers ($3 incomplete, please reopen panels and retry)',
    copiedAnswersPartialShort: 'Copied $1/$2 answers',
    newChatCreated: 'New chat created for all AIs',
    tempChatDisabled: 'Temporary chat disabled',
    tempChatEnabled: 'Temporary chat enabled on supported platforms',
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
    // Status messages
    sending: 'Sending...',
    filling: 'Filling...',
    sentToAI: 'Sent to $1 AIs',
    filledToInput: 'Filled $1 inputs',
    sentToPartial: 'Sent to $1/$2',
    filledPartial: 'Filled $1/$2',
    sendFailed: 'Send failed',
    fillFailed: 'Fill failed',
    errorOccurred: 'An error occurred',
    inputOrUploadImage: 'Please enter a message or upload an image',
    addedBadge: 'Added',
    varInputPlaceholder: 'Enter value for $1',
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
}

// ===== State Management =====
let currentLayout = '1x3';
let panels = []; // Array of { id, providerId, iframe, state }
let currentPanelPage = 0; // 当前页码，从0开始
let uploadedImages = []; // Array of uploaded images { id, name, type, dataUrl }
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
let tempChatRetryTimerIds = new Map();
let tempChatCleanupTimerId = null;
let tempChatPendingPanelIds = new Set();
let tempChatButtonRestoreTimerId = null;
let isTemporaryChatModeEnabled = false;
let answerExtractionRequestId = 0;
let pendingAnswerExtractions = new Map();

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

// Default panel configuration
const DEFAULT_PROVIDERS = DEFAULT_PROVIDER_IDS;
const PENDING_MULTI_PANEL_ACTION_KEY = 'pendingMultiPanelAction';
const SEND_FOCUS_RESTORE_DELAYS = [0, 80, 200, 400, 800, 1500, 2500, 4000, 6000, 8000, 10000, 12000];
const SEND_FOCUS_NO_BUSY_TIMEOUT_MS = 2000;
const SEND_FOCUS_HARD_TIMEOUT_MS = 90000;
const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = 'multi-panel-provider-status';
const PANELIZE_PROVIDER_BUSY = 'PANELIZE_PROVIDER_BUSY';
const PANELIZE_PROVIDER_IDLE = 'PANELIZE_PROVIDER_IDLE';
const PANELIZE_PROVIDER_USER_INTERACTION = 'PANELIZE_PROVIDER_USER_INTERACTION';
const PANELIZE_TEMP_CHAT_ENABLED = 'PANELIZE_TEMP_CHAT_ENABLED';
const TEMP_CHAT_RETRY_DELAYS = [1200, 2500, 4000];
const TEMP_CHAT_OPERATION_TIMEOUT_MS = 5000;
const TEMP_CHAT_SUPPORTED_PROVIDERS = new Set(['chatgpt', 'gemini', 'claude', 'grok']);
const TEMP_CHAT_RETRY_PROVIDERS = new Set(['gemini', 'grok']);
const TEMP_CHAT_URLS = {
  chatgpt: 'https://chatgpt.com/?temporary-chat=true',
  claude: 'https://claude.ai/new?incognito',
  grok: 'https://grok.com/c#private'
};
const TEMP_CHAT_NORMAL_URLS = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/new',
  gemini: 'https://gemini.google.com/',
  grok: 'https://grok.com/'
};
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
  document.addEventListener('panelize:themechange', refreshThemeAwareProviderIcons);
  await applyTheme();

  // Initialize i18n
  const { localeMode = 'auto' } = await chrome.storage.local.get('localeMode');
  if (localeMode === 'auto') {
    currentLocale = detectLocale();
  } else {
    currentLocale = localeMode;
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
  updateTemporaryChatButtonState();
  focusUnifiedInput({ force: true });

  isInitialized = true;
  await handlePendingMultiPanelAction();
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

function isTemporaryChatSupportedProvider(providerId) {
  return TEMP_CHAT_SUPPORTED_PROVIDERS.has(providerId);
}

function requiresTemporaryChatActivationRetry(providerId) {
  return TEMP_CHAT_RETRY_PROVIDERS.has(providerId);
}

function isUrlDrivenTemporaryChatProvider(providerId) {
  return Object.prototype.hasOwnProperty.call(TEMP_CHAT_URLS, providerId);
}

function getTemporaryChatUrl(providerId) {
  return TEMP_CHAT_URLS[providerId] || null;
}

function getTemporaryChatNormalUrl(providerId) {
  if (Object.prototype.hasOwnProperty.call(TEMP_CHAT_NORMAL_URLS, providerId)) {
    return TEMP_CHAT_NORMAL_URLS[providerId];
  }

  const provider = getProviderById(providerId);
  if (!provider) {
    return '';
  }

  return isGoogleProvider(providerId)
    ? getGoogleProviderUrl(currentGoogleProviderMode)
    : provider.url;
}

function getPanelProviderMode(panel) {
  return isGoogleProvider(panel.providerId) ? currentGoogleProviderMode : null;
}

function postNewChatToPanel(panel) {
  if (!panel || !panel.iframe || !panel.iframe.contentWindow) {
    return;
  }

  panel.iframe.contentWindow.postMessage({
    type: 'NEW_CHAT',
    providerMode: getPanelProviderMode(panel),
    context: 'multi-panel'
  }, '*');
}

function getProviderFrameUrl(providerId) {
  const provider = getProviderById(providerId);
  if (!provider) {
    return '';
  }

  if (isTemporaryChatModeEnabled && isUrlDrivenTemporaryChatProvider(providerId)) {
    return getTemporaryChatUrl(providerId);
  }

  return isGoogleProvider(providerId)
    ? getGoogleProviderUrl(currentGoogleProviderMode)
    : provider.url;
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
    <button class="copy-link-btn" title="${t('copyLink')}">
      <span class="material-symbols-outlined">content_copy</span>
    </button>
    <button class="refresh-panel-btn" title="${t('refresh')}">
      <span class="material-symbols-outlined">refresh</span>
    </button>
    <button class="home-btn" title="${t('home')}">
      <span class="material-symbols-outlined">home</span>
    </button>
    <button class="maximize-btn" title="${t('maximize')}">
      <span class="material-symbols-outlined">open_in_full</span>
    </button>
    <button class="switch-provider-btn" title="${t('switchProvider')}">
      <span class="material-symbols-outlined">swap_horiz</span>
    </button>
    <button class="close-panel-btn" title="${t('close')}">
      <span class="material-symbols-outlined">close</span>
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
  loadingEl.innerHTML = `<img src="${getThemeAwareProviderIcon(provider)}" alt="${provider.name}" class="loading-icon" data-provider-id="${provider.id}"><span class="loading-text">${t('loadingProvider', provider.name)}</span>`;
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

function bindPanelHeaderActions(panelId) {
  const panel = panels.find(p => p.id === panelId);
  const panelEl = document.getElementById(panelId);
  if (!panel || !panelEl) {
    return;
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
        icon.textContent = 'check';
        setTimeout(() => { icon.textContent = 'content_copy'; }, 1500);
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
      icon.textContent = isMaximized ? 'close_fullscreen' : 'open_in_full';
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

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' && areaName !== 'local') {
      return;
    }

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

function setTemporaryChatButtonDisabled(disabled) {
  // temporary chat button removed
}

function updateTemporaryChatButtonState() {
  // temporary chat button removed
}

function setTemporaryChatModeEnabled(enabled) {
  isTemporaryChatModeEnabled = Boolean(enabled);
  updateTemporaryChatButtonState();
}

function clearTemporaryChatButtonRestoreTimer() {
  if (typeof tempChatButtonRestoreTimerId === 'number') {
    clearTimeout(tempChatButtonRestoreTimerId);
  }
  tempChatButtonRestoreTimerId = null;
}

function scheduleTemporaryChatButtonRestore(delay = 1000) {
  clearTemporaryChatButtonRestoreTimer();
  tempChatButtonRestoreTimerId = setTimeout(() => {
    tempChatButtonRestoreTimerId = null;
    setTemporaryChatButtonDisabled(false);
  }, delay);
}

function clearTemporaryChatRetriesForPanel(panelId) {
  const timerIds = tempChatRetryTimerIds.get(panelId) || [];
  timerIds.forEach(timerId => clearTimeout(timerId));
  tempChatRetryTimerIds.delete(panelId);
}

function cancelTemporaryChatActivation({ restoreButton = true } = {}) {
  tempChatRetryTimerIds.forEach((timerIds) => {
    timerIds.forEach(timerId => clearTimeout(timerId));
  });
  tempChatRetryTimerIds.clear();
  tempChatPendingPanelIds.clear();
  clearTemporaryChatButtonRestoreTimer();

  if (typeof tempChatCleanupTimerId === 'number') {
    clearTimeout(tempChatCleanupTimerId);
  }
  tempChatCleanupTimerId = null;

  if (restoreButton) {
    setTemporaryChatButtonDisabled(false);
  }
}

function startTemporaryChatActivationForPanel(panel) {
  if (!panel || !requiresTemporaryChatActivationRetry(panel.providerId) || !panel.iframe || !panel.iframe.contentWindow) {
    return;
  }

  clearTemporaryChatRetriesForPanel(panel.id);
  tempChatPendingPanelIds.add(panel.id);
  TEMP_CHAT_RETRY_DELAYS.forEach(delay => scheduleTemporaryChatRetry(panel, delay));
}

function startTemporaryChatActivationCycle() {
  cancelTemporaryChatActivation({ restoreButton: false });
  setTemporaryChatButtonDisabled(true);
  scheduleTemporaryChatButtonRestore();
  tempChatCleanupTimerId = setTimeout(() => {
    cancelTemporaryChatActivation();
  }, TEMP_CHAT_OPERATION_TIMEOUT_MS);
}

function startFreshChatForPanel(panel, options = {}) {
  const preferInPageNewChat = options.preferInPageNewChat === true;

  if (!panel) {
    return;
  }

  if (!isTemporaryChatModeEnabled) {
    postNewChatToPanel(panel);
    return;
  }

  if (requiresTemporaryChatActivationRetry(panel.providerId) && !isUrlDrivenTemporaryChatProvider(panel.providerId)) {
    postNewChatToPanel(panel);
    startTemporaryChatActivationForPanel(panel);
    return;
  }

  if (panel.providerId === 'grok' && preferInPageNewChat) {
    postNewChatToPanel(panel);
    startTemporaryChatActivationForPanel(panel);
    return;
  }

  if (isUrlDrivenTemporaryChatProvider(panel.providerId)) {
    reloadPanelIframe(panel, getTemporaryChatUrl(panel.providerId));
    return;
  }

  postNewChatToPanel(panel);
}

function isUnifiedInputOrNewChatControl(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('#unified-input, #new-chat-btn'));
}

function isUnifiedInputOrSendControl(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest('#unified-input, #send-all-btn'));
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

  // Handle answer extraction responses
  if (data.type === 'EXTRACTED_ANSWER' && data.context === 'multi-panel-answer') {
    handleExtractedAnswer(data);
    return;
  }

  // Handle completion detection from iframe MutationObserver
  if (data.type === 'COMPLETION_DETECTED' && data.context === 'multi-panel-completion') {
    handleMergeCompletionDetected(data);
    return;
  }

  // Handle extraction debug results
  if (data.type === 'EXTRACT_DEBUG_RESULT' && data.context === 'multi-panel-debug') {
    console.log('[ExtractDebug]', data.provider, JSON.stringify(data.debug, null, 2));
    return;
  }

  const isTempChatMessage = data.type === PANELIZE_TEMP_CHAT_ENABLED;
  if (data.context !== MULTI_PANEL_PROVIDER_STATUS_CONTEXT || (!data.requestId && !isTempChatMessage)) {
    return;
  }

  const panel = panels.find(candidate => candidate.iframe?.contentWindow === event.source);
  if (!panel || data.provider !== panel.providerId) {
    return;
  }

  switch (data.type) {
    case PANELIZE_PROVIDER_BUSY:
      if (!isChatgptProvider(panel.providerId)) {
        return;
      }
      handleSendFocusProviderBusy(panel, data.requestId);
      break;
    case PANELIZE_PROVIDER_IDLE:
      if (!isChatgptProvider(panel.providerId)) {
        return;
      }
      handleSendFocusProviderIdle(panel, data.requestId);
      break;
    case PANELIZE_PROVIDER_USER_INTERACTION:
      if (data.requestId === activeSendFocusRequestId) {
        cancelUnifiedInputFocusRestoreAfterSend();
      }
      break;
    case PANELIZE_TEMP_CHAT_ENABLED:
      if (!tempChatPendingPanelIds.has(panel.id)) {
        return;
      }
      clearTemporaryChatRetriesForPanel(panel.id);
      tempChatPendingPanelIds.delete(panel.id);
      break;
    default:
      break;
  }
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
      multiPanelProviders: DEFAULT_PROVIDERS,
      openMode: 'tab',
      googleProviderMode: DEFAULT_GOOGLE_PROVIDER_MODE,
      currentPanelPage: 0
    });

    currentLayout = normalizeLayout(settings.multiPanelLayout);
    currentOpenMode = settings.openMode || 'tab';
    currentGoogleProviderMode = normalizeGoogleProviderMode(settings.googleProviderMode);
    currentPanelPage = settings.currentPanelPage || 0;

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
  const text = btn.querySelector('.btn-text');

  if (isPopupWindow) {
    if (icon) icon.textContent = 'tab';
    if (text) text.textContent = t('switchToTabMode');
    btn.title = t('switchToTabModeTitle');
  } else {
    if (icon) icon.textContent = 'open_in_new';
    if (text) text.textContent = t('switchToPopupMode');
    btn.title = t('switchToPopupModeTitle');
  }
}

function collectCurrentState() {
  const state = {
    inputText: document.getElementById('unified-input')?.value || '',
    uploadedImages: [...uploadedImages],
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
  const multiPanelUrl = chrome.runtime.getURL('multi-panel/multi-panel.html');

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
        // Trigger resize to adjust textarea height
        resizeTextarea();
      }

      // 恢复图片
      if (state.uploadedImages && state.uploadedImages.length > 0) {
        uploadedImages = state.uploadedImages;
        renderImagePreviews();
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
      multiPanelProviders: DEFAULT_PROVIDERS
    });

    const providerIds = settings.multiPanelProviders || DEFAULT_PROVIDERS;

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
    for (const providerId of DEFAULT_PROVIDERS) {
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

  // Create panel element
  const panelEl = document.createElement('div');
  panelEl.className = 'panel-item';
  panelEl.id = panelId;
  panelEl.innerHTML = `
    <div class="panel-header">
      <div class="panel-header-left">
        <img src="${getThemeAwareProviderIcon(provider)}" alt="${provider.name}" class="provider-icon" data-provider-id="${provider.id}">
        <span>${provider.name}</span>
      </div>
      <div class="panel-header-right">${getPanelHeaderRightHtml(providerId)}</div>
    </div>
    <div class="panel-iframe-container">
      <div class="panel-loading">
        <img src="${getThemeAwareProviderIcon(provider)}" alt="${provider.name}" class="loading-icon" data-provider-id="${provider.id}">
        <span class="loading-text">${t('loadingProvider', provider.name)}</span>
      </div>
      <iframe
        src="${getProviderFrameUrl(providerId)}"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="clipboard-read; clipboard-write"
      ></iframe>
    </div>
  `;

  panelGrid.appendChild(panelEl);

  // Get iframe reference
  const iframe = panelEl.querySelector('iframe');
  const loadingEl = panelEl.querySelector('.panel-loading');

  // Handle iframe load
  // Grace period after load to catch AI pages that auto-focus after JS init
  const LOAD_GRACE_PERIOD = 3000;
  loadingPanelIds.add(panelId);
  iframe.addEventListener('load', () => {
    loadingEl.classList.add('hidden');
    const panel = panels.find(p => p.id === panelId);
    if (isTemporaryChatModeEnabled && panel && requiresTemporaryChatActivationRetry(panel.providerId)) {
      startTemporaryChatActivationForPanel(panel);
    }
    setTimeout(() => {
      loadingPanelIds.delete(panelId);
    }, LOAD_GRACE_PERIOD);
  });

  iframe.addEventListener('error', () => {
    loadingEl.innerHTML = `<img src="${getThemeAwareProviderIcon(provider)}" alt="${provider.name}" class="loading-icon" data-provider-id="${provider.id}"><span class="loading-text">${t('providerLoadFailed', provider.name)}</span>`;
    loadingPanelIds.delete(panelId);
  });

  // Add to panels array
  panels.push({
    id: panelId,
    providerId,
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

  // Remove from DOM
  const panelEl = document.getElementById(panelId);
  if (panelEl) {
    panelEl.remove();
  }

  // Remove from arrays and sets
  panels.splice(panelIndex, 1);
  loadingPanelIds.delete(panelId);
  mergePanelIds.delete(panelId);

  // Save configuration
  saveProviderConfiguration();

  renderCurrentPage();
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
  headerName.textContent = provider.name;
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
async function broadcastMessage(text, autoSubmit = true) {
  const sendBtn = document.getElementById('send-all-btn');
  const statusEl = document.getElementById('send-status');

  const hasImages = uploadedImages.length > 0;

  if (!text.trim() && !hasImages) {
    // If input is empty and autoSubmit is true, just trigger send buttons
    // (this happens when user clicks Fill first, then Send All)
    if (autoSubmit) {
      await triggerSendButtons();
      return;
    }
    showToast(t('inputOrUploadImage'));
    return;
  }

  // When images are present, always fill first without auto-submit
  // User needs to click "Send All" again to actually send
  // This gives users a chance to verify content before sending
  const shouldAutoSubmit = hasImages ? false : autoSubmit;
  const sendFocusRequestId = shouldAutoSubmit
    ? restoreUnifiedInputFocusAfterSend(getChatgptPanelsWithFrames())
    : null;

  try {
    // Disable buttons during send
    sendBtn.disabled = true;
    statusEl.textContent = shouldAutoSubmit ? t('sending') : t('filling');
    statusEl.className = 'send-status';

    // Prepare images payload
    const imagesPayload = uploadedImages.map(img => ({
      dataUrl: img.dataUrl,
      name: img.name,
      type: img.type
    }));

    // Send to all panels (skip merge panels)
    const targetPanels = getNonMergePanels();
    const panelResults = await Promise.allSettled(
      targetPanels.map(panel => sendToPanel(panel, text, imagesPayload, shouldAutoSubmit, sendFocusRequestId))
    );

    // Count results (panels only)
    const panelSuccessful = panelResults.filter(r => r.status === 'fulfilled' && r.value).length;
    const totalSuccessful = panelSuccessful;
    const totalCount = targetPanels.length;
    const failed = totalCount - totalSuccessful;

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
      document.getElementById('unified-input').value = '';
      resizeTextarea();

      // Clear images after successful fill/send
      if (uploadedImages.length > 0) {
        clearAllImages();
      }
    }
  } catch (error) {
    console.error('Error in broadcastMessage:', error);
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

async function sendToPanel(panel, text, images = [], autoSubmit = true, requestId = null) {
  return new Promise((resolve) => {
    try {
      if (!panel.iframe || !panel.iframe.contentWindow) {
        resolve(false);
        return;
      }

      // Determine message type based on whether images are included
      const messageType = images.length > 0 ? 'INJECT_TEXT_WITH_IMAGES' : 'INJECT_TEXT';

      // Send message to content script inside iframe with autoSubmit flag
      // Add context identifier so receivers can validate origin
      panel.iframe.contentWindow.postMessage({
        type: messageType,
        text: text,
        images: images,
        autoSubmit: autoSubmit,
        requestId: requestId,
        providerMode: getPanelProviderMode(panel),
        context: 'multi-panel'  // Identify this is from multi-panel
      }, '*');

      // Assume success (we can't easily verify)
      resolve(true);
    } catch (error) {
      console.error(`Error sending to ${panel.providerId}:`, error);
      resolve(false);
    }
  });
}

// Clear all input boxes (unified input + all panels)
async function clearAllInputs() {
  // Clear unified input
  document.getElementById('unified-input').value = '';
  resizeTextarea();

  // Clear uploaded images
  clearAllImages();

  // Send clear message to all panels (skip merge panels)
  getNonMergePanels().forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      panel.iframe.contentWindow.postMessage({
        type: 'CLEAR_INPUT',
        clearImages: true,
        providerMode: getPanelProviderMode(panel),
        context: 'multi-panel'
      }, '*');
    }
  });
  showToast(t('clearedAllInputs'));
}

// ===== Image Management =====
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB per image
const MAX_IMAGE_COUNT = 10;

async function addImage(file) {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast(t('selectImageFile'));
      return false;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      showToast(t('imageSizeLimit'));
      return false;
    }

    // Validate image count
    if (uploadedImages.length >= MAX_IMAGE_COUNT) {
      showToast(t('maxImagesReached', MAX_IMAGE_COUNT));
      return false;
    }

    // Convert to base64
    const dataUrl = await fileToDataUrl(file);

    // Add to uploadedImages array with string ID
    const imageId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    uploadedImages.push({
      id: imageId,
      name: file.name,
      type: file.type,
      dataUrl: dataUrl
    });

    // Render preview
    renderImagePreviews();
    return true;
  } catch (error) {
    console.error('Error adding image:', error);
    showToast(t('addImageFailed'));
    return false;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function removeImage(imageId) {
  uploadedImages = uploadedImages.filter(img => img.id !== imageId);
  renderImagePreviews();
}

function clearAllImages() {
  uploadedImages = [];
  renderImagePreviews();
}

function renderImagePreviews() {
  const container = document.getElementById('image-preview-container');

  if (uploadedImages.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = uploadedImages.map(img => `
    <div class="image-preview-item" data-image-id="${img.id}">
      <img src="${img.dataUrl}" alt="${img.name}">
      <button class="remove-image" onclick="window.removeImageById('${img.id}')" title="${t('close')}">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
  `).join('');
}

// Expose removeImage to window for onclick handler
window.removeImageById = (imageId) => {
  removeImage(imageId);
};

// Create new chat for all panels
async function newChatAllProviders() {
  const newChatBtn = document.getElementById('new-chat-btn');

  // Disable button during operation
  newChatBtn.disabled = true;

  if (isTemporaryChatModeEnabled) {
    startTemporaryChatActivationCycle();
  }

  getNonMergePanels().forEach(panel => {
    startFreshChatForPanel(panel, { preferInPageNewChat: true });
  });

  restoreUnifiedInputFocusAfterNewChat();
  showToast(t('newChatCreated'));

  // Re-enable button
  setTimeout(() => {
    newChatBtn.disabled = false;
  }, 1000);
}

function scheduleTemporaryChatRetry(panel, delay) {
  const timerId = setTimeout(() => {
    if (!tempChatPendingPanelIds.has(panel.id) || !panel.iframe || !panel.iframe.contentWindow) {
      return;
    }

    focusUnifiedInput({ force: true });
    panel.iframe.contentWindow.postMessage({
      type: 'ENABLE_TEMP_CHAT',
      providerMode: getPanelProviderMode(panel),
      context: 'multi-panel'
    }, '*');
  }, delay);

  const timerIds = tempChatRetryTimerIds.get(panel.id) || [];
  timerIds.push(timerId);
  tempChatRetryTimerIds.set(panel.id, timerIds);
}

async function temporaryChatAllProviders() {
  if (isTemporaryChatModeEnabled) {
    cancelTemporaryChatActivation({ restoreButton: false });
    setTemporaryChatModeEnabled(false);
    setTemporaryChatButtonDisabled(true);

    panels.forEach(panel => {
      if (isTemporaryChatSupportedProvider(panel.providerId)) {
        reloadPanelIframe(panel, getTemporaryChatNormalUrl(panel.providerId));
        return;
      }

      postNewChatToPanel(panel);
    });

    restoreUnifiedInputFocusAfterNewChat();
    showToast(t('tempChatDisabled'));

    scheduleTemporaryChatButtonRestore();
    return;
  }

  setTemporaryChatModeEnabled(true);
  startTemporaryChatActivationCycle();

  panels.forEach(panel => {
    startFreshChatForPanel(panel);
  });

  restoreUnifiedInputFocusAfterNewChat();

  showToast(t('tempChatEnabled'));
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
        panel.iframe.contentWindow.postMessage({
          type: 'TRIGGER_SEND',
          requestId: sendFocusRequestId,
          providerMode: getPanelProviderMode(panel),
          context: 'multi-panel'
        }, '*');
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
  // 非当前页用 opacity:0 + position:absolute 而非 display:none，确保 iframe 继续加载
  panels.forEach((panel, index) => {
    const panelEl = document.getElementById(panel.id);
    if (panelEl) {
      if (index >= startIndex && index < endIndex) {
        panelEl.style.visibility = '';
        panelEl.style.position = '';
        panelEl.style.width = '';
        panelEl.style.height = '';
        panelEl.style.overflow = '';
        panelEl.style.opacity = '';
        panelEl.style.pointerEvents = '';
        panelEl.style.left = '';
        panelEl.style.top = '';
      } else {
        panelEl.style.position = 'absolute';
        panelEl.style.visibility = 'hidden';
        panelEl.style.opacity = '0';
        panelEl.style.pointerEvents = 'none';
        panelEl.style.left = '-9999px';
        panelEl.style.top = '0';
        panelEl.style.width = '100%';
        panelEl.style.height = '100%';
        panelEl.style.overflow = 'hidden';
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

    categorySelect.innerHTML = `<option value="">${t('allCategories')}</option>` +
      categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

async function renderPromptList(searchQuery = '') {
  const promptList = document.getElementById('prompt-list-modal');

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
      promptList.innerHTML = `
        <div class="prompt-empty">
          <span class="material-symbols-outlined">auto_awesome</span>
          <p>${searchQuery ? t('noMatchingPrompts') : t('noPrompts')}</p>
        </div>
      `;
      return;
    }

    promptList.innerHTML = prompts.slice(0, 30).map(prompt => `
      <div class="prompt-item-modal" data-id="${prompt.id}">
        ${prompt.isFavorite ? '<div class="prompt-item-favorite"><span class="material-symbols-outlined filled">star</span></div>' : ''}
        <div class="prompt-item-modal-title">${escapeHtml(prompt.title)}</div>
        <div class="prompt-item-modal-preview">${escapeHtml(prompt.content.substring(0, 150))}${prompt.content.length > 150 ? '...' : ''}</div>
        <div class="prompt-item-meta-row">
          ${prompt.category ? `<span class="prompt-item-category">${escapeHtml(prompt.category)}</span>` : ''}
          ${prompt.variables && prompt.variables.length > 0 ? `
            <div class="prompt-item-variables">
              ${prompt.variables.slice(0, 3).map(v => `<span class="prompt-variable-tag">{${escapeHtml(v)}}</span>`).join('')}
              ${prompt.variables.length > 3 ? `<span class="prompt-variable-tag">+${prompt.variables.length - 3}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

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
    promptList.innerHTML = `<div class="prompt-empty">${t('failedToLoadPrompts')}</div>`;
  }
}

async function selectPrompt(prompt) {
  // Record usage
  try {
    await recordPromptUsage(prompt.id);
  } catch (error) {
    console.error('Error recording prompt usage:', error);
  }

  // Check if prompt has variables
  if (prompt.variables && prompt.variables.length > 0) {
    selectedPromptForVariables = prompt;
    showVariableModal(prompt);
  } else {
    applyPromptToInput(prompt.content);
    closePromptModal();
  }
}

function showVariableModal(prompt) {
  const modal = document.getElementById('variable-modal');
  const inputsContainer = document.getElementById('variable-inputs');

  inputsContainer.innerHTML = prompt.variables.map(variable => `
    <div class="variable-input-group">
      <label for="var-${escapeHtml(variable)}">${escapeHtml(variable)}</label>
      <input type="text" id="var-${escapeHtml(variable)}" data-variable="${escapeHtml(variable)}" placeholder="${t('varInputPlaceholder', escapeHtml(variable))}">
    </div>
  `).join('');

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
  resizeTextarea();
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
      panel.iframe.contentWindow.postMessage({
        type: 'SET_EXTRACT_MODE',
        enabled
      }, '*');
    }
  });
}

async function extractAllAnswers() {
  const requestId = ++answerExtractionRequestId;

  // 开启提取模式：让所有面板（包括隐藏页的）都能提取到答案
  setExtractMode(true);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const entry = pendingAnswerExtractions.get(requestId);
      if (entry) {
        const responded = entry.respondedPanels ? entry.respondedPanels.size : 0;
        console.log('[CopyAll] Timeout. Responded:', responded, '/', getNonMergePanels().length, 'Answers:', entry.answers.length);
        resolve(entry.answers);
      } else {
        resolve([]);
      }
      pendingAnswerExtractions.delete(requestId);
      setExtractMode(false);
    }, 25000);

    const answers = [];
    pendingAnswerExtractions.set(requestId, {
      resolve,
      timer: timeout,
      answers
    });

    const targetPanels = getNonMergePanels();
    let sentCount = 0;
    targetPanels.forEach(panel => {
      if (panel.iframe && panel.iframe.contentWindow) {
        console.log('[CopyAll] Sending EXTRACT_ANSWER to panel:', panel.id, 'provider:', panel.providerId);
        panel.iframe.contentWindow.postMessage({
          type: 'EXTRACT_ANSWER',
          requestId,
          panelId: panel.id,
          context: 'multi-panel'
        }, '*');
        sentCount++;
      }
    });
    console.log('[CopyAll] Sent extraction request to', sentCount, 'of', targetPanels.length, 'panels');

    if (sentCount === 0) {
      clearTimeout(timeout);
      pendingAnswerExtractions.delete(requestId);
      setExtractMode(false);
      resolve([]);
      return;
    }

    // 3秒后对未响应的面板重试一次（iframe content script 可能还没加载完）
    setTimeout(() => {
      const entry = pendingAnswerExtractions.get(requestId);
      if (!entry) return; // 已完成或超时
      const responded = entry.respondedPanels || new Set();
      const missing = targetPanels.filter(p => !responded.has(p.id));
      if (missing.length > 0) {
        console.log('[CopyAll] Retrying', missing.length, 'panels that did not respond');
        missing.forEach(panel => {
          if (panel.iframe && panel.iframe.contentWindow) {
            panel.iframe.contentWindow.postMessage({
              type: 'EXTRACT_ANSWER',
              requestId,
              panelId: panel.id,
              context: 'multi-panel'
            }, '*');
          }
        });
      }
    }, 3000);
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
  console.log('[CopyAll] Received answer from panel:', data.panelId, 'provider:', data.provider, 'answer length:', data.answer ? data.answer.length : 0, 'hasAnswer:', hasAnswer);

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
    clearTimeout(entry.timer);
    console.log('[CopyAll] All panels responded. Valid answers:', entry.answers.length, 'of', nonMergeCount);
    entry.resolve(entry.answers);
    pendingAnswerExtractions.delete(data.requestId);
    setExtractMode(false);
  }
}

async function copyAllAnswers() {
  const answers = await extractAllAnswers();
  const validAnswers = answers.filter(a => a.answer && a.answer.trim().length > 0);
  if (validAnswers.length === 0) {
    showToast(t('noAnswersFound'));
    return;
  }

  const text = validAnswers.map(a =>
    `=== ${a.providerName} ===\n${a.answer}`
  ).join('\n---\n');

  try {
    await navigator.clipboard.writeText(text);
    const missing = answers.length - validAnswers.length;
    const msg = missing > 0
      ? t('copiedAnswersPartial', validAnswers.length, answers.length, missing)
      : t('copiedAnswers', validAnswers.length);
    showToast(msg);
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    const missing = answers.length - validAnswers.length;
    const msg = missing > 0
      ? t('copiedAnswersPartialShort', validAnswers.length, answers.length)
      : t('copiedAnswers', validAnswers.length);
    showToast(msg);
  }
}

// Debug extraction - call debugExtraction() from console
window.debugExtraction = function() {
  console.log('[ExtractDebug] Total panels:', panels.length);
  panels.forEach(panel => {
    const hasIframe = !!panel.iframe;
    const hasContentWindow = hasIframe && !!panel.iframe.contentWindow;
    console.log('[ExtractDebug] Panel:', panel.id, 'provider:', panel.providerId, 'iframe:', hasIframe, 'contentWindow:', hasContentWindow);
    if (hasIframe && hasContentWindow) {
      panel.iframe.contentWindow.postMessage({
        type: 'EXTRACT_DEBUG',
        panelId: panel.id,
        context: 'multi-panel'
      }, '*');
    }
  });
};

// ===== Auto Merge / Fusion =====

const MERGE_TARGET_URLS = {
  deepseek: 'https://chat.deepseek.com/',
  kimi: 'https://kimi.com/',
  qianwen: 'https://www.qianwen.com/',
  zhipu: 'https://chatglm.cn/',
  wenxin: 'https://yiyan.baidu.com/',
  doubao: 'https://www.doubao.com/chat/',
  metaso: 'https://metaso.cn/'
};

const MERGE_MAX_WAIT = 120000;      // 最长2分钟

let mergeCompletedPanels = new Set();
let mergeTimeoutTimer = null;
let mergeStartDelayTimer = null;
let mergeIsActive = false;
let lastSentQuestion = '';

function startMergeMonitor() {
  stopMergeMonitor();
  mergeIsActive = true;
  mergeCompletedPanels = new Set();
  const mergeBtn = document.getElementById('merge-btn');
  if (mergeBtn) mergeBtn.classList.add('active');

  console.log('[Merge] Monitoring started, waiting 3s before starting detection...');

  // 开启提取模式，让隐藏页的停止按钮也能被检测到
  setExtractMode(true);

  // 延迟 3 秒再开始监控（内容脚本有快速检测：如果 AI 已完成会立即报告）
  mergeStartDelayTimer = setTimeout(() => {
    if (!mergeIsActive) return;
    const nonMergePanels = getNonMergePanels();
    console.log('[Merge] Sending MONITOR_COMPLETION to', nonMergePanels.length, 'panels (excluded merge panels)');
    nonMergePanels.forEach(panel => {
      if (panel.iframe && panel.iframe.contentWindow) {
        panel.iframe.contentWindow.postMessage({
          type: 'MONITOR_COMPLETION',
          context: 'multi-panel'
        }, '*');
      }
    });
  }, 3000);

  // Safety net: force merge after max wait (从 Send All 开始计时)
  mergeTimeoutTimer = setTimeout(() => {
    if (!mergeIsActive) return;
    console.log('[Merge] Timeout, triggering merge');
    showToast(t('waitTimeout'));
    stopMergeMonitor();
    triggerMerge();
  }, MERGE_MAX_WAIT);
}

function handleMergeCompletionDetected(data) {
  console.log('[Merge] COMPLETION_DETECTED received:', data.provider, 'active:', mergeIsActive);
  if (!mergeIsActive || data.context !== 'multi-panel-completion') return;

  const panel = panels.find(p => p.providerId === data.provider && !isMergePanel(p));
  if (!panel) {
    console.warn('[Merge] No panel found for provider:', data.provider);
    return;
  }

  if (mergeCompletedPanels.has(panel.id)) return;

  mergeCompletedPanels.add(panel.id);
  const nonMergeCount = getNonMergePanels().length;
  console.log('[Merge] Panel completed:', panel.id, 'provider:', data.provider, '(', mergeCompletedPanels.size, '/', nonMergeCount, ')');

  if (mergeCompletedPanels.size >= nonMergeCount) {
    console.log('[Merge] All panels completed, triggering merge');
    showToast(t('allAIAnswered'));
    stopMergeMonitor();
    triggerMerge();
  }
}

function stopMergeMonitor() {
  mergeIsActive = false;
  mergeCompletedPanels.clear();
  setExtractMode(false);

  if (mergeStartDelayTimer) {
    clearTimeout(mergeStartDelayTimer);
    mergeStartDelayTimer = null;
  }

  if (mergeTimeoutTimer) {
    clearTimeout(mergeTimeoutTimer);
    mergeTimeoutTimer = null;
  }

  // Tell non-merge panels to stop monitoring
  getNonMergePanels().forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      panel.iframe.contentWindow.postMessage({
        type: 'STOP_MONITORING',
        context: 'multi-panel'
      }, '*');
    }
  });

  const mergeBtn = document.getElementById('merge-btn');
  if (mergeBtn) mergeBtn.classList.remove('active');
}

function buildMergePrompt(question, answers) {
  const parts = answers.map(a => `【${a.providerName}】\n${a.answer}`);
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  return `今天是${today}，你是一名专业的AI回答评审员。
【原始问题】
${question}
【各AI回答】
${parts.join('\n')}
请对比以上多个AI模型的回答，执行以下任务：
1. 根据今天日期，搜索最新信息，去除过时或错误的信息
2. 将相似观点归类合并，只总结推荐排名前50%的方案，至少保留3个最佳选择
3. 按以下格式输出：
【观点名称】
- 支持模型：[列出模型名称]
- 依据：[简述理由]
...（逐个观点列出）
【最终建议】
综合以上分析，给出推荐方案及理由。`;
}

async function triggerMerge() {
  console.log('[Merge] Triggering merge...');
  const answers = await extractAllAnswers();
  const validAnswers = answers.filter(a => a.answer && a.answer.trim().length > 0);

  if (validAnswers.length === 0) {
    console.log('[Merge] No answers found');
    return;
  }

  const question = lastSentQuestion || document.getElementById('unified-input')?.value || '';
  const prompt = buildMergePrompt(question, validAnswers);
  const targetProvider = document.getElementById('merge-target-select')?.value || 'deepseek';

  console.log('[Merge] Target:', targetProvider, 'Answers:', validAnswers.length);

  // 查找已有的融合面板（providerId 匹配 + 在 mergePanelIds 中）
  const existingPanel = panels.find(p => p.providerId === targetProvider && mergePanelIds.has(p.id));

  if (existingPanel) {
    // 导航到融合面板所在的页面
    const panelIndex = panels.indexOf(existingPanel);
    const panelsPerPage = LAYOUT_PANEL_COUNTS[currentLayout] || 3;
    const targetPage = Math.floor(panelIndex / panelsPerPage);
    if (currentPanelPage !== targetPage) {
      currentPanelPage = targetPage;
      renderCurrentPage();
    }

    // 复用已有面板：直接注入提示词
    console.log('[Merge] Reusing existing merge panel:', existingPanel.id, 'provider:', existingPanel.providerId);
    console.log('[Merge] iframe exists:', !!existingPanel.iframe, 'contentWindow exists:', !!existingPanel.iframe?.contentWindow);
    console.log('[Merge] Prompt length:', prompt.length, 'first 100 chars:', prompt.substring(0, 100));

    // Diagnostic: listen for response from content script
    const mergeRequestId = `merge-reuse-${Date.now()}`;
    let gotResponse = false;
    const diagHandler = (event) => {
      if (event?.data?.type === 'INJECT_TEXT_RECEIVED' && event?.data?.mergeRequestId === mergeRequestId) {
        gotResponse = true;
        window.removeEventListener('message', diagHandler);
        console.log('[Merge] Content script confirmed receipt. Input found:', event.data.inputFound, 'injectSuccess:', event.data.injectSuccess, 'provider:', event.data.provider);
      }
    };
    window.addEventListener('message', diagHandler);

    existingPanel.iframe.contentWindow.postMessage({
      type: 'INJECT_TEXT',
      text: prompt,
      autoSubmit: true,
      context: 'auto-merge',
      mergeRequestId
    }, '*');
    console.log('[Merge] postMessage sent to iframe, requestId:', mergeRequestId);

    // Timeout check: if no response in 3s, log warning
    setTimeout(() => {
      if (!gotResponse) {
        window.removeEventListener('message', diagHandler);
        console.warn('[Merge] No response from content script after 3s! iframe may not have received the message.');
        console.warn('[Merge] iframe.readyState may be:', existingPanel.iframe?.readyState);
        console.warn('[Merge] iframe src:', existingPanel.iframe?.src);
      }
    }, 3000);

    existingPanel.iframe.closest('.panel-item')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    return;
  }

  // 没有已有面板，创建新的
  // 检查是否超过最大面板数
  const provider = getProviderById(targetProvider);
  if (!provider) {
    console.error('[Merge] Provider not found:', targetProvider);
    return;
  }

  const panelId = `panel-merge-${Date.now()}`;
  const panelGrid = document.getElementById('panel-grid');

  // 创建面板元素
  const panelEl = document.createElement('div');
  panelEl.className = 'panel-item';
  panelEl.id = panelId;
  panelEl.innerHTML = `
    <div class="panel-header">
      <div class="panel-header-left">
        <img src="${getThemeAwareProviderIcon(provider)}" alt="${provider.name}" class="provider-icon" data-provider-id="${provider.id}">
        <span>${provider.name} (${t('merge')})</span>
      </div>
      <div class="panel-header-right">${getPanelHeaderRightHtml(targetProvider)}</div>
    </div>
    <div class="panel-iframe-container">
      <div class="panel-loading">
        <img src="${getThemeAwareProviderIcon(provider)}" alt="${provider.name}" class="loading-icon" data-provider-id="${provider.id}">
        <span class="loading-text">${t('loadingProvider', provider.name)}</span>
      </div>
      <iframe
        src="${getProviderFrameUrl(targetProvider)}"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="clipboard-read; clipboard-write"
      ></iframe>
    </div>
  `;

  // 插入到最左边（prepend）
  panelGrid.insertBefore(panelEl, panelGrid.firstChild);
  panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  mergePanelIds.add(panelId);
  console.log('[Merge] Panel created at leftmost position:', panelId);

  const iframe = panelEl.querySelector('iframe');
  const loadingEl = panelEl.querySelector('.panel-loading');

  // 添加到 panels 数组最前面
  panels.unshift({
    id: panelId,
    providerId: targetProvider,
    iframe,
    state: 'loading'
  });

  bindPanelHeaderActions(panelId);
  await saveProviderConfiguration();

  // 跳转到第一页显示融合面板
  currentPanelPage = 0;
  renderCurrentPage();

  // 等 iframe 加载完成后注入提示词
  iframe.addEventListener('load', () => {
    loadingEl.classList.add('hidden');
    console.log('[Merge] Panel loaded, injecting prompt in 2s...');
    setTimeout(() => {
      iframe.contentWindow.postMessage({
        type: 'INJECT_TEXT',
        text: prompt,
        autoSubmit: true,
        context: 'auto-merge'
      }, '*');
      console.log('[Merge] Prompt injected into panel', panelId);
    }, 2000);
  });
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
  document.getElementById('add-panel-btn').addEventListener('click', showAddPanelMenu);

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

  // Copy All Answers button
  document.getElementById('copy-all-btn').addEventListener('click', copyAllAnswers);

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

  // Image upload button
  const imageUploadBtn = document.getElementById('image-upload-btn');
  const imageFileInput = document.getElementById('image-file-input');
  const inputWrapper = document.querySelector('.input-wrapper');

  imageUploadBtn.addEventListener('click', () => {
    imageFileInput.click();
  });

  imageFileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      await addImage(file);
    }
    // Clear input to allow re-uploading the same file
    e.target.value = '';
  });

  // Drag and drop support
  inputWrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    inputWrapper.classList.add('drag-over');
  });

  inputWrapper.addEventListener('dragleave', (e) => {
    e.preventDefault();
    inputWrapper.classList.remove('drag-over');
  });

  inputWrapper.addEventListener('drop', async (e) => {
    e.preventDefault();
    inputWrapper.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    for (const file of files) {
      await addImage(file);
    }
  });

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
    const input = document.getElementById('unified-input');
    lastSentQuestion = input.value || '';
    broadcastMessage(input.value, true);
    // Start merge monitoring after sending
    startMergeMonitor();
  });

  // Merge button (manual trigger)
  document.getElementById('merge-btn').addEventListener('click', () => {
    stopMergeMonitor();
    triggerMerge();
  });

  // Input textarea
  const inputTextarea = document.getElementById('unified-input');
  let isInputComposing = false;
  inputTextarea.addEventListener('input', resizeTextarea);
  inputTextarea.addEventListener('compositionstart', () => {
    isInputComposing = true;
  });
  inputTextarea.addEventListener('compositionend', () => {
    isInputComposing = false;
  });
  inputTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isInputComposing || e.isComposing) {
        return;
      }
      e.preventDefault();
      lastSentQuestion = inputTextarea.value || '';
      broadcastMessage(inputTextarea.value, true);
      startMergeMonitor();
    }
  });

  // Paste image support (must be after inputTextarea is defined)
  inputTextarea.addEventListener('paste', async (e) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await addImage(file);
        }
      }
    }
  });

  // Prevent iframes from stealing focus from unified input during page load.
  // Also active during post-send and post-new-chat restore windows.
  inputTextarea.addEventListener('blur', () => {
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

function resizeTextarea() {
  const textarea = document.getElementById('unified-input');
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
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
    min-width: 160px;
    padding: 8px 0;
  `;

  menu.innerHTML = PROVIDERS.map(provider => `
    <div class="provider-switcher-item" data-provider-id="${provider.id}" style="
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
      color: ${provider.id === panel.providerId ? palette.selectedText : palette.menuText};
      ${provider.id === panel.providerId ? `background: ${palette.selectedBackground};` : ''}
    ">
      <img src="${getThemeAwareProviderIcon(provider)}" alt="${provider.name}" style="width: 20px; height: 20px;" data-provider-id="${provider.id}">
      <span>${provider.name}</span>
    </div>
  `).join('');

  // Position menu near the panel
  const panelEl = document.getElementById(panelId);
  const rect = panelEl.querySelector('.switch-provider-btn').getBoundingClientRect();
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.left = rect.left + 'px';

  document.body.appendChild(menu);

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

function showAddPanelMenu() {
  // 移除已有的下拉菜单
  const existing = document.querySelector('.add-panel-menu');
  if (existing) { existing.remove(); return; }

  // 统计已添加的提供商
  const addedProviders = panels.map(p => p.providerId);

  const dropdown = document.createElement('div');
  dropdown.className = 'add-panel-menu';

  PROVIDERS.forEach(provider => {
    const isAdded = addedProviders.includes(provider.id);
    const item = document.createElement('button');
    item.className = 'add-panel-item';

    const providerData = getProviderById(provider.id);
    const iconSrc = getThemeAwareProviderIcon(providerData);

    item.innerHTML = `
      <img src="${iconSrc}" alt="${provider.name}">
      <span>${provider.name}</span>
      ${isAdded ? `<span class="added-badge">${t('addedBadge')}</span>` : ''}
    `;

    item.addEventListener('click', async () => {
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
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 0);
}

// ===== Utility Functions =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: rgba(255,255,255,0.7);
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
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

  if (!title || !content) {
    alert(t('titleContentRequired'));
    return;
  }

  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  const promptData = { title, content, category, tags };

  try {
    if (currentEditingPromptId) {
      await updatePrompt(currentEditingPromptId, promptData);
      showToast(t('promptUpdated'));
    } else {
      await savePrompt(promptData);
      showToast(t('promptSaved'));
    }

    closePromptEditor();
    await renderPromptList();
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
    } catch (error) {
      console.error('Error deleting prompt:', error);
      showToast(t('promptDeleteFailed'));
    }
  }
}

// Initialize on load
init();
