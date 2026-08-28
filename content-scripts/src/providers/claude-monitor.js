// claude-monitor.js — Claude 不可用模型检测
// 日志前缀：text-injection:claude

import { detectProvider } from './detection.js';
import { postToExtensionParent } from './messaging.js';

// 从源文件提取的常量
const CLAUDE_UNAVAILABLE_CONTEXT = 'claude-entry-warning';
const CLAUDE_UNAVAILABLE_REQUIRED_PATTERNS = [
  /This model isn't available right now/i,
  /You can switch to another model to continue using Claude/i
];
const CLAUDE_UNAVAILABLE_CONTEXT_PATTERNS = [
  /claude-3-5-haiku-latest/i
];
const CLAUDE_UNAVAILABLE_CHECK_TIMEOUT_MS = 20000;

// 模块级状态
let claudeUnavailableWarningPosted = false;
let claudeUnavailableObserverStarted = false;

export function getClaudeUnavailableMatch() {
  const text = document.body?.innerText || '';
  const hasUnavailableMessage = CLAUDE_UNAVAILABLE_REQUIRED_PATTERNS
    .every(pattern => pattern.test(text));
  if (!hasUnavailableMessage) return '';

  return CLAUDE_UNAVAILABLE_CONTEXT_PATTERNS
    .concat(CLAUDE_UNAVAILABLE_REQUIRED_PATTERNS)
    .map(pattern => {
      const match = text.match(pattern);
      return match ? match[0] : null;
    })
    .find(Boolean) || '';
}

export function maybePostClaudeUnavailableWarning() {
  if (claudeUnavailableWarningPosted || detectProvider() !== 'claude') return true;
  const matchedText = getClaudeUnavailableMatch();
  if (!matchedText) return false;

  claudeUnavailableWarningPosted = true;
  postToExtensionParent({
    type: 'CLAUDE_ENTRY_WARNING',
    provider: 'claude',
    reason: 'unavailable-model',
    matchedText,
    context: CLAUDE_UNAVAILABLE_CONTEXT
  });
  return true;
}

export function startClaudeUnavailableWarningMonitor() {
  if (claudeUnavailableObserverStarted || detectProvider() !== 'claude') return;
  claudeUnavailableObserverStarted = true;

  const startedAt = Date.now();
  let observer = null;

  const stop = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const check = () => {
    if (maybePostClaudeUnavailableWarning() || Date.now() - startedAt > CLAUDE_UNAVAILABLE_CHECK_TIMEOUT_MS) {
      stop();
    }
  };

  const start = () => {
    check();
    if (!document.body || claudeUnavailableWarningPosted) return;
    observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
    setTimeout(start, 1200);
  } else {
    start();
  }

  setTimeout(stop, CLAUDE_UNAVAILABLE_CHECK_TIMEOUT_MS + 1000);
}
