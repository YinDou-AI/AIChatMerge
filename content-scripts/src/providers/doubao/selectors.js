export const DOUBAO_COMPOSER_SELECTORS = Object.freeze([
  '#input-engine-container .semi-input-textarea-wrapper textarea',
  '.semi-input-textarea-wrapper textarea',
  '#input-engine-container textarea',
  'textarea.semi-input-textarea',
  'textarea.semi-input-textarea[placeholder="发消息..."]',
  'textarea[placeholder="发消息..."]',
  '[data-slate-editor="true"][contenteditable="true"]',
  '.flow-chat-editor [data-slate-editor="true"][contenteditable="true"]',
  '.flow-chat-editor [contenteditable="true"][role="textbox"]',
  '.flow-chat-editor [contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]'
]);

export const DOUBAO_SEND_CONTROL_SELECTORS = Object.freeze([
  '#flow-end-msg-send',
  'button#flow-end-msg-send',
  '#input-engine-container button#flow-end-msg-send',
  'button[data-testid="send-button"]',
  'button[data-test-id="send-button"]',
  'button[aria-label="Send"]',
  'button[aria-label="发送"]',
  'button[type="submit"]'
]);

export const DOUBAO_STOP_BUTTON_SELECTORS = Object.freeze([
  'button[aria-label*="停止"]',
  'button[aria-label*="Stop"]',
  '[class*="stop"]'
]);

export const DOUBAO_ANSWER_SELECTORS = Object.freeze([
  '.md-box-root',
  '.container-qX9Csx.md-box-root',
  '.semi-chat-message-content',
  '.semi-chat-message'
]);
