/**
 * Playwright test for import bug fix
 * Tests the file input reset behavior directly
 */

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEST_HTML = `file://${join(__dirname, 'test-file-input.html')}`;

async function runTest() {
  console.log('🧪 Testing file input bug fix with Playwright...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Create test page
    console.log('1️⃣ Opening test page...');
    await page.goto(TEST_HTML);
    await page.waitForLoadState('networkidle');
    console.log('   ✓ Test page loaded\n');
    
    // Get initial state
    console.log('2️⃣ Checking initial state...');
    const initialLog = await page.textContent('#log');
    console.log(`   Initial log: ${initialLog}\n`);
    
    // Test 1: First import
    console.log('3️⃣ Testing first file import...');
    
    // Click button
    await page.click('#test-btn');
    await page.waitForTimeout(100);
    
    // Set file
    await page.locator('#file-input').setInputFiles('/tmp/test-prompts.json');
    await page.waitForTimeout(500);
    
    // Check result
    const result1 = await page.textContent('#result');
    console.log(`   First import: ${result1}`);
    
    const log1 = await page.textContent('#log');
    console.log(`   Log: ${log1}\n`);
    
    // Test 2: Second import (same file) - THE BUG FIX TEST
    console.log('4️⃣ Testing second import with same file...');
    console.log('   (This is where the bug would fail!)');
    
    // Click button again
    await page.click('#test-btn');
    await page.waitForTimeout(100);
    
    // Set the SAME file again
    await page.locator('#file-input').setInputFiles('/tmp/test-prompts.json');
    await page.waitForTimeout(500);
    
    // Check result
    const result2 = await page.textContent('#result');
    console.log(`   Second import: ${result2}`);
    
    const log2 = await page.textContent('#log');
    console.log(`   Log: ${log2}\n`);
    
    // Verify bug fix
    console.log('5️⃣ Verification:');
    if (result1.includes('Import #1') && result2.includes('Import #2')) {
      console.log('   ✅✅✅ BUG FIX VERIFIED! ✅✅✅');
      console.log('   Same file imported successfully twice!');
    } else if (result2.includes('no change') || !result2.includes('Import')) {
      console.log('   ❌ Bug still exists - second import failed');
    } else {
      console.log('   ⚠️ Unexpected result');
    }
    
    // Screenshot
    await page.screenshot({ path: '/tmp/playwright-final-result.png' });
    console.log('\n📸 Screenshot: /tmp/playwright-final-result.png');
    
    // Keep open for a moment
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: '/tmp/playwright-error.png' });
    throw error;
  } finally {
    await browser.close();
  }
}

runTest();
