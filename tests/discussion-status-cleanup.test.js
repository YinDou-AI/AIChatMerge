import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('aichatmerge-panel/multi-panel.js'), 'utf8');

describe('discussion status cleanup', () => {
  it('waits for the final discussion merge with a text-stability fallback', () => {
    expect(source).toContain('async function waitForDiscussionMergeCompletionWithFallback');
    expect(source).toContain('normalizeAnswerForStability(previousAnswer)');
    expect(source).toContain('currentNormalized === previousNormalized');
    expect(source).toContain('Date.now() - stableSince >= 8000');
    expect(source).toContain("'discussion-wait:cancelled-after-stable-fallback'");
    expect(source).toContain('await waitForDiscussionMergeCompletionWithFallback(mergePanelCurrent, signal, discussionWaitMs, previousMergedAnswer);');
  });

  it('hides the stop discussion bar before auto-export starts', () => {
    const completionCommentIndex = source.indexOf('// 讨论完成，导出');
    const hideIndex = source.lastIndexOf('hideDiscussionStatusBar();', completionCommentIndex);
    const exportIndex = source.indexOf('await exportToMarkdown({', completionCommentIndex);

    expect(hideIndex).toBeGreaterThan(-1);
    expect(exportIndex).toBeGreaterThan(-1);
    expect(hideIndex).toBeLessThan(completionCommentIndex);
    expect(hideIndex).toBeLessThan(exportIndex);
  });

  it('stops active discussion before starting a new chat', () => {
    expect(source).toMatch(/async function newChatAllProviders\(\)\s*{[\s\S]*if\s*\(discussionActive \|\| discussionAbortController\)\s*{[\s\S]*stopDiscussion\('new-chat'\);[\s\S]*}[\s\S]*invalidateCompletionSessions\('new-chat'\);[\s\S]*stopMergeMonitor\(\);[\s\S]*panels\.forEach\(panel => \{[\s\S]*startFreshChatForPanel\(panel,\s*\{ invalidateSession: false \}\);/);
    expect(source).toMatch(/function stopDiscussion\(reason = 'user'\)\s*{[\s\S]*discussionAbortController\.abort\(\);[\s\S]*invalidateCompletionSessions\(`discussion-stop:\$\{reason\}`\);[\s\S]*recordDebugLog\('discussion:stop', \{ reason \}\);[\s\S]*hideDiscussionStatusBar\(\);[\s\S]*stopMergeMonitor\(\);/);
  });

  it('stops merge monitoring before starting a fresh chat for a single panel', () => {
    const startIndex = source.indexOf('function startFreshChatForPanel(panel,');
    const endIndex = source.indexOf('function isUnifiedInputOrNewChatControl', startIndex);
    const functionSource = source.slice(startIndex, endIndex);

    expect(startIndex).toBeGreaterThan(-1);
    expect(functionSource).toContain("invalidateCompletionSessions('panel-new-chat');");
    expect(functionSource).toContain('stopMergeMonitor();');
    expect(functionSource.indexOf('stopMergeMonitor();')).toBeLessThan(functionSource.indexOf('postNewChatToPanel(panel);'));
  });

  it('extracts discussion scores before cleaning score markers from answers', () => {
    expect(source).toMatch(/const extractedTitle = markdownExtractTitle\(mergedAnswer\);[\s\S]*let discussionScores = extractScores\(mergedAnswer\);[\s\S]*mergedAnswer = markdownCleanAnswer\(mergedAnswer, extractedTitle\);/);
    expect(source).toMatch(/discussionScores = extractScores\(newMergedAnswer\) \|\| discussionScores;[\s\S]*mergedAnswer = markdownCleanAnswer\(newMergedAnswer, newExtractedTitle\);/);
    expect(source).toContain('scores: discussionScores');
  });

  it('treats legacy string true as enabled for initial merge export only', () => {
    expect(source).toContain('function isTrueSetting(value)');
    expect(source).toContain("if (isTrueSetting(settingsForExport.exportInitialMerge) && exportModeForInit === 'auto' && mergedAnswer)");
  });
});
