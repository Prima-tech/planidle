import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { PlayerStateService } from './player-state.service';
import { AdminService } from './admin.service';

export type SphereType = 'normal' | 'rare' | 'epic';

export const SPHERE_TYPES: SphereType[] = ['normal', 'rare', 'epic'];

/** Nodo que siempre está desbloqueado (consume el punto del nivel 1) */
export const ROOT_NODE_ID = 'c0';

export interface TalentEffect {
  type:     'atk' | 'magicAtk' | 'hp' | 'mp' | 'defense' | 'evasion' | 'critChance' | 'hpRegen' | 'mpRegen' | 'dropRate' | 'ability';
  base:     number;
  ability?: string;
  /** Solo para type 'ability': a qué daño suma su `base`. Por defecto 'magic'. */
  school?:  'physical' | 'magic';
}

export interface TalentNodeConfig {
  id:       string;
  label:    string;
  icon:     string;
  col:      number;
  row:      number;
  requires: string[];
  effect:   TalentEffect;
  num?:     number;
  small?:    boolean;
  topLabel?: string;
}

export interface TalentSnapshot {
  /** Nodos desbloqueados (1 punto de talento gastado por cada uno) */
  unlocked: Record<string, boolean>;
  /** Esfera puesta en cada nodo (solo en nodos desbloqueados) */
  nodes:    Record<string, SphereType | null>;
  /** @deprecated Antes el conteo de esferas era por loadout; ahora es un pool global. Se conserva para migrar saves viejos. */
  spheres?: Record<SphereType, number>;
}

/** Tres configuraciones de talentos por personaje, ligadas a los sets de equipo */
export interface TalentLoadouts {
  active: number;
  sets: (TalentSnapshot | null)[];
  /** Pool global de esferas del personaje, compartido entre los 3 sets */
  ownedSpheres?: Record<SphereType, number>;
}

export const TALENT_LOADOUT_COUNT = 3;

// Multiplicador de la gema sobre el `base` del nodo.
// Sin gema (solo desbloqueado) cuenta como ×1 — ver getBonus().
export const SPHERE_MULT: Record<SphereType, number> = {
  normal: 2, // verde
  rare:   3, // azul
  epic:   5, // épica
};

/** Pool global de esferas con el que arranca un personaje nuevo */
const DEFAULT_OWNED_SPHERES: Record<SphereType, number> = {
  normal: 10, rare: 10, epic: 10,
};

// ── Árbol de Talentos (centro col=10, row=5 · 6 ramas × 5 niveles) ───────────
// Horizontales: paso 2 cols (88px) · Diagonales: paso 1 col+1 row (77px) — espaciado uniforme

export const TALENT_NODES: TalentNodeConfig[] = [
  // Centro (hub)
  { id: 'c0', label: '', icon: 'aperture-outline',
    col: 10, row: 5, requires: [], effect: { type: 'atk', base: 0 } },

  // ── Rama 1: Derecha (paso +2 cols) ──────────────────────────────
  { id: 'n1_1', label: '', icon: 'ellipse-outline', num: 1, small: true, topLabel: 'STR',
    col: 12, row: 5, requires: ['c0'],   effect: { type: 'atk', base: 1 } },
  { id: 'n1_2', label: 'Tajo de\nGuerrero III', icon: 'flash-outline', num: 2,
    col: 14, row: 5, requires: ['n1_1'], effect: { type: 'ability', base: 22, ability: 'warrior_slash_3', school: 'physical' } },
  { id: 'n1_3', label: '', icon: 'ellipse-outline', num: 3,
    col: 16, row: 5, requires: ['n1_2'], effect: { type: 'atk', base: 0 } },
  { id: 'n1_4', label: '', icon: 'ellipse-outline', num: 4,
    col: 18, row: 5, requires: ['n1_3'], effect: { type: 'atk', base: 0 } },
  { id: 'n1_5', label: '', icon: 'ellipse-outline', num: 5,
    col: 20, row: 5, requires: ['n1_4'], effect: { type: 'atk', base: 0 } },

  // ── Rama 2: Abajo-derecha (paso +1 col, +1 row) ─────────────────
  { id: 'n2_1', label: '', icon: 'ellipse-outline', num: 6, small: true, topLabel: 'VIT',
    col: 11, row: 6,  requires: ['c0'],   effect: { type: 'hp', base: 5 } },
  { id: 'n2_2', label: '', icon: 'ellipse-outline', num: 7,
    col: 12, row: 7,  requires: ['n2_1'], effect: { type: 'atk', base: 0 } },
  { id: 'n2_3', label: '', icon: 'ellipse-outline', num: 8,
    col: 13, row: 8,  requires: ['n2_2'], effect: { type: 'atk', base: 0 } },
  { id: 'n2_4', label: '', icon: 'ellipse-outline', num: 9,
    col: 14, row: 9,  requires: ['n2_3'], effect: { type: 'atk', base: 0 } },
  { id: 'n2_5', label: '', icon: 'ellipse-outline', num: 10,
    col: 15, row: 10, requires: ['n2_4'], effect: { type: 'atk', base: 0 } },

  // ── Rama 3: Abajo-izquierda (paso -1 col, +1 row) ───────────────
  { id: 'n3_1', label: '', icon: 'ellipse-outline', num: 11, small: true, topLabel: 'CHR',
    col: 9,  row: 6,  requires: ['c0'],   effect: { type: 'dropRate', base: 1 } },
  { id: 'n3_2', label: '', icon: 'ellipse-outline', num: 12,
    col: 8,  row: 7,  requires: ['n3_1'], effect: { type: 'atk', base: 0 } },
  { id: 'n3_3', label: '', icon: 'ellipse-outline', num: 13,
    col: 7,  row: 8,  requires: ['n3_2'], effect: { type: 'atk', base: 0 } },
  { id: 'n3_4', label: '', icon: 'ellipse-outline', num: 14,
    col: 6,  row: 9,  requires: ['n3_3'], effect: { type: 'atk', base: 0 } },
  { id: 'n3_5', label: '', icon: 'ellipse-outline', num: 15,
    col: 5,  row: 10, requires: ['n3_4'], effect: { type: 'atk', base: 0 } },

  // ── Rama 4: Izquierda (paso -2 cols) ────────────────────────────
  { id: 'n4_1', label: '', icon: 'ellipse-outline', num: 16, small: true, topLabel: 'INT',
    col: 8,  row: 5,  requires: ['c0'],   effect: { type: 'magicAtk', base: 1 } },
  { id: 'n4_2', label: '', icon: 'ellipse-outline', num: 17,
    col: 6,  row: 5,  requires: ['n4_1'], effect: { type: 'atk', base: 0 } },
  { id: 'n4_3', label: '', icon: 'ellipse-outline', num: 18,
    col: 4,  row: 5,  requires: ['n4_2'], effect: { type: 'atk', base: 0 } },
  { id: 'n4_4', label: '', icon: 'ellipse-outline', num: 19,
    col: 2,  row: 5,  requires: ['n4_3'], effect: { type: 'atk', base: 0 } },
  { id: 'n4_5', label: '', icon: 'ellipse-outline', num: 20,
    col: 0,  row: 5,  requires: ['n4_4'], effect: { type: 'atk', base: 0 } },

  // ── Rama 5: Arriba-izquierda (paso -1 col, -1 row) ──────────────
  { id: 'n5_1', label: '', icon: 'ellipse-outline', num: 21, small: true, topLabel: 'MAG',
    col: 9,  row: 4,  requires: ['c0'],   effect: { type: 'mp', base: 5 } },
  { id: 'n5_2', label: '', icon: 'ellipse-outline', num: 22,
    col: 8,  row: 3,  requires: ['n5_1'], effect: { type: 'atk', base: 0 } },
  { id: 'n5_3', label: '', icon: 'ellipse-outline', num: 23,
    col: 7,  row: 2,  requires: ['n5_2'], effect: { type: 'atk', base: 0 } },
  { id: 'n5_4', label: '', icon: 'ellipse-outline', num: 24,
    col: 6,  row: 1,  requires: ['n5_3'], effect: { type: 'atk', base: 0 } },
  { id: 'n5_5', label: '', icon: 'ellipse-outline', num: 25,
    col: 5,  row: 0,  requires: ['n5_4'], effect: { type: 'atk', base: 0 } },

  // ── Rama 6: Arriba-derecha (paso +1 col, -1 row) ────────────────
  { id: 'n6_1', label: '', icon: 'ellipse-outline', num: 26, small: true, topLabel: 'DEX',
    col: 11, row: 4,  requires: ['c0'],   effect: { type: 'evasion', base: 1 } },
  { id: 'n6_2', label: '', icon: 'ellipse-outline', num: 27,
    col: 12, row: 3,  requires: ['n6_1'], effect: { type: 'atk', base: 0 } },
  { id: 'n6_3', label: '', icon: 'ellipse-outline', num: 28,
    col: 13, row: 2,  requires: ['n6_2'], effect: { type: 'atk', base: 0 } },
  { id: 'n6_4', label: '', icon: 'ellipse-outline', num: 29,
    col: 14, row: 1,  requires: ['n6_3'], effect: { type: 'atk', base: 0 } },
  { id: 'n6_5', label: '', icon: 'ellipse-outline', num: 30,
    col: 15, row: 0,  requires: ['n6_4'], effect: { type: 'atk', base: 0 } },

  // ── Sub-ramas desde el nodo 2 de cada rama · direcciones orgánicas ───────────

  // n1_2 (14,5) → sub-A: gira arriba luego derecha · sub-B: gira abajo luego izquierda
  { id: 's1a1', label: '', icon: 'ellipse-outline', num: 31, small: true,
    col: 15, row: 4,  requires: ['n1_2'], effect: { type: 'atk', base: 0 } },
  { id: 's1a2', label: '', icon: 'ellipse-outline', num: 32,
    col: 16, row: 4,  requires: ['s1a1'], effect: { type: 'atk', base: 0 } },
  { id: 's1a3', label: '', icon: 'ellipse-outline', num: 33,
    col: 17, row: 3,  requires: ['s1a2'], effect: { type: 'atk', base: 0 } },
  { id: 's1b1', label: '', icon: 'ellipse-outline', num: 34,
    col: 15, row: 6,  requires: ['n1_2'], effect: { type: 'atk', base: 0 } },
  { id: 's1b2', label: '', icon: 'ellipse-outline', num: 35, small: true,
    col: 15, row: 7,  requires: ['s1b1'], effect: { type: 'atk', base: 0 } },
  { id: 's1b3', label: '', icon: 'ellipse-outline', num: 36,
    col: 16, row: 8,  requires: ['s1b2'], effect: { type: 'atk', base: 0 } },

  // n2_2 (12,7) → sub-A: derecha luego gira abajo · sub-B: abajo luego gira izquierda
  { id: 's2a1', label: '', icon: 'ellipse-outline', num: 37, small: true,
    col: 13, row: 7,  requires: ['n2_2'], effect: { type: 'atk', base: 0 } },
  { id: 's2a2', label: '', icon: 'ellipse-outline', num: 38,
    col: 14, row: 7,  requires: ['s2a1'], effect: { type: 'atk', base: 0 } },
  { id: 's2a3', label: '', icon: 'ellipse-outline', num: 39,
    col: 14, row: 8,  requires: ['s2a2'], effect: { type: 'atk', base: 0 } },
  { id: 's2b1', label: '', icon: 'ellipse-outline', num: 40,
    col: 12, row: 8,  requires: ['n2_2'], effect: { type: 'atk', base: 0 } },
  { id: 's2b2', label: '', icon: 'ellipse-outline', num: 41, small: true,
    col: 11, row: 9,  requires: ['s2b1'], effect: { type: 'atk', base: 0 } },
  { id: 's2b3', label: '', icon: 'ellipse-outline', num: 42,
    col: 11, row: 10, requires: ['s2b2'], effect: { type: 'atk', base: 0 } },

  // n3_2 (8,7) → sub-A: izquierda luego gira abajo · sub-B: abajo luego gira derecha
  { id: 's3a1', label: '', icon: 'ellipse-outline', num: 43, small: true,
    col: 7,  row: 7,  requires: ['n3_2'], effect: { type: 'atk', base: 0 } },
  { id: 's3a2', label: '', icon: 'ellipse-outline', num: 44,
    col: 6,  row: 7,  requires: ['s3a1'], effect: { type: 'atk', base: 0 } },
  { id: 's3a3', label: '', icon: 'ellipse-outline', num: 45,
    col: 6,  row: 8,  requires: ['s3a2'], effect: { type: 'atk', base: 0 } },
  { id: 's3b1', label: '', icon: 'ellipse-outline', num: 46,
    col: 8,  row: 8,  requires: ['n3_2'], effect: { type: 'atk', base: 0 } },
  { id: 's3b2', label: '', icon: 'ellipse-outline', num: 47, small: true,
    col: 9,  row: 9,  requires: ['s3b1'], effect: { type: 'atk', base: 0 } },
  { id: 's3b3', label: '', icon: 'ellipse-outline', num: 48,
    col: 9,  row: 10, requires: ['s3b2'], effect: { type: 'atk', base: 0 } },

  // n4_2 (6,5) → sub-A: sube luego gira izquierda · sub-B: baja luego gira izquierda
  { id: 's4a1', label: '', icon: 'ellipse-outline', num: 49, small: true,
    col: 5,  row: 4,  requires: ['n4_2'], effect: { type: 'atk', base: 0 } },
  { id: 's4a2', label: '', icon: 'ellipse-outline', num: 50,
    col: 5,  row: 3,  requires: ['s4a1'], effect: { type: 'atk', base: 0 } },
  { id: 's4a3', label: '', icon: 'ellipse-outline', num: 51,
    col: 4,  row: 3,  requires: ['s4a2'], effect: { type: 'atk', base: 0 } },
  { id: 's4b1', label: '', icon: 'ellipse-outline', num: 52,
    col: 5,  row: 6,  requires: ['n4_2'], effect: { type: 'atk', base: 0 } },
  { id: 's4b2', label: '', icon: 'ellipse-outline', num: 53, small: true,
    col: 4,  row: 6,  requires: ['s4b1'], effect: { type: 'atk', base: 0 } },
  { id: 's4b3', label: '', icon: 'ellipse-outline', num: 54,
    col: 4,  row: 7,  requires: ['s4b2'], effect: { type: 'atk', base: 0 } },

  // n5_2 (8,3) → sub-A: izquierda luego gira arriba · sub-B: arriba luego gira derecha
  { id: 's5a1', label: '', icon: 'ellipse-outline', num: 55, small: true,
    col: 7,  row: 3,  requires: ['n5_2'], effect: { type: 'atk', base: 0 } },
  { id: 's5a2', label: '', icon: 'ellipse-outline', num: 56,
    col: 6,  row: 3,  requires: ['s5a1'], effect: { type: 'atk', base: 0 } },
  { id: 's5a3', label: '', icon: 'ellipse-outline', num: 57,
    col: 6,  row: 2,  requires: ['s5a2'], effect: { type: 'atk', base: 0 } },
  { id: 's5b1', label: '', icon: 'ellipse-outline', num: 58,
    col: 8,  row: 2,  requires: ['n5_2'], effect: { type: 'atk', base: 0 } },
  { id: 's5b2', label: '', icon: 'ellipse-outline', num: 59, small: true,
    col: 9,  row: 2,  requires: ['s5b1'], effect: { type: 'atk', base: 0 } },
  { id: 's5b3', label: '', icon: 'ellipse-outline', num: 60,
    col: 9,  row: 1,  requires: ['s5b2'], effect: { type: 'atk', base: 0 } },

  // n6_2 (12,3) → sub-A: arriba luego gira izquierda · sub-B: derecha luego gira abajo
  { id: 's6a1', label: '', icon: 'ellipse-outline', num: 61, small: true,
    col: 12, row: 2,  requires: ['n6_2'], effect: { type: 'atk', base: 0 } },
  { id: 's6a2', label: '', icon: 'ellipse-outline', num: 62,
    col: 11, row: 2,  requires: ['s6a1'], effect: { type: 'atk', base: 0 } },
  { id: 's6a3', label: '', icon: 'ellipse-outline', num: 63,
    col: 11, row: 1,  requires: ['s6a2'], effect: { type: 'atk', base: 0 } },
  { id: 's6b1', label: '', icon: 'ellipse-outline', num: 64,
    col: 13, row: 3,  requires: ['n6_2'], effect: { type: 'atk', base: 0 } },
  { id: 's6b2', label: '', icon: 'ellipse-outline', num: 65, small: true,
    col: 14, row: 3,  requires: ['s6b1'], effect: { type: 'atk', base: 0 } },
  { id: 's6b3', label: '', icon: 'ellipse-outline', num: 66,
    col: 14, row: 4,  requires: ['s6b2'], effect: { type: 'atk', base: 0 } },
];

// ── Habilidades de fuego (disponibles sin desbloquear) ────────────────────────

export const TALENT_NODES_FIRE: TalentNodeConfig[] = [
  {
    id: 'small_fire', label: 'Fuego\nPequeño', icon: 'bonfire-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 5, ability: 'small_fire' },
  },
  {
    id: 'fire_flower', label: 'Flor de\nFuego', icon: 'rose-outline',
    col: 1, row: 0, requires: [],
    effect: { type: 'ability', base: 8, ability: 'fire_flower' },
  },
  {
    id: 'fire_pillar', label: 'Pilar de\nFuego', icon: 'arrow-up-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'ability', base: 12, ability: 'fire_pillar' },
  },
  {
    id: 'fire_shield', label: 'Escudo\nde Fuego', icon: 'shield-half-outline',
    col: 3, row: 0, requires: [],
    effect: { type: 'ability', base: 8, ability: 'fire_shield' },
  },
  {
    id: 'lava_paddle', label: 'Paleta\nde Lava', icon: 'golf-outline',
    col: 4, row: 0, requires: [],
    effect: { type: 'ability', base: 10, ability: 'lava_paddle' },
  },
  {
    id: 'fireball', label: 'Bola de\nFuego', icon: 'flame-outline',
    col: 0, row: 1, requires: [],
    effect: { type: 'ability', base: 15, ability: 'fireball' },
  },
  {
    id: 'fire_hurricane', label: 'Huracán\nde Fuego', icon: 'reload-circle-outline',
    col: 1, row: 1, requires: [],
    effect: { type: 'ability', base: 18, ability: 'fire_hurricane' },
  },
  {
    id: 'lava_drop', label: 'Gota de\nLava', icon: 'rainy-outline',
    col: 2, row: 1, requires: [],
    effect: { type: 'ability', base: 15, ability: 'lava_drop' },
  },
  {
    id: 'magma_geyser', label: 'Géiser de\nMagma', icon: 'nuclear-outline',
    col: 3, row: 1, requires: [],
    effect: { type: 'ability', base: 20, ability: 'magma_geyser' },
  },
  {
    id: 'phoenix', label: 'Fénix', icon: 'sunny-outline',
    col: 4, row: 1, requires: [],
    effect: { type: 'ability', base: 25, ability: 'phoenix' },
  },
];

// ── Habilidades de guerrero (melee — primera pestaña del panel) ───────────────

export const TALENT_NODES_WARRIOR: TalentNodeConfig[] = [
  {
    id: 'warrior_slash', label: 'Tajo de\nGuerrero', icon: 'flash-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 18, ability: 'warrior_slash', school: 'physical' },
  },
  {
    id: 'warrior_slash_2', label: 'Tajo de\nGuerrero II', icon: 'flash-outline',
    col: 1, row: 0, requires: [],
    effect: { type: 'ability', base: 20, ability: 'warrior_slash_2', school: 'physical' },
  },
  {
    id: 'warrior_slash_3', label: 'Tajo de\nGuerrero III', icon: 'flash-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'ability', base: 22, ability: 'warrior_slash_3', school: 'physical' },
  },
  {
    id: 'warrior_slash_4', label: 'Tajo de\nGuerrero IV', icon: 'flash-outline',
    col: 3, row: 0, requires: [],
    effect: { type: 'ability', base: 24, ability: 'warrior_slash_4', school: 'physical' },
  },
  {
    id: 'warrior_slash_5', label: 'Tajo de\nGuerrero V', icon: 'flash-outline',
    col: 4, row: 0, requires: [],
    effect: { type: 'ability', base: 26, ability: 'warrior_slash_5', school: 'physical' },
  },
];

// ── Habilidades de agua (disponibles sin desbloquear) ─────────────────────────

export const TALENT_NODES_WATER: TalentNodeConfig[] = [
  {
    id: 'water_drop', label: 'Gota de\nAgua', icon: 'rainy-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 5, ability: 'water_drop' },
  },
  {
    id: 'ice_crystal', label: 'Cristal\nde Hielo', icon: 'diamond-outline',
    col: 1, row: 0, requires: [],
    effect: { type: 'ability', base: 8, ability: 'ice_crystal' },
  },
  {
    id: 'water_geyser', label: 'Géiser\nde Agua', icon: 'water-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'ability', base: 10, ability: 'water_geyser' },
  },
  {
    id: 'snowflake', label: 'Copo de\nNieve', icon: 'flower-outline',
    col: 3, row: 0, requires: [],
    effect: { type: 'ability', base: 10, ability: 'snowflake' },
  },
  {
    id: 'water_splash', label: 'Salpicadura', icon: 'planet-outline',
    col: 4, row: 0, requires: [],
    effect: { type: 'ability', base: 18, ability: 'water_splash' },
  },
  {
    id: 'ice_spike', label: 'Pico\nde Hielo', icon: 'triangle-outline',
    col: 0, row: 1, requires: [],
    effect: { type: 'ability', base: 12, ability: 'ice_spike' },
  },
  {
    id: 'waterball', label: 'Bola de\nAgua', icon: 'ellipse-outline',
    col: 1, row: 1, requires: [],
    effect: { type: 'ability', base: 15, ability: 'waterball' },
  },
  {
    id: 'kraken', label: 'Kraken', icon: 'skull-outline',
    col: 2, row: 1, requires: [],
    effect: { type: 'ability', base: 25, ability: 'kraken' },
  },
];

// ── Habilidades de explosión (disponibles sin desbloquear) ───────────────────

export const TALENT_NODES_EXPLOSION: TalentNodeConfig[] = [
  {
    id: 'circle_explosion', label: 'Explosión\nCircular', icon: 'radio-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 10, ability: 'circle_explosion' },
  },
  {
    id: 'explosion', label: 'Explosión', icon: 'flash-outline',
    col: 1, row: 0, requires: [],
    effect: { type: 'ability', base: 15, ability: 'explosion' },
  },
  {
    id: 'explosion_blue_circle', label: 'Explosión\nAzul', icon: 'ellipse-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'ability', base: 12, ability: 'explosion_blue_circle' },
  },
  {
    id: 'explosion_blue_oval', label: 'Óvalo\nExplosivo', icon: 'resize-outline',
    col: 3, row: 0, requires: [],
    effect: { type: 'ability', base: 14, ability: 'explosion_blue_oval' },
  },
  {
    id: 'explosion_gas', label: 'Gas\nExplosivo', icon: 'medical-outline',
    col: 0, row: 1, requires: [],
    effect: { type: 'ability', base: 12, ability: 'explosion_gas' },
  },
  {
    id: 'explosion_gas_circle', label: 'Gas\nCircular', icon: 'disc-outline',
    col: 1, row: 1, requires: [],
    effect: { type: 'ability', base: 18, ability: 'explosion_gas_circle' },
  },
  {
    id: 'explosion_two_colors', label: 'Explosión\nBicolor', icon: 'color-palette-outline',
    col: 2, row: 1, requires: [],
    effect: { type: 'ability', base: 20, ability: 'explosion_two_colors' },
  },
];

// ── Habilidades de humo (disponibles sin desbloquear) ─────────────────────────

export const TALENT_NODES_SMOKER: TalentNodeConfig[] = [
  {
    id: 'cycled_smoke', label: 'Humo\nCíclico', icon: 'refresh-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 5, ability: 'cycled_smoke' },
  },
  {
    id: 'circle_smoke', label: 'Círculo\nde Humo', icon: 'radio-button-off-outline',
    col: 1, row: 0, requires: [],
    effect: { type: 'ability', base: 8, ability: 'circle_smoke' },
  },
  {
    id: 'rising_smoke', label: 'Humo\nAscendente', icon: 'trending-up-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'ability', base: 12, ability: 'rising_smoke' },
  },
  {
    id: 'cycled_smoke_long', label: 'Humo\nProlongado', icon: 'repeat-outline',
    col: 3, row: 0, requires: [],
    effect: { type: 'ability', base: 10, ability: 'cycled_smoke_long' },
  },
  {
    id: 'falling_smoke', label: 'Humo\nCaído', icon: 'arrow-down-outline',
    col: 4, row: 0, requires: [],
    effect: { type: 'ability', base: 14, ability: 'falling_smoke' },
  },
  {
    id: 'horisontal_smoke', label: 'Humo\nHorizontal', icon: 'remove-outline',
    col: 0, row: 1, requires: [],
    effect: { type: 'ability', base: 10, ability: 'horisontal_smoke' },
  },
  {
    id: 'curved_smoke', label: 'Humo\nCurvo', icon: 'git-branch-outline',
    col: 1, row: 1, requires: [],
    effect: { type: 'ability', base: 12, ability: 'curved_smoke' },
  },
  {
    id: 'smoke_ghost', label: 'Fantasma\nde Humo', icon: 'cloud-outline',
    col: 2, row: 1, requires: [],
    effect: { type: 'ability', base: 20, ability: 'smoke_ghost' },
  },
];

// ── Humo (assets nuevos — pestaña "Humo" del panel) ───────────────────────────

export const TALENT_NODES_SMOKE: TalentNodeConfig[] = [
  {
    id: 'smoke_1', label: 'Humo I', icon: 'cloud-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 8, ability: 'smoke_1' },
  },
  {
    id: 'smoke_2', label: 'Humo II', icon: 'cloud-outline',
    col: 1, row: 0, requires: [],
    effect: { type: 'ability', base: 10, ability: 'smoke_2' },
  },
  {
    id: 'smoke_3', label: 'Humo III', icon: 'cloud-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'ability', base: 12, ability: 'smoke_3' },
  },
  {
    id: 'smoke_4', label: 'Humo IV', icon: 'cloud-outline',
    col: 3, row: 0, requires: [],
    effect: { type: 'ability', base: 14, ability: 'smoke_4' },
  },
];

// ── Fuego (assets nuevos — pestaña "Fuego" del panel) ─────────────────────────

export const TALENT_NODES_FLAME: TalentNodeConfig[] = [
  {
    id: 'fire_1', label: 'Fuego I', icon: 'flame-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 12, ability: 'fire_1' },
  },
  {
    id: 'fire_2', label: 'Fuego II', icon: 'flame-outline',
    col: 1, row: 0, requires: [],
    effect: { type: 'ability', base: 15, ability: 'fire_2' },
  },
  {
    id: 'fire_3', label: 'Fuego III', icon: 'flame-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'ability', base: 18, ability: 'fire_3' },
  },
];

// ── Sangre (assets nuevos — pestaña "Sangre" del panel) ───────────────────────

export const TALENT_NODES_BLOOD: TalentNodeConfig[] = [
  {
    id: 'blood_1', label: 'Sangre I', icon: 'water-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 16, ability: 'blood_1' },
  },
  {
    id: 'blood_2', label: 'Sangre II', icon: 'water-outline',
    col: 1, row: 0, requires: [],
    effect: { type: 'ability', base: 12, ability: 'blood_2' },
  },
];

// ── Habilidades físicas (disponibles sin desbloquear) ─────────────────────────

export const TALENT_NODES_PHYSICAL: TalentNodeConfig[] = [
  {
    id: 'dash', label: 'Dash', icon: 'flash-outline',
    col: 0, row: 0, requires: [],
    effect: { type: 'ability', base: 0, ability: 'dash', school: 'physical' },
  },
];

// ── Registro global (todos los árboles) ──────────────────────────────────────

const ALL_NODES = [...TALENT_NODES, ...TALENT_NODES_WARRIOR, ...TALENT_NODES_SMOKE, ...TALENT_NODES_FLAME, ...TALENT_NODES_BLOOD, ...TALENT_NODES_FIRE, ...TALENT_NODES_WATER, ...TALENT_NODES_SMOKER, ...TALENT_NODES_EXPLOSION, ...TALENT_NODES_PHYSICAL];

@Injectable({ providedIn: 'root' })
export class TalentService {

  readonly nodes   = ALL_NODES;
  /** Pool global de esferas del personaje (compartido entre los 3 builds) */
  readonly ownedSpheres: Record<SphereType, number>   = { ...DEFAULT_OWNED_SPHERES };
  /** Nodos desbloqueados en el build activo */
  readonly unlocked: Record<string, boolean>          = {};
  /** Esfera puesta en cada nodo del build activo */
  readonly slotted: Record<string, SphereType | null> = {};
  readonly changes$ = new Subject<void>();

  private readonly nodeById = new Map(ALL_NODES.map(n => [n.id, n]));

  // ── Loadouts: 3 configuraciones por personaje, ligadas a los sets de equipo ──
  // La config activa vive en `unlocked`/`slotted` (estado de trabajo); las demás,
  // como snapshots guardados. `ownedSpheres` es global a las tres.
  activeLoadout = 0;
  private storedSets: (TalentSnapshot | null)[] = [null, null, null];

  constructor(private playerState: PlayerStateService, private admin: AdminService) {
    for (const n of ALL_NODES) { this.slotted[n.id] = null; this.unlocked[n.id] = false; }
    this.ensureBaseUnlocks();
  }

  /** El nodo central siempre está desbloqueado (consume el punto del nivel 1). */
  private ensureBaseUnlocks(): void {
    if (this.nodeById.has(ROOT_NODE_ID)) this.unlocked[ROOT_NODE_ID] = true;
  }

  /** Cambia la config activa: guarda la actual y restaura la elegida.
   *  changes$ (vía restoreFromSnapshot) propaga el cambio a stats y auto-save. */
  switchLoadout(index: number): void {
    if (index === this.activeLoadout || index < 0 || index >= TALENT_LOADOUT_COUNT) return;
    this.storedSets[this.activeLoadout] = this.getSnapshot();
    this.activeLoadout = index;
    this.restoreFromSnapshot(this.storedSets[index]);
  }

  /** Para persistir: las 3 configs con la activa leída del estado vivo + pool global */
  getLoadoutsSnapshot(): TalentLoadouts {
    const sets = this.storedSets.map((s, i) =>
      i === this.activeLoadout ? this.getSnapshot() : (s ? this.cloneSnapshot(s) : null),
    );
    return { active: this.activeLoadout, sets, ownedSpheres: { ...this.ownedSpheres } };
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
      this.setOwnedSpheres(data.ownedSpheres);
    } else {
      this.storedSets = Array.from({ length: TALENT_LOADOUT_COUNT }, () =>
        legacy ? this.cloneSnapshot(legacy) : null,
      );
      this.activeLoadout = 0;
      // Save legacy: el pool global no existía. Arranca con el default.
      this.setOwnedSpheres(legacy?.spheres);
    }
    this.restoreFromSnapshot(this.storedSets[this.activeLoadout]);
    // El pool nunca puede ser menor que lo ya puesto en los builds.
    this.reconcileOwnedFloor();
  }

  private setOwnedSpheres(owned: Record<SphereType, number> | null | undefined): void {
    for (const t of SPHERE_TYPES) {
      this.ownedSpheres[t] = owned?.[t] ?? DEFAULT_OWNED_SPHERES[t];
    }
  }

  /** Garantiza que el pool ≥ esferas ya gastadas en los 3 builds (saves viejos). */
  private reconcileOwnedFloor(): void {
    for (const t of SPHERE_TYPES) {
      this.ownedSpheres[t] = Math.max(this.ownedSpheres[t], this.spheresUsed(t));
    }
  }

  /** Normaliza un snapshot crudo (deriva `unlocked` en saves viejos). */
  private cloneSnapshot(snap: TalentSnapshot): TalentSnapshot {
    const nodes = { ...snap.nodes };
    const unlocked = snap.unlocked ? { ...snap.unlocked } : this.deriveUnlocked(nodes);
    return { unlocked, nodes };
  }

  /** Migración: reconstruye los desbloqueos de un save viejo a partir de las
   *  esferas puestas (un nodo con esfera y todos sus ancestros estaban desbloqueados). */
  private deriveUnlocked(slotted: Record<string, SphereType | null>): Record<string, boolean> {
    const unlocked: Record<string, boolean> = {};
    const markWithAncestors = (id: string) => {
      const node = this.nodeById.get(id);
      if (!node || unlocked[id]) return;
      unlocked[id] = true;
      node.requires.forEach(markWithAncestors);
    };
    for (const id in slotted) if (slotted[id]) markWithAncestors(id);
    if (this.nodeById.has(ROOT_NODE_ID)) unlocked[ROOT_NODE_ID] = true;
    return unlocked;
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

  // ── Desbloqueo de nodos ──────────────────────────────────────────────────────

  /** En modo admin todo cuenta como desbloqueado (todo visible + todos los bonos).
   *  El estado REAL vive en `this.unlocked` (lo usan puntos, isReachable, lock/unlock). */
  isUnlocked(nodeId: string): boolean {
    return this.admin.isAdmin || !!this.unlocked[nodeId];
  }

  /** Alcanzable: aún sin desbloquear pero con los padres ya desbloqueados.
   *  (Ignora los puntos — sirve para abrir la ventana y mostrar el botón.) */
  isReachable(nodeId: string): boolean {
    if (this.unlocked[nodeId]) return false;
    const node = this.nodeById.get(nodeId);
    if (!node) return false;
    return node.requires.every(r => this.unlocked[r]);
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

  /** Hijos directos ya desbloqueados (bloquean el re-encerrado del padre). */
  hasUnlockedDependents(nodeId: string): boolean {
    return this.nodes.some(n => n.requires.includes(nodeId) && this.unlocked[n.id]);
  }

  /** Re-encerrar para recuperar el punto: nunca el central, sin hijos desbloqueados
   *  y sin esfera puesta. */
  canLock(nodeId: string): boolean {
    return nodeId !== ROOT_NODE_ID &&
           !!this.unlocked[nodeId] &&
           !this.slotted[nodeId] &&
           !this.hasUnlockedDependents(nodeId);
  }

  lock(nodeId: string): void {
    if (!this.canLock(nodeId)) return;
    this.unlocked[nodeId] = false;
    this.changes$.next();
  }

  // ── Esferas (pool global) ────────────────────────────────────────────────────

  /** Esferas de un tipo puestas en TODOS los builds (activo + guardados). */
  private spheresUsed(type: SphereType): number {
    let used = 0;
    for (const id in this.slotted) if (this.slotted[id] === type) used++;
    this.storedSets.forEach((set, i) => {
      if (i === this.activeLoadout || !set) return;
      for (const id in set.nodes) if (set.nodes[id] === type) used++;
    });
    return used;
  }

  /** Esferas de un tipo disponibles en el pool (owned − usadas en todos los builds). */
  spheresAvailable(type: SphereType): number {
    return Math.max(0, this.ownedSpheres[type] - this.spheresUsed(type));
  }

  slot(nodeId: string, sphere: SphereType): void {
    if (!this.isUnlocked(nodeId)) return;
    if (this.slotted[nodeId] === sphere) return;
    // Si reemplazamos, la esfera previa vuelve al pool; valida la nueva.
    if (this.spheresAvailable(sphere) <= 0) return;
    this.slotted[nodeId] = sphere;
    this.changes$.next();
  }

  unslot(nodeId: string): void {
    if (!this.slotted[nodeId]) return;
    this.slotted[nodeId] = null;
    this.changes$.next();
  }

  getBonus(): { atk: number; magicAtk: number; hp: number; mp: number; defense: number; evasion: number; critChance: number; hpRegen: number; mpRegen: number; dropRate: number; abilities: string[] } {
    let atk = 0, magicAtk = 0, hp = 0, mp = 0, defense = 0, evasion = 0, critChance = 0, hpRegen = 0, mpRegen = 0, dropRate = 0;
    const abilities: string[] = [];
    for (const node of this.nodes) {
      // Solo cuentan los nodos desbloqueados (admin = todos). Sin gema → ×1 (valor base);
      // con gema → ×SPHERE_MULT (verde 2 / azul 3 / épica 5).
      if (!this.isUnlocked(node.id)) continue;
      const sphere = this.slotted[node.id];
      const mult = sphere ? SPHERE_MULT[sphere] : 1;
      const value = node.effect.base * mult;
      if (node.effect.type === 'atk') {
        atk += value;
      } else if (node.effect.type === 'magicAtk') {
        magicAtk += value;
      } else if (node.effect.type === 'hp') {
        hp += value;
      } else if (node.effect.type === 'mp') {
        mp += value;
      } else if (node.effect.type === 'defense') {
        defense += value;
      } else if (node.effect.type === 'evasion') {
        evasion += value;
      } else if (node.effect.type === 'critChance') {
        critChance += value;
      } else if (node.effect.type === 'hpRegen') {
        hpRegen += value;
      } else if (node.effect.type === 'mpRegen') {
        mpRegen += value;
      } else if (node.effect.type === 'dropRate') {
        dropRate += value;
      } else if (node.effect.type === 'ability') {
        // El base de la habilidad suma a su escuela: físico (guerrero) o mágico (elementales, por defecto).
        if ((node.effect.school ?? 'magic') === 'physical') atk += value;
        else magicAtk += value;
        if (node.effect.ability) abilities.push(node.effect.ability);
      }
    }
    return { atk, magicAtk, hp, mp, defense, evasion, critChance, hpRegen, mpRegen, dropRate, abilities };
  }

  getSnapshot(): TalentSnapshot {
    return {
      unlocked: { ...this.unlocked },
      nodes:    { ...this.slotted },
    };
  }

  restoreFromSnapshot(snap: TalentSnapshot | null): void {
    const norm = snap ? this.cloneSnapshot(snap) : null;
    for (const n of ALL_NODES) {
      this.slotted[n.id]  = norm?.nodes?.[n.id] ?? null;
      this.unlocked[n.id] = !!norm?.unlocked?.[n.id];
    }
    this.ensureBaseUnlocks();
    this.changes$.next();
  }
}
