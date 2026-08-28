// dark-mode.js — iframe 暗色模式注入
// 日志前缀：text-injection:dark-mode

const DARK_CSS = [
  'html { filter: invert(1) hue-rotate(180deg); }',
  'img, video, svg { filter: invert(1) hue-rotate(180deg); }',
  'code, pre { filter: invert(1) hue-rotate(180deg); }'
].join('\n');

let styleEl = null;

function applyDarkMode(isDark) {
  if (isDark && !styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'aichatmerge-dark-mode';
    styleEl.textContent = DARK_CSS;
    document.documentElement.appendChild(styleEl);
  } else if (!isDark && styleEl) {
    styleEl.remove();
    styleEl = null;
  }
}

function resolveTheme(settings) {
  const theme = settings.theme || 'auto';
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function initDarkMode() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get({ theme: 'auto' }, (settings) => {
      applyDarkMode(resolveTheme(settings));
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.theme) {
        chrome.storage.sync.get({ theme: 'auto' }, (settings) => {
          applyDarkMode(resolveTheme(settings));
        });
      }
    });
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get({ theme: 'auto' }, (settings) => {
        if (settings.theme === 'auto') {
          applyDarkMode(resolveTheme(settings));
        }
      });
    }
  });
}
