import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  panels: [
    { id: 'panel-zhipu', providerId: 'zhipu', contentScriptReachable: true, iframe: { contentWindow: {} } },
    { id: 'panel-wenxin', providerId: 'wenxin', contentScriptReachable: false, iframe: { contentWindow: {} } },
  ],
  postToPanelIframe: vi.fn(),
}));

vi.mock('../aichatmerge-panel/modules/panel-postmessage.js', () => ({
  postToPanelIframe: mocks.postToPanelIframe,
}));
vi.mock('../aichatmerge-panel/modules/state.js', () => ({
  getPanels: vi.fn(() => mocks.panels),
}));
vi.mock('../aichatmerge-panel/modules/send-pipeline.js', () => ({
  getNonMergePanels: vi.fn(() => mocks.panels),
}));
vi.mock('../modules/providers.js', () => ({
  getProviderById: vi.fn(id => ({ id, name: id === 'zhipu' ? '智谱清言' : '文心一言' })),
}));

describe('answer extraction from reachable panels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.panels.splice(0, mocks.panels.length,
      { id: 'panel-zhipu', providerId: 'zhipu', contentScriptReachable: true, iframe: { contentWindow: {} } },
      { id: 'panel-wenxin', providerId: 'wenxin', contentScriptReachable: false, iframe: { contentWindow: {} } },
    );
  });

  it('starts immediately and does not wait for a panel already known to be unreachable', async () => {
    const { extractAllAnswers, handleExtractedAnswer } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const extraction = extractAllAnswers({
      timeoutMs: 2500,
      excludeUnreachablePanels: true,
    });

    const requests = mocks.postToPanelIframe.mock.calls
      .map(([panel, message]) => ({ panel, message }))
      .filter(({ message }) => message.type === 'EXTRACT_ANSWER');
    expect(requests).toHaveLength(1);
    expect(requests[0].panel.id).toBe('panel-zhipu');

    handleExtractedAnswer({
      type: 'EXTRACTED_ANSWER',
      context: 'multi-panel-answer',
      requestId: requests[0].message.requestId,
      panelId: 'panel-zhipu',
      provider: 'zhipu',
      answer: '可用于融合的回答',
    });

    await expect(extraction).resolves.toEqual([
      { providerId: 'zhipu', providerName: '智谱清言', answer: '可用于融合的回答' },
    ]);
  });

  it('marks a Kimi capacity response as responded but excludes it from merge answers', async () => {
    mocks.panels.splice(0, mocks.panels.length,
      { id: 'panel-kimi', providerId: 'kimi', contentScriptReachable: true, iframe: { contentWindow: {} } },
    );
    const { extractAllAnswers, handleExtractedAnswer } = await import('../aichatmerge-panel/modules/answer-extractor.js');
    const extraction = extractAllAnswers({
      timeoutMs: 2500,
      excludeUnreachablePanels: true,
    });
    const request = mocks.postToPanelIframe.mock.calls
      .map(([, message]) => message)
      .find(message => message.type === 'EXTRACT_ANSWER');

    handleExtractedAnswer({
      type: 'EXTRACTED_ANSWER',
      context: 'multi-panel-answer',
      requestId: request.requestId,
      panelId: 'panel-kimi',
      provider: 'kimi',
      answer: '不好意思，刚刚和Kimi聊的人太多了。高峰期算力不足，请耐心等待。',
    });

    await expect(extraction).resolves.toEqual([]);
  });
});
