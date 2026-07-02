// Motor de generación. Compone escenas hechas a mano (prefabs liftados de Glades)
// + agua/tierra procedural + decoración pequeña, con zonas despejadas
// (spawn/portales) y verificación de que se puede caminar a cada portal.
import path from 'node:path';
import { makeRng } from './rng.mjs';
import { loadStamp, buildTmj } from './tmj.mjs';
import { BIOMES } from './biomes.mjs';
import { generateWater } from './water.mjs';
import { generateDirt } from './dirt.mjs';

const STAMP_DIR = path.join(import.meta.dirname, 'stamps');
const FLIP = 0x1FFFFFFF;

/**
 * @param {object} opts
 *   id, seed, width, height, biome,
 *   spawn:{x,y}, portals:[{x,y}],
 *   stampDensity (0..1 aprox: stamps por cada 100 tiles)
 */
export function generateMap(opts) {
  const biome = BIOMES[opts.biome];
  if (!biome) throw new Error(`Bioma desconocido: ${opts.biome}`);
  const { width: W, height: H } = opts;
  const rng = makeRng(`${opts.id}:${opts.seed}`);

  const base = new Array(W * H).fill(biome.base.fill);
  const agua = new Array(W * H).fill(0);
  const deco = new Array(W * H).fill(0);   // capa superior de los prefabs (copas, objetos)
  const collision = new Set();          // "x,y" celdas bloqueadas
  const occupied = new Set();           // celdas ya ocupadas (para no solapar)
  const idx = (x, y) => y * W + x;

  // --- zonas despejadas: spawn + portales (con radio) + banda del marco ---
  const clear = new Set();
  const reserve = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (x >= 0 && x < W && y >= 0 && y < H) clear.add(`${x},${y}`);
  };
  reserve(opts.spawn.x, opts.spawn.y, 6);   // zona amplia de spawn (jugador + enemigos)
  for (const p of opts.portals) reserve(p.x, p.y, 3);
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 3, H - 2, H - 1]) clear.add(`${x},${y}`);
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) clear.add(`${x},${y}`);
  for (const k of clear) occupied.add(k);

  // El marco (labio + pared de roca) bloquea desde el PRINCIPIO para que todos los
  // chequeos de conectividad (prefabs, agua) ya cuenten con él. El arte se pinta al final.
  for (let x = 0; x < W; x++) { collision.add(`${x},0`); collision.add(`${x},${H - 2}`); collision.add(`${x},${H - 1}`); }
  for (let y = 1; y < H - 2; y++) { collision.add(`0,${y}`); collision.add(`${W - 1},${y}`); }

  // --- infraestructura de colocación ---
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
      const target = name === 'Agua' ? agua : name === 'Deco' ? deco : base;
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

  // BFS: ¿el spawn alcanza todos los portales con la colisión dada?
  const reachesPortals = (blocked) => {
    const seen = new Set([`${opts.spawn.x},${opts.spawn.y}`]), q = [[opts.spawn.x, opts.spawn.y]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || blocked.has(k)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return opts.portals.every(p => seen.has(`${p.x},${p.y}`));
  };
  // coloca un prefab si cabe y no aísla los portales (su colisión puede ser grande)
  const tryPrefab = (st, sx, sy, ignoreOccupied = false) => {
    if (!ignoreOccupied && !fits(sx, sy, st)) return false;
    if (ignoreOccupied && (sx < 1 || sy < 1 || sx + st.data.w > W - 1 || sy + st.data.h > H - 1)) return false;
    const testBlocked = new Set(collision);
    for (const rel of st.data.collision) {
      const [rx, ry] = rel.split(',').map(Number);
      testBlocked.add(`${sx + rx},${sy + ry}`);
    }
    if (!reachesPortals(testBlocked)) return false;
    place(sx, sy, st);
    return true;
  };

  // --- 1. hito: el lago de Glades, anclado a la esquina inferior derecha (allí
  //        también sangra por el borde, el marco lo corta igual que en el original) ---
  // Solo en los mapas que lo piden en el manifiesto: es un hito, no un mueble de serie.
  let hasLake = false;
  if (biome.prefabs && opts.lake) {
    const st = { data: loadStamp(path.join(STAMP_DIR, `${biome.prefabs.lake}.tmj`)) };
    hasLake = tryPrefab(st, W - st.data.w - 1, H - st.data.h - 2, true);
  }

  // --- 2. escenas medianas de Glades (ruina, charca, árboles, rocas...) ---
  if (biome.prefabs && biome.prefabs.scenes.length) {
    const scenes = biome.prefabs.scenes.map(s => ({
      ...s, data: loadStamp(path.join(STAMP_DIR, `${s.file}.tmj`)),
    }));
    const nScenes = Math.round(W * H / 800) + rng.int(2, 4) + (hasLake ? 0 : 2);   // sin lago, algo más de chicha
    const used = new Set();
    for (let i = 0, tries = 0; i < nScenes && tries < 200; tries++) {
      const st = rng.weighted(scenes);
      if (st.unique && used.has(st.file)) continue;            // hitos: máx 1 por mapa
      const sx = rng.int(2, W - st.data.w - 2), sy = rng.int(2, H - st.data.h - 3);
      if (tryPrefab(st, sx, sy)) { i++; used.add(st.file); }
    }
  }

  // --- 3. agua procedural de relleno (menos si ya hay lago) + parches de tierra ---
  generateWater(rng, { W, H, base, agua, collision, occupied, spawn: opts.spawn, portals: opts.portals },
    hasLake ? { nMin: 1, nMax: 2, big: false } : { nMin: 2, nMax: 3, big: true });
  generateDirt(rng, { W, H, base, agua, collision, occupied, grassFill: biome.base.fill });

  // --- 4. celdas "cerca del agua" (radio 6) para las flores — cuenta TODA el agua
  //        del mapa (prefabs incluidos), leyendo la capa Base ---
  const nearWater = new Set();
  {
    let frontier = [];
    for (let i = 0; i < W * H; i++) {
      const g = base[i] & FLIP;
      if ((g >= 2459 && g < 5345) || g === 946) {       // Water_detilazation o C203 (agua del lago)
        const k = `${i % W},${Math.floor(i / W)}`;
        nearWater.add(k); frontier.push(k);
      }
    }
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

  // --- 5. decoración pequeña (matas y flores; flores solo junto al agua) ---
  const stamps = biome.stamps.map(s => ({
    ...s, data: loadStamp(path.join(STAMP_DIR, `${s.file}.tmj`)),
  }));
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

  // --- 6. arte del marco: barranco (labio arriba/lados + pared de roca abajo) ---
  const B = biome.border, GFIRST = 1;
  base[idx(0, 0)] = GFIRST + B.nw; base[idx(W - 1, 0)] = GFIRST + B.ne;
  for (let x = 1; x < W - 1; x++) base[idx(x, 0)] = GFIRST + rng.pick(B.n);
  for (let y = 1; y < H - 2; y++) {
    base[idx(0, y)] = GFIRST + B.w;
    base[idx(W - 1, y)] = GFIRST + B.e;
  }
  // pared de roca: 2 filas con la variante alineada por columna, sobre base de
  // tierra (como en Glades: sin tierra debajo la pared queda lavada)
  for (let x = 0; x < W; x++) {
    const v = rng.int(0, B.faceTop.length - 1);
    base[idx(x, H - 2)] = GFIRST + 433;
    base[idx(x, H - 1)] = GFIRST + 433;
    agua[idx(x, H - 2)] = GFIRST + B.faceTop[v];
    agua[idx(x, H - 1)] = GFIRST + B.faceBottom[v];
  }

  // --- reparar conectividad: el spawn debe alcanzar todos los portales ---
  repairConnectivity({ W, H, collision, placed, spawn: opts.spawn, portals: opts.portals });

  return buildTmj({ width: W, height: H, tilesets: biome.tilesets, base, agua, deco, collision });
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
