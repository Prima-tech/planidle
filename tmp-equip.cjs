const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 750 } });
  const out = {};
  try {
    const BASE = 'http://localhost:4273';
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.click('.login-btn');
    await page.waitForSelector('.hero-card', { timeout: 15000 });
    await page.click('.hero-card');
    await page.waitForTimeout(300);
    await page.click('.continue-btn');
    await page.waitForSelector('app-footer-bar', { timeout: 20000 });
    await page.waitForTimeout(5000);

    await page.evaluate(() => window.ng.getComponent(document.querySelector('app-footer-bar')).openEquipment());
    await page.waitForTimeout(1500);

    const eq = await page.$('app-equipment');
    if (eq) await eq.screenshot({ path: 'tmp-equip.png' });
    else { await page.screenshot({ path: 'tmp-equip.png' }); out.note = 'no app-equipment, full page'; }

    // computar colores de fondo reales
    out.colors = await page.evaluate(() => {
      const slot = document.querySelector('app-equipment .equip-slot');
      const item = document.querySelector('app-equipment .equip-item');
      const cs = el => el ? getComputedStyle(el).backgroundColor : null;
      return { slotBg: cs(slot), itemBg: cs(item), slotCount: document.querySelectorAll('app-equipment .equip-slot').length };
    });
  } catch (e) { out.error = e.message; }
  finally { console.log('===RESULT==='); console.log(JSON.stringify(out, null, 2)); await browser.close(); }
})();
