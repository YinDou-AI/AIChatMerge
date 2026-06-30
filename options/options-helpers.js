/**
 * Options page pure helper functions
 * Extracted from options.js for testability
 */

/**
 * Get browser's current language in our supported format
 * @returns {'zh_CN' | 'en'}
 */
export function getCurrentBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage || 'en';
  // Map browser language codes to our supported locales
  if (browserLang.startsWith('zh')) {
    return 'zh_CN';
  }
  return 'en';
}

/**
 * Check if the browser is Edge
 * @returns {boolean}
 */
export function isEdgeBrowser() {
  const uaData = navigator.userAgentData;
  if (uaData && Array.isArray(uaData.brands)) {
    return uaData.brands.some(brand => /Edge/i.test(brand.brand));
  }
  return navigator.userAgent.includes('Edg/');
}

/**
 * Get extension resource URL
 * @param {string} path - Resource path
 * @returns {string}
 */
export function getExtensionResourceUrl(path) {
  if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return new URL(path, `${window.location.origin}/`).href;
}

/**
 * Get prompt guide path based on locale
 * @param {string} locale - Language locale (e.g., 'en', 'zh_CN')
 * @returns {string}
 */
export function getPromptGuidePath(locale) {
  const guidePaths = {
    en: 'data/prompt-libraries/guide.en.html',
    zh_CN: 'data/prompt-libraries/guide.zh_CN.html'
  };

  return guidePaths[locale] || guidePaths.en;
}

/**
 * Format Claude custom entry URL for display
 * @param {string} url - The custom entry URL
 * @returns {string} Formatted display string
 */
export function formatClaudeEntryUrlForDisplay(url) {
  if (!url) return 'Using default Claude URL';
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 16
      ? `${parsed.pathname.slice(0, 12)}…${parsed.pathname.slice(-4)}`
      : parsed.pathname;
    return `Custom: ${parsed.hostname}${path}`;
  } catch {
    return 'Custom: Claude';
  }
}

/**
 * Get default prompt library path based on language
 * @param {string} language - Language code (e.g., 'zh_CN', 'en')
 * @returns {string}
 */
export function getDefaultLibraryPath(language) {
  // Only Simplified Chinese uses translated prompts
  // All other languages fall back to English
  if (language === 'zh_CN') {
    return 'data/prompt-libraries/default-prompts-zh_CN.json';
  }

  // Default to English for all other languages (including zh_TW)
  return 'data/prompt-libraries/default-prompts.json';
}

/**
 * Validate prompt structure against expected format
 * @param {Object} prompt - The prompt object to validate
 * @returns {string[]} Array of validation error messages (empty if valid)
 */
export function validatePromptStructure(prompt) {
  const errors = [];

  // Required fields
  if (!prompt.title || typeof prompt.title !== 'string') {
    errors.push('Missing or invalid "title" (string)');
  }
  if (!prompt.content || typeof prompt.content !== 'string') {
    errors.push('Missing or invalid "content" (string)');
  }
  if (!prompt.category || typeof prompt.category !== 'string') {
    errors.push('Missing or invalid "category" (string)');
  }

  // Tags should be array
  if (!Array.isArray(prompt.tags)) {
    errors.push('"tags" must be an array of strings');
  }

  // Variables should be array (can be empty)
  if (!Array.isArray(prompt.variables)) {
    errors.push('"variables" must be an array');
  }

  // Optional but typed fields
  if (prompt.isFavorite !== undefined && typeof prompt.isFavorite !== 'boolean') {
    errors.push('"isFavorite" should be boolean');
  }
  if (prompt.useCount !== undefined && typeof prompt.useCount !== 'number') {
    errors.push('"useCount" should be number');
  }
  if (prompt.lastUsed !== undefined && prompt.lastUsed !== null && typeof prompt.lastUsed !== 'number') {
    errors.push('"lastUsed" should be number or null');
  }

  return errors;
}

/**
 * Get example prompt structure as string
 * @returns {string}
 */
export function getPromptStructureExample() {
  return `Expected JSON structure (array of prompt objects):

[
  {
    "title": "Short descriptive title",
    "content": "Full prompt text. Use {variables} for placeholders.",
    "category": "Category name",
    "tags": ["tag1", "tag2"],
    "variables": ["variable1", "variable2"],
    "isFavorite": false,
    "useCount": 0,
    "lastUsed": null
  }
]

Required fields:
- title (string)
- content (string)
- category (string)
- tags (array of strings)
- variables (array of strings)

Optional fields:
- isFavorite (boolean, default: false)
- useCount (number, default: 0)
- lastUsed (number or null, default: null)`;
}
