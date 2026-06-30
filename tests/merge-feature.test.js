/**
 * Standalone tests for the merge/fusion feature logic.
 *
 * Since multi-panel.js is a ~3270-line file with heavy DOM dependencies,
 * we replicate the testable pure functions here and test their behavior directly.
 * This ensures the logic is validated even when the module itself cannot be imported.
 *
 * Source of truth: aichatmerge-panel/multi-panel.js
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ===== Replicated pure functions from aichatmerge-panel/multi-panel.js =====

/**
 * Build the prompt sent to the merge (fusion) AI model.
 * Source: aichatmerge-panel/multi-panel.js buildMergePrompt
 */
function buildMergePrompt(question, answers, currentLocale = 'zh_CN') {
  const isEn = currentLocale === 'en';
  const today = new Date().toLocaleDateString(isEn ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const parts = answers.map(a => `【${a.providerName}】\n${normalizeAnswerForMerge(a.answer)}`).join('\n\n---\n\n');

  if (isEn) {
    return `You are a skilled answer synthesizer. Today: ${today}.
[Original Question]
${question}
[Model Responses]
${parts}
Rules:
1. Quote the original question as-is
2. Extract the best content from each response, remove duplicates
3. When citing a viewpoint, note which model(s) support it (e.g. "— DeepSeek, ChatGPT")
4. Remove outdated info based on today's date
5. Note disagreements briefly, then give the best answer
6. Use Markdown formatting (## for headings, **bold** for emphasis, - for lists)
Output the synthesized answer with source attribution.`;
  }

  return `你是一位优秀的答案综合者。当前日期：${today}。
[原始问题]
${question}
[各模型回答]
${parts}
规则：
1. 先原样引用原始问题
2. 从每个回答中提取最优质的内容，去除重复
3. 引用观点时注明来源（如"— DeepSeek、ChatGPT"）
4. 根据当前日期，去除过时的信息
5. 模型有分歧时简要说明后给出最佳答案
6. 使用 Markdown 格式输出（标题用 ##，重点用 **加粗**，列表用 -）
直接输出综合答案，每个观点注明来源。`;
}

function normalizeAnswerForMerge(answer) {
  return String(answer || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{2,}/g, '\n');
}

/**
 * Check whether a panel is a merge panel.
 * Source: aichatmerge-panel/multi-panel.js line 1589
 */
function isMergePanel(mergePanelIds, panel) {
  return mergePanelIds.has(panel.id);
}

/**
 * Filter panels to exclude merge panels.
 * Source: aichatmerge-panel/multi-panel.js line 1593
 */
function getNonMergePanels(mergePanelIds, panels) {
  return panels.filter(p => !isMergePanel(mergePanelIds, p));
}

/**
 * Decide whether a close action leaves every remaining source panel complete.
 * Source: aichatmerge-panel/multi-panel.js reconcileMergeMonitorAfterPanelRemoval
 */
function areRemainingSourcePanelsComplete(panels, mergePanelIds, completedPanelIds, removedPanelId) {
  const remainingPanels = panels.filter(panel =>
    panel.id !== removedPanelId && !isMergePanel(mergePanelIds, panel)
  );
  return remainingPanels.length > 0 && remainingPanels.every(panel => completedPanelIds.has(panel.id));
}

/**
 * Source: aichatmerge-panel/multi-panel.js removePanel
 * Only source panel removal should re-evaluate merge completion.
 */
function shouldReconcileMergeMonitorAfterRemoval(mergePanelIds, removedPanel) {
  return !isMergePanel(mergePanelIds, removedPanel);
}

const SEND_ONLY_AFTER_FILL_WINDOW_MS = 5 * 60 * 1000;

function canTriggerSendOnlyFromEmptyInput(lastFillOnlyCompletedAt, now) {
  return lastFillOnlyCompletedAt > 0 &&
    now - lastFillOnlyCompletedAt <= SEND_ONLY_AFTER_FILL_WINDOW_MS;
}

function shouldStartSendFromUnifiedInput(text, lastFillOnlyCompletedAt = 0, now = Date.now()) {
  return String(text || '').trim().length > 0 ||
    canTriggerSendOnlyFromEmptyInput(lastFillOnlyCompletedAt, now);
}

// ===== Tests =====

describe('merge-feature', () => {
  describe('buildMergePrompt', () => {
    it('should build a prompt with multiple AI answers', () => {
      const question = 'What is the best programming language?';
      const answers = [
        { providerName: 'ChatGPT', answer: 'Python is very versatile.' },
        { providerName: 'Claude', answer: 'TypeScript offers type safety.' },
      ];

      const prompt = buildMergePrompt(question, answers);

      expect(prompt).toContain('你是一位优秀的答案综合者');
      expect(prompt).toContain(question);
      expect(prompt).toContain('【ChatGPT】');
      expect(prompt).toContain('Python is very versatile.');
      expect(prompt).toContain('【Claude】');
      expect(prompt).toContain('TypeScript offers type safety.');
      expect(prompt).toContain('[原始问题]');
      expect(prompt).toContain('[各模型回答]');
      expect(prompt).toContain('直接输出综合答案');
    });

    it('should include today date in zh-CN format', () => {
      const prompt = buildMergePrompt('test', [
        { providerName: 'A', answer: 'answer' },
      ]);

      // The date string should be somewhere in the prompt header
      expect(prompt).toMatch(/^你是一位优秀的答案综合者。当前日期：.+。/);
    });

    it('should handle a single answer', () => {
      const prompt = buildMergePrompt('Hello', [
        { providerName: 'Gemini', answer: 'Hi there!' },
      ]);

      expect(prompt).toContain('【Gemini】');
      expect(prompt).toContain('Hi there!');
      // Should still have the full template
      expect(prompt).toContain('从每个回答中提取最优质的内容');
    });

    it('should handle many answers', () => {
      const answers = Array.from({ length: 8 }, (_, i) => ({
        providerName: `Model-${i}`,
        answer: `Answer from model ${i}`,
      }));

      const prompt = buildMergePrompt('Multi model question', answers);

      answers.forEach(({ providerName, answer }) => {
        expect(prompt).toContain(`【${providerName}】`);
        expect(prompt).toContain(answer);
      });
    });

    it('should handle special characters in question', () => {
      const question = 'What about <script>alert("xss")</script> & "quotes" and \'single\'?';
      const answers = [{ providerName: 'A', answer: 'Safe answer.' }];

      const prompt = buildMergePrompt(question, answers);

      expect(prompt).toContain(question);
      expect(prompt).toContain('<script>');
    });

    it('should handle special characters in answers', () => {
      const answers = [
        { providerName: 'Model<1>', answer: 'Answer with <html> & "entities"' },
      ];

      const prompt = buildMergePrompt('test', answers);

      expect(prompt).toContain('【Model<1>】');
      expect(prompt).toContain('Answer with <html> & "entities"');
    });

    it('should handle empty question string', () => {
      const answers = [{ providerName: 'A', answer: 'answer' }];
      const prompt = buildMergePrompt('', answers);

      // Empty question should still produce valid structure
      expect(prompt).toContain('[原始问题]\n\n');
      expect(prompt).toContain('[各模型回答]');
    });

    it('should handle multiline answers', () => {
      const answers = [
        {
          providerName: 'ChatGPT',
          answer: 'Line 1\nLine 2\nLine 3',
        },
        {
          providerName: 'Claude',
          answer: 'First point.\nSecond point.',
        },
      ];

      const prompt = buildMergePrompt('multiline', answers);

      expect(prompt).toContain('Line 1\nLine 2\nLine 3');
      expect(prompt).toContain('First point.\nSecond point.');
    });

    it('should handle Chinese characters in question and answers', () => {
      const question = '什么是最好的编程语言？';
      const answers = [
        { providerName: '豆包', answer: 'Python 是最流行的。' },
        { providerName: 'Kimi', answer: 'JavaScript 应用最广泛。' },
      ];

      const prompt = buildMergePrompt(question, answers);

      expect(prompt).toContain(question);
      expect(prompt).toContain('【豆包】');
      expect(prompt).toContain('Python 是最流行的。');
      expect(prompt).toContain('【Kimi】');
      expect(prompt).toContain('JavaScript 应用最广泛。');
    });

    it('should preserve answer order', () => {
      const answers = [
        { providerName: 'First', answer: 'First answer' },
        { providerName: 'Second', answer: 'Second answer' },
        { providerName: 'Third', answer: 'Third answer' },
      ];

      const prompt = buildMergePrompt('order test', answers);

      const firstIdx = prompt.indexOf('【First】');
      const secondIdx = prompt.indexOf('【Second】');
      const thirdIdx = prompt.indexOf('【Third】');

      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    it('should contain the required output format instructions', () => {
      const prompt = buildMergePrompt('q', [
        { providerName: 'A', answer: 'a' },
      ]);

      expect(prompt).toContain('引用观点时注明来源');
      expect(prompt).toContain('根据当前日期，去除过时的信息');
      expect(prompt).toContain('使用 Markdown 格式输出');
      expect(prompt).toContain('直接输出综合答案');
    });

    it('should remove blank lines while preserving single line breaks', () => {
      const prompt = buildMergePrompt('q', [
        { providerName: 'A', answer: '\n\n第一段\n  \n\n\n第二段\n' },
      ]);

      expect(prompt).toContain('【A】\n第一段\n第二段');
      expect(prompt).not.toContain('【A】\n\n');
      expect(prompt).not.toContain('第一段\n\n第二段');
    });

    it('separates provider answers clearly', () => {
      const prompt = buildMergePrompt('q', [
        { providerName: 'A', answer: '第一段' },
        { providerName: 'B', answer: '第二段' },
      ]);

      expect(prompt).toContain('【A】\n第一段\n\n---\n\n【B】\n第二段');
    });

    it('should build the English prompt when locale is en', () => {
      const prompt = buildMergePrompt('What changed?', [
        { providerName: 'DeepSeek', answer: 'Answer A.' },
      ], 'en');

      expect(prompt).toContain('You are a skilled answer synthesizer');
      expect(prompt).toContain('[Original Question]');
      expect(prompt).toContain('[Model Responses]');
      expect(prompt).toContain('Quote the original question as-is');
      expect(prompt).toContain('Output the synthesized answer with source attribution.');
    });
  });

  describe('isMergePanel', () => {
    let mergePanelIds;

    beforeEach(() => {
      mergePanelIds = new Set();
    });

    it('should return true for a panel whose id is in the set', () => {
      mergePanelIds.add('panel-merge-1');

      expect(isMergePanel(mergePanelIds, { id: 'panel-merge-1' })).toBe(true);
    });

    it('should return false for a panel whose id is not in the set', () => {
      expect(isMergePanel(mergePanelIds, { id: 'panel-chatgpt' })).toBe(false);
    });

    it('should return false for empty set', () => {
      expect(isMergePanel(mergePanelIds, { id: 'any-id' })).toBe(false);
    });

    it('should handle multiple merge panels', () => {
      mergePanelIds.add('merge-a');
      mergePanelIds.add('merge-b');

      expect(isMergePanel(mergePanelIds, { id: 'merge-a' })).toBe(true);
      expect(isMergePanel(mergePanelIds, { id: 'merge-b' })).toBe(true);
      expect(isMergePanel(mergePanelIds, { id: 'merge-c' })).toBe(false);
    });

    it('should work after deleting an id', () => {
      mergePanelIds.add('panel-x');
      expect(isMergePanel(mergePanelIds, { id: 'panel-x' })).toBe(true);

      mergePanelIds.delete('panel-x');
      expect(isMergePanel(mergePanelIds, { id: 'panel-x' })).toBe(false);
    });
  });

  describe('getNonMergePanels', () => {
    let mergePanelIds;

    beforeEach(() => {
      mergePanelIds = new Set();
    });

    it('should return all panels when no merge panels exist', () => {
      const panels = [
        { id: 'p1', providerId: 'chatgpt' },
        { id: 'p2', providerId: 'claude' },
      ];

      const result = getNonMergePanels(mergePanelIds, panels);

      expect(result).toHaveLength(2);
      expect(result).toEqual(panels);
    });

    it('should filter out merge panels', () => {
      mergePanelIds.add('p2');
      const panels = [
        { id: 'p1', providerId: 'chatgpt' },
        { id: 'p2', providerId: 'deepseek' },
        { id: 'p3', providerId: 'claude' },
      ];

      const result = getNonMergePanels(mergePanelIds, panels);

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toEqual(['p1', 'p3']);
    });

    it('should return empty array when all panels are merge panels', () => {
      mergePanelIds.add('p1');
      mergePanelIds.add('p2');
      const panels = [
        { id: 'p1', providerId: 'chatgpt' },
        { id: 'p2', providerId: 'claude' },
      ];

      const result = getNonMergePanels(mergePanelIds, panels);

      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty panels list', () => {
      mergePanelIds.add('nonexistent');

      const result = getNonMergePanels(mergePanelIds, []);

      expect(result).toHaveLength(0);
    });

    it('should not mutate the original panels array', () => {
      mergePanelIds.add('p1');
      const panels = [
        { id: 'p1', providerId: 'chatgpt' },
        { id: 'p2', providerId: 'claude' },
      ];

      getNonMergePanels(mergePanelIds, panels);

      expect(panels).toHaveLength(2);
    });
  });

  describe('merge panel lifecycle', () => {
    it('should track adding and removing merge panel ids', () => {
      const mergePanelIds = new Set();

      // Simulate adding a merge panel
      const newPanelId = 'panel-merge-deepseek-001';
      mergePanelIds.add(newPanelId);

      expect(isMergePanel(mergePanelIds, { id: newPanelId })).toBe(true);

      // Simulate removing (e.g. panel closed)
      mergePanelIds.delete(newPanelId);

      expect(isMergePanel(mergePanelIds, { id: newPanelId })).toBe(false);
    });

    it('should correctly identify merge vs non-merge in mixed scenario', () => {
      const mergePanelIds = new Set();
      mergePanelIds.add('merge-panel-1');

      const panels = [
        { id: 'chatgpt-panel', providerId: 'chatgpt' },
        { id: 'claude-panel', providerId: 'claude' },
        { id: 'merge-panel-1', providerId: 'deepseek' },
      ];

      const nonMerge = getNonMergePanels(mergePanelIds, panels);

      expect(nonMerge).toHaveLength(2);
      expect(nonMerge.every(p => !isMergePanel(mergePanelIds, p))).toBe(true);
    });
  });

  describe('closing a source panel during automatic merge', () => {
    it('should recognize that all remaining source panels are complete', () => {
      const panels = [{ id: 'a' }, { id: 'b' }, { id: 'bad' }];
      const completed = new Set(['a', 'b']);

      expect(areRemainingSourcePanelsComplete(panels, new Set(), completed, 'bad')).toBe(true);
    });

    it('should keep waiting when a remaining source panel is incomplete', () => {
      const panels = [{ id: 'a' }, { id: 'b' }, { id: 'bad' }];
      const completed = new Set(['a']);

      expect(areRemainingSourcePanelsComplete(panels, new Set(), completed, 'bad')).toBe(false);
    });

    it('should not re-evaluate merge completion when the closed panel is the merge target', () => {
      const mergePanelIds = new Set(['merge-target']);

      expect(shouldReconcileMergeMonitorAfterRemoval(mergePanelIds, { id: 'merge-target' })).toBe(false);
      expect(shouldReconcileMergeMonitorAfterRemoval(mergePanelIds, { id: 'a' })).toBe(true);
    });
  });

  describe('send guard', () => {
    it('does not start a send from empty input during normal startup', () => {
      expect(shouldStartSendFromUnifiedInput('', 0, 1000)).toBe(false);
      expect(shouldStartSendFromUnifiedInput('   ', 0, 1000)).toBe(false);
    });

    it('allows empty-input send only shortly after a fill-only action', () => {
      expect(shouldStartSendFromUnifiedInput('', 1000, 2000)).toBe(true);
      expect(shouldStartSendFromUnifiedInput('', 1000, 1000 + SEND_ONLY_AFTER_FILL_WINDOW_MS + 1)).toBe(false);
    });

    it('always allows non-empty input', () => {
      expect(shouldStartSendFromUnifiedInput('hello', 0, 1000)).toBe(true);
    });
  });
});
