// Terminal provider responses are completed requests that contain no usable
// model answer. Keep their text contracts shared by completion and extraction.

const TERMINAL_RESPONSE_PATTERNS = Object.freeze({
  kimi: Object.freeze([
    '刚刚和Kimi聊的人太多了',
    'Kimi有点累了',
    '高峰期算力不足'
  ])
});

export function getProviderTerminalResponseSignature(provider, text) {
  const patterns = TERMINAL_RESPONSE_PATTERNS[provider] || [];
  const source = String(text || '');
  const hits = [];

  for (const pattern of patterns) {
    const count = source.split(pattern).length - 1;
    if (count > 0) hits.push(`${pattern}:${count}`);
  }

  return hits.join('|');
}

export function isTerminalProviderResponse(provider, text) {
  return Boolean(getProviderTerminalResponseSignature(provider, text));
}
