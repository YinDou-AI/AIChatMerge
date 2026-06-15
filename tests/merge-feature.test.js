/**
 * Standalone tests for the merge/fusion feature logic.
 *
 * Since multi-panel.js is a ~3270-line file with heavy DOM dependencies,
 * we replicate the testable pure functions here and test their behavior directly.
 * This ensures the logic is validated even when the module itself cannot be imported.
 *
 * Source of truth: multi-panel/multi-panel.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ===== Replicated pure functions from multi-panel/multi-panel.js =====

/**
 * Build the prompt sent to the merge (fusion) AI model.
 * Source: multi-panel/multi-panel.js line 2494
 */
function buildMergePrompt(question, answers) {
  const parts = answers.map(a => `【${a.providerName}】\n${a.answer}`);
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  return `今天是${today}，你是一名专业的AI回答评审员。
【原始问题】
${question}
【各AI回答】
${parts.join('\n')}
请对比以上多个AI模型的回答，执行以下任务：
1. 根据今天日期，搜索最新信息，去除过时或错误的信息
2. 将相似观点归类合并，只总结推荐排名前50%的方案，至少保留3个最佳选择
3. 按以下格式输出：
【观点名称】
- 支持模型：[列出模型名称]
- 依据：[简述理由]
...（逐个观点列出）
【最终建议】
综合以上分析，给出推荐方案及理由。`;
}

/**
 * Check whether a panel is a merge panel.
 * Source: multi-panel/multi-panel.js line 1589
 */
function isMergePanel(mergePanelIds, panel) {
  return mergePanelIds.has(panel.id);
}

/**
 * Filter panels to exclude merge panels.
 * Source: multi-panel/multi-panel.js line 1593
 */
function getNonMergePanels(mergePanelIds, panels) {
  return panels.filter(p => !isMergePanel(mergePanelIds, p));
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

      expect(prompt).toContain('你是一名专业的AI回答评审员');
      expect(prompt).toContain(question);
      expect(prompt).toContain('【ChatGPT】');
      expect(prompt).toContain('Python is very versatile.');
      expect(prompt).toContain('【Claude】');
      expect(prompt).toContain('TypeScript offers type safety.');
      expect(prompt).toContain('【原始问题】');
      expect(prompt).toContain('【各AI回答】');
      expect(prompt).toContain('【最终建议】');
    });

    it('should include today date in zh-CN format', () => {
      const prompt = buildMergePrompt('test', [
        { providerName: 'A', answer: 'answer' },
      ]);

      // The date string should be somewhere in the prompt header
      expect(prompt).toMatch(/^今天是.+，你是一名专业的AI回答评审员/);
    });

    it('should handle a single answer', () => {
      const prompt = buildMergePrompt('Hello', [
        { providerName: 'Gemini', answer: 'Hi there!' },
      ]);

      expect(prompt).toContain('【Gemini】');
      expect(prompt).toContain('Hi there!');
      // Should still have the full template
      expect(prompt).toContain('请对比以上多个AI模型的回答');
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
      expect(prompt).toContain('【原始问题】\n\n');
      expect(prompt).toContain('【各AI回答】');
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

      expect(prompt).toContain('支持模型：');
      expect(prompt).toContain('依据：');
      expect(prompt).toContain('最终建议');
      expect(prompt).toContain('排名前50%');
      expect(prompt).toContain('至少保留3个最佳选择');
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
});
