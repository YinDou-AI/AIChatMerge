import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROVIDER_IDS,
  LEGACY_DEFAULT_PROVIDER_IDS,
  migrateEnabledProvidersOnUpdate,
} from '../modules/provider-defaults.js';

describe('provider defaults', () => {
  it('appends doubao to the current default provider list', () => {
    expect(DEFAULT_PROVIDER_IDS).toEqual([
      'chatgpt',
      'claude',
      'gemini',
      'grok',
      'deepseek',
      'kimi',
      'google',
      'doubao',
    ]);
    expect(LEGACY_DEFAULT_PROVIDER_IDS).not.toContain('doubao');
  });

  it('migrates untouched legacy defaults to include doubao', () => {
    expect(
      migrateEnabledProvidersOnUpdate(LEGACY_DEFAULT_PROVIDER_IDS, LEGACY_DEFAULT_PROVIDER_IDS)
    ).toEqual({
      enabledProviders: DEFAULT_PROVIDER_IDS,
      providerOrder: DEFAULT_PROVIDER_IDS,
    });
  });

  it('migrates missing provider settings as untouched defaults', () => {
    expect(migrateEnabledProvidersOnUpdate(null, null)).toEqual({
      enabledProviders: DEFAULT_PROVIDER_IDS,
      providerOrder: DEFAULT_PROVIDER_IDS,
    });
  });

  it('preserves customized provider order while appending doubao for legacy-enabled users', () => {
    expect(
      migrateEnabledProvidersOnUpdate(LEGACY_DEFAULT_PROVIDER_IDS, ['claude', 'chatgpt', 'gemini'])
    ).toEqual({
      enabledProviders: DEFAULT_PROVIDER_IDS,
      providerOrder: ['claude', 'chatgpt', 'gemini', 'grok', 'deepseek', 'kimi', 'google', 'doubao'],
    });
  });

  it('does not override customized enabled providers', () => {
    expect(
      migrateEnabledProvidersOnUpdate(['chatgpt', 'claude'], LEGACY_DEFAULT_PROVIDER_IDS)
    ).toBeNull();
  });
});
