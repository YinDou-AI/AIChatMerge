import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  exportScoreHistory,
  saveScoreHistory
} from '../modules/score-manager.js';

describe('score-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:score-csv');
    global.URL.revokeObjectURL = vi.fn();
    global.chrome = {
      runtime: {},
      storage: {
        local: {
          data: {},
          get: vi.fn(async (defaults) => ({
            ...defaults,
            ...global.chrome.storage.local.data
          })),
          set: vi.fn(async (value) => {
            global.chrome.storage.local.data = {
              ...global.chrome.storage.local.data,
              ...value
            };
          })
        }
      },
      downloads: {
        download: vi.fn((options, callback) => callback(42))
      }
    };
  });

  it('exports score history csv without asking the user to choose a folder', async () => {
    await saveScoreHistory('问题', [{ model: 'DeepSeek', score: 9 }], '2026-07-07T10:30:00.000Z');

    const result = await exportScoreHistory();

    expect(result.fileName).toMatch(/^AIChatMerge\/scores\/aichatmerge-scores-\d+\.csv$/);
    expect(result.csv).toContain('DeepSeek,9');
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'blob:score-csv',
        filename: result.fileName,
        saveAs: false,
        conflictAction: 'uniquify'
      }),
      expect.any(Function)
    );
  });
});
