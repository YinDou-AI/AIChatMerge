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
  'yuanbao',
  'metaso',
  'chatgpt',
  'gemini',
  'claude',
  'grok',
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

  const sourceOrder = nextProviderOrder || nextEnabledProviders;
  const migratedProviderIds = arraysHaveSameOrder(sourceOrder, LEGACY_DEFAULT_PROVIDER_IDS)
    ? DEFAULT_PROVIDER_IDS
    : buildMigratedProviderOrder(sourceOrder);

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
    DEFAULT_PROVIDER_IDS.includes(providerId)
  );
  const uniqueExistingOrder = [...new Set(filteredExistingOrder)];
  const missingDefaultProviders = DEFAULT_PROVIDER_IDS.filter(
    (providerId) => !uniqueExistingOrder.includes(providerId)
  );

  return [...uniqueExistingOrder, ...missingDefaultProviders];
}

function arraysHaveSameOrder(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((value, index) => value === right[index]);
}
