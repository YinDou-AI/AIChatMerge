import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('discussion message context', () => {
  it('uses the trusted multi-panel context for discussion INJECT_TEXT auto-submit', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).not.toContain("context: 'discussion'");
    expect(source).toMatch(/sendToPanel\(panel,\s*discussPrompt,\s*true,\s*null,\s*0,\s*discussionSessionId\)/);
    expect(source).toMatch(/type:\s*'INJECT_TEXT'[\s\S]*providerMode:\s*getPanelProviderMode\(panel\)[\s\S]*context:\s*'multi-panel'/);
  });

  it('binds discussion send retries and completion monitoring to the same session', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toContain('const DISCUSSION_ROUNDS = 1;');
    expect(source).toMatch(/if\s*\(mergeSessionId\)\s*{[\s\S]*type:\s*'MONITOR_COMPLETION'[\s\S]*mergeSessionId[\s\S]*panelId:\s*panel\.id[\s\S]*context:\s*'multi-panel'/);
    expect(source).toMatch(/const discussionSessionId = `discussion-round-\$\{round\}-\$\{panel\.id\}-\$\{Date\.now\(\)\}`;/);
    expect(source).toContain("String(data.mergeSessionId || '').startsWith('discussion-round-')");
    expect(source).toContain("await ensurePanelVisibleBeforeAutoSubmit(panel, true, 'discussion');");
    expect(source).toContain('const settledDiscussionSends = discussionSendResults;');
  });

  it('tracks discussion merge-panel completion sessions separately from source-panel rounds', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toMatch(/const roundSessionId = `discussion-merge-\$\{round\}-\$\{Date\.now\(\)\}`;[\s\S]*beginCompletionSession\(roundSessionId,\s*discussionGeneration\);[\s\S]*type:\s*'MONITOR_COMPLETION'/);
    expect(source).toMatch(/if\s*\(activeMergeSessionId === roundSessionId &&[\s\S]*activeCompletionSessionGeneration === discussionGeneration\)\s*{[\s\S]*clearActiveCompletionSession\(\);[\s\S]*}/);
  });

  it('invalidates stale completion sessions before starting new chats', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toContain('let completionSessionGeneration = 0;');
    expect(source).toContain('let activeCompletionSessionGeneration = 0;');
    expect(source).toContain("invalidateCompletionSessions('new-chat');");
    expect(source).toMatch(/function handleMergeCompletionDetected\(data\)[\s\S]*activeCompletionSessionGeneration !== completionSessionGeneration[\s\S]*return;/);
    expect(source).toMatch(/if\s*\(signal\.aborted \|\| discussionGeneration !== completionSessionGeneration\)\s*{[\s\S]*break;[\s\S]*}/);
  });

  it('includes the previous merged result when merging discussion review feedback', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toContain("const previousMergeLabel = currentLocale === 'en' ? 'Previous merge result' : '上一版融合结果';");
    expect(source).toContain('providerName: previousMergeLabel');
    expect(source).toMatch(/const roundMergeAnswers = mergedAnswer && mergedAnswer\.trim\(\)[\s\S]*\.\.\.validRoundAnswers[\s\S]*const roundMergePrompt = buildMergePrompt\(question,\s*roundMergeAnswers\)/);
  });

  it('binds provider completion events to the sending panel id', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toContain('panelId: data.panelId || panel.id');
    expect(source).toContain('provider: data.provider || panel.providerId');
  });

  it('initializes new merge panels with export metadata before auto export can start', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toMatch(/panels\.unshift\(\{[\s\S]*exportData:\s*\{[\s\S]*question,[\s\S]*providers:\s*validAnswers\.map\(a => a\.providerName\),[\s\S]*mode:\s*mergeMode === 'merge\+discuss' \? 'discuss' : 'merge'[\s\S]*\}[\s\S]*\}\);/);
    expect(source).toMatch(/const newPanel = panels\.find\(p => p\.id === panelId\);[\s\S]*autoExportToMarkdown\(newPanel\);/);
  });

  it('cancels stale automatic markdown exports before starting a new one', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toContain('let autoExportWaitController = null;');
    expect(source).toContain('let autoExportRunId = 0;');
    expect(source).toContain('autoExportWaitController.abort();');
    expect(source).toContain('const exportRunId = ++autoExportRunId;');
    expect(source).toMatch(/if\s*\(exportWaitController\.signal\.aborted \|\| exportRunId !== autoExportRunId\)\s*{[\s\S]*return;[\s\S]*}/);
    expect(source).toContain('let autoExportWriteInProgress = false;');
    expect(source).toMatch(/if\s*\(autoExportWriteInProgress\)\s*{[\s\S]*return;[\s\S]*}/);
  });

  it('fully stops the merge monitor when auto merge is disabled', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

    expect(source).toMatch(/if\s*\(changes\.autoMergeEnabled\)\s*{[\s\S]*AUTO_MERGE_ENABLED = changes\.autoMergeEnabled\.newValue !== false;[\s\S]*if\s*\(!AUTO_MERGE_ENABLED\)\s*{[\s\S]*stopMergeMonitor\(\);[\s\S]*}/);
  });

  it('does not start automatic merge monitoring when Enter sends in manual merge mode', () => {
    const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');
    const enterHandler = source.match(/inputTextarea\.addEventListener\('keydown',\s*\(e\) => \{[\s\S]*?\n  \}\);/);

    expect(enterHandler?.[0]).toContain('const mergeSessionId = AUTO_MERGE_ENABLED');
    expect(enterHandler?.[0]).toMatch(/if\s*\(mergeSessionId\)\s*{[\s\S]*startMergeMonitor\(mergeSessionId\);[\s\S]*}\s*else\s*{[\s\S]*stopMergeMonitor\(\);[\s\S]*}/);
    expect(enterHandler?.[0]).toContain('broadcastMessage(inputTextarea.value, true, mergeSessionId);');
  });
});
