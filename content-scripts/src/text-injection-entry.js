// text-injection-entry.js — 主入口
// esbuild 将所有 provider 模块 bundle 成单个 IIFE

// Anti frame-busting: only for sites known to use frame-busting JS
// Makes top === self so frame-busting checks (if top !== self) fail gracefully
// IMPORTANT: Save real parent reference BEFORE overwriting, so content scripts can still reach multi-panel
if ((window.__realParent__ || window.parent) !== window) {
  window.__realParent__ = window.parent;
}
(function() {
  try {
    const host = location.hostname;
    const FRAME_BUSTING_HOSTS = [
      'www.qianwen.com', 'qianwen.com',
      'chatglm.cn', 'www.chatglm.cn',
      'chat.baidu.com', 'www.chat.baidu.com',
      'wenxin.baidu.com', 'www.wenxin.baidu.com',
      'yuanbao.tencent.com'
    ];
    if (!FRAME_BUSTING_HOSTS.some(h => host === h || host.endsWith('.' + h))) return;

    Object.defineProperty(window, 'top', { get: () => window, configurable: true });
    Object.defineProperty(window, 'parent', { get: () => window.__realParent__ || window, configurable: true });
  } catch(e) {}
})();

// ===== Imports =====
import { detectProvider, PROVIDER_SELECTORS, SEND_BUTTON_SELECTORS, NEW_CHAT_BUTTON_SELECTORS } from './providers/detection.js';
import { isVisibleElement, findFirstVisibleElement, findTextInputElement, setExtractMode, getExtractMode } from './providers/dom-utils.js';
import { extensionOrigin, isTrustedExtensionParent, postToExtensionParent, postInjectionResult, postSubmitResult, postSubmitDispatchResult, postInjectionDiagnostic, startMultiPanelUserInteractionTracking, stopMultiPanelUserInteractionTracking } from './providers/messaging.js';
import { handleProviderTransportPing, postProviderTransportReady } from './providers/transport-diagnostics.js';
import { injectTextIntoElement, setFormControlValue, clearRichTextInput } from './providers/text-injection.js';
import { normalizeGoogleProviderMode, handleGoogleTextInjection, clearGoogleInput } from './providers/google-helpers.js';
import { startChatgptSendTracking, stopChatgptSendTracking } from './providers/chatgpt-tracking.js';
import { startClaudeUnavailableWarningMonitor } from './providers/claude-monitor.js';
import { clickSendButton, attemptAutoSubmitOnce, cancelPendingAutoSubmit } from './providers/click-send.js';
import { clickNewChatButton, waitForNewChatButtonReady } from './providers/new-chat.js';
import {
  extractLatestAnswer,
  runHealthCheck,
  cleanCopyText,
  extractByDirectSelector,
  extractByCopyButton,
  extractGenericMarkdownAnswer
} from './providers/answer-extraction.js';
import { startCompletionMonitor, stopCompletionMonitor, acceptsSseCompletion, clearCompletionWatchdog, noteInjectionForCompletion } from './providers/completion-monitor.js';
import { getSseAccumulatedText, resetSseText, accumulateSseText } from './providers/sse-text.js';
import { initDarkMode } from './providers/dark-mode.js';
import { initMetasoSidebarAutoCollapse } from './providers/metaso-sidebar.js';

// ===== Provider Submit Delays =====
const PROVIDER_SUBMIT_DELAYS = {
  deepseek: 800, kimi: 800, doubao: 800,
  qianwen: 1500, wenxin: 1500, metaso: 1500,
  gemini: 1200,
  yuanbao: 900
};
const DEFAULT_SUBMIT_DELAY = 500;

function getElementContentLength(element) {
  if (!element) return 0;
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    return typeof element.value === 'string' ? element.value.length : 0;
  }
  return typeof element.textContent === 'string' ? element.textContent.length : 0;
}

function getSafeClassName(element) {
  const value = typeof element?.className === 'string'
    ? element.className
    : element?.className?.baseVal;
  return typeof value === 'string' ? value.slice(0, 180) : '';
}

function describeComposerForLog(element, matchedSelector, expectedLength, beforeLength) {
  return {
    matchedSelector,
    tagName: element?.tagName || null,
    elementId: element?.id || null,
    className: getSafeClassName(element),
    placeholder: (element?.getAttribute?.('placeholder') || '').slice(0, 120),
    contentEditable: element?.getAttribute?.('contenteditable'),
    visible: isVisibleElement(element),
    disabled: element?.disabled === true,
    ariaDisabled: element?.getAttribute?.('aria-disabled') === 'true',
    expectedLength,
    beforeLength,
    afterLength: getElementContentLength(element),
  };
}

// Rich editors (e.g. kimi's Lexical composer) commit programmatic inserts
// asynchronously: right after injectTextIntoElement returns, textContent can
// still be empty even though the text appears a tick later. Re-measure once
// after a short delay so we only report genuine injection failures.
const COMPOSER_VERIFY_DELAY_MS = 250;

function scheduleComposerVerification(provider, injectionRequestId, element, matchedSelector, expectedLength, beforeLength) {
  if (!(expectedLength > 0)) return;
  setTimeout(() => {
    if (getElementContentLength(element) > 0) return;
    const diagnostics = describeComposerForLog(element, matchedSelector, expectedLength, beforeLength);
    postInjectionDiagnostic('composer-verification-failed', injectionRequestId, provider, diagnostics);
  }, COMPOSER_VERIFY_DELAY_MS);
}

function describeMissingComposerForLog(selectors) {
  const candidates = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')];
  return {
    configuredSelectorCount: Array.isArray(selectors) ? selectors.length : 0,
    candidateCount: candidates.length,
    visibleCandidateCount: candidates.filter(candidate => isVisibleElement(candidate)).length,
    candidateSummary: candidates.slice(0, 8).map(candidate => [
      candidate.tagName,
      candidate.id ? `#${candidate.id}` : '',
      getSafeClassName(candidate) ? `.${getSafeClassName(candidate).split(/\s+/).join('.')}` : '',
      `visible=${isVisibleElement(candidate)}`,
      `disabled=${candidate.disabled === true}`,
      `contenteditable=${candidate.getAttribute('contenteditable') || 'false'}`,
    ].filter(Boolean).join(' ')),
  };
}

function describeSendControlForLog(provider) {
  const selectors = SEND_BUTTON_SELECTORS[provider] || [];
  let matchedSelector = null;
  let element = null;
  for (const selector of selectors) {
    try {
      const candidate = document.querySelector(selector);
      if (candidate) {
        matchedSelector = selector;
        element = candidate;
        break;
      }
    } catch (_) {}
  }
  const activeIcon = provider === 'wenxin'
    ? document.querySelector('#ci-submit-button-ai.ci-submit-button-ai-active')
    : null;
  const control = activeIcon?.closest('.ci-submit-button') || element;
  // 控件没找到时给出页面上疑似发送控件的清单——下次失败日志直接
  // 能看出是「id 变了」还是「页面根本没渲染出按钮」
  const candidates = control ? [] : [...document.querySelectorAll('a, button, [role="button"]')]
    .filter(el => /send|发送/i.test(`${el.id || ''} ${getSafeClassName(el)} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''}`))
    .slice(0, 8)
    .map(el => [
      el.tagName,
      el.id ? `#${el.id}` : '',
      el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '',
      getSafeClassName(el) ? `.${getSafeClassName(el).split(/\s+/).slice(0, 2).join('.')}` : '',
      `visible=${isVisibleElement(el)}`,
      `disabled=${el.disabled === true || el.getAttribute('aria-disabled') === 'true'}`,
    ].filter(Boolean).join(' '));
  return {
    matchedSelector,
    found: !!control,
    tagName: control?.tagName || null,
    elementId: control?.id || null,
    className: getSafeClassName(control),
    visible: control ? isVisibleElement(control) : false,
    disabled: control?.disabled === true,
    ariaDisabled: control?.getAttribute?.('aria-disabled') === 'true',
    active: provider === 'wenxin' ? !!activeIcon : null,
    candidates,
  };
}

function createSubmitCallbacks(provider, injectionRequestId, composerDiagnostics) {
  let lastAttempt = null;
  let dispatchReported = false;
  return {
    onAttempt: attemptDetails => {
      lastAttempt = attemptDetails;
      if (attemptDetails.reason === 'submit-not-confirmed') {
        postInjectionDiagnostic('submit-not-confirmed', injectionRequestId, provider, {
          attempt: attemptDetails.attempt,
          maxAttempts: attemptDetails.maxAttempts,
          composer: composerDiagnostics ? {
            matchedSelector: composerDiagnostics.matchedSelector,
            expectedLength: composerDiagnostics.expectedLength,
            afterLength: composerDiagnostics.afterLength,
          } : null,
        });
      }
    },
    onDispatched: result => {
      if (dispatchReported) return;
      dispatchReported = true;
      postSubmitDispatchResult(injectionRequestId, provider, true);
    },
    onConfirmed: confirmation => {
      postInjectionDiagnostic('submit-confirmed', injectionRequestId, provider, {
        stage: confirmation?.result?.stage || 'submit',
        code: confirmation?.result?.code || null,
        signals: confirmation?.signals || [],
        snapshot: confirmation?.snapshot || null,
      });
      postSubmitResult(injectionRequestId, provider, true, null, {
        stage: confirmation?.result?.stage || 'submit',
        code: confirmation?.result?.code || null,
        signals: confirmation?.signals || [],
        snapshot: confirmation?.snapshot || null,
      });
    },
    onUnconfirmed: confirmation => {
      if (confirmation?.cancelled) {
        postSubmitResult(injectionRequestId, provider, false, 'SUBMIT_CANCELLED', {
          stage: 'submit',
          code: 'SUBMIT_CANCELLED'
        });
        return;
      }
      postInjectionDiagnostic('submit-not-confirmed', injectionRequestId, provider, {
        stage: 'submit',
        code: 'SUBMIT_NOT_CONFIRMED',
        signals: confirmation?.signals || [],
        snapshot: confirmation?.evidence || null,
      });
      postSubmitResult(injectionRequestId, provider, false, 'SUBMIT_NOT_CONFIRMED', {
        stage: 'submit',
        code: 'SUBMIT_NOT_CONFIRMED',
        signals: confirmation?.signals || [],
        snapshot: confirmation?.evidence || null,
      });
    },
    onFailure: result => {
      const code = result?.code || 'SUBMIT_NOT_CONFIRMED';
      if (!dispatchReported) {
        dispatchReported = true;
        postSubmitDispatchResult(injectionRequestId, provider, false, code);
      }
      if (code === 'SUBMIT_CANCELLED') return;
      postInjectionDiagnostic(
        'submit-failed',
        injectionRequestId,
        provider,
        {
          attempts: lastAttempt?.attempt || 0,
          maxAttempts: lastAttempt?.maxAttempts || 0,
          reason: lastAttempt?.reason || 'send-control-not-found',
          stage: result?.stage || 'submit',
          code,
          composer: composerDiagnostics ? {
            matchedSelector: composerDiagnostics.matchedSelector,
            tagName: composerDiagnostics.tagName,
            elementId: composerDiagnostics.elementId,
            visible: composerDiagnostics.visible,
            expectedLength: composerDiagnostics.expectedLength,
            afterLength: composerDiagnostics.afterLength,
          } : null,
          sendControl: describeSendControlForLog(provider)
        }
      );
      clearComposerAfterSubmitFailure(provider);
    }
  };
}

function clearComposerAfterSubmitFailure(provider) {
  if (provider !== 'wenxin') return;
  const element = findFirstVisibleElement(PROVIDER_SELECTORS.wenxin || []);
  if (!element) return;

  const isFormControl = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';
  if (isFormControl) {
    setFormControlValue(element, '');
  } else {
    clearRichTextInput(provider, element);
  }
  stopMultiPanelUserInteractionTracking();
  console.warn('[Text Injection] Cleared Wenxin composer after auto-submit retries were exhausted');
}

// ===== Claude Monitor =====
startClaudeUnavailableWarningMonitor();

// ===== User Interaction → ChatGPT Cleanup =====
// messaging.js interaction handler stops interaction tracking but cannot import
// chatgpt-tracking.js (circular dependency). Handle chatgpt cleanup here instead.
document.addEventListener('pointerdown', () => {
  const provider = detectProvider();
  if (provider === 'chatgpt') {
    stopChatgptSendTracking();
  }
}, true);

// ===== Extract Mode =====
window.addEventListener('message', (event) => {
  if (event?.data?.type === 'SET_EXTRACT_MODE' && isTrustedExtensionParent(event)) {
    setExtractMode(event.data.enabled === true);
  }
});

// Handle text injection message
function handleTextInjection(event) {
  // Validate event data structure
  if (!event || !event.data || typeof event.data !== 'object') {
    return;
  }

  // Handle HEALTH_CHECK messages
  if (event.data.type === 'HEALTH_CHECK' && event.data.context === 'multi-panel') {
    const results = runHealthCheck();
    if ((window.__realParent__ || window.parent) !== window) {
      window.parent.postMessage({
        type: 'HEALTH_CHECK_RESULT',
        results,
        panelId: event.data.panelId,
        requestId: event.data.requestId,
        context: 'multi-panel-health'
      }, extensionOrigin);
    }
    return;
  }

  // Handle CLEAR_INPUT messages
  if (event.data.type === 'CLEAR_INPUT' && event.data.context === 'multi-panel') {
    const provider = detectProvider();
    cancelPendingAutoSubmit('clear-input');
    stopMultiPanelUserInteractionTracking();
    if (provider === 'chatgpt') {
      stopChatgptSendTracking();
    }
    if (provider) {
      const providerMode = provider === 'google'
        ? normalizeGoogleProviderMode(event.data.providerMode)
        : null;

      if (provider === 'google') {
        clearGoogleInput(providerMode);
                return;
      }

      const selectors = PROVIDER_SELECTORS[provider];
      for (const selector of selectors) {
        const element = findTextInputElement(selector);
        if (element) {
          const isTextarea = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';
          if (isTextarea) {
            setFormControlValue(element, '');
          } else {
            clearRichTextInput(provider, element);
          }
                    break;
        }
      }
    }
    return;
  }

  // Handle TRIGGER_SEND messages (send without injecting text)
  if (event.data.type === 'TRIGGER_SEND' && event.data.context === 'multi-panel') {
    const provider = detectProvider();
    cancelPendingAutoSubmit('trigger-send');
    if (provider) {
      const providerMode = provider === 'google'
        ? normalizeGoogleProviderMode(event.data.providerMode)
        : null;
      if (event.data.requestId) {
        startMultiPanelUserInteractionTracking(event.data.requestId, provider);
      } else {
        stopMultiPanelUserInteractionTracking();
      }
      if (provider === 'chatgpt' && event.data.requestId) {
        startChatgptSendTracking(event.data.requestId);
      }
                clickSendButton(provider, providerMode);
    }
    return;
  }

  // Handle NEW_CHAT messages (create new chat)
  if (event.data.type === 'NEW_CHAT' && event.data.context === 'multi-panel') {
    const provider = detectProvider();
    cancelPendingAutoSubmit('new-chat');
    stopMultiPanelUserInteractionTracking();
    if (provider === 'chatgpt') {
      stopChatgptSendTracking();
    }
    const providerMode = provider === 'google'
      ? normalizeGoogleProviderMode(event.data.providerMode)
      : null;
              if (provider) {
            clickNewChatButton(provider, providerMode);
    } else {
      console.warn('[Text Injection] Provider not detected for NEW_CHAT');
    }
    return;
  }

  // Handle NEW_CHAT_WHEN_READY messages (wait for button ready then create new chat)
  if (event.data.type === 'NEW_CHAT_WHEN_READY' && event.data.context === 'multi-panel') {
    const provider = detectProvider();
    cancelPendingAutoSubmit('new-chat-when-ready');
    if (provider === 'claude') {
      waitForNewChatButtonReady().then(ready => {
        if (ready) {
          clickNewChatButton('claude');
        } else {
          // 超时兜底：跳转到新对话页面
          window.location.href = 'https://claude.ai/new';
        }
      });
    }
    return;
  }

  // Handle EXTRACT_ANSWER messages (collect AI responses from the page)
  if (event.data.type === 'EXTRACT_ANSWER' && event.data.context === 'multi-panel') {
    const provider = detectProvider();
    // SSE 文本和 DOM 提取都尝试，严格取更长的那个。千问的 SSE
    // 可能遗漏最后的结构化总结段，不能因为它达到 DOM 的一半就覆盖
    // 更完整的 DOM 提取结果。
    const sseText = getSseAccumulatedText() || '';
    const domText = extractLatestAnswer() || '';
    const extractDiag = window.__aichatmerge_lastExtractDiag || null;
    let answerText;
    if (sseText.length > domText.length && sseText.length > 50) {
      answerText = sseText;
    } else if (domText.length > 0) {
      answerText = domText;
    } else {
      answerText = sseText || domText;
    }
    // 清理引用标记等噪声
    if (answerText) {
      answerText = cleanCopyText(answerText);
    }
    // 附带提取诊断（当答案为空或极短时最有用）
    const extractionDiag = (!answerText || answerText.length < 30) ? {
      sseLen: sseText.length,
      domLen: domText.length,
      finalLen: answerText ? answerText.length : 0,
      extract: extractDiag,
      providerExtractorDiag: window.__aichatmerge_lastExtractDiag || null
    } : undefined;
    if ((window.__realParent__ || window.parent) !== window) {
      postToExtensionParent({
        type: 'EXTRACTED_ANSWER',
        provider: provider,
        panelId: event.data.panelId,
        answer: answerText,
        requestId: event.data.requestId,
        context: 'multi-panel-answer',
        ...(extractionDiag ? { extractionDiag } : {})
      });
    }
    return;
  }

  // Handle EXTRACT_DEBUG messages (diagnostic: return phase-by-phase results)
  if (event.data.type === 'EXTRACT_DEBUG' && event.data.context === 'multi-panel') {
    const provider = detectProvider();
    const debug = { provider, phases: [] };

    const d1 = extractByDirectSelector(provider);
    debug.phases.push({ phase: 1, name: 'direct-selector', hit: !!d1, len: d1 ? d1.length : 0 });

    debug.phases.push({ phase: 2, name: 'provider-extractor', skipped: true });

    const d3 = extractByCopyButton(provider);
    debug.phases.push({ phase: 3, name: 'copy-button', hit: !!d3, len: d3 ? d3.length : 0 });

    const d4 = extractGenericMarkdownAnswer();
    debug.phases.push({ phase: 4, name: 'generic-markdown', hit: !!d4, len: d4 ? d4.length : 0 });

    if ((window.__realParent__ || window.parent) !== window) {
      window.parent.postMessage({ type: 'EXTRACT_DEBUG_RESULT', provider, debug, context: 'multi-panel-debug' }, extensionOrigin);
    }
    return;
  }

  // Only handle INJECT_TEXT messages
  if (event.data.type !== 'INJECT_TEXT') {
    return;
  }

  // Validate text payload
  const text = event.data.text;
  if (!text || typeof text !== 'string' || text.length === 0) {
    console.warn('[Text Injection] Invalid text payload');
    return;
  }

  // Sanity check: reject extremely large payloads (> 1MB)
  if (text.length > 1048576) {
    console.error('[Text Injection] Text payload too large:', text.length, 'bytes');
    return;
  }

  const autoSubmit = event.data.autoSubmit === true;
  const context = event.data.context;

  // Security check: Only allow autoSubmit from trusted contexts
  // This prevents other contexts from accidentally auto-submitting when
  // multi-panel sends messages to its iframes
  const shouldAutoSubmit = autoSubmit && (context === 'multi-panel' || context === 'auto-merge');

  const provider = detectProvider();
  const mergeRequestId = event.data.mergeRequestId;
  const injectionRequestId = event.data.injectionRequestId;
      if (!provider) {
    console.warn('Unknown provider, cannot inject text');
    if (mergeRequestId && window.parent !== window) {
      window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: false, injectSuccess: false, provider: null, error: 'unknown-provider' }, extensionOrigin);
    }
    postInjectionResult(injectionRequestId, null, false, false, 'unknown-provider');
    return;
  }

  const providerMode = provider === 'google'
    ? normalizeGoogleProviderMode(event.data.providerMode)
    : null;

  // 在写入前记录答案长度基线：监控布防（MONITOR_COMPLETION）晚于注入，
  // 快速 provider 可能在布防前就答完，基线让监控识别这种「提前完成」
  noteInjectionForCompletion();

  if (provider === 'chatgpt') {
    if (shouldAutoSubmit && event.data.requestId) {
      startMultiPanelUserInteractionTracking(event.data.requestId, provider);
      startChatgptSendTracking(event.data.requestId);
    } else {
      stopMultiPanelUserInteractionTracking();
      stopChatgptSendTracking();
    }
  } else if (shouldAutoSubmit && event.data.requestId) {
    startMultiPanelUserInteractionTracking(event.data.requestId, provider);
  } else {
    stopMultiPanelUserInteractionTracking();
  }

  if (provider === 'google') {
    const success = handleGoogleTextInjection(text, false, providerMode);
    if (success) {
      postInjectionResult(injectionRequestId, provider, true, true);
      if (shouldAutoSubmit) {
        const submitCallbacks = createSubmitCallbacks(provider, injectionRequestId, null);
        attemptAutoSubmitOnce(
          provider,
          providerMode,
          PROVIDER_SUBMIT_DELAYS.google || DEFAULT_SUBMIT_DELAY,
          text,
          submitCallbacks.onFailure,
          submitCallbacks.onAttempt,
          submitCallbacks.onConfirmed,
          injectionRequestId,
          submitCallbacks.onDispatched,
          submitCallbacks.onUnconfirmed
        );
      }
      return;
    }

    console.warn('[Text Injection] Google editor not found on first try, retrying...');
    [500, 1000].forEach((delay, index, delays) => {
      setTimeout(() => {
        const retried = handleGoogleTextInjection(text, false, providerMode);
        if (!retried && index === delays.length - 1) {
          console.error('[Text Injection] Google editor not found after retries');
          postInjectionResult(injectionRequestId, provider, false, false, 'editor-not-found-after-retry');
        } else if (retried) {
          postInjectionResult(injectionRequestId, provider, true, true);
          if (shouldAutoSubmit) {
            const submitCallbacks = createSubmitCallbacks(provider, injectionRequestId, null);
            attemptAutoSubmitOnce(
              provider,
              providerMode,
              PROVIDER_SUBMIT_DELAYS.google || DEFAULT_SUBMIT_DELAY,
              text,
              submitCallbacks.onFailure,
              submitCallbacks.onAttempt,
              submitCallbacks.onConfirmed,
              injectionRequestId,
              submitCallbacks.onDispatched,
              submitCallbacks.onUnconfirmed
            );
          }
        }
      }, delay);
    });
    return;
  }

  const selectors = PROVIDER_SELECTORS[provider];
  if (!selectors) {
    console.warn('No selectors configured for provider:', provider);
    return;
  }

  // Try each selector until we find an element
  let element = null;
  let matchedSelector = null;
  for (const selector of selectors) {
    element = findTextInputElement(selector);
    if (element) {
      matchedSelector = selector;
            break;
    }
  }

  if (element) {
    const beforeLength = getElementContentLength(element);
    const success = injectTextIntoElement(element, text);
    const diagnostics = describeComposerForLog(element, matchedSelector, text.length, beforeLength);
    if (success) {
      scheduleComposerVerification(provider, injectionRequestId, element, matchedSelector, text.length, beforeLength);
    }
        if (mergeRequestId && window.parent !== window) {
      window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: true, injectSuccess: success, provider }, extensionOrigin);
    }
    postInjectionResult(injectionRequestId, provider, true, success, success ? null : 'injection-failed', diagnostics);
    if (success) {

      // Auto-submit if requested (only from multi-panel context)
      if (shouldAutoSubmit) {
        // Wait for UI to update, then click send button.
        // Use provider-specific delays whose composer state updates asynchronously,
        // matching the injectText() helper used by image injection.
        const delay = PROVIDER_SUBMIT_DELAYS[provider] || DEFAULT_SUBMIT_DELAY;
        const submitCallbacks = createSubmitCallbacks(provider, injectionRequestId, diagnostics);
        attemptAutoSubmitOnce(
          provider,
          providerMode,
          delay,
          text,
          submitCallbacks.onFailure,
          submitCallbacks.onAttempt,
          submitCallbacks.onConfirmed,
          injectionRequestId,
          submitCallbacks.onDispatched,
          submitCallbacks.onUnconfirmed
        );
      }
    } else {
      console.error(`[Text Injection] Failed to inject text into ${provider}`);
    }
  } else {
    console.warn(`[Text Injection] ${provider} editor not found on first try, retrying...`);
    // Retry after a short delay in case page is still loading
    // Use multiple retries for DeepSeek; Grok hydrates late inside small iframes
    const retryDelays = provider === 'deepseek' || provider === 'grok' ? [1000, 2000] : [1000];

    retryDelays.forEach((delay, index) => {
      setTimeout(() => {
        let retryElement = null;
        let retrySelector = null;
        for (const selector of selectors) {
          retryElement = findTextInputElement(selector);
          if (retryElement) {
            retrySelector = selector;
                        break;
          }
        }
        if (retryElement) {
          const beforeLength = getElementContentLength(retryElement);
          const success = injectTextIntoElement(retryElement, text);
          const diagnostics = describeComposerForLog(retryElement, retrySelector, text.length, beforeLength);
          if (success) {
            scheduleComposerVerification(provider, injectionRequestId, retryElement, retrySelector, text.length, beforeLength);
                        if (shouldAutoSubmit) {
              const submitDelay = PROVIDER_SUBMIT_DELAYS[provider] || DEFAULT_SUBMIT_DELAY;
              const submitCallbacks = createSubmitCallbacks(provider, injectionRequestId, diagnostics);
              attemptAutoSubmitOnce(
                provider,
                providerMode,
                submitDelay,
                text,
                submitCallbacks.onFailure,
                submitCallbacks.onAttempt,
                submitCallbacks.onConfirmed,
                injectionRequestId,
                submitCallbacks.onDispatched,
                submitCallbacks.onUnconfirmed
              );
            }
            postInjectionResult(injectionRequestId, provider, true, true, null, diagnostics);
          }
        } else if (index === retryDelays.length - 1) {
          console.error(`[Text Injection] ${provider} editor not found after ${retryDelays.length} retries`);
          console.error('[Text Injection] Available textareas:', document.querySelectorAll('textarea'));
          console.error('[Text Injection] Available contenteditable:', document.querySelectorAll('[contenteditable="true"]'));
          if (mergeRequestId && window.parent !== window) {
            window.parent.postMessage({ type: 'INJECT_TEXT_RECEIVED', mergeRequestId, inputFound: false, injectSuccess: false, provider, error: 'editor-not-found-after-retry' }, extensionOrigin);
          }
          postInjectionResult(
            injectionRequestId,
            provider,
            false,
            false,
            'editor-not-found-after-retry',
            describeMissingComposerForLog(selectors)
          );
        }
      }, delay);
    });
  }
}

// Listen for messages from the multi-panel host and SSE bridge
window.addEventListener('message', (event) => {
  if (!event || !event.data || typeof event.data !== 'object') return;

  const isSameFrameSseMessage = event.source === window &&
    event.origin === window.location.origin &&
    ['__sse_text_reset__', '__sse_text__', '__sse_complete__'].includes(event.data.type);

  // Do not accept commands from an arbitrary page that embeds this provider.
  if (!isSameFrameSseMessage && !isTrustedExtensionParent(event)) {
    console.warn('[MessageHandler] Rejected message from an untrusted origin');
    return;
  }

  // SSE 文本重置：新对话开始时清空累积文本
  if (event.data.type === '__sse_text_reset__') {
    resetSseText();
    return;
  }

  // SSE 文本累积：逐 chunk 累积正式内容
  if (event.data.type === '__sse_text__') {
    if (event.data.text) {
      accumulateSseText(event.data.text, event.data.isThink);
    }
    return;
  }

  // SSE检测完成：仅停止 DOM 监控。
  // 修复 #6：COMPLETION_DETECTED 的转发职责已统一由 sse-bridge.js 承担，
  // 此处不再重复转发，避免 parent 收到双重完成信号。
  if (event.data.type === '__sse_complete__') {
    const sseProvider = event.data.provider || detectProvider();
    if (!acceptsSseCompletion(sseProvider, event.data.layer)) {
            return;
    }
            clearCompletionWatchdog();
    stopCompletionMonitor();
    return;
  }

  if (handleProviderTransportPing(event.data)) return;

  if (event.data.type === 'MONITOR_COMPLETION' && event.data.context === 'multi-panel') {
    startCompletionMonitor(event.data.mergeSessionId);
    return;
  }

  if (event.data.type === 'STOP_MONITORING' && event.data.context === 'multi-panel') {
    cancelPendingAutoSubmit('stop-monitoring');
    clearCompletionWatchdog();
    stopCompletionMonitor();
    return;
  }

  // Delegate to existing handler
  handleTextInjection(event);
});

// Announce only after the trusted-message listener is installed. If this
// message never reaches the panel, parent-side PING diagnostics distinguish a
// missing/stale content script from an input selector failure.
postProviderTransportReady();

// ===== Dark Mode for Iframes =====
initDarkMode();

// ===== Metaso Sidebar =====
initMetasoSidebarAutoCollapse();
