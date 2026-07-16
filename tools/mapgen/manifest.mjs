// Qué mapas generar. DEBE coincidir con genLevel(...) en map-config.ts (w/h, spawn, portales).
// El jugador spawnea en el CENTRO (como el hogar) para que el mapa se sienta grande.
// Tamaños >= hogar (60x50). El portal de avance va en (width-3, 2).

const SEED = 'idle-w1';   // cambia el seed global para "rebarajar" TODOS los mapas a la vez

function level(n, { width, height, density, frozen }) {
  return {
    id: `1-${n}`, seed: SEED, biome: 'grasslands',
    width, height,
    spawn: { x: Math.floor(width / 2), y: Math.floor(height / 2) },  // centro
    portals: [
      { x: 2, y: 2 },                 // back  (arriba-izquierda)
      { x: width - 3, y: 2 },         // next  (arriba-derecha)
    ],
    stampDensity: density,            // stamps por cada 100 tiles (aprox). Bajo = pocas features.
    lake: n % 3 === 2,                // el lago de Glades es un hito: solo 1-2, 1-5 y 1-8
    // frozen: true → mapa editado A MANO en Tiled; gen:maps NO lo regenera.
    frozen: !!frozen,
  };
}

// density = stamps por cada 100 tiles. Con decoración abundante (matas/flores) va alto;
// las charcas salen pocas porque pesan poco en el reparto ponderado (ver biomes.mjs).
export const MANIFEST = [
  level(1, { width: 80, height: 50, density: 5 }),
  level(2, { width: 64, height: 54, density: 5.5 }),
  level(3, { width: 68, height: 56, density: 6 }),
  level(4, { width: 72, height: 60, density: 6.5 }),
  level(5, { width: 76, height: 62, density: 7 }),
  level(6, { width: 80, height: 66, density: 7.5 }),
  level(7, { width: 84, height: 68, density: 8 }),
  level(8, { width: 88, height: 72, density: 9 }),
];
