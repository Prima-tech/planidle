import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { PlayerStateService } from './player-state.service';
import { AdminService } from './admin.service';

export type SphereType = 'normal' | 'rare' | 'epic';

export const SPHERE_TYPES: SphereType[] = ['normal', 'rare', 'epic'];

/** Nodo que siempre está desbloqueado (consume el punto del nivel 1) */
export const ROOT_NODE_ID = 'c0';

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

// ── Árbol de Talentos (centro col=16, row=8 · 145 nodos) ─────────────────────
// 6 ramas temáticas de 8 niveles + 3 sub-ramas cada una (a/b de 5, c de 3), y en
// la cuña entre cada par de ramas vecinas una UNIÓN (requires con 2 padres = AND)
// que abre una mini-rama híbrida de 3 nodos (u16 Duelista, u65 Danzarín, u54
// Archimago, u43 Buscador, u32 Trotamundos, u21 Berserker).
// Horizontales: paso 2 cols · Diagonales: paso 1 col+1 row — espaciado uniforme.
// Grid: cols 0-32, rows 0-18. El canvas se auto-dimensiona (canvasWidth/Height).
// Círculo grande = habilidad equipable; pequeño = atributo.

export const TALENT_NODES: TalentNodeConfig[] = [
  // Centro (hub)
  { id: 'c0', label: '', icon: 'aperture-outline',
    col: 16, row: 8, requires: [], effect: { type: 'atk', base: 0 } },

  // ── Rama 1: Derecha (paso +2 cols) ──────────────────────────────
  { id: 'n1_1', label: 'Fuerza I', icon: 'barbell-outline', num: 1, small: true, topLabel: 'STR',
    col: 18, row: 8, requires: ['c0'],   effect: { type: 'atk', base: 1 } },
  { id: 'n1_2', label: 'Tajo de\nGuerrero III', icon: 'flash-outline', num: 2,
    col: 20, row: 8, requires: ['n1_1'], effect: { type: 'ability', base: 22, ability: 'warrior_slash_3', school: 'physical' } },
  { id: 'n1_3', label: 'Fuerza II', icon: 'barbell-outline', num: 3, small: true,
    col: 22, row: 8, requires: ['n1_2'], effect: { type: 'atk', base: 2 } },
  { id: 'n1_4', label: 'Fuerza III', icon: 'barbell-outline', num: 4, small: true,
    col: 24, row: 8, requires: ['n1_3'], effect: { type: 'atk', base: 2 } },
  { id: 'n1_5', label: 'Tajo de\nGuerrero V', icon: 'flash-outline', num: 5,
    col: 26, row: 8, requires: ['n1_4'], effect: { type: 'ability', base: 26, ability: 'warrior_slash_5', school: 'physical' } },

  // ── Rama 2: Abajo-derecha (paso +1 col, +1 row) ─────────────────
  { id: 'n2_1', label: 'Vitalidad I', icon: 'heart-outline', num: 6, small: true, topLabel: 'VIT',
    col: 17, row: 9,  requires: ['c0'],   effect: { type: 'hp', base: 5 } },
  { id: 'n2_2', label: 'Vitalidad II', icon: 'heart-outline', num: 7, small: true,
    col: 18, row: 10,  requires: ['n2_1'], effect: { type: 'hp', base: 5 } },
  { id: 'n2_3', label: 'Escudo\nde Fuego', icon: 'shield-half-outline', num: 8,
    col: 19, row: 11,  requires: ['n2_2'], effect: { type: 'ability', base: 8, ability: 'fire_shield' } },
  { id: 'n2_4', label: 'Guardia II', icon: 'shield-outline', num: 9, small: true,
    col: 20, row: 12,  requires: ['n2_3'], effect: { type: 'defense', base: 1 } },
  { id: 'n2_5', label: 'Corazón\nde Roble', icon: 'heart-circle-outline', num: 10, small: true,
    col: 21, row: 13, requires: ['n2_4'], effect: { type: 'hp', base: 15 } },

  // ── Rama 3: Abajo-izquierda (paso -1 col, +1 row) ───────────────
  { id: 'n3_1', label: 'Fortuna I', icon: 'sparkles-outline', num: 11, small: true, topLabel: 'CHR',
    col: 15, row: 9,  requires: ['c0'],   effect: { type: 'dropRate', base: 1 } },
  { id: 'n3_2', label: 'Fortuna II', icon: 'sparkles-outline', num: 12, small: true,
    col: 14, row: 10,  requires: ['n3_1'], effect: { type: 'dropRate', base: 1 } },
  { id: 'n3_3', label: 'Fantasma\nde Humo', icon: 'cloud-outline', num: 13,
    col: 13, row: 11,  requires: ['n3_2'], effect: { type: 'ability', base: 20, ability: 'smoke_ghost' } },
  { id: 'n3_4', label: 'Fortuna V', icon: 'sparkles-outline', num: 14, small: true,
    col: 12, row: 12,  requires: ['n3_3'], effect: { type: 'dropRate', base: 2 } },
  { id: 'n3_5', label: 'Bendición\ndel Botín', icon: 'gift-outline', num: 15, small: true,
    col: 11, row: 13, requires: ['n3_4'], effect: { type: 'dropRate', base: 3 } },

  // ── Rama 4: Izquierda (paso -2 cols) ────────────────────────────
  { id: 'n4_1', label: 'Ingenio I', icon: 'bulb-outline', num: 16, small: true, topLabel: 'INT',
    col: 14, row: 8,  requires: ['c0'],   effect: { type: 'magicAtk', base: 1 } },
  { id: 'n4_2', label: 'Ingenio II', icon: 'bulb-outline', num: 17, small: true,
    col: 12, row: 8,  requires: ['n4_1'], effect: { type: 'magicAtk', base: 2 } },
  { id: 'n4_3', label: 'Bola de\nFuego', icon: 'flame-outline', num: 18,
    col: 10, row: 8,  requires: ['n4_2'], effect: { type: 'ability', base: 15, ability: 'fireball' } },
  { id: 'n4_4', label: 'Ingenio III', icon: 'bulb-outline', num: 19, small: true,
    col: 8, row: 8,  requires: ['n4_3'], effect: { type: 'magicAtk', base: 2 } },
  { id: 'n4_5', label: 'Kraken', icon: 'skull-outline', num: 20,
    col: 6, row: 8,  requires: ['n4_4'], effect: { type: 'ability', base: 25, ability: 'kraken' } },

  // ── Rama 5: Arriba-izquierda (paso -1 col, -1 row) ──────────────
  { id: 'n5_1', label: 'Maná I', icon: 'water-outline', num: 21, small: true, topLabel: 'MAG',
    col: 15, row: 7,  requires: ['c0'],   effect: { type: 'mp', base: 5 } },
  { id: 'n5_2', label: 'Maná II', icon: 'water-outline', num: 22, small: true,
    col: 14, row: 6,  requires: ['n5_1'], effect: { type: 'mp', base: 5 } },
  { id: 'n5_3', label: 'Pico\nde Hielo', icon: 'triangle-outline', num: 23,
    col: 13, row: 5,  requires: ['n5_2'], effect: { type: 'ability', base: 12, ability: 'ice_spike' } },
  { id: 'n5_4', label: 'Serenidad II', icon: 'moon-outline', num: 24, small: true,
    col: 12, row: 4,  requires: ['n5_3'], effect: { type: 'mpRegen', base: 2 } },
  { id: 'n5_5', label: 'Pozo de\nManá', icon: 'infinite-outline', num: 25, small: true,
    col: 11, row: 3,  requires: ['n5_4'], effect: { type: 'mp', base: 15 } },

  // ── Rama 6: Arriba-derecha (paso +1 col, -1 row) ────────────────
  { id: 'n6_1', label: 'Reflejos I', icon: 'footsteps-outline', num: 26, small: true, topLabel: 'DEX',
    col: 17, row: 7,  requires: ['c0'],   effect: { type: 'evasion', base: 1 } },
  { id: 'n6_2', label: 'Celeridad I', icon: 'speedometer-outline', num: 27, small: true,
    col: 18, row: 6,  requires: ['n6_1'], effect: { type: 'attackSpeed', base: 2 } },
  { id: 'n6_3', label: 'Dash', icon: 'flash-outline', num: 28,
    col: 19, row: 5,  requires: ['n6_2'], effect: { type: 'ability', base: 0, ability: 'dash', school: 'physical' } },
  { id: 'n6_4', label: 'Reflejos IV', icon: 'footsteps-outline', num: 29, small: true,
    col: 20, row: 4,  requires: ['n6_3'], effect: { type: 'evasion', base: 2 } },
  { id: 'n6_5', label: 'Manos\nde Viento', icon: 'speedometer-outline', num: 30, small: true,
    col: 21, row: 3,  requires: ['n6_4'], effect: { type: 'attackSpeed', base: 5 } },

  // ── Sub-ramas desde el nodo 2 de cada rama · direcciones orgánicas ───────────

  // n1_2 (14,5) → sub-A: gira arriba luego derecha · sub-B: gira abajo luego izquierda
  { id: 's1a1', label: 'Golpe\nCertero', icon: 'locate-outline', num: 31, small: true,
    col: 21, row: 7,  requires: ['n1_2'], effect: { type: 'critChance', base: 1 } },
  { id: 's1a2', label: 'Fuerza IV', icon: 'barbell-outline', num: 32, small: true,
    col: 22, row: 7,  requires: ['s1a1'], effect: { type: 'atk', base: 2 } },
  { id: 's1a3', label: 'Punto\nVital', icon: 'locate-outline', num: 33, small: true,
    col: 23, row: 6,  requires: ['s1a2'], effect: { type: 'critChance', base: 2 } },
  { id: 's1b1', label: 'Eficiencia\nde Minería', icon: 'hammer-outline', num: 34, small: true,
    col: 21, row: 9,  requires: ['n1_2'], effect: { type: 'miningEfficiency', base: 1 } },
  { id: 's1b2', label: 'Doble Botín\nde Minería', icon: 'cube-outline', num: 35, small: true,
    col: 21, row: 10,  requires: ['s1b1'], effect: { type: 'miningDrop', base: 1 } },
  { id: 's1b3', label: 'Minero\nExperto', icon: 'hammer-outline', num: 36, small: true,
    col: 22, row: 11,  requires: ['s1b2'], effect: { type: 'miningEfficiency', base: 2 } },

  // n2_2 (12,7) → sub-A: derecha luego gira abajo · sub-B: abajo luego gira izquierda
  { id: 's2a1', label: 'Sanación I', icon: 'pulse-outline', num: 37, small: true,
    col: 19, row: 10,  requires: ['n2_2'], effect: { type: 'hpRegen', base: 1 } },
  { id: 's2a2', label: 'Vitalidad III', icon: 'heart-outline', num: 38, small: true,
    col: 20, row: 10,  requires: ['s2a1'], effect: { type: 'hp', base: 8 } },
  { id: 's2a3', label: 'Sanación II', icon: 'pulse-outline', num: 39, small: true,
    col: 20, row: 11,  requires: ['s2a2'], effect: { type: 'hpRegen', base: 2 } },
  { id: 's2b1', label: 'Guardia I', icon: 'shield-outline', num: 40, small: true,
    col: 18, row: 11,  requires: ['n2_2'], effect: { type: 'defense', base: 1 } },
  { id: 's2b2', label: 'Vitalidad IV', icon: 'heart-outline', num: 41, small: true,
    col: 17, row: 12,  requires: ['s2b1'], effect: { type: 'hp', base: 8 } },
  { id: 's2b3', label: 'Guardia III', icon: 'shield-outline', num: 42, small: true,
    col: 17, row: 13, requires: ['s2b2'], effect: { type: 'defense', base: 2 } },

  // n3_2 (8,7) → sub-A: izquierda luego gira abajo · sub-B: abajo luego gira derecha
  // Sub-rama de EXPLORACIÓN (Modo Mundo): % de metros extra en expediciones AFK
  { id: 's3a1', label: 'Explorador I', icon: 'compass-outline', num: 43, small: true,
    col: 13, row: 10,  requires: ['n3_2'], effect: { type: 'exploration', base: 5 } },
  { id: 's3a2', label: 'Explorador II', icon: 'compass-outline', num: 44, small: true,
    col: 12, row: 10,  requires: ['s3a1'], effect: { type: 'exploration', base: 5 } },
  { id: 's3a3', label: 'Gran\nExplorador', icon: 'map-outline', num: 45, small: true,
    col: 12, row: 11,  requires: ['s3a2'], effect: { type: 'exploration', base: 10 } },
  { id: 's3b1', label: 'Fortuna III', icon: 'sparkles-outline', num: 46, small: true,
    col: 14, row: 11,  requires: ['n3_2'], effect: { type: 'dropRate', base: 1 } },
  { id: 's3b2', label: 'Fortuna IV', icon: 'sparkles-outline', num: 47, small: true,
    col: 15, row: 12,  requires: ['s3b1'], effect: { type: 'dropRate', base: 1 } },
  { id: 's3b3', label: 'Fortuna VI', icon: 'sparkles-outline', num: 48, small: true,
    col: 15, row: 13, requires: ['s3b2'], effect: { type: 'dropRate', base: 2 } },

  // n4_2 (6,5) → sub-A: sube luego gira izquierda · sub-B: baja luego gira izquierda
  // Sub-rama de ALQUIMIA (creación de pociones — efecto pendiente de implementar)
  { id: 's4a1', label: 'Alquimia I', icon: 'flask-outline', num: 49, small: true,
    col: 11, row: 7,  requires: ['n4_2'], effect: { type: 'alchemy', base: 2 } },
  { id: 's4a2', label: 'Alquimia II', icon: 'flask-outline', num: 50, small: true,
    col: 11, row: 6,  requires: ['s4a1'], effect: { type: 'alchemy', base: 2 } },
  { id: 's4a3', label: 'Gran\nAlquimia', icon: 'beaker-outline', num: 51, small: true,
    col: 10, row: 6,  requires: ['s4a2'], effect: { type: 'alchemy', base: 4 } },
  { id: 's4b1', label: 'Ingenio IV', icon: 'bulb-outline', num: 52, small: true,
    col: 11, row: 9,  requires: ['n4_2'], effect: { type: 'magicAtk', base: 2 } },
  { id: 's4b2', label: 'Meditación', icon: 'moon-outline', num: 53, small: true,
    col: 10, row: 9,  requires: ['s4b1'], effect: { type: 'mpRegen', base: 1 } },
  { id: 's4b3', label: 'Erudito', icon: 'library-outline', num: 54, small: true,
    col: 10, row: 10,  requires: ['s4b2'], effect: { type: 'magicAtk', base: 3 } },

  // n5_2 (8,3) → sub-A: izquierda luego gira arriba · sub-B: arriba luego gira derecha
  { id: 's5a1', label: 'Serenidad I', icon: 'moon-outline', num: 55, small: true,
    col: 13, row: 6,  requires: ['n5_2'], effect: { type: 'mpRegen', base: 1 } },
  { id: 's5a2', label: 'Maná IV', icon: 'water-outline', num: 56, small: true,
    col: 12, row: 6,  requires: ['s5a1'], effect: { type: 'mp', base: 8 } },
  { id: 's5a3', label: 'Serenidad III', icon: 'moon-outline', num: 57, small: true,
    col: 12, row: 5,  requires: ['s5a2'], effect: { type: 'mpRegen', base: 2 } },
  { id: 's5b1', label: 'Maná III', icon: 'water-outline', num: 58, small: true,
    col: 14, row: 5,  requires: ['n5_2'], effect: { type: 'mp', base: 5 } },
  { id: 's5b2', label: 'Foco\nArcano', icon: 'color-wand-outline', num: 59, small: true,
    col: 15, row: 5,  requires: ['s5b1'], effect: { type: 'magicAtk', base: 2 } },
  { id: 's5b3', label: 'Maná V', icon: 'water-outline', num: 60, small: true,
    col: 15, row: 4,  requires: ['s5b2'], effect: { type: 'mp', base: 10 } },

  // n6_2 (12,3) → sub-A: arriba luego gira izquierda · sub-B: derecha luego gira abajo
  { id: 's6a1', label: 'Celeridad II', icon: 'speedometer-outline', num: 61, small: true,
    col: 18, row: 5,  requires: ['n6_2'], effect: { type: 'attackSpeed', base: 1 } },
  { id: 's6a2', label: 'Reflejos II', icon: 'footsteps-outline', num: 62, small: true,
    col: 17, row: 5,  requires: ['s6a1'], effect: { type: 'evasion', base: 1 } },
  { id: 's6a3', label: 'Celeridad III', icon: 'speedometer-outline', num: 63, small: true,
    col: 17, row: 4,  requires: ['s6a2'], effect: { type: 'attackSpeed', base: 2 } },
  { id: 's6b1', label: 'Reflejos III', icon: 'footsteps-outline', num: 64, small: true,
    col: 19, row: 6,  requires: ['n6_2'], effect: { type: 'evasion', base: 1 } },
  { id: 's6b2', label: 'Celeridad IV', icon: 'speedometer-outline', num: 65, small: true,
    col: 20, row: 6,  requires: ['s6b1'], effect: { type: 'attackSpeed', base: 1 } },
  { id: 's6b3', label: 'Reflejos V', icon: 'footsteps-outline', num: 66, small: true,
    col: 20, row: 7,  requires: ['s6b2'], effect: { type: 'evasion', base: 2 } },

  // ═══ Expansión ×2 del árbol ═══════════════════════════════════════════════
  // Cada rama gana: +3 nodos de línea principal (n*_6..8, con 2ª habilidad grande
  // de remate), +2 en cada sub-rama existente (s*a4-5 / s*b4-5) y una tercera
  // sub-rama de 3 (s*c1-3) colgando del nodo 4 de la línea.

  // ── Rama 1 STR: extensión ───────────────────────────────────────
  { id: 'n1_6', label: 'Fuerza V', icon: 'barbell-outline', num: 67, small: true,
    col: 28, row: 8,  requires: ['n1_5'], effect: { type: 'atk', base: 3 } },
  { id: 'n1_7', label: 'Golpe\nBrutal', icon: 'locate-outline', num: 68, small: true,
    col: 30, row: 8,  requires: ['n1_6'], effect: { type: 'critChance', base: 2 } },
  { id: 'n1_8', label: 'Golpe de\nHumo', icon: 'cloud-outline', num: 69,
    col: 32, row: 8,  requires: ['n1_7'], effect: { type: 'ability', base: 28, ability: 'smoke_1', school: 'physical' } },
  { id: 's1a4', label: 'Fuerza VI', icon: 'barbell-outline', num: 70, small: true,
    col: 24, row: 6,  requires: ['s1a3'], effect: { type: 'atk', base: 2 } },
  { id: 's1a5', label: 'Ojo\nLetal', icon: 'locate-outline', num: 71, small: true,
    col: 25, row: 5,  requires: ['s1a4'], effect: { type: 'critChance', base: 2 } },
  { id: 's1b4', label: 'Minero\nVeterano', icon: 'hammer-outline', num: 72, small: true,
    col: 22, row: 12, requires: ['s1b3'], effect: { type: 'miningEfficiency', base: 2 } },
  { id: 's1b5', label: 'Maestro\nMinero', icon: 'hammer-outline', num: 73, small: true,
    col: 23, row: 13, requires: ['s1b4'], effect: { type: 'miningEfficiency', base: 3 } },
  { id: 's1c1', label: 'Fuerza VII', icon: 'barbell-outline', num: 74, small: true,
    col: 25, row: 9,  requires: ['n1_4'], effect: { type: 'atk', base: 2 } },
  { id: 's1c2', label: 'Punto\nDébil', icon: 'locate-outline', num: 75, small: true,
    col: 26, row: 10, requires: ['s1c1'], effect: { type: 'critChance', base: 1 } },
  { id: 's1c3', label: 'Fuerza VIII', icon: 'barbell-outline', num: 76, small: true,
    col: 27, row: 11, requires: ['s1c2'], effect: { type: 'atk', base: 3 } },

  // ── Rama 2 VIT: extensión ───────────────────────────────────────
  { id: 'n2_6', label: 'Vitalidad V', icon: 'heart-outline', num: 77, small: true,
    col: 22, row: 14, requires: ['n2_5'], effect: { type: 'hp', base: 10 } },
  { id: 'n2_7', label: 'Guardia IV', icon: 'shield-outline', num: 78, small: true,
    col: 23, row: 15, requires: ['n2_6'], effect: { type: 'defense', base: 2 } },
  { id: 'n2_8', label: 'Estallido\nde Sangre', icon: 'water-outline', num: 79,
    col: 24, row: 16, requires: ['n2_7'], effect: { type: 'ability', base: 16, ability: 'blood_1' } },
  { id: 's2a4', label: 'Vitalidad VI', icon: 'heart-outline', num: 80, small: true,
    col: 21, row: 11, requires: ['s2a3'], effect: { type: 'hp', base: 10 } },
  { id: 's2a5', label: 'Sanación III', icon: 'pulse-outline', num: 81, small: true,
    col: 21, row: 12, requires: ['s2a4'], effect: { type: 'hpRegen', base: 2 } },
  { id: 's2b4', label: 'Guardia V', icon: 'shield-outline', num: 82, small: true,
    col: 16, row: 14, requires: ['s2b3'], effect: { type: 'defense', base: 2 } },
  { id: 's2b5', label: 'Vitalidad VII', icon: 'heart-outline', num: 83, small: true,
    col: 16, row: 15, requires: ['s2b4'], effect: { type: 'hp', base: 12 } },
  { id: 's2c1', label: 'Robustez', icon: 'body-outline', num: 84, small: true,
    col: 19, row: 13, requires: ['n2_4'], effect: { type: 'hp', base: 8 } },
  { id: 's2c2', label: 'Guardia VI', icon: 'shield-outline', num: 85, small: true,
    col: 19, row: 14, requires: ['s2c1'], effect: { type: 'defense', base: 1 } },
  { id: 's2c3', label: 'Sanación IV', icon: 'pulse-outline', num: 86, small: true,
    col: 19, row: 15, requires: ['s2c2'], effect: { type: 'hpRegen', base: 2 } },

  // ── Rama 3 CHR: extensión ───────────────────────────────────────
  { id: 'n3_6', label: 'Fortuna VII', icon: 'sparkles-outline', num: 87, small: true,
    col: 10, row: 14, requires: ['n3_5'], effect: { type: 'dropRate', base: 2 } },
  { id: 'n3_7', label: 'Explorador III', icon: 'compass-outline', num: 88, small: true,
    col: 9,  row: 15, requires: ['n3_6'], effect: { type: 'exploration', base: 5 } },
  { id: 'n3_8', label: 'Humo\nCurvo', icon: 'git-branch-outline', num: 89,
    col: 8,  row: 16, requires: ['n3_7'], effect: { type: 'ability', base: 12, ability: 'curved_smoke' } },
  { id: 's3a4', label: 'Explorador IV', icon: 'compass-outline', num: 90, small: true,
    col: 11, row: 11, requires: ['s3a3'], effect: { type: 'exploration', base: 5 } },
  { id: 's3a5', label: 'Cartógrafo', icon: 'map-outline', num: 91, small: true,
    col: 10, row: 12, requires: ['s3a4'], effect: { type: 'exploration', base: 10 } },
  { id: 's3b4', label: 'Fortuna VIII', icon: 'sparkles-outline', num: 92, small: true,
    col: 14, row: 14, requires: ['s3b3'], effect: { type: 'dropRate', base: 2 } },
  { id: 's3b5', label: 'Tesorero', icon: 'diamond-outline', num: 93, small: true,
    col: 14, row: 15, requires: ['s3b4'], effect: { type: 'dropRate', base: 3 } },
  { id: 's3c1', label: 'Fortuna IX', icon: 'sparkles-outline', num: 94, small: true,
    col: 12, row: 13, requires: ['n3_4'], effect: { type: 'dropRate', base: 1 } },
  { id: 's3c2', label: 'Explorador V', icon: 'compass-outline', num: 95, small: true,
    col: 11, row: 14, requires: ['s3c1'], effect: { type: 'exploration', base: 5 } },
  { id: 's3c3', label: 'Fortuna X', icon: 'sparkles-outline', num: 96, small: true,
    col: 11, row: 15, requires: ['s3c2'], effect: { type: 'dropRate', base: 2 } },

  // ── Rama 4 INT: extensión ───────────────────────────────────────
  { id: 'n4_6', label: 'Ingenio V', icon: 'bulb-outline', num: 97, small: true,
    col: 4,  row: 8,  requires: ['n4_5'], effect: { type: 'magicAtk', base: 3 } },
  { id: 'n4_7', label: 'Erudito II', icon: 'library-outline', num: 98, small: true,
    col: 2,  row: 8,  requires: ['n4_6'], effect: { type: 'magicAtk', base: 3 } },
  { id: 'n4_8', label: 'Huracán\nde Fuego', icon: 'reload-circle-outline', num: 99,
    col: 0,  row: 8,  requires: ['n4_7'], effect: { type: 'ability', base: 18, ability: 'fire_hurricane' } },
  { id: 's4a4', label: 'Alquimia III', icon: 'flask-outline', num: 100, small: true,
    col: 9,  row: 5,  requires: ['s4a3'], effect: { type: 'alchemy', base: 2 } },
  { id: 's4a5', label: 'Maestro\nAlquimista', icon: 'beaker-outline', num: 101, small: true,
    col: 8,  row: 4,  requires: ['s4a4'], effect: { type: 'alchemy', base: 5 } },
  { id: 's4b4', label: 'Ingenio VI', icon: 'bulb-outline', num: 102, small: true,
    col: 9,  row: 11, requires: ['s4b3'], effect: { type: 'magicAtk', base: 2 } },
  { id: 's4b5', label: 'Sabio', icon: 'library-outline', num: 103, small: true,
    col: 8,  row: 12, requires: ['s4b4'], effect: { type: 'magicAtk', base: 4 } },
  { id: 's4c1', label: 'Reserva\nArcana', icon: 'water-outline', num: 104, small: true,
    col: 7,  row: 7,  requires: ['n4_4'], effect: { type: 'mp', base: 8 } },
  { id: 's4c2', label: 'Meditación II', icon: 'moon-outline', num: 105, small: true,
    col: 6,  row: 6,  requires: ['s4c1'], effect: { type: 'mpRegen', base: 2 } },
  { id: 's4c3', label: 'Ingenio VII', icon: 'bulb-outline', num: 106, small: true,
    col: 5,  row: 5,  requires: ['s4c2'], effect: { type: 'magicAtk', base: 3 } },

  // ── Rama 5 MAG: extensión ───────────────────────────────────────
  { id: 'n5_6', label: 'Maná VI', icon: 'water-outline', num: 107, small: true,
    col: 10, row: 2,  requires: ['n5_5'], effect: { type: 'mp', base: 10 } },
  { id: 'n5_7', label: 'Serenidad V', icon: 'moon-outline', num: 108, small: true,
    col: 9,  row: 1,  requires: ['n5_6'], effect: { type: 'mpRegen', base: 2 } },
  { id: 'n5_8', label: 'Bola de\nAgua', icon: 'ellipse-outline', num: 109,
    col: 8,  row: 0,  requires: ['n5_7'], effect: { type: 'ability', base: 15, ability: 'waterball' } },
  { id: 's5a4', label: 'Maná VII', icon: 'water-outline', num: 110, small: true,
    col: 11, row: 4,  requires: ['s5a3'], effect: { type: 'mp', base: 8 } },
  { id: 's5a5', label: 'Serenidad IV', icon: 'moon-outline', num: 111, small: true,
    col: 10, row: 3,  requires: ['s5a4'], effect: { type: 'mpRegen', base: 2 } },
  { id: 's5b4', label: 'Foco\nArcano II', icon: 'color-wand-outline', num: 112, small: true,
    col: 16, row: 3,  requires: ['s5b3'], effect: { type: 'magicAtk', base: 2 } },
  { id: 's5b5', label: 'Maná VIII', icon: 'water-outline', num: 113, small: true,
    col: 16, row: 2,  requires: ['s5b4'], effect: { type: 'mp', base: 10 } },
  { id: 's5c1', label: 'Maná IX', icon: 'water-outline', num: 114, small: true,
    col: 13, row: 3,  requires: ['n5_4'], effect: { type: 'mp', base: 8 } },
  { id: 's5c2', label: 'Serenidad VI', icon: 'moon-outline', num: 115, small: true,
    col: 13, row: 2,  requires: ['s5c1'], effect: { type: 'mpRegen', base: 1 } },
  { id: 's5c3', label: 'Pozo\nProfundo', icon: 'infinite-outline', num: 116, small: true,
    col: 14, row: 1,  requires: ['s5c2'], effect: { type: 'mp', base: 12 } },

  // ── Rama 6 DEX: extensión ───────────────────────────────────────
  { id: 'n6_6', label: 'Celeridad V', icon: 'speedometer-outline', num: 117, small: true,
    col: 22, row: 2,  requires: ['n6_5'], effect: { type: 'attackSpeed', base: 2 } },
  { id: 'n6_7', label: 'Reflejos VI', icon: 'footsteps-outline', num: 118, small: true,
    col: 23, row: 1,  requires: ['n6_6'], effect: { type: 'evasion', base: 2 } },
  { id: 'n6_8', label: 'Golpe\nVeloz', icon: 'flash-outline', num: 119,
    col: 24, row: 0,  requires: ['n6_7'], effect: { type: 'ability', base: 20, ability: 'smoke_2', school: 'physical' } },
  { id: 's6a4', label: 'Celeridad VI', icon: 'speedometer-outline', num: 120, small: true,
    col: 17, row: 3,  requires: ['s6a3'], effect: { type: 'attackSpeed', base: 1 } },
  { id: 's6a5', label: 'Reflejos VII', icon: 'footsteps-outline', num: 121, small: true,
    col: 17, row: 2,  requires: ['s6a4'], effect: { type: 'evasion', base: 1 } },
  { id: 's6b4', label: 'Reflejos VIII', icon: 'footsteps-outline', num: 122, small: true,
    col: 21, row: 6,  requires: ['s6b3'], effect: { type: 'evasion', base: 1 } },
  { id: 's6b5', label: 'Celeridad VII', icon: 'speedometer-outline', num: 123, small: true,
    col: 22, row: 5,  requires: ['s6b4'], effect: { type: 'attackSpeed', base: 2 } },
  { id: 's6c1', label: 'Celeridad VIII', icon: 'speedometer-outline', num: 124, small: true,
    col: 21, row: 4,  requires: ['n6_4'], effect: { type: 'attackSpeed', base: 1 } },
  { id: 's6c2', label: 'Reflejos IX', icon: 'footsteps-outline', num: 125, small: true,
    col: 22, row: 3,  requires: ['s6c1'], effect: { type: 'evasion', base: 1 } },
  { id: 's6c3', label: 'Manos\nFirmes', icon: 'speedometer-outline', num: 126, small: true,
    col: 23, row: 2,  requires: ['s6c2'], effect: { type: 'attackSpeed', base: 2 } },

  // ═══ Uniones entre ramas adyacentes ═══════════════════════════════════════
  // En la cuña entre cada par de ramas vecinas, un nodo de UNIÓN exige haber
  // llegado por AMBAS (requires con 2 padres = AND en isReachable). De él nace
  // una mini-rama híbrida de 3 nodos que mezcla los aspectos de los dos padres,
  // rematada con una habilidad grande propia del cruce.

  // ── STR + DEX: el Duelista (daño físico + velocidad/crítico) ─────
  { id: 'u16_1', label: 'Duelista', icon: 'speedometer-outline', num: 127, small: true,
    col: 24, row: 4,  requires: ['s1a5', 's6b5'], effect: { type: 'attackSpeed', base: 2 } },
  { id: 'u16_2', label: 'Filo\nPreciso', icon: 'locate-outline', num: 128, small: true,
    col: 25, row: 3,  requires: ['u16_1'], effect: { type: 'critChance', base: 2 } },
  { id: 'u16_3', label: 'Tajo de\nGuerrero IV', icon: 'flash-outline', num: 129,
    col: 26, row: 2,  requires: ['u16_2'], effect: { type: 'ability', base: 24, ability: 'warrior_slash_4', school: 'physical' } },

  // ── DEX + MAG: el Danzarín Etéreo (evasión + maná) ────────────────
  { id: 'u65_1', label: 'Paso\nEtéreo', icon: 'footsteps-outline', num: 130, small: true,
    col: 17, row: 1,  requires: ['s6a5', 's5b5'], effect: { type: 'evasion', base: 2 } },
  { id: 'u65_2', label: 'Fluidez', icon: 'water-outline', num: 131, small: true,
    col: 18, row: 1,  requires: ['u65_1'], effect: { type: 'mp', base: 8 } },
  { id: 'u65_3', label: 'Cristal\nde Hielo', icon: 'diamond-outline', num: 132,
    col: 19, row: 0,  requires: ['u65_2'], effect: { type: 'ability', base: 8, ability: 'ice_crystal' } },

  // ── MAG + INT: el Archimago (regen de maná + daño mágico) ─────────
  { id: 'u54_1', label: 'Comunión', icon: 'moon-outline', num: 133, small: true,
    col: 9,  row: 3,  requires: ['s5a5', 's4a5'], effect: { type: 'mpRegen', base: 2 } },
  { id: 'u54_2', label: 'Arcanista', icon: 'color-wand-outline', num: 134, small: true,
    col: 8,  row: 2,  requires: ['u54_1'], effect: { type: 'magicAtk', base: 3 } },
  { id: 'u54_3', label: 'Géiser\nde Agua', icon: 'water-outline', num: 135,
    col: 7,  row: 1,  requires: ['u54_2'], effect: { type: 'ability', base: 10, ability: 'water_geyser' } },

  // ── INT + CHR: el Buscador Arcano (botín + alquimia) ─────────────
  { id: 'u43_1', label: 'Buscador\nArcano', icon: 'sparkles-outline', num: 136, small: true,
    col: 9,  row: 13, requires: ['s4b5', 's3a5'], effect: { type: 'dropRate', base: 2 } },
  { id: 'u43_2', label: 'Pócima\nViajera', icon: 'flask-outline', num: 137, small: true,
    col: 8,  row: 14, requires: ['u43_1'], effect: { type: 'alchemy', base: 3 } },
  { id: 'u43_3', label: 'Gas\nExplosivo', icon: 'medical-outline', num: 138,
    col: 7,  row: 15, requires: ['u43_2'], effect: { type: 'ability', base: 12, ability: 'explosion_gas' } },

  // ── CHR + VIT: el Trotamundos (vida + exploración) ────────────────
  { id: 'u32_1', label: 'Trotamundos', icon: 'body-outline', num: 139, small: true,
    col: 15, row: 16, requires: ['s3b5', 's2b5'], effect: { type: 'hp', base: 8 } },
  { id: 'u32_2', label: 'Nómada', icon: 'compass-outline', num: 140, small: true,
    col: 15, row: 17, requires: ['u32_1'], effect: { type: 'exploration', base: 5 } },
  { id: 'u32_3', label: 'Cortina\nde Humo', icon: 'cloud-outline', num: 141,
    col: 15, row: 18, requires: ['u32_2'], effect: { type: 'ability', base: 14, ability: 'smoke_4', school: 'physical' } },

  // ── VIT + STR: el Berserker (vida + daño físico) ──────────────────
  { id: 'u21_1', label: 'Furia\nVital', icon: 'barbell-outline', num: 142, small: true,
    col: 22, row: 13, requires: ['s2a5', 's1b5'], effect: { type: 'atk', base: 2 } },
  { id: 'u21_2', label: 'Sangre\nGuerrera', icon: 'heart-outline', num: 143, small: true,
    col: 23, row: 14, requires: ['u21_1'], effect: { type: 'hp', base: 10 } },
  { id: 'u21_3', label: 'Fuego\nGuerrero', icon: 'flame-outline', num: 144,
    col: 24, row: 15, requires: ['u21_2'], effect: { type: 'ability', base: 12, ability: 'fire_1', school: 'physical' } },
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

  getBonus(): { atk: number; magicAtk: number; hp: number; mp: number; defense: number; evasion: number; critChance: number; hpRegen: number; mpRegen: number; dropRate: number; miningEfficiency: number; miningDrop: number; attackSpeed: number; exploration: number; alchemy: number; abilities: string[] } {
    let atk = 0, magicAtk = 0, hp = 0, mp = 0, defense = 0, evasion = 0, critChance = 0, hpRegen = 0, mpRegen = 0, dropRate = 0, miningEfficiency = 0, miningDrop = 0, attackSpeed = 0, exploration = 0, alchemy = 0;
    const abilities: string[] = [];
    for (const node of this.nodes) {
      // Solo cuentan los nodos REALMENTE desbloqueados (admin NO suma bonos, solo
      // afecta visibilidad). Sin gema → ×1 (valor base); con gema → ×SPHERE_MULT.
      if (!this.isReallyUnlocked(node.id)) continue;
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
      } else if (node.effect.type === 'miningEfficiency') {
        miningEfficiency += value;
      } else if (node.effect.type === 'miningDrop') {
        miningDrop += value;
      } else if (node.effect.type === 'attackSpeed') {
        attackSpeed += value;
      } else if (node.effect.type === 'exploration') {
        exploration += value;
      } else if (node.effect.type === 'alchemy') {
        alchemy += value;
      } else if (node.effect.type === 'ability') {
        // El base de la habilidad suma a su escuela: físico (guerrero) o mágico (elementales, por defecto).
        if ((node.effect.school ?? 'magic') === 'physical') atk += value;
        else magicAtk += value;
        if (node.effect.ability) abilities.push(node.effect.ability);
      }
    }
    return { atk, magicAtk, hp, mp, defense, evasion, critChance, hpRegen, mpRegen, dropRate, miningEfficiency, miningDrop, attackSpeed, exploration, alchemy, abilities };
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
