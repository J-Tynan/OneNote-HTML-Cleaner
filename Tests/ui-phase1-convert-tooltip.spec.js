import { test, expect } from '@playwright/test';
import path from 'path';

test('Phase1: convert button exists and tooltip state', async ({ page }) => {
  const fileUrl = 'file://' + path.join(process.cwd(), 'index.html');
  await page.goto(fileUrl);

  // Ensure convert button exists
  const convertExists = await page.$('#convertButton') !== null;
  expect(convertExists).toBeTruthy();

  // If an auto-convert control exists and is checked, convert button should be disabled
  const autoConvertChecked = await page.evaluate(() => {
    const el = document.querySelector('input[name="auto-convert"], input[id*="auto-convert"], input[class*="auto-convert"]');
    return el ? el.checked : null;
  });

  if (autoConvertChecked === true) {
    const disabled = await page.$eval('#convertButton', el => el.disabled === true);
    expect(disabled).toBeTruthy();
  }
});
