import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCORE_HISTORY_KEY,
  buildScoreHistoryCsv,
  clearScoreHistory,
  exportScoreHistory,
  formatScoreTimestamp,
  getScoreHistory,
  saveScoreHistory
} from '../modules/score-manager.js';

describe('score-manager', () => {
  let localStore;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStore = {};
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:score-csv');
    global.URL.revokeObjectURL = vi.fn();
    globalThis.chrome = {
      runtime: {},
      storage: {
        local: {
          get: vi.fn(async defaults => ({ ...defaults, ...localStore })),
          set: vi.fn(async update => {
            localStore = { ...localStore, ...update };
          })
        }
      },
      downloads: {
        download: vi.fn((options, callback) => callback(42))
      }
    };
  });

  it('saves only valid score rows to local history', async () => {
    const saved = await saveScoreHistory('问题', [
      { model: 'DeepSeek', score: '9' },
      { model: '', score: 10 },
      { model: 'Kimi', score: 'bad' }
    ], '2026-07-03T10:30:00.000Z');

    expect(saved).toEqual({
      timestamp: '2026-07-03T10:30:00.000Z',
      question: '问题',
      scores: [{ model: 'DeepSeek', score: 9 }]
    });
    expect(await getScoreHistory()).toHaveLength(1);
  });

  it('does not save empty score records', async () => {
    const saved = await saveScoreHistory('问题', []);

    expect(saved).toBeNull();
    expect(localStore[SCORE_HISTORY_KEY]).toBeUndefined();
  });

  it('builds escaped csv rows', () => {
    const csv = buildScoreHistoryCsv([{
      timestamp: '2026-07-03T10:30:00.000Z',
      question: '包含,逗号\n换行',
      scores: [{ model: 'Claude "Sonnet"', score: 10 }]
    }]);

    expect(csv).toContain('时间,问题,模型,分数');
    expect(csv).toContain('"包含,逗号\n换行","Claude ""Sonnet""",10');
  });

  it('exports local score history as csv', async () => {
    await saveScoreHistory('问题', [{ model: 'ChatGPT', score: 8 }], '2026-07-03T10:30:00.000Z');
    const result = await exportScoreHistory();

    expect(result.rowCount).toBe(1);
    expect(result.fileName).toMatch(/^AIChatMerge\/scores\/aichatmerge-scores-\d+\.csv$/);
    expect(result.csv).toContain('ChatGPT,8');
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'blob:score-csv',
        filename: result.fileName,
        saveAs: true
      }),
      expect.any(Function)
    );
  });

  it('does not download when score history is empty', async () => {
    const result = await exportScoreHistory();

    expect(result.rowCount).toBe(0);
    expect(result.fileName).toBeNull();
    expect(chrome.downloads.download).not.toHaveBeenCalled();
  });

  it('clears score history', async () => {
    await saveScoreHistory('问题', [{ model: 'ChatGPT', score: 8 }]);
    await clearScoreHistory();

    expect(await getScoreHistory()).toEqual([]);
  });

  it('formats timestamps for csv', () => {
    expect(formatScoreTimestamp(new Date(2026, 6, 3, 10, 30, 5))).toBe('2026-07-03 10:30:05');
  });
});
