// SOLO REFERENCIA: muestrea de Glades.tmx el mapeo vecinos → tile de orilla y lo
// vuelca en water-autotile.auto.json. El water-autotile.json real usa el esquema
// "rect" hecho a mano (charca 5×5 + lago de Glades) — NO sobrescribir con este.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', '..', 'src', 'assets', 'tilemaps', 'biomas', 'grasslands');
const xml = fs.readFileSync(path.join(DIR, 'Glades.tmx'), 'utf8');
const FLIP = 0x1FFFFFFF;
const COAST_F = 743, WATER_F = 2459, TREES_F = 5345;

function layerGrid(name) {
  const re = new RegExp(`<layer\\b[^>]*\\bname="${name}"[\\s\\S]*?<data[^>]*>([\\s\\S]*?)</data>`);
  const m = xml.match(re); if (!m) return new Map();
  const grid = new Map();
  for (const c of m[1].matchAll(/<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">([\s\S]*?)<\/chunk>/g)) {
    const cx = +c[1], cy = +c[2], cw = +c[3], nums = (c[5].match(/-?\d+/g) || []).map(Number);
    for (let i = 0; i < nums.length; i++) if (nums[i]) grid.set(`${cx + (i % cw)},${cy + Math.floor(i / cw)}`, nums[i]);
  }
  return grid;
}
const mainSp = layerGrid('main space'), waterBg = layerGrid('water background');
const isW = (g) => g && (g & FLIP) >= WATER_F && (g & FLIP) < TREES_F;
const isC = (g) => g && (g & FLIP) >= COAST_F && (g & FLIP) < WATER_F;
const waterSet = new Set();
for (const [k, g] of waterBg) if (isW(g)) waterSet.add(k);
for (const [k, g] of mainSp) if (isC(g)) waterSet.add(k);

// Muestrear SOLO charcas pequeñas/medianas: el lago gigante usa talud de tierra marrón
// en sus orillas y contamina la votación. Componentes conexas (8-conn), quedarse con las
// de tamaño <= 80 celdas (las charcas de orilla de hierba limpia).
const compSeen = new Set(), good = new Set();
for (const k of waterSet) {
  if (compSeen.has(k)) continue;
  const st = [k], cells = []; compSeen.add(k);
  while (st.length) { const c = st.pop(); cells.push(c); const [x, y] = c.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const nk = `${x + dx},${y + dy}`; if (waterSet.has(nk) && !compSeen.has(nk)) { compSeen.add(nk); st.push(nk); } } }
  if (cells.length >= 6 && cells.length <= 80) for (const c of cells) good.add(c);
}

const K = (x, y) => `${x},${y}`;
function classify(x, y, set) {
  const inN = set.has(K(x, y - 1)), inE = set.has(K(x + 1, y)), inS = set.has(K(x, y + 1)), inW = set.has(K(x - 1, y));
  const card = (inN ? 0 : 1) | (inE ? 0 : 2) | (inS ? 0 : 4) | (inW ? 0 : 8);
  if (card) return 'E' + card;
  const inNE = set.has(K(x + 1, y - 1)), inSE = set.has(K(x + 1, y + 1)), inSW = set.has(K(x - 1, y + 1)), inNW = set.has(K(x - 1, y - 1));
  const diag = (inNE ? 0 : 1) | (inSE ? 0 : 2) | (inSW ? 0 : 4) | (inNW ? 0 : 8);
  if (diag) return 'C' + diag;
  return null;
}
const votes = new Map();
for (const k of good) {
  const g = mainSp.get(k); if (!isC(g)) continue;
  const [x, y] = k.split(',').map(Number);
  const key = classify(x, y, waterSet); if (!key) continue;
  const local = (g & FLIP) - COAST_F;
  if (!votes.has(key)) votes.set(key, new Map());
  const t = votes.get(key); t.set(local, (t.get(local) || 0) + 1);
}
const edges = {}, corners = {};
for (const [key, t] of votes) {
  const local = [...t].sort((a, b) => b[1] - a[1])[0][0];
  if (key[0] === 'E') edges[key.slice(1)] = local; else corners[key.slice(1)] = local;
}
const data = { firstgid: COAST_F, fillGid: WATER_F, edges, corners };
fs.writeFileSync(path.join(import.meta.dirname, 'water-autotile.auto.json'), JSON.stringify(data, null, 1));
console.log('edges:', edges);
console.log('corners:', corners);
