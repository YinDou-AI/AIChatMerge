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
});
