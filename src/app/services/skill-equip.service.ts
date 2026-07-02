import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type SkillSlotsSnapshot = Record<number, string | null>;

const SLOT_COUNT = 10;
const ALL_SLOTS  = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1);

@Injectable({ providedIn: 'root' })
export class SkillEquipService {
  readonly slots: Record<number, string | null> = Object.fromEntries(ALL_SLOTS.map(s => [s, null]));
  activeSlot: number | null = null;
  selectedAbilityId: string | null = null;
  hudEditMode = false;
  readonly changes$           = new Subject<void>();
  readonly openDetail$        = new Subject<string>();
  readonly closeSkillPanels$  = new Subject<void>();
  // Slot negativo = HUD slot (index = |slot| - 1). HudSkillButtonsComponent escucha esto.
  readonly hudEquip$          = new Subject<{ index: number; nodeId: string }>();

  equip(slot: number, abilityId: string) {
    if (slot < 0) {
      this.hudEquip$.next({ index: Math.abs(slot) - 1, nodeId: abilityId });
      this.changes$.next();
      this.closeSkillPanels$.next();
      return;
    }
    for (const k of ALL_SLOTS) {
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
    return Object.fromEntries(ALL_SLOTS.map(s => [s, this.slots[s]]));
  }

  restoreFromSnapshot(snap: SkillSlotsSnapshot | null): void {
    for (const s of ALL_SLOTS) {
      this.slots[s] = snap?.[s] ?? null;
    }
  }
}
