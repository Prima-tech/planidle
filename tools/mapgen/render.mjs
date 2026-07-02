// Renderiza un .tmj generado a PNG para inspección visual (no entra en el juego).
//   node tools/mapgen/render.mjs 1-1
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const TILE = 16;
const id = process.argv[2] ?? '1-1';
const mapPath = path.join(import.meta.dirname, '..', '..', 'src', 'assets', 'tilemaps', 'generated', `${id}.tmj`);
const m = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const W = m.width, H = m.height;

// resuelve la imagen real de cada tileset (los .tmj apuntan a W1/)
const PNG_DIR = path.join(import.meta.dirname, '..', '..', 'src', 'assets', 'tilemaps', 'biomas', 'grasslands');
const sets = m.tilesets.map(ts => ({
  firstgid: ts.firstgid, columns: ts.columns,
  png: PNG.sync.read(fs.readFileSync(path.join(PNG_DIR, path.basename(ts.image)))),
})).sort((a, b) => a.firstgid - b.firstgid);

const out = new PNG({ width: W * TILE, height: H * TILE });
// fondo gris para que se vea el borde del mapa
out.data.fill(40);

const setFor = (g) => { let s = sets[0]; for (const t of sets) if (g >= t.firstgid) s = t; return s; };
const blit = (gid, dx, dy) => {
  if (!gid) return;
  const g = gid & 0x1FFFFFFF;                          // sin bits de flip
  const fH = !!(gid & 0x80000000), fV = !!(gid & 0x40000000), fD = !!(gid & 0x20000000);
  const s = setFor(g);
  const local = g - s.firstgid;
  const sx = (local % s.columns) * TILE, sy = Math.floor(local / s.columns) * TILE;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    let px = x, py = y;                                // volteos de Tiled: diagonal, luego H/V
    if (fD) { const t = px; px = py; py = t; }
    if (fH) px = TILE - 1 - px;
    if (fV) py = TILE - 1 - py;
    const si = ((sy + py) * s.png.width + (sx + px)) * 4;
    const di = ((dy + y) * out.width + (dx + x)) * 4;
    const a = s.png.data[si + 3];
    if (a === 0) continue;
    out.data[di] = s.png.data[si]; out.data[di + 1] = s.png.data[si + 1];
    out.data[di + 2] = s.png.data[si + 2]; out.data[di + 3] = 255;
  }
};

const L = {}; for (const l of m.layers) if (l.type === 'tilelayer') L[l.name] = l.data;
for (const name of ['Base', 'Agua', 'Deco']) {         // mismo orden de dibujo que el juego
  const data = L[name]; if (!data) continue;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) blit(data[y * W + x], x * TILE, y * TILE);
}

// marca spawn (rojo) y portales (azul) leyendo de map-config no es trivial; se pasan por args opcionales
const marks = (process.argv[3] ?? '').split(';').filter(Boolean).map(s => s.split(',').map(Number));
const box = (cx, cy, col) => {
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
    const px = (cx * TILE + TILE / 2 + x), py = (cy * TILE + TILE / 2 + y);
    if (px < 0 || py < 0 || px >= out.width || py >= out.height) continue;
    const di = (py * out.width + px) * 4;
    out.data[di] = col[0]; out.data[di + 1] = col[1]; out.data[di + 2] = col[2]; out.data[di + 3] = 255;
  }
};
if (marks.length) { box(marks[0][0], marks[0][1], [255, 40, 40]); for (const p of marks.slice(1)) box(p[0], p[1], [40, 120, 255]); }

const outPath = path.join(import.meta.dirname, `_preview-${id}.png`);
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log(`${id}: ${W}x${H} tiles → ${out.width}x${out.height}px  → ${path.relative(process.cwd(), outPath)}`);
