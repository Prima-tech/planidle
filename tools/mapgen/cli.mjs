// Genera todos los mapas del manifiesto → src/assets/tilemaps/generated/<id>.tmj
//   node tools/mapgen/cli.mjs
import fs from 'node:fs';
import path from 'node:path';
import { generateMap } from './generate.mjs';
import { writeTmj } from './tmj.mjs';
import { MANIFEST } from './manifest.mjs';

const OUT_DIR = path.join(import.meta.dirname, '..', '..', 'src', 'assets', 'tilemaps', 'generated');

fs.mkdirSync(OUT_DIR, { recursive: true });

let n = 0;
for (const cfg of MANIFEST) {
  if (cfg.frozen) {
    console.log(`— ${cfg.id}  CONGELADO (editado a mano en Tiled) — no se regenera`);
    continue;
  }
  const tmj = generateMap(cfg);
  const file = path.join(OUT_DIR, `${cfg.id}.tmj`);
  writeTmj(file, tmj);
  const colCells = tmj.layers[0].objects.reduce((s, o) => s + (o.width / 16) * (o.height / 16), 0);
  console.log(`✓ ${cfg.id}  ${cfg.width}x${cfg.height}  colisiones≈${colCells}  → ${path.relative(process.cwd(), file)}`);
  n++;
}
console.log(`\n${n} mapas generados en ${path.relative(process.cwd(), OUT_DIR)}/`);
