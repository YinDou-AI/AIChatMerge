/**
 * 从 Chrome 用户配置导出 Cookie
 *
 * 用法:
 *   1. 关闭谷歌浏览器
 *   2. node export-cookies.js
 *   3. 重新打开浏览器
 *
 * 导出后，selector-healthcheck.js 会自动加载这些 Cookie。
 * Cookie 通常几周内有效，过期后重新运行此脚本即可。
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const CHROME_USER_DATA = 'C:/Users/huawei/AppData/Local/Google/Chrome/User Data';

// 要导出 Cookie 的提供商列表
const PROVIDERS = [
  { id: 'deepseek', url: 'https://chat.deepseek.com/' },
  { id: 'kimi', url: 'https://kimi.com/' },
  { id: 'doubao', url: 'https://www.doubao.com/chat/' },
  { id: 'qianwen', url: 'https://www.qianwen.com/chat' },
  { id: 'zhipu', url: 'https://chatglm.cn/' },
  { id: 'wenxin', url: 'https://chat.baidu.com/' },
  { id: 'yuanbao', url: 'https://yuanbao.tencent.com/chat/' },
  { id: 'metaso', url: 'https://metaso.cn/' },
  { id: 'chatgpt', url: 'https://chatgpt.com/' },
  { id: 'gemini', url: 'https://gemini.google.com/' },
  { id: 'claude', url: 'https://claude.ai/new' },
  { id: 'grok', url: 'https://grok.com/' },
];

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
ensureDir(DATA_DIR);

async function main() {
  console.log('=== 导出 Chrome Cookie ===');
  console.log('');
  console.log('⚠️  请确保已关闭谷歌浏览器！');
  console.log('');

  if (!existsSync(CHROME_USER_DATA)) {
    console.error(`❌ 找不到 Chrome 用户数据目录: ${CHROME_USER_DATA}`);
    process.exit(1);
  }

  // 使用 Chrome 的用户配置启动（复用登录态）
  console.log('正在启动 Chrome (复用你的登录态)...');
  const context = await chromium.launchPersistentContext(CHROME_USER_DATA, {
    headless: false, // 有些网站检测 headless，用有头模式更稳
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      `--profile-directory=Default`,
    ],
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  let successCount = 0;
  let failCount = 0;

  for (const provider of PROVIDERS) {
    console.log(`\n[${provider.id}] 访问 ${provider.url} ...`);
    const page = await context.newPage();

    try {
      await page.goto(provider.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // 等待页面加载完成
      await page.waitForTimeout(5000);

      const finalUrl = page.url();
      const title = await page.title();

      // 判断是否已登录
      const hasInput = await page.locator('textarea, [contenteditable="true"]').count();
      const isLoggedIn = hasInput > 0;
      const isRedirected = !finalUrl.startsWith(provider.url.replace(/\/$/, ''));

      if (isLoggedIn) {
        console.log(`  ✅ 已登录 (跳转到: ${finalUrl})`);
      } else if (isRedirected) {
        console.log(`  ⚠️  被重定向到: ${finalUrl} (可能需要重新登录)`);
      } else {
        console.log(`  ⚠️  未检测到输入框，可能未登录`);
      }

      // 导出当前域名的所有 Cookie
      const allCookies = await context.cookies();
      const domain = new URL(finalUrl || provider.url).hostname;
      const providerCookies = allCookies.filter(c => {
        // 匹配域名（包括父域名）
        return c.domain === domain ||
               c.domain === `.${domain}` ||
               domain.endsWith(c.domain.replace(/^\./, '')) ||
               c.domain.endsWith(domain.split('.').slice(-2).join('.'));
      });

      if (providerCookies.length > 0) {
        const cookiePath = join(DATA_DIR, `${provider.id}-cookies.json`);
        writeFileSync(cookiePath, JSON.stringify(providerCookies, null, 2), 'utf-8');
        console.log(`  📦 已保存 ${providerCookies.length} 个 Cookie`);
        successCount++;
      } else {
        console.log(`  ⚠️  没有找到 Cookie`);
        failCount++;
      }

    } catch (e) {
      console.log(`  ❌ 错误: ${e.message}`);
      failCount++;
    } finally {
      await page.close();
    }
  }

  // 额外保存所有 Cookie 的合集（供 healthcheck 使用）
  const allCookies = await context.cookies();
  const allCookiesPath = join(DATA_DIR, 'all-cookies.json');
  writeFileSync(allCookiesPath, JSON.stringify(allCookies, null, 2), 'utf-8');
  console.log(`\n📦 总计 ${allCookies.length} 个 Cookie 已保存到 all-cookies.json`);

  await context.close();

  console.log('\n=== 完成 ===');
  console.log(`✅ 成功: ${successCount} 个提供商`);
  console.log(`⚠️  失败: ${failCount} 个提供商`);
  console.log('');
  console.log('Cookie 已保存到 healthcheck/data/ 目录。');
  console.log('后续运行 node selector-healthcheck.js 会自动加载这些 Cookie。');
  console.log('几周后 Cookie 过期时，重新运行此脚本即可。');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
