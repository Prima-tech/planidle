// Qué mapas generar. Edita esto para añadir/cambiar niveles.
// La dificultad sube con el número: mapas más grandes y más densos.
// El portal de retroceso va arriba-izq (2,2) y el de avance arriba-der; coincide con map-config.ts.

const SEED = 'idle-w1';   // cambia el seed global para "rebarajar" TODOS los mapas a la vez

function level(n, { width, height, density }) {
  return {
    id: `1-${n}`, seed: SEED, biome: 'grasslands',
    width, height,
    spawn: { x: 6, y: 6 },
    portals: [
      { x: 2, y: 2 },                 // back
      { x: width - 3, y: 2 },         // next
    ],
    stampDensity: density,            // stamps por cada 100 tiles (aprox)
    variantChance: 0.05,
  };
}

export const MANIFEST = [
  level(1, { width: 20, height: 20, density: 0.6 }),
  level(2, { width: 22, height: 22, density: 0.9 }),
  level(3, { width: 24, height: 24, density: 1.1 }),
  level(4, { width: 26, height: 24, density: 1.3 }),
  level(5, { width: 28, height: 26, density: 1.5 }),
  level(6, { width: 30, height: 28, density: 1.7 }),
  level(7, { width: 32, height: 30, density: 1.9 }),
  level(8, { width: 34, height: 32, density: 2.1 }),
];
