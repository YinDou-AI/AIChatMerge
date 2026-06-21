export const CLAUDE_CUSTOM_ENTRY_URL_KEY = 'claudeCustomEntryUrl';
export const DEFAULT_CLAUDE_ENTRY_URL = 'https://claude.ai/new';

/**
 * Validate a user-supplied Claude entry URL without changing its meaningful
 * path/query. An empty value intentionally means "use the default entry".
 */
export function normalizeClaudeCustomEntryUrl(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) {
    return { valid: true, value: '' };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, value: '', error: '请输入完整的网址，例如 https://claude.ai/chat/…' };
  }

  const host = url.hostname.toLowerCase();
  const isClaudeHost = host === 'claude.ai' || host.endsWith('.claude.ai');
  if (url.protocol !== 'https:' || !isClaudeHost || url.username || url.password) {
    return { valid: false, value: '', error: '仅支持 https://claude.ai/ 下的网址。' };
  }

  url.hash = '';
  return { valid: true, value: url.href };
}

export async function getClaudeCustomEntryUrl() {
  try {
    const result = await chrome.storage.local.get({ [CLAUDE_CUSTOM_ENTRY_URL_KEY]: '' });
    const normalized = normalizeClaudeCustomEntryUrl(result[CLAUDE_CUSTOM_ENTRY_URL_KEY]);
    return normalized.valid ? normalized.value : '';
  } catch (error) {
    console.warn('[Claude entry] Unable to read custom entry URL:', error);
    return '';
  }
}

export async function saveClaudeCustomEntryUrl(rawValue) {
  const normalized = normalizeClaudeCustomEntryUrl(rawValue);
  if (!normalized.valid) {
    return normalized;
  }

  try {
    await chrome.storage.local.set({ [CLAUDE_CUSTOM_ENTRY_URL_KEY]: normalized.value });
    return normalized;
  } catch (error) {
    console.error('[Claude entry] Unable to save custom entry URL:', error);
    return { valid: false, value: '', error: '保存失败，请重新加载扩展后再试。' };
  }
}
