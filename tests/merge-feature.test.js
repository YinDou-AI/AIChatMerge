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
  const parts = answers.map(a => `【${a.providerName}】\n${normalizeAnswerForMerge(a.answer)}`).join('\n');

  if (isEn) {
    return `You synthesize multiple model responses. Today: ${today}
[Original Question]
${question}
[Model Responses]
${parts}
Rules:
1. Start by writing the original question exactly
2. Synthesize useful content from each response, remove duplicates, cite source models; when models disagree, preserve each position and cite the source model
3. Remove outdated information based on today's date
4. Use Markdown, no tables
5. Output scores on a separate line starting with "Model scores:", format: Model scores: ModelName=score, ModelName=score
6. Output a title on a separate line starting with "Title:", format: Title: title within 10 words`.replace(/\n{2,}/g, '\n');
  }

  return `你是一位答案综合者。当前日期：${today}
[原始问题]
${question}
[各模型回答]
${parts}
规则：
1. 先原样写出原始问题
2. 综合各回答的有效内容去重，注明来源模型，有分歧时保留各方立场
3. 剔除过时信息
4. 使用 Markdown 输出，不用表格
5. 单独一行输出评分，必须以“模型评分：”开头，格式：模型评分：模型名=分数，模型名=分数
6. 单独一行输出标题，必须以“标题：”开头，格式：标题：标题内容，标题控制在10字以内`.replace(/\n{2,}/g, '\n');
}

function normalizeAnswerForMerge(answer) {
  return sanitizeMergedAnswerForDiscussion(answer);
}

function isMeaninglessStandaloneSymbolLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;
  return /^[\-–—_*•·.,，、;；:：|/\\()[\]{}<>《》【】"'“”‘’`~!！?？=+^$#@%&]+$/.test(trimmed);
}

function sanitizeMergedAnswerForDiscussion(answer) {
  let inCodeBlock = false;

  return String(answer || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(line => {
      if (/^\s*```/.test(line)) {
        inCodeBlock = !inCodeBlock;
        return true;
      }

      if (inCodeBlock) return true;
      if (!String(line || '').trim()) return false;
      return !isMeaninglessStandaloneSymbolLine(line);
    })
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Build the prompt sent to each model during discussion rounds.
 * Source: aichatmerge-panel/multi-panel.js buildDiscussPrompt
 */
function buildDiscussPrompt(question, mergedAnswer, currentLocale = 'zh_CN') {
  const isEn = currentLocale === 'en';
  const today = new Date().toLocaleDateString(isEn ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const cleanMergedAnswer = sanitizeMergedAnswerForDiscussion(mergedAnswer);

  if (isEn) {
    return `Task: Review the current merged result. Current date: ${today}
[Original Question]
${question}
[Current Merged Result]
${cleanMergedAnswer}
Output Rules:
1. Do not rewrite the full answer; output only corrections, additions, or objections
2. If there is no objection, output only: Agree with the current merged result; no new corrections
3. Prioritize recent information and flag clearly outdated or unreliable content
4. Do not use tables; use numbered lists for comparisons
5. For each correction or addition, cite evidence, source model, or accurate source channel
6. If there is a conflict, state the conflict, each position, and your judgment`.replace(/\n{2,}/g, '\n');
  }

  return `任务：复核当前融合结果。当前日期：${today}
[原始问题]
${question}
[当前融合结果]
${cleanMergedAnswer}
输出规则：
1. 不要重写完整答案，只输出需要修正、补充或反对的内容
2. 如果没有异议，只输出：同意当前融合结果，无新增修正
3. 以最新信息为准，指出明显过时或不可靠的内容
4. 禁止使用表格；对比内容使用编号列表
5. 每条修正或补充都注明依据、来源模型或准确来源渠道
6. 如存在冲突，说明冲突点、各方立场和你的判断结论`.replace(/\n{2,}/g, '\n');
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

      expect(prompt).toContain('你是一位答案综合者');
      expect(prompt).toContain(question);
      expect(prompt).toContain('【ChatGPT】');
      expect(prompt).toContain('Python is very versatile.');
      expect(prompt).toContain('【Claude】');
      expect(prompt).toContain('TypeScript offers type safety.');
      expect(prompt).toContain('[原始问题]');
      expect(prompt).toContain('[各模型回答]');
      expect(prompt).toContain('规则：');
    });

    it('should include today date in zh-CN format', () => {
      const prompt = buildMergePrompt('test', [
        { providerName: 'A', answer: 'answer' },
      ]);

      // The date string should be somewhere in the prompt header
      expect(prompt).toMatch(/^你是一位答案综合者。当前日期：.+/);
    });

    it('should handle a single answer', () => {
      const prompt = buildMergePrompt('Hello', [
        { providerName: 'Gemini', answer: 'Hi there!' },
      ]);

      expect(prompt).toContain('【Gemini】');
      expect(prompt).toContain('Hi there!');
      // Should still have the full template
      expect(prompt).toContain('综合各回答的有效内容去重');
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
      expect(prompt).toContain('[原始问题]\n[各模型回答]');
      expect(prompt).not.toContain('\n\n');
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

      expect(prompt).toContain('注明来源');
      expect(prompt).toContain('剔除过时信息');
      expect(prompt).toContain('使用 Markdown 输出');
      expect(prompt).toContain('单独一行输出评分');
      expect(prompt).toContain('必须以“模型评分：”开头');
      expect(prompt).toContain('模型评分：模型名=分数，模型名=分数');
      expect(prompt).toContain('必须以“标题：”开头');
      expect(prompt).toContain('标题：标题内容');
      expect(prompt).not.toContain('<<<');
    });

    it('should remove blank lines while preserving single line breaks', () => {
      const prompt = buildMergePrompt('q', [
        { providerName: 'A', answer: '\n\n第一段\n  \n\n\n第二段\n---\n*\n-20%\n' },
      ]);

      expect(prompt).toContain('【A】\n第一段\n第二段\n-20%');
      expect(prompt).not.toContain('【A】\n\n');
      expect(prompt).not.toContain('第一段\n\n第二段');
      expect(prompt).not.toContain('\n---\n');
      expect(prompt).not.toContain('\n*\n');
    });

    it('separates provider answers with provider headings', () => {
      const prompt = buildMergePrompt('q', [
        { providerName: 'A', answer: '第一段' },
        { providerName: 'B', answer: '第二段' },
      ]);

      expect(prompt).toContain('【A】\n第一段\n【B】\n第二段');
      expect(prompt).not.toContain('\n---\n');
    });

    it('should build the English prompt when locale is en', () => {
      const prompt = buildMergePrompt('What changed?', [
        { providerName: 'DeepSeek', answer: 'Answer A.' },
      ], 'en');

      expect(prompt).toContain('You synthesize multiple model responses');
      expect(prompt).toContain('[Original Question]');
      expect(prompt).toContain('[Model Responses]');
      expect(prompt).toContain('Start by writing the original question exactly');
      expect(prompt).toContain('Use Markdown, no tables');
      expect(prompt).toContain('Output scores on a separate line starting with "Model scores:"');
      expect(prompt).toContain('Model scores: ModelName=score, ModelName=score');
      expect(prompt).toContain('Output a title on a separate line starting with "Title:"');
      expect(prompt).toContain('Title: title within 10 words');
      expect(prompt).not.toContain('<<<');
      expect(prompt).not.toContain('\n\n');
    });
  });

  describe('buildDiscussPrompt', () => {
    it('should build a fixed-format Chinese review prompt', () => {
      const prompt = buildDiscussPrompt('原始问题', '融合结果\n\n第二行');

      expect(prompt).toContain('任务：复核当前融合结果');
      expect(prompt).toContain('[原始问题]');
      expect(prompt).toContain('原始问题');
      expect(prompt).toContain('[当前融合结果]');
      expect(prompt).toContain('融合结果\n第二行');
      expect(prompt).toContain('输出规则：');
      expect(prompt).toContain('不要重写完整答案，只输出需要修正、补充或反对的内容');
      expect(prompt).toContain('如果没有异议，只输出：同意当前融合结果，无新增修正');
      expect(prompt).toContain('禁止使用表格；对比内容使用编号列表');
      expect(prompt).toContain('如存在冲突，说明冲突点、各方立场和你的判断结论');
      expect(prompt).not.toContain('任务：输出你的最终答案');
      expect(prompt).not.toContain('轮次：');
      expect(prompt).not.toContain('输出必须是 Markdown');
      expect(prompt).not.toContain('分点列表或编号列表');
      expect(prompt).not.toContain('\n\n');
    });

    it('removes orphan symbol-only lines from review prompt input', () => {
      const prompt = buildDiscussPrompt('原始问题', '融合结果\n---\n*\n补充内容');

      expect(prompt).toContain('融合结果\n补充内容');
      expect(prompt).not.toContain('\n---\n');
      expect(prompt).not.toContain('\n*\n');
    });

    it('should build a fixed-format English review prompt', () => {
      const prompt = buildDiscussPrompt('Original question', 'Merged result\n\nsecond line', 'en');

      expect(prompt).toContain('Task: Review the current merged result');
      expect(prompt).toContain('[Original Question]');
      expect(prompt).toContain('Original question');
      expect(prompt).toContain('[Current Merged Result]');
      expect(prompt).toContain('Output Rules:');
      expect(prompt).toContain('Do not rewrite the full answer; output only corrections, additions, or objections');
      expect(prompt).toContain('If there is no objection, output only: Agree with the current merged result; no new corrections');
      expect(prompt).toContain('Do not use tables; use numbered lists for comparisons');
      expect(prompt).toContain('If there is a conflict, state the conflict, each position, and your judgment');
      expect(prompt).not.toContain('Task: Output your final answer');
      expect(prompt).not.toContain('Round: 2/4');
      expect(prompt).not.toContain('Output must be Markdown');
      expect(prompt).not.toContain('bullet or numbered lists');
      expect(prompt).not.toContain('\n\n');
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
