/**
 * Multi-Panel AI Comparison - Main JavaScript
 *
 * This module implements the multi-panel AI comparison feature,
 * allowing users to compare responses from multiple AI providers side by side.
 */

import { PROVIDERS, getProviderById, getEnabledProviders } from '../modules/providers.js';
import { applyTheme } from '../modules/theme-manager.js';
import { t, initializeLanguage } from '../modules/i18n.js';
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


// ===== State Management =====
let currentLayout = '2x2';
let panels = []; // Array of { id, providerId, iframe, state }
let uploadedImages = []; // Array of uploaded images { id, name, type, dataUrl }

// 提示词编辑器状态
let currentEditingPromptId = null;

// 打开模式状态
let currentOpenMode = 'tab'; // 'tab' 或 'popup'
let isPopupWindow = false;   // 当前窗口是否为弹出窗口

// Default panel configuration
const DEFAULT_PROVIDERS = ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'kimi'];
const MAX_PANELS = 9;
const PENDING_MULTI_PANEL_ACTION_KEY = 'pendingMultiPanelAction';
const LAYOUT_PANEL_COUNTS = {
  '1x1': 1,
  '1x2': 2,
  '1x3': 3,
  '1x4': 4,
  '1x5': 5,
  '1x6': 6,
  '1x7': 7,
  '2x1': 2,
  '2x2': 4,
  '2x3': 6,
  '2x4': 8,
  '3x1': 3,
  '3x2': 6,
  '3x3': 9,
  '4x2': 8
};
let isInitialized = false;

// ===== Initialization =====
async function init() {
  await applyTheme();
  await initializeLanguage();
  registerRuntimeMessageListener();

  // Detect window type and load mode
  await detectWindowType();

  // Restore state if needed (after mode switch)
  await restoreStateIfNeeded();

  // Load saved settings
  await loadSettings();

  // Initialize panels
  await initializePanels();

  // Setup event listeners
  setupEventListeners();

  isInitialized = true;
  await handlePendingMultiPanelAction();
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
      openMode: 'tab'
    });

    currentLayout = settings.multiPanelLayout;
    currentOpenMode = settings.openMode || 'tab';

    // Apply layout
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
    // 当前是弹出窗口，提示可以切换到标签页
    icon.textContent = 'tab';
    text.textContent = t('switchToTabMode') || 'Tab Mode';
    btn.title = t('switchToTabModeTitle') || 'Switch to Tab Mode';
  } else {
    // 当前是标签页，提示可以切换到弹出窗口
    icon.textContent = 'open_in_new';
    text.textContent = t('switchToPopupMode') || 'Popup Mode';
    btn.title = t('switchToPopupModeTitle') || 'Switch to Popup Mode';
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
        currentLayout = state.currentLayout;
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
      providerOrder: null,
      enabledProviders: DEFAULT_PROVIDERS,
      multiPanelProviders: DEFAULT_PROVIDERS
    });

    // Use providerOrder if available (from settings page), fallback to multiPanelProviders
    let providerIds;
    if (settings.providerOrder && Array.isArray(settings.providerOrder) && settings.providerOrder.length > 0) {
      // Use providerOrder directly since it now reflects enabled providers in correct order
      // Filter to ensure all providers in providerOrder are actually enabled
      providerIds = settings.providerOrder.filter(id => settings.enabledProviders.includes(id));
    } else {
      // Fallback: use enabledProviders in their stored order, or multiPanelProviders
      providerIds = settings.enabledProviders || settings.multiPanelProviders;
    }

    const panelCount = LAYOUT_PANEL_COUNTS[currentLayout] || 4;

    // Create panels for each provider
    for (let i = 0; i < Math.min(providerIds.length, panelCount); i++) {
      await addPanel(providerIds[i]);
    }

    // Update panel selectors in toolbar
    updatePanelSelectors();
  } catch (error) {
    console.error('Error initializing panels:', error);
  }
}

// ===== Panel Management =====

/**
 * Calculates whether layout adjustment is needed based on current layout and panel count
 * Only auto-expands columns in 1xN layout sequence
 * @param {string} currentLayout - Current layout, e.g., '1x2'
 * @param {number} newPanelCount - Total panel count after adding
 * @returns {string|null} - New layout name, or null if no adjustment needed
 */
function getAutoAdjustedLayout(currentLayout, newPanelCount) {
  // 只处理 1xN 布局
  const match = currentLayout.match(/^1x(\d)$/);
  if (!match) return null;
  
  const currentCols = parseInt(match[1]);
  const currentCapacity = LAYOUT_PANEL_COUNTS[currentLayout];
  
  // 如果新面板数不超过容量，无需调整
  if (newPanelCount <= currentCapacity) return null;
  
  // 计算下一级布局
  const nextCols = currentCols + 1;
  const nextLayout = `1x${nextCols}`;
  
  // 检查是否存在（1x6 是上限）
  if (LAYOUT_PANEL_COUNTS[nextLayout]) {
    return nextLayout;
  }
  
  return null; // 已达上限，无法自动调整
}

async function addPanel(providerId) {
  if (panels.length >= MAX_PANELS) {
    showToast('Maximum number of panels reached (9)');
    return;
  }

  // Auto layout adjustment: upgrade from 1xN to 1x(N+1) when adding panel exceeds capacity
  const newPanelCount = panels.length + 1;
  const adjustedLayout = getAutoAdjustedLayout(currentLayout, newPanelCount);
  
  if (adjustedLayout) {
    // Apply layout directly without calling setLayout (to avoid recursion from adjustPanelCount)
    currentLayout = adjustedLayout;
    const panelGrid = document.getElementById('panel-grid');
    panelGrid.className = `layout-${adjustedLayout}`;
    
    // Update layout button states (if layout modal is open)
    document.querySelectorAll('.layout-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === adjustedLayout);
    });
    
    // Save configuration
    await saveProviderConfiguration();
  }

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
        <img src="${provider.icon}" alt="${provider.name}" class="provider-icon">
        <span>${provider.name}</span>
      </div>
      <div class="panel-header-right">
        <button class="refresh-panel-btn" title="Refresh">
          <span class="material-symbols-outlined">refresh</span>
        </button>
        <button class="switch-provider-btn" title="Switch Provider">
          <span class="material-symbols-outlined">swap_horiz</span>
        </button>
      </div>
    </div>
    <div class="panel-iframe-container">
      <div class="panel-loading">Loading ${provider.name}...</div>
      <iframe
        src="${provider.url}"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="clipboard-read; clipboard-write"
        loading="eager"
      ></iframe>
    </div>
  `;

  panelGrid.appendChild(panelEl);

  // Get iframe reference
  const iframe = panelEl.querySelector('iframe');
  const loadingEl = panelEl.querySelector('.panel-loading');

  // Handle iframe load
  iframe.addEventListener('load', () => {
    loadingEl.classList.add('hidden');
  });

  iframe.addEventListener('error', () => {
    loadingEl.textContent = `Failed to load ${provider.name}`;
  });

  // Setup panel button handlers
  const refreshBtn = panelEl.querySelector('.refresh-panel-btn');
  refreshBtn.addEventListener('click', () => {
    loadingEl.classList.remove('hidden');
    loadingEl.textContent = `Loading ${provider.name}...`;
    iframe.src = provider.url;
  });

  const switchBtn = panelEl.querySelector('.switch-provider-btn');
  switchBtn.addEventListener('click', () => {
    showProviderSwitcher(panelId);
  });

  // Add to panels array
  panels.push({
    id: panelId,
    providerId,
    iframe,
    state: 'loading'
  });

  // Save provider configuration
  await saveProviderConfiguration();

  // Update panel selectors to show logo and name
  updatePanelSelectors();
}

function removePanel(panelId) {
  const panelIndex = panels.findIndex(p => p.id === panelId);
  if (panelIndex === -1) return;

  // Remove from DOM
  const panelEl = document.getElementById(panelId);
  if (panelEl) {
    panelEl.remove();
  }

  // Remove from array
  panels.splice(panelIndex, 1);

  // Update selectors
  updatePanelSelectors();

  // Save configuration
  saveProviderConfiguration();
}

async function switchPanelProvider(panelId, newProviderId) {
  const panel = panels.find(p => p.id === panelId);
  if (!panel) return;

  const provider = getProviderById(newProviderId);
  if (!provider) return;

  const panelEl = document.getElementById(panelId);
  if (!panelEl) return;

  // Update panel header
  const headerIcon = panelEl.querySelector('.panel-header-left img');
  const headerName = panelEl.querySelector('.panel-header-left span');
  headerIcon.src = provider.icon;
  headerIcon.alt = provider.name;
  headerName.textContent = provider.name;

  // Update iframe
  const iframe = panelEl.querySelector('iframe');
  const loadingEl = panelEl.querySelector('.panel-loading');
  loadingEl.classList.remove('hidden');
  loadingEl.textContent = `Loading ${provider.name}...`;
  iframe.src = provider.url;

  // Update panel data
  panel.providerId = newProviderId;
  panel.iframe = iframe;

  // Update selectors and save
  updatePanelSelectors();
  await saveProviderConfiguration();
}

function updatePanelSelectors() {
  const selectorsContainer = document.getElementById('panel-selectors');
  selectorsContainer.innerHTML = '';

  panels.forEach(panel => {
    const provider = getProviderById(panel.providerId);
    if (!provider) return;

    const selector = document.createElement('div');
    selector.className = 'panel-selector';
    selector.dataset.panelId = panel.id;
    selector.innerHTML = `
      <img src="${provider.icon}" alt="${provider.name}" class="provider-icon">
      <span>${provider.name}</span>
      <button class="remove-panel" title="Remove panel">
        <span class="material-symbols-outlined">close</span>
      </button>
    `;

    // Remove button handler
    const removeBtn = selector.querySelector('.remove-panel');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panels.length > 1) {
        removePanel(panel.id);
      } else {
        showToast('At least one panel is required');
      }
    });

    selectorsContainer.appendChild(selector);
  });
}

async function saveProviderConfiguration() {
  const providerIds = panels.map(p => p.providerId);
  try {
    await chrome.storage.sync.set({
      multiPanelProviders: providerIds,
      multiPanelLayout: currentLayout
    });
  } catch (error) {
    console.error('Error saving provider configuration:', error);
  }
}

function toggleToolbar() {
  const toolbar = document.getElementById('toolbar');
  const expandBar = document.getElementById('toolbar-expand-bar');
  const toggleBtn = document.getElementById('toggle-toolbar-btn');

  const isCollapsed = toolbar.classList.toggle('collapsed');

  if (isCollapsed) {
    expandBar.classList.remove('hidden');
  } else {
    expandBar.classList.add('hidden');
  }
}

// ===== Message Broadcasting =====
async function broadcastMessage(text, autoSubmit = true) {
  const sendBtn = document.getElementById('send-all-btn');
  const fillBtn = document.getElementById('fill-input-btn');
  const statusEl = document.getElementById('send-status');

  if (!text.trim() && uploadedImages.length === 0) {
    // If input is empty and autoSubmit is true, just trigger send buttons
    // (this happens when user clicks Fill first, then Send All)
    if (autoSubmit) {
      await triggerSendButtons();
      return;
    }
    showToast('Please enter a message or upload an image');
    return;
  }

  try {
    // Disable buttons during send
    sendBtn.disabled = true;
    fillBtn.disabled = true;
    statusEl.textContent = autoSubmit ? 'Sending...' : 'Filling...';
    statusEl.className = 'send-status';

    // Prepare images payload
    const imagesPayload = uploadedImages.map(img => ({
      dataUrl: img.dataUrl,
      name: img.name,
      type: img.type
    }));

    // Send to all panels
    const panelResults = await Promise.allSettled(
      panels.map(panel => sendToPanel(panel, text, imagesPayload, autoSubmit))
    );

    // Count results (panels only)
    const panelSuccessful = panelResults.filter(r => r.status === 'fulfilled' && r.value).length;
    const totalSuccessful = panelSuccessful;
    const totalCount = panels.length;
    const failed = totalCount - totalSuccessful;

    // Update status
    if (failed === 0) {
      statusEl.textContent = autoSubmit
        ? `Sent to ${totalSuccessful} AI${totalSuccessful > 1 ? 's' : ''}`
        : `Filled ${totalSuccessful} input${totalSuccessful > 1 ? 's' : ''}`;
      statusEl.className = 'send-status success';
    } else if (totalSuccessful > 0) {
      statusEl.textContent = autoSubmit
        ? `Sent to ${totalSuccessful}/${totalCount}`
        : `Filled ${totalSuccessful}/${totalCount}`;
      statusEl.className = 'send-status partial';
    } else {
      statusEl.textContent = autoSubmit ? 'Failed to send' : 'Failed to fill';
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
    statusEl.textContent = 'Error occurred';
    statusEl.className = 'send-status error';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } finally {
    // Always re-enable buttons, even if there was an error
    sendBtn.disabled = false;
    fillBtn.disabled = false;
  }
}

async function sendToPanel(panel, text, images = [], autoSubmit = true) {
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

  // Send clear message to all panels
  panels.forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      panel.iframe.contentWindow.postMessage({
        type: 'CLEAR_INPUT',
        clearImages: true,
        context: 'multi-panel'
      }, '*');
    }
  });
  showToast('All inputs cleared');
}

// ===== Image Management =====
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB per image
const MAX_IMAGE_COUNT = 10;

async function addImage(file) {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file');
      return false;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      showToast('Image size must be less than 20MB');
      return false;
    }

    // Validate image count
    if (uploadedImages.length >= MAX_IMAGE_COUNT) {
      showToast(`Maximum ${MAX_IMAGE_COUNT} images allowed`);
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
    showToast('Failed to add image');
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
      <button class="remove-image" onclick="window.removeImageById('${img.id}')" title="Remove">
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

  // Send NEW_CHAT message to all panels
  panels.forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      panel.iframe.contentWindow.postMessage({
        type: 'NEW_CHAT',
        context: 'multi-panel'
      }, '*');
    }
  });

  showToast('New chat created for all AIs');

  // Re-enable button
  setTimeout(() => {
    newChatBtn.disabled = false;
  }, 1000);
}

// Trigger send buttons only (no text injection) - used after Fill
async function triggerSendButtons() {
  const sendBtn = document.getElementById('send-all-btn');
  const fillBtn = document.getElementById('fill-input-btn');
  const statusEl = document.getElementById('send-status');

  try {
    sendBtn.disabled = true;
    fillBtn.disabled = true;
    statusEl.textContent = 'Sending...';
    statusEl.className = 'send-status';

    // Send TRIGGER_SEND message to all panels
    panels.forEach(panel => {
      if (panel.iframe && panel.iframe.contentWindow) {
        panel.iframe.contentWindow.postMessage({
          type: 'TRIGGER_SEND',
          context: 'multi-panel'
        }, '*');
      }
    });

    // Update status
    statusEl.textContent = `Sent to ${panels.length} AIs`;
    statusEl.className = 'send-status success';

    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } catch (error) {
    console.error('Error in triggerSendButtons:', error);
    statusEl.textContent = 'Error occurred';
    statusEl.className = 'send-status error';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'send-status';
    }, 3000);
  } finally {
    // Always re-enable buttons
    sendBtn.disabled = false;
    fillBtn.disabled = false;
  }
}

// ===== Layout Management =====
function setLayout(layout) {
  if (!LAYOUT_PANEL_COUNTS[layout]) return;

  currentLayout = layout;

  const panelGrid = document.getElementById('panel-grid');
  panelGrid.className = `layout-${layout}`;

  // Update layout button active states
  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === layout);
  });

  // Adjust panel count if needed
  const targetCount = LAYOUT_PANEL_COUNTS[layout];
  adjustPanelCount(targetCount);

  // Save layout
  saveProviderConfiguration();

  // Close modal
  closeLayoutModal();
}

async function adjustPanelCount(targetCount) {
  const enabledProviders = await getEnabledProviders();

  // Remove excess panels
  while (panels.length > targetCount) {
    const panel = panels[panels.length - 1];
    removePanel(panel.id);
  }

  // Add missing panels
  while (panels.length < targetCount) {
    // Find a provider not already in use
    const usedProviders = panels.map(p => p.providerId);
    const availableProvider = enabledProviders.find(p => !usedProviders.includes(p.id));

    if (availableProvider) {
      await addPanel(availableProvider.id);
    } else if (enabledProviders.length > 0) {
      // Reuse first provider if all are used
      await addPanel(enabledProviders[0].id);
    }
  }
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

    categorySelect.innerHTML = '<option value="">All Categories</option>' +
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
          <p>${searchQuery ? 'No matching prompts' : 'No prompts available'}</p>
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
    promptList.innerHTML = '<div class="prompt-empty">Failed to load prompts</div>';
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
      <input type="text" id="var-${escapeHtml(variable)}" data-variable="${escapeHtml(variable)}" placeholder="Enter value for ${escapeHtml(variable)}">
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

  // Toggle toolbar button and expand bar
  document.getElementById('toggle-toolbar-btn').addEventListener('click', toggleToolbar);
  document.getElementById('toolbar-expand-bar').addEventListener('click', toggleToolbar);

  // New Chat button
  document.getElementById('new-chat-btn').addEventListener('click', newChatAllProviders);

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

  // Clear All button
  document.getElementById('clear-all-btn').addEventListener('click', () => {
    clearAllInputs();
  });

  // Fill Input Boxes button (no auto-send)
  document.getElementById('fill-input-btn').addEventListener('click', () => {
    const input = document.getElementById('unified-input');
    broadcastMessage(input.value, false);
  });

  // Send All button (fill + auto-send)
  document.getElementById('send-all-btn').addEventListener('click', () => {
    const input = document.getElementById('unified-input');
    broadcastMessage(input.value, true);
  });

  // Input textarea
  const inputTextarea = document.getElementById('unified-input');
  inputTextarea.addEventListener('input', resizeTextarea);
  inputTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      broadcastMessage(inputTextarea.value);
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
  const enabledProviders = await getEnabledProviders();
  const panel = panels.find(p => p.id === panelId);
  if (!panel) return;

  // Create a simple dropdown menu
  const menu = document.createElement('div');
  menu.className = 'provider-switcher-menu';
  menu.style.cssText = `
    position: fixed;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 160px;
    padding: 8px 0;
  `;

  menu.innerHTML = enabledProviders.map(provider => `
    <div class="provider-switcher-item" data-provider-id="${provider.id}" style="
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
      ${provider.id === panel.providerId ? 'background: #e3f2fd; color: #1976d2;' : ''}
    ">
      <img src="${provider.icon}" alt="${provider.name}" style="width: 20px; height: 20px;">
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
      item.style.background = '#f5f5f5';
    });
    item.addEventListener('mouseleave', () => {
      if (item.dataset.providerId === panel.providerId) {
        item.style.background = '#e3f2fd';
      } else {
        item.style.background = '';
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

async function showAddPanelMenu() {
  if (panels.length >= MAX_PANELS) {
    showToast('Maximum number of panels reached (9)');
    return;
  }

  const enabledProviders = await getEnabledProviders();
  const usedProviders = panels.map(p => p.providerId);
  const availableProviders = enabledProviders.filter(p => !usedProviders.includes(p.id));

  if (availableProviders.length === 0) {
    showToast('All providers are already in use');
    return;
  }

  const btn = document.getElementById('add-panel-btn');
  const rect = btn.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.className = 'add-panel-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 4}px;
    left: ${rect.left}px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 160px;
    padding: 8px 0;
  `;

  menu.innerHTML = availableProviders.map(provider => `
    <div class="add-panel-item" data-provider-id="${provider.id}" style="
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
    ">
      <img src="${provider.icon}" alt="${provider.name}" style="width: 20px; height: 20px;">
      <span>${provider.name}</span>
    </div>
  `).join('');

  document.body.appendChild(menu);

  menu.querySelectorAll('.add-panel-item').forEach(item => {
    item.addEventListener('click', () => {
      addPanel(item.dataset.providerId);
      menu.remove();
    });

    item.addEventListener('mouseenter', () => {
      item.style.background = '#f5f5f5';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = '';
    });
  });

  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
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
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
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
    title.textContent = 'Edit Prompt';
    deleteBtn.style.display = 'block';
    // 加载现有提示词数据
    loadPromptForEditing(promptId);
  } else {
    // 新增模式
    title.textContent = 'New Prompt';
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
    showToast('Failed to load prompt');
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
    alert('Title and content are required');
    return;
  }

  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  const promptData = { title, content, category, tags };

  try {
    if (currentEditingPromptId) {
      await updatePrompt(currentEditingPromptId, promptData);
      showToast('Prompt updated successfully');
    } else {
      await savePrompt(promptData);
      showToast('Prompt saved successfully');
    }

    closePromptEditor();
    await renderPromptList();
  } catch (error) {
    console.error('Error saving prompt:', error);
    showToast('Failed to save prompt');
  }
}

// 删除提示词
async function deletePromptFromEditor() {
  if (!currentEditingPromptId) return;

  if (confirm('Are you sure you want to delete this prompt?')) {
    try {
      await deletePrompt(currentEditingPromptId);
      showToast('Prompt deleted');
      closePromptEditor();
      await renderPromptList();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      showToast('Failed to delete prompt');
    }
  }
}

// Initialize on load
init();
