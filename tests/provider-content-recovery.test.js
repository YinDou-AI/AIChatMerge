import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/messaging.js', () => ({ notifyMessage: vi.fn(() => Promise.resolve()) }));
vi.mock('../modules/i18n.js', () => ({
  t: vi.fn(key => key),
  initializeLanguage: vi.fn(() => Promise.resolve()),
}));

describe('provider content-script recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    global.chrome = {
      runtime: {
        onMessage: { addListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        getURL: vi.fn(path => `chrome-extension://test/${path}`),
      },
      storage: {
        sync: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
        session: { set: vi.fn(() => Promise.resolve()) },
        local: { set: vi.fn(() => Promise.resolve()) },
        onChanged: { addListener: vi.fn() },
      },
      contextMenus: {
        removeAll: vi.fn(() => Promise.resolve()),
        create: vi.fn(),
        onClicked: { addListener: vi.fn() },
      },
      action: { onClicked: { addListener: vi.fn() } },
      commands: { onCommand: { addListener: vi.fn() } },
      tabs: {
        create: vi.fn(() => Promise.resolve()),
        sendMessage: vi.fn(() => Promise.resolve()),
      },
      windows: {
        getAll: vi.fn(() => Promise.resolve([])),
        update: vi.fn(() => Promise.resolve()),
        create: vi.fn(() => Promise.resolve()),
      },
      scripting: {
        executeScript: vi.fn(options => Promise.resolve(
          options.target?.allFrames
            ? [
                { frameId: 0, result: 'chrome-extension://test' },
                { frameId: 7, result: 'https://chat.baidu.com' },
                { frameId: 8, result: 'https://chatglm.cn' },
              ]
            : []
        )),
      },
    };
  });

  it('injects only into the Wenxin frame in the current extension tab', async () => {
    const { recoverProviderContentScript } = await import('../background/service-worker.js');

    await expect(recoverProviderContentScript(
      { providerId: 'wenxin' },
      { tab: { id: 42 } }
    )).resolves.toEqual({ success: true, frameCount: 1 });

    expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(1, {
      target: { tabId: 42, allFrames: true },
      func: expect.any(Function),
    });
    expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(2, {
      target: { tabId: 42, frameIds: [7] },
      files: ['content-scripts/text-injection-all-providers.js'],
    });
  });

  it('refuses unsupported providers', async () => {
    const { recoverProviderContentScript } = await import('../background/service-worker.js');
    await expect(recoverProviderContentScript(
      { providerId: 'zhipu' },
      { tab: { id: 42 } }
    )).resolves.toEqual({ success: false, reason: 'unsupported-provider' });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('reports when the scripting probe cannot see a Wenxin frame', async () => {
    chrome.scripting.executeScript.mockResolvedValueOnce([
      { frameId: 0, result: 'chrome-extension://test' },
      { frameId: 8, result: 'https://chatglm.cn' },
    ]);
    const { recoverProviderContentScript } = await import('../background/service-worker.js');

    await expect(recoverProviderContentScript(
      { providerId: 'wenxin' },
      { tab: { id: 42 } }
    )).resolves.toEqual({ success: false, reason: 'provider-frame-not-found' });

    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
  });
});
