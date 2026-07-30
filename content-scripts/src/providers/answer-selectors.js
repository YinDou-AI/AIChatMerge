// answer-selectors.js — 答案提取选择器常量
// 从 answer-extraction.js 拆分

import { DOUBAO_ANSWER_SELECTORS } from './doubao/selectors.js';

// ===== Direct Answer Selectors (Phase 1) =====
export const DIRECT_ANSWER_SELECTORS = {
  chatgpt: [
    '[data-message-author-role="assistant"] .markdown-body',
    '[data-message-author-role="assistant"]',
  ],
  claude: [
    '[data-message-role="assistant"]',
    '.font-claude-message',
  ],
  gemini: [
    '.model-response-text',
    'model-response .markdown-main-panel',
    'model-response .markdown',
    'model-response',
    '.response-content .markdown',
    '.markdown-main-panel',
    '[data-message-author-role="model"]',
  ],
  grok: [
    '.response-content-markdown',
    '.message-content .markdown-body',
    '[role="log"] .markdown-body',
  ],
  deepseek: [
    '.ds-assistant-message-main-content',
    '.ds-chat-message:not([class*="user"]):not([class*="system"])',
  ],
  kimi: [
    '.markdown-container',
    '.markdown-container .markdown',
    '.markdown',
    '.kimi-message-content',
    '.message-list [class*="message"]'
  ],
  doubao: DOUBAO_ANSWER_SELECTORS,
  qianwen: [
    '.qk-markdown-complete',
    '#qk-markdown-react',
    '.qk-markdown',
    '[class*="qk-markdown"]',
    '[class*="markdown-body"]',
    '.markdown-body',
  ],
  zhipu: ['.markdown-body.md-body', '.markdown-body', '.content-markdown'],
  wenxin: ['.cosd-markdown-content', '.ai-entry-block.ai-markdown', '.custom-html.md-stream-desktop', '.md-stream-desktop', '.markdown-body'],
  metaso: ['[class*="result-responsive-layer"] .markdown-body'],
  google: ['.markdown-body'],
};

// ===== Copy Button Selectors (Phase 3) =====
export const COPY_BUTTON_SELECTORS = {
  chatgpt: [
    'button[aria-label="Copy"]',
    'button[data-testid="copy-button"]',
    'button[data-testid="copy"]',
    'button[class*="copy"]',
    'svg[class*="copy"]'
  ],
  claude: [
    'button[aria-label="Copy"]',
    'button[aria-label="复制"]',
    'button[class*="copy"]',
    'svg[class*="copy"]'
  ],
  gemini: [
    'button[aria-label="Copy"]',
    'button[aria-label="复制"]',
    'button[mattooltip="Copy"]',
    'button[mattooltip="复制"]',
    'button[class*="copy"]'
  ],
  grok: [
    'button[aria-label="Copy"]',
    'button[aria-label="复制"]',
    'button[class*="copy"]',
    'svg[class*="copy"]'
  ],
  deepseek: [
    'button[aria-label="Copy"]',
    'button[aria-label="复制"]',
    'button[class*="copy"]',
    '.ds-button[aria-label*="copy"]',
    '.ds-button[aria-label*="Copy"]',
    '.ds-chat-message-actions button'
  ],
  kimi: [
    'button[aria-label*="复制"]',
    'button[aria-label*="Copy"]',
    'span[class*="copy"]',
    'div[class*="copy"]',
    'svg[name="Copy"]',
    '[class*="copy-btn"]',
    '[class*="copyIcon"]'
  ],
  doubao: [
    'button[aria-label*="复制"]',
    'button[aria-label*="Copy"]',
    'span[class*="copy"]',
    'div[class*="copy"]',
    '.semi-button[aria-label*="复制"]',
    '.semi-button[aria-label*="Copy"]',
    '[class*="copy-btn"]'
  ],
  qianwen: [
    'button[aria-label*="复制"]',
    'button[aria-label*="Copy"]',
    'button[class*="copy"]',
    'span[class*="copy"]',
    'div[class*="copy"]',
    '[class*="copy-btn"]'
  ],
  zhipu: [
    'button[aria-label*="复制"]',
    'button[aria-label*="Copy"]',
    'button[aria-label*="copy"]',
    'span[aria-label*="复制"]',
    'div[aria-label*="复制"]',
    'span[class*="copy"]',
    'div[class*="copy"]',
    '[class*="copy-btn"]',
    '[class*="copyIcon"]',
    'button[class*="action"]'
  ],
  wenxin: [
    'button[aria-label*="复制"]',
    'button[aria-label*="Copy"]',
    'button[class*="copy"]',
    'span[class*="copy"]',
    'div[class*="copy"]',
    '[class*="copy-btn"]'
  ],
  metaso: [
    'button[aria-label*="复制"]',
    'button[aria-label*="Copy"]',
    'button[class*="copy"]',
    'span[class*="copy"]',
    'div[class*="copy"]',
    '[class*="copy-btn"]'
  ]
};

// Provider-specific answer selectors for copy button walking (Phase 3)
export const COPY_BUTTON_ANSWER_SELECTORS = {
  deepseek: ['.ds-assistant-message-main-content', '.ds-markdown'],
  kimi: ['.markdown-container', '.markdown-container .markdown', '.markdown', '.kimi-message-content', '.markdown-body', '[class*="message-content"]'],
  doubao: ['.semi-chat-message-content', '.markdown-body', '.semi-chat-message'],
  qianwen: ['.markdown-body', '[class*="markdown-body"]', '[class*="qk-markdown"]'],
  zhipu: ['.markdown-body', '.content-markdown', '[class*="markdown-body"]'],
  wenxin: ['.cosd-markdown-content', '.ai-entry-block.ai-markdown', '.markdown-body'],
  metaso: ['.markdown-body'],
  chatgpt: ['.markdown-body'],
  claude: ['.markdown-body'],
  gemini: ['.markdown-body'],
  grok: ['.response-content-markdown', '.markdown-body']
};
