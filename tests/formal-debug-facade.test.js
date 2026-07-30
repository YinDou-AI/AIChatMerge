import { describe, expect, it, vi } from 'vitest';

import * as formalDebug from '../aichatmerge-panel/modules/debug-log.release.js';

describe('formal release debug facade', () => {
  it('preserves the business-facing API without touching browser services', async () => {
    const storageGet = vi.fn();
    const storageSet = vi.fn();
    const download = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        local: { get: storageGet, set: storageSet },
        sync: { get: storageGet },
        onChanged: { addListener: vi.fn() }
      },
      downloads: { download }
    });

    expect(formalDebug.rotateDebugSession()).toBe('diagnostics-disabled');
    expect(formalDebug.getDebugSessionId()).toBe('diagnostics-disabled');
    expect(formalDebug.getPanelDebugInfo({ id: 'panel-1' })).toBeNull();

    await formalDebug.recordDebugLog('panel-submit:success', { prompt: 'private' });
    await formalDebug.downloadDebugLogs();
    await formalDebug.clearDebugLogs();
    await formalDebug.getDebugLogWriteQueue();

    expect(storageGet).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
