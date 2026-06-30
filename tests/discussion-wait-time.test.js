import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('discussion wait time', () => {
  const source = readFileSync(resolve(process.cwd(), 'aichatmerge-panel/multi-panel.js'), 'utf8');

  it('uses MERGE_MAX_WAIT for discussion round completion timeout', () => {
    expect(source).toContain('function getCurrentMergeMaxWait()');
    expect(source).toContain('function waitForDiscussionPanelsCompletionWithAbort(targetPanels, signal, timeoutMs = getCurrentMergeMaxWait())');
    expect(source).toContain('const discussionWaitMs = getCurrentMergeMaxWait();');
    expect(source).toContain('await waitForDiscussionPanelsCompletionWithAbort(currentNonMergePanels, signal, discussionWaitMs);');
    expect(source).toContain('await waitForDiscussionMergeCompletionWithFallback(mergePanelCurrent, signal, discussionWaitMs, previousMergedAnswer);');
  });

  it('does not keep the previous fixed discussion timeout', () => {
    expect(source).not.toContain('}, 120000);');
    expect(source).not.toContain("waitForEvent('MERGE_COMPLETE', 60000)");
    expect(source).not.toContain('function waitForEvent(');
  });
});
