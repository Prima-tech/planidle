import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { PlayerStateService } from './player-state.service';
import { AdminService } from './admin.service';

export interface TalentEffect {
  // 'miningEfficiency': eficiencia de minería (%). Efecto de juego pendiente de definir;
  //   por ahora solo suma en getBonus() y se muestra en la ficha del talento.
  // 'miningDrop': botín extra al minar. El multiplicador de drop de las rocas es
  //   (1 + suma de miningDrop). base 1 sin gema → ×2 (doble); con gema escala.
  // 'attackSpeed': % de velocidad de ataque básico (suma al stat derivado de DEX
  //   en CharacterStatsService._calcAttackSpeed, cap +100% global).
  // 'exploration': % de metros extra en expediciones AFK del Modo Mundo
  //   (offline-gains). Futuro: aplicar también a la carrera activa.
  // 'alchemy': % de potencia/éxito creando pociones. Efecto pendiente (la creación
  //   de pociones aún no existe); por ahora solo suma en getBonus() y se muestra.
  type:     'atk' | 'magicAtk' | 'hp' | 'mp' | 'defense' | 'evasion' | 'critChance' | 'hpRegen' | 'mpRegen' | 'dropRate' | 'miningEfficiency' | 'miningDrop' | 'attackSpeed' | 'exploration' | 'alchemy' | 'ability';
  base:     number;
  ability?: string;
  /** Solo para type 'ability': a qué daño suma su `base`. Por defecto 'magic'. */
  school?:  'physical' | 'magic';
}

/** Un talento: atributo (stat) o habilidad equipable (`effect.type === 'ability'`).
 *  `label` es texto plano (catálogo de habilidades) o una clave i18n (atributos de
 *  los árboles): la UI lo pasa siempre por `translate`. */
export interface TalentNodeConfig {
  id:       string;
  label:    string;
  icon:     string;
  effect:   TalentEffect;
}

/** Rama dentro de un árbol: centro (raíz y maestría), izquierda o derecha. */
export type TalentBranch = 'C' | 'L' | 'R';

/** Sitio de un talento en un árbol. `tier` = fila (1 arriba … 6 abajo); cada fila pide
 *  un nivel mínimo (TALENT_TIER_LEVELS). `requires`: basta con UNO de los padres, salvo
 *  `requiresAll` (los pide todos: la maestría que junta las dos ramas). */
export interface TalentTreeNode {
  id:           string;   // id del TalentNodeConfig (atributo o habilidad del catálogo)
  tier:         number;
  branch:       TalentBranch;
  requires:     string[];
  requiresAll?: boolean;
}

export type TalentTreeId = 'warrior' | 'arcane' | 'technique';

export interface TalentTreeConfig {
  id:    TalentTreeId;
  label: string;   // clave i18n
  icon:  string;
  nodes: TalentTreeNode[];
}

export interface TalentSnapshot {
  /** Nodos desbloqueados (1 punto de talento gastado por cada uno) */
  unlocked: Record<string, boolean>;
}

/** Tres configuraciones de talentos por personaje, ligadas a los sets de equipo */
export interface TalentLoadouts {
  active: number;
  sets: (TalentSnapshot | null)[];
}

export const TALENT_LOADOUT_COUNT = 3;

// ── Árboles de talento (pestañas Guerrero / Arcano / Técnica) ─────────────────
// Cada árbol baja de arriba a abajo: arriba su ataque base, luego se abre en dos
// ramas (izquierda / derecha) que se juntan en una maestría al final. Las
// habilidades son los nodos del catálogo (más abajo) por su id; los atributos se
// definen aquí. 1 punto de talento por nivel; cada nodo cuesta 1.

/** Nivel mínimo de cada fila (índice = tier; el 0 no se usa). */
export const TALENT_TIER_LEVELS = [0, 1, 2, 4, 6, 8, 10];

/** Atributos de los árboles (las habilidades salen del catálogo). Labels = claves i18n. */
export const TALENT_STAT_NODES: TalentNodeConfig[] = [
  // Guerrero
  { id: 'war_str1',  label: 'TALENT.NODE.STR1',      icon: 'barbell-outline',      effect: { type: 'atk',        base: 1 } },
  { id: 'war_vit1',  label: 'TALENT.NODE.VIT1',      icon: 'heart-outline',        effect: { type: 'hp',         base: 5 } },
  { id: 'war_guard', label: 'TALENT.NODE.GUARD1',    icon: 'shield-outline',       effect: { type: 'defense',    base: 1 } },
  { id: 'war_crit',  label: 'TALENT.NODE.CRIT1',     icon: 'locate-outline',       effect: { type: 'critChance', base: 1 } },
  { id: 'war_str2',  label: 'TALENT.NODE.STR2',      icon: 'barbell-outline',      effect: { type: 'atk',        base: 2 } },
  { id: 'war_oak',   label: 'TALENT.NODE.OAK_HEART', icon: 'heart-circle-outline', effect: { type: 'hp',         base: 15 } },
  // Arcano
  { id: 'arc_int1',  label: 'TALENT.NODE.INT1',      icon: 'bulb-outline',         effect: { type: 'magicAtk',   base: 1 } },
  { id: 'arc_mana1', label: 'TALENT.NODE.MANA1',     icon: 'water-outline',        effect: { type: 'mp',         base: 5 } },
  { id: 'arc_int2',  label: 'TALENT.NODE.INT2',      icon: 'bulb-outline',         effect: { type: 'magicAtk',   base: 2 } },
  { id: 'arc_seren', label: 'TALENT.NODE.SERENITY',  icon: 'moon-outline',         effect: { type: 'mpRegen',    base: 1 } },
  { id: 'arc_well',  label: 'TALENT.NODE.MANA_WELL', icon: 'infinite-outline',     effect: { type: 'mp',         base: 15 } },
  // Técnica
  { id: 'tec_speed1',  label: 'TALENT.NODE.SPEED1',     icon: 'speedometer-outline', effect: { type: 'attackSpeed',      base: 2 } },
  { id: 'tec_luck1',   label: 'TALENT.NODE.LUCK1',      icon: 'sparkles-outline',    effect: { type: 'dropRate',         base: 1 } },
  { id: 'tec_explore', label: 'TALENT.NODE.EXPLORER1',  icon: 'compass-outline',     effect: { type: 'exploration',      base: 5 } },
  { id: 'tec_reflex',  label: 'TALENT.NODE.REFLEX1',    icon: 'footsteps-outline',   effect: { type: 'evasion',          base: 1 } },
  { id: 'tec_wind',    label: 'TALENT.NODE.WIND_HANDS', icon: 'speedometer-outline', effect: { type: 'attackSpeed',      base: 5 } },
  { id: 'tec_miner',   label: 'TALENT.NODE.MINER',      icon: 'hammer-outline',      effect: { type: 'miningEfficiency', base: 2 } },
  { id: 'tec_minedrop',label: 'TALENT.NODE.MINE_DROP',  icon: 'cube-outline',        effect: { type: 'miningDrop',       base: 1 } },
  { id: 'tec_blessing',label: 'TALENT.NODE.BLESSING',   icon: 'gift-outline',        effect: { type: 'dropRate',         base: 3 } },
];

export const TALENT_TREES: TalentTreeConfig[] = [
  { id: 'warrior', label: 'TALENT.TREE.WARRIOR', icon: 'flash-outline', nodes: [
    { id: 'warrior_slash',   tier: 1, branch: 'C', requires: [] },
    { id: 'war_str1',        tier: 2, branch: 'L', requires: ['warrior_slash'] },
    { id: 'war_vit1',        tier: 2, branch: 'R', requires: ['warrior_slash'] },
    { id: 'warrior_slash_2', tier: 3, branch: 'L', requires: ['war_str1'] },
    { id: 'war_guard',       tier: 3, branch: 'R', requires: ['war_vit1'] },
    { id: 'war_crit',        tier: 4, branch: 'L', requires: ['warrior_slash_2'] },
    { id: 'war_str2',        tier: 4, branch: 'L', requires: ['warrior_slash_2'] },
    { id: 'war_oak',         tier: 4, branch: 'R', requires: ['war_guard'] },
    { id: 'warrior_slash_3', tier: 5, branch: 'L', requires: ['war_crit', 'war_str2'] },
    { id: 'blood_1',         tier: 5, branch: 'R', requires: ['war_oak'] },
    { id: 'warrior_slash_5', tier: 6, branch: 'C', requires: ['warrior_slash_3', 'blood_1'], requiresAll: true },
  ]},
  { id: 'arcane', label: 'TALENT.TREE.ARCANE', icon: 'flame-outline', nodes: [
    { id: 'fireball',       tier: 1, branch: 'C', requires: [] },
    { id: 'arc_int1',       tier: 2, branch: 'L', requires: ['fireball'] },
    { id: 'arc_mana1',      tier: 2, branch: 'R', requires: ['fireball'] },
    { id: 'fire_shield',    tier: 3, branch: 'L', requires: ['arc_int1'] },
    { id: 'ice_spike',      tier: 3, branch: 'R', requires: ['arc_mana1'] },
    { id: 'arc_int2',       tier: 4, branch: 'L', requires: ['fire_shield'] },
    { id: 'arc_seren',      tier: 4, branch: 'R', requires: ['ice_spike'] },
    { id: 'arc_well',       tier: 4, branch: 'R', requires: ['ice_spike'] },
    { id: 'fire_hurricane', tier: 5, branch: 'L', requires: ['arc_int2'] },
    { id: 'kraken',         tier: 5, branch: 'R', requires: ['arc_seren', 'arc_well'] },
    { id: 'phoenix',        tier: 6, branch: 'C', requires: ['fire_hurricane', 'kraken'], requiresAll: true },
  ]},
  { id: 'technique', label: 'TALENT.TREE.TECHNIQUE', icon: 'footsteps-outline', nodes: [
    { id: 'dash',         tier: 1, branch: 'C', requires: [] },
    { id: 'tec_speed1',   tier: 2, branch: 'L', requires: ['dash'] },
    { id: 'tec_luck1',    tier: 2, branch: 'R', requires: ['dash'] },
    { id: 'smoke_ghost',  tier: 3, branch: 'L', requires: ['tec_speed1'] },
    { id: 'tec_explore',  tier: 3, branch: 'R', requires: ['tec_luck1'] },
    { id: 'tec_reflex',   tier: 4, branch: 'L', requires: ['smoke_ghost'] },
    { id: 'tec_wind',     tier: 4, branch: 'L', requires: ['smoke_ghost'] },
    { id: 'tec_miner',    tier: 4, branch: 'R', requires: ['tec_explore'] },
    { id: 'smoke_1',      tier: 5, branch: 'L', requires: ['tec_reflex', 'tec_wind'] },
    { id: 'tec_minedrop', tier: 5, branch: 'R', requires: ['tec_miner'] },
    { id: 'tec_blessing', tier: 6, branch: 'C', requires: ['smoke_1', 'tec_minedrop'], requiresAll: true },
  ]},
];

// ── Catálogo de habilidades ──────────────────────────────────────────────────
// Las que están en un árbol se aprenden ahí; el resto solo se ve en modo admin.

// ── Habilidades de fuego ────────────────────────

export const TALENT_NODES_FIRE: TalentNodeConfig[] = [
  {
    id: 'small_fire', label: 'Fuego\nPequeño', icon: 'bonfire-outline',
    effect: { type: 'ability', base: 5, ability: 'small_fire' },
  },
  {
    id: 'fire_flower', label: 'Flor de\nFuego', icon: 'rose-outline',
    effect: { type: 'ability', base: 8, ability: 'fire_flower' },
  },
  {
    id: 'fire_pillar', label: 'Pilar de\nFuego', icon: 'arrow-up-outline',
    effect: { type: 'ability', base: 12, ability: 'fire_pillar' },
  },
  {
    id: 'fire_shield', label: 'Escudo\nde Fuego', icon: 'shield-half-outline',
    effect: { type: 'ability', base: 8, ability: 'fire_shield' },
  },
  {
    id: 'lava_paddle', label: 'Paleta\nde Lava', icon: 'golf-outline',
    effect: { type: 'ability', base: 10, ability: 'lava_paddle' },
  },
  {
    id: 'fireball', label: 'Bola de\nFuego', icon: 'flame-outline',
    effect: { type: 'ability', base: 15, ability: 'fireball' },
  },
  {
    id: 'fire_hurricane', label: 'Huracán\nde Fuego', icon: 'reload-circle-outline',
    effect: { type: 'ability', base: 18, ability: 'fire_hurricane' },
  },
  {
    id: 'lava_drop', label: 'Gota de\nLava', icon: 'rainy-outline',
    effect: { type: 'ability', base: 15, ability: 'lava_drop' },
  },
  {
    id: 'magma_geyser', label: 'Géiser de\nMagma', icon: 'nuclear-outline',
    effect: { type: 'ability', base: 20, ability: 'magma_geyser' },
  },
  {
    id: 'phoenix', label: 'Fénix', icon: 'sunny-outline',
    effect: { type: 'ability', base: 25, ability: 'phoenix' },
  },
];

// ── Habilidades de guerrero (melee — primera pestaña del panel) ───────────────

export const TALENT_NODES_WARRIOR: TalentNodeConfig[] = [
  {
    id: 'warrior_slash', label: 'Tajo de\nGuerrero', icon: 'flash-outline',
    effect: { type: 'ability', base: 18, ability: 'warrior_slash', school: 'physical' },
  },
  {
    id: 'warrior_slash_2', label: 'Tajo de\nGuerrero II', icon: 'flash-outline',
    effect: { type: 'ability', base: 20, ability: 'warrior_slash_2', school: 'physical' },
  },
  {
    id: 'warrior_slash_3', label: 'Tajo de\nGuerrero III', icon: 'flash-outline',
    effect: { type: 'ability', base: 22, ability: 'warrior_slash_3', school: 'physical' },
  },
  {
    id: 'warrior_slash_4', label: 'Tajo de\nGuerrero IV', icon: 'flash-outline',
    effect: { type: 'ability', base: 24, ability: 'warrior_slash_4', school: 'physical' },
  },
  {
    id: 'warrior_slash_5', label: 'Tajo de\nGuerrero V', icon: 'flash-outline',
    effect: { type: 'ability', base: 26, ability: 'warrior_slash_5', school: 'physical' },
  },
];

// ── Habilidades de agua ─────────────────────────

export const TALENT_NODES_WATER: TalentNodeConfig[] = [
  {
    id: 'water_drop', label: 'Gota de\nAgua', icon: 'rainy-outline',
    effect: { type: 'ability', base: 5, ability: 'water_drop' },
  },
  {
    id: 'ice_crystal', label: 'Cristal\nde Hielo', icon: 'diamond-outline',
    effect: { type: 'ability', base: 8, ability: 'ice_crystal' },
  },
  {
    id: 'water_geyser', label: 'Géiser\nde Agua', icon: 'water-outline',
    effect: { type: 'ability', base: 10, ability: 'water_geyser' },
  },
  {
    id: 'snowflake', label: 'Copo de\nNieve', icon: 'flower-outline',
    effect: { type: 'ability', base: 10, ability: 'snowflake' },
  },
  {
    id: 'water_splash', label: 'Salpicadura', icon: 'planet-outline',
    effect: { type: 'ability', base: 18, ability: 'water_splash' },
  },
  {
    id: 'ice_spike', label: 'Pico\nde Hielo', icon: 'triangle-outline',
    effect: { type: 'ability', base: 12, ability: 'ice_spike' },
  },
  {
    id: 'waterball', label: 'Bola de\nAgua', icon: 'ellipse-outline',
    effect: { type: 'ability', base: 15, ability: 'waterball' },
  },
  {
    id: 'kraken', label: 'Kraken', icon: 'skull-outline',
    effect: { type: 'ability', base: 25, ability: 'kraken' },
  },
];

// ── Habilidades de explosión ───────────────────

export const TALENT_NODES_EXPLOSION: TalentNodeConfig[] = [
  {
    id: 'circle_explosion', label: 'Explosión\nCircular', icon: 'radio-outline',
    effect: { type: 'ability', base: 10, ability: 'circle_explosion' },
  },
  {
    id: 'explosion', label: 'Explosión', icon: 'flash-outline',
    effect: { type: 'ability', base: 15, ability: 'explosion' },
  },
  {
    id: 'explosion_blue_circle', label: 'Explosión\nAzul', icon: 'ellipse-outline',
    effect: { type: 'ability', base: 12, ability: 'explosion_blue_circle' },
  },
  {
    id: 'explosion_blue_oval', label: 'Óvalo\nExplosivo', icon: 'resize-outline',
    effect: { type: 'ability', base: 14, ability: 'explosion_blue_oval' },
  },
  {
    id: 'explosion_gas', label: 'Gas\nExplosivo', icon: 'medical-outline',
    effect: { type: 'ability', base: 12, ability: 'explosion_gas' },
  },
  {
    id: 'explosion_gas_circle', label: 'Gas\nCircular', icon: 'disc-outline',
    effect: { type: 'ability', base: 18, ability: 'explosion_gas_circle' },
  },
  {
    id: 'explosion_two_colors', label: 'Explosión\nBicolor', icon: 'color-palette-outline',
    effect: { type: 'ability', base: 20, ability: 'explosion_two_colors' },
  },
];

// ── Habilidades de humo ─────────────────────────

export const TALENT_NODES_SMOKER: TalentNodeConfig[] = [
  {
    id: 'cycled_smoke', label: 'Humo\nCíclico', icon: 'refresh-outline',
    effect: { type: 'ability', base: 5, ability: 'cycled_smoke' },
  },
  {
    id: 'circle_smoke', label: 'Círculo\nde Humo', icon: 'radio-button-off-outline',
    effect: { type: 'ability', base: 8, ability: 'circle_smoke' },
  },
  {
    id: 'rising_smoke', label: 'Humo\nAscendente', icon: 'trending-up-outline',
    effect: { type: 'ability', base: 12, ability: 'rising_smoke' },
  },
  {
    id: 'cycled_smoke_long', label: 'Humo\nProlongado', icon: 'repeat-outline',
    effect: { type: 'ability', base: 10, ability: 'cycled_smoke_long' },
  },
  {
    id: 'falling_smoke', label: 'Humo\nCaído', icon: 'arrow-down-outline',
    effect: { type: 'ability', base: 14, ability: 'falling_smoke' },
  },
  {
    id: 'horisontal_smoke', label: 'Humo\nHorizontal', icon: 'remove-outline',
    effect: { type: 'ability', base: 10, ability: 'horisontal_smoke' },
  },
  {
    id: 'curved_smoke', label: 'Humo\nCurvo', icon: 'git-branch-outline',
    effect: { type: 'ability', base: 12, ability: 'curved_smoke' },
  },
  {
    id: 'smoke_ghost', label: 'Fantasma\nde Humo', icon: 'cloud-outline',
    effect: { type: 'ability', base: 20, ability: 'smoke_ghost' },
  },
];

// ── Humo (assets nuevos — pestaña "Humo" del panel) ───────────────────────────

export const TALENT_NODES_SMOKE: TalentNodeConfig[] = [
  {
    id: 'smoke_1', label: 'Humo I', icon: 'cloud-outline',
    effect: { type: 'ability', base: 8, ability: 'smoke_1' },
  },
  {
    id: 'smoke_2', label: 'Humo II', icon: 'cloud-outline',
    effect: { type: 'ability', base: 10, ability: 'smoke_2' },
  },
  {
    id: 'smoke_3', label: 'Humo III', icon: 'cloud-outline',
    effect: { type: 'ability', base: 12, ability: 'smoke_3' },
  },
  {
    id: 'smoke_4', label: 'Humo IV', icon: 'cloud-outline',
    effect: { type: 'ability', base: 14, ability: 'smoke_4' },
  },
];

// ── Fuego (assets nuevos — pestaña "Fuego" del panel) ─────────────────────────

export const TALENT_NODES_FLAME: TalentNodeConfig[] = [
  {
    id: 'fire_1', label: 'Fuego I', icon: 'flame-outline',
    effect: { type: 'ability', base: 12, ability: 'fire_1' },
  },
  {
    id: 'fire_2', label: 'Fuego II', icon: 'flame-outline',
    effect: { type: 'ability', base: 15, ability: 'fire_2' },
  },
  {
    id: 'fire_3', label: 'Fuego III', icon: 'flame-outline',
    effect: { type: 'ability', base: 18, ability: 'fire_3' },
  },
];

// ── Sangre (assets nuevos — pestaña "Sangre" del panel) ───────────────────────

export const TALENT_NODES_BLOOD: TalentNodeConfig[] = [
  {
    id: 'blood_1', label: 'Sangre I', icon: 'water-outline',
    effect: { type: 'ability', base: 16, ability: 'blood_1' },
  },
  {
    id: 'blood_2', label: 'Sangre II', icon: 'water-outline',
    effect: { type: 'ability', base: 12, ability: 'blood_2' },
  },
];

// ── Habilidades físicas ─────────────────────────

export const TALENT_NODES_PHYSICAL: TalentNodeConfig[] = [
  {
    id: 'dash', label: 'Dash', icon: 'flash-outline',
    effect: { type: 'ability', base: 0, ability: 'dash', school: 'physical' },
  },
];

// ── Registro global (todos los árboles) ──────────────────────────────────────

const ALL_NODES = [...TALENT_STAT_NODES, ...TALENT_NODES_WARRIOR, ...TALENT_NODES_SMOKE, ...TALENT_NODES_FLAME, ...TALENT_NODES_BLOOD, ...TALENT_NODES_FIRE, ...TALENT_NODES_WATER, ...TALENT_NODES_SMOKER, ...TALENT_NODES_EXPLOSION, ...TALENT_NODES_PHYSICAL];

@Injectable({ providedIn: 'root' })
export class TalentService {

  readonly nodes   = ALL_NODES;
  readonly trees   = TALENT_TREES;
  /** Nodos desbloqueados en el build activo */
  readonly unlocked: Record<string, boolean> = {};
  readonly changes$ = new Subject<void>();

  private readonly nodeById = new Map(ALL_NODES.map(n => [n.id, n]));
  /** Sitio de cada nodo en su árbol (los que no están en ninguno no se pueden aprender). */
  private readonly treeNodeById = new Map(TALENT_TREES.flatMap(t => t.nodes).map(n => [n.id, n]));

  // ── Loadouts: 3 configuraciones por personaje, ligadas a los sets de equipo ──
  // La config activa vive en `unlocked` (estado de trabajo); las demás, como
  // snapshots guardados.
  activeLoadout = 0;
  private storedSets: (TalentSnapshot | null)[] = [null, null, null];

  constructor(private playerState: PlayerStateService, private admin: AdminService) {
    for (const n of ALL_NODES) this.unlocked[n.id] = false;
  }

  /** Cambia la config activa: guarda la actual y restaura la elegida.
   *  changes$ (vía restoreFromSnapshot) propaga el cambio a stats y auto-save. */
  switchLoadout(index: number): void {
    if (index === this.activeLoadout || index < 0 || index >= TALENT_LOADOUT_COUNT) return;
    this.storedSets[this.activeLoadout] = this.getSnapshot();
    this.activeLoadout = index;
    this.restoreFromSnapshot(this.storedSets[index]);
  }

  /** Para persistir: las 3 configs con la activa leída del estado vivo. */
  getLoadoutsSnapshot(): TalentLoadouts {
    const sets = this.storedSets.map((s, i) =>
      i === this.activeLoadout ? this.getSnapshot() : (s ? this.cloneSnapshot(s) : null),
    );
    return { active: this.activeLoadout, sets };
  }

  /** Restaura las 3 configs. `legacy` migra saves antiguos de una sola config:
   *  como antes los talentos no estaban ligados al equipo, se duplica la config
   *  en los 3 sets (migración no destructiva). */
  restoreLoadouts(data: TalentLoadouts | null | undefined, legacy?: TalentSnapshot | null): void {
    if (data && Array.isArray(data.sets)) {
      this.storedSets = Array.from({ length: TALENT_LOADOUT_COUNT }, (_, i) =>
        data.sets[i] ? this.cloneSnapshot(data.sets[i]!) : null,
      );
      this.activeLoadout = Math.min(Math.max(data.active ?? 0, 0), TALENT_LOADOUT_COUNT - 1);
    } else {
      this.storedSets = Array.from({ length: TALENT_LOADOUT_COUNT }, () =>
        legacy ? this.cloneSnapshot(legacy) : null,
      );
      this.activeLoadout = 0;
    }
    this.restoreFromSnapshot(this.storedSets[this.activeLoadout]);
  }

  /** Normaliza un snapshot crudo: solo conserva ids que siguen existiendo (los del
   *  antiguo árbol radial se descartan, y con ellos sus puntos vuelven). */
  private cloneSnapshot(snap: TalentSnapshot): TalentSnapshot {
    const unlocked: Record<string, boolean> = {};
    for (const id in snap.unlocked ?? {}) if (this.nodeById.has(id) && snap.unlocked[id]) unlocked[id] = true;
    return { unlocked };
  }

  // ── Puntos de talento ────────────────────────────────────────────────────────
  // Total = nivel del personaje · gastados = nº de nodos desbloqueados en el build.

  pointsTotal(): number { return this.playerState.snapshot().lvl; }

  pointsSpent(): number {
    let n = 0;
    for (const id in this.unlocked) if (this.unlocked[id]) n++;
    return n;
  }

  pointsAvailable(): number {
    return Math.max(0, this.pointsTotal() - this.pointsSpent());
  }

  // ── Árboles ──────────────────────────────────────────────────────────────────

  /** Sitio del nodo en su árbol, o undefined si no está en ninguno. */
  treeNode(nodeId: string): TalentTreeNode | undefined {
    return this.treeNodeById.get(nodeId);
  }

  /** Nivel mínimo para aprender el nodo (el de su fila). */
  tierLevel(nodeId: string): number {
    return TALENT_TIER_LEVELS[this.treeNodeById.get(nodeId)?.tier ?? 0] ?? 0;
  }

  /** ¿El personaje tiene ya el nivel de la fila del nodo? */
  levelReached(nodeId: string): boolean {
    return this.playerState.snapshot().lvl >= this.tierLevel(nodeId);
  }

  /** ¿Están aprendidos los padres? Uno basta, salvo `requiresAll`. */
  parentsUnlocked(nodeId: string): boolean {
    const tn = this.treeNodeById.get(nodeId);
    if (!tn) return false;
    if (!tn.requires.length) return true;
    return tn.requiresAll
      ? tn.requires.every(r => this.unlocked[r])
      : tn.requires.some(r => this.unlocked[r]);
  }

  /** ¿Ha aprendido este personaje alguna habilidad (de verdad, no por admin)? */
  hasLearnedAbility(): boolean {
    return this.nodes.some(n => n.effect.type === 'ability' && this.unlocked[n.id]);
  }

  // ── Desbloqueo de nodos ──────────────────────────────────────────────────────

  /** En modo admin todo cuenta como desbloqueado *a efectos de visibilidad/UI*
   *  (ver el árbol completo, poder pinchar nodos). Los bonos de combate NO usan
   *  esto: ver isReallyUnlocked()/getBonus(). El estado REAL vive en `this.unlocked`. */
  isUnlocked(nodeId: string): boolean {
    return this.admin.isAdmin || !!this.unlocked[nodeId];
  }

  /** Desbloqueo REAL (ignora admin). Es lo que cuenta para los bonos de combate:
   *  admin solo afecta a la visibilidad, no a las estadísticas del personaje. */
  isReallyUnlocked(nodeId: string): boolean {
    return !!this.unlocked[nodeId];
  }

  /** Alcanzable: sin aprender, en un árbol, con el nivel de su fila y sus padres.
   *  (Ignora los puntos — sirve para mostrar el botón aunque no alcancen.) */
  isReachable(nodeId: string): boolean {
    if (this.unlocked[nodeId]) return false;
    return this.parentsUnlocked(nodeId) && this.levelReached(nodeId);
  }

  /** Se puede gastar un punto YA: alcanzable y con puntos disponibles. */
  canUnlock(nodeId: string): boolean {
    return this.isReachable(nodeId) && this.pointsAvailable() > 0;
  }

  unlock(nodeId: string): void {
    if (!this.canUnlock(nodeId)) return;
    this.unlocked[nodeId] = true;
    this.changes$.next();
  }

  /** ¿Algún hijo aprendido se quedaría sin padre si se olvida este nodo? */
  hasUnlockedDependents(nodeId: string): boolean {
    for (const tree of TALENT_TREES) {
      for (const child of tree.nodes) {
        if (!this.unlocked[child.id] || !child.requires.includes(nodeId)) continue;
        if (child.requiresAll) return true;
        if (!child.requires.some(r => r !== nodeId && this.unlocked[r])) return true;
      }
    }
    return false;
  }

  /** Olvidar para recuperar el punto: sin hijos que dependan de él. */
  canLock(nodeId: string): boolean {
    return !!this.unlocked[nodeId] && !this.hasUnlockedDependents(nodeId);
  }

  lock(nodeId: string): void {
    if (!this.canLock(nodeId)) return;
    this.unlocked[nodeId] = false;
    this.changes$.next();
  }

  getBonus(): { atk: number; magicAtk: number; hp: number; mp: number; defense: number; evasion: number; critChance: number; hpRegen: number; mpRegen: number; dropRate: number; miningEfficiency: number; miningDrop: number; attackSpeed: number; exploration: number; alchemy: number; abilities: string[] } {
    let atk = 0, magicAtk = 0, hp = 0, mp = 0, defense = 0, evasion = 0, critChance = 0, hpRegen = 0, mpRegen = 0, dropRate = 0, miningEfficiency = 0, miningDrop = 0, attackSpeed = 0, exploration = 0, alchemy = 0;
    const abilities: string[] = [];
    for (const node of this.nodes) {
      // Solo cuentan los nodos REALMENTE desbloqueados (admin NO suma bonos, solo
      // afecta visibilidad).
      if (!this.isReallyUnlocked(node.id)) continue;
      const value = node.effect.base;
      switch (node.effect.type) {
        case 'atk':              atk += value; break;
        case 'magicAtk':         magicAtk += value; break;
        case 'hp':               hp += value; break;
        case 'mp':               mp += value; break;
        case 'defense':          defense += value; break;
        case 'evasion':          evasion += value; break;
        case 'critChance':       critChance += value; break;
        case 'hpRegen':          hpRegen += value; break;
        case 'mpRegen':          mpRegen += value; break;
        case 'dropRate':         dropRate += value; break;
        case 'miningEfficiency': miningEfficiency += value; break;
        case 'miningDrop':       miningDrop += value; break;
        case 'attackSpeed':      attackSpeed += value; break;
        case 'exploration':      exploration += value; break;
        case 'alchemy':          alchemy += value; break;
        case 'ability':
          // El base de la habilidad suma a su escuela: físico (guerrero) o mágico (elementales, por defecto).
          if ((node.effect.school ?? 'magic') === 'physical') atk += value;
          else magicAtk += value;
          if (node.effect.ability) abilities.push(node.effect.ability);
          break;
      }
    }
    return { atk, magicAtk, hp, mp, defense, evasion, critChance, hpRegen, mpRegen, dropRate, miningEfficiency, miningDrop, attackSpeed, exploration, alchemy, abilities };
  }

  getSnapshot(): TalentSnapshot {
    return { unlocked: { ...this.unlocked } };
  }

  restoreFromSnapshot(snap: TalentSnapshot | null): void {
    const norm = snap ? this.cloneSnapshot(snap) : null;
    for (const n of ALL_NODES) this.unlocked[n.id] = !!norm?.unlocked?.[n.id];
    this.changes$.next();
  }
}
