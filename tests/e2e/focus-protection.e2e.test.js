import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '../..');

test.describe('Focus Protection E2E', () => {
  test.setTimeout(60000);

  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    context = await browser.newContext({
      viewport: { width: 1024, height: 768 }
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    await page.goto(`file://${EXTENSION_PATH}/tests/e2e/test-focus-protection.html`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await browser.close().catch(() => {});
  });

  test('Test 1: Focus should stay on textarea when iframe steals focus during loading', async () => {
    await page.click('#unified-input');
    await page.waitForTimeout(100);

    let activeId = await page.evaluate(() => window.getActiveElementId());
    expect(activeId).toBe('unified-input');

    // Add iframe that tries to steal focus (it will be in "loading" state)
    await page.evaluate(() => window.addFocusStealingIframe(100));

    // Wait for focus steal attempt
    await page.waitForTimeout(800);

    // Focus should still be on textarea (protected while loading)
    activeId = await page.evaluate(() => window.getActiveElementId());
    expect(activeId).toBe('unified-input');
  });

  test('Test 2: Focus should stay on textarea while typing when iframe loads', async () => {
    await page.click('#unified-input');
    await page.waitForTimeout(50);
    await page.keyboard.type('hel', { delay: 80 });

    // Add iframe that steals focus quickly
    await page.evaluate(() => window.addFocusStealingIframe(50));

    // Continue typing
    await page.keyboard.type('lo world', { delay: 80 });
    await page.waitForTimeout(500);

    const activeId = await page.evaluate(() => window.getActiveElementId());
    expect(activeId).toBe('unified-input');

    const value = await page.inputValue('#unified-input');
    expect(value).toContain('hel');
  });

  test('Test 3: Focus should stay when multiple iframes load at different times', async () => {
    await page.click('#unified-input');
    await page.keyboard.type('test', { delay: 50 });

    // Add multiple iframes with staggered timings
    await page.evaluate(() => {
      window.addFocusStealingIframe(100);
      window.addFocusStealingIframe(300);
      window.addFocusStealingIframe(600);
    });

    await page.waitForTimeout(1200);

    const activeId = await page.evaluate(() => window.getActiveElementId());
    expect(activeId).toBe('unified-input');
  });

  test('Test 4: After all iframes loaded, user can click into iframe freely', async () => {
    await page.click('#unified-input');
    await page.waitForTimeout(50);

    // Add iframe and wait for it to fully load + grace period (3s)
    await page.evaluate(() => window.addFocusStealingIframe(50));
    await page.waitForTimeout(4000);

    // Verify loading count is 0 (all loaded)
    const loadingCount = await page.evaluate(() => window.getLoadingCount());
    expect(loadingCount).toBe(0);

    // Now simulate user clicking the iframe — focus should NOT be pulled back
    // Dispatch mousedown on iframe (simulates real click) then focus it
    const moved = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      iframe.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      iframe.focus();
      return document.activeElement === iframe;
    });
    expect(moved).toBe(true);

    await page.waitForTimeout(200);

    // Focus should stay on iframe (no protection since loading is done)
    const activeTag = await page.evaluate(() => window.getActiveElementTag());
    expect(activeTag).toBe('IFRAME');
  });

  test('Test 5: Rapid iframe reloads should not steal focus', async () => {
    await page.click('#unified-input');
    await page.keyboard.type('important text', { delay: 30 });

    for (let i = 0; i < 3; i++) {
      await page.evaluate((delay) => window.addFocusStealingIframe(delay), 50 + i * 100);
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(1000);

    const activeId = await page.evaluate(() => window.getActiveElementId());
    expect(activeId).toBe('unified-input');
  });

  test('Test 6: Focus protection re-activates when new iframe starts loading', async () => {
    await page.click('#unified-input');

    // Add iframe and wait for it to finish loading + grace period
    await page.evaluate(() => window.addFocusStealingIframe(50));
    await page.waitForTimeout(4000);

    let loadingCount = await page.evaluate(() => window.getLoadingCount());
    expect(loadingCount).toBe(0);

    // Now add a new iframe (simulates adding a new panel)
    // Focus should be protected again while it loads
    await page.click('#unified-input');
    await page.waitForTimeout(50);
    await page.evaluate(() => window.addFocusStealingIframe(100));

    await page.waitForTimeout(500);

    // Focus should still be on textarea (protected during second load)
    const activeId = await page.evaluate(() => window.getActiveElementId());
    expect(activeId).toBe('unified-input');
  });
});
