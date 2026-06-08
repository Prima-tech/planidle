import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type SphereType = 'normal' | 'rare' | 'epic';

export interface TalentEffect {
  type:     'atk' | 'hp' | 'mp' | 'defense' | 'critChance' | 'hpRegen' | 'mpRegen' | 'dropRate' | 'ability';
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
  normal: 2,
  rare:   4,
  epic:   8,
};

const DEFAULT_SPHERES: Record<SphereType, number> = {
  normal: 10, rare: 10, epic: 10,
};

// ── Árbol: Combate (centro en col=5, row=5) ───────────────────────────────────
// Arriba: Agilidad/Crítico | Abajo: Defensa/HP | Izquierda: Regen | Derecha: ATK Bruto

export const TALENT_NODES: TalentNodeConfig[] = [
  // Centro
  { id: 'c0',     label: 'Espíritu\nGuerrero', icon: 'flame-outline',
    col: 5, row: 5, requires: [], effect: { type: 'atk', base: 3 } },

  // ── Arriba: Agilidad / Crítico ───────────────────────────────
  { id: 'c_prec', label: 'Precisión',          icon: 'locate-outline',
    col: 5, row: 4, requires: ['c0'], effect: { type: 'critChance', base: 2 } },
  { id: 'c_vel',  label: 'Velocidad',           icon: 'arrow-up-circle-outline',
    col: 4, row: 3, requires: ['c_prec'], effect: { type: 'atk', base: 4 } },
  { id: 'c_crit', label: 'Crítico',             icon: 'flash-outline',
    col: 6, row: 3, requires: ['c_prec'], effect: { type: 'critChance', base: 3 } },
  { id: 'c_esq',  label: 'Esquiva',             icon: 'walk-outline',
    col: 3, row: 2, requires: ['c_vel'], effect: { type: 'defense', base: 2 } },
  { id: 'c_cert', label: 'Golpe\nCertero',      icon: 'star-outline',
    col: 5, row: 2, requires: ['c_vel', 'c_crit'], effect: { type: 'critChance', base: 5 } },
  { id: 'c_ven',  label: 'Filo\nVenenoso',      icon: 'skull-outline',
    col: 7, row: 2, requires: ['c_crit'], effect: { type: 'atk', base: 8 } },
  { id: 'c_som',  label: 'Sombra',              icon: 'eye-off-outline',
    col: 4, row: 1, requires: ['c_esq', 'c_cert'], effect: { type: 'atk', base: 10 } },
  { id: 'c_asn',  label: 'Asesino',             icon: 'hand-right-outline',
    col: 6, row: 1, requires: ['c_cert', 'c_ven'], effect: { type: 'atk', base: 14 } },
  { id: 'c_ley',  label: 'Leyenda',             icon: 'trophy-outline',
    col: 5, row: 0, requires: ['c_som', 'c_asn'], effect: { type: 'atk', base: 22 } },

  // ── Abajo: Defensa / HP ──────────────────────────────────────
  { id: 'c_grd',  label: 'Guardia',             icon: 'hand-left-outline',
    col: 5, row: 6, requires: ['c0'], effect: { type: 'defense', base: 2 } },
  { id: 'c_vit',  label: 'Vitalidad',           icon: 'heart-outline',
    col: 4, row: 7, requires: ['c_grd'], effect: { type: 'hp', base: 30 } },
  { id: 'c_esc',  label: 'Escudo',              icon: 'shield-outline',
    col: 6, row: 7, requires: ['c_grd'], effect: { type: 'defense', base: 3 } },
  { id: 'c_vr',   label: 'Vida\nRobusta',       icon: 'body-outline',
    col: 3, row: 8, requires: ['c_vit'], effect: { type: 'hp', base: 50 } },
  { id: 'c_bst',  label: 'Bastión',             icon: 'shield-checkmark-outline',
    col: 5, row: 8, requires: ['c_vit', 'c_esc'], effect: { type: 'hp', base: 60 } },
  { id: 'c_fort', label: 'Fortaleza',           icon: 'barbell-outline',
    col: 7, row: 8, requires: ['c_esc'], effect: { type: 'hp', base: 40 } },
  { id: 'c_pac',  label: 'Piel de\nAcero',      icon: 'diamond-outline',
    col: 4, row: 9, requires: ['c_vr', 'c_bst'], effect: { type: 'hp', base: 80 } },
  { id: 'c_bar',  label: 'Barrera',             icon: 'lock-closed-outline',
    col: 6, row: 9, requires: ['c_bst', 'c_fort'], effect: { type: 'defense', base: 5 } },
  { id: 'c_tit',  label: 'Titán',               icon: 'accessibility-outline',
    col: 5, row: 10, requires: ['c_pac', 'c_bar'], effect: { type: 'hp', base: 120 } },

  // ── Izquierda: Regeneración ──────────────────────────────────
  { id: 'c_reg',  label: 'Regen',               icon: 'refresh-outline',
    col: 4, row: 5, requires: ['c0'], effect: { type: 'hpRegen', base: 2 } },
  { id: 'c_cur',  label: 'Curación',            icon: 'repeat-outline',
    col: 3, row: 5, requires: ['c_reg'], effect: { type: 'hpRegen', base: 3 } },
  { id: 'c_rec',  label: 'Recup.\nRápida',      icon: 'reload-circle-outline',
    col: 3, row: 4, requires: ['c_cur'], effect: { type: 'hpRegen', base: 4 } },
  { id: 'c_resi', label: 'Resiliencia',         icon: 'trending-up-outline',
    col: 3, row: 6, requires: ['c_cur'], effect: { type: 'mpRegen', base: 2 } },
  { id: 'c_san',  label: 'Sanación',            icon: 'heart-outline',
    col: 2, row: 5, requires: ['c_cur'], effect: { type: 'hp', base: 50 } },
  { id: 'c_ind',  label: 'Indestructible',      icon: 'infinite-outline',
    col: 1, row: 5, requires: ['c_rec', 'c_san', 'c_resi'], effect: { type: 'hp', base: 100 } },
  { id: 'c_ete',  label: 'Eterno',              icon: 'star-outline',
    col: 0, row: 5, requires: ['c_ind'], effect: { type: 'hp', base: 150 } },

  // ── Derecha: Ataque Bruto ────────────────────────────────────
  { id: 'c_pod',  label: 'Poder',               icon: 'barbell-outline',
    col: 6, row: 5, requires: ['c0'], effect: { type: 'atk', base: 5 } },
  { id: 'c_fb',   label: 'Fuerza\nBruta',       icon: 'hammer-outline',
    col: 7, row: 5, requires: ['c_pod'], effect: { type: 'atk', base: 8 } },
  { id: 'c_gf',   label: 'Golpe\nFuerte',       icon: 'arrow-up-outline',
    col: 7, row: 4, requires: ['c_fb'], effect: { type: 'atk', base: 10 } },
  { id: 'c_emb',  label: 'Embate',              icon: 'arrow-down-outline',
    col: 7, row: 6, requires: ['c_fb'], effect: { type: 'atk', base: 10 } },
  { id: 'c_dev',  label: 'Devastador',          icon: 'nuclear-outline',
    col: 8, row: 5, requires: ['c_fb'], effect: { type: 'atk', base: 12 } },
  { id: 'c_tor',  label: 'Torbellino',          icon: 'reload-circle-outline',
    col: 8, row: 4, requires: ['c_gf', 'c_dev'], effect: { type: 'atk', base: 16 } },
  { id: 'c_apl',  label: 'Aplastamiento',       icon: 'expand-outline',
    col: 8, row: 6, requires: ['c_emb', 'c_dev'], effect: { type: 'atk', base: 16 } },
  { id: 'c_cat',  label: 'Cataclismo',          icon: 'thunderstorm-outline',
    col: 9, row: 4, requires: ['c_tor'], effect: { type: 'atk', base: 22 } },
  { id: 'c_dst',  label: 'Destrucción\nTotal',  icon: 'planet-outline',
    col: 9, row: 6, requires: ['c_apl'], effect: { type: 'atk', base: 22 } },
];

// ── Árbol: Magia (centro en col=5, row=5) ─────────────────────────────────────
// Arriba: Hechizos/Daño | Abajo: Escudos Mágicos | Izquierda: Amplificación | Derecha: Maná/Regen

export const TALENT_NODES_MAGIA: TalentNodeConfig[] = [
  // Centro
  { id: 'm0',    label: 'Magia\nArcana',       icon: 'sparkles-outline',
    col: 5, row: 5, requires: [], effect: { type: 'atk', base: 4 } },

  // ── Arriba: Hechizos ────────────────────────────────────────
  { id: 'm_int', label: 'Intelecto',            icon: 'bulb-outline',
    col: 5, row: 4, requires: ['m0'], effect: { type: 'atk', base: 5 } },
  { id: 'm_foc', label: 'Foco\nArcano',         icon: 'locate-outline',
    col: 4, row: 3, requires: ['m_int'], effect: { type: 'atk', base: 7 } },
  { id: 'm_man', label: 'Reserva\nde Maná',     icon: 'water-outline',
    col: 6, row: 3, requires: ['m_int'], effect: { type: 'mp', base: 30 } },
  { id: 'm_ray', label: 'Rayo\nArcano',         icon: 'thunderstorm-outline',
    col: 4, row: 2, requires: ['m_foc'], effect: { type: 'ability', base: 10, ability: 'lightning_strike' } },
  { id: 'm_grm', label: 'Gran\nReserva',        icon: 'battery-charging-outline',
    col: 6, row: 2, requires: ['m_man'], effect: { type: 'mp', base: 55 } },
  { id: 'm_tor', label: 'Tormenta\nArcana',     icon: 'cloudy-outline',
    col: 5, row: 1, requires: ['m_ray', 'm_grm'], effect: { type: 'ability', base: 18, ability: 'storm' } },
  { id: 'm_cao', label: 'Caos\nArcano',         icon: 'infinite-outline',
    col: 5, row: 0, requires: ['m_tor'], effect: { type: 'atk', base: 25 } },

  // ── Abajo: Escudos / Resistencia Mágica ─────────────────────
  { id: 'm_bar', label: 'Barrera\nMágica',      icon: 'shield-checkmark-outline',
    col: 5, row: 6, requires: ['m0'], effect: { type: 'defense', base: 3 } },
  { id: 'm_esc', label: 'Escudo\nMágico',       icon: 'shield-half-outline',
    col: 4, row: 7, requires: ['m_bar'], effect: { type: 'hp', base: 40 } },
  { id: 'm_res', label: 'Resistencia\nArcana',  icon: 'body-outline',
    col: 6, row: 7, requires: ['m_bar'], effect: { type: 'defense', base: 4 } },
  { id: 'm_frt', label: 'Fortaleza\nMágica',    icon: 'lock-closed-outline',
    col: 5, row: 8, requires: ['m_esc', 'm_res'], effect: { type: 'hp', base: 70 } },
  { id: 'm_aeg', label: 'Aegis',                icon: 'shield-outline',
    col: 5, row: 9, requires: ['m_frt'], effect: { type: 'hp', base: 100 } },
  { id: 'm_inm', label: 'Inmortal\nArcano',     icon: 'trophy-outline',
    col: 5, row: 10, requires: ['m_aeg'], effect: { type: 'hp', base: 150 } },

  // ── Izquierda: Amplificación de Daño ────────────────────────
  { id: 'm_amp', label: 'Amplificar',           icon: 'expand-outline',
    col: 4, row: 5, requires: ['m0'], effect: { type: 'atk', base: 5 } },
  { id: 'm_sob', label: 'Sobrecarga',           icon: 'flash-outline',
    col: 3, row: 4, requires: ['m_amp'], effect: { type: 'atk', base: 9 } },
  { id: 'm_vmp', label: 'Veneno\nMágico',       icon: 'skull-outline',
    col: 3, row: 6, requires: ['m_amp'], effect: { type: 'atk', base: 8 } },
  { id: 'm_exp', label: 'Explosión\nMágica',    icon: 'nuclear-outline',
    col: 2, row: 5, requires: ['m_sob', 'm_vmp'], effect: { type: 'atk', base: 18 } },
  { id: 'm_sng', label: 'Singularidad',         icon: 'planet-outline',
    col: 1, row: 5, requires: ['m_exp'], effect: { type: 'atk', base: 30 } },
  { id: 'm_voi', label: 'Vacío\nArcano',        icon: 'disc-outline',
    col: 0, row: 5, requires: ['m_sng'], effect: { type: 'atk', base: 40 } },

  // ── Derecha: Regeneración de Maná ───────────────────────────
  { id: 'm_can', label: 'Canalizar',            icon: 'radio-outline',
    col: 6, row: 5, requires: ['m0'], effect: { type: 'mpRegen', base: 2 } },
  { id: 'm_med', label: 'Meditación',           icon: 'refresh-outline',
    col: 7, row: 5, requires: ['m_can'], effect: { type: 'mpRegen', base: 3 } },
  { id: 'm_sab', label: 'Sabiduría',            icon: 'sunny-outline',
    col: 7, row: 4, requires: ['m_med'], effect: { type: 'mpRegen', base: 4 } },
  { id: 'm_flu', label: 'Flujo de\nManá',       icon: 'cloud-outline',
    col: 7, row: 6, requires: ['m_med'], effect: { type: 'mp', base: 40 } },
  { id: 'm_arc', label: 'Arcano\nSuperior',     icon: 'sparkles-outline',
    col: 8, row: 5, requires: ['m_med'], effect: { type: 'mpRegen', base: 6 } },
  { id: 'm_omn', label: 'Omnipotente',          icon: 'diamond-outline',
    col: 9, row: 5, requires: ['m_arc'], effect: { type: 'atk', base: 28 } },
  { id: 'm_div', label: 'Divinidad\nArcana',    icon: 'star-outline',
    col: 10, row: 5, requires: ['m_omn'], effect: { type: 'atk', base: 40 } },
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

  getBonus(): { atk: number; hp: number; mp: number; defense: number; critChance: number; hpRegen: number; mpRegen: number; dropRate: number; abilities: string[] } {
    let atk = 0, hp = 0, mp = 0, defense = 0, critChance = 0, hpRegen = 0, mpRegen = 0, dropRate = 0;
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
      } else if (node.effect.type === 'hpRegen') {
        hpRegen += node.effect.base * mult;
      } else if (node.effect.type === 'mpRegen') {
        mpRegen += node.effect.base * mult;
      } else if (node.effect.type === 'dropRate') {
        dropRate += node.effect.base * mult;
      } else if (node.effect.type === 'ability') {
        atk += node.effect.base * mult;
        if (node.effect.ability) abilities.push(node.effect.ability);
      }
    }
    return { atk, hp, mp, defense, critChance, hpRegen, mpRegen, dropRate, abilities };
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
