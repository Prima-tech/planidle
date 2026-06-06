import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type SkillSlotsSnapshot = Record<number, string | null>;

@Injectable({ providedIn: 'root' })
export class SkillEquipService {
  readonly slots: Record<number, string | null> = { 1: null, 2: null, 3: null, 4: null };
  activeSlot: number | null = null;
  selectedAbilityId: string | null = null;
  readonly changes$           = new Subject<void>();
  readonly openDetail$        = new Subject<string>();
  readonly closeSkillPanels$  = new Subject<void>();

  equip(slot: number, abilityId: string) {
    for (const k of [1, 2, 3, 4]) {
      if (this.slots[k] === abilityId) this.slots[k] = null;
    }
    this.slots[slot] = abilityId;
    this.changes$.next();
    this.closeSkillPanels$.next();
  }

  unequip(slot: number) {
    this.slots[slot] = null;
    this.changes$.next();
  }

  getSnapshot(): SkillSlotsSnapshot {
    return { 1: this.slots[1], 2: this.slots[2], 3: this.slots[3], 4: this.slots[4] };
  }

  restoreFromSnapshot(snap: SkillSlotsSnapshot | null): void {
    this.slots[1] = snap?.[1] ?? null;
    this.slots[2] = snap?.[2] ?? null;
    this.slots[3] = snap?.[3] ?? null;
    this.slots[4] = snap?.[4] ?? null;
  }
}
