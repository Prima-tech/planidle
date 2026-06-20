// Sistema de desbloqueos. Generaliza el patrón de AchievementService:
//
//   - Las REGLAS viven aquí (estáticas, en código). No se persisten.
//   - El DESBLOQUEO sí se persiste (por personaje o global según scope) en un
//     Set monotónico: una vez true, nunca vuelve a false.
//   - El estado del que dependen las condiciones (nivel, kills, logros, flags)
//     se deriva en vivo de los servicios que ya existen — no se duplica.
//
// Para añadir un desbloqueo nuevo: añade una FeatureDef aquí y consume
// `unlocks.isVisible(id)` / `isLocked(id)` / `isUnlocked(id)` en la plantilla.

export type UnlockScope = 'char' | 'global';

/**
 * Fuentes que pueden satisfacer un desbloqueo. Una feature se desbloquea
 * cuando se cumplen TODAS sus fuentes (AND).
 *
 * Importante: una feature `global` solo debe usar fuentes globales
 * (`kills` global, `achievement` global, `flag`); el nivel/kills de personaje
 * no tienen sentido a nivel de cuenta.
 */
export type UnlockSource =
  | { type: 'level';       value: number }                         // char: nivel del personaje
  | { type: 'kills';       value: number; scope: UnlockScope }     // kills char o globales
  | { type: 'achievement'; id: string }                            // logro desbloqueado (AchievementService)
  | { type: 'mission';     id: string }                            // misión completada (futuro MissionService)
  | { type: 'flag';        id: string };                           // evento manual "por definir"

/** Cómo se presenta lo bloqueado: oculto del todo, o visible con candado. */
export type UnlockDisplay = 'hidden' | 'locked';

export interface FeatureDef {
  /** Id único, sin espacios. Convención: 'categoria.cosa' (p.ej. 'panel.chest', 'char.gutts'). */
  id: string;
  scope: UnlockScope;
  display: UnlockDisplay;
  /** Condiciones (AND). `[]` ⇒ desbloqueado desde el inicio. */
  requires: UnlockSource[];
  name?: string;
  desc?: string;
  /** Si está, al desbloquearse (no silencioso) muestra una pastilla tipo logro.
   *  Sin esto el desbloqueo solo actualiza badges, sin toast. */
  toast?: { label: string; icon: string };
}

export const FEATURES: FeatureDef[] = [
  // ── Personajes (global) — solo Gutts disponible al inicio ────────────────────
  // El resto NO aparecen (display 'hidden') hasta desbloquearse. Cambia las
  // condiciones cuando definas cómo se gana cada personaje.
  { id: 'char.gutts',    scope: 'global', display: 'hidden', requires: [],
    name: 'Gutts' },
  { id: 'char.merlin',   scope: 'global', display: 'hidden', requires: [{ type: 'flag', id: 'char_merlin' }],
    name: 'Merlin' },
  { id: 'char.aldric',   scope: 'global', display: 'hidden', requires: [{ type: 'flag', id: 'char_aldric' }],
    name: 'Aldric' },
  { id: 'char.seraphel', scope: 'global', display: 'hidden', requires: [{ type: 'flag', id: 'char_seraphel' }],
    name: 'Seraphel' },
  { id: 'char.malachar', scope: 'global', display: 'hidden', requires: [{ type: 'flag', id: 'char_malachar' }],
    name: 'Malachar' },
  { id: 'char.solmara',  scope: 'global', display: 'hidden', requires: [{ type: 'achievement', id: 'gkills_10000' }],
    name: 'Solmara' },
  // Kugo se recluta hablándole en el mapa 1-1 (pone el flag 'char_kugo'). Ver
  // RECRUIT_NPCS en gamescene.ts. Tras reclutarlo aparece en el roster.
  { id: 'char.kugo',     scope: 'global', display: 'hidden', requires: [{ type: 'flag', id: 'char_kugo' }],
    name: 'Kugo' },

  // ── Paneles (char) ───────────────────────────────────────────────────────────
  // El botón del cofre de ciudad NO aparece en el footer hasta desbloquearlo.
  { id: 'panel.chest', scope: 'char', display: 'hidden', requires: [{ type: 'level', value: 3 }],
    name: 'Cofre de ciudad' },

  // ── Mapas (char) — destinos de teletransporte ────────────────────────────────
  // Todos los 1-x empiezan BLOQUEADOS (display 'locked' = se ven con candado en el
  // mapa, pero no se puede viajar). 'hogar' no está en el registro → siempre libre.
  //   · 1-1 se desbloquea al llegar a 100 m en el Modo Mundo (flag 'map_1_1'). La
  //     PRIMERA vez, la WorldRunScene muestra el modal de entrada (app-map-entrance-modal)
  //     en lugar de una pastilla; por eso esta feature no define `toast`. Ver WorldRunScene.
  //   · 1-2…1-8 esperan su propio flag (aún sin definir cómo se ganan).
  { id: 'map.1-1', scope: 'char', display: 'locked', requires: [{ type: 'flag', id: 'map_1_1' }],
    name: 'Mapa 1-1' },
  { id: 'map.1-2', scope: 'char', display: 'locked', requires: [{ type: 'flag', id: 'map_1_2' }], name: 'Mapa 1-2' },
  { id: 'map.1-3', scope: 'char', display: 'locked', requires: [{ type: 'flag', id: 'map_1_3' }], name: 'Mapa 1-3' },
  { id: 'map.1-4', scope: 'char', display: 'locked', requires: [{ type: 'flag', id: 'map_1_4' }], name: 'Mapa 1-4' },
  { id: 'map.1-5', scope: 'char', display: 'locked', requires: [{ type: 'flag', id: 'map_1_5' }], name: 'Mapa 1-5' },
  { id: 'map.1-6', scope: 'char', display: 'locked', requires: [{ type: 'flag', id: 'map_1_6' }], name: 'Mapa 1-6' },
  { id: 'map.1-7', scope: 'char', display: 'locked', requires: [{ type: 'flag', id: 'map_1_7' }], name: 'Mapa 1-7' },
  { id: 'map.1-8', scope: 'char', display: 'locked', requires: [{ type: 'flag', id: 'map_1_8' }], name: 'Mapa 1-8' },
];

/** Id de feature de un mapa por su id de pin (p.ej. '1-1' → 'map.1-1'). 'hogar'
 *  no está registrado, así que siempre cuenta como desbloqueado. */
export function mapFeatureId(mapId: string): string {
  return `map.${mapId}`;
}

/** Id de feature de un personaje del roster por su nombre (p.ej. 'Gutts' → 'char.gutts'). */
export function characterFeatureId(name: string): string {
  return `char.${name.toLowerCase()}`;
}
