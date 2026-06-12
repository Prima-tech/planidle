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

/** Tres sets de equipo por personaje; `active` es el que está puesto */
export interface EquipmentLoadouts {
  active: number;
  sets: (EquipmentSnapshot | null)[];
}

export const LOADOUT_COUNT = 3;

const INV_TABS = 4;
const INV_ROWS = 4;
const INV_COLS = 5;

@Injectable({ providedIn: 'root' })
export class EquipmentService {

  readonly slots: EquipmentSlot[] = [
    // Columna izquierda
    { id: 'helmet',  label: 'Casco',      accepts: ['Casco'],          item: null },
    { id: 'armor',   label: 'Armadura',   accepts: ['Armadura'],   item: null },
    { id: 'pants',   label: 'Pantalones', accepts: ['Pantalones'], item: null },
    { id: 'boots',   label: 'Botas',      accepts: ['Botas'],      item: null },
    { id: 'weapon',  label: 'Arma',       accepts: ['Espada', 'Arma'], item: null },
    // Columna derecha
    { id: 'necklace', label: 'Collar',    accepts: ['Collar'],     item: null },
    { id: 'ring1',    label: 'Anillo 1',  accepts: ['Anillo'],     item: null },
    { id: 'ring2',    label: 'Anillo 2',  accepts: ['Anillo'],     item: null },
    { id: 'food',     label: 'Comida',    accepts: ['Comida'],     item: null },
    { id: 'potion',   label: 'Poción',    accepts: ['Poción'],     item: null },
  ];

  readonly changes$ = new Subject<void>();

  // ── Loadouts: 3 sets por personaje ──────────────────────────────────────────
  // El set activo vive en `slots` (estado de trabajo); los demás, como snapshots.

  activeLoadout = 0;
  private storedSets: (EquipmentSnapshot | null)[] = [null, null, null];

  /** Cambia el set activo: guarda el actual y restaura el elegido.
   *  changes$ propaga el cambio a stats, sprites de Phaser y auto-save. */
  switchLoadout(index: number): void {
    if (index === this.activeLoadout || index < 0 || index >= LOADOUT_COUNT) return;
    this.storedSets[this.activeLoadout] = this.getSnapshot();
    this.activeLoadout = index;
    this.restoreFromSnapshot(this.storedSets[index]);
  }

  /** Para persistir: los 3 sets con el activo leído del estado vivo */
  getLoadoutsSnapshot(): EquipmentLoadouts {
    const sets = this.storedSets.map((s, i) =>
      i === this.activeLoadout ? this.getSnapshot() : (s ? { ...s } : null),
    );
    return { active: this.activeLoadout, sets };
  }

  /** Restaura los 3 sets. `legacy` migra snapshots antiguos de un solo set. */
  restoreLoadouts(data: EquipmentLoadouts | null | undefined, legacy?: EquipmentSnapshot | null): void {
    if (data && Array.isArray(data.sets)) {
      this.storedSets = Array.from({ length: LOADOUT_COUNT }, (_, i) =>
        data.sets[i] ? { ...data.sets[i]! } : null,
      );
      this.activeLoadout = Math.min(Math.max(data.active ?? 0, 0), LOADOUT_COUNT - 1);
    } else {
      this.storedSets = [legacy ? { ...legacy } : null, null, null];
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

  get inventoryCellIds(): string[] {
    return this._inventoryCellIds;
  }

  getEquipmentSlotIds(): string[] {
    return this.slots.map(s => `equip-${s.id}`);
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
    this.storedSets = [null, null, null];
    this.activeLoadout = 0;
    for (const slot of this.slots) slot.item = null;
    this.changes$.next();
  }

  private findSlot(cdkSlotId: string): EquipmentSlot | undefined {
    return this.slots.find(s => `equip-${s.id}` === cdkSlotId);
  }
}
