import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const htmlSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.html'), 'utf8');
const cssSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.css'), 'utf8');
const promptLibrarySource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/modules/prompting/prompt-library.js'), 'utf8');
const promptEditorSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/modules/prompting/prompt-editor.js'), 'utf8');
const defaultPromptSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/modules/prompting/default-prompt.js'), 'utf8');
const focusManagerSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/modules/focus-manager.js'), 'utf8');
const panelUiBindingsSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/modules/panel-ui-bindings.js'), 'utf8');
const promptManagerSource = readFileSync(resolve(process.cwd(), 'modules/prompt-manager.js'), 'utf8');

describe('prompt library panel wiring', () => {
  it('uses the IndexedDB upgrade transaction when removing the legacy tags index', () => {
    expect(promptManagerSource).toContain('const transaction = event.target.transaction;');
    expect(promptManagerSource).toContain('transaction.objectStore(PROMPTS_STORE)');
    expect(promptManagerSource).not.toContain("event.target.result.objectStore('prompts')");
  });

  it('renders legacy prompt records without assuming optional fields exist', () => {
    expect(promptLibrarySource).toContain("titleDiv.textContent = prompt.title || t('newPromptTitle');");
    expect(promptManagerSource).toContain('(Array.isArray(prompt.tags) ? prompt.tags : [])');
    expect(defaultPromptSource).toContain("String(defaultPrompt.content || '').replace");
    expect(promptEditorSource).toContain("let content = String(getSelectedPromptForVariables().content || '');");
  });

  it('does not force empty prompt categories to the English General fallback', () => {
    expect(promptManagerSource).toContain("category: sanitizeString(promptData.category || '', MAX_CATEGORY_LENGTH)");
    expect(promptManagerSource).not.toContain("category: sanitizeString(promptData.category || 'General', MAX_CATEGORY_LENGTH)");
  });

  it('exposes default prompt editing in the prompt editor modal', () => {
    expect(htmlSource).toContain('id="prompt-default-checkbox"');
    expect(promptEditorSource).toContain("document.getElementById('prompt-default-checkbox')");
    expect(promptEditorSource).toContain('variables: detectVariables(content)');
    expect(promptEditorSource).toContain('isDefault: makeDefault');
    expect(promptEditorSource).toContain('await setDefaultPrompt(savedPrompt.id);');
    expect(promptEditorSource).toContain('_updateDefaultPromptBar');
  });

  it('renders compact prompt rows with only the title as list text', () => {
    const listRenderBlock = promptLibrarySource.slice(
      promptLibrarySource.indexOf('export async function renderPromptList'),
      promptLibrarySource.indexOf('promptList.querySelectorAll')
    );

    expect(listRenderBlock).toContain("titleDiv.textContent = prompt.title || t('newPromptTitle');");
    expect(listRenderBlock).not.toContain('prompt-item-modal-preview');
    expect(listRenderBlock).not.toContain('prompt-item-category');
    expect(listRenderBlock).not.toContain('prompt-item-variables');
    expect(cssSource).toMatch(/\.prompt-item-modal\s*{[\s\S]*align-items:\s*center/);
    expect(cssSource).toMatch(/\.prompt-item-modal-title\s*{[\s\S]*white-space:\s*nowrap/);
  });

  it('shows a visible default-prompt action in the prompt library list', () => {
    expect(promptLibrarySource).toContain("const setDefaultBtn = document.createElement('button');");
    expect(promptLibrarySource).toContain("setDefaultBtn.textContent = prompt.isDefault ? '已默认' : '设为默认';");
    expect(cssSource).toMatch(/\.prompt-set-default-btn\s*{[\s\S]*min-width:\s*64px/);
    expect(cssSource).not.toMatch(/\.prompt-set-default-btn\s*{[\s\S]*opacity:\s*0;/);
  });

  it('keeps edit and delete confirmation actions inside each prompt row', () => {
    expect(promptLibrarySource).toContain("editBtn.textContent = '编辑';");
    expect(promptLibrarySource).toContain('openPromptEditor(prompt.id);');
    expect(promptLibrarySource).toContain('function showPromptDeleteConfirm');
    expect(promptLibrarySource).toContain("confirmWrap.className = 'prompt-delete-confirm';");
    expect(promptLibrarySource).not.toContain('actions: [');
    expect(cssSource).toMatch(/\.prompt-delete-confirm\s*{[\s\S]*display:\s*flex/);
    expect(cssSource).toMatch(/\.btn-danger\s*{[\s\S]*border-radius:\s*6px/);
  });

  it('does not restore unified input focus while editing prompt fields', () => {
    expect(focusManagerSource).toContain('PROMPT_EDITOR_INTERACTIVE_SELECTOR');
    expect(focusManagerSource).toContain('export function isPromptEditorInteractiveControl');
    expect(focusManagerSource).toContain('if (isPromptEditorInteractiveControl(active))');
    expect(focusManagerSource).toContain('isPromptEditorInteractiveControl(event?.relatedTarget)');
    expect(panelUiBindingsSource).toContain("inputTextarea.addEventListener('blur', handleUnifiedInputBlur)");
  });
});
