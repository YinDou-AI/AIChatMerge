import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { maybeRunSelfTest } from '../aichatmerge-panel/modules/self-test-driver.js';

function installChromeMock() {
  const localData = { aichatmergeDebugLogs: [] };
  const syncData = {};
  globalThis.chrome = {
    storage: {
      local: {
        get: async defaults => ({ ...defaults, ...localData }),
        set: async values => { Object.assign(localData, values); },
        remove: key => { delete localData[key]; }
      },
      sync: {
        get: async defaults => ({ ...defaults, ...syncData }),
        set: async values => { Object.assign(syncData, values); }
      },
      onChanged: { addListener: () => {} }
    },
    downloads: {
      download: vi.fn((options, callback) => callback(42))
    },
    runtime: {
      getManifest: () => ({ version: 'test' }),
      lastError: undefined
    }
  };
  globalThis.__chromeMock = { localData, syncData };
}

describe('self-test-driver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installChromeMock();
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => {};
    window.sessionStorage.clear();
    document.body.innerHTML = `
      <textarea id="unified-input"></textarea>
      <button id="send-all-btn"></button>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete globalThis.chrome;
  });

  it('does nothing without the selftest hash', () => {
    window.happyDOM.setURL('chrome-extension://ext/aichatmerge-panel/multi-panel.html');
    expect(maybeRunSelfTest()).toBe(false);
  });

  it('fills the composer, clicks send, then exports the debug log', async () => {
    window.happyDOM.setURL(
      'chrome-extension://ext/aichatmerge-panel/multi-panel.html#selftest=1&prompt=hello&sendDelay=100&exportDelay=200'
    );
    const sendBtn = document.getElementById('send-all-btn');
    const clickSpy = vi.spyOn(sendBtn, 'click');

    expect(maybeRunSelfTest()).toBe(true);
    // hash 触发后即撤防，防止刷新重复执行
    expect(window.location.hash).toBe('');

    await vi.advanceTimersByTimeAsync(100);
    expect(document.getElementById('unified-input').value).toBe('hello');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(globalThis.__chromeMock.syncData.debugAutoDownloadLogs).toBe(true);
    expect(globalThis.__chromeMock.localData.aichatmergeTestIntent.expect).toBe('send-success');

    await vi.advanceTimersByTimeAsync(300);
    expect(chrome.downloads.download).toHaveBeenCalledTimes(1);
    expect(chrome.downloads.download.mock.calls[0][0].filename).toMatch(/^aichatmerge-debug-.*\.json$/);
  });

  it('runs only once even if called again', () => {
    window.happyDOM.setURL('chrome-extension://ext/aichatmerge-panel/multi-panel.html#selftest=1&sendDelay=100');
    expect(maybeRunSelfTest()).toBe(true);
    expect(maybeRunSelfTest()).toBe(false);
  });
});
