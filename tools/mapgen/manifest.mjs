// Qué mapas generar. DEBE coincidir con genLevel(...) en map-config.ts (w/h, spawn, portales).
// El jugador spawnea en el CENTRO (como el hogar) para que el mapa se sienta grande.
// Tamaños >= hogar (60x50). El portal de avance va en (width-3, 2).

const SEED = 'idle-w1';   // cambia el seed global para "rebarajar" TODOS los mapas a la vez

function level(n, { width, height, density }) {
  return {
    id: `1-${n}`, seed: SEED, biome: 'grasslands',
    width, height,
    spawn: { x: Math.floor(width / 2), y: Math.floor(height / 2) },  // centro
    portals: [
      { x: 2, y: 2 },                 // back  (arriba-izquierda)
      { x: width - 3, y: 2 },         // next  (arriba-derecha)
    ],
    stampDensity: density,            // stamps por cada 100 tiles (aprox). Bajo = pocas features.
  };
}

export const MANIFEST = [
  level(1, { width: 60, height: 50, density: 0.10 }),
  level(2, { width: 64, height: 54, density: 0.12 }),
  level(3, { width: 68, height: 56, density: 0.14 }),
  level(4, { width: 72, height: 60, density: 0.16 }),
  level(5, { width: 76, height: 62, density: 0.18 }),
  level(6, { width: 80, height: 66, density: 0.20 }),
  level(7, { width: 84, height: 68, density: 0.22 }),
  level(8, { width: 88, height: 72, density: 0.24 }),
];
