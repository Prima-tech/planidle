// "Lifta" escenas hechas a mano de Glades.tmx → stamps .tmj (Base + Agua + colisión).
// Los firstgids de nuestros mapas coinciden con Glades aposta, así que los gids
// viajan tal cual. Las 11 capas se aplanan a 2: Base = capa inferior de la pila,
// Agua = capa superior (si hay ≥2). Las capas de "water lighting" se ignoran.
// Colisión: agua de fondo, cara del acantilado, columnas y objetos.
//   node tools/mapgen/lift.mjs [--render]   (--render deja PNGs de control en _lift/)
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', '..', 'src', 'assets', 'tilemaps', 'biomas', 'grasslands');
const OUT = path.join(import.meta.dirname, 'stamps');
const xml = fs.readFileSync(path.join(DIR, 'Glades.tmx'), 'utf8');
const FLIP = 0x1FFFFFFF;
const TILE = 16;

// Recortes curados a mano (coordenadas de Glades, ver _lift/*.png para ajustar).
// anchor: 'right' = en Glades el lago sangra por el borde derecho del mapa;
// al colocarlo se pega al borde derecho para que el marco lo corte igual.
export const REGIONS = [
  // erase: rects [x,y,w,h] relativos al stamp que se vacían.
  // mask 'lake': se queda SOLO la silueta del lago (agua + orillas C + tierra/talud
  //   conectado + bolsillos cerrados como la isla); la hierba decorada de alrededor
  //   fuera (era lo que dibujaba el rectángulo: arbustos a medias, tocones, sombras).
  //   Los cortes de tierra en la fila 0 se revisten con la transición N (108/213/214).
  { name: 'glades_lake', x: 18, y: 11, w: 25, h: 16, anchor: 'br', mask: 'lake',
    erase: [[18, 0, 7, 2], [22, 2, 3, 2], [0, 3, 1, 4], [0, 10, 2, 6]] },
  { name: 'glades_ruin', x: 22, y: 1, w: 6, h: 7 },          // ruina circular grande
  { name: 'glades_pond', x: 12, y: 6, w: 6, h: 8 },          // charca + pilar
  { name: 'glades_tower', x: 10, y: 1, w: 4, h: 4 },         // pilar en ruinas
];
// Árboles sintéticos: directos del tileset Trees_rocks (4×5 tiles cada uno), fondo
// transparente garantizado (los recortes de Glades arrastraban vecinos cortados).
// Colisión solo en el tronco (se puede pasear bajo la copa).
export const TREES = [
  { name: 'tree_green', col0: 4 },    // árbol verde alto
  { name: 'tree_apple', col0: 8 },    // manzano
];

function layerGrid(name) {
  const re = new RegExp(`<layer\\b[^>]*\\bname="${name}"[\\s\\S]*?<data[^>]*>([\\s\\S]*?)</data>`);
  const m = xml.match(re); const g = new Map();
  if (!m) return g;
  for (const c of m[1].matchAll(/<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">([\s\S]*?)<\/chunk>/g)) {
    const cx = +c[1], cy = +c[2], cw = +c[3], nums = (c[5].match(/-?\d+/g) || []).map(Number);
    for (let i = 0; i < nums.length; i++) if (nums[i]) g.set(`${cx + (i % cw)},${cy + Math.floor(i / cw)}`, nums[i]);
  }
  return g;
}

// orden de dibujo real de Glades (sin las de lighting)
const STACK = ['water background', 'main space', 'ground shadow', 'grass shadow', 'elevated_space',
  'objects_under_columns', 'columns', 'details', 'objects1', 'objects2', 'objects3'];
const BLOCKING = new Set(['water background', 'elevated_space', 'grass shadow',
  'objects_under_columns', 'columns', 'objects1', 'objects2', 'objects3']);
const grids = STACK.map(n => ({ name: n, grid: layerGrid(n) }));

// Con pilas de ≥3 capas, la de arriba va a Deco y para el hueco de en medio (Agua)
// gana la más importante: los cuadros rotos de la isla eran la sombra de hierba
// pisando a la orilla.
const MID_RANK = {
  'objects3': 9, 'objects2': 8, 'objects1': 7, 'main space': 6, 'details': 5,
  'objects_under_columns': 4, 'columns': 3, 'elevated_space': 2, 'grass shadow': 1, 'ground shadow': 0,
};

// familia "tierra" del pack grande (rellenos + transiciones), para la máscara del lago.
// OJO: el 426 NO está — es el relleno CASI TRANSPARENTE que Glades pone bajo toda la
// decoración; contarlo como tierra arrastraba media pradera a la máscara.
const DIRT = new Set([433, 2, 160, 161, 108, 213, 214, 54, 56, 59, 4, 5, 57, 58, 107, 109, 1, 3]);
const isWaterGid = (g) => { g &= FLIP; return (g >= 2459 && g < 5345) || g === 946; };
const isCoastGid = (g) => { g &= FLIP; return g >= 743 && g < 2459; };
const isDirtGid = (g) => { g &= FLIP; return g >= 1 && g < 743 && DIRT.has(g - 1); };

// keep = celdas con agua o arte de orilla (C) + tierra conectada a ellas (talud)
// + bolsillos cerrados (isla, penínsulas: los bordes anclados no cuentan como salida).
function lakeMask(stacks, w, h, anchor) {
  const keep = new Set(), dirtish = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const st = stacks[y * w + x]; if (!st) continue;
    if (st.some(s => isWaterGid(s.gid) || isCoastGid(s.gid))) keep.add(`${x},${y}`);
    else if (st.some(s => isDirtGid(s.gid))) dirtish.add(`${x},${y}`);
  }
  // tierra pegada a la orilla (máx 2 celdas): banda de talud, no toda la tierra
  // de Glades (allí TODO conecta y la máscara se tragaba el rectángulo entero).
  // Ojo: acumular por pasada — añadiendo en caliente el flood cascada sin límite.
  for (let step = 0; step < 2; step++) {
    const adds = [];
    for (const k of dirtish) {
      const [x, y] = k.split(',').map(Number);
      outer: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        if (keep.has(`${x + dx},${y + dy}`)) { adds.push(k); break outer; }
    }
    for (const k of adds) { keep.add(k); dirtish.delete(k); }
  }
  // bolsillos: BFS desde los bordes NO anclados; lo no alcanzado se conserva
  const open = new Set(), q = [];
  const seed = (x, y) => { const k = `${x},${y}`; if (!keep.has(k) && !open.has(k)) { open.add(k); q.push([x, y]); } };
  const anchored = anchor === 'br';
  for (let x = 0; x < w; x++) { seed(x, 0); if (!anchored) seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); if (!anchored) seed(w - 1, y); }
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      seed(nx, ny);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = `${x},${y}`;
    if (!keep.has(k) && !open.has(k)) keep.add(k);   // bolsillo cerrado
  }
  return keep;
}

function liftRegion(r) {
  const base = new Array(r.w * r.h).fill(0);
  const agua = new Array(r.w * r.h).fill(0);
  const deco = new Array(r.w * r.h).fill(0);
  const blocked = new Set();
  const erased = (x, y) => (r.erase ?? []).some(([ex, ey, ew, eh]) => x >= ex && x < ex + ew && y >= ey && y < ey + eh);

  // 1. pila de capas por celda
  const stacks = new Array(r.w * r.h).fill(null);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    if (erased(x, y)) continue;
    const k = `${r.x + x},${r.y + y}`;
    const stack = [];
    for (const { name, grid } of grids) {
      const gid = grid.get(k);
      if (!gid || (gid & FLIP) === 427) continue;   // 427 = G426 transparente: fuera
      stack.push({ name, gid });
    }
    if (stack.length) stacks[y * r.w + x] = stack;
  }

  // 2. máscara de silueta (si procede)
  const keep = r.mask === 'lake' ? lakeMask(stacks, r.w, r.h, r.anchor) : null;

  // 3. aplanado a 3 capas. Base solo recibe SUELO (ground/agua/orillas, gid <5345);
  //    si la pila empieza por un objeto (p.ej. arbusto tras filtrar el 426
  //    transparente), Base queda a 0 y se ve el césped del mapa.
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const i = y * r.w + x;
    const stack = stacks[i];
    if (!stack || (keep && !keep.has(`${x},${y}`))) continue;
    let overlays = stack;
    if ((stack[0].gid & FLIP) < 5345) { base[i] = stack[0].gid; overlays = stack.slice(1); }
    if (overlays.length === 1) agua[i] = overlays[0].gid;
    else if (overlays.length >= 2) {
      deco[i] = overlays[overlays.length - 1].gid;
      const mid = overlays.slice(0, -1).sort((a, b) => (MID_RANK[b.name] ?? 0) - (MID_RANK[a.name] ?? 0))[0];
      agua[i] = mid.gid;
    }
    if (stack.some(s => BLOCKING.has(s.name))) blocked.add(`${x},${y}`);
  }

  // 4. revestir los CORTES de tierra con el autotile de transiciones (mismo
  //    esquema que dirt.mjs): según qué lados queden expuestos al césped del mapa.
  //    Los bordes anclados (dcha/abajo con anchor 'br') no cuentan: los tapa el marco.
  if (r.mask === 'lake') {
    const kept = (x, y) => {
      if (x < 0 || y < 0) return false;                        // borde arriba/izq = expuesto
      if (r.anchor === 'br' && (x >= r.w || y >= r.h)) return true;  // borde anclado = tapado
      if (x >= r.w || y >= r.h) return false;
      return !!base[y * r.w + x];
    };
    const DRESS = { n: [108, 213, 214], s: [2, 160, 161], w: 56, e: 54, nw: 4, ne: 5, sw: 57, se: 58 };
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const i = y * r.w + x;
      if (!base[i] || !isDirtGid(base[i])) continue;
      const exN = !kept(x, y - 1), exS = !kept(x, y + 1), exW = !kept(x - 1, y), exE = !kept(x + 1, y);
      if (!exN && !exS && !exW && !exE) continue;
      let t;
      if (exN && exW) t = DRESS.nw;
      else if (exN && exE) t = DRESS.ne;
      else if (exS && exW) t = DRESS.sw;
      else if (exS && exE) t = DRESS.se;
      else if (exN) t = DRESS.n[x % 3];
      else if (exS) t = DRESS.s[x % 3];
      else if (exW) t = DRESS.w;
      else t = DRESS.e;
      base[i] = 1 + t;
      agua[i] = 0; deco[i] = 0;
    }
    // y los cortes de AGUA sin orilla propia se revisten con las orillas del
    // esquema de charcas (Water_coasts, firstgid 743), como los lagos procedurales
    const W_DRESS = { n: [197, 198, 120], s: [158, 159, 42], w: 82, e: 80, nw: 44, ne: 45, sw: 83, se: 84 };
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const i = y * r.w + x;
      // solo agua "desnuda": si Agua ya trae arte de orilla (no-agua) o hay objeto
      // encima, no se toca. El doble relleno (2459 + C203) sí se puede vestir.
      if (!base[i] || !isWaterGid(base[i]) || (agua[i] && !isWaterGid(agua[i])) || deco[i]) continue;
      const exN = !kept(x, y - 1), exS = !kept(x, y + 1), exW = !kept(x - 1, y), exE = !kept(x + 1, y);
      if (!exN && !exS && !exW && !exE) continue;
      let t;
      if (exN && exW) t = W_DRESS.nw;
      else if (exN && exE) t = W_DRESS.ne;
      else if (exS && exW) t = W_DRESS.sw;
      else if (exS && exE) t = W_DRESS.se;
      else if (exN) t = W_DRESS.n[x % 3];
      else if (exS) t = W_DRESS.s[x % 3];
      else if (exW) t = W_DRESS.w;
      else t = W_DRESS.e;
      agua[i] = 743 + t;
    }
  }
  return { base, agua, deco, blocked };
}

function mergeRects(blocked, w, h) {
  const rects = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!blocked.has(`${x},${y}`)) { x++; continue; }
      let x1 = x;
      while (x1 < w && blocked.has(`${x1},${y}`)) x1++;
      rects.push({ x: x * TILE, y: y * TILE, w: (x1 - x) * TILE, h: TILE });
      x = x1;
    }
  }
  return rects;
}

function writeStamp(r, lifted) {
  let objId = 1;
  const tmj = {
    type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
    width: r.w, height: r.h, tilewidth: TILE, tileheight: TILE, infinite: false,
    layers: [
      { type: 'tilelayer', name: 'Base', width: r.w, height: r.h, x: 0, y: 0, opacity: 1, visible: true, data: lifted.base },
      { type: 'tilelayer', name: 'Agua', width: r.w, height: r.h, x: 0, y: 0, opacity: 1, visible: true, data: lifted.agua },
      ...(lifted.deco && lifted.deco.some(g => g)
        ? [{ type: 'tilelayer', name: 'Deco', width: r.w, height: r.h, x: 0, y: 0, opacity: 1, visible: true, data: lifted.deco }]
        : []),
      {
        type: 'objectgroup', name: 'Colisiones', x: 0, y: 0, opacity: 1, visible: true,
        properties: [{ name: 'collides', type: 'bool', value: true }],
        objects: mergeRects(lifted.blocked, r.w, r.h).map(o => ({
          id: objId++, name: '', type: '', visible: true, rotation: 0,
          x: o.x, y: o.y, width: o.w, height: o.h,
        })),
      },
    ],
    nextlayerid: 4, nextobjectid: objId, tilesets: [],
  };
  fs.writeFileSync(path.join(OUT, `${r.name}.tmj`), JSON.stringify(tmj));
  return tmj;
}

// --- render de control (opcional) ---
async function renderStamp(r, lifted) {
  const { PNG } = await import('pngjs');
  const SETS = [
    { first: 1, img: 'ground_grasss.png', cols: 53 },
    { first: 743, img: 'Water_coasts.png', cols: 39 },
    { first: 2459, img: 'water_detilazation.png', cols: 37 },
    { first: 5345, img: 'Trees_rocks.png', cols: 16 },
    { first: 5889, img: 'Details.png', cols: 12 },
  ];
  for (const s of SETS) s.png = PNG.sync.read(fs.readFileSync(path.join(DIR, s.img)));
  SETS.sort((a, b) => b.first - a.first);
  const img = new PNG({ width: r.w * TILE, height: r.h * TILE });
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 122; img.data[i + 1] = 158; img.data[i + 2] = 74; img.data[i + 3] = 255; }
  const blit = (gid, dx, dy) => {
    const g = gid & FLIP;
    const s = SETS.find(s => g >= s.first); if (!s) return;
    const local = g - s.first, sx = (local % s.cols) * TILE, sy = Math.floor(local / s.cols) * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const si = ((sy + y) * s.png.width + sx + x) * 4, di = ((dy + y) * img.width + dx + x) * 4;
      const a = s.png.data[si + 3]; if (!a) continue;
      const na = a / 255;
      for (let c = 0; c < 3; c++) img.data[di + c] = Math.round(s.png.data[si + c] * na + img.data[di + c] * (1 - na));
    }
  };
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const i = y * r.w + x;
    if (lifted.base[i]) blit(lifted.base[i], x * TILE, y * TILE);
    if (lifted.agua[i]) blit(lifted.agua[i], x * TILE, y * TILE);
    if (lifted.deco?.[i]) blit(lifted.deco[i], x * TILE, y * TILE);
    // marca de colisión: puntito rojo en la esquina
    if (lifted.blocked.has(`${x},${y}`)) {
      for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) {
        const di = ((y * TILE + q) * img.width + x * TILE + p) * 4;
        img.data[di] = 220; img.data[di + 1] = 40; img.data[di + 2] = 40;
      }
    }
  }
  const dir = path.join(import.meta.dirname, '_lift');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${r.name}.png`), PNG.sync.write(img));
}

function treeStamp(t) {
  const TREES_FIRST = 5345, TCOLS = 16, w = 4, h = 5;
  const base = new Array(w * h).fill(0);              // 0: deja el césped del mapa
  const agua = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) agua[y * w + x] = TREES_FIRST + y * TCOLS + t.col0 + x;
  const blocked = new Set(['1,3', '2,3', '1,4', '2,4']);   // tronco
  return { name: t.name, x: 0, y: 0, w, h, lifted: { base, agua, blocked } };
}

const doRender = process.argv.includes('--render');
for (const r of REGIONS) {
  const lifted = liftRegion(r);
  writeStamp(r, lifted);
  if (doRender) await renderStamp(r, lifted);
  console.log(`✓ ${r.name}  ${r.w}x${r.h}  colisión=${lifted.blocked.size} celdas`);
}
for (const t of TREES) {
  const s = treeStamp(t);
  writeStamp(s, s.lifted);
  if (doRender) await renderStamp(s, s.lifted);
  console.log(`✓ ${s.name}  ${s.w}x${s.h}  (sintético)`);
}
