/**
 * Prompt library: list, search, filter, delete confirm, filter toggles.
 * Editor/variables/modal logic extracted to prompt-editor.js.
 */

import {
  getAllPrompts,
  getPrompt,
  updatePrompt,
  deletePrompt,
  searchPrompts,
  getRecentlyUsedPrompts,
  getFavoritePrompts,
  setDefaultPrompt,
  clearDefaultPrompt
} from '../../../modules/prompt-manager.js';

import { t } from '../i18n.js';
import { showToast } from '../toast.js';
import { setMaterialIcon } from '../theme.js';
import {
  getCurrentPromptFilter, setCurrentPromptFilter,
  getCurrentCategoryFilter, setCurrentCategoryFilter
} from './prompt-state.js';
import { updateDefaultPromptBar } from './default-prompt.js';
import {
  initPromptEditor,
  selectPrompt,
  applyVariables,
  applyPromptToInput,
  closeVariableModal,
  openPromptEditor,
  closePromptEditor,
  savePromptFromEditor,
  deletePromptFromEditor,
  closePromptModal
} from './prompt-editor.js';

// Wire up cross-module dependencies
initPromptEditor(() => renderPromptList(), () => updateDefaultPromptBar());

// Re-export editor functions for existing importers (prompting/index.js)
export {
  selectPrompt,
  applyVariables,
  applyPromptToInput,
  closeVariableModal,
  openPromptEditor,
  closePromptEditor,
  savePromptFromEditor,
  deletePromptFromEditor,
  closePromptModal
} from './prompt-editor.js';

export function openPromptModal() {
  document.getElementById('prompt-modal').style.display = 'flex';
  loadPromptLibrary();
}

// ===== Helpers =====

async function loadCategoryFilter() {
  const categorySelect = document.getElementById('prompt-category-filter');
  if (!categorySelect) return;

  try {
    const prompts = await getAllPrompts();
    const categories = [...new Set(prompts.map(p => p.category).filter(Boolean))];

    categorySelect.textContent = '';
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

// ===== Prompt List =====

export async function renderPromptList(searchQuery = null) {
  const promptList = document.getElementById('prompt-list-modal');
  if (!promptList) return;

  try {
    let prompts;

    if (searchQuery) {
      prompts = await searchPrompts(searchQuery);
    } else if (getCurrentPromptFilter() === 'recent') {
      prompts = await getRecentlyUsedPrompts(20);
      if (prompts.length === 0) {
        prompts = await getAllPrompts();
      }
    } else if (getCurrentPromptFilter() === 'favorites') {
      prompts = await getFavoritePrompts();
    } else {
      prompts = await getAllPrompts();
    }

    if (getCurrentCategoryFilter()) {
      prompts = prompts.filter(p => p.category === getCurrentCategoryFilter());
    }

    if (prompts.length === 0) {
      promptList.textContent = '';
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

    promptList.textContent = '';
    prompts.slice(0, 30).forEach(prompt => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'prompt-item-modal';
      itemDiv.dataset.id = String(prompt.id);

      const favoriteIcon = document.createElement('span');
      favoriteIcon.className = `prompt-favorite-icon ${prompt.isFavorite ? 'favorited' : ''}`;
      favoriteIcon.textContent = prompt.isFavorite ? '★' : '☆';
      favoriteIcon.title = prompt.isFavorite ? '取消收藏' : '添加收藏';
      favoriteIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(prompt.id);
      });
      itemDiv.appendChild(favoriteIcon);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'prompt-row-action-btn prompt-edit-btn';
      editBtn.textContent = '编辑';
      editBtn.title = t('editPrompt');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPromptEditor(prompt.id);
      });
      itemDiv.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'prompt-row-action-btn prompt-delete-btn';
      deleteBtn.textContent = '删除';
      deleteBtn.title = t('delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPromptDeleteConfirm(itemDiv, prompt);
      });
      itemDiv.appendChild(deleteBtn);

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
        await renderPromptList();
        await updateDefaultPromptBar();
      });
      itemDiv.appendChild(setDefaultBtn);

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'prompt-item-content';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'prompt-item-modal-title';
      titleDiv.textContent = prompt.title || t('newPromptTitle');
      contentWrapper.appendChild(titleDiv);
      itemDiv.appendChild(contentWrapper);
      promptList.appendChild(itemDiv);
    });

    promptList.querySelectorAll('.prompt-item-modal').forEach(item => {
      item.addEventListener('click', async () => {
        const promptId = parseInt(item.dataset.id);
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          await selectPrompt(prompt);
        }
      });

      item.addEventListener('dblclick', async () => {
        const promptId = parseInt(item.dataset.id);
        openPromptEditor(promptId);
      });
    });
  } catch (error) {
    console.error('Error loading prompts:', error);
    if (!promptList) return;
    promptList.textContent = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'prompt-empty';
    errorDiv.textContent = t('failedToLoadPrompts');
    promptList.appendChild(errorDiv);
  }
}

export async function loadPromptLibrary() {
  await loadCategoryFilter();
  await renderPromptList();
}

export async function toggleFavorite(promptId) {
  try {
    const prompt = await getPrompt(promptId);
    if (!prompt) return;

    await updatePrompt(promptId, { isFavorite: !prompt.isFavorite });
    renderPromptList();
  } catch (error) {
    console.error('[PromptLibrary] Toggle favorite failed:', error);
  }
}

export async function deletePromptDirect(promptId) {
  try {
    const prompt = await getPrompt(promptId);
    if (!prompt) return;

    await deletePrompt(promptId);
    await renderPromptList();
    await updateDefaultPromptBar();
    showToast('已删除', { type: 'success', duration: 1500 });
  } catch (error) {
    console.error('[PromptLibrary] Delete prompt failed:', error);
  }
}

function showPromptDeleteConfirm(itemDiv, prompt) {
  if (!itemDiv || itemDiv.querySelector('.prompt-delete-confirm')) return;

  const existingActions = itemDiv.querySelectorAll('.prompt-row-action-btn, .prompt-set-default-btn');
  existingActions.forEach(action => { action.style.display = 'none'; });

  const confirmWrap = document.createElement('div');
  confirmWrap.className = 'prompt-delete-confirm';

  const message = document.createElement('span');
  message.className = 'prompt-delete-confirm-text';
  message.textContent = `确认删除 "${prompt.title || t('newPromptTitle')}"？`;
  confirmWrap.appendChild(message);

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'prompt-delete-confirm-btn';
  confirmBtn.textContent = '确认删除';
  confirmBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deletePromptDirect(prompt.id);
  });
  confirmWrap.appendChild(confirmBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'prompt-delete-cancel-btn';
  cancelBtn.textContent = t('cancel');
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmWrap.remove();
    existingActions.forEach(action => { action.style.display = ''; });
  });
  confirmWrap.appendChild(cancelBtn);

  itemDiv.appendChild(confirmWrap);
}

export async function searchPromptLibrary(query) {
  await renderPromptList(query);
}

// ===== Business action wrappers =====

export function toggleFavoritesFilter() {
  const newFilter = getCurrentPromptFilter() === 'favorites' ? 'all' : 'favorites';
  setCurrentPromptFilter(newFilter);
  const favoritesBtn = document.getElementById('prompt-favorites-btn');
  if (favoritesBtn) favoritesBtn.classList.toggle('active', newFilter === 'favorites');
  document.getElementById('prompt-recent-btn')?.classList.remove('active');
  renderPromptList();
}

export function toggleRecentFilter() {
  const newFilter = getCurrentPromptFilter() === 'recent' ? 'all' : 'recent';
  setCurrentPromptFilter(newFilter);
  const recentBtn = document.getElementById('prompt-recent-btn');
  if (recentBtn) recentBtn.classList.toggle('active', newFilter === 'recent');
  document.getElementById('prompt-favorites-btn')?.classList.remove('active');
  renderPromptList();
}

export function setCategoryFilter(category) {
  setCurrentCategoryFilter(category);
  renderPromptList();
}
