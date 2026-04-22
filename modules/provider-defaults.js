export const LEGACY_DEFAULT_PROVIDER_IDS = [
  'chatgpt',
  'claude',
  'gemini',
  'grok',
  'deepseek',
  'kimi',
  'google',
];

export const DEFAULT_PROVIDER_IDS = [
  ...LEGACY_DEFAULT_PROVIDER_IDS,
  'doubao',
];

export function migrateEnabledProvidersOnUpdate(enabledProviders, providerOrder) {
  const nextEnabledProviders = Array.isArray(enabledProviders)
    ? [...enabledProviders]
    : null;
  const nextProviderOrder = Array.isArray(providerOrder)
    ? [...providerOrder]
    : null;

  const enabledProvidersAreLegacyDefault =
    nextEnabledProviders === null ||
    arraysMatchExactly(nextEnabledProviders, LEGACY_DEFAULT_PROVIDER_IDS);

  if (!enabledProvidersAreLegacyDefault) {
    return null;
  }

  const migratedEnabledProviders = DEFAULT_PROVIDER_IDS;
  const migratedProviderOrder = buildMigratedProviderOrder(nextProviderOrder);

  return {
    enabledProviders: migratedEnabledProviders,
    providerOrder: migratedProviderOrder,
  };
}

function arraysMatchExactly(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildMigratedProviderOrder(providerOrder) {
  if (!Array.isArray(providerOrder) || providerOrder.length === 0) {
    return DEFAULT_PROVIDER_IDS;
  }

  const filteredExistingOrder = providerOrder.filter((providerId) =>
    LEGACY_DEFAULT_PROVIDER_IDS.includes(providerId)
  );
  const uniqueExistingOrder = [...new Set(filteredExistingOrder)];
  const missingLegacyProviders = LEGACY_DEFAULT_PROVIDER_IDS.filter(
    (providerId) => !uniqueExistingOrder.includes(providerId)
  );

  return [...uniqueExistingOrder, ...missingLegacyProviders, 'doubao'];
}
