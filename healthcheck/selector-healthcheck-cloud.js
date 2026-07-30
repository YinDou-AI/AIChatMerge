/**
 * AIChatMerge Selector Health Check (云端版)
 *
 * 在 GitHub Actions 中运行，无需登录态。
 * 检测: 页面可达性、重定向、HTML 结构变化。
 * 不能检测: 聊天界面选择器（需要登录）。
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const BASELINE_FILE = join(DATA_DIR, 'baseline-cloud.json');
const REPORT_FILE = join(DATA_DIR, 'report.json');
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots');

const PROVIDERS = {
  deepseek: { url: 'https://chat.deepseek.com/' },
  kimi: { url: 'https://kimi.com/' },
  doubao: { url: 'https://www.doubao.com/chat/' },
  qianwen: { url: 'https://www.qianwen.com/chat' },
  zhipu: { url: 'https://chatglm.cn/' },
  wenxin: { url: 'https://chat.baidu.com/' },
  yuanbao: { url: 'https://yuanbao.tencent.com/chat/' },
  metaso: { url: 'https://metaso.cn/' },
  chatgpt: { url: 'https://chatgpt.com/' },
  gemini: { url: 'https://gemini.google.com/' },
  claude: { url: 'https://claude.ai/new' },
  grok: { url: 'https://grok.com/' },
};

function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }
ensureDir(DATA_DIR); ensureDir(SNAPSHOTS_DIR);
function loadJson(p, fb = null) { try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return fb; } }
function saveJson(p, d) { writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8'); }

async function testProvider(browser, providerId, config) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  const result = {
    provider: providerId,
    url: config.url,
    reachable: false,
    redirected: false,
    redirectedTo: null,
    htmlLength: 0,
    classes: [],
    structureChanged: false,
    classesAdded: 0,
    classesRemoved: 0,
    changePercent: 0,
    error: null,
  };

  try {
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    result.reachable = true;
    result.finalUrl = page.url();
    if (!page.url().startsWith(config.url.replace(/\/$/, ''))) {
      result.redirected = true;
      result.redirectedTo = page.url();
    }

    const html = await page.content();
    result.htmlLength = html.length;
    writeFileSync(join(SNAPSHOTS_DIR, `${providerId}.html`), html, 'utf-8');

    const structure = await page.evaluate(() => {
      const classes = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let n = 0;
      while (walker.nextNode() && n < 5000) {
        const el = walker.currentNode;
        if (el.className && typeof el.className === 'string')
          el.className.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
        n++;
      }
      return { classes: [...classes].sort(), total: n };
    });
    result.classes = structure.classes;

  } catch (e) {
    result.error = e.message;
  } finally {
    await context.close();
  }
  return result;
}

async function main() {
  const baseline = loadJson(BASELINE_FILE, {});
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  const results = [];
  let hasChanges = false;

  for (const [pid, config] of Object.entries(PROVIDERS)) {
    console.log(`[${pid}] ${config.url}`);
    const result = await testProvider(browser, pid, config);
    results.push(result);

    const prev = baseline[pid];
    if (prev) {
      if (prev.reachable !== result.reachable) hasChanges = true;
      if (prev.redirected !== result.redirected) hasChanges = true;

      const oldCls = new Set(prev.classes || []);
      const newCls = new Set(result.classes || []);
      const removed = [...oldCls].filter(c => !newCls.has(c));
      const added = [...newCls].filter(c => !oldCls.has(c));
      const pct = Math.round((removed.length + added.length) / (oldCls.size || 1) * 100);
      if (pct > 10) {
        result.structureChanged = true;
        result.classesAdded = added.length;
        result.classesRemoved = removed.length;
        result.changePercent = pct;
        hasChanges = true;
        console.log(`  ⚠️ Structure changed: +${added.length}/-${removed.length} (${pct}%)`);
      }
    }

    console.log(`  ${result.reachable ? '✅' : '❌'} ${result.htmlLength} bytes`);
  }

  await browser.close();

  // Save
  const currentData = {};
  for (const r of results) currentData[r.provider] = r;
  saveJson(BASELINE_FILE, currentData);

  saveJson(REPORT_FILE, {
    timestamp: new Date().toISOString(),
    results,
  });

  if (hasChanges) {
    console.log('\n__CHANGES_DETECTED__');
    process.exit(1);
  } else {
    console.log('\n__NO_CHANGES__');
  }
}

main().catch(e => { console.error(e); process.exit(2); });
