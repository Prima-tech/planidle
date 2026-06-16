// Render compartido para las previsualizaciones de personaje (app-character-sprite,
// app-player-preview). Antes cada componente corría un setTimeout que hacía
// ctx.drawImage() de las hojas LPC de equipo (PNG de 832–1664 px) EN CADA tick.
// El bitmap decodificado de un HTMLImageElement se evicta bajo presión de memoria
// (roster con varios personajes), así que cada tick re-decodificaba la hoja:
// 30–91 ms de decode síncrono en el hilo principal → tirones en el juego (fuera
// del bucle de Phaser, por eso el overlay de FPS no lo veía).
//
// Solución: (1) decodificar cada hoja UNA vez a ImageBitmap (decode fuera del hilo
// principal vía createImageBitmap), cacheado y compartido entre instancias — un
// ImageBitmap queda decodificado en memoria, drawImage nunca lo re-decodifica;
// (2) hornear el ciclo de andar a un canvas offscreen una vez por recarga, y que
// el tick solo copie una región (blit barato) en vez de redibujar todas las capas.

export interface LayerSource {
  src: string;
  depth: number;
  frameSize: number;   // px por frame en ESTA hoja (64 normal, 128 armas oversize)
  startFrame: number;  // primer frame de walk_down (índice global en su propia rejilla)
  frameCount: number;  // nº de frames del ciclo de andar (1 = pose estática)
}

type Decoded = ImageBitmap | HTMLImageElement;

// Caché de decode compartida por TODA la app, keyed por src. Cada hoja se decodifica
// una sola vez en toda la sesión (la promesa se cachea, no solo el resultado, para
// que cargas concurrentes no decodifiquen dos veces).
const decodeCache = new Map<string, Promise<Decoded | null>>();

export function loadDecoded(src: string): Promise<Decoded | null> {
  const cached = decodeCache.get(src);
  if (cached) return cached;
  const p = decode(src);
  decodeCache.set(src, p);
  return p;
}

async function decode(src: string): Promise<Decoded | null> {
  // createImageBitmap decodifica el PNG FUERA del hilo principal (no bloquea el
  // juego). El bitmap resultante ya está decodificado y nunca se re-decodifica.
  if (typeof createImageBitmap === 'function') {
    try {
      const resp = await fetch(src);
      if (resp.ok) return await createImageBitmap(await resp.blob());
    } catch { /* fallback a Image abajo */ }
  }
  return loadImage(src);
}

function loadImage(src: string): Promise<Decoded | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    if (img.complete && img.naturalWidth > 0) resolve(img);
  });
}

function pixelWidth(d: Decoded): number {
  return d instanceof HTMLImageElement ? d.naturalWidth : d.width;
}

/**
 * Hornea el ciclo de andar (frames) compuesto de todas las capas en un único canvas
 * offscreen de `size*frames` × `size`. Se llama una vez por recarga; el tick solo
 * copia la columna del frame actual.
 */
export function bakeStrip(
  sources: LayerSource[],
  imgs: (Decoded | null)[],
  size: number,
  frames: number,
  bodyFrameSize: number,
): HTMLCanvasElement {
  const strip = document.createElement('canvas');
  strip.width  = size * frames;
  strip.height = size;
  const ctx = strip.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const scale = size / bodyFrameSize;   // el cuerpo (64px) llena cada celda

  for (let f = 0; f < frames; f++) {
    const ox = f * size;
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (!img) continue;
      const src = sources[i];
      const w = pixelWidth(img);
      if (!w) continue;

      // Columnas reales de la hoja (no el nº de frames de walk) para mapear bien
      // hojas LPC combinadas (13 cols) y oversize (128px). Cada capa cicla solo
      // sus propios frames de walk: frameCount=1 → pose estática (sin slash).
      const cols  = Math.max(1, Math.round(w / src.frameSize));
      const frame = src.startFrame + (f % src.frameCount);
      const sx = (frame % cols) * src.frameSize;
      const sy = Math.floor(frame / cols) * src.frameSize;

      // Centra el frame: las hojas oversize (128) tienen el personaje centrado,
      // su región central de 64px se alinea con el cuerpo.
      const dSize = src.frameSize * scale;
      const dOff  = (size - dSize) / 2;
      ctx.drawImage(img, sx, sy, src.frameSize, src.frameSize, ox + dOff, dOff, dSize, dSize);
    }
  }
  return strip;
}
