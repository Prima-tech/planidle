import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { InventoryItem } from './inventory.service';

export interface EquipmentSlot {
  id: string;
  label: string;
  accepts: string[];
  item: InventoryItem | null;
}

export type EquipmentSnapshot = Record<string, InventoryItem | null>;

const INV_TABS = 4;
const INV_ROWS = 4;
const INV_COLS = 5;

@Injectable({ providedIn: 'root' })
export class EquipmentService {

  readonly slots: EquipmentSlot[] = [
    // Columna izquierda
    { id: 'helmet',  label: 'Casco',      accepts: ['Casco', 'Armet'], item: null },
    { id: 'armor',   label: 'Armadura',   accepts: ['Armadura'],   item: null },
    { id: 'pants',   label: 'Pantalones', accepts: ['Pantalones'], item: null },
    { id: 'boots',   label: 'Botas',      accepts: ['Botas'],      item: null },
    { id: 'weapon',  label: 'Arma',       accepts: ['Espada'],     item: null },
    // Columna derecha
    { id: 'necklace', label: 'Collar',    accepts: ['Collar'],     item: null },
    { id: 'ring1',    label: 'Anillo 1',  accepts: ['Anillo'],     item: null },
    { id: 'ring2',    label: 'Anillo 2',  accepts: ['Anillo'],     item: null },
    { id: 'food',     label: 'Comida',    accepts: ['Comida'],     item: null },
    { id: 'potion',   label: 'Poción',    accepts: ['Poción'],     item: null },
  ];

  readonly changes$ = new Subject<void>();

  private readonly _inventoryCellIds: string[] = (() => {
    const ids: string[] = [];
    for (let t = 0; t < INV_TABS; t++)
      for (let r = 0; r < INV_ROWS; r++)
        for (let c = 0; c < INV_COLS; c++)
          ids.push(`inv-${t}-${r}-${c}`);
    return ids;
  })();

  get inventoryCellIds(): string[] {
    return this._inventoryCellIds;
  }

  getEquipmentSlotIds(): string[] {
    return this.slots.map(s => `equip-${s.id}`);
  }

  canEquip(item: InventoryItem, cdkSlotId: string): boolean {
    const slot = this.findSlot(cdkSlotId);
    return !!slot && !!item && slot.accepts.includes(item.name);
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
    for (const slot of this.slots) {
      snap[slot.id] = slot.item ? { ...slot.item } : null;
    }
    return snap;
  }

  restoreFromSnapshot(snap: EquipmentSnapshot | null | undefined): void {
    for (const slot of this.slots) {
      slot.item = snap?.[slot.id] ? { ...snap[slot.id]! } : null;
    }
    this.changes$.next();
  }

  clearAll(): void {
    for (const slot of this.slots) slot.item = null;
    this.changes$.next();
  }

  private findSlot(cdkSlotId: string): EquipmentSlot | undefined {
    return this.slots.find(s => `equip-${s.id}` === cdkSlotId);
  }
}
