import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GatheringEquipmentService } from './gathering-equipment.service';

const TABS = 4;
const ROWS = 4;
const COLS = 5;
const PER_TAB    = ROWS * COLS;   // 20 celdas por pestaña
const BASE_SLOTS = PER_TAB;       // de inicio: primera pestaña completa

// Fallback por nombre para bolsas guardadas antes de que existiera `inventorySlots`.
export const BAG_SLOTS_BY_NAME: Record<string, number> = {
  'Bolsa de Cuero':         4,
  'Morral del Viajero':     8,
  'Zurrón Reforzado':       12,
  'Mochila del Aventurero': 16,
};

/**
 * Calcula cuántas celdas de inventario están desbloqueadas según la mochila
 * equipada en el slot 'backpack' del equipo secundario. La base es la primera
 * pestaña (20); cada mochila añade su `inventorySlots` (4/8/12/16), que se
 * desbloquean en orden de lectura (pestaña 1 → 2 → ...).
 */
@Injectable({ providedIn: 'root' })
export class InventoryUnlockService {

  readonly TABS = TABS;
  readonly ROWS = ROWS;
  readonly COLS = COLS;
  readonly PER_TAB = PER_TAB;

  readonly unlocked$ = new BehaviorSubject<number>(BASE_SLOTS);

  constructor(private gathering: GatheringEquipmentService) {
    this.gathering.changes$.subscribe(() => this.recompute());
    this.recompute();
  }

  get unlocked(): number { return this.unlocked$.value; }

  private recompute(): void {
    const bag = this.gathering.slots.find(s => s.id === 'backpack')?.item;
    const bonus = bag ? (bag.inventorySlots ?? BAG_SLOTS_BY_NAME[bag.name] ?? 0) : 0;
    const next = BASE_SLOTS + bonus;
    if (next !== this.unlocked$.value) this.unlocked$.next(next);
  }

  /** Celdas desbloqueadas dentro de una pestaña (0..PER_TAB). */
  unlockedInTab(tabIndex: number): number {
    return Math.max(0, Math.min(PER_TAB, this.unlocked - tabIndex * PER_TAB));
  }

  isTabVisible(tabIndex: number): boolean {
    return this.unlockedInTab(tabIndex) > 0;
  }

  isUnlocked(tabIndex: number, row: number, col: number): boolean {
    return row * COLS + col < this.unlockedInTab(tabIndex);
  }
}
