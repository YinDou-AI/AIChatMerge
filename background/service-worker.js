import { notifyMessage } from '../modules/messaging.js';
import { t, initializeLanguage } from '../modules/i18n.js';

// Install event - setup context menus
const DEFAULT_SHORTCUT_SETTING = { keyboardShortcutEnabled: true };
const DEFAULT_OPEN_MODE = { openMode: 'tab' };
let keyboardShortcutEnabled = true;
let openMode = 'tab';
const PENDING_MULTI_PANEL_ACTION_KEY = 'pendingMultiPanelAction';
const PAGE_EXTRACTOR_SCRIPTS = [
  'libs/Readability.js',
  'content-scripts/page-content-extractor.js'
];

async function loadShortcutSetting() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SHORTCUT_SETTING);
    keyboardShortcutEnabled = result.keyboardShortcutEnabled;
  } catch (error) {
    // Fallback to default if storage unavailable
    keyboardShortcutEnabled = true;
  }
}

async function loadOpenModeSetting() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_OPEN_MODE);
    openMode = result.openMode || 'tab';
  } catch (error) {
    // Fallback to default if storage unavailable
    openMode = 'tab';
  }
}

async function setPendingMultiPanelAction(action, payload = {}) {
  const pendingAction = {
    action,
    payload,
    createdAt: Date.now()
  };

  try {
    await chrome.storage.session.set({ [PENDING_MULTI_PANEL_ACTION_KEY]: pendingAction });
    return;
  } catch (error) {
    // Fallback to local storage if session storage is unavailable
  }

  try {
    await chrome.storage.local.set({ [PENDING_MULTI_PANEL_ACTION_KEY]: pendingAction });
  } catch (error) {
    // Ignore storage errors
  }
}

// 新增：打开 Multi-Panel 的函数（支持标签页和弹出窗口两种模式）
async function openMultiPanel() {
  const multiPanelUrl = chrome.runtime.getURL('multi-panel/multi-panel.html');

  if (openMode === 'popup') {
    // 弹出窗口模式：查找现有窗口或创建新窗口
    const windows = await chrome.windows.getAll({ populate: true });
    for (const win of windows) {
      for (const tab of win.tabs || []) {
        if (tab.url === multiPanelUrl) {
          // 已有窗口，聚焦它
          await chrome.windows.update(win.id, { focused: true });
          return;
        }
      }
    }

    // 创建新弹出窗口
    await chrome.windows.create({
      url: multiPanelUrl,
      type: 'popup',
      width: 1400,
      height: 900
    });
  } else {
    // 标签页模式：始终创建新标签页
    await chrome.tabs.create({
      url: multiPanelUrl,
      active: true
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await createContextMenus();
  await loadShortcutSetting();
  await loadOpenModeSetting();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadShortcutSetting();
  await loadOpenModeSetting();
});

// Create/update context menus
async function createContextMenus() {
  // Remove all existing menus
  await chrome.contextMenus.removeAll();

  // Initialize language before creating menus
  await initializeLanguage();

  // Create main context menu item
  chrome.contextMenus.create({
    id: 'open-smarter-panel',
    title: t('contextMenuSendTo'),
    contexts: ['page', 'selection', 'link']
  });
}

// Listen for settings changes and update context menus
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.language) {
    createContextMenus();
  }

  // 新增：监听 openMode 变化
  if (namespace === 'sync' && changes.openMode) {
    openMode = changes.openMode.newValue || 'tab';
  }
});

async function formatSelectedTextWithSource(info) {
  const settings = await chrome.storage.sync.get({ sourceUrlPlacement: 'none' });
  const placement = settings.sourceUrlPlacement;

  if (placement === 'none') {
    return info.selectionText;
  }
  if (placement === 'beginning') {
    return `Source: ${info.pageUrl}\n\n${info.selectionText}`;
  }
  return `${info.selectionText}\n\nSource: ${info.pageUrl}`;
}

async function getContentFromContext(info, tab) {
  if (info.selectionText) {
    return formatSelectedTextWithSource(info);
  }

  try {
    await ensurePageExtractorInjected(tab);

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractPageContent'
    });

    if (response && response.success) {
      return response.content;
    }
  } catch (error) {
    // Content script not ready or extraction failed
  }

  return '';
}

function canInjectIntoTab(tab) {
  if (!tab || tab.id === undefined || tab.id === null || !tab.url) {
    return false;
  }
  return tab.url.startsWith('http://') || tab.url.startsWith('https://');
}

async function ensurePageExtractorInjected(tab) {
  if (!canInjectIntoTab(tab)) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: false },
    files: PAGE_EXTRACTOR_SCRIPTS
  });
}

function dispatchToMultiPanel(action, payload) {
  setTimeout(() => {
    setPendingMultiPanelAction(action, payload);
    notifyMessage({
      action,
      payload
    }).catch(() => {
      // Multi-Panel may not be ready yet, silently ignore
    });
  }, 500);
}

// Context menu click handler - opens Multi-Panel and sends message
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (!tab) {
      return;
    }

    // 先打开 Multi-Panel 窗口
    await openMultiPanel();

    if (info.menuItemId === 'open-smarter-panel') {
      const contentToSend = await getContentFromContext(info, tab);
      dispatchToMultiPanel('sendToPanel', { selectedText: contentToSend });
    }
  } catch (error) {
    // Silently handle context menu errors
  }
});

// Handle action clicks (toolbar button) - opens Multi-Panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!keyboardShortcutEnabled) {
    return;
  }

  await openMultiPanel();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'sync') return;

  if (changes.keyboardShortcutEnabled) {
    keyboardShortcutEnabled = changes.keyboardShortcutEnabled.newValue !== false;
  }
});

// Listen for version check requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchLatestCommit') {
    // Handle version check request from options page
    handleFetchLatestCommit().then(sendResponse);
    return true; // Keep channel open for async response
  }
  return true;
});

// Handle version check by fetching latest commit from GitHub API
async function handleFetchLatestCommit() {
  try {
    const GITHUB_API_URL = 'https://api.github.com/repos/Manho/Panelize/commits/main';

    const response = await fetch(GITHUB_API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        sha: data.sha,
        shortSha: data.sha.substring(0, 7),
        date: data.commit.committer.date,
        message: data.commit.message
      }
    };
  } catch (error) {
    console.error('[Background] Error fetching latest commit:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for keyboard shortcuts - simplified for Multi-Panel mode
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!keyboardShortcutEnabled) {
    return;
  }

  if (command === 'open-prompt-library') {
    // Open Multi-Panel
    await setPendingMultiPanelAction('openPromptLibrary', {});
    await openMultiPanel();

    // If it's prompt library command, also send message to open it
    setTimeout(() => {
      notifyMessage({
        action: 'openPromptLibrary',
        payload: {}
      }).catch(() => {
        // Multi-Panel may not be ready yet, ignore error
      });
    }, 500);
  } else if (command === 'toggle-focus') {
    // In Multi-Panel mode, toggle-focus just opens/focuses the Multi-Panel
    await openMultiPanel();
  }
});
