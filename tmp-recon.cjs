const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 750 } });
  const out = {};
  try {
    const BASE = 'http://localhost:4274';
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.click('.login-btn');
    await page.waitForSelector('.hero-card', { timeout: 15000 });
    await page.click('.hero-card');
    await page.waitForTimeout(300);
    await page.click('.continue-btn');
    await page.waitForSelector('app-footer-bar', { timeout: 20000 });
    await page.waitForTimeout(5000);
    await page.click('app-footer-bar ion-icon[name="shirt-outline"]'); // abre equipo (no usado, solo warm)
    await page.waitForTimeout(300);
    await page.click('app-footer-bar ion-icon[name="shirt-outline"]'); // cierra
    await page.waitForTimeout(300);
    // abrir inventario via componente footer
    await page.click('body'); // tick
    await page.evaluate(() => window.ng.getComponent(document.querySelector('app-footer-bar')).openInventory());
    await page.waitForSelector('app-inventory .tab', { timeout: 8000 });
    await page.waitForTimeout(800);

    out.test = await page.evaluate(() => {
      const cmp = window.ng.getComponent(document.querySelector('app-inventory'));
      const gs = cmp.gatheringService;
      const drops = [];
      cmp.inventoryService.dropToWorld$.subscribe(it => drops.push(it.name + (it.sum ? 'x' + it.sum : '')));
      const mkBag = n => ({ id: 'bag' + n, name: 'B' + n, category: 'Mochila', inventorySlots: n });
      const clear = () => { for (let t = 0; t < 4; t++) for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) cmp.inventories[t][r][c] = null; };
      const countName = nm => { let k = 0; for (let t = 0; t < 4; t++) for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if (cmp.inventories[t][r][c]?.name === nm) k++; return k; };
      const itemsInLocked = () => { let k = 0; for (let t = 0; t < 4; t++) for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if (!cmp.unlock.isUnlocked(t, r, c) && cmp.inventories[t][r][c]) k++; return k; };

      const R = {};

      // --- Test A: reubicar a hueco libre ---
      gs.equip('gather-backpack', mkBag(16)); // unlocked 36
      clear();
      cmp.inventories[1][1][0] = { id: 'a', name: 'ITEMA', mergeable: false }; // linear 5 en tab1: locked a 24
      R.A_unlocked36 = cmp.unlock.unlocked;
      gs.equip('gather-backpack', mkBag(4));  // unlocked 24 -> reconcile
      R.A_unlocked24 = cmp.unlock.unlocked;
      R.A_lockedCellEmpty = cmp.inventories[1][1][0] === null;
      R.A_itemStillExistsOnce = countName('ITEMA');
      R.A_itemsInLocked = itemsInLocked();
      R.A_dropsSoFar = [...drops];

      // --- Test B: soltar al suelo (sin espacio) ---
      gs.equip('gather-backpack', mkBag(16)); // unlocked 36
      clear();
      // Llenar TODAS las celdas que estaran desbloqueadas a 24: tab0 (20) + tab1 celdas 0..3
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) cmp.inventories[0][r][c] = { id: 'f' + r + c, name: 'FILL', mergeable: false };
      cmp.inventories[1][0][0] = { id: 'f100', name: 'FILL', mergeable: false };
      cmp.inventories[1][0][1] = { id: 'f101', name: 'FILL', mergeable: false };
      cmp.inventories[1][0][2] = { id: 'f102', name: 'FILL', mergeable: false };
      cmp.inventories[1][0][3] = { id: 'f103', name: 'FILL', mergeable: false };
      // Item en celda que se bloquea a 24 (tab1 linear 6)
      cmp.inventories[1][1][1] = { id: 'b', name: 'ITEMB', mergeable: false };
      gs.equip('gather-backpack', mkBag(4)); // unlocked 24 -> reconcile, sin hueco
      R.B_itemBInGrid = countName('ITEMB');
      R.B_itemsInLocked = itemsInLocked();
      R.B_drops = [...drops];

      return R;
    });
  } catch (e) { out.error = e.message; }
  finally { console.log('===RESULT==='); console.log(JSON.stringify(out, null, 2)); await browser.close(); }
})();
