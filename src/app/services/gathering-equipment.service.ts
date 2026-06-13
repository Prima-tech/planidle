import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { InventoryItem } from './inventory.service';
import { EquipmentLoadouts, EquipmentSnapshot, LOADOUT_COUNT } from './equipment.service';

export interface GatheringSlot {
  id: string;
  label: string;
  accepts: string[];
  item: InventoryItem | null;
}

const INV_TABS = 4;
const INV_ROWS = 4;
const INV_COLS = 5;

@Injectable({ providedIn: 'root' })
export class GatheringEquipmentService {

  readonly slots: GatheringSlot[] = [
    // Columna izquierda
    { id: 'pickaxe',     label: 'Pico',      accepts: ['Pico'],      item: null },
    { id: 'axe',         label: 'Hacha',     accepts: ['Hacha'],     item: null },
    { id: 'fishing_rod', label: 'Caña',      accepts: ['Caña'],      item: null },
    { id: 'shovel',      label: 'Pala',      accepts: ['Pala'],      item: null },
    { id: 'lantern',     label: 'Linterna',  accepts: ['Linterna'],  item: null },
    // Columna derecha
    { id: 'backpack',    label: 'Mochila',   accepts: ['Mochila'],   item: null },
    { id: 'gloves',      label: 'Guantes',   accepts: ['Guantes'],   item: null },
    { id: 'belt',        label: 'Cinturón',  accepts: ['Cinturón'],  item: null },
    { id: 'compass',     label: 'Brújula',   accepts: ['Brújula'],   item: null },
    { id: 'torch',       label: 'Antorcha',  accepts: ['Antorcha'],  item: null },
  ];

  readonly changes$ = new Subject<void>();

  activeLoadout = 0;
  private storedSets: (EquipmentSnapshot | null)[] = [null, null, null];

  switchLoadout(index: number): void {
    if (index === this.activeLoadout || index < 0 || index >= LOADOUT_COUNT) return;
    this.storedSets[this.activeLoadout] = this.getSnapshot();
    this.activeLoadout = index;
    this.restoreFromSnapshot(this.storedSets[index]);
  }

  getLoadoutsSnapshot(): EquipmentLoadouts {
    const sets = this.storedSets.map((s, i) =>
      i === this.activeLoadout ? this.getSnapshot() : (s ? { ...s } : null),
    );
    return { active: this.activeLoadout, sets };
  }

  restoreLoadouts(data: EquipmentLoadouts | null | undefined): void {
    if (data && Array.isArray(data.sets)) {
      this.storedSets = Array.from({ length: LOADOUT_COUNT }, (_, i) =>
        data.sets[i] ? { ...data.sets[i]! } : null,
      );
      this.activeLoadout = Math.min(Math.max(data.active ?? 0, 0), LOADOUT_COUNT - 1);
    } else {
      this.storedSets = [null, null, null];
      this.activeLoadout = 0;
    }
    this.restoreFromSnapshot(this.storedSets[this.activeLoadout]);
  }

  private readonly _inventoryCellIds: string[] = (() => {
    const ids: string[] = [];
    for (let t = 0; t < INV_TABS; t++)
      for (let r = 0; r < INV_ROWS; r++)
        for (let c = 0; c < INV_COLS; c++)
          ids.push(`inv-${t}-${r}-${c}`);
    return ids;
  })();

  get inventoryCellIds(): string[] { return this._inventoryCellIds; }

  getSlotIds(): string[] {
    return this.slots.map(s => `gather-${s.id}`);
  }

  canEquip(item: InventoryItem, cdkSlotId: string): boolean {
    const slot = this.findSlot(cdkSlotId);
    const key = item.category ?? item.name;
    return !!slot && !!item && slot.accepts.includes(key);
  }

  equip(cdkSlotId: string, item: InventoryItem): InventoryItem | null {
    const slot = this.findSlot(cdkSlotId);
    if (!slot) return null;
    const displaced = slot.item;
    slot.item = { ...item };
    this.changes$.next();
    return displaced;
  }

  unequip(cdkSlotId: string): InventoryItem | null {
    const slot = this.findSlot(cdkSlotId);
    if (!slot) return null;
    const item = slot.item;
    slot.item = null;
    this.changes$.next();
    return item;
  }

  getSnapshot(): EquipmentSnapshot {
    const snap: EquipmentSnapshot = {};
    for (const slot of this.slots) snap[slot.id] = slot.item ? { ...slot.item } : null;
    return snap;
  }

  restoreFromSnapshot(snap: EquipmentSnapshot | null | undefined): void {
    for (const slot of this.slots) {
      slot.item = snap?.[slot.id] ? { ...snap[slot.id]! } : null;
    }
    this.changes$.next();
  }

  clearAll(): void {
    this.storedSets = [null, null, null];
    this.activeLoadout = 0;
    for (const slot of this.slots) slot.item = null;
    this.changes$.next();
  }

  private findSlot(cdkSlotId: string): GatheringSlot | undefined {
    return this.slots.find(s => `gather-${s.id}` === cdkSlotId);
  }
}
