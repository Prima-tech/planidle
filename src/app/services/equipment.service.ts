import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { InventoryItem } from './inventory.service';

export interface EquipmentSlot {
  id: string;
  label: string;
  accepts: string[];
  item: InventoryItem | null;
}

const INV_TABS = 4;
const INV_ROWS = 4;
const INV_COLS = 5;

@Injectable({ providedIn: 'root' })
export class EquipmentService {

  readonly slots: EquipmentSlot[] = [
    { id: 'weapon', label: 'Arma',     accepts: ['Espada'],   item: null },
    { id: 'shield', label: 'Escudo',   accepts: ['Escudo'],   item: null },
    { id: 'helmet', label: 'Casco',    accepts: ['Casco'],    item: null },
    { id: 'armor',  label: 'Armadura', accepts: ['Armadura'], item: null },
    { id: 'boots',  label: 'Botas',    accepts: ['Botas'],    item: null },
    { id: 'ring',   label: 'Anillo',   accepts: ['Anillo'],   item: null },
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

  private findSlot(cdkSlotId: string): EquipmentSlot | undefined {
    return this.slots.find(s => `equip-${s.id}` === cdkSlotId);
  }
}
