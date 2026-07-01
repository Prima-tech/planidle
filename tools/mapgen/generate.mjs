// Motor de generación. Compone: base de césped + stamps dispersos + colisiones fusionadas,
// con zonas despejadas (spawn/portales) y verificación de que se puede caminar a cada portal.
import path from 'node:path';
import { makeRng } from './rng.mjs';
import { loadStamp, buildTmj } from './tmj.mjs';
import { BIOMES } from './biomes.mjs';
import { generateWater } from './water.mjs';
import { generateDirt } from './dirt.mjs';

const STAMP_DIR = path.join(import.meta.dirname, 'stamps');

/**
 * @param {object} opts
 *   id, seed, width, height, biome,
 *   spawn:{x,y}, portals:[{x,y}],
 *   stampDensity (0..1 aprox: stamps por cada 100 tiles),
 *   variantChance (0..1)
 */
export function generateMap(opts) {
  const biome = BIOMES[opts.biome];
  if (!biome) throw new Error(`Bioma desconocido: ${opts.biome}`);
  const { width: W, height: H } = opts;
  const rng = makeRng(`${opts.id}:${opts.seed}`);

  const base = new Array(W * H).fill(biome.base.fill);
  const agua = new Array(W * H).fill(0);
  const collision = new Set();          // "x,y" celdas bloqueadas
  const occupied = new Set();           // celdas ya ocupadas por stamps (para no solapar)
  const idx = (x, y) => y * W + x;

  // --- zonas despejadas: borde caminable + spawn + portales (con radio) ---
  const clear = new Set();
  const reserve = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (x >= 0 && x < W && y >= 0 && y < H) clear.add(`${x},${y}`);
  };
  reserve(opts.spawn.x, opts.spawn.y, 6);   // zona amplia de spawn (jugador + enemigos)
  for (const p of opts.portals) reserve(p.x, p.y, 3);
  // banda de 2 tiles del perímetro reservada para el seto del marco (sin stamps)
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) clear.add(`${x},${y}`);
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) clear.add(`${x},${y}`);
  for (const k of clear) occupied.add(k);

  // --- agua procedural (lagos rectangulares) ANTES de decorar ---
  // Autotileada con las piezas del pack; verifica que no aísle los portales.
  const water = generateWater(rng, { W, H, base, agua, collision, occupied, spawn: opts.spawn, portals: opts.portals });

  // --- parches de tierra ---
  generateDirt(rng, { W, H, base, agua, collision, occupied, grassFill: biome.base.fill });

  // --- celdas "cerca del agua" (radio 6) para la decoración que lo exige (flores) ---
  const nearWater = new Set(water.cells);
  {
    let frontier = [...water.cells];
    for (let r = 0; r < 6; r++) {
      const next = [];
      for (const k of frontier) {
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = `${x + dx},${y + dy}`;
          if (!nearWater.has(nk)) { nearWater.add(nk); next.push(nk); }
        }
      }
      frontier = next;
    }
  }

  // --- cargar stamps del bioma ---
  const stamps = biome.stamps.map(s => ({
    ...s, data: loadStamp(path.join(STAMP_DIR, `${s.file}.tmj`)),
  }));

  const placed = [];                    // {cells:Set, collisionCells:Set} para reparación de conectividad
  const fits = (sx, sy, st) => {
    if (sx < 1 || sy < 1 || sx + st.data.w > W - 1 || sy + st.data.h > H - 1) return false;
    for (let y = 0; y < st.data.h; y++)
      for (let x = 0; x < st.data.w; x++)
        if (occupied.has(`${sx + x},${sy + y}`)) return false;
    return true;
  };

  const place = (sx, sy, st) => {
    const cells = new Set(), collisionCells = new Set();
    for (const [name, data] of Object.entries(st.data.layers)) {
      const target = name === 'Agua' ? agua : base; // todo lo que no sea "Agua" va a Base
      for (let y = 0; y < st.data.h; y++)
        for (let x = 0; x < st.data.w; x++) {
          const gid = data[y * st.data.w + x];
          if (gid) target[idx(sx + x, sy + y)] = gid;
        }
    }
    for (let y = -1; y <= st.data.h; y++)               // +1 de margen para que respiren
      for (let x = -1; x <= st.data.w; x++) {
        const k = `${sx + x},${sy + y}`;
        occupied.add(k); cells.add(k);
      }
    for (const rel of st.data.collision) {
      const [rx, ry] = rel.split(',').map(Number);
      const k = `${sx + rx},${sy + ry}`;
      collision.add(k); collisionCells.add(k);
    }
    placed.push({ cells, collisionCells });
  };

  // --- dispersar stamps por muestreo con rechazo ---
  const targetCount = stamps.length ? Math.round((W * H / 100) * (opts.stampDensity ?? 0)) : 0;
  let tries = targetCount * 40, done = 0;
  while (done < targetCount && tries-- > 0) {
    const st = rng.weighted(stamps);
    const sx = rng.int(1, W - st.data.w - 1);
    const sy = rng.int(1, H - st.data.h - 1);
    if (st.nearWater && !nearWater.has(`${sx},${sy}`)) continue;  // flores solo junto al agua
    if (!fits(sx, sy, st)) continue;
    place(sx, sy, st);
    done++;
  }

  // Base = césped uniforme. NADA de esparcir tiles "al azar": toda la decoración
  // viene de stamps deliberados (coherentes), nunca de adivinar índices de tile.

  // --- marco del mapa: borde de hierba "fin del mundo" (1 tile, con colisión) ---
  // Mismo acabado que home01: la hierba termina mirando hacia afuera.
  const B = biome.border, GFIRST = 1;
  for (let x = 1; x < W - 1; x++) {
    base[idx(x, 0)] = GFIRST + B.n;
    base[idx(x, H - 1)] = GFIRST + B.s;
  }
  for (let y = 1; y < H - 1; y++) {
    base[idx(0, y)] = GFIRST + B.w;
    base[idx(W - 1, y)] = GFIRST + B.e;
  }
  base[idx(0, 0)] = GFIRST + B.nw; base[idx(W - 1, 0)] = GFIRST + B.ne;
  base[idx(0, H - 1)] = GFIRST + B.sw; base[idx(W - 1, H - 1)] = GFIRST + B.se;
  for (let x = 0; x < W; x++) { collision.add(`${x},0`); collision.add(`${x},${H - 1}`); }
  for (let y = 1; y < H - 1; y++) { collision.add(`0,${y}`); collision.add(`${W - 1},${y}`); }

  // --- reparar conectividad: el spawn debe alcanzar todos los portales ---
  repairConnectivity({ W, H, collision, placed, spawn: opts.spawn, portals: opts.portals });

  return buildTmj({ width: W, height: H, tilesets: biome.tilesets, base, agua, collision });
}

/** BFS sobre celdas no bloqueadas; si un portal no es alcanzable, elimina el stamp culpable más cercano y reintenta. */
function repairConnectivity({ W, H, collision, placed, spawn, portals }) {
  const reachable = (blocked) => {
    const seen = new Set(), q = [[spawn.x, spawn.y]];
    seen.add(`${spawn.x},${spawn.y}`);
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || blocked.has(k)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen;
  };

  for (let guard = 0; guard < placed.length + 1; guard++) {
    const seen = reachable(collision);
    const bad = portals.find(p => !seen.has(`${p.x},${p.y}`));
    if (!bad) return; // todos alcanzables
    // elimina el stamp con colisión más cercano al portal inaccesible
    let victim = -1, bestD = Infinity;
    placed.forEach((st, i) => {
      if (!st.collisionCells.size) return;
      for (const c of st.collisionCells) {
        const [cx, cy] = c.split(',').map(Number);
        const d = (cx - bad.x) ** 2 + (cy - bad.y) ** 2;
        if (d < bestD) { bestD = d; victim = i; }
      }
    });
    if (victim < 0) return; // nada que quitar (mapa imposible: lo dejamos)
    for (const c of placed[victim].collisionCells) collision.delete(c);
    placed[victim].collisionCells.clear();
  }
}
