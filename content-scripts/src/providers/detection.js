// detection.js — Provider 检测与常量定义
// 日志前缀：text-injection:detect
// Extracted from text-injection-all-providers.js

import {
  DOUBAO_COMPOSER_SELECTORS,
  DOUBAO_SEND_CONTROL_SELECTORS
} from './doubao/selectors.js';

// ===== 常量 =====

const GOOGLE_PROVIDER_MODE_AI = 'ai';
const GOOGLE_PROVIDER_MODE_SEARCH = 'search';
const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = 'multi-panel-provider-status';
const ACM_PROVIDER_BUSY = 'ACM_PROVIDER_BUSY';
const ACM_PROVIDER_IDLE = 'ACM_PROVIDER_IDLE';
const ACM_PROVIDER_USER_INTERACTION = 'ACM_PROVIDER_USER_INTERACTION';
const CHATGPT_STOP_BUTTON_SELECTOR = 'button[data-testid="stop-button"]';
const CHATGPT_SEND_TRACKING_IDLE_DELAY_MS = 800;
const CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS = 2000;
const MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS = 90000;
let chatgptSendTracking = null;
let multiPanelUserInteractionTracking = null;

// Getter/setter for mutable state (ES module live binding workaround)
export function getMultiPanelUserInteractionTracking() { return multiPanelUserInteractionTracking; }
export function setMultiPanelUserInteractionTracking(value) { multiPanelUserInteractionTracking = value; }
export function getChatgptSendTracking() { return chatgptSendTracking; }
export function setChatgptSendTracking(value) { chatgptSendTracking = value; }

// ===== Provider 选择器常量 =====

// Provider-specific selectors
const PROVIDER_SELECTORS = {
  chatgpt: ['#prompt-textarea'],
  claude: [
    '.ProseMirror[role="textbox"]',
    '.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]'
  ],
  gemini: ['.ql-editor'],
  // grok 页面常驻一个 visibility:hidden + aria-hidden 的无障碍 textarea，
  // 真输入框（tiptap）未挂载时（Cookie 授权墙遮挡/页面水合中）注入会兜底
  // 写进它——文本进去了但 tiptap 不知道，发送按钮永远不挂载，静默失败。
  // 用 :not([aria-hidden]) 排除它；找不到输入框宁可重试/报错也不写假目标
  grok: ['.tiptap', '.ProseMirror', 'textarea:not([aria-hidden="true"])'],
  deepseek: [
    'textarea[placeholder="How can I help you?"]',
    'textarea.ds-scroll-area',
    'textarea[class*="ds-"]',
    'textarea',
    'div[contenteditable="true"]'
  ],
  kimi: [
    '.chat-input-editor',
    'div[contenteditable="true"].chat-input-editor',
    'div.chat-input-editor[contenteditable]',
    'div[contenteditable="true"]'
  ],
  doubao: DOUBAO_COMPOSER_SELECTORS,
  google: [
    'textarea.ITIRGe',
    'textarea[aria-label="Ask anything"]',
    'textarea[maxlength="8192"]'
  ],
  qianwen: [
    'div[data-slate-editor="true"]',
    'div[contenteditable="true"][data-slate-editor]',
    'textarea[class*="input"]',
    'textarea[placeholder*="输入"]',
    'textarea[placeholder*="提问"]',
    'textarea',
    '[contenteditable="true"]'
  ],
  zhipu: [
    'textarea.scroll-display-none',
    'textarea[placeholder*="输入"]',
    'textarea[placeholder*="提问"]',
    '.chat-input textarea',
    'textarea',
    '[contenteditable="true"]'
  ],
  wenxin: [
    '#chat-textarea',
    '.ci-textarea',
    'div[data-slate-editor="true"]',
    'div[contenteditable="true"][data-slate-editor]',
    'textarea[placeholder*="输入"]',
    'textarea[placeholder*="提问"]',
    '.chat-input textarea',
    'textarea',
    '[contenteditable="true"]'
  ],
  yuanbao: [
    '.ql-editor[contenteditable="true"]',
    '.ql-editor',
    'textarea[placeholder*="输入"]',
    'textarea[placeholder*="提问"]',
    'textarea',
    '[contenteditable="true"]'
  ],
  metaso: [
    'textarea.search-consult-textarea',
    'textarea[placeholder*="搜索"]',
    'textarea[placeholder*="提问"]',
    'textarea',
    'input[type="text"]',
    '[contenteditable="true"]'
  ]
};

const GOOGLE_AI_INPUT_SELECTORS = [
  'textarea.ITIRGe',
  'textarea[aria-label="Ask anything"]',
  'textarea[maxlength="8192"]'
];

const GOOGLE_SEARCH_INPUT_SELECTORS = [
  'input[name="q"]',
  'textarea[name="q"]',
  'input.gLFyf',
  'textarea.gLFyf'
];

// Provider-specific send button selectors
const SEND_BUTTON_SELECTORS = {
  chatgpt: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send"]',
    'form button[type="submit"]'
  ],
  claude: [
    'button[aria-label="Send Message"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send"]',
    'fieldset button[type="button"]:has(svg)',
    'button.bg-accent-main-100'
  ],
  gemini: [
    'button[aria-label="Send message"]',
    'button[aria-label="发送"]',
    'button.send-button',
    'button[mattooltip="Send message"]',
    '.input-area-container button:has(mat-icon)',
    'button[aria-label="Submit"]'
  ],
  grok: [
    'button[aria-label="Send message"]',
    'button[aria-label="Send"]',
    'button[type="submit"]',
    'form button:has(svg)'
  ],
  deepseek: [
    'button[aria-label="Send"]',
    'button[type="submit"]'
  ],
  kimi: [
    // Priority: clickable send button containers that are not disabled
    '.send-button-container:not(.disabled)',
    'div[class*="send"]:not([class*="disabled"])',
    // Backup: look for send icon and click its parent
    'svg[name="Send"]',
    '.send-icon',
    // Try to find button by aria-label
    'button[aria-label*="Send"]',
    'button[aria-label*="发送"]'
  ],
  doubao: DOUBAO_SEND_CONTROL_SELECTORS,
  google: [
    'button[data-xid="input-plate-send-button"]',
    'button[aria-label="Send"]',
    'button.OEueve'
  ],
  qianwen: [
    'button[aria-label="Send"]',
    'button[aria-label="发送"]',
    'button[aria-label="发送消息"]',
    'button[class*="send"]',
    'button[type="submit"]'
  ],
  zhipu: [
    'button[aria-label="Send"]',
    'button[aria-label="发送"]',
    'button[aria-label="发送消息"]',
    'button[type="submit"]'
  ],
  wenxin: [
    '#ci-submit-button-ai.ci-submit-button-ai-active',
    'button[aria-label="Send"]',
    'button[aria-label="发送"]',
    'button[aria-label="发送消息"]',
    'button[type="submit"]',
    'button[class*="send"]',
    'div[class*="send"][role="button"]',
    '[class*="send-btn"]'
  ],
  yuanbao: [
    // Yuanbao's current composer uses an <a>, not a button.  Falling back
    // to a synthetic Enter can submit before Quill has committed multiline
    // content to its internal state. Tag-agnostic fallbacks below: the
    // 2026-07-21 log showed the id selector can miss while an <a> send
    // control exists, and every fallback here was button-only.
    '#searchbar-editor #yuanbao-send-btn',
    '#yuanbao-send-btn',
    'a[aria-label*="发送"]',
    '[class*="send-btn"]',
    'button[aria-label="Send"]',
    'button[aria-label="发送"]',
    'button[aria-label="发送消息"]',
    'button[type="submit"]',
    'button[class*="send"]'
  ],
  metaso: [
    'button.send-arrow-button',
    '.send-arrow-button',
    'button[data-testid*="send"]',
    'button[data-test-id*="send"]',
    '[role="button"][data-testid*="send"]',
    '[role="button"][data-test-id*="send"]',
    'button[title*="发送"]',
    'button[title*="Send"]',
    '[role="button"][title*="发送"]',
    '[role="button"][title*="Send"]',
    'button[type="submit"]',
    'button[aria-label*="发送"]',
    'button[aria-label*="Send"]',
    '[role="button"][aria-label*="发送"]',
    '[role="button"][aria-label*="Send"]',
    'button[aria-label*="搜索"]',
    'button[aria-label*="Search"]',
    '[role="button"][aria-label*="搜索"]',
    '[role="button"][aria-label*="Search"]',
    'button[class*="submit"]',
    'button[class*="send"]',
    '[role="button"][class*="submit"]',
    '[role="button"][class*="send"]'
  ]
};

// Provider-specific new chat button selectors and URLs
const NEW_CHAT_BUTTON_SELECTORS = {
  chatgpt: [
    'a[aria-label="New chat"]',
    'button[aria-label="New chat"]',
    'a[href="/"]',
    'nav a[href="/"]',
    'aside a[href="/"]',
    '[data-testid="new-chat-button"]'
  ],
  claude: [
    'button[aria-label="Start new chat"]',
    'button[aria-label*="new chat"]',
    'a[href="/new"]',
    'div[role="button"][aria-label*="New"]',
    'a[href*="/new"]'
  ],
  gemini: [
    'button[aria-label="New chat"]',
    'button[aria-label*="New"]',
    'a[aria-label="New chat"]'
  ],
  grok: [
    'a[href="/"]',
    'button[aria-label*="New"]',
    'a[href*="new"]'
  ],
  deepseek: [
    'button[aria-label*="New"]',
    'a[href="/"]',
    'div[class*="new-chat"]'
  ],
  kimi: [
    'a.new-chat-btn',
    'a[href="/"]',
    '.sidebar a[href="/"]'
  ],
  doubao: [
    '#flow_chat_sidebar > div.cursor-pointer',
    '#flow_chat_sidebar > div[class*="cursor-pointer"]',
    'button[data-testid="new-chat-button"]',
    'button[data-test-id="new-chat-button"]',
    'button[data-testid="new-conversation-button"]',
    'button[data-test-id="new-conversation-button"]',
    'a[href="/chat/"]',
    'a[href="/chat"]',
    'button[aria-label*="New"]',
    'button[aria-label*="新建"]'
  ],
  google: [
    'button[aria-label="New search"]',
    'a[aria-label="Google"]',
    'a[href^="/search"][href*="udm="]'
  ],
  qianwen: [
    'button[aria-label*="新"]',
    'a[href="/chat"]',
    'button[aria-label*="New"]'
  ],
  zhipu: [
    'div.new-session',
    'button[aria-label*="新"]',
    'a[href="/"]',
    'button[aria-label*="New"]'
  ],
  wenxin: [
    'button[aria-label*="新"]',
    'a[href="/"]',
    'button[aria-label*="New"]'
  ],
  yuanbao: [
    'button[aria-label*="新"]',
    'a[href="/chat/"]',
    'button[aria-label*="New"]'
  ],
  metaso: [
    'button[aria-label*="新"]',
    'a[href="/"]',
    'button[aria-label*="New"]'
  ]
};

// Fallback URLs for creating new chat when button not found
const NEW_CHAT_URLS = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/new',
  gemini: 'https://gemini.google.com/app',
  grok: 'https://grok.com/',
  deepseek: 'https://chat.deepseek.com/',
  kimi: 'https://www.kimi.com/',
  doubao: 'https://www.doubao.com/chat/',
  google: 'https://www.google.com/search?udm=50',
  qianwen: 'https://www.qianwen.com/chat',
  zhipu: 'https://chatglm.cn/',
  wenxin: 'https://wenxin.baidu.com/',
  yuanbao: 'https://yuanbao.tencent.com/chat/',
  metaso: 'https://metaso.cn/'
};

// ===== Provider 检测函数 =====

// Detect which provider we're on based on hostname
function detectProvider() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const search = window.location.search;

  // 过滤Claude工具iframe（如isolated-segment.html）
  if (hostname.includes('claude.ai')) {
    const utilFramePattern = /isolated|segment|embed|widget|frame\.html|extension|sandbox/i;
    if (utilFramePattern.test(pathname)) {
      return null;
    }
  }

  if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
    return 'chatgpt';
  } else if (hostname.includes('claude.ai')) {
    return 'claude';
  } else if (hostname.includes('gemini.google.com')) {
    return 'gemini';
  } else if (hostname.includes('grok.com')) {
    return 'grok';
  } else if (hostname.includes('deepseek.com')) {
    return 'deepseek';
  } else if (hostname.includes('kimi.com')) {
    return 'kimi';
  } else if (hostname.includes('doubao.com')) {
    return 'doubao';
  } else if (hostname.includes('qianwen.com')) {
    return 'qianwen';
  } else if (hostname.includes('chatglm.cn')) {
    return 'zhipu';
  } else if (hostname.includes('chat.baidu.com') || hostname.includes('wenxin.baidu.com') || hostname.includes('yiyan.baidu.com')) {
    return 'wenxin';
  } else if (hostname.includes('yuanbao.tencent.com')) {
    return 'yuanbao';
  } else if (hostname.includes('metaso.cn')) {
    return 'metaso';
  } else if (hostname.includes('google.com') || hostname.includes('google.') || hostname === 'www.google.com') {
    // Google Search / AI Mode
    // Always return 'google' for any google.com page
    // The handleGoogleNewSearch will navigate to homepage which works for all cases
    return 'google';
  }
  return null;
}

// ===== 导出 =====

export {
  // 常量
  GOOGLE_PROVIDER_MODE_AI,
  GOOGLE_PROVIDER_MODE_SEARCH,
  MULTI_PANEL_PROVIDER_STATUS_CONTEXT,
  ACM_PROVIDER_BUSY,
  ACM_PROVIDER_IDLE,
  ACM_PROVIDER_USER_INTERACTION,
  CHATGPT_STOP_BUTTON_SELECTOR,
  CHATGPT_SEND_TRACKING_IDLE_DELAY_MS,
  CHATGPT_SEND_TRACKING_NO_BUSY_TIMEOUT_MS,
  MULTI_PANEL_USER_INTERACTION_TRACKING_TIMEOUT_MS,

  // 可变状态
  multiPanelUserInteractionTracking,

  // 选择器常量
  PROVIDER_SELECTORS,
  GOOGLE_AI_INPUT_SELECTORS,
  GOOGLE_SEARCH_INPUT_SELECTORS,
  SEND_BUTTON_SELECTORS,
  NEW_CHAT_BUTTON_SELECTORS,
  NEW_CHAT_URLS,

  // 函数
  detectProvider
};
