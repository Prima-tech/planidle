// Lectura de stamps (.tmj de Tiled) y escritura del mapa final (.tmj válido para Phaser + Tiled).
import fs from 'node:fs';

const TILE = 16;

/**
 * Carga un stamp pintado en Tiled.
 * Devuelve: { w, h, layers: { [nombre]: gid[] }, collision: Set<"x,y"> }
 * La colisión sale de la capa de objetos cuya propiedad collides=true (igual que el motor),
 * y además de cualquier tile con la propiedad de tileset `collides` (si la defines en Tiled).
 */
export function loadStamp(path) {
  const m = JSON.parse(fs.readFileSync(path, 'utf8'));
  const w = m.width, h = m.height;
  const layers = {};
  for (const l of m.layers) {
    if (l.type === 'tilelayer') layers[l.name] = l.data;
  }
  const collision = new Set();
  for (const l of m.layers) {
    if (l.type !== 'objectgroup') continue;
    const collides = l.properties?.some(p => p.name === 'collides' && p.value === true);
    if (!collides) continue;
    for (const o of l.objects) {
      const x0 = Math.floor(o.x / TILE), y0 = Math.floor(o.y / TILE);
      const x1 = Math.ceil((o.x + (o.width ?? TILE)) / TILE);
      const y1 = Math.ceil((o.y + (o.height ?? TILE)) / TILE);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) collision.add(`${x},${y}`);
    }
  }
  return { w, h, layers, collision };
}

/** Fusiona runs horizontales de celdas bloqueadas en rectángulos (menos objetos en el .tmj). */
function mergeCollisionRects(cells, width, height) {
  const blocked = new Set(cells);
  const rects = [];
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      if (!blocked.has(`${x},${y}`)) { x++; continue; }
      let x1 = x;
      while (x1 < width && blocked.has(`${x1},${y}`)) x1++;
      rects.push({ x: x * TILE, y: y * TILE, w: (x1 - x) * TILE, h: TILE });
      x = x1;
    }
  }
  return rects;
}

/**
 * Construye el objeto .tmj final.
 * @param {object} o { width, height, tilesets, base:gid[], agua:gid[], collision:Set, imageBase }
 */
export function buildTmj({ width, height, tilesets, base, agua, collision }) {
  const rects = mergeCollisionRects(collision, width, height);
  let nextObjId = 1;
  const objects = rects.map(r => ({
    id: nextObjId++, name: '', type: '', visible: true, rotation: 0,
    x: r.x, y: r.y, width: r.w, height: r.h,
  }));

  const tileLayer = (id, name, data) => ({
    id, name, type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0,
    width, height, data,
  });

  return {
    compressionlevel: -1,
    width, height, tilewidth: TILE, tileheight: TILE,
    infinite: false, orientation: 'orthogonal', renderorder: 'right-down',
    type: 'map', version: '1.10', tiledversion: '1.12.2',
    nextlayerid: 4, nextobjectid: nextObjId,
    tilesets,
    layers: [
      {
        id: 1, name: 'Colisiones', type: 'objectgroup', visible: true, opacity: 1,
        x: 0, y: 0, draworder: 'topdown',
        properties: [{ name: 'collides', type: 'bool', value: true }],
        objects,
      },
      // Base (césped, mapa entero) ABAJO; Agua ENCIMA para que el agua se vea
      // sobre la hierba. Antes iban al revés y la Base tapaba el mar por completo.
      tileLayer(2, 'Base', base),
      tileLayer(3, 'Agua', agua),
    ],
  };
}

export function writeTmj(path, tmj) {
  fs.writeFileSync(path, JSON.stringify(tmj, null, 1));
}
