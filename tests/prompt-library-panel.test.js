import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const panelSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');
const htmlSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.html'), 'utf8');
const cssSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.css'), 'utf8');
const promptManagerSource = readFileSync(resolve(process.cwd(), 'modules/prompt-manager.js'), 'utf8');

describe('prompt library panel wiring', () => {
  it('uses the IndexedDB upgrade transaction when removing the legacy tags index', () => {
    expect(promptManagerSource).toContain('const transaction = event.target.transaction;');
    expect(promptManagerSource).toContain('transaction.objectStore(PROMPTS_STORE)');
    expect(promptManagerSource).not.toContain("event.target.result.objectStore('prompts')");
  });

  it('renders legacy prompt records without assuming optional fields exist', () => {
    expect(panelSource).toContain("titleDiv.textContent = prompt.title || '未命名提示词';");
    expect(promptManagerSource).toContain('(Array.isArray(prompt.tags) ? prompt.tags : [])');
  });

  it('exposes default prompt editing in the prompt editor modal', () => {
    expect(htmlSource).toContain('id="prompt-default-checkbox"');
    expect(panelSource).toContain("document.getElementById('prompt-default-checkbox')");
    expect(panelSource).toContain('isDefault: makeDefault');
    expect(panelSource).toContain('await setDefaultPrompt(savedPrompt.id);');
    expect(panelSource).toContain('await updateDefaultPromptBar();');
  });

  it('does not let unified-input focus protection steal prompt editor typing focus', () => {
    expect(panelSource).toContain('function isPromptEditorTextControl(target)');
    expect(panelSource).toContain("target.closest('#prompt-editor-modal input, #prompt-editor-modal textarea')");
    expect(panelSource).toContain('if (isPromptEditorTextControl(event.relatedTarget))');
  });

  it('shows a visible default-prompt action in the prompt library list', () => {
    expect(panelSource).toContain("const setDefaultBtn = document.createElement('button');");
    expect(panelSource).toContain("setDefaultBtn.textContent = prompt.isDefault ? '已默认' : '设为默认';");
    expect(cssSource).toMatch(/\.prompt-set-default-btn\s*{[\s\S]*min-width:\s*64px/);
    expect(cssSource).not.toMatch(/\.prompt-set-default-btn\s*{[\s\S]*opacity:\s*0;/);
  });

  it('keeps prompt library rows compact by rendering only the title as list text', () => {
    const listRenderBlock = panelSource.slice(
      panelSource.indexOf('async function renderPromptList'),
      panelSource.indexOf('// Add click handlers')
    );

    expect(listRenderBlock).toContain("titleDiv.textContent = prompt.title || '未命名提示词';");
    expect(listRenderBlock).not.toContain('prompt-item-modal-preview');
    expect(listRenderBlock).not.toContain('prompt-item-category');
    expect(listRenderBlock).not.toContain('prompt-item-variables');
    expect(cssSource).toMatch(/\.prompt-item-modal\s*{[\s\S]*align-items:\s*center/);
    expect(cssSource).toMatch(/\.prompt-item-modal-title\s*{[\s\S]*white-space:\s*nowrap/);
  });
});
