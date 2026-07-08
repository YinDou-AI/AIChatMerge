export const SCORE_HISTORY_KEY = 'aichatmergeScoreHistory';

function getChromeStorageArea() {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

function normalizeScores(scores) {
  if (!Array.isArray(scores)) return [];
  return scores
    .map(score => ({
      model: String(score?.model || '').trim(),
      score: Number.parseInt(score?.score, 10)
    }))
    .filter(score => score.model && Number.isFinite(score.score));
}

export async function getScoreHistory() {
  const storage = getChromeStorageArea();
  if (!storage) return [];

  const result = await storage.get({ [SCORE_HISTORY_KEY]: [] });
  const history = result?.[SCORE_HISTORY_KEY];
  return Array.isArray(history) ? history : [];
}

export async function saveScoreHistory(question, scores, timestamp = new Date().toISOString()) {
  const normalizedScores = normalizeScores(scores);
  if (normalizedScores.length === 0) return null;

  const entry = {
    timestamp,
    question: String(question || '').trim(),
    scores: normalizedScores
  };

  const storage = getChromeStorageArea();
  if (!storage) return entry;

  const history = await getScoreHistory();
  await storage.set({
    [SCORE_HISTORY_KEY]: [...history, entry]
  });
  return entry;
}

export async function clearScoreHistory() {
  const storage = getChromeStorageArea();
  if (!storage) return;
  await storage.set({ [SCORE_HISTORY_KEY]: [] });
}

export function formatScoreTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(':');
}

export function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildScoreHistoryCsv(history) {
  const rows = [['时间', '问题', '模型', '分数']];
  (Array.isArray(history) ? history : []).forEach(entry => {
    normalizeScores(entry?.scores).forEach(score => {
      rows.push([
        formatScoreTimestamp(entry.timestamp),
        entry.question || '',
        score.model,
        score.score
      ]);
    });
  });

  return rows
    .map(row => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function downloadCsv(fileName, csv) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
      chrome.downloads.download({
        url,
        filename: fileName,
        saveAs: true,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        const error = chrome.runtime?.lastError;
        cleanup();
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve({ downloadId });
      });
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    cleanup();
    resolve({ downloadId: null });
  });
}

export async function exportScoreHistory() {
  const history = await getScoreHistory();
  const rowCount = history.reduce((count, entry) => count + normalizeScores(entry?.scores).length, 0);
  const csv = buildScoreHistoryCsv(history);
  if (rowCount === 0) {
    return {
      success: true,
      fileName: null,
      rowCount,
      csv,
      downloadId: null
    };
  }

  const fileName = `AIChatMerge/scores/aichatmerge-scores-${Date.now()}.csv`;
  const result = await downloadCsv(fileName, csv);
  return {
    success: true,
    fileName,
    rowCount,
    csv,
    downloadId: result.downloadId
  };
}
