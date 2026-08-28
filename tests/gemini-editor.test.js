import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getGeminiEditorText,
  hasExpectedGeminiText,
  injectTextIntoGeminiEditor
} from '../content-scripts/src/providers/gemini-editor.js';

describe('Gemini editor injection', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="ql-editor" contenteditable="true"></div>';

    if (typeof window.DataTransfer !== 'function') {
      window.DataTransfer = class DataTransfer {
        constructor() {
          this.data = new Map();
        }

        setData(type, value) {
          this.data.set(type, value);
        }

        getData(type) {
          return this.data.get(type) || '';
        }
      };
    }

    if (typeof window.ClipboardEvent !== 'function') {
      window.ClipboardEvent = class ClipboardEvent extends Event {
        constructor(type, options = {}) {
          super(type, options);
          this.clipboardData = options.clipboardData || null;
        }
      };
    }

    globalThis.DataTransfer = window.DataTransfer;
    globalThis.ClipboardEvent = window.ClipboardEvent;
    document.execCommand = vi.fn(() => false);
  });

  it('keeps a complete multi-line Gemini prompt when paste does not commit text', () => {
    const editor = document.querySelector('.ql-editor');
    const execCommand = vi.spyOn(document, 'execCommand');
    const prompt = [
      '任务：复核当前融合结果。当前日期：2026年7月6日星期一',
      '',
      '要求：',
      '1. 对比所有 AI 的回答',
      '2. 输出最终融合结论'
    ].join('\n');

    const result = injectTextIntoGeminiEditor(editor, prompt);

    expect(result).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('selectAll', false, null);
    expect(hasExpectedGeminiText(prompt)).toBe(true);
    expect(getGeminiEditorText()).toContain('输出最终融合结论');
  });

  it('accepts Gemini text when expected lines are present in order', () => {
    const editor = document.querySelector('.ql-editor');
    editor.innerHTML = '<p>任务：复核当前融合结果。</p><p>输出最终融合结论</p>';

    expect(hasExpectedGeminiText('任务：复核当前融合结果。\n输出最终融合结论')).toBe(true);
  });
});
