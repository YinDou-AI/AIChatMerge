/**
 * Markdown export domain module.
 * Consolidates all markdown export logic: manual export, auto export, and discussion export.
 * Log prefix: markdown-export:*
 */

import { exportToMarkdown, extractScores, cleanAnswer as markdownCleanAnswer, extractTitle as markdownExtractTitle } from '../../modules/obsidian-export.js';
import { saveScoreHistory } from '../../modules/score-manager.js';
import { getSettings } from '../../modules/settings.js';
import { t } from './i18n.js';
import { showToast } from './toast.js';
import { recordDebugLog, getPanelDebugInfo } from './debug-log.js';
import { extractSinglePanelAnswer } from './answer-extractor.js';
import { getPanels } from './state.js';
import { isMergePanel } from './send-pipeline.js';
import { waitForFinalMergeAnswerBeforeExport, getCurrentMergeMaxWait } from './discussion-gates.js';

// ===== Auto export state (moved from merge-engine.js) =====
let autoExportWaitController = null;
let autoExportRunId = 0;
let autoExportWriteInProgress = false;

export function getAutoExportWaitController() { return autoExportWaitController; }
export function setAutoExportWaitController(value) { autoExportWaitController = value; }
export function getAutoExportRunId() { return autoExportRunId; }
export function incrementAutoExportRunId() { return ++autoExportRunId; }
export function setAutoExportWriteInProgress(value) { autoExportWriteInProgress = value; }
export function getAutoExportWriteInProgress() { return autoExportWriteInProgress; }

// ===== Score helpers =====

export function buildScoreSignature(question, scores) {
  const scoreText = (scores || []).map(score => `${score.model}:${score.score}`).join('|');
  return `${String(question || '').trim()}::${scoreText}`;
}

export async function saveMergeScoresIfPresent(panel, question, scores) {
  if (!scores || scores.length === 0) return null;
  const signature = buildScoreSignature(question, scores);
  if (panel && panel.lastSavedScoreSignature === signature) return null;
  const saved = await saveScoreHistory(question, scores);
  if (saved && panel) panel.lastSavedScoreSignature = signature;
  return saved;
}

// ===== Export feedback UI =====

export function setMarkdownExportFeedback(isExporting) {
  const exportBtn = document.getElementById('obsidian-export-btn');
  const statusEl = document.getElementById('send-status');
  if (exportBtn) {
    exportBtn.disabled = Boolean(isExporting);
    exportBtn.classList.toggle('is-busy', Boolean(isExporting));
    exportBtn.setAttribute('aria-busy', isExporting ? 'true' : 'false');
  }
  if (statusEl) {
    statusEl.textContent = isExporting ? t('obsidianExporting') : '';
    statusEl.className = isExporting ? 'send-status partial' : 'send-status';
  }
}

// ===== Export core (no UI, returns result) =====

async function exportCore(answer, { question = '', providers = [], mode = 'merge', title = '', scores = null } = {}) {
  if (scores === null) {
    scores = extractScores(answer);
  }
  const result = await exportToMarkdown({ question, answer, providers, mode, title, scores });
  if (result.success) {
    return { success: true, filePath: result.filePath };
  }
  return { success: false, error: result.error || 'Unknown error' };
}

// ===== Export and notify helper =====

async function exportAndNotify(answer, { question = '', providers = [], mode = 'merge', title = '', panel = null, scores = null, logPrefix = 'markdown-export' } = {}) {
  if (panel) {
    await saveMergeScoresIfPresent(panel, question, scores || extractScores(answer));
  }
  try {
    const result = await exportCore(answer, { question, providers, mode, title, scores });
    if (result.success) {
      recordDebugLog(`${logPrefix}:auto-success`, { filePath: result.filePath });
      showToast(t('obsidianExportSuccess', result.filePath), { type: 'success', duration: 3600 });
      return result;
    }
    recordDebugLog(`${logPrefix}:auto-failed`, { error: result.error });
    showToast(t('obsidianExportFailed', result.error), { type: 'error', duration: 4200 });
    return result;
  } catch (e) {
    console.warn('[Markdown] Export failed:', e);
    recordDebugLog(`${logPrefix}:auto-error`, { message: e?.message || String(e) });
    showToast(t('obsidianExportFailed', e?.message || 'Unknown error'), { type: 'error', duration: 4200 });
    return { success: false, error: e?.message || String(e) };
  }
}

// ===== Manual export =====

export async function handleManualExport() {
  const mergePanel = getPanels().find(p => isMergePanel(p));
  if (!mergePanel) {
    recordDebugLog('markdown-export:manual-no-merge-panel');
    showToast(t('obsidianExportFailed', '请先进行融合操作'));
    return;
  }
  const answer = await extractSinglePanelAnswer(mergePanel);
  if (!answer) {
    recordDebugLog('markdown-export:manual-no-answer', { panel: getPanelDebugInfo(mergePanel) });
    showToast(t('obsidianExportFailed', 'No answer found'));
    return;
  }
  const exportData = mergePanel.exportData || {};
  setMarkdownExportFeedback(true);
  showToast(t('obsidianExporting'), { type: 'info', duration: 1800 });
  recordDebugLog('markdown-export:manual-start', {
    panel: getPanelDebugInfo(mergePanel), answerLength: answer.length,
    providers: exportData.providers || [], mode: exportData.mode || 'merge'
  });
  try {
    const scores = extractScores(answer);
    await saveMergeScoresIfPresent(mergePanel, exportData.question || '', scores);
    const result = await exportToMarkdown({
      question: exportData.question || '', answer, providers: exportData.providers || [],
      mode: exportData.mode || 'merge', scores
    });
    if (result.success) {
      recordDebugLog('markdown-export:manual-success', { filePath: result.filePath });
      showToast(t('obsidianExportSuccess', result.filePath), { type: 'success', duration: 3600 });
    } else {
      recordDebugLog('markdown-export:manual-failed', { error: result.error || 'Unknown error' });
      showToast(t('obsidianExportFailed', result.error || 'Unknown error'), { type: 'error', duration: 4200 });
    }
  } catch (error) {
    console.warn('[Markdown] Manual export failed:', error);
    recordDebugLog('markdown-export:manual-error', { message: error?.message || String(error) });
    showToast(t('obsidianExportFailed', error?.message || 'Unknown error'), { type: 'error', duration: 4200 });
  } finally {
    setMarkdownExportFeedback(false);
  }
}

// ===== Auto export (called from merge flow) =====

export async function autoExportToMarkdown(mergePanel) {
  const settings = await getSettings();
  const exportMode = settings.markdownExportMode || settings.obsidianExportMode || 'auto';
  if (exportMode !== 'auto') return;
  if (getAutoExportWaitController()) getAutoExportWaitController().abort();
  const exportWaitController = new AbortController();
  setAutoExportWaitController(exportWaitController);
  const exportRunId = incrementAutoExportRunId();
  const exportData = mergePanel.exportData || {};
  recordDebugLog('markdown-export:auto-wait-final-answer', {
    panel: getPanelDebugInfo(mergePanel), providers: exportData.providers || [],
    mode: exportData.mode || 'merge', exportRunId
  });
  const answer = await waitForFinalMergeAnswerBeforeExport(mergePanel, exportWaitController.signal, getCurrentMergeMaxWait());
  if (exportWaitController.signal.aborted || exportRunId !== getAutoExportRunId()) {
    recordDebugLog('markdown-export:auto-cancelled-stale-run', {
      panel: getPanelDebugInfo(mergePanel), exportRunId, currentExportRunId: getAutoExportRunId()
    });
    return;
  }
  if (!answer) {
    recordDebugLog('markdown-export:auto-no-answer', { panel: getPanelDebugInfo(mergePanel), exportRunId });
    if (getAutoExportWaitController() === exportWaitController) setAutoExportWaitController(null);
    return;
  }
  setMarkdownExportFeedback(true);
  showToast(t('obsidianExporting'), { type: 'info', duration: 1800 });
  recordDebugLog('markdown-export:auto-start', {
    panel: getPanelDebugInfo(mergePanel), answerLength: answer.length,
    providers: exportData.providers || [], mode: exportData.mode || 'merge', exportRunId
  });
  try {
    if (exportRunId !== getAutoExportRunId()) {
      recordDebugLog('markdown-export:auto-skip-stale-before-write', {
        panel: getPanelDebugInfo(mergePanel), exportRunId, currentExportRunId: getAutoExportRunId()
      });
      return;
    }
    if (getAutoExportWriteInProgress()) {
      recordDebugLog('markdown-export:auto-skip-write-in-progress', { panel: getPanelDebugInfo(mergePanel), exportRunId });
      return;
    }
    setAutoExportWriteInProgress(true);
    const scores = extractScores(answer);
    await saveMergeScoresIfPresent(mergePanel, exportData.question || '', scores);
    const result = await exportToMarkdown({
      question: exportData.question || '', answer, providers: exportData.providers || [],
      mode: exportData.mode || 'merge', scores
    });
    if (result.success) {
      recordDebugLog('markdown-export:auto-success', { filePath: result.filePath });
      showToast(t('obsidianExportSuccess', result.filePath), { type: 'success', duration: 3600 });
    } else {
      recordDebugLog('markdown-export:auto-failed', { error: result.error || 'Unknown error' });
      showToast(t('obsidianExportFailed', result.error || 'Unknown error'), { type: 'error', duration: 4200 });
    }
  } catch (error) {
    console.warn('[Markdown] Auto export failed:', error);
    recordDebugLog('markdown-export:auto-error', { message: error?.message || String(error) });
    showToast(t('obsidianExportFailed', error?.message || 'Unknown error'), { type: 'error', duration: 4200 });
  } finally {
    setAutoExportWriteInProgress(false);
    if (getAutoExportWaitController() === exportWaitController) setAutoExportWaitController(null);
    setMarkdownExportFeedback(false);
  }
}

export async function exportMergeResult(answer, { question = '', providers = [], title = '', panel = null, scores = null, logPrefix = 'merge-result' } = {}) {
  const settings = await getSettings();
  const exportMode = settings.markdownExportMode || settings.obsidianExportMode || 'auto';
  if (exportMode !== 'auto' || !answer) return;

  setMarkdownExportFeedback(true);
  showToast(t('obsidianExporting'), { type: 'info', duration: 1800 });
  recordDebugLog(`${logPrefix}:auto-start`, {
    answerLength: answer.length,
    providers,
    title
  });

  const result = await exportAndNotify(answer, {
    question,
    providers,
    mode: 'merge',
    title,
    panel,
    scores,
    logPrefix
  });

  setMarkdownExportFeedback(false);
  return result;
}

// ===== Discussion export helper =====

export async function exportDiscussionResult(answer, { question = '', providers = [], title = '', panel = null, scores = null, logPrefix = 'discussion-final-answer' } = {}) {
  const settings = await getSettings();
  const exportMode = settings.markdownExportMode || settings.obsidianExportMode || 'auto';
  if (exportMode !== 'auto' || !answer) return;

  setMarkdownExportFeedback(true);
  showToast(t('obsidianExporting'), { type: 'info', duration: 1800 });
  recordDebugLog(`${logPrefix}-auto-start`, {
    answerLength: answer.length,
    providers,
    title
  });

  try {
    if (panel) {
      await saveMergeScoresIfPresent(panel, question, scores);
    }
    const result = await exportToMarkdown({
      question,
      answer,
      providers,
      title,
      mode: 'discuss',
      scores
    });
    if (result.success) {
      recordDebugLog(`${logPrefix}-auto-success`, { filePath: result.filePath });
      showToast(t('obsidianExportSuccess', result.filePath), { type: 'success', duration: 3600 });
    } else {
      recordDebugLog(`${logPrefix}-auto-failed`, { error: result.error || 'Unknown error' });
      showToast(t('obsidianExportFailed', result.error || 'Unknown error'), { type: 'error', duration: 4200 });
    }
    return result;
  } catch (e) {
    console.warn('[Discussion] Markdown export failed:', e);
    recordDebugLog(`${logPrefix}-auto-error`, { message: e?.message || String(e) });
    showToast(t('obsidianExportFailed', e?.message || 'Unknown error'), { type: 'error', duration: 4200 });
    return { success: false, error: e?.message || String(e) };
  } finally {
    setMarkdownExportFeedback(false);
  }
}
