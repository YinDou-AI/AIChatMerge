// dom-utils.js — DOM 查询与可见性工具
// 日志前缀：text-injection:dom

let isExtractMode = false;
export function setExtractMode(value) { isExtractMode = value; }
export function getExtractMode() { return isExtractMode; }

export function isSlateEditor(element) {
  return element && (
    element.getAttribute('data-slate-editor') === 'true' ||
    element.getAttribute('data-slate-editor') === ''
  );
}

export function isVisibleElement(element, { ignoreViewport = false } = {}) {
  if (!element) return false;
  if (isExtractMode) return true;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  const rect = typeof element.getBoundingClientRect === 'function'
    ? element.getBoundingClientRect()
    : null;

  if (!rect) {
    return true;
  }

  if (rect.width === 0 && rect.height === 0) {
    return false;
  }

  // 答案容器可以位于小 iframe 的可视区域之外（页面未滚动到底），
  // 完成监控测量答案长度时用 ignoreViewport 跳过这个检查
  if (ignoreViewport) return true;

  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || Number.POSITIVE_INFINITY;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || Number.POSITIVE_INFINITY;

  return Boolean(
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < viewportHeight &&
    rect.left < viewportWidth
  );
}

export function findFirstVisibleElement(selectors) {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (isVisibleElement(element)) {
          return element;
        }
      }
    } catch (error) {
      console.warn('[Text Injection] Error finding visible element with selector:', selector, error);
    }
  }

  return null;
}

export function getElementAccessibleText(element) {
  return [
    element?.getAttribute?.('aria-label') || '',
    element?.getAttribute?.('title') || '',
    element?.textContent || ''
  ]
    .join(' ')
    .trim()
    .toLowerCase();
}

export function findDeepFirstVisibleElement(selectors) {
  for (const selector of selectors) {
    try {
      const elements = querySelectorAllDeep(selector);
      for (const element of elements) {
        if (isVisibleElement(element)) {
          return element;
        }
      }
    } catch (error) {
      console.warn('[Text Injection] Error finding deep visible element with selector:', selector, error);
    }
  }

  return null;
}

export function findDeepClickableElementByKeywords(keywords) {
  const loweredKeywords = keywords.map(keyword => keyword.toLowerCase());
  const candidates = querySelectorAllDeep('button, [role="button"], [role="menuitem"], label');

  for (const candidate of candidates) {
    if (!isVisibleElement(candidate)) {
      continue;
    }

    const searchableText = getElementAccessibleText(candidate);
    if (loweredKeywords.some(keyword => searchableText.includes(keyword))) {
      return candidate;
    }
  }

  return null;
}

export function querySelectorDeep(selector, root = document) {
  // Try to find in current root element
  const element = root.querySelector(selector);
  if (element) return element;

  // Recursively search all shadow DOM
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const found = querySelectorDeep(selector, el.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

export function querySelectorAllDeep(selector, root = document) {
  const elements = [...root.querySelectorAll(selector)];
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      elements.push(...querySelectorAllDeep(selector, el.shadowRoot));
    }
  }
  return elements;
}

export function findTextInputElement(selector) {
  if (!selector || typeof selector !== 'string') {
    return null;
  }

  try {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (isVisibleElement(element)) {
        return element;
      }
    }
    return elements[0] || null;
  } catch (error) {
    console.error('Error finding element:', error);
    return null;
  }
}

export function isElementEnabled(element) {
  return Boolean(
    element &&
    !element.disabled &&
    element.getAttribute('aria-disabled') !== 'true'
  );
}

export function pressEnter(element) {
  if (!element) return false;
  element.focus();
  const events = [
    new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
    new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
    new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })
  ];
  events.forEach(event => element.dispatchEvent(event));
  return true;
}
