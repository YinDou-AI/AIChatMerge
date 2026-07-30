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
  getSelectedPromptForVariables, setSelectedPromptForVariables,
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

  const promptContent = String(prompt.content || '');
  const detectedVars = detectVariables(promptContent);
  const allVars = [...new Set([...(prompt.variables || []), ...detectedVars])];

  if (allVars.length > 0) {
    setSelectedPromptForVariables({ ...prompt, variables: allVars });
    showVariableModal({ ...prompt, variables: allVars });
  } else {
    applyPromptToInput(promptContent);
    closePromptModal();
  }
}

function showVariableModal(prompt) {
  const modal = document.getElementById('variable-modal');
  const inputsContainer = document.getElementById('variable-inputs');

  inputsContainer.textContent = '';
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

  const firstInput = inputsContainer.querySelector('input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
}

export function applyVariables() {
  if (!getSelectedPromptForVariables()) return;

  let content = String(getSelectedPromptForVariables().content || '');
  const inputs = document.querySelectorAll('#variable-inputs input');

  inputs.forEach(input => {
    const variable = input.dataset.variable;
    const value = input.value || `{${variable}}`;
    const regex = new RegExp(`\\{${variable}\\}`, 'g');
    content = content.replace(regex, value);
  });

  applyPromptToInput(content);
  closeVariableModal();
  closePromptModal();
  setSelectedPromptForVariables(null);
}

export function applyPromptToInput(content) {
  const input = document.getElementById('unified-input');
  if (!input) return;
  input.value = content;
  input.focus();
}

export function closeVariableModal() {
  document.getElementById('variable-modal').style.display = 'none';
  setSelectedPromptForVariables(null);
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
