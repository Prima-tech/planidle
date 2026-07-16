/**
 * Patrones de estrellas del Modo Mundo. Las estrellas ya NO salen de una en una:
 * aparecen en GRUPOS (packs) con una forma concreta y JUNTAS entre sí. La escena
 * (WorldRunScene) recorre `unlockedStarPatterns()` en bucle, plantando un pack cada vez.
 *
 * Cada punto es un offset relativo al ancla del pack:
 *  - `dxM`: metros por delante del ancla (1 tile = 1 metro). Se usan pasos cortos
 *           (`S`) para que las estrellas de un pack salgan pegadas, no dispersas.
 *  - `dy` : píxeles SOBRE la línea del suelo. TODAS las estrellas van ALTAS (hay
 *           que saltar para cogerlas); ninguna a ras de suelo. La altura de `dy` es
 *           la MÁS BAJA (referencia `H`, alcanzable con un salto normal). Al plantar
 *           el pack, la escena le SUMA una elevación al azar de `STAR_HEIGHT_LEVELS`,
 *           así el mismo patrón aparece a varias alturas (unas más arriba que otras).
 *
 * `requires` encadena el pack a un hito de run-milestones (RunProgressService):
 * si está sin comprar, el pack no aparece. Los packs base (sin `requires`) están
 * disponibles desde el principio. Para añadir un patrón nuevo desbloqueable: define
 * aquí su forma con `requires: '<id_hito>'` y añade ese hito en run-milestones.ts.
 */
export interface StarPoint {
  dxM: number;   // metros desde el ancla del pack
  dy: number;    // px sobre el suelo (siempre alto: hay que saltar)
}

export interface StarPattern {
  id: string;
  points: StarPoint[];
  widthM: number;        // ancho del pack en metros (para separarlo del siguiente)
  requires?: string;     // hito que lo desbloquea (undefined = base, siempre activo)
}

// Separación (en metros) entre el final de un pack y el ancla del siguiente.
// Amplia: los grupos van bien separados entre sí (las estrellas de un mismo pack
// sí van juntas, pero de un grupo al siguiente hay un buen hueco).
export const STAR_PATTERN_GAP_M = 33;
// Metros a los que aparece el PRIMER pack.
export const STAR_FIRST_M = 25;

// Altura estándar "de salto": la MÁS BAJA (la de siempre), alcanzable con un salto normal.
const H = 175;

// Separación corta (m) entre estrellas de un MISMO pack: van juntas, no dispersas.
const S = 1.0;

/**
 * Niveles de elevación (px) que la escena suma a TODO el pack al plantarlo, elegidos
 * al azar. El nivel 0 deja el pack a la altura de siempre (la más baja); los demás lo
 * suben. Así la misma forma aparece a distintas alturas sin duplicar patrones.
 */
export const STAR_HEIGHT_LEVELS = [0, 60, 120];

/**
 * Packs disponibles. Los primeros (sin `requires`) son los base pedidos:
 * un pack de 3 y otro de 5, con las estrellas juntas. La variedad de altura la da
 * la elevación al azar (STAR_HEIGHT_LEVELS). Debajo van ejemplos de packs
 * desbloqueables (dormidos hasta que exista su hito en run-milestones).
 */
export const STAR_PATTERNS: StarPattern[] = [
  // Base: pack de 3, juntas.
  {
    id: 'line3',
    widthM: 2 * S,
    points: [
      { dxM: 0,     dy: H },
      { dxM: S,     dy: H },
      { dxM: 2 * S, dy: H },
    ],
  },
  // Base: pack de 5, juntas.
  {
    id: 'line5',
    widthM: 4 * S,
    points: [
      { dxM: 0,     dy: H },
      { dxM: S,     dy: H },
      { dxM: 2 * S, dy: H },
      { dxM: 3 * S, dy: H },
      { dxM: 4 * S, dy: H },
    ],
  },

  // ── Desbloqueables (ejemplos; se activan al añadir su hito en run-milestones) ──
  // Arco de 5 (sube y baja): pide un salto bien medido.
  {
    id: 'arc5',
    requires: 'pattern_arc',
    widthM: 4 * S,
    points: [
      { dxM: 0,     dy: H },
      { dxM: S,     dy: H + 55 },
      { dxM: 2 * S, dy: H + 85 },
      { dxM: 3 * S, dy: H + 55 },
      { dxM: 4 * S, dy: H },
    ],
  },
  // Zigzag de 6: alterna alto/bajo.
  {
    id: 'zigzag6',
    requires: 'pattern_zigzag',
    widthM: 5 * S,
    points: [
      { dxM: 0,     dy: H },
      { dxM: S,     dy: H + 70 },
      { dxM: 2 * S, dy: H },
      { dxM: 3 * S, dy: H + 70 },
      { dxM: 4 * S, dy: H },
      { dxM: 5 * S, dy: H + 70 },
    ],
  },
  // Columna de 3 (vertical): pide doble salto o vuelo para la de arriba.
  {
    id: 'column3',
    requires: 'pattern_column',
    widthM: 0,
    points: [
      { dxM: 0, dy: H },
      { dxM: 0, dy: H + 80 },
      { dxM: 0, dy: H + 160 },
    ],
  },
];

/** Packs activos según los hitos comprados: los base + los desbloqueados. */
export function unlockedStarPatterns(owned: string[]): StarPattern[] {
  return STAR_PATTERNS.filter(p => !p.requires || owned.includes(p.requires));
}
