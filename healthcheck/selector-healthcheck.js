/**
 * AIChatMerge Selector Health Check (CDP 模式)
 *
 * 直接连接你正在运行的 Chrome 浏览器来检测选择器。
 * 使用你的真实登录态，看到的 DOM 和你完全一致。
 *
 * 前置条件:
 *   Chrome 需要用 --remote-debugging-port=9222 启动
 *   双击 start-chrome.bat 即可（会自动带参数启动 Chrome）
 *
 * 用法:
 *   node selector-healthcheck.js               # 连接 Chrome 检测
 *   node selector-healthcheck.js --baseline    # 保存基线
 *   node selector-healthcheck.js --report      # 看上次报告
 *   node selector-healthcheck.js --provider kimi
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const BASELINE_FILE = join(DATA_DIR, 'baseline.json');
const REPORT_FILE = join(DATA_DIR, 'report.json');
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots');
const CDP_URL = 'http://127.0.0.1:9222';

// ─── 选择器定义 (需与 content-scripts/ 保持同步) ────────────────────
const PROVIDERS = {
  deepseek: {
    url: 'https://chat.deepseek.com/',
    inputSelectors: ['textarea[placeholder="How can I help you?"]', 'textarea.ds-scroll-area', 'textarea[class*="ds-"]', 'textarea'],
    sendButtonSelectors: ['button[aria-label="Send"]', 'button[type="submit"]'],
    answerSelectors: ['.ds-assistant-message-main-content', '.ds-chat-message'],
    newChatSelectors: ['button[aria-label*="New"]', 'a[href="/"]'],
    extractorFile: 'answer-extractor-deepseek.js',
    extractorSelectors: ['.ds-assistant-message-main-content', '.ds-chat-message'],
  },
  kimi: {
    url: 'https://kimi.com/',
    inputSelectors: ['.chat-input-editor', 'div[contenteditable="true"].chat-input-editor', 'div[contenteditable="true"]'],
    sendButtonSelectors: ['.send-button-container:not(.disabled)', 'div[class*="send"]:not([class*="disabled"])', 'button[aria-label*="Send"]', 'button[aria-label*="发送"]'],
    answerSelectors: ['.markdown-container', '.markdown', '.message-list', '.kimi-message-content'],
    newChatSelectors: ['a.new-chat-btn', 'a[href="/"]'],
    extractorFile: 'answer-extractor-kimi.js',
    extractorSelectors: ['.markdown-container', '.markdown', '.message-list', '.kimi-message-content'],
  },
  doubao: {
    url: 'https://www.doubao.com/chat/',
    inputSelectors: ['#input-engine-container .semi-input-textarea-wrapper textarea', '.semi-input-textarea-wrapper textarea', 'textarea.semi-input-textarea', 'textarea[placeholder="发消息..."]'],
    sendButtonSelectors: ['#flow-end-msg-send', 'button#flow-end-msg-send', 'button[aria-label="发送"]'],
    answerSelectors: ['.md-box-root', '.semi-chat-message', '.semi-chat-messageItem', '.semi-chat-message-content'],
    newChatSelectors: ['#flow_chat_sidebar > div.cursor-pointer', 'button[data-testid="new-chat-button"]', 'a[href="/chat/"]'],
    extractorFile: 'answer-extractor-doubao.js',
    extractorSelectors: ['.md-box-root', '.semi-chat-message', '.semi-chat-messageItem', '.semi-chat-message-content'],
  },
  qianwen: {
    url: 'https://www.qianwen.com/chat',
    inputSelectors: ['div[data-slate-editor="true"]', 'div[contenteditable="true"][data-slate-editor]', 'textarea'],
    sendButtonSelectors: ['button[aria-label="Send"]', 'button[aria-label="发送"]', 'button[aria-label="发送消息"]'],
    answerSelectors: ['[data-testid="message-content"]', '.message-content', '[class*="markdown"]'],
    newChatSelectors: ['button[aria-label*="新"]', 'a[href="/chat"]'],
    extractorFile: 'answer-extractor-qianwen.js',
    extractorSelectors: ['[data-testid="message-content"]', '.message-content', '[class*="markdown"]'],
  },
  zhipu: {
    url: 'https://chatglm.cn/',
    inputSelectors: ['textarea.scroll-display-none', 'textarea[placeholder*="输入"]', '.chat-input textarea', 'textarea'],
    sendButtonSelectors: ['button[aria-label="Send"]', 'button[aria-label="发送"]', 'button[type="submit"]'],
    answerSelectors: ['.markdown-body', '.message-content', '[class*="answer"]'],
    newChatSelectors: ['button[aria-label*="新"]', 'a[href="/"]'],
    extractorFile: 'answer-extractor-zhipu.js',
    extractorSelectors: ['.markdown-body', '.message-content', '[class*="answer"]'],
  },
  wenxin: {
    url: 'https://chat.baidu.com/',
    inputSelectors: ['#chat-textarea', 'div[data-slate-editor="true"]', 'textarea[placeholder*="输入"]', 'textarea'],
    sendButtonSelectors: ['#ci-submit-button-ai', 'button[aria-label="发送"]', 'button[aria-label="Send"]', 'button[type="submit"]'],
    answerSelectors: ['.markdown-body', '.message-content'],
    newChatSelectors: ['button[aria-label*="新"]', 'a[href="/"]'],
    extractorFile: 'answer-extractor-wenxin.js',
    extractorSelectors: ['.markdown-body', '.message-content'],
  },
  yuanbao: {
    url: 'https://yuanbao.tencent.com/chat/',
    inputSelectors: ['.ql-editor[contenteditable="true"]', '.ql-editor', 'textarea[placeholder*="输入"]', 'textarea'],
    sendButtonSelectors: ['#searchbar-editor #yuanbao-send-btn', '#yuanbao-send-btn', 'button[aria-label="发送"]'],
    answerSelectors: ['.markdown-body', '.message-content', '[class*="answer"]'],
    newChatSelectors: ['button[aria-label*="新"]', 'a[href="/chat/"]'],
    extractorFile: 'answer-extractor-yuanbao.js',
    extractorSelectors: ['.markdown-body', '.message-content', '[class*="answer"]'],
  },
  metaso: {
    url: 'https://metaso.cn/',
    inputSelectors: ['textarea.search-consult-textarea', 'textarea[placeholder*="搜索"]', 'textarea[placeholder*="提问"]', 'textarea'],
    sendButtonSelectors: ['button.send-arrow-button', '.send-arrow-button', 'button[title*="发送"]', 'button[type="submit"]'],
    answerSelectors: ['.markdown-body', '.search-result', '[class*="answer"]'],
    newChatSelectors: ['button[aria-label*="新"]', 'a[href="/"]'],
    extractorFile: 'answer-extractor-metaso.js',
    extractorSelectors: ['.markdown-body', '.search-result', '[class*="answer"]'],
  },
  chatgpt: {
    url: 'https://chatgpt.com/',
    inputSelectors: ['#prompt-textarea'],
    sendButtonSelectors: ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]', 'button[aria-label="Send"]'],
    answerSelectors: ['[data-message-author-role="assistant"]', '.markdown', '.markdown-body'],
    newChatSelectors: ['a[aria-label="New chat"]', 'button[aria-label="New chat"]', 'a[href="/"]'],
    extractorFile: 'answer-extractor-chatgpt.js',
    extractorSelectors: ['[data-message-author-role="assistant"]', '.markdown', '.markdown-body'],
  },
  gemini: {
    url: 'https://gemini.google.com/',
    inputSelectors: ['.ql-editor', 'textarea[aria-label="Ask anything"]', 'textarea'],
    sendButtonSelectors: ['button[aria-label="Send message"]', 'button[aria-label="发送"]', 'button[aria-label="Submit"]'],
    answerSelectors: ['model-response .markdown-main-panel', 'model-response .markdown', 'model-response', '.model-response-text', '.response-content .markdown', '.markdown-main-panel', '[data-message-author-role="model"]'],
    newChatSelectors: ['button[aria-label="New chat"]', 'button[aria-label*="New"]'],
    extractorFile: 'answer-extractor-gemini.js',
    extractorSelectors: ['model-response .markdown-main-panel', 'model-response .markdown', 'model-response', '.model-response-text'],
  },
  claude: {
    url: 'https://claude.ai/new',
    inputSelectors: ['.ProseMirror[role="textbox"]', '.ProseMirror[contenteditable="true"]', 'div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
    sendButtonSelectors: ['button[aria-label="Send Message"]', 'button[aria-label="Send message"]', 'button[aria-label="Send"]'],
    answerSelectors: ['[data-testid="assistant-message"]', '[data-message-role="assistant"]', '.font-claude-message', '[class*="AssistantTurn"]', '[class*="assistant-turn"]', '.prose', '.markdown-body'],
    newChatSelectors: ['button[aria-label="Start new chat"]', 'button[aria-label*="new chat"]', 'a[href="/new"]'],
    extractorFile: 'answer-extractor-claude.js',
    extractorSelectors: ['[data-testid="assistant-message"]', '[data-message-role="assistant"]', '.font-claude-message', '[class*="AssistantTurn"]', '.prose', '.markdown-body'],
  },
  grok: {
    url: 'https://grok.com/',
    inputSelectors: ['.tiptap', '.ProseMirror', 'textarea:not([aria-hidden="true"])'],
    sendButtonSelectors: ['button[aria-label="Send message"]', 'button[aria-label="Send"]', 'button[type="submit"]'],
    answerSelectors: ['.markdown', '.markdown-body', '[class*="message-content"]'],
    newChatSelectors: ['a[href="/"]', 'button[aria-label*="New"]'],
    extractorFile: 'answer-extractor-grok.js',
    extractorSelectors: ['.markdown', '.markdown-body', '[class*="message-content"]'],
  },
};

// ─── CLI ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MODE = args.includes('--report') ? 'report' : args.includes('--baseline') ? 'baseline' : 'check';
const SINGLE_PROVIDER = args.includes('--provider') ? args[args.indexOf('--provider') + 1] : null;

function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }
ensureDir(DATA_DIR); ensureDir(SNAPSHOTS_DIR);
function loadJson(p, fb = null) { try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return fb; } }
function saveJson(p, d) { writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8'); }

// ─── 检测 Chrome 是否开启了 CDP ──────────────────────────────────────
async function checkCDP() {
  try {
    const resp = await fetch(`${CDP_URL}/json/version`);
    if (resp.ok) {
      const data = await resp.json();
      return { ok: true, browser: data.Browser, ws: data.webSocketDebuggerUrl };
    }
  } catch {}
  return { ok: false };
}

// ─── 核心：在真实 Chrome 中测试一个提供商 ─────────────────────────────
async function testProvider(context, providerId, config) {
  const page = await context.newPage();
  const result = {
    provider: providerId,
    url: config.url,
    timestamp: new Date().toISOString(),
    reachable: false,
    loggedIn: false,
    finalUrl: '',
    pageTitle: '',
    selectors: {},
    brokenSelectors: [],
    extractorSelectors: {},
    brokenExtractorSelectors: [],
    pageSnapshot: { classes: [], ids: [] },
    error: null,
  };

  try {
    // 新标签页打开，先去首页确认登录态
    console.log(`  [${providerId}] 打开 ${config.url} ...`);
    const resp = await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    result.reachable = true;
    result.finalUrl = page.url();
    result.pageTitle = await page.title();

    // 判断是否在聊天页面（有输入框）
    const inputCount = await page.locator('textarea, [contenteditable="true"]').count();
    result.loggedIn = inputCount > 0;

    if (!result.loggedIn) {
      console.log(`  [${providerId}] ⚠️  未登录 (被重定向到: ${result.finalUrl})`);
    } else {
      console.log(`  [${providerId}] ✅ 已登录`);
    }

    // 测试所有选择器组
    const groups = {
      input: config.inputSelectors || [],
      sendButton: config.sendButtonSelectors || [],
      answer: config.answerSelectors || [],
      newChat: config.newChatSelectors || [],
    };

    for (const [group, sels] of Object.entries(groups)) {
      result.selectors[group] = {};
      for (const sel of sels) {
        try {
          const count = await page.locator(sel).count();
          let visible = false;
          if (count > 0) {
            try { visible = await page.locator(sel).first().isVisible({ timeout: 1000 }); } catch {}
          }
          result.selectors[group][sel] = { count, visible };
          if (count === 0) result.brokenSelectors.push({ group, selector: sel });
        } catch (e) {
          result.selectors[group][sel] = { count: 0, visible: false };
          result.brokenSelectors.push({ group, selector: sel });
        }
      }
    }

    // 额外测试 answer extractor 中的关键选择器
    const extractorSels = config.extractorSelectors || [];
    for (const sel of extractorSels) {
      try {
        const count = await page.locator(sel).count();
        result.extractorSelectors[sel] = count;
        if (count === 0) result.brokenExtractorSelectors.push(sel);
      } catch {
        result.extractorSelectors[sel] = 0;
        result.brokenExtractorSelectors.push(sel);
      }
    }

    // 保存页面快照
    try {
      const snapshot = await page.evaluate(() => {
        const classes = new Set();
        const ids = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let n = 0;
        while (walker.nextNode() && n < 8000) {
          const el = walker.currentNode;
          if (el.className && typeof el.className === 'string')
            el.className.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
          if (el.id) ids.add(el.id);
          n++;
        }
        return { classes: [...classes].sort(), ids: [...ids].sort(), total: n };
      });
      result.pageSnapshot = snapshot;
      writeFileSync(join(SNAPSHOTS_DIR, `${providerId}.html`), await page.content(), 'utf-8');
    } catch {}

  } catch (e) {
    result.error = e.message;
    console.log(`  [${providerId}] ❌ ${e.message}`);
  } finally {
    await page.close();
  }

  return result;
}

// ─── 对比基线 ────────────────────────────────────────────────────────
function diff(current, baseline) {
  const changes = [];
  if (!baseline) return [{ type: 'new', provider: current.provider }];

  // 失效的选择器
  for (const s of current.brokenSelectors) {
    const prev = baseline.selectors?.[s.group]?.[s.selector];
    if (prev && prev.count > 0) {
      changes.push({ type: 'selector_broken', provider: current.provider, group: s.group, selector: s.selector });
    }
  }

  // 恢复的选择器
  for (const [g, sels] of Object.entries(current.selectors)) {
    for (const [sel, st] of Object.entries(sels)) {
      if (st.count > 0) {
        const prev = baseline.selectors?.[g]?.[sel];
        if (!prev || prev.count === 0) {
          changes.push({ type: 'selector_restored', provider: current.provider, group: g, selector: sel });
        }
      }
    }
  }

  // Extractor 选择器变化
  for (const sel of current.brokenExtractorSelectors) {
    const prevCount = baseline.extractorSelectors?.[sel] ?? -1;
    if (prevCount > 0) {
      changes.push({ type: 'extractor_broken', provider: current.provider, selector: sel });
    }
  }

  // 页面结构大幅变化
  const oldCls = new Set(baseline.pageSnapshot?.classes || []);
  const newCls = new Set(current.pageSnapshot?.classes || []);
  const removed = [...oldCls].filter(c => !newCls.has(c));
  const added = [...newCls].filter(c => !oldCls.has(c));
  const ratio = (removed.length + added.length) / (oldCls.size || 1);
  if (ratio > 0.08) {
    changes.push({
      type: 'structure_changed',
      provider: current.provider,
      added: added.length,
      removed: removed.length,
      pct: Math.round(ratio * 100),
      addedSample: added.slice(0, 20),
      removedSample: removed.slice(0, 20),
    });
  }

  return changes;
}

// ─── 生成报告 ────────────────────────────────────────────────────────
function report(results, changes) {
  const lines = ['=== AIChatMerge 选择器健康报告 ===', `时间: ${new Date().toISOString()}`, ''];

  const broken = changes.filter(c => c.type === 'selector_broken').length;
  const extractorBroken = changes.filter(c => c.type === 'extractor_broken').length;
  const structure = changes.filter(c => c.type === 'structure_changed').length;

  if (changes.length === 0) {
    lines.push('✅ 全部正常，无变化。');
  } else {
    lines.push(`⚠️  检测到 ${changes.length} 项变化：`);
    if (broken) lines.push(`   🔴 ${broken} 个界面选择器失效`);
    if (extractorBroken) lines.push(`   🔴 ${extractorBroken} 个取词选择器失效`);
    if (structure) lines.push(`   🟡 ${structure} 个页面结构大幅变化`);
  }
  lines.push('');

  for (const r of results) {
    const pc = changes.filter(c => c.provider === r.provider);
    const icon = r.error ? '❌' : (pc.length ? '⚠️' : '✅');
    const login = r.loggedIn ? ' [已登录]' : ' [未登录]';
    lines.push(`--- ${r.provider.toUpperCase()} ${icon}${login} ---`);

    if (r.error) {
      lines.push(`  错误: ${r.error}`);
    } else {
      for (const [g, sels] of Object.entries(r.selectors)) {
        const ok = Object.values(sels).filter(s => s.count > 0).length;
        lines.push(`  ${g}: ${ok}/${Object.keys(sels).length}`);
      }
      const extOk = Object.values(r.extractorSelectors).filter(c => c > 0).length;
      const extTotal = Object.keys(r.extractorSelectors).length;
      if (extTotal > 0) lines.push(`  取词器: ${extOk}/${extTotal}`);
    }

    for (const c of pc) {
      if (c.type === 'selector_broken') lines.push(`  🔴 界面失效 [${c.group}]: ${c.selector}`);
      if (c.type === 'extractor_broken') lines.push(`  🔴 取词失效: ${c.selector}`);
      if (c.type === 'selector_restored') lines.push(`  🟢 已恢复 [${c.group}]: ${c.selector}`);
      if (c.type === 'structure_changed') {
        lines.push(`  🟡 结构变化: +${c.added}/-${c.removed} (${c.pct}%)`);
        if (c.addedSample.length) lines.push(`     新增: ${c.addedSample.slice(0, 8).join(', ')}`);
        if (c.removedSample.length) lines.push(`     消失: ${c.removedSample.slice(0, 8).join(', ')}`);
      }
    }
    lines.push('');
  }

  // 修复建议
  const allBroken = [...new Set([...changes.filter(c => c.type === 'selector_broken' || c.type === 'extractor_broken').map(c => c.provider)])];
  if (allBroken.length > 0) {
    lines.push('=== 修复建议 ===');
    for (const pid of allBroken) {
      const r = results.find(x => x.provider === pid);
      const cls = r?.pageSnapshot?.classes || [];
      const providerChanges = changes.filter(c => c.provider === pid && (c.type === 'selector_broken' || c.type === 'extractor_broken'));
      for (const c of providerChanges) {
        const keywords = c.selector.replace(/[.#[\]=":]/g, ' ').split(/\s+/).filter(w => w.length > 3);
        const candidates = cls.filter(k => keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase())));
        lines.push(`\n  ${pid} → ${c.selector}`);
        if (candidates.length) lines.push(`    候选: ${candidates.slice(0, 6).join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── 主函数 ──────────────────────────────────────────────────────────
async function main() {
  if (MODE === 'report') {
    const r = loadJson(REPORT_FILE);
    console.log(r?.text || '无报告');
    return;
  }

  console.log('=== AIChatMerge 选择器健康检查 (CDP 模式) ===');
  console.log(`时间: ${new Date().toISOString()}`);

  // 检测 CDP
  const cdp = await checkCDP();
  if (!cdp.ok) {
    console.log('');
    console.log('❌ 无法连接 Chrome 调试端口 (9222)。');
    console.log('');
    console.log('请先启动 Chrome:');
    console.log('  双击 start-chrome.bat');
    console.log('  或手动运行:');
    console.log('  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
    console.log('');
    console.log('启动后重新运行此脚本。');
    process.exit(1);
  }

  console.log(`已连接 Chrome: ${cdp.browser}`);
  console.log('');

  // 通过 CDP 连接到你的 Chrome
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const context = contexts[0]; // 用你当前的浏览器上下文

  const providerIds = SINGLE_PROVIDER ? [SINGLE_PROVIDER] : Object.keys(PROVIDERS);
  const baseline = loadJson(BASELINE_FILE, {});
  const results = [];
  const allChanges = [];

  for (const pid of providerIds) {
    const config = PROVIDERS[pid];
    if (!config) { console.log(`未知提供商: ${pid}`); continue; }

    const result = await testProvider(context, pid, config);
    results.push(result);

    const total = Object.values(result.selectors).reduce((s, g) => s + Object.keys(g).length, 0) + Object.keys(result.extractorSelectors).length;
    const broken = result.brokenSelectors.length + result.brokenExtractorSelectors.length;
    const login = result.loggedIn ? '✅' : '⚠️';
    console.log(`  [${pid}] ${login} ${total - broken}/${total}`);

    if (MODE === 'check') {
      allChanges.push(...diff(result, baseline[pid]));
    }
  }

  // 保存
  const currentData = {};
  for (const r of results) currentData[r.provider] = r;

  if (MODE === 'baseline') {
    saveJson(BASELINE_FILE, currentData);
    console.log('\n✅ 基线已保存。');
  }

  saveJson(join(DATA_DIR, 'latest.json'), currentData);
  const text = report(results, allChanges);
  saveJson(REPORT_FILE, { timestamp: new Date().toISOString(), text, changes: allChanges });

  console.log('\n' + text);

  // 断开但不关闭 Chrome
  browser.close();

  process.exit(allChanges.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
