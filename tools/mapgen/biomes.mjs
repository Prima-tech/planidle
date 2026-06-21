// Definición de biomas. Añadir un bioma = añadir una entrada aquí + pintar sus stamps en stamps/.
// Los gids salen de los tilesets reales (mismos firstgid que home01.tmj para compatibilidad).

// IMPORTANTE: las rutas de imagen son relativas a la carpeta de salida (src/assets/tilemaps/generated/).
// Phaser las ignora (carga por key desde map-config); solo importan para abrir el .tmj en Tiled.
export const GRASSLANDS_TILESETS = [
  {
    firstgid: 1, name: 'ground_grasss', image: '../W1/ground_grasss.png',
    // imagewidth/height a múltiplo del tile (16): 336=21×16, 288=18×16 → 378 tiles.
    // El PNG real es 341×297 (5/9px de borde sin tile); con los reales Phaser avisa
    // "Image tile area not tile size multiple".
    columns: 21, tilecount: 378, imagewidth: 336, imageheight: 288,
    tilewidth: 16, tileheight: 16, margin: 0, spacing: 0,
  },
  {
    firstgid: 379, name: 'Water_coasts', image: '../W1/Water_coasts.png',
    columns: 17, tilecount: 612, imagewidth: 272, imageheight: 576,
    tilewidth: 16, tileheight: 16, margin: 0, spacing: 0,
  },
];

export const BIOMES = {
  grasslands: {
    tilesets: GRASSLANDS_TILESETS,
    base: {
      fill: 23,                                   // gid de césped plano (home01). Base uniforme, sin esparcir nada.
    },
    // Stamps (prefabs) que TÚ pintas en Tiled (tools/mapgen/stamps/<file>.tmj) y registras aquí.
    // weight = probabilidad relativa de salir. Añade árboles, rocas, muros, lagos, etc.
    stamps: [
      { file: 'pond01', weight: 1 },              // charca de ejemplo (reemplázala/añade las tuyas)
    ],
  },
};
