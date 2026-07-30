// merge-prompt.js — Prompt builders and text sanitization

import { t, getCurrentLocale } from './i18n.js';
import { getLastMergeType } from './merge-monitor.js';

// ===== Merge Badge =====
export function getMergeBadgeMeta(type) {
  if (type === undefined) type = getLastMergeType();
  if (type === 'auto') {
    return {
      background: '#10b981',
      text: t('autoMerge'),
      title: ''
    };
  }

  if (type === 'manual') {
    return {
      background: '#64748b',
      text: t('manualMerge'),
      title: ''
    };
  }

  return {
    background: '#f59e0b',
    text: t('timeoutMerge'),
    title: t('mergeTimeoutTooltip')
  };
}

export function generateFallbackTitle() {
  const now = new Date();
  const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `AI融合-${now.toISOString().slice(0, 10)}-${hhmmss}`;
}

export function isTrueSetting(value) {
  return value === true || value === 'true';
}

// ===== Text Sanitization =====
export function isMeaninglessStandaloneSymbolLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;
  return /^[\-–—_*•·.,，、;；:：|/\\()[\]{}<>《》【】"'""''`~!！?？=+^$#@%&]+$/.test(trimmed);
}

export function sanitizeMergedAnswerForDiscussion(answer) {
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

export function normalizeAnswerForMerge(answer) {
  return sanitizeMergedAnswerForDiscussion(answer);
}

export function normalizeAnswerForStability(answer) {
  return String(answer || '').replace(/\s+/g, ' ').trim();
}

// ===== Prompt Builders =====
export function buildMergePrompt(question, answers, panels, mergePanelIds, autoExportToMarkdown) {
  const currentLocale = getCurrentLocale();
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
1. Prioritize the most recent information; remove clearly outdated data
2. Synthesize useful content from each response and remove duplicates; when models disagree, preserve each position and cite the source model
3. Output a complete answer that can be delivered directly to the user
4. Use Markdown, no tables
5. The first line must be the title, format: Title: title within 10 words; then output the complete body; the last line must be the scores, starting with "Model scores:", full score is 10, format: Model scores: ModelName=score, ModelName=score`.replace(/\n{2,}/g, '\n');
  }

  return `你是一位答案综合者。当前日期：${today}
[原始问题]
${question}
[各模型回答]
${parts}
规则：
1. 以最新的信息为准，删除明显过时的数据
2. 综合各回答的有效内容并去重，有分歧时保留各方立场，注明来源
3. 输出一份可以直接交付给用户的完整答案
4. 使用 Markdown 输出，不用表格
5. 第一行必须是标题，格式：标题：标题内容（10字以内）；随后输出完整正文；最后一行输出评分，满分10分，必须以"模型评分："开头，格式：模型评分：模型名=分数，模型名=分数`.replace(/\n{2,}/g, '\n');
}

export function buildFinalMergePrompt(question, previousMergedAnswer, reviewAnswers) {
  const currentLocale = getCurrentLocale();
  const isEn = currentLocale === 'en';
  const today = new Date().toLocaleDateString(isEn ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const reviewParts = reviewAnswers.map(a => `【${a.providerName}】\n${normalizeAnswerForMerge(a.answer)}`).join('\n');

  if (isEn) {
    return `You produce the final answer after a review round. Today: ${today}
[Original Question]
${question}
[Previous Merged Result]
${normalizeAnswerForMerge(previousMergedAnswer)}
[Review Comments From Models]
${reviewParts}
Rules:
1. Integrate valid corrections, additions, and objections into one complete final answer
2. Treat "agree/no new corrections" responses as support, not as answer content
3. Prioritize recent and reliable information; explain conflicts when needed
4. Use Markdown, no tables
5. The first line must be the title, format: Title: title within 10 words; then output the complete body; the last line must be the scores, starting with "Model scores:", full score is 10, format: Model scores: ModelName=score, ModelName=score`.replace(/\n{2,}/g, '\n');
  }

  return `你负责生成讨论后的最终答案。当前日期：${today}
[原始问题]
${question}
[上一版融合结果]
${normalizeAnswerForMerge(previousMergedAnswer)}
[各模型复核意见]
${reviewParts}
规则：
1. 整合各模型复核意见中的有效修正、补充和反对意见，输出一份可直接交付的完整最终答案
2. 对“同意当前融合结果、无新增修正”类回答，只视为支持，不写入正文
3. 以最新、可靠的信息为准；复核意见冲突时给出判断
4. 使用 Markdown 输出，不用表格
5. 第一行必须是标题，格式：标题：标题内容（10字以内）；随后输出完整正文；最后一行输出评分，满分10分，必须以"模型评分："开头，格式：模型评分：模型名=分数，模型名=分数`.replace(/\n{2,}/g, '\n');
}

export function buildDiscussPrompt(question, mergedAnswer) {
  const currentLocale = getCurrentLocale();
  const isEn = currentLocale === 'en';
  const today = new Date().toLocaleDateString(isEn ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const cleanMergedAnswer = sanitizeMergedAnswerForDiscussion(mergedAnswer);

  if (isEn) {
    return `Task: Review the current merged result. Current date: ${today}
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
