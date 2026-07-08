import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('score export and panel new chat ui', () => {
  const panelSource = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');
  const panelHtml = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.html'), 'utf8');
  const optionsHtml = readFileSync(resolve(process.cwd(), 'options/options.html'), 'utf8');
  const optionsSource = readFileSync(resolve(process.cwd(), 'options/options.js'), 'utf8');
  const settingsSource = readFileSync(resolve(process.cwd(), 'modules/settings.js'), 'utf8');

  it('keeps score history export in settings instead of the panel toolbar', () => {
    expect(panelHtml).not.toContain('id="score-export-btn"');
    expect(panelSource).toContain("import { saveScoreHistory } from '../modules/score-manager.js';");
    expect(panelSource).not.toContain('handleScoreExport');
    expect(optionsHtml).toContain('id="export-score-history-btn"');
    expect(optionsHtml).toContain('id="clear-score-history-btn"');
    expect(optionsSource).toContain("import { clearScoreHistory, exportScoreHistory } from '../modules/score-manager.js';");
    expect(optionsSource).toMatch(/export-score-history-btn'\)\?\.addEventListener\('click', exportScoreHistoryFromOptions\)/);
    expect(optionsSource).toMatch(/clear-score-history-btn'\)\?\.addEventListener\('click', clearScoreHistoryFromOptions\)/);
  });

  it('saves extracted merge scores through score history manager', () => {
    expect(panelSource).toContain('async function saveMergeScoresIfPresent(panel, question, scores)');
    expect(panelSource).toContain('await saveScoreHistory(question, scores);');
    expect(panelSource).toMatch(/const scores = extractScores\(answer\);[\s\S]*await saveMergeScoresIfPresent\(mergePanel,\s*exportData\.question \|\| '',\s*scores\);/);
    expect(panelSource).toContain('await saveMergeScoresIfPresent(finalMergePanel, lastSentQuestion || \'\', discussionScores);');
  });

  it('adds a per-panel new chat button before copy link', () => {
    expect(panelSource).toMatch(/<button class="panel-new-chat-btn"[\s\S]*?<button class="copy-link-btn"/);
    expect(panelSource).toMatch(/const panelNewChatBtn = panelEl\.querySelector\('\.panel-new-chat-btn'\);[\s\S]*startFreshChatForPanel\(panel\);/);
  });

  it('removes the old markdown score export setting from settings UI', () => {
    expect(optionsHtml).not.toContain('export-score-select');
    expect(optionsHtml).not.toContain('data-i18n="labelExportScore"');
    expect(settingsSource).not.toContain('exportScoreInMarkdown');
  });
});
