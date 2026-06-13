// Definición de biomas. Añadir un bioma = añadir una entrada aquí + pintar sus stamps en stamps/.
// Los gids salen de los tilesets reales (mismos firstgid que home01.tmj para compatibilidad).

// IMPORTANTE: las rutas de imagen son relativas a la carpeta de salida (src/assets/tilemaps/generated/).
// Phaser las ignora (carga por key desde map-config); solo importan para abrir el .tmj en Tiled.
export const GRASSLANDS_TILESETS = [
  {
    firstgid: 1, name: 'ground_grasss', image: '../W1/ground_grasss.png',
    columns: 21, tilecount: 378, imagewidth: 341, imageheight: 297,
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
      fill: 23,                                   // gid de césped dominante (home01)
      variants: [                                 // salpicaduras (flores/parches) sobre el césped
        { gid: 2, weight: 3 }, { gid: 22, weight: 3 },
        { gid: 24, weight: 3 }, { gid: 44, weight: 2 },
      ],
    },
    // Stamps (prefabs) que pueden aparecer. file = nombre en tools/mapgen/stamps/<file>.tmj
    stamps: [
      { file: 'pond01', weight: 1 },
    ],
  },
};
