import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROVIDER_IDS,
  LEGACY_DEFAULT_PROVIDER_IDS,
  migrateEnabledProvidersOnUpdate,
} from '../modules/provider-defaults.js';

describe('provider defaults', () => {
  it('defines the current default provider list', () => {
    expect(DEFAULT_PROVIDER_IDS).toEqual([
      'deepseek',
      'kimi',
      'doubao',
      'qianwen',
      'zhipu',
      'wenxin',
      'yuanbao',
      'metaso',
      'chatgpt',
      'gemini',
      'claude',
      'grok',
    ]);
    expect(LEGACY_DEFAULT_PROVIDER_IDS).not.toContain('doubao');
  });

  it('migrates untouched legacy defaults to the current provider list', () => {
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

  it('preserves customized provider order while appending current providers for legacy-enabled users', () => {
    expect(
      migrateEnabledProvidersOnUpdate(LEGACY_DEFAULT_PROVIDER_IDS, ['claude', 'chatgpt', 'gemini'])
    ).toEqual({
      enabledProviders: ['claude', 'chatgpt', 'gemini', ...DEFAULT_PROVIDER_IDS.filter((id) => !['claude', 'chatgpt', 'gemini'].includes(id))],
      providerOrder: ['claude', 'chatgpt', 'gemini', ...DEFAULT_PROVIDER_IDS.filter((id) => !['claude', 'chatgpt', 'gemini'].includes(id))],
    });
  });

  it('migrates reordered legacy defaults while preserving the user order', () => {
    expect(
      migrateEnabledProvidersOnUpdate(
        ['claude', 'chatgpt', 'gemini', 'grok', 'deepseek', 'kimi', 'google'],
        null
      )
    ).toEqual({
      enabledProviders: ['claude', 'chatgpt', 'gemini', 'grok', 'deepseek', 'kimi', 'doubao', 'qianwen', 'zhipu', 'wenxin', 'yuanbao', 'metaso'],
      providerOrder: ['claude', 'chatgpt', 'gemini', 'grok', 'deepseek', 'kimi', 'doubao', 'qianwen', 'zhipu', 'wenxin', 'yuanbao', 'metaso'],
    });
  });

  it('does not override customized enabled providers', () => {
    expect(
      migrateEnabledProvidersOnUpdate(['chatgpt', 'claude'], LEGACY_DEFAULT_PROVIDER_IDS)
    ).toBeNull();
  });

  it('does not migrate duplicate legacy provider lists that are missing a default provider', () => {
    expect(
      migrateEnabledProvidersOnUpdate(
        ['chatgpt', 'chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'kimi'],
        null
      )
    ).toBeNull();
  });
});
