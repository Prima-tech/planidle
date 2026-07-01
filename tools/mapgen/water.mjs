// Generación procedural de agua: charcas de forma variada + río, autotileado con las
// piezas de orilla del pack (water-autotile.json). Escribe agua de fondo en `base`,
// orillas en `agua`, y colisión. Verifica conectividad para no aislar los portales.
import fs from 'node:fs';
import path from 'node:path';

const AT = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'water-autotile.json'), 'utf8'));
const K = (x, y) => `${x},${y}`;
const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };

function classify(x, y, has) {
  const inN = has(x, y - 1), inE = has(x + 1, y), inS = has(x, y + 1), inW = has(x - 1, y);
  const card = (inN ? 0 : 1) | (inE ? 0 : 2) | (inS ? 0 : 4) | (inW ? 0 : 8);
  if (card) return { t: 'E', m: card };
  const inNE = has(x + 1, y - 1), inSE = has(x + 1, y + 1), inSW = has(x - 1, y + 1), inNW = has(x - 1, y - 1);
  const diag = (inNE ? 0 : 1) | (inSE ? 0 : 2) | (inSW ? 0 : 4) | (inNW ? 0 : 8);
  if (diag) return { t: 'C', m: diag };
  return null;   // interior → agua sin orilla
}
function coastLocal(cls) {
  if (cls.t === 'E') {
    if (AT.edges[cls.m] != null) return AT.edges[cls.m];
    let best = null, bd = -1;                         // fallback: config con más bits en común
    for (const k in AT.edges) { const d = 4 - popcount((+k) ^ cls.m); if (d > bd) { bd = d; best = AT.edges[k]; } }
    return best;
  }
  return AT.corners[cls.m] ?? AT.corners[Object.keys(AT.corners)[0]];
}

// --- formas (footprint relativo) ---
function circle(r) { const s = new Set(); const c = r + 1; for (let y = 0; y <= 2 * r + 2; y++) for (let x = 0; x <= 2 * r + 2; x++) { const dx = x - c, dy = y - c; if (dx * dx + dy * dy <= r * r + r * 0.6) s.add(K(x, y)); } return s; }
function oval(rx, ry) { const s = new Set(); const cx = rx + 1, cy = ry + 1; for (let y = 0; y <= 2 * ry + 2; y++) for (let x = 0; x <= 2 * rx + 2; x++) { const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1.05) s.add(K(x, y)); } return s; }

function bbox(foot) { const xs = [...foot].map(k => +k.split(',')[0]), ys = [...foot].map(k => +k.split(',')[1]); return { minx: Math.min(...xs), miny: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }; }

// BFS: ¿el spawn alcanza todos los portales evitando `blocked`?
function connected(W, H, blocked, spawn, portals) {
  const seen = new Set([K(spawn.x, spawn.y)]), q = [[spawn.x, spawn.y]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = K(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || blocked.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return portals.every(p => seen.has(K(p.x, p.y)));
}

// coloca un footprint global si cabe y no aísla portales. Devuelve true si lo colocó.
function tryPlace(gfoot, fordCells, ctx) {
  const { W, H, base, agua, collision, occupied, spawn, portals } = ctx;
  for (const k of gfoot) { const [x, y] = k.split(',').map(Number); if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return false; }
  for (const k of gfoot) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (occupied.has(K(x + dx, y + dy))) return false; }
  const featColl = new Set([...gfoot].filter(k => !fordCells.has(k)));
  const testBlocked = new Set(collision); for (const k of featColl) testBlocked.add(k);
  if (!connected(W, H, testBlocked, spawn, portals)) return false;
  // commit
  const has = (x, y) => gfoot.has(K(x, y));
  for (const k of gfoot) { const [x, y] = k.split(',').map(Number); base[y * W + x] = AT.fillGid; }
  for (const k of gfoot) { const [x, y] = k.split(',').map(Number); const cls = classify(x, y, has); if (cls) agua[y * W + x] = AT.firstgid + coastLocal(cls); }
  for (const k of featColl) collision.add(k);
  for (const k of gfoot) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) occupied.add(K(x + dx, y + dy)); }
  return true;
}

function offset(foot, ox, oy) { return new Set([...foot].map(k => { const [x, y] = k.split(',').map(Number); return K(ox + x, oy + y); })); }

// El río puede cruzar el borde (sale del mapa) y no usa `occupied`; solo evita el
// núcleo de spawn/portales y exige que el vado mantenga conectados los portales.
function placeRiver(foot, fordCells, ctx) {
  const { W, H, base, agua, collision, occupied, spawn, portals } = ctx;
  const near = (x, y, px, py, r) => Math.abs(x - px) <= r && Math.abs(y - py) <= r;
  for (const k of foot) {
    const [x, y] = k.split(',').map(Number);
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    if (near(x, y, spawn.x, spawn.y, 5)) return false;
    for (const p of portals) if (near(x, y, p.x, p.y, 2)) return false;
  }
  const featColl = new Set([...foot].filter(k => !fordCells.has(k)));
  const testBlocked = new Set(collision); for (const k of featColl) testBlocked.add(k);
  if (!connected(W, H, testBlocked, spawn, portals)) return false;
  const has = (x, y) => foot.has(K(x, y));
  for (const k of foot) { const [x, y] = k.split(',').map(Number); base[y * W + x] = AT.fillGid; }
  for (const k of foot) { const [x, y] = k.split(',').map(Number); const cls = classify(x, y, has); if (cls) agua[y * W + x] = AT.firstgid + coastLocal(cls); }
  for (const k of featColl) collision.add(k);
  for (const k of foot) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) occupied.add(K(x + dx, y + dy)); }
  return true;
}

export function generateWater(rng, ctx) {
  const { W, H } = ctx;
  // --- charcas ---
  const nPonds = rng.int(2, 4);
  const shapes = () => rng.chance(0.5) ? circle(rng.int(2, 4)) : oval(rng.int(3, 5), rng.int(2, 3));
  for (let i = 0, tries = 0; i < nPonds && tries < 120; tries++) {
    const foot = shapes(); const b = bbox(foot);
    const ox = rng.int(1, W - b.w - 1), oy = rng.int(1, H - b.h - 1);
    if (tryPlace(offset(foot, ox, oy), new Set(), ctx)) i++;
  }
  // --- río (a veces): banda serpenteante que cruza el mapa, con un vado transitable ---
  if (rng.chance(0.5)) {
    const vertical = rng.chance(0.5), thick = rng.int(2, 3);
    const len = vertical ? H : W, dim = vertical ? W : H;
    const off = rng.int(8, Math.max(9, Math.floor(dim / 2) - 4)) * (rng.chance(0.5) ? 1 : -1);
    let base0 = Math.floor(dim / 2) + off;
    base0 = Math.max(thick + 1, Math.min(dim - thick - 2, base0));   // dentro del mapa
    const amp = rng.int(2, 4), ford = rng.int(Math.floor(len * 0.4), Math.floor(len * 0.6));
    const foot = new Set(), fordCells = new Set();
    for (let a = 0; a < len; a++) {
      const c = base0 + Math.round(amp * Math.sin(a / 5));
      for (let t = 0; t < thick; t++) {
        const x = vertical ? c + t : a, y = vertical ? a : c + t;
        foot.add(K(x, y));
        if (Math.abs(a - ford) <= 1) fordCells.add(K(x, y));   // 3 celdas de vado (sin colisión)
      }
    }
    placeRiver(foot, fordCells, ctx);
  }
}
