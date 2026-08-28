// answer-extractor.js — Answer extraction from panels

import { postToPanelIframe } from './panel-postmessage.js';
import { getPanels } from './state.js';
import { getNonMergePanels } from './send-pipeline.js';
import { getProviderById } from '../../modules/providers.js';
import { isTerminalProviderResponse } from '../../modules/provider-terminal-responses.js';

// ===== Internal State =====
let answerExtractionRequestId = 0;
let pendingAnswerExtractions = new Map();
let isExtractingAnswers = false;
let extractionDepth = 0;
let pendingExtractionPromise = null;
let lastSingleExtractionDiag = null;

function completeAnswerExtraction(requestId, entry) {
  if (!entry || entry.completed) return;
  entry.completed = true;
  clearTimeout(entry.timer);
  if (entry.retryTimer) clearTimeout(entry.retryTimer);
  pendingAnswerExtractions.delete(requestId);
  isExtractingAnswers = false;
  pendingExtractionPromise = null;
  releaseExtractMode();
  entry.resolve(entry.answers);
}

// ===== Extract Mode =====
export function setExtractMode(enabled, panels) {
  panels.forEach(panel => {
    if (panel.iframe && panel.iframe.contentWindow) {
      postToPanelIframe(panel, {
        type: 'SET_EXTRACT_MODE',
        enabled
      });
    }
  });
}

export function acquireExtractMode() {
  extractionDepth++;
  if (extractionDepth === 1) {
    setExtractMode(true, getPanels());
  }
}

export function releaseExtractMode() {
  extractionDepth--;
  if (extractionDepth <= 0) {
    extractionDepth = 0;
    setExtractMode(false, getPanels());
  }
}

// ===== Answer Extraction =====
export async function extractAllAnswers({ timeoutMs = 25000, excludeUnreachablePanels = false } = {}) {
  if (isExtractingAnswers && pendingExtractionPromise) {
    console.warn('[CopyAll] Extraction already in progress, waiting for current extraction');
    return pendingExtractionPromise;
  }
  isExtractingAnswers = true;

  const requestId = ++answerExtractionRequestId;
  acquireExtractMode();

  pendingExtractionPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const entry = pendingAnswerExtractions.get(requestId);
      if (entry) {
        completeAnswerExtraction(requestId, entry);
      } else {
        isExtractingAnswers = false;
        pendingExtractionPromise = null;
        releaseExtractMode();
        resolve([]);
      }
    }, Math.max(0, Number(timeoutMs) || 0));

    const answers = [];
    pendingAnswerExtractions.set(requestId, {
      resolve,
      timer: timeout,
      answers,
      completed: false,
      retryTimer: null,
    });

    const targetPanels = getNonMergePanels().filter(panel =>
      !excludeUnreachablePanels || panel.contentScriptReachable !== false
    );
    const entry = pendingAnswerExtractions.get(requestId);
    if (entry) entry.targetPanelIds = new Set(targetPanels.map(panel => panel.id));
    let sentCount = 0;
    targetPanels.forEach(panel => {
      if (panel.iframe && panel.iframe.contentWindow) {
        postToPanelIframe(panel, {
          type: 'EXTRACT_ANSWER',
          requestId,
          panelId: panel.id,
          context: 'multi-panel'
        });
        sentCount++;
      }
    });

    if (sentCount === 0) {
      clearTimeout(timeout);
      pendingAnswerExtractions.delete(requestId);
      releaseExtractMode();
      isExtractingAnswers = false;
      pendingExtractionPromise = null;
      resolve([]);
      return;
    }

    const retryTimer = setTimeout(() => {
      const entry = pendingAnswerExtractions.get(requestId);
      if (!entry || entry.completed) return;
      entry.retryTimer = null;
      const responded = entry.respondedPanels || new Set();
      const missing = targetPanels.filter(p => !responded.has(p.id));
      if (missing.length > 0) {
        missing.forEach(panel => {
          if (panel.iframe && panel.iframe.contentWindow) {
            postToPanelIframe(panel, {
              type: 'EXTRACT_ANSWER',
              requestId,
              panelId: panel.id,
              context: 'multi-panel'
            });
          }
        });
      }
    }, 3000);
    const entryForRetry = pendingAnswerExtractions.get(requestId);
    if (entryForRetry) entryForRetry.retryTimer = retryTimer;
  });

  return pendingExtractionPromise;
}

export function extractSinglePanelAnswer(panel) {
  return new Promise((resolve) => {
    if (!panel || !panel.iframe || !panel.iframe.contentWindow) {
      resolve(null);
      return;
    }

    const requestId = `single-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let resolved = false;

    const handler = (event) => {
      if (event?.data?.type === 'EXTRACTED_ANSWER' &&
          event?.data?.context === 'multi-panel-answer' &&
          event?.data?.requestId === requestId) {
        window.removeEventListener('message', handler);
        releaseExtractMode();
        if (!resolved) {
          resolved = true;
          lastSingleExtractionDiag = event.data.extractionDiag || null;
          if (lastSingleExtractionDiag) {
            console.warn('[Extract] Extraction diagnostic:', lastSingleExtractionDiag);
          }
          resolve(event.data.answer || null);
        }
      }
    };
    window.addEventListener('message', handler);

    acquireExtractMode();
    postToPanelIframe(panel, {
      type: 'EXTRACT_ANSWER',
      requestId,
      panelId: panel.id,
      context: 'multi-panel'
    });

    setTimeout(() => {
      window.removeEventListener('message', handler);
      releaseExtractMode();
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 15000);
  });
}

export function handleExtractedAnswer(data) {
  if (!data.requestId || data.context !== 'multi-panel-answer') return;

  const entry = pendingAnswerExtractions.get(data.requestId);
  if (!entry) {
    console.warn('[CopyAll] Received answer but no pending extraction for requestId:', data.requestId);
    return;
  }

  if (!entry.respondedPanels) {
    entry.respondedPanels = new Set();
  }
  if (data.panelId) {
    entry.respondedPanels.add(data.panelId);
  }

  const isTerminalResponse = isTerminalProviderResponse(data.provider, data.answer);
  const hasAnswer = data.answer && data.answer.trim().length > 0 && !isTerminalResponse;

  if (data.provider && hasAnswer) {
    if (!entry.answerMap) entry.answerMap = new Map();
    if (!entry.answerMap.has(data.panelId)) {
      const answerEntry = {
        providerId: data.provider,
        providerName: getProviderById(data.provider)?.name || data.provider,
        answer: data.answer
      };
      entry.answerMap.set(data.panelId, answerEntry);
      entry.answers.push(answerEntry);
    }
  } else if (data.provider && isTerminalResponse) {
    console.warn('[CopyAll] Provider returned a terminal response:', data.provider, 'panelId:', data.panelId);
  } else if (data.provider && !hasAnswer) {
    console.warn('[CopyAll] Panel responded but answer is empty:', data.provider, 'panelId:', data.panelId);
  }

  const targetCount = entry.targetPanelIds?.size ?? getNonMergePanels().length;
  if (entry.respondedPanels.size >= targetCount) {
    completeAnswerExtraction(data.requestId, entry);
  }
}

export function getLastSingleExtractionDiag() {
  return lastSingleExtractionDiag;
}
