/**
 * Sets de parallax del Modo Mundo (runner). Cada set es una carpeta en
 * assets/tilemaps/world/paralax/<id>/ con capas l1..lN (1920×1080) en orden
 * atrás→delante. El nº de capas varía por set.
 *
 * El factor de parallax (velocidad relativa al scroll) se reparte automáticamente
 * por índice de capa: la del fondo se mueve despacio, la de delante rápido.
 */

export type WorldParallaxId =
  | 'paralax01' | 'paralax02' | 'paralax03' | 'paralax04'
  | 'paralax05' | 'paralax06' | 'paralax07' | 'paralax08'
  | 'paralax09' | 'paralax10' | 'paralax11' | 'paralax12';

export interface WorldParallaxSet {
  id: WorldParallaxId;
  label: string;       // visible en ajustes
  files: string[];     // nombres de archivo (sin .png) en orden atrás→delante
  // Ajuste vertical de la imagen al viewport:
  //  - 'height' (def): cabe entera de arriba a abajo, se repite a lo ancho. Ideal
  //    para cielos/escenas uniformes (espaciales) donde no se nota la repetición.
  //  - 'cover': llena el ancho con UNA sola copia (sin duplicar el elemento central),
  //    recortando alto. Para paisajes con un foco (montaña, sol, mesa).
  fit?: 'height' | 'cover';
  // Solo para 'cover': qué franja vertical se ve. 0=arriba (más cielo), 1=abajo
  // (más suelo/horizonte). Default 1.
  anchorY?: number;
}

const DIR = 'assets/tilemaps/world/paralax/';

/** Genera nombres numéricos '1'..'n' (sets con archivos 1.png, 2.png, …). */
const numbered = (n: number): string[] => Array.from({ length: n }, (_, i) => String(i + 1));

export const WORLD_PARALLAX_SETS: WorldParallaxSet[] = [
  { id: 'paralax01', label: 'Planetas',  files: ['l1_nebula-01', 'l2_stars-01', 'l3_planet02-01', 'l4_planet02-01'] },
  { id: 'paralax02', label: 'Planeta',   files: ['l1_nebula-01', 'l2_stars-01', 'l3_planet-01'] },
  { id: 'paralax03', label: 'Sistema',   files: ['l1_nebula-01', 'l2_stars-01', 'l3_sun-01', 'l4_satellite01-01', 'l5_planet-01', 'l6_satellite02-01'] },
  { id: 'paralax04', label: 'Sol',       files: ['l1_nebula-01', 'l2_stars-01', 'l3_planet-01', 'l4_sun-01'] },
  { id: 'paralax05', label: 'Atardecer', files: numbered(8) },
  { id: 'paralax06', label: 'Nublado',   files: numbered(6) },
  { id: 'paralax07', label: 'Noche',     files: numbered(8) },
  { id: 'paralax08', label: 'Cielo',     files: numbered(7) },
  // Sets de naturaleza (paisajes): 'cover' para no duplicar el elemento central.
  { id: 'paralax09', label: 'Desierto', fit: 'cover', anchorY: 1,   files: ['sky', 'clouds', 'mountains bg', 'mountains fg', 'fog', 'ground', 'cactus', 'dust'] },
  { id: 'paralax10', label: 'Montaña',  fit: 'cover', anchorY: 1,   files: ['sky', 'air', 'stars', 'clouds bg', 'mountains bg', 'mountains mg', 'mountains fg', 'clouds fg', 'ground', 'tree'] },
  { id: 'paralax11', label: 'Bosque',   fit: 'cover', anchorY: 1,   files: ['sky', 'clouds bg', 'forest and mountains', 'mountain', 'forest fg', 'clouds fg', 'fog', 'ground', 'tree'] },
  { id: 'paralax12', label: 'Cañón',    fit: 'cover', anchorY: 0.5, files: ['sky', 'sun', 'clouds bg', 'mountains bg', 'mountains mg', 'mountains fg', 'cloud fg', 'fog', 'ground'] },
];

export const WORLD_PARALLAX_SRC_W = 1920;
export const WORLD_PARALLAX_SRC_H = 1080;

export function getWorldParallaxSet(id: WorldParallaxId): WorldParallaxSet {
  return WORLD_PARALLAX_SETS.find(s => s.id === id) ?? WORLD_PARALLAX_SETS[0];
}

/** Ruta del archivo de una capa. */
export function worldParallaxPath(id: WorldParallaxId, file: string): string {
  return `${DIR}${id}/${file}.png`;
}

/** Clave de textura única por set+capa (evita colisiones entre sets con mismos nombres). */
export function worldParallaxKey(id: WorldParallaxId, file: string): string {
  return `wr_px_${id}_${file}`;
}

/** Factor de parallax por profundidad: índice 0 (fondo) lento → último (frente) rápido. */
export function worldParallaxFactor(index: number, total: number): number {
  if (total <= 1) return 0.2;
  const MIN = 0.06, MAX = 0.6;
  return MIN + (index / (total - 1)) * (MAX - MIN);
}
