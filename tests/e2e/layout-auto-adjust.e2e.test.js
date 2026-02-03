import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '../..');

test.describe('Layout Auto-Adjust E2E', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Launch Chrome with extension loaded
    const launchOptions = {
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };
    
    // Use existing Chrome installation if available
    const chromeChannel = process.platform === 'darwin' ? 'chrome' : 'chromium';
    
    browser = await chromium.launch(launchOptions);
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Open the test HTML page directly
    await page.goto(`file://${EXTENSION_PATH}/tests/e2e/test-layout-auto-adjust.html`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Test 1: should start with 1x2 layout and 0 panels', async () => {
    const result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    
    expect(result.layout).toBe('1x2');
    expect(result.panels).toBe(0);
  });

  test('Test 2: adding first panel should keep 1x2 layout', async () => {
    await page.click('#add-panel-btn');
    await page.waitForTimeout(500);
    
    const result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    
    expect(result.layout).toBe('1x2');
    expect(result.panels).toBe(1);
  });

  test('Test 3: adding second panel should keep 1x2 layout (at capacity)', async () => {
    // Add first panel
    await page.click('#add-panel-btn');
    await page.waitForTimeout(500);
    
    // Add second panel
    await page.click('#add-panel-btn');
    await page.waitForTimeout(500);
    
    const result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    
    expect(result.layout).toBe('1x2');
    expect(result.panels).toBe(2);
  });

  test('Test 4: adding third panel should auto-upgrade to 1x3 layout', async () => {
    // Add panels until 2
    for (let i = 0; i < 2; i++) {
      await page.click('#add-panel-btn');
      await page.waitForTimeout(300);
    }
    
    // Verify at 1x2 with 2 panels
    let result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    expect(result.layout).toBe('1x2');
    expect(result.panels).toBe(2);
    
    // Add third panel - THIS IS THE KEY TEST
    await page.click('#add-panel-btn');
    await page.waitForTimeout(500);
    
    result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    
    // Should auto-upgrade to 1x3
    expect(result.layout).toBe('1x3');
    expect(result.panels).toBe(3);
  });

  test('Test 5: should continue upgrading through 1x4, 1x5, 1x6, 1x7', async () => {
    // Add 2 panels first (to reach capacity of 1x2)
    for (let i = 0; i < 2; i++) {
      await page.click('#add-panel-btn');
      await page.waitForTimeout(300);
    }
    
    // Then test the upgrade sequence
    const expectedUpgrades = [
      { fromLayout: '1x2', toLayout: '1x3' },
      { fromLayout: '1x3', toLayout: '1x4' },
      { fromLayout: '1x4', toLayout: '1x5' },
      { fromLayout: '1x5', toLayout: '1x6' },
      { fromLayout: '1x6', toLayout: '1x7' }
    ];
    
    for (const expected of expectedUpgrades) {
      // Add one panel
      await page.click('#add-panel-btn');
      await page.waitForTimeout(500);
      
      const result = await page.evaluate(() => ({
        layout: window.getCurrentLayout(),
        panels: window.getPanelCount()
      }));
      
      // Verify upgraded to expected layout
      expect(result.layout).toBe(expected.toLayout);
    }
    
    // Final state should be 1x7 with 7 panels
    const finalResult = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    expect(finalResult.layout).toBe('1x7');
    expect(finalResult.panels).toBe(7);
  });

  test('Test 6: should stop at 1x7 maximum', async () => {
    // Add 7 panels
    for (let i = 0; i < 7; i++) {
      await page.click('#add-panel-btn');
      await page.waitForTimeout(300);
    }
    
    // Verify at 1x7 with 7 panels
    let result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    expect(result.layout).toBe('1x7');
    expect(result.panels).toBe(7);
    
    // Try to add 8th panel (should fail with alert)
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Maximum');
      await dialog.accept();
    });
    
    await page.click('#add-panel-btn');
    await page.waitForTimeout(500);
    
    // Should still be 1x7 with 7 panels
    result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    expect(result.layout).toBe('1x7');
    expect(result.panels).toBe(7);
  });

  test('Test 7: clear should reset to 1x2', async () => {
    // Add some panels
    for (let i = 0; i < 4; i++) {
      await page.click('#add-panel-btn');
      await page.waitForTimeout(300);
    }
    
    // Verify at 1x4
    let result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    expect(result.layout).toBe('1x4');
    
    // Clear all
    await page.click('#clear-btn');
    await page.waitForTimeout(500);
    
    result = await page.evaluate(() => ({
      layout: window.getCurrentLayout(),
      panels: window.getPanelCount()
    }));
    expect(result.layout).toBe('1x2');
    expect(result.panels).toBe(0);
  });
});
