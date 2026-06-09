import { Injectable } from '@angular/core';

const KEY = 'hud_skill_slots';

@Injectable({ providedIn: 'root' })
export class HudSkillSlotsService {
  readonly slots: (string | null)[] = [null, null, null];

  constructor() { this.load(); }

  set(index: number, nodeId: string | null): void {
    for (let i = 0; i < 3; i++) {
      if (i !== index && this.slots[i] === nodeId) this.slots[i] = null;
    }
    this.slots[index] = nodeId;
    this.save();
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
