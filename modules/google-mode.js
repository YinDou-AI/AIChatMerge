/**
 * Shared Google provider mode helpers.
 */

export const GOOGLE_PROVIDER_MODE_AI = 'ai';
export const GOOGLE_PROVIDER_MODE_SEARCH = 'search';
export const DEFAULT_GOOGLE_PROVIDER_MODE = GOOGLE_PROVIDER_MODE_AI;

/**
 * Normalize an arbitrary mode value to a supported Google provider mode.
 * @param {string | null | undefined} mode
 * @returns {'ai' | 'search'}
 */
export function normalizeGoogleProviderMode(mode) {
  return mode === GOOGLE_PROVIDER_MODE_SEARCH
    ? GOOGLE_PROVIDER_MODE_SEARCH
    : GOOGLE_PROVIDER_MODE_AI;
}

/**
 * Resolve the iframe URL for the given Google provider mode.
 * @param {string | null | undefined} mode
 * @returns {string}
 */
export function getGoogleProviderUrl(mode) {
  return normalizeGoogleProviderMode(mode) === GOOGLE_PROVIDER_MODE_SEARCH
    ? 'https://www.google.com/'
    : 'https://www.google.com/search?udm=50';
}

/**
 * Build the next Google Search query string for a Fill action.
 * @param {string} currentValue
 * @param {string} nextText
 * @param {boolean} replaceOnNextFill
 * @returns {string}
 */
export function buildGoogleSearchFillValue(currentValue, nextText, replaceOnNextFill) {
  const normalizedCurrent = (currentValue || '').trim();
  const normalizedNext = (nextText || '').trim();

  if (!normalizedNext) {
    return normalizedCurrent;
  }

  if (replaceOnNextFill || !normalizedCurrent) {
    return normalizedNext;
  }

  return `${normalizedCurrent}${normalizedNext}`.trim();
}

/**
 * Get the label used by Google mode dropdowns.
 * @param {string | null | undefined} mode
 * @returns {string}
 */
export function getGoogleProviderModeLabel(mode) {
  return normalizeGoogleProviderMode(mode) === GOOGLE_PROVIDER_MODE_SEARCH
    ? 'Search'
    : 'AI Mode';
}
