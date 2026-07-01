// Definición de biomas. Añadir un bioma = añadir una entrada aquí + pintar sus stamps en stamps/.
// Los gids salen de los tilesets reales (mismos firstgid que home01.tmj para compatibilidad).

// IMPORTANTE: las rutas de imagen son relativas a la carpeta de salida (src/assets/tilemaps/generated/).
// Phaser las ignora (carga por key desde map-config); solo importan para abrir el .tmj en Tiled.
// Dimensiones del pack "grande" (Cute Fantasy) — coinciden con Glades.tmx. Todo múltiplo de 16.
export const GRASSLANDS_TILESETS = [
  {
    firstgid: 1, name: 'ground_grasss', image: '../biomas/grasslands/ground_grasss.png',
    columns: 53, tilecount: 742, imagewidth: 848, imageheight: 224,
    tilewidth: 16, tileheight: 16, margin: 0, spacing: 0,
  },
  {
    firstgid: 743, name: 'Water_coasts', image: '../biomas/grasslands/Water_coasts.png',
    columns: 39, tilecount: 1716, imagewidth: 624, imageheight: 704,
    tilewidth: 16, tileheight: 16, margin: 0, spacing: 0,
  },
  {
    firstgid: 2459, name: 'Water_detilazation', image: '../biomas/grasslands/water_detilazation.png',
    columns: 37, tilecount: 2886, imagewidth: 592, imageheight: 1248,
    tilewidth: 16, tileheight: 16, margin: 0, spacing: 0,
  },
];

export const BIOMES = {
  grasslands: {
    tilesets: GRASSLANDS_TILESETS,
    base: {
      fill: 56,   // césped plano: Ground_grass local 55 (col2,row1) = gid 56. El más usado en Glades.tmx.
    },
    // Charca sacada de Glades.tmx: agua (Water_detilazation gid 2459) en Base + orillas
    // (Water_coasts) en Agua. Los tiles de agua se animan en el juego (gamescene).
    stamps: [
      { file: 'pond_glades', weight: 1 },
    ],
  },
};
