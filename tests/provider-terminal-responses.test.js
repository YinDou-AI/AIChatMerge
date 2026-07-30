import { describe, expect, it } from 'vitest';
import {
  getProviderTerminalResponseSignature,
  isTerminalProviderResponse,
} from '../modules/provider-terminal-responses.js';

describe('provider terminal responses', () => {
  it('classifies the Kimi capacity response as terminal', () => {
    const text = '不好意思，刚刚和Kimi聊的人太多了。高峰期算力不足，请耐心等待。';

    expect(isTerminalProviderResponse('kimi', text)).toBe(true);
    expect(getProviderTerminalResponseSignature('kimi', text))
      .toContain('高峰期算力不足:1');
  });

  it('does not classify a regular Kimi answer or another provider', () => {
    expect(isTerminalProviderResponse('kimi', '这是正常回答')).toBe(false);
    expect(isTerminalProviderResponse('zhipu', '高峰期算力不足')).toBe(false);
  });
});
