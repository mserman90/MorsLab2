import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(process.env.APP_URL || 'http://localhost:5173', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
console.log('Desktop:', await page.title());
console.log('Page errors:', errors);
console.log('Overflow:', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
console.log('Mobile overflow:', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
await browser.close();