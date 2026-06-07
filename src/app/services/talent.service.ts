import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type SphereType = 'common' | 'normal' | 'rare' | 'epic' | 'legendary';

export interface TalentEffect {
  type:     'atk' | 'hp' | 'mp' | 'defense' | 'critChance' | 'ability';
  base:     number;
  ability?: string;
}

export interface TalentNodeConfig {
  id:       string;
  label:    string;
  icon:     string;
  col:      number;
  row:      number;
  requires: string[];
  effect:   TalentEffect;
}

export interface TalentSnapshot {
  spheres: Record<SphereType, number>;
  nodes:   Record<string, SphereType | null>;
}

export const SPHERE_MULT: Record<SphereType, number> = {
  common:    1,
  normal:    2,
  rare:      4,
  epic:      8,
  legendary: 16,
};

const DEFAULT_SPHERES: Record<SphereType, number> = {
  common: 10, normal: 10, rare: 10, epic: 10, legendary: 10,
};

// ── Árbol: Combate ────────────────────────────────────────────────────────────

export const TALENT_NODES: TalentNodeConfig[] = [
  {
    id: 'ataque_normal', label: 'Ataque\nNormal', icon: 'flash-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'atk', base: 3 },
  },
  {
    id: 'guardia', label: 'Guardia', icon: 'hand-left-outline',
    col: 2, row: 1, requires: ['ataque_normal'],
    effect: { type: 'defense', base: 1 },
  },
  {
    id: 'fuerza_bruta', label: 'Fuerza\nBruta', icon: 'barbell-outline',
    col: 0, row: 1, requires: ['ataque_normal'],
    effect: { type: 'atk', base: 5 },
  },
  {
    id: 'vida_robusta', label: 'Vida\nRobusta', icon: 'heart-outline',
    col: 1, row: 1, requires: ['ataque_normal'],
    effect: { type: 'hp', base: 25 },
  },
  {
    id: 'ataque_area', label: 'Ataque\nÁrea', icon: 'radio-outline',
    col: 3, row: 1, requires: ['ataque_normal'],
    effect: { type: 'ability', base: 8, ability: 'area_attack' },
  },
  {
    id: 'ataque_distancia', label: 'Ataque\nLejos', icon: 'send-outline',
    col: 4, row: 1, requires: ['ataque_normal'],
    effect: { type: 'ability', base: 8, ability: 'ranged_attack' },
  },
  {
    id: 'golpe_brutal', label: 'Golpe\nBrutal', icon: 'hammer-outline',
    col: 0, row: 2, requires: ['fuerza_bruta'],
    effect: { type: 'atk', base: 10 },
  },
  {
    id: 'fortaleza', label: 'Fortaleza', icon: 'shield-outline',
    col: 1, row: 2, requires: ['vida_robusta'],
    effect: { type: 'hp', base: 50 },
  },
  {
    id: 'onda_expansiva', label: 'Onda\nExpansiva', icon: 'expand-outline',
    col: 3, row: 2, requires: ['ataque_area'],
    effect: { type: 'atk', base: 12 },
  },
  {
    id: 'tiro_preciso', label: 'Tiro\nPreciso', icon: 'locate-outline',
    col: 4, row: 2, requires: ['ataque_distancia'],
    effect: { type: 'atk', base: 12 },
  },
  {
    id: 'piel_acero', label: 'Piel de\nAcero', icon: 'body-outline',
    col: 1, row: 3, requires: ['fortaleza'],
    effect: { type: 'hp', base: 80 },
  },
  {
    id: 'frenesi', label: 'Frenesí', icon: 'skull-outline',
    col: 0, row: 3, requires: ['golpe_brutal'],
    effect: { type: 'atk', base: 16 },
  },
  {
    id: 'titan', label: 'Titán', icon: 'accessibility-outline',
    col: 1, row: 4, requires: ['piel_acero'],
    effect: { type: 'hp', base: 120 },
  },
];

// ── Árbol: Magia ──────────────────────────────────────────────────────────────

export const TALENT_NODES_MAGIA: TalentNodeConfig[] = [
  {
    id: 'magia_base', label: 'Magia\nBase', icon: 'sparkles-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'atk', base: 4 },
  },
  {
    id: 'mente_aguda', label: 'Mente\nAguda', icon: 'bulb-outline',
    col: 0, row: 1, requires: ['magia_base'],
    effect: { type: 'atk', base: 6 },
  },
  {
    id: 'reserva_mana', label: 'Reserva\nde Maná', icon: 'water-outline',
    col: 4, row: 1, requires: ['magia_base'],
    effect: { type: 'mp', base: 30 },
  },
  {
    id: 'rayo_arcano', label: 'Rayo\nArcano', icon: 'thunderstorm-outline',
    col: 0, row: 2, requires: ['mente_aguda'],
    effect: { type: 'ability', base: 10, ability: 'lightning_strike' },
  },
  {
    id: 'gran_reserva', label: 'Gran\nReserva', icon: 'battery-charging-outline',
    col: 4, row: 2, requires: ['reserva_mana'],
    effect: { type: 'mp', base: 60 },
  },
  {
    id: 'tormenta', label: 'Tormenta\nArcana', icon: 'cloudy-outline',
    col: 0, row: 3, requires: ['rayo_arcano'],
    effect: { type: 'ability', base: 18, ability: 'storm' },
  },
  {
    id: 'barrera_arcana', label: 'Barrera\nArcana', icon: 'shield-checkmark-outline',
    col: 4, row: 3, requires: ['gran_reserva'],
    effect: { type: 'hp', base: 60 },
  },
  {
    id: 'caos_arcano', label: 'Caos\nArcano', icon: 'infinite-outline',
    col: 0, row: 4, requires: ['tormenta'],
    effect: { type: 'atk', base: 22 },
  },
  {
    id: 'fortaleza_maxima', label: 'Fortaleza\nMáxima', icon: 'lock-closed-outline',
    col: 4, row: 4, requires: ['barrera_arcana'],
    effect: { type: 'hp', base: 100 },
  },
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

// ── Registro global (todos los árboles) ──────────────────────────────────────

const ALL_NODES = [...TALENT_NODES, ...TALENT_NODES_MAGIA, ...TALENT_NODES_FIRE, ...TALENT_NODES_WATER, ...TALENT_NODES_SMOKER, ...TALENT_NODES_EXPLOSION];

@Injectable({ providedIn: 'root' })
export class TalentService {

  readonly nodes   = ALL_NODES;
  readonly spheres: Record<SphereType, number>        = { ...DEFAULT_SPHERES };
  readonly slotted: Record<string, SphereType | null> = {};
  readonly changes$ = new Subject<void>();

  constructor() {
    for (const n of ALL_NODES) this.slotted[n.id] = null;
  }

  isUnlocked(nodeId: string): boolean {
    const node = this.nodes.find(n => n.id === nodeId);
    return !!node && node.requires.every(r => this.slotted[r] != null);
  }

  hasDependents(nodeId: string): boolean {
    return this.nodes.some(n => n.requires.includes(nodeId) && this.slotted[n.id] != null);
  }

  slot(nodeId: string, sphere: SphereType): void {
    if (!this.isUnlocked(nodeId) || this.spheres[sphere] <= 0) return;
    const prev = this.slotted[nodeId];
    if (prev) this.spheres[prev]++;
    this.slotted[nodeId] = sphere;
    this.spheres[sphere]--;
    this.changes$.next();
  }

  unslot(nodeId: string): void {
    if (this.hasDependents(nodeId)) return;
    const sphere = this.slotted[nodeId];
    if (!sphere) return;
    this.slotted[nodeId] = null;
    this.spheres[sphere]++;
    this.changes$.next();
  }

  getBonus(): { atk: number; hp: number; mp: number; defense: number; critChance: number; abilities: string[] } {
    let atk = 0, hp = 0, mp = 0, defense = 0, critChance = 0;
    const abilities: string[] = [];
    for (const node of this.nodes) {
      const sphere = this.slotted[node.id];
      if (!sphere) continue;
      const mult = SPHERE_MULT[sphere];
      if (node.effect.type === 'atk') {
        atk += node.effect.base * mult;
      } else if (node.effect.type === 'hp') {
        hp += node.effect.base * mult;
      } else if (node.effect.type === 'mp') {
        mp += node.effect.base * mult;
      } else if (node.effect.type === 'defense') {
        defense += node.effect.base * mult;
      } else if (node.effect.type === 'critChance') {
        critChance += node.effect.base * mult;
      } else if (node.effect.type === 'ability') {
        atk += node.effect.base * mult;
        if (node.effect.ability) abilities.push(node.effect.ability);
      }
    }
    return { atk, hp, mp, defense, critChance, abilities };
  }

  getSnapshot(): TalentSnapshot {
    return {
      spheres: { ...this.spheres },
      nodes:   { ...this.slotted },
    };
  }

  restoreFromSnapshot(snap: TalentSnapshot | null): void {
    if (!snap) {
      Object.assign(this.spheres, DEFAULT_SPHERES);
      for (const n of ALL_NODES) this.slotted[n.id] = null;
      this.changes$.next();
      return;
    }
    Object.assign(this.spheres, snap.spheres);
    for (const n of ALL_NODES) {
      this.slotted[n.id] = snap.nodes?.[n.id] ?? null;
    }
    this.changes$.next();
  }
}
