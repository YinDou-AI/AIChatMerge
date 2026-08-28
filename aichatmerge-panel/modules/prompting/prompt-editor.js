/**
 * Prompt editor: open/close, load, save, delete, variables, apply to input.
 * Extracted from prompt-library.js.
 */

import {
  getPrompt,
  updatePrompt,
  savePrompt,
  deletePrompt,
  recordPromptUsage,
  setDefaultPrompt,
  clearDefaultPrompt
} from '../../../modules/prompt-manager.js';

import { t } from '../i18n.js';
import { showToast } from '../toast.js';
import {
  getCurrentEditingPromptId, setCurrentEditingPromptId,
  setCurrentPromptFilter, setCurrentCategoryFilter
} from './prompt-state.js';

// Forward declarations — set by initPromptEditor(renderList, updateBar)
let _renderPromptList = null;
let _updateDefaultPromptBar = null;

export function initPromptEditor(renderListFn, updateBarFn) {
  _renderPromptList = renderListFn;
  _updateDefaultPromptBar = updateBarFn;
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

export async function selectPrompt(prompt) {
  await recordPromptUsage(prompt.id);

  // 点击提示词时，把 {variable} 占位符替换为统一输入框（unified-input）中的当前内容后填入。
  let content = String(prompt.content || '');
  const input = document.getElementById('unified-input');
  const inputContent = input ? input.value : '';
  if (inputContent) {
    content = content.replace(/\{variable\}/g, inputContent);
  }
  applyPromptToInput(content);
  closePromptModal();
}

export function applyPromptToInput(content) {
  const input = document.getElementById('unified-input');
  if (!input) return;
  input.value = content;
  input.focus();
}

// ===== Prompt Editor =====

export function openPromptEditor(promptId = null) {
  setCurrentEditingPromptId(promptId);
  const modal = document.getElementById('prompt-editor-modal');
  const title = document.getElementById('prompt-editor-title');
  const deleteBtn = document.getElementById('delete-prompt-btn');

  if (promptId) {
    title.textContent = t('editPrompt');
    deleteBtn.style.display = 'block';
    loadPromptForEditing(promptId);
  } else {
    title.textContent = t('newPromptTitle');
    deleteBtn.style.display = 'none';
    clearPromptEditor();
  }

  modal.style.display = 'flex';
}

async function loadPromptForEditing(promptId) {
  try {
    const prompt = await getPrompt(promptId);
    if (prompt) {
      document.getElementById('prompt-title-input').value = prompt.title || '';
      document.getElementById('prompt-content-input').value = prompt.content || '';
      document.getElementById('prompt-category-input').value = prompt.category || '';
      const defaultCheckbox = document.getElementById('prompt-default-checkbox');
      if (defaultCheckbox) defaultCheckbox.checked = prompt.isDefault === true;
    }
  } catch (error) {
    console.error('Error loading prompt for editing:', error);
    showToast(t('promptLoadFailed'));
  }
}

function clearPromptEditor() {
  document.getElementById('prompt-title-input').value = '';
  document.getElementById('prompt-content-input').value = '';
  document.getElementById('prompt-category-input').value = '';
  const defaultCheckbox = document.getElementById('prompt-default-checkbox');
  if (defaultCheckbox) defaultCheckbox.checked = false;
}

export function closePromptEditor() {
  document.getElementById('prompt-editor-modal').style.display = 'none';
  setCurrentEditingPromptId(null);
}

export async function savePromptFromEditor() {
  const title = document.getElementById('prompt-title-input').value.trim();
  const content = document.getElementById('prompt-content-input').value.trim();
  const category = document.getElementById('prompt-category-input').value.trim();
  const makeDefault = document.getElementById('prompt-default-checkbox')?.checked === true;

  if (!title || !content) {
    alert(t('titleContentRequired'));
    return;
  }

  const existingPrompt = getCurrentEditingPromptId() ? await getPrompt(getCurrentEditingPromptId()) : null;

  const promptData = {
    title,
    content,
    category,
    variables: detectVariables(content),
    isFavorite: existingPrompt?.isFavorite || false,
    isDefault: makeDefault
  };

  try {
    let savedPrompt = null;
    if (getCurrentEditingPromptId()) {
      savedPrompt = await updatePrompt(getCurrentEditingPromptId(), promptData);
      if (makeDefault) {
        await setDefaultPrompt(getCurrentEditingPromptId());
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
    if (_renderPromptList) await _renderPromptList();
    if (_updateDefaultPromptBar) await _updateDefaultPromptBar();
  } catch (error) {
    console.error('Error saving prompt:', error);
    showToast(t('promptSaveFailed'));
  }
}

export async function deletePromptFromEditor() {
  if (!getCurrentEditingPromptId()) return;

  if (confirm(t('confirmDeletePrompt'))) {
    try {
      await deletePrompt(getCurrentEditingPromptId());
      showToast(t('promptDeleted'));
      closePromptEditor();
      if (_renderPromptList) await _renderPromptList();
      if (_updateDefaultPromptBar) await _updateDefaultPromptBar();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      showToast(t('promptDeleteFailed'));
    }
  }
}

export function closePromptModal() {
  document.getElementById('prompt-modal').style.display = 'none';
  document.getElementById('prompt-search').value = '';
  setCurrentPromptFilter('all');
  setCurrentCategoryFilter('');
}
