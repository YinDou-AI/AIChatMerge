// metaso-sidebar.js — 秘塔侧边栏折叠与 textarea 注入
// 日志前缀：text-injection:metaso

import { detectProvider } from './detection.js';
import { isVisibleElement, getElementAccessibleText, isElementEnabled } from './dom-utils.js';

export function findMetasoSidebarContainer() {
  const candidates = document.querySelectorAll('.left-menu, [class*="LeftMenu_menu-container"]');
  for (const candidate of candidates) {
    if (!isVisibleElement(candidate)) {
      continue;
    }

    const rect = typeof candidate.getBoundingClientRect === 'function'
      ? candidate.getBoundingClientRect()
      : null;

    if (rect && rect.width >= 40 && rect.height >= 200) {
      return candidate;
    }
  }

  return null;
}

export function isMetasoSidebarCollapsed(container = findMetasoSidebarContainer()) {
  if (!container) {
    return false;
  }

  const className = typeof container.className === 'string'
    ? container.className
    : String(container.className || '');

  if (className.includes('LeftMenu_collapse')) {
    return true;
  }

  const rect = typeof container.getBoundingClientRect === 'function'
    ? container.getBoundingClientRect()
    : null;

  return !!rect && rect.width > 0 && rect.width <= 80;
}

export function findMetasoSidebarToggleButton(container = findMetasoSidebarContainer()) {
  if (!container) {
    return null;
  }

  const candidates = [
    ...container.querySelectorAll('button, [role="button"], [class*="LeftMenu_sidebar-action"]'),
    ...document.querySelectorAll('[class*="LeftMenu_sidebar-action"]')
  ];

  for (const candidate of candidates) {
    if (!isVisibleElement(candidate) || !isElementEnabled(candidate)) {
      continue;
    }

    const rect = typeof candidate.getBoundingClientRect === 'function'
      ? candidate.getBoundingClientRect()
      : null;

    if (!rect) {
      continue;
    }

    const text = getElementAccessibleText(candidate);
    if (text.includes('删除') || text.includes('delete') || text.includes('关闭')) {
      continue;
    }

    if (rect.top <= 80 && rect.width <= 48 && rect.height <= 48) {
      return candidate;
    }
  }

  return null;
}

export function collapseMetasoSidebarIfNeeded() {
  const container = findMetasoSidebarContainer();
  if (!container) {
    return false;
  }

  if (isMetasoSidebarCollapsed(container)) {
    return true;
  }

  const toggleButton = findMetasoSidebarToggleButton(container);
  if (!toggleButton) {
    return false;
  }

  toggleButton.click();
  return false;
}

export function initMetasoSidebarAutoCollapse() {
  if (detectProvider() !== 'metaso' || window.__panelizeMetasoSidebarAutoCollapseStarted) {
    return;
  }

  window.__panelizeMetasoSidebarAutoCollapseStarted = true;

  const MAX_RUNTIME_MS = 15000;
  const startTime = Date.now();
  let retryTimerId = null;
  let observer = null;

  const cleanup = () => {
    if (typeof retryTimerId === 'number') {
      clearTimeout(retryTimerId);
      retryTimerId = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const attemptCollapse = () => {
    if (collapseMetasoSidebarIfNeeded()) {
      cleanup();
      return;
    }

    if (Date.now() - startTime >= MAX_RUNTIME_MS) {
      cleanup();
      return;
    }

    if (typeof retryTimerId !== 'number') {
      retryTimerId = setTimeout(() => {
        retryTimerId = null;
        attemptCollapse();
      }, 400);
    }
  };

  observer = new MutationObserver(() => {
    attemptCollapse();
  });

  const observeTarget = document.body || document.documentElement;
  if (observeTarget) {
    observer.observe(observeTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden']
    });
  }

  attemptCollapse();
}

export function injectTextIntoMetasoTextarea(element, text) {
  try {
    element.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(element, text);
    } else {
      element.value = text;
    }

    element.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    }));
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return element.value === text;
  } catch (error) {
    console.warn('[Text Injection] Metaso textarea injection failed:', error);
    return false;
  }
}
