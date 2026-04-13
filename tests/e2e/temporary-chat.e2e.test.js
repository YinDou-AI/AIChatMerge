import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '../..');

test.describe('Temporary Chat E2E', () => {
  test.setTimeout(30000);

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
    await page.goto(`file://${EXTENSION_PATH}/tests/e2e/test-temporary-chat.html`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await browser.close().catch(() => {});
  });

  test('retries temporary chat for supported providers and stops after success', async () => {
    await page.evaluate(async () => {
      window.setControlledIframeProvider('gemini');
      await window.addControlledIframe();
      window.setTempChatSuccessTimeline([2500]);
    });

    await page.click('#unified-input');
    await page.waitForTimeout(50);
    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(5200);

    const debugState = await page.evaluate(() => window.getTemporaryChatDebugState());
    const newChatMessages = debugState.messageLog.filter(entry => entry.type === 'NEW_CHAT');
    const enableMessages = debugState.messageLog.filter(entry => entry.type === 'ENABLE_TEMP_CHAT');

    expect(newChatMessages).toHaveLength(1);
    expect(enableMessages).toHaveLength(2);
    expect(enableMessages.map(entry => entry.delay)).toEqual([1200, 2500]);
    expect(debugState.isTemporaryChatModeEnabled).toBe(true);
    expect(debugState.temporaryChatButtonActive).toBe(true);
    expect(debugState.pendingPanelCount).toBe(0);
    expect(debugState.temporaryChatButtonDisabled).toBe(false);

    const activeId = await page.evaluate(() => window.getActiveElementId());
    expect(activeId).toBe('unified-input');
  });

  test('skips unsupported providers without sending temp chat messages', async () => {
    await page.evaluate(async () => {
      window.setControlledIframeProvider('google');
      await window.addControlledIframe();
      window.setTempChatSuccessTimeline([]);
    });

    await page.click('#unified-input');
    await page.waitForTimeout(50);
    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(5200);

    const debugState = await page.evaluate(() => window.getTemporaryChatDebugState());
    const newChatMessages = debugState.messageLog.filter(entry => entry.type === 'NEW_CHAT');
    const enableMessages = debugState.messageLog.filter(entry => entry.type === 'ENABLE_TEMP_CHAT');

    expect(newChatMessages).toHaveLength(1);
    expect(enableMessages).toHaveLength(0);
    expect(debugState.isTemporaryChatModeEnabled).toBe(true);
    expect(debugState.temporaryChatButtonActive).toBe(true);
    expect(debugState.pendingPanelCount).toBe(0);
    expect(debugState.temporaryChatButtonDisabled).toBe(false);
  });

  test('clicking the temporary chat button again disables temporary mode', async () => {
    await page.evaluate(async () => {
      window.setControlledIframeProvider('gemini');
      await window.addControlledIframe();
      window.setTempChatSuccessTimeline([1200]);
    });

    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(5200);
    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(1200);

    const debugState = await page.evaluate(() => window.getTemporaryChatDebugState());
    const disableMessages = debugState.messageLog.filter(entry => entry.type === 'DISABLE_TEMP_CHAT');

    expect(debugState.isTemporaryChatModeEnabled).toBe(false);
    expect(debugState.temporaryChatButtonActive).toBe(false);
    expect(disableMessages).toEqual([
      expect.objectContaining({ providerId: 'gemini', source: 'toggle' })
    ]);
  });

  test('disabling temporary mode also creates a new chat for unsupported providers', async () => {
    await page.evaluate(async () => {
      window.setControlledIframeProvider('kimi');
      await window.addControlledIframe();
      window.setTempChatSuccessTimeline([]);
    });

    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(5200);
    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(1200);

    const debugState = await page.evaluate(() => window.getTemporaryChatDebugState());
    const newChatMessages = debugState.messageLog.filter(entry => entry.type === 'NEW_CHAT');
    const disableMessages = debugState.messageLog.filter(entry => entry.type === 'DISABLE_TEMP_CHAT');

    expect(debugState.isTemporaryChatModeEnabled).toBe(false);
    expect(debugState.temporaryChatButtonActive).toBe(false);
    expect(newChatMessages).toEqual([
      expect.objectContaining({ providerId: 'kimi' }),
      expect.objectContaining({ providerId: 'kimi' })
    ]);
    expect(disableMessages).toHaveLength(0);
  });

  test('new chat keeps temporary mode active for Gemini', async () => {
    await page.evaluate(async () => {
      window.setControlledIframeProvider('gemini');
      await window.addControlledIframe();
      window.setTempChatSuccessTimeline([1200]);
    });

    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(5200);
    await page.click('#new-chat-btn');
    await page.waitForTimeout(5200);

    const debugState = await page.evaluate(() => window.getTemporaryChatDebugState());
    const disableMessages = debugState.messageLog.filter(entry => entry.type === 'DISABLE_TEMP_CHAT');
    const newChatMessages = debugState.messageLog.filter(entry => entry.type === 'NEW_CHAT');
    const enableMessages = debugState.messageLog.filter(entry => entry.type === 'ENABLE_TEMP_CHAT');

    expect(debugState.isTemporaryChatModeEnabled).toBe(true);
    expect(debugState.temporaryChatButtonActive).toBe(true);
    expect(debugState.temporaryChatButtonDisabled).toBe(false);
    expect(disableMessages).toHaveLength(0);
    expect(newChatMessages).toHaveLength(2);
    expect(enableMessages).toHaveLength(2);
  });

  test('new chat keeps URL-driven providers on temporary chat URLs', async () => {
    await page.evaluate(async () => {
      window.setControlledIframeProvider('chatgpt');
      await window.addControlledIframe();
      window.setTempChatSuccessTimeline([]);
    });

    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(1200);
    await page.click('#new-chat-btn');
    await page.waitForTimeout(1200);

    const debugState = await page.evaluate(() => window.getTemporaryChatDebugState());
    const disableMessages = debugState.messageLog.filter(entry => entry.type === 'DISABLE_TEMP_CHAT');
    const reloadMessages = debugState.messageLog.filter(entry => entry.type === 'RELOAD');

    expect(debugState.isTemporaryChatModeEnabled).toBe(true);
    expect(debugState.temporaryChatButtonActive).toBe(true);
    expect(debugState.controlledPanelUrl).toBe('https://chatgpt.com/?temporary-chat=true');
    expect(disableMessages).toHaveLength(0);
    expect(reloadMessages).toEqual([
      expect.objectContaining({ providerId: 'chatgpt', url: 'https://chatgpt.com/?temporary-chat=true' }),
      expect.objectContaining({ providerId: 'chatgpt', url: 'https://chatgpt.com/?temporary-chat=true' })
    ]);
  });

  test('new chat re-activates Grok private mode after reload', async () => {
    await page.evaluate(async () => {
      window.setControlledIframeProvider('grok');
      await window.addControlledIframe();
      window.setTempChatSuccessTimeline([1200]);
    });

    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(5200);
    await page.click('#new-chat-btn');
    await page.waitForTimeout(5200);

    const debugState = await page.evaluate(() => window.getTemporaryChatDebugState());
    const disableMessages = debugState.messageLog.filter(entry => entry.type === 'DISABLE_TEMP_CHAT');
    const reloadMessages = debugState.messageLog.filter(entry => entry.type === 'RELOAD');
    const enableMessages = debugState.messageLog.filter(entry => entry.type === 'ENABLE_TEMP_CHAT');
    const newChatMessages = debugState.messageLog.filter(entry => entry.type === 'NEW_CHAT');

    expect(debugState.isTemporaryChatModeEnabled).toBe(true);
    expect(debugState.temporaryChatButtonActive).toBe(true);
    expect(debugState.controlledPanelUrl).toBe('https://grok.com/c#private');
    expect(disableMessages).toHaveLength(0);
    expect(reloadMessages).toEqual([
      expect.objectContaining({ providerId: 'grok', url: 'https://grok.com/c#private' })
    ]);
    expect(newChatMessages).toEqual([
      expect.objectContaining({ providerId: 'grok' })
    ]);
    expect(enableMessages).toHaveLength(2);
  });

  test('double new chat cancels previous Gemini retries and restarts a fresh cycle', async () => {
    await page.evaluate(async () => {
      window.setControlledIframeProvider('gemini');
      await window.addControlledIframe();
      window.setTempChatSuccessTimeline([]);
    });

    await page.click('#temporary-chat-btn');
    await page.waitForTimeout(100);
    await page.click('#new-chat-btn');
    await page.waitForTimeout(100);
    await page.click('#new-chat-btn');
    await page.waitForTimeout(4300);

    const debugState = await page.evaluate(() => window.getTemporaryChatDebugState());
    const enableMessages = debugState.messageLog.filter(entry => entry.type === 'ENABLE_TEMP_CHAT');
    const cycleIds = [...new Set(enableMessages.map(entry => entry.cycleId))];

    expect(debugState.isTemporaryChatModeEnabled).toBe(true);
    expect(debugState.activeTempChatCycleId).toBe(3);
    expect(enableMessages.map(entry => entry.delay)).toEqual([1200, 2500, 4000]);
    expect(cycleIds).toEqual([3]);
  });
});
