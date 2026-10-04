import { Injectable } from '@angular/core';
import { GlobalTalentsService } from './global-talents.service';
import { TalentService } from './talent.service';

const KEY = 'hud_skill_slots';

@Injectable({ providedIn: 'root' })
export class HudSkillSlotsService {
  readonly slots: (string | null)[] = [null, null, null];

  constructor(private globalTalents: GlobalTalentsService, private talent: TalentService) { this.load(); }

  set(index: number, nodeId: string | null): void {
    for (let i = 0; i < 3; i++) {
      if (i !== index && this.slots[i] === nodeId) this.slots[i] = null;
    }
    this.slots[index] = nodeId;
    this.save();
  }

  /** ¿Se ve (y cuenta) la ranura `index` del HUD? Cada una la abre su talento global de
   *  Ataque (attack_2/3/4); la primera, además, se abre sola al aprender la primera
   *  habilidad en el árbol de talentos. */
  isOpen(index: number): boolean {
    if (this.globalTalents.isUnlocked(GlobalTalentsService.SKILL_SLOT_NODES[index])) return true;
    return index === 0 && this.talent.hasLearnedAbility();
  }

  /** Recién aprendida una habilidad: si la primera ranura está libre, se pone ahí. */
  assignLearned(nodeId: string): void {
    if (!this.slots[0]) this.set(0, nodeId);
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as (string | null)[];
      for (let i = 0; i < 3; i++) this.slots[i] = saved[i] ?? null;
    } catch {}
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.slots));
  }
}
