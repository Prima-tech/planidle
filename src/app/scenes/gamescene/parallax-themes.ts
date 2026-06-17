// Temas de fondo con parallax para GameScene. Cada tema define dos capas (lejana
// opaca + cercana de detalle/partículas) que se generan proceduralmente como
// texturas tileables (ver makeLayerTexture/paintBlobs en gamescene.ts).

export type ParallaxThemeId = 'sea' | 'sky' | 'space' | 'lava' | 'fog' | 'magic';

/** Una mancha radial suave: color rgb "r,g,b", alpha en el centro (→0 al borde),
 *  cuántas pintar y su radio máximo en px (cada una se reparte aleatoriamente). */
export interface ParallaxBlob { rgb: string; alpha: number; count: number; maxR: number; }

export interface ParallaxLayer {
  baseFill?: string;        // color opaco de fondo (solo la capa lejana lo usa)
  blobs: ParallaxBlob[];
  factor: number;           // parallax: <1 = se mueve más lento que el mapa (más lejos)
  driftX: number;           // deriva temporal px/ms (oleaje/movimiento aunque estés quieto)
  driftY: number;
}

export interface ParallaxTheme { far: ParallaxLayer; near: ParallaxLayer; }

export const PARALLAX_THEMES: Record<ParallaxThemeId, ParallaxTheme> = {
  // Mar profundo (el original)
  sea: {
    far:  { baseFill: '#11314e', factor: 0.30, driftX: 0.004, driftY: 0.002, blobs: [
      { rgb: '38,86,128', alpha: 0.45, count: 18, maxR: 64 },
      { rgb: '8,26,46',   alpha: 0.50, count: 14, maxR: 58 },
    ] },
    near: { factor: 0.60, driftX: -0.010, driftY: 0.006, blobs: [
      { rgb: '170,222,255', alpha: 0.10, count: 11, maxR: 46 },
    ] },
  },
  // Cielo con nubes
  sky: {
    far:  { baseFill: '#7ec0ee', factor: 0.20, driftX: 0.006, driftY: 0.0, blobs: [
      { rgb: '255,255,255', alpha: 0.22, count: 9, maxR: 84 },
      { rgb: '214,234,250', alpha: 0.20, count: 7, maxR: 70 },
    ] },
    near: { factor: 0.45, driftX: -0.012, driftY: 0.0, blobs: [
      { rgb: '255,255,255', alpha: 0.12, count: 7, maxR: 64 },
    ] },
  },
  // Espacio: nebulosa lenta + estrellas
  space: {
    far:  { baseFill: '#05060f', factor: 0.10, driftX: 0.0015, driftY: 0.001, blobs: [
      { rgb: '60,40,110', alpha: 0.22, count: 6, maxR: 95 },
      { rgb: '30,70,120', alpha: 0.18, count: 6, maxR: 80 },
    ] },
    near: { factor: 0.30, driftX: 0.002, driftY: 0.0, blobs: [
      { rgb: '255,255,255', alpha: 0.90, count: 70, maxR: 2.2 },
      { rgb: '190,210,255', alpha: 0.60, count: 30, maxR: 1.6 },
    ] },
  },
  // Lava / abismo
  lava: {
    far:  { baseFill: '#1a0a08', factor: 0.25, driftX: 0.003, driftY: 0.0015, blobs: [
      { rgb: '120,32,12', alpha: 0.42, count: 16, maxR: 62 },
      { rgb: '45,12,8',   alpha: 0.50, count: 12, maxR: 56 },
    ] },
    near: { factor: 0.55, driftX: -0.006, driftY: 0.004, blobs: [
      { rgb: '255,140,30', alpha: 0.18, count: 12, maxR: 40 },
      { rgb: '255,90,20',  alpha: 0.12, count: 8,  maxR: 28 },
    ] },
  },
  // Niebla / bosque
  fog: {
    far:  { baseFill: '#26342a', factor: 0.22, driftX: 0.0035, driftY: 0.0, blobs: [
      { rgb: '74,96,74', alpha: 0.40, count: 16, maxR: 64 },
      { rgb: '18,28,20', alpha: 0.45, count: 12, maxR: 56 },
    ] },
    near: { factor: 0.50, driftX: -0.008, driftY: 0.002, blobs: [
      { rgb: '200,214,200', alpha: 0.10, count: 9, maxR: 74 },
    ] },
  },
  // Vacío mágico
  magic: {
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
  { id: 'sea',   labelKey: 'GAME_SETTINGS.PARALLAX_SEA'   },
  { id: 'sky',   labelKey: 'GAME_SETTINGS.PARALLAX_SKY'   },
  { id: 'space', labelKey: 'GAME_SETTINGS.PARALLAX_SPACE' },
  { id: 'lava',  labelKey: 'GAME_SETTINGS.PARALLAX_LAVA'  },
  { id: 'fog',   labelKey: 'GAME_SETTINGS.PARALLAX_FOG'   },
  { id: 'magic', labelKey: 'GAME_SETTINGS.PARALLAX_MAGIC' },
];
