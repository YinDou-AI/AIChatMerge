/**
 * Test script for import bug fix using Playwright
 * Tests that the same file can be imported multiple times
 */

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_FILE = '/tmp/test-prompts.json';
const OPTIONS_PAGE = `file://${join(__dirname, '../options/options.html')}`;

async function runTest() {
  console.log('🧪 Starting import bug fix test...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Open options page
    console.log('1️⃣ Opening options page...');
    await page.goto(OPTIONS_PAGE);
    await page.waitForLoadState('networkidle');
    console.log('   ✓ Page loaded\n');
    
    // Get initial prompt count
    console.log('2️⃣ Checking initial prompt count...');
    const initialCount = await page.textContent('#stat-prompts');
    console.log(`   Initial prompts: ${initialCount}\n`);
    
    // Test first import using setInputFiles
    console.log('3️⃣ Testing first import...');
    
    // Click the button to trigger file input reset (this is our fix!)
    await page.click('#import-custom-library');
    
    // Wait a bit for the click handler to execute
    await page.waitForTimeout(100);
    
    // Now set the file directly
    const fileInput = await page.locator('#import-custom-library-file');
    await fileInput.setInputFiles(TEST_FILE);
    
    // Wait for success message
    await page.waitForSelector('#status-success.show', { timeout: 5000 });
    const successMsg1 = await page.textContent('#status-success');
    console.log(`   ✓ First import result: ${successMsg1}\n`);
    
    // Get count after first import
    await page.waitForTimeout(500);
    const countAfterFirst = await page.textContent('#stat-prompts');
    console.log(`   Prompts after first import: ${countAfterFirst}\n`);
    
    // Test second import with SAME FILE (this is the bug we're testing)
    console.log('4️⃣ Testing second import with same file (BUG FIX TEST)...');
    
    // Clear the file input first (simulating the fix)
    await page.click('#import-custom-library');
    await page.waitForTimeout(100);
    
    // Try to import the same file again
    await fileInput.setInputFiles(TEST_FILE);
    
    // Wait for success message
    await page.waitForSelector('#status-success.show', { timeout: 5000 });
    const successMsg2 = await page.textContent('#status-success');
    console.log(`   ✓ Second import result: ${successMsg2}\n`);
    
    // Get count after second import
    await page.waitForTimeout(500);
    const countAfterSecond = await page.textContent('#stat-prompts');
    console.log(`   Prompts after second import: ${countAfterSecond}\n`);
    
    // Verify results
    console.log('5️⃣ Test Results:');
    let allPassed = true;
    
    if (parseInt(countAfterFirst) > parseInt(initialCount)) {
      console.log('   ✅ First import worked');
    } else {
      console.log('   ❌ First import failed');
      allPassed = false;
    }
    
    // Second import should succeed (the bug fix)
    // Since it's the same file, it might show "already exist" but should NOT hang/fail
    if (successMsg2 && successMsg2.length > 0) {
      console.log('   ✅ Second import responded (BUG FIXED!)');
    } else {
      console.log('   ❌ Second import failed - no response');
      allPassed = false;
    }
    
    // Take final screenshot
    await page.screenshot({ path: '/tmp/playwright-test-result.png' });
    console.log('   📸 Screenshot saved to /tmp/playwright-test-result.png\n');
    
    if (allPassed) {
      console.log('\n🎉 All tests passed! Bug fix verified!');
    } else {
      console.log('\n⚠️ Some tests failed');
    }
    
    // Keep browser open for manual verification
    console.log('\n⏳ Keeping browser open for 3 seconds for verification...');
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/playwright-test-error.png' });
    console.log('Error screenshot saved to /tmp/playwright-test-error.png');
    throw error;
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
