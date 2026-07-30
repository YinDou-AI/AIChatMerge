/**
 * Panel menus: provider switcher, merge target menu, add panel menu.
 * Extracted from event-handlers.js for domain separation.
 */

import { getDropdownThemePalette, getThemeAwareProviderIcon, setBrandText } from './theme.js';
import { PROVIDERS, getProviderById } from '../../modules/providers.js';
import { getPanels } from './state.js';
import { addPanel, switchPanelProvider } from './panel-lifecycle.js';
import { getSelectedMergeTarget, setSelectedMergeTarget } from './merge-state.js';
import { getNonMergePanels } from './send-pipeline.js';

// ===== Dropdown close handler (shared utility) =====

let lastInteractionTime = 0;
document.addEventListener('pointerdown', () => { lastInteractionTime = Date.now(); }, true);
document.addEventListener('click', () => { lastInteractionTime = Date.now(); }, true);

export function setupDropdownCloseHandler(dropdown, btn, { closeWhenIframeFocused = false } = {}) {
  function close() { if (dropdown.parentNode) dropdown.remove(); cleanup(); }
  function onPointerDown(e) { if (!dropdown.contains(e.target) && !btn.contains(e.target)) close(); }
  function onPointerOver(event) { if (closeWhenIframeFocused && event.target instanceof HTMLIFrameElement) close(); }
  function onBlur(event) {
    if (closeWhenIframeFocused) {
      setTimeout(() => { if (document.activeElement?.tagName === 'IFRAME') close(); }, 0);
      return;
    }
    if (Date.now() - lastInteractionTime > 200) return;
    const related = event.relatedTarget;
    if (related && (btn.contains(related) || dropdown.contains(related))) return;
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

// ===== Provider switcher =====

export async function showProviderSwitcher(panelId) {
  const panel = getPanels().find(p => p.id === panelId);
  if (!panel) return;
  const palette = getDropdownThemePalette();
  const menu = document.createElement('div');
  menu.className = 'provider-switcher-menu';
  menu.style.cssText = 'position:fixed;background:' + palette.menuBackground + ';border:1px solid ' + palette.menuBorder + ';border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;min-width:200px;padding:8px 0;';
  PROVIDERS.forEach(provider => {
    const item = document.createElement('div');
    item.className = 'provider-switcher-item';
    item.dataset.providerId = provider.id;
    item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 16px;cursor:pointer;font-size:14px;color:' + (provider.id === panel.providerId ? palette.selectedText : palette.menuText) + (provider.id === panel.providerId ? ';background:' + palette.selectedBackground : '') + ';';
    const img = document.createElement('img');
    img.src = getThemeAwareProviderIcon(provider);
    img.alt = provider.name;
    img.style.cssText = 'width:20px;height:20px;';
    img.dataset.providerId = provider.id;
    const span = document.createElement('span');
    setBrandText(span, provider.name);
    item.appendChild(img);
    item.appendChild(span);
    menu.appendChild(item);
  });
  const panelEl = document.getElementById(panelId);
  const rect = panelEl.querySelector('.switch-provider-btn').getBoundingClientRect();
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.left = rect.left + 'px';
  document.body.appendChild(menu);
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) menu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';
  if (menuRect.bottom > window.innerHeight) menu.style.top = (rect.top - menuRect.height - 4) + 'px';
  menu.querySelectorAll('.provider-switcher-item').forEach(item => {
    item.addEventListener('click', () => { switchPanelProvider(panelId, item.dataset.providerId); menu.remove(); });
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
  const closeMenu = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// ===== Merge target menu =====

let mergeTargetCleanup = null;
export function showMergeTargetMenu() {
  const btn = document.getElementById('merge-target-btn');
  const existing = document.querySelector('.merge-target-dropdown');
  if (existing) {
    if (mergeTargetCleanup) { mergeTargetCleanup(); mergeTargetCleanup = null; }
    existing.remove();
    return;
  }
  const MERGE_TARGETS = [
    { id: 'deepseek', name: 'DeepSeek' }, { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'gemini', name: 'Gemini' }, { id: 'kimi', name: 'Kimi' },
    { id: 'qianwen', name: '千问' }, { id: 'zhipu', name: '智谱清言' },
    { id: 'wenxin', name: '文心一言' }, { id: 'doubao', name: '豆包' },
    { id: 'metaso', name: '秘塔AI' }, { id: 'claude', name: 'Claude' },
    { id: 'grok', name: 'Grok' }
  ];
  const dropdown = document.createElement('div');
  dropdown.className = 'merge-target-dropdown';
  MERGE_TARGETS.forEach(target => {
    const item = document.createElement('button');
    item.className = 'merge-target-item' + (target.id === getSelectedMergeTarget() ? ' selected' : '');
    item.textContent = target.name;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelectedMergeTarget(target.id);
      document.getElementById('merge-target-label').textContent = target.name;
      if (mergeTargetCleanup) { mergeTargetCleanup(); mergeTargetCleanup = null; }
      dropdown.remove();
    });
    item.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    dropdown.appendChild(item);
  });
  btn.style.position = 'relative';
  btn.appendChild(dropdown);
  mergeTargetCleanup = setupDropdownCloseHandler(dropdown, btn);
}

// ===== Add panel menu =====

let addPanelCleanup = null;
export function showAddPanelMenu() {
  const existing = document.querySelector('.add-panel-menu');
  if (existing) {
    if (addPanelCleanup) { addPanelCleanup(); addPanelCleanup = null; }
    existing.remove();
    return;
  }
  const addedProviders = getNonMergePanels().map(p => p.providerId);
  const dropdown = document.createElement('div');
  dropdown.className = 'add-panel-menu';
  PROVIDERS.forEach(provider => {
    const isAdded = addedProviders.includes(provider.id);
    const item = document.createElement('button');
    item.className = 'add-panel-item' + (isAdded ? ' is-added' : '');
    const providerData = getProviderById(provider.id);
    const iconWrap = document.createElement('div');
    iconWrap.className = 'add-panel-item-icon-wrap';
    const iconImg = document.createElement('img');
    iconImg.src = getThemeAwareProviderIcon(providerData);
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
  const btn = document.getElementById('add-panel-btn');
  if (btn) { btn.style.position = 'relative'; btn.appendChild(dropdown); }
  addPanelCleanup = setupDropdownCloseHandler(dropdown, btn, { closeWhenIframeFocused: true });
}
