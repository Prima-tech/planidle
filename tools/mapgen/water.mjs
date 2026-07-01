// Generación procedural de agua: lagos/charcas rectangulares con las piezas de
// orilla del pack (water-autotile.json). El arte del pack (Water_coasts) solo
// cubre rectángulos redondeados: lados rectos con secuencia inicio/medio/fin,
// esquinas del rect en hierba pura (sin agua debajo) y follaje en las diagonales
// interiores — NO hay piezas para escalones diagonales, así que nada de óvalos.
// Esquema extraído a mano de la charca 5×5 de Glades.tmx.
// Escribe agua de fondo en `base`, orillas en `agua`, y colisión. Verifica
// conectividad para no aislar los portales.
// Devuelve { cells } para que generate.mjs ponga las flores cerca del agua.
import fs from 'node:fs';
import path from 'node:path';

const AT = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'water-autotile.json'), 'utf8'));
const K = (x, y) => `${x},${y}`;

// Secuencia de un lado con esquinas: start, medios variados, end.
function edgeSeq(rng, side, len) {
  const seq = [side.start];
  while (seq.length < len - 1) seq.push(rng.pick(side.mid));
  if (len >= 2) seq.push(side.end);
  return seq;
}

// Lago w×h (relativo a 0,0): fill = rect menos las 4 esquinas; coast por posición.
function buildPond(rng, w, h) {
  const R = AT.rect;
  const fill = new Set(), coast = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;   // esquinas = hierba
    fill.add(K(x, y));
  }
  const n = edgeSeq(rng, R.n, w - 2), s = edgeSeq(rng, R.s, w - 2);
  const wSeq = edgeSeq(rng, R.w, h - 2), e = edgeSeq(rng, R.e, h - 2);
  for (let i = 0; i < w - 2; i++) { coast.set(K(1 + i, 0), n[i]); coast.set(K(1 + i, h - 1), s[i]); }
  for (let i = 0; i < h - 2; i++) { coast.set(K(0, 1 + i), wSeq[i]); coast.set(K(w - 1, 1 + i), e[i]); }
  coast.set(K(1, 1), R.innerNW); coast.set(K(w - 2, 1), R.innerNE);
  coast.set(K(1, h - 2), R.innerSW); coast.set(K(w - 2, h - 2), R.innerSE);
  return { fill, coast };
}

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

// Coloca un lago en (ox,oy) si cabe y no aísla portales. Devuelve true si lo colocó.
function tryPlacePond(pond, ox, oy, ctx) {
  const { W, H, base, agua, collision, occupied, spawn, portals } = ctx;
  const gFill = new Set([...pond.fill].map(k => { const [x, y] = k.split(',').map(Number); return K(ox + x, oy + y); }));
  for (const k of gFill) { const [x, y] = k.split(',').map(Number); if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false; }
  for (const k of gFill) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (occupied.has(K(x + dx, y + dy))) return false; }
  const testBlocked = new Set(collision); for (const k of gFill) testBlocked.add(k);
  if (!connected(W, H, testBlocked, spawn, portals)) return false;
  // commit
  for (const k of gFill) { const [x, y] = k.split(',').map(Number); base[y * W + x] = AT.fillGid; collision.add(k); }
  for (const [k, local] of pond.coast) { const [x, y] = k.split(',').map(Number); agua[(oy + y) * W + ox + x] = AT.firstgid + local; }
  for (const k of gFill) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) occupied.add(K(x + dx, y + dy)); }
  for (const k of gFill) ctx.waterCells.add(k);
  return true;
}

export function generateWater(rng, ctx) {
  const { W, H } = ctx;
  ctx.waterCells = new Set();
  // lagos rectangulares de tamaño variado (uno grande + varios medianos)
  const nPonds = rng.int(3, 5);
  for (let i = 0, tries = 0; i < nPonds && tries < 150; tries++) {
    const big = i === 0;   // el primero, más lago que charca
    const w = big ? rng.int(8, 12) : rng.int(5, 9);
    const h = big ? rng.int(7, 10) : rng.int(5, 8);
    if (w > W - 6 || h > H - 6) continue;
    const pond = buildPond(rng, w, h);
    const ox = rng.int(2, W - w - 2), oy = rng.int(2, H - h - 2);
    if (tryPlacePond(pond, ox, oy, ctx)) i++;
  }
  return { cells: ctx.waterCells };
}
