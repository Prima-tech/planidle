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
  // firstgids iguales a Glades.tmx para poder "lift" prefabs suyos con sus gids tal cual.
  {
    firstgid: 5345, name: 'Trees_rocks', image: '../biomas/grasslands/Trees_rocks.png',
    columns: 16, tilecount: 544, imagewidth: 256, imageheight: 544,
    tilewidth: 16, tileheight: 16, margin: 0, spacing: 0,
  },
  {
    firstgid: 5889, name: 'Details', image: '../biomas/grasslands/Details.png',
    columns: 12, tilecount: 168, imagewidth: 192, imageheight: 224,
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
    // Las charcas/ríos ya NO son stamps: se generan proceduralmente (water.mjs) con
    // formas variadas y autotile de orillas. Aquí solo queda la decoración esparcida.
    // Marco del mapa: borde de hierba "fin del mundo" mirando hacia afuera, el mismo
    // que usa home01 (pack pequeño G1/G21/G23/G43 → equivalentes exactos del pack
    // grande, verificados píxel a píxel). Tiles de ground_grasss (firstgid 1).
    border: {
      n: 25, s: 131, w: 77, e: 79,
      nw: 24, ne: 26, sw: 130, se: 132,
    },
    // Solo decoración pequeña (matas y flores). Los objetos grandes (arbustos/
    // árboles deco_obj*) se quitaron: no aportaban (los arbustos siguen en el marco).
    stamps: [
      { file: 'deco_detail1', weight: 6, nearWater: true },  // flor azul → solo junto al agua
      { file: 'deco_detail2', weight: 6 },                   // matas
      { file: 'deco_detail3', weight: 6, nearWater: true },  // flores amarillas → solo junto al agua
      { file: 'deco_detail4', weight: 6 },
      { file: 'deco_detail5', weight: 6 },
      { file: 'deco_detail6', weight: 6 },
    ],
  },
};
