import { describe, expect, it } from 'vitest';
import {
  buildGoogleSearchFillValue,
  DEFAULT_GOOGLE_PROVIDER_MODE,
  getGoogleProviderModeLabel,
  getGoogleProviderUrl,
  GOOGLE_PROVIDER_MODE_AI,
  GOOGLE_PROVIDER_MODE_SEARCH,
  normalizeGoogleProviderMode,
} from '../modules/google-mode.js';

describe('google-mode helpers', () => {
  it('defaults to AI mode', () => {
    expect(DEFAULT_GOOGLE_PROVIDER_MODE).toBe(GOOGLE_PROVIDER_MODE_AI);
    expect(normalizeGoogleProviderMode(undefined)).toBe(GOOGLE_PROVIDER_MODE_AI);
    expect(normalizeGoogleProviderMode('unexpected')).toBe(GOOGLE_PROVIDER_MODE_AI);
  });

  it('resolves the correct Google URL for each mode', () => {
    expect(getGoogleProviderUrl(GOOGLE_PROVIDER_MODE_AI)).toBe('https://www.google.com/search?udm=50');
    expect(getGoogleProviderUrl(GOOGLE_PROVIDER_MODE_SEARCH)).toBe('https://www.google.com/');
  });

  it('builds search fill values by replacing on the first fill', () => {
    expect(buildGoogleSearchFillValue('old query', 'new query', true)).toBe('new query');
  });

  it('builds search fill values by appending after the first fill', () => {
    expect(buildGoogleSearchFillValue('first query', 'second query', false)).toBe('first querysecond query');
  });

  it('returns stable labels for dropdown controls', () => {
    expect(getGoogleProviderModeLabel(GOOGLE_PROVIDER_MODE_AI)).toBe('AI Mode');
    expect(getGoogleProviderModeLabel(GOOGLE_PROVIDER_MODE_SEARCH)).toBe('Search');
  });
});
