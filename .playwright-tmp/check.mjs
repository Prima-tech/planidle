import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
const errors = [];

page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:4200', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(5000);

console.log('=== URL:', page.url());
console.log('=== Console logs:');
logs.forEach(l => console.log(l));
console.log('=== Page errors:', errors);

await browser.close();
