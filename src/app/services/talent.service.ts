import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type SphereType = 'common' | 'normal' | 'rare' | 'epic' | 'legendary';

export interface TalentEffect {
  type:     'atk' | 'hp' | 'ability';
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

export const TALENT_NODES: TalentNodeConfig[] = [
  {
    id: 'ataque_normal', label: 'Ataque\nNormal', icon: 'flash-outline',
    col: 2, row: 0, requires: [],
    effect: { type: 'atk', base: 3 },
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
];

@Injectable({ providedIn: 'root' })
export class TalentService {

  readonly nodes   = TALENT_NODES;
  readonly spheres: Record<SphereType, number>        = { ...DEFAULT_SPHERES };
  readonly slotted: Record<string, SphereType | null> = {};
  readonly changes$ = new Subject<void>();

  constructor() {
    for (const n of TALENT_NODES) this.slotted[n.id] = null;
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

  getBonus(): { atk: number; hp: number; abilities: string[] } {
    let atk = 0, hp = 0;
    const abilities: string[] = [];
    for (const node of this.nodes) {
      const sphere = this.slotted[node.id];
      if (!sphere) continue;
      const mult = SPHERE_MULT[sphere];
      if (node.effect.type === 'atk') {
        atk += node.effect.base * mult;
      } else if (node.effect.type === 'hp') {
        hp += node.effect.base * mult;
      } else if (node.effect.type === 'ability') {
        atk += node.effect.base * mult;
        if (node.effect.ability) abilities.push(node.effect.ability);
      }
    }
    return { atk, hp, abilities };
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
      for (const n of TALENT_NODES) this.slotted[n.id] = null;
      this.changes$.next();
      return;
    }
    Object.assign(this.spheres, snap.spheres);
    for (const n of TALENT_NODES) {
      this.slotted[n.id] = snap.nodes?.[n.id] ?? null;
    }
    this.changes$.next();
  }
}
