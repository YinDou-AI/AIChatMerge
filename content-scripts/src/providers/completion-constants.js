// completion-constants.js — 完成监控常量（选择器、超时、SSE 配置）
// 从 completion-monitor.js 拆分

import { DOUBAO_STOP_BUTTON_SELECTORS } from './doubao/selectors.js';
import { KIMI_STOP_BUTTON_SELECTORS } from './kimi/completion-policy.js';

export const STOP_BUTTON_SELECTORS = {
  chatgpt: [
    'button[data-testid="stop-button"]',
    'button[aria-label="Stop"]',
    'button[aria-label="Stop generating"]'
  ],
  claude: [
    'button[aria-label="Stop Response"]',
    'button[aria-label="Stop"]',
    'button[aria-label*="stop"]',
    '[data-is-streaming]'
  ],
  gemini: [
    'button[aria-label="Stop"]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="停止"]',
    'button[mattooltip="Stop"]',
    'button[mattooltip*="stop"]',
    'button[mattooltip*="停止"]'
  ],
  grok: [
    'button[aria-label="Stop"]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="stop"]'
  ],
  deepseek: [
    'button[aria-label="Stop"]',
    'button[aria-label*="停止"]',
    '.ds-stop-button',
    'button[aria-label*="Stop"]',
    'button[class*="stop"]'
  ],
  kimi: KIMI_STOP_BUTTON_SELECTORS,
  doubao: DOUBAO_STOP_BUTTON_SELECTORS,
  google: [
    'button[aria-label="Stop"]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="停止"]'
  ],
  qianwen: [
    'button[aria-label*="停止"]',
    'button[aria-label*="Stop"]',
    '[class*="stop"]'
  ],
  zhipu: [
    'button[aria-label*="停止"]',
    'button[aria-label*="Stop"]',
    '[class*="stop"]'
  ],
  wenxin: [
    'button[aria-label*="停止"]',
    'button[aria-label*="Stop"]',
    '[class*="stop"]'
  ],
  yuanbao: [
    'button[aria-label*="停止"]',
    'button[aria-label*="Stop"]',
    '[class*="stop"]'
  ],
  metaso: [
    'button[aria-label*="停止"]',
    'button[aria-label*="Stop"]',
    '[class*="stop"]'
  ]
};

export const BUTTON_APPEAR_TIMEOUT_MS = 20000;
export const BUTTON_DISAPPEAR_SETTLE_MS = 500;

// SSE 优先，DOM 兜底：仅内容层的协议最终帧能结束监控。该表必须与
// sse-bridge.js 的策略保持一致；没有可靠内容帧的平台直接使用 DOM。
export const SSE_COMPLETION_LAYERS = {
  deepseek: ['content'],
  doubao: ['content'],
  // Qianwen SSE completion may precede its final visible summary segment.
  // Retain SSE text accumulation, but use DOM completion confirmation.
  qianwen: [],
  yuanbao: ['content'],
  wenxin: ['content'],
  zhipu: [],
  kimi: [],
  chatgpt: ['content'],
  claude: ['content'],
  gemini: [],
  grok: [],
  metaso: []
};

export const SSE_SUPPORTED_PROVIDERS = Object.keys(SSE_COMPLETION_LAYERS)
  .filter(provider => SSE_COMPLETION_LAYERS[provider].includes('content'));
