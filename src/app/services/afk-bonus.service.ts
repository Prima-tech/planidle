import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

export interface AfkPassiveDef {
  id: string;
  name: string;
  desc: string;
  coinsMult: number;
  expMult: number;
  cost: number;
}

export const AFK_PASSIVE_REGISTRY: AfkPassiveDef[] = [
  {
    id: 'basic_loot',
    name: 'Saqueo Básico',
    desc: '+20% monedas y XP en AFK',
    coinsMult: 1.2,
    expMult: 1.2,
    cost: 500,
  },
  {
    id: 'hunter_instinct',
    name: 'Instinto Cazador',
    desc: '+50% XP en AFK',
    coinsMult: 1.0,
    expMult: 1.5,
    cost: 2000,
  },
  {
    id: 'greed',
    name: 'Codicia',
    desc: '+50% monedas en AFK',
    coinsMult: 1.5,
    expMult: 1.0,
    cost: 2000,
  },
];

@Injectable({ providedIn: 'root' })
export class AfkBonusService {
  private unlocked = new Set<string>();
  private charId: string | null = null;

  constructor(private storage: StorageService) {}

  get coinsMult(): number {
    return AFK_PASSIVE_REGISTRY
      .filter(p => this.unlocked.has(p.id))
      .reduce((acc, p) => acc * p.coinsMult, 1);
  }

  get expMult(): number {
    return AFK_PASSIVE_REGISTRY
      .filter(p => this.unlocked.has(p.id))
      .reduce((acc, p) => acc * p.expMult, 1);
  }

  isUnlocked(id: string): boolean { return this.unlocked.has(id); }

  async loadForChar(charId: string, override?: string[]): Promise<void> {
    this.charId = charId;
    // override = pasivas restauradas del snapshot (nube). Si no, lee la clave local.
    const saved: string[] = override ?? (await this.storage.get(`afk_passives_${charId}`) ?? []);
    this.unlocked = new Set(saved);
    // Si vino del snapshot, sincroniza la clave local para que coincida.
    if (override) await this.storage.set(`afk_passives_${charId}`, [...this.unlocked]);
  }

  /** IDs de pasivas desbloqueadas para el GameSnapshot (sube a la nube). */
  getSnapshot(): string[] {
    return [...this.unlocked];
  }

  async unlock(id: string): Promise<void> {
    this.unlocked.add(id);
    if (this.charId) {
      await this.storage.set(`afk_passives_${this.charId}`, [...this.unlocked]);
    }
  }
}
