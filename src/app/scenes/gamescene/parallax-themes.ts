// Temas de fondo con parallax para GameScene. Hay dos clases:
//  - 'procedural': dos capas generadas como texturas tileables (manchas radiales).
//  - 'image': una imagen escénica (no tileable) que cubre el viewport, teñida para
//             dar distintos ambientes, con una capa de detalle opcional (overlay).

export type ParallaxThemeId =
  | 'scenic' | 'scenic_dusk' | 'scenic_night' | 'scenic_mystic'
  | 'sea' | 'sky' | 'space'
  | 'warp' | 'warp_launch' | 'warp_meteor' | 'warp_matrix' | 'warp_neon'
  | 'lava' | 'fog' | 'magic';

/** Una mancha radial suave: color rgb "r,g,b", alpha en el centro (→0 al borde),
 *  cuántas pintar y su radio máximo en px (cada una se reparte aleatoriamente). */
export interface ParallaxBlob { rgb: string; alpha: number; count: number; maxR: number; }

export interface ParallaxLayer {
  baseFill?: string;        // color opaco de fondo (solo la capa lejana lo usa)
  blobs: ParallaxBlob[];
  factor: number;           // parallax: <1 = se mueve más lento que el mapa (más lejos)
  driftX: number;           // deriva temporal px/ms (movimiento aunque estés quieto)
  driftY: number;
}

/** Tema procedural: capa lejana opaca + capa cercana de detalle/partículas. */
export interface ProceduralTheme {
  kind: 'procedural';
  far: ParallaxLayer;
  near: ParallaxLayer;
}

/** Tema con imagen escénica: cubre el viewport, se tiñe (tint multiplicativo) y
 *  deriva lento (Ken Burns) + un poco de parallax con el scroll. `overlay` es una
 *  capa procedural opcional dibujada encima (p.ej. estrellas de noche). */
export interface ImageTheme {
  kind: 'image';
  texture: string;          // textura ya cargada en preload
  tint: number;             // 0xffffff = sin teñir
  factor: number;           // parallax con el scroll de la cámara
  drift: number;            // amplitud del vaivén lento (0..1 del margen disponible)
  overlay?: ParallaxLayer;
}

/** Hipervelocidad: estelas verticales que caen de arriba abajo (sensación de nave). */
export interface WarpTheme {
  kind: 'warp';
  far: ParallaxLayer;     // fondo casi negro / cielo
  count: number;          // nº de estelas
  color: number;          // 0xRRGGBB de las estelas
  colors?: number[];      // si está, cada estela toma un color aleatorio de la lista
  speed: number;          // multiplicador de velocidad (objetivo)
  startSpeed?: number;    // velocidad inicial de la rampa (transición de despegue)
  rampMs?: number;        // duración de la aceleración; sin esto = velocidad constante
}

export type ParallaxTheme = ProceduralTheme | ImageTheme | WarpTheme;

const scenic = (tint: number, overlay?: ParallaxLayer): ImageTheme =>
  ({ kind: 'image', texture: 'paralax_scene', tint, factor: 0.05, drift: 0.55, overlay });

interface WarpOpts {
  color?: number; colors?: number[]; speed?: number; count?: number;
  startSpeed?: number; rampMs?: number; bg?: string; bgBlob?: string;
}
const warp = (o: WarpOpts): WarpTheme => ({
  kind: 'warp',
  far: { baseFill: o.bg ?? '#02030a', factor: 0, driftX: 0, driftY: 0, blobs: [
    { rgb: o.bgBlob ?? '20,30,70', alpha: 0.18, count: 4, maxR: 90 },
  ] },
  count: o.count ?? 150,
  color: o.color ?? 0xcfe2ff,
  colors: o.colors,
  speed: o.speed ?? 1.0,
  startSpeed: o.startSpeed,
  rampMs: o.rampMs,
});

export const PARALLAX_THEMES: Record<ParallaxThemeId, ParallaxTheme> = {
  // ── Escénicos (a partir de paralax.jpg) ──
  scenic:        scenic(0xffffff),
  scenic_dusk:   scenic(0xffb27a),
  scenic_night:  scenic(0x5566aa, {
    factor: 0.50, driftX: 0.003, driftY: 0.0, blobs: [
      { rgb: '255,255,255', alpha: 0.90, count: 60, maxR: 2.0 },
      { rgb: '200,215,255', alpha: 0.60, count: 25, maxR: 1.4 },
    ],
  }),
  scenic_mystic: scenic(0xb98cff),

  // ── Procedurales ──
  sea: {
    kind: 'procedural',
    far:  { baseFill: '#11314e', factor: 0.30, driftX: 0.004, driftY: 0.002, blobs: [
      { rgb: '38,86,128', alpha: 0.45, count: 18, maxR: 64 },
      { rgb: '8,26,46',   alpha: 0.50, count: 14, maxR: 58 },
    ] },
    near: { factor: 0.60, driftX: -0.010, driftY: 0.006, blobs: [
      { rgb: '170,222,255', alpha: 0.10, count: 11, maxR: 46 },
    ] },
  },
  sky: {
    kind: 'procedural',
    far:  { baseFill: '#7ec0ee', factor: 0.20, driftX: 0.006, driftY: 0.0, blobs: [
      { rgb: '255,255,255', alpha: 0.22, count: 9, maxR: 84 },
      { rgb: '214,234,250', alpha: 0.20, count: 7, maxR: 70 },
    ] },
    near: { factor: 0.45, driftX: -0.012, driftY: 0.0, blobs: [
      { rgb: '255,255,255', alpha: 0.12, count: 7, maxR: 64 },
    ] },
  },
  space: {
    kind: 'procedural',
    far:  { baseFill: '#05060f', factor: 0.10, driftX: 0.0015, driftY: 0.001, blobs: [
      { rgb: '60,40,110', alpha: 0.22, count: 6, maxR: 95 },
      { rgb: '30,70,120', alpha: 0.18, count: 6, maxR: 80 },
    ] },
    near: { factor: 0.30, driftX: 0.002, driftY: 0.0, blobs: [
      { rgb: '255,255,255', alpha: 0.90, count: 70, maxR: 2.2 },
      { rgb: '190,210,255', alpha: 0.60, count: 30, maxR: 1.6 },
    ] },
  },
  // Hipervelocidad / nave: estelas verticales cayendo de arriba abajo
  warp:        warp({}),
  // Despegue: arranca casi parado (cielo estrellado) y acelera a hipervelocidad
  warp_launch: warp({ startSpeed: 0.05, rampMs: 4200, speed: 1.3 }),
  // Lluvia de meteoros (cálido)
  warp_meteor: warp({ color: 0xffb060, speed: 0.9, count: 120, bg: '#0a0604',
    bgBlob: '60,30,10' }),
  // Lluvia digital (verde)
  warp_matrix: warp({ color: 0x66ff99, speed: 0.8, count: 200, bg: '#02100a',
    bgBlob: '10,60,30' }),
  // Neón multicolor
  warp_neon:   warp({ colors: [0xff5cae, 0x5cd2ff, 0xb98cff, 0x6effa3], speed: 1.1, count: 160,
    bg: '#06030f', bgBlob: '40,20,70' }),
  lava: {
    kind: 'procedural',
    far:  { baseFill: '#1a0a08', factor: 0.25, driftX: 0.003, driftY: 0.0015, blobs: [
      { rgb: '120,32,12', alpha: 0.42, count: 16, maxR: 62 },
      { rgb: '45,12,8',   alpha: 0.50, count: 12, maxR: 56 },
    ] },
    near: { factor: 0.55, driftX: -0.006, driftY: 0.004, blobs: [
      { rgb: '255,140,30', alpha: 0.18, count: 12, maxR: 40 },
      { rgb: '255,90,20',  alpha: 0.12, count: 8,  maxR: 28 },
    ] },
  },
  fog: {
    kind: 'procedural',
    far:  { baseFill: '#26342a', factor: 0.22, driftX: 0.0035, driftY: 0.0, blobs: [
      { rgb: '74,96,74', alpha: 0.40, count: 16, maxR: 64 },
      { rgb: '18,28,20', alpha: 0.45, count: 12, maxR: 56 },
    ] },
    near: { factor: 0.50, driftX: -0.008, driftY: 0.002, blobs: [
      { rgb: '200,214,200', alpha: 0.10, count: 9, maxR: 74 },
    ] },
  },
  magic: {
    kind: 'procedural',
    far:  { baseFill: '#180c2c', factor: 0.18, driftX: 0.003, driftY: 0.002, blobs: [
      { rgb: '92,50,150', alpha: 0.34, count: 10, maxR: 84 },
      { rgb: '40,20,70',  alpha: 0.42, count: 10, maxR: 70 },
    ] },
    near: { factor: 0.50, driftX: -0.007, driftY: 0.005, blobs: [
      { rgb: '214,170,255', alpha: 0.50, count: 34, maxR: 3 },
      { rgb: '255,225,255', alpha: 0.22, count: 10, maxR: 20 },
    ] },
  },
};

/** Orden y etiqueta i18n de cada tema para el selector de Ajustes. */
export const PARALLAX_THEME_LIST: { id: ParallaxThemeId; labelKey: string }[] = [
  { id: 'scenic',        labelKey: 'GAME_SETTINGS.PARALLAX_SCENIC'        },
  { id: 'scenic_dusk',   labelKey: 'GAME_SETTINGS.PARALLAX_SCENIC_DUSK'   },
  { id: 'scenic_night',  labelKey: 'GAME_SETTINGS.PARALLAX_SCENIC_NIGHT'  },
  { id: 'scenic_mystic', labelKey: 'GAME_SETTINGS.PARALLAX_SCENIC_MYSTIC' },
  { id: 'sea',   labelKey: 'GAME_SETTINGS.PARALLAX_SEA'   },
  { id: 'sky',   labelKey: 'GAME_SETTINGS.PARALLAX_SKY'   },
  { id: 'space',       labelKey: 'GAME_SETTINGS.PARALLAX_SPACE'        },
  { id: 'warp',        labelKey: 'GAME_SETTINGS.PARALLAX_WARP'         },
  { id: 'warp_launch', labelKey: 'GAME_SETTINGS.PARALLAX_WARP_LAUNCH' },
  { id: 'warp_meteor', labelKey: 'GAME_SETTINGS.PARALLAX_WARP_METEOR' },
  { id: 'warp_matrix', labelKey: 'GAME_SETTINGS.PARALLAX_WARP_MATRIX' },
  { id: 'warp_neon',   labelKey: 'GAME_SETTINGS.PARALLAX_WARP_NEON'   },
  { id: 'lava',  labelKey: 'GAME_SETTINGS.PARALLAX_LAVA'  },
  { id: 'fog',   labelKey: 'GAME_SETTINGS.PARALLAX_FOG'   },
  { id: 'magic', labelKey: 'GAME_SETTINGS.PARALLAX_MAGIC' },
];
