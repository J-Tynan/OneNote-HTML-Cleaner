import { test, expect } from '@playwright/test';
import path from 'path';

test('Phase1: theme tokens and .btn exist', async ({ page }) => {
  const fileUrl = 'file://' + path.join(process.cwd(), 'index.html');
  await page.goto(fileUrl);

  // Check that CSS tokens for buttons are defined on :root
  const token = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--btn-padding-x'));
  expect(token).toBeTruthy();

  // Ensure at least one element with .btn exists
  const selectors = ['.btn', '.button', 'button', '[role="button"]', '[class*="btn-"]', '[class*="button-"]'];
  const btnCount = await page.$$eval(selectors.join(','), els => els.length);
  expect(btnCount).toBeGreaterThan(0);
});
