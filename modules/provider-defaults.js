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
  'deepseek',
  'kimi',
  'doubao',
  'qianwen',
  'zhipu',
  'wenxin',
  // 'yuanbao',
  'metaso',
  'chatgpt',
  'gemini',
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
    arraysContainSameIds(nextEnabledProviders, LEGACY_DEFAULT_PROVIDER_IDS);

  if (!enabledProvidersAreLegacyDefault) {
    return null;
  }

  const migratedProviderIds = buildMigratedProviderOrder(nextProviderOrder || nextEnabledProviders);

  return {
    enabledProviders: migratedProviderIds,
    providerOrder: migratedProviderIds,
  };
}

function arraysContainSameIds(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  const leftIds = new Set(left);
  const rightIds = new Set(right);
  return leftIds.size === rightIds.size && left.every((value) => rightIds.has(value));
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
