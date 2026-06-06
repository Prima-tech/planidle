import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

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
}
