import { getProviderIcon, getProviderById } from '../../modules/providers.js';

export function setMaterialIcon(iconEl, iconName) {
  if (!iconEl || !iconName) return;
  iconEl.dataset.icon = iconName;
  iconEl.classList.add('notranslate');
  iconEl.setAttribute('translate', 'no');
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = '';
}

export function setBrandText(element, text) {
  if (!element) return;
  element.textContent = text || '';
  element.classList.add('notranslate');
  element.setAttribute('translate', 'no');
}

export function getThemeAwareProviderIcon(provider) {
  return getProviderIcon(provider);
}

export function isDarkThemeActive() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function getDropdownThemePalette() {
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

export function refreshThemeAwareProviderIcons() {
  document.querySelectorAll('img[data-provider-id]').forEach((img) => {
    const provider = getProviderById(img.dataset.providerId);
    if (!provider) return;
    img.src = getThemeAwareProviderIcon(provider);
  });
}
