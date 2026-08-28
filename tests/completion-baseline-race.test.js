import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// zhipu 竞态的行为级回归：MONITOR_COMPLETION 在全部 provider 发完后才到，
// 快速 provider 布防前就答完。2026-07-21 日志：zhipu 答案 222 字可见
// 但监控 90 秒未报完成。修复 = 注入时记录答案长度基线，布防时与基线
// 有差异（变长或变短）即按「已观察到变化」进入稳定计时
const postToExtensionParent = vi.fn();
const postCompletionDiagnostic = vi.fn();

vi.mock('../content-scripts/src/providers/messaging.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    postToExtensionParent: (...args) => postToExtensionParent(...args),
    postCompletionDiagnostic: (...args) => postCompletionDiagnostic(...args),
  };
});

function markRendered(element) {
  element.getBoundingClientRect = () => ({
    top: 10, left: 10, right: 400, bottom: 200, width: 390, height: 190,
  });
}

async function importMonitor() {
  return import('../content-scripts/src/providers/completion-monitor.js');
}

describe('completion monitor injection baseline (zhipu race)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.happyDOM.setURL('https://chatglm.cn/');
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage: vi.fn() },
    });
    postToExtensionParent.mockClear();
    postCompletionDiagnostic.mockClear();
  });

  afterEach(async () => {
    const monitor = await importMonitor();
    monitor.stopCompletionMonitor();
    vi.useRealTimers();
  });

  it('completes when the answer finished before the monitor armed', async () => {
    document.body.innerHTML = '<div class="markdown-body md-body">旧答案</div>';
    const answer = document.querySelector('.markdown-body');
    markRendered(answer);

    const monitor = await importMonitor();
    // 注入时刻：页面只有旧答案，基线 = 3
    monitor.noteInjectionForCompletion();

    // 发送后答案迅速生成完毕（布防之前）：旧答案被替换成完整新答案
    answer.textContent = '这是已经完整生成的新答案，长度明显超过注入基线'.repeat(10);

    // 监控布防：应识别「与基线有差异」→ 稳定 15 秒后报完成
    monitor.startCompletionMonitor('merge-race');
    await vi.advanceTimersByTimeAsync(16000);

    const completions = postToExtensionParent.mock.calls.filter(
      args => args[0]?.type === 'COMPLETION_DETECTED'
    );
    expect(completions.length).toBe(1);
    expect(completions[0][0].provider).toBe('zhipu');
  });

  it('completes when the new answer is shorter than the replaced old one', async () => {
    const longOld = '旧答案很长'.repeat(60);
    document.body.innerHTML = `<div class="markdown-body md-body">${longOld}</div>`;
    const answer = document.querySelector('.markdown-body');
    markRendered(answer);

    const monitor = await importMonitor();
    monitor.noteInjectionForCompletion();

    // 新答案更短：> 判断会漏，!== 才能识别（2026-07-21 wenxin/zhipu 场景）
    answer.textContent = '短新答案';

    monitor.startCompletionMonitor('merge-race-short');
    await vi.advanceTimersByTimeAsync(16000);

    const completions = postToExtensionParent.mock.calls.filter(
      args => args[0]?.type === 'COMPLETION_DETECTED'
    );
    expect(completions.length).toBe(1);
  });

  it('does not complete when nothing changed since injection', async () => {
    document.body.innerHTML = '<div class="markdown-body md-body">旧答案还在</div>';
    const answer = document.querySelector('.markdown-body');
    markRendered(answer);

    const monitor = await importMonitor();
    monitor.noteInjectionForCompletion();

    // 没有任何变化：预存答案绝不能被当成本次回答
    monitor.startCompletionMonitor('merge-no-change');
    await vi.advanceTimersByTimeAsync(30000);

    const completions = postToExtensionParent.mock.calls.filter(
      args => args[0]?.type === 'COMPLETION_DETECTED'
    );
    expect(completions.length).toBe(0);
  });
});
