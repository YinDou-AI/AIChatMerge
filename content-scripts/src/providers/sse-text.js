// sse-text.js — SSE 文本累积
// 日志前缀：text-injection:sse

let sseAccumulatedText = '';
let sseAccumulatedThink = '';

export function getSseAccumulatedText() { return sseAccumulatedText; }
export function getSseAccumulatedThink() { return sseAccumulatedThink; }

export function resetSseText() {
  sseAccumulatedText = '';
  sseAccumulatedThink = '';
}

export function accumulateSseText(text, isThink) {
  if (!text) return;
  if (isThink) {
    sseAccumulatedThink += text;
  } else {
    sseAccumulatedText += text;
  }
}
