/**
 * Panel UI bindings: all DOM event listener registration.
 * Extracted from event-handlers.js — this file only binds events,
 * business logic lives in domain modules.
 */

import { t } from './i18n.js';
import { downloadDebugLogs } from './debug-log.js';
import { DEBUG_EXPORT_ENABLED } from './build-flags.js';
import { showToast } from './toast.js';
import { focusUnifiedInput, handleUnifiedInputBlur, isUnifiedInputOrNewChatControl, isUnifiedInputOrSendControl, cancelUnifiedInputFocusRestore, cancelUnifiedInputFocusRestoreAfterSend, isRestoringFocusAfterNewChatGetter, isRestoringFocusAfterSendGetter } from './focus-manager.js';
import { handleManualExport } from './markdown-export.js';
import { getPanels, getCurrentLayout, getCurrentPanelPage, setCurrentPanelPage } from './state.js';
import { getTotalPages } from './layout-config.js';
import { renderCurrentPage, setLayout, updateScrollArrows } from './panel-lifecycle.js';
import { setLastSentQuestion } from './merge-state.js';
import { triggerMerge } from './merge-engine.js';
import { getDiscussionActive, stopDiscussion } from './discussion-runner.js';
import { setLastMergeType, getAutoMergeEnabled, startMergeMonitor, stopMergeMonitor } from './merge-monitor.js';
import {
  searchPromptLibrary, renderPromptList,
  toggleFavoritesFilter, toggleRecentFilter, setCategoryFilter,
  closeVariableModal, applyVariables,
  openPromptEditor, closePromptEditor, savePromptFromEditor, deletePromptFromEditor,
  openPromptModal, closePromptModal,
  sendMessageWithDefaultPrompt
} from './prompting/index.js';
import {
  broadcastMessage, newChatAllProviders, getMergePanelIds
} from './send-pipeline.js';
import { toggleOpenMode } from './settings-loader.js';
import { handleProviderStatusMessage } from './panel-transport.js';
import { showAddPanelMenu, showMergeTargetMenu } from './panel-menus.js';
import { openLayoutModal, closeLayoutModal } from './layout-controls.js';

export function setupEventListeners() {
  document.getElementById('layout-btn').addEventListener('click', openLayoutModal);
  document.getElementById('close-layout-modal').addEventListener('click', closeLayoutModal);
  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.addEventListener('click', () => setLayout(btn.dataset.layout));
  });
  document.getElementById('add-panel-btn').addEventListener('click', (e) => { e.stopPropagation(); showAddPanelMenu(); });
  const scrollLeftBtn = document.getElementById('scroll-left-btn');
  const scrollRightBtn = document.getElementById('scroll-right-btn');
  if (scrollLeftBtn) {
    scrollLeftBtn.addEventListener('click', () => { if (getCurrentPanelPage() > 0) { setCurrentPanelPage(getCurrentPanelPage() - 1); renderCurrentPage(); } });
  }
  if (scrollRightBtn) {
    scrollRightBtn.addEventListener('click', () => {
      const totalPages = getTotalPages(getPanels().length, getCurrentLayout());
      if (getCurrentPanelPage() < totalPages - 1) { setCurrentPanelPage(getCurrentPanelPage() + 1); renderCurrentPage(); }
    });
  }
  document.getElementById('obsidian-export-btn').addEventListener('click', handleManualExport);
  const debugLogBtn = document.getElementById('debug-log-btn');
  if (debugLogBtn) {
    if (DEBUG_EXPORT_ENABLED) {
      debugLogBtn.addEventListener('click', downloadDebugLogs.bind(null, t, showToast));
    } else {
      // 正式版：无日志导出入口
      debugLogBtn.hidden = true;
    }
  }
  const newChatBtn = document.getElementById('new-chat-btn');
  const preserveNewChatButtonFocus = (event) => { event.preventDefault(); };
  newChatBtn.addEventListener('pointerdown', preserveNewChatButtonFocus);
  newChatBtn.addEventListener('mousedown', preserveNewChatButtonFocus);
  newChatBtn.addEventListener('click', newChatAllProviders);
  document.getElementById('settings-btn').addEventListener('click', () => { chrome.runtime.openOptionsPage(); });
  const toggleModeBtn = document.getElementById('toggle-open-mode-btn');
  if (toggleModeBtn) { toggleModeBtn.addEventListener('click', toggleOpenMode); }
  document.getElementById('prompt-library-btn').addEventListener('click', openPromptModal);
  document.getElementById('close-prompt-modal').addEventListener('click', closePromptModal);
  const promptSearch = document.getElementById('prompt-search');
  let searchTimeout;
  promptSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.trim();
      query ? searchPromptLibrary(query) : renderPromptList();
    }, 300);
  });
  const categoryFilter = document.getElementById('prompt-category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => { setCategoryFilter(e.target.value); });
  }
  const favoritesBtn = document.getElementById('prompt-favorites-btn');
  if (favoritesBtn) {
    favoritesBtn.addEventListener('click', () => { toggleFavoritesFilter(); });
  }
  const recentBtn = document.getElementById('prompt-recent-btn');
  if (recentBtn) {
    recentBtn.addEventListener('click', () => { toggleRecentFilter(); });
  }
  document.getElementById('close-variable-modal')?.addEventListener('click', closeVariableModal);
  document.getElementById('cancel-variable-btn')?.addEventListener('click', closeVariableModal);
  document.getElementById('apply-variable-btn')?.addEventListener('click', applyVariables);
  document.getElementById('variable-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'variable-modal') closeVariableModal();
  });
  const sendAllBtn = document.getElementById('send-all-btn');
  const preserveSendAllButtonFocus = (event) => { event.preventDefault(); };
  sendAllBtn.addEventListener('pointerdown', preserveSendAllButtonFocus);
  sendAllBtn.addEventListener('mousedown', preserveSendAllButtonFocus);
  sendAllBtn.addEventListener('click', () => {
    if (getDiscussionActive()) stopDiscussion();
    const input = document.getElementById('unified-input');
    setLastSentQuestion(input.value || '');
    const mergeSessionId = getAutoMergeEnabled() ? `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null;
    mergeSessionId ? startMergeMonitor(mergeSessionId, getPanels(), getMergePanelIds()) : stopMergeMonitor(getPanels());
    sendMessageWithDefaultPrompt(input.value, broadcastMessage, true);
  });
  const mergeBtn = document.getElementById('merge-btn');
  mergeBtn.addEventListener('click', async () => {
    if (mergeBtn.disabled) return;
    mergeBtn.disabled = true;
    mergeBtn.classList.add('active');
    mergeBtn.setAttribute('aria-busy', 'true');
    stopMergeMonitor(getPanels());
    setLastMergeType('manual');
    try {
      await triggerMerge({ panels: getPanels(), mergePanelIds: getMergePanelIds() });
    } catch (error) {
      console.error('[Merge] Manual merge failed:', error);
      showToast(t('errorOccurred'));
    } finally {
      mergeBtn.disabled = false;
      mergeBtn.classList.remove('active');
      mergeBtn.setAttribute('aria-busy', 'false');
    }
  });
  const stopDiscussionBtn = document.getElementById('stop-discussion-btn');
  if (stopDiscussionBtn) { stopDiscussionBtn.addEventListener('click', stopDiscussion); }
  document.getElementById('merge-target-btn').addEventListener('click', (e) => { e.stopPropagation(); showMergeTargetMenu(); });
  const inputTextarea = document.getElementById('unified-input');
  let isInputComposing = false;
  inputTextarea.addEventListener('compositionstart', () => { isInputComposing = true; });
  inputTextarea.addEventListener('compositionend', () => { isInputComposing = false; });
  inputTextarea.addEventListener('input', () => {
    requestAnimationFrame(() => {
      inputTextarea.style.height = '0';
      inputTextarea.style.height = Math.min(inputTextarea.scrollHeight, 150) + 'px';
    });
  });
  inputTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isInputComposing || e.isComposing) return;
      e.preventDefault();
      setLastSentQuestion(inputTextarea.value || '');
      const mergeSessionId = getAutoMergeEnabled() ? `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null;
      mergeSessionId ? startMergeMonitor(mergeSessionId, getPanels(), getMergePanelIds()) : stopMergeMonitor(getPanels());
      sendMessageWithDefaultPrompt(inputTextarea.value, broadcastMessage, true, mergeSessionId);
    }
  });
  inputTextarea.addEventListener('blur', handleUnifiedInputBlur);
  const cancelNewChatFocusRestoreOnUserIntent = (event) => {
    if (!isRestoringFocusAfterNewChatGetter()) return;
    if (isUnifiedInputOrNewChatControl(event.target)) return;
    cancelUnifiedInputFocusRestore();
  };
  document.addEventListener('pointerdown', cancelNewChatFocusRestoreOnUserIntent, true);
  document.addEventListener('mousedown', cancelNewChatFocusRestoreOnUserIntent, true);
  document.addEventListener('click', cancelNewChatFocusRestoreOnUserIntent, true);
  document.addEventListener('focusin', cancelNewChatFocusRestoreOnUserIntent, true);
  document.addEventListener('keydown', cancelNewChatFocusRestoreOnUserIntent, true);
  const cancelSendFocusRestoreOnUserIntent = (event) => {
    if (!isRestoringFocusAfterSendGetter()) return;
    if (isUnifiedInputOrSendControl(event.target)) return;
    cancelUnifiedInputFocusRestoreAfterSend();
  };
  document.addEventListener('pointerdown', cancelSendFocusRestoreOnUserIntent, true);
  document.addEventListener('mousedown', cancelSendFocusRestoreOnUserIntent, true);
  document.addEventListener('click', cancelSendFocusRestoreOnUserIntent, true);
  document.addEventListener('focusin', cancelSendFocusRestoreOnUserIntent, true);
  document.addEventListener('keydown', cancelSendFocusRestoreOnUserIntent, true);
  window.addEventListener('message', handleProviderStatusMessage);
  document.getElementById('layout-modal').addEventListener('click', (e) => { if (e.target.id === 'layout-modal') closeLayoutModal(); });
  document.getElementById('prompt-modal').addEventListener('click', (e) => { if (e.target.id === 'prompt-modal') closePromptModal(); });
  document.getElementById('close-prompt-editor')?.addEventListener('click', closePromptEditor);
  document.getElementById('cancel-prompt-editor')?.addEventListener('click', closePromptEditor);
  document.getElementById('save-prompt-btn')?.addEventListener('click', savePromptFromEditor);
  document.getElementById('delete-prompt-btn')?.addEventListener('click', deletePromptFromEditor);
  document.getElementById('new-prompt-btn')?.addEventListener('click', () => openPromptEditor());
  document.getElementById('prompt-editor-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'prompt-editor-modal') closePromptEditor();
  });
  window.addEventListener('resize', () => { if (typeof updateScrollArrows === 'function') updateScrollArrows(); });
}
