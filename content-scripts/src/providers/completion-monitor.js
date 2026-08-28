// completion-monitor.js — 完成监控（按钮状态 + MutationObserver）
// 日志前缀：text-injection:completion
// Extracted from text-injection-all-providers.js

import { detectProvider } from './detection.js';
import { DIRECT_ANSWER_SELECTORS } from './answer-selectors.js';
import { extractByDirectSelector, extractByProviderExtractor } from './answer-extraction.js';
import { isVisibleElement, getExtractMode } from './dom-utils.js';
import { postToExtensionParent, postCompletionDiagnostic } from './messaging.js';
import {
  KIMI_COMPLETION_POLICY,
  getKimiTerminalResponseSignature
} from './kimi/completion-policy.js';
import {
  STOP_BUTTON_SELECTORS,
  BUTTON_APPEAR_TIMEOUT_MS,
  BUTTON_DISAPPEAR_SETTLE_MS,
  SSE_COMPLETION_LAYERS,
  SSE_SUPPORTED_PROVIDERS
} from './completion-constants.js';

// Re-export constants for existing importers
export { STOP_BUTTON_SELECTORS, SSE_SUPPORTED_PROVIDERS } from './completion-constants.js';

// ===== 模块级状态 =====

let completionObserver = null;
let completionStableTimer = null;
let completionPhase = null;            // 'button-watch-appear' | 'button-watch-disappear' | 'mutation-fallback' | null
let completionProvider = null;
let completionButtonTimeout = null;    // timeout for falling back to MutationObserver
let completionButtonObserver = null;   // MutationObserver watching for stop button DOM changes
let completionAlreadyDetected = false; // prevent duplicate COMPLETION_DETECTED from SSE path
let completionMergeSessionId = null;
let completionMonitorDelayTimer = null; // delay before starting DOM fallback
let completionDeepseekFallbackTimer = null; // DeepSeek answer-stability fallback
let completionTerminalPollTimer = null; // provider terminal-error fallback
let beforeunloadListenerAdded = false; // Issue 8: track whether beforeunload cleanup is registered
let completionWatchdogTimer = null;    // fires a state dump if completion is never detected
let completionSawStopButton = false;   // whether the stop button was observed during this monitor session

// 看门狗必须早于面板的 merge-monitor 超时（120s）触发，这样导出的日志里
// 一定带着 completion 监控器的现场快照，而不是只有一句「等待回答超时」
const COMPLETION_WATCHDOG_MS = 95000;

// 测量答案总长度。答案容器可能位于小 iframe 的可视区域之外（页面未滚到底），
// 忽略视口位置检查，但保留 display/visibility/aria-hidden 过滤
function readCompletionAnswer(provider) {
  const directAnswer = extractByDirectSelector(provider);
  if (directAnswer) return directAnswer;

  // The regular answer collector already has maintained provider extractors.
  // Reuse that provider-owned contract when direct completion selectors miss,
  // but do not use generic page-text fallbacks because they can include the
  // user's prompt and cause an early false completion.
  return extractByProviderExtractor(provider) || '';
}

function measureAnswerLength(provider) {
  const extractedAnswer = readCompletionAnswer(provider);
  if (extractedAnswer) return extractedAnswer.length;

  const selectors = DIRECT_ANSWER_SELECTORS[provider];
  if (!selectors) return 0;
  let len = 0;
  for (const sel of selectors) {
    try {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        if (getExtractMode() || isVisibleElement(el, { ignoreViewport: true })) {
          len += (el.textContent || '').trim().length;
        }
      }
    } catch (_) {}
  }
  return len;
}

// 注入时刻的答案长度基线。MONITOR_COMPLETION 在全部 provider 发完后才到，
// 快速 provider（2026-07-21 日志：zhipu）在监控布防前就已答完，
// 「基线之后没有变化」会把已完成误判成没开始。长度相对注入基线的
// 任何差异（增长或旧答案被替换成更短的新答案）都算观察到答案变化
let injectionAnswerBaseline = null;
let injectionAnswerSnapshot = null;
let injectionTerminalResponseSignature = '';

// 最后一次观察到答案长度变化的时间戳，看门狗快照用它区分
// 「卡死」（很久没变化）和「还在流式生成」（刚刚还在变）
let lastAnswerChangeAt = 0;

export function noteInjectionForCompletion() {
  const provider = detectProvider();
  if (!provider) return;
  injectionAnswerSnapshot = readCompletionAnswer(provider);
  injectionAnswerBaseline = injectionAnswerSnapshot.length;
  injectionTerminalResponseSignature = provider === 'kimi'
    ? getKimiTerminalResponseSignature()
    : '';
}

function clearCompletionWatchdog() {
  if (completionWatchdogTimer) {
    clearTimeout(completionWatchdogTimer);
    completionWatchdogTimer = null;
  }
}

// SSE 完成、STOP_MONITORING 等「监控会话彻底结束」的入口在
// text-injection-entry.js，需要它能清看门狗；阶段切换内部的
// stopCompletionMonitor 故意不清（看门狗要活过整个监控会话）
export { clearCompletionWatchdog };

// 监控卡死时的现场快照：每个停止按钮/答案选择器的匹配数与可见数、
// 输入框残留文本长度、可见性状态。日志里靠它区分「没发送出去」
// 「按钮选择器失效」「答案选择器失效」「元素不可见」四类根因。
// 选择器快照用扁平字符串而非嵌套对象——导出的 compactDebugValue
// 会把深层对象压成占位符，扁平字符串能完整进日志
function describeCompletionStateForLog(provider) {
  const describeSelectorGroup = selectors => (selectors || []).map(selector => {
    let count = 0;
    let visible = 0;
    let textLen = 0;
    try {
      const elements = document.querySelectorAll(selector);
      count = elements.length;
      elements.forEach(el => {
        if (getExtractMode() || isVisibleElement(el)) {
          visible++;
          textLen += (el.textContent || '').trim().length;
        }
      });
    } catch (_) {}
    return `${selector} count=${count} visible=${visible} textLen=${textLen}`;
  });

  const composer = document.querySelector('textarea, [contenteditable="true"]');
  const composerText = composer ? (composer.value ?? composer.textContent ?? '') : null;
  const composerTextLen = composerText === null ? null : composerText.trim().length;

  // 推断提交状态
  let submitStatus = 'unknown';
  if (composerTextLen !== null && composerTextLen > 0) {
    submitStatus = 'not-submitted';
  } else if (completionSawStopButton) {
    submitStatus = 'generating';
  } else if (injectionAnswerBaseline !== null && lastAnswerChangeAt === 0) {
    submitStatus = 'selector-miss';
  } else if (lastAnswerChangeAt && Date.now() - lastAnswerChangeAt > 30000) {
    submitStatus = 'stalled';
  }

  return {
    provider,
    phase: completionPhase,
    sawStopButton: completionSawStopButton,
    stopSelectors: describeSelectorGroup(STOP_BUTTON_SELECTORS[provider]),
    answerSelectors: describeSelectorGroup(DIRECT_ANSWER_SELECTORS[provider]),
    composerTextLen,
    injectionBaseline: injectionAnswerBaseline,
    lastAnswerChangeAgoMs: lastAnswerChangeAt ? Date.now() - lastAnswerChangeAt : null,
    submitStatus,
    extractMode: getExtractMode(),
    inIframe: window.parent !== window,
    visibilityState: document.visibilityState,
    viewport: `${window.innerWidth}x${window.innerHeight}`
  };
}

// ===== 函数 =====

// Issue 8: Clean up MutationObserver on page navigation to prevent leaked observers.
export function handleBeforeUnload() {
  clearCompletionWatchdog();
  stopCompletionMonitor();
}

export function stopCompletionMonitor() {
  if (completionObserver) {
    completionObserver.disconnect();
    completionObserver = null;
  }
  if (completionStableTimer) {
    clearTimeout(completionStableTimer);
    completionStableTimer = null;
  }
  if (completionButtonTimeout) {
    clearTimeout(completionButtonTimeout);
    completionButtonTimeout = null;
  }
  if (completionButtonObserver) {
    completionButtonObserver.disconnect();
    completionButtonObserver = null;
  }
  if (completionMonitorDelayTimer) {
    clearTimeout(completionMonitorDelayTimer);
    completionMonitorDelayTimer = null;
  }
  if (completionDeepseekFallbackTimer) {
    clearInterval(completionDeepseekFallbackTimer);
    completionDeepseekFallbackTimer = null;
  }
  if (completionTerminalPollTimer) {
    clearInterval(completionTerminalPollTimer);
    completionTerminalPollTimer = null;
  }
  completionPhase = null;
  completionProvider = null;
}

/**
 * Check if a stop button is currently visible on the page.
 */
export function isStopButtonPresent(provider) {
  const selectors = STOP_BUTTON_SELECTORS[provider];
  if (!selectors) return false;

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // In extract mode (hidden iframes), check DOM existence only
        if (getExtractMode() || isVisibleElement(el)) {
          return true;
        }
      }
    } catch (_) {}
  }

  return false;
}

/**
 * Phase 2 fallback: MutationObserver on the answer container.
 * Same logic as the original implementation.
 */
export function startMutationFallback(provider) {
  stopCompletionMonitor();
  completionProvider = provider;
  completionPhase = 'mutation-fallback';

  const selectors = DIRECT_ANSWER_SELECTORS[provider] || [];
  const hasProviderExtractor = typeof window.__aichatmerge_extractors?.[provider] === 'function';
  if (selectors.length === 0 && !hasProviderExtractor) {
    console.warn('[CompletionMonitor] No answer extractor for fallback:', provider);
    return;
  }

  // Do not observe only the previous answer element. Most providers append
  // the next answer as a sibling, so observing that old node misses a fast
  // new reply entirely. The observer watches the page body while getAnswerLen
  // below filters changes down to provider answer selectors.
  const targetNode = document.body || document.documentElement;
  if (!targetNode) {
    console.warn('[CompletionMonitor] No document root available for mutation fallback');
    return;
  }

  // Wenxin can pause between search, reasoning and final answer segments.
  // Its protocol-final SSE signal is preferred; 15 seconds is only the
  // fallback when that signal is unavailable.
  const STABLE_DELAY_MS = provider === 'kimi'
    ? KIMI_COMPLETION_POLICY.answerStableMs
    : provider === 'wenxin' || provider === 'zhipu'
      ? 15000
      : 10000;
  // A pre-existing answer must never be treated as the answer to the current
  // prompt.  Arm completion only after this monitoring session observes the
  // answer content change.
  let hasObservedAnswerChange = false;

  function notifyCompletion(reason) {
    console.log('[CompletionMonitor]', reason, 'Provider:', provider);
    stopCompletionMonitor();

    if (!completionAlreadyDetected && (window.__realParent__ || window.parent) !== window) {
      completionAlreadyDetected = true;
      clearCompletionWatchdog();
      // Reuse the formal latest-answer extractor. Choosing the longest DOM
      // match can return an older answer or an entire conversation container.
      let cachedAnswer = '';
      try {
        cachedAnswer = readCompletionAnswer(provider);
      } catch (_) {}
      postToExtensionParent({
        type: 'COMPLETION_DETECTED',
        provider,
        mergeSessionId: completionMergeSessionId,
        context: 'multi-panel-completion',
        cachedAnswer: cachedAnswer || undefined
      });
    }
  }

  function hasNewKimiTerminalResponse() {
    if (provider !== 'kimi') return false;
    const terminalSignature = getKimiTerminalResponseSignature();
    return Boolean(
      terminalSignature &&
      terminalSignature !== injectionTerminalResponseSignature
    );
  }

  const resetStableTimer = () => {
    if (!hasObservedAnswerChange) return;
    if (completionStableTimer) {
      clearTimeout(completionStableTimer);
    }
    completionStableTimer = setTimeout(() => {
      const hasContent = readCompletionAnswer(provider).trim().length > 0;

      if (!hasContent) {
        resetStableTimer();
        return;
      }

      notifyCompletion(`MutationObserver fallback: answer stable for ${STABLE_DELAY_MS}ms.`);
    }, STABLE_DELAY_MS);
  };

  // Track answer content length — only reset stability timer when answer actually changes.
  // This prevents UI noise (button states, animations) from keeping the timer alive.
  let prevAnswerSnapshot = '';

  function getAnswerSnapshot() {
    return readCompletionAnswer(provider);
  }

  // Initialize baseline
  prevAnswerSnapshot = getAnswerSnapshot();
  // 监控布防前答案可能已经生成了一部分（甚至全部）——长度与注入时刻
  // 基线有差异（变长，或旧答案被清掉换成了更短的新答案）就说明
  // 新答案已经来了，按「已观察到变化」直接进入稳定计时
  if (injectionAnswerSnapshot !== null && prevAnswerSnapshot !== injectionAnswerSnapshot) {
    hasObservedAnswerChange = true;
    lastAnswerChangeAt = Date.now();
    resetStableTimer();
  }
  if (hasNewKimiTerminalResponse()) {
    notifyCompletion('Kimi returned a terminal capacity response.');
    return;
  }
  if (provider === 'kimi') {
    // Error cards do not always mutate the observed answer container. A tiny,
    // silent provider-only poll prevents capacity errors from waiting for the
    // 95-second watchdog. The timer is cleared with the monitor.
    completionTerminalPollTimer = setInterval(() => {
      if (hasNewKimiTerminalResponse()) {
        notifyCompletion('Kimi returned a terminal capacity response.');
      }
    }, 500);
  }
  // DeepSeek stable fallback: if answer has been stable long enough with sufficient
  // length, report completion even if button-state detection missed it.
  if (provider === 'deepseek') {
    const DEEPSEEK_FALLBACK_STABLE_MS = 8000;
    const DEEPSEEK_MIN_ANSWER_LENGTH = 30;
    let deepseekFallbackLastLen = prevAnswerSnapshot.length;
    let deepseekFallbackLastChangeAt = Date.now();

    completionDeepseekFallbackTimer = setInterval(() => {
      const curLen = getAnswerSnapshot().length;
      if (curLen !== deepseekFallbackLastLen) {
        deepseekFallbackLastChangeAt = Date.now();
        deepseekFallbackLastLen = curLen;
      }
      const stableMs = Date.now() - deepseekFallbackLastChangeAt;
      if (hasObservedAnswerChange && curLen >= DEEPSEEK_MIN_ANSWER_LENGTH &&
          stableMs >= DEEPSEEK_FALLBACK_STABLE_MS) {
        clearInterval(completionDeepseekFallbackTimer);
        completionDeepseekFallbackTimer = null;
        notifyCompletion(`DeepSeek answer stable for ${stableMs}ms (fallback).`);
      }
    }, 1500);
  }

  completionObserver = new MutationObserver(() => {
    if (hasNewKimiTerminalResponse()) {
      notifyCompletion('Kimi returned a terminal capacity response.');
      return;
    }

    const curAnswerSnapshot = getAnswerSnapshot();
    if (curAnswerSnapshot !== prevAnswerSnapshot) {
      // Answer content changed — AI still generating. Reset stability timer.
      prevAnswerSnapshot = curAnswerSnapshot;
      hasObservedAnswerChange = true;
      lastAnswerChangeAt = Date.now();
      resetStableTimer();
    }
    // else: DOM mutated but answer unchanged (UI noise) — don't reset timer

  });

  completionObserver.observe(targetNode, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log('[CompletionMonitor] MutationObserver fallback armed for provider:', provider,
    'waiting for answer content to change before starting the stability timer');
}

/**
 * Primary method: Button-state monitoring.
 *
 * Flow:
 *  1. Start watching for the stop button to appear (AI started generating).
 *  2. Once stop button appears, switch to watching for it to disappear (AI finished).
 *  3. When stop button disappears, send COMPLETION_DETECTED.
 *
 * If no stop button is detected within BUTTON_APPEAR_TIMEOUT_MS, fall back to
 * MutationObserver approach.
 */
export function startButtonStateMonitor(provider) {
  stopCompletionMonitor();
  completionProvider = provider;
  completionPhase = 'button-watch-appear';

  const stopSelectors = STOP_BUTTON_SELECTORS[provider];
  if (!stopSelectors || stopSelectors.length === 0) {
    console.log('[CompletionMonitor] No stop button selectors for', provider, '— using MutationObserver fallback');
    startMutationFallback(provider);
    return;
  }

  // Helper: check and transition phases
  function evaluateButtonState() {
    const stopPresent = isStopButtonPresent(provider);

    if (completionPhase === 'button-watch-appear' && stopPresent) {
      // Stop button appeared — AI is now generating. Switch to watching for disappearance.
      console.log('[CompletionMonitor] Stop button detected — AI is generating. Watching for completion...');
      completionSawStopButton = true;
      completionPhase = 'button-watch-disappear';
      // Clear the appear-timeout since we found the button
      if (completionButtonTimeout) {
        clearTimeout(completionButtonTimeout);
        completionButtonTimeout = null;
      }
    }

    if (completionPhase === 'button-watch-disappear' && !stopPresent) {
      // Stop button gone — AI finished. Add a short settle delay then report completion.
      if (completionStableTimer) {
        clearTimeout(completionStableTimer);
      }
      completionStableTimer = setTimeout(() => {
        // Double-check: is the stop button still absent?
        if (isStopButtonPresent(provider)) {
          // It came back (maybe a new generation started). Re-enter watch-disappear.
          completionPhase = 'button-watch-disappear';
          evaluateButtonState();
          return;
        }

        console.log('[CompletionMonitor] Stop button disappeared — generation complete. Provider:', provider);
        stopCompletionMonitor();

        if (!completionAlreadyDetected && (window.__realParent__ || window.parent) !== window) {
          completionAlreadyDetected = true;
          clearCompletionWatchdog();
          postToExtensionParent({
            type: 'COMPLETION_DETECTED',
            provider,
            mergeSessionId: completionMergeSessionId,
            context: 'multi-panel-completion'
          });
        }
      }, BUTTON_DISAPPEAR_SETTLE_MS);
    }
  }

  // Observe the entire body for button DOM changes (appear/disappear are structural changes)
  const observerTarget = document.body;
  if (observerTarget) {
    completionButtonObserver = new MutationObserver(() => {
      if (completionPhase !== 'button-watch-appear' && completionPhase !== 'button-watch-disappear') {
        return;
      }
      evaluateButtonState();
    });

    completionButtonObserver.observe(observerTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'data-testid', 'class', 'style', 'disabled', 'aria-disabled']
    });
  }

  // Immediate check — the stop button might already be visible (e.g., if we started
  // monitoring right when generation was already in progress).
  evaluateButtonState();

  // If we are still in the "appear" phase, set a timeout to fall back to MutationObserver.
  if (completionPhase === 'button-watch-appear') {
    completionButtonTimeout = setTimeout(() => {
      if (completionPhase !== 'button-watch-appear') {
        return; // Phase already changed — button was found
      }

      console.log('[CompletionMonitor] No stop button appeared within', BUTTON_APPEAR_TIMEOUT_MS, 'ms — falling back to MutationObserver');
      postCompletionDiagnostic('appear-timeout', provider, describeCompletionStateForLog(provider));
      startMutationFallback(provider);
    }, BUTTON_APPEAR_TIMEOUT_MS);
  }

  console.log('[CompletionMonitor] Button-state monitoring started for provider:', provider, 'phase:', completionPhase);
}

export function acceptsSseCompletion(provider, layer) {
  return (SSE_COMPLETION_LAYERS[provider] || []).includes(layer);
}

export function startCompletionMonitor(mergeSessionId) {
  stopCompletionMonitor();
  completionAlreadyDetected = false;
  completionSawStopButton = false;
  completionMergeSessionId = mergeSessionId || null;

  const provider = detectProvider();
  if (!provider) {
    console.warn('[CompletionMonitor] Provider not detected');
    return;
  }

  // 看门狗：90 秒仍未报完成就dump一份现场快照。不管监控走哪条路、
  // 卡在哪个阶段，日志里都能看到它当时「看到了什么」
  clearCompletionWatchdog();
  lastAnswerChangeAt = 0;
  completionWatchdogTimer = setTimeout(() => {
    completionWatchdogTimer = null;
    if (completionAlreadyDetected) return;
    postCompletionDiagnostic('watchdog-timeout', provider, describeCompletionStateForLog(provider));
  }, COMPLETION_WATCHDOG_MS);

  postCompletionDiagnostic('start', provider, {
    provider,
    extractMode: getExtractMode(),
    inIframe: window.parent !== window,
    visibilityState: document.visibilityState,
    viewport: `${window.innerWidth}x${window.innerHeight}`
  });

  // Issue 8: Register beforeunload listener once to clean up observers on page navigation.
  // Prevents leaked MutationObservers if the page navigates away while monitoring is active.
  // Must be registered before any provider-specific path to cover DOM-first providers
  // (wenxin/zhipu/kimi/gemini/deepseek) which start MutationObservers immediately.
  if (!beforeunloadListenerAdded) {
    window.addEventListener('beforeunload', handleBeforeUnload);
    beforeunloadListenerAdded = true;
  }

  // Wenxin, Zhipu and Kimi may finish a fast response before the old
  // 3-second SSE grace period expired. Start their DOM observer now (before
  // text is injected) so it sees the entire answer change. Kimi previously
  // waited to observe a stop button that had already appeared and vanished,
  // leaving it stuck until the global timeout when its SSE final frame was
  // unavailable.
  if (provider === 'wenxin' || provider === 'zhipu' || provider === 'kimi' || provider === 'gemini' || provider === 'deepseek') {
    console.log('[CompletionMonitor] Starting DOM-first monitor for', provider);
    startMutationFallback(provider);
    return;
  }

  if (SSE_SUPPORTED_PROVIDERS.includes(provider)) {
    // 延迟启动 DOM 检测：给 SSE 检测 3 秒时间
    // 如果 SSE 在 3 秒内完成，completionAlreadyDetected 会被设为 true，DOM 检测不会重复触发
    console.log('[CompletionMonitor] Delaying DOM monitor for', provider, '(waiting 3s for SSE)');
    completionMonitorDelayTimer = setTimeout(() => {
      if (!completionAlreadyDetected) {
        console.log('[CompletionMonitor] SSE not detected after 3s, falling back to DOM for', provider);
        startButtonStateMonitor(provider);
      }
    }, 3000);
    return;
  }

  // Primary: Use button-state monitoring (more reliable)
  startButtonStateMonitor(provider);
}
