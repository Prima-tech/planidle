import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

// Cambia a false cuando Supabase esté listo para inventario
const USE_MOCK = true;

export interface InventoryItem {
  id: string;
  name: string;
  mergeable?: boolean;
  sum?: number;
  order?: number;
}

const TABS = 4;
const ROWS = 4;
const COLS = 5;

@Injectable({ providedIn: 'root' })
export class InventoryService {

  readonly itemDropped$ = new Subject<InventoryItem>();
  readonly changes$     = new Subject<void>();

  private mockGrid: (InventoryItem | null)[][][] = this.buildGrid();

  constructor() {
    this.seedMockData();
  }

  async load(inventoryType: string = 'backpack'): Promise<(InventoryItem | null)[][][]> {
    if (USE_MOCK) return this.clone(this.mockGrid);
    return this.loadFromSupabase(inventoryType);
  }

  async save(grid: (InventoryItem | null)[][][], inventoryType: string = 'backpack'): Promise<void> {
    if (USE_MOCK) {
      this.mockGrid = this.clone(grid);
      this.changes$.next();
      return;
    }
    await this.saveToSupabase(grid, inventoryType);
  }

  addDroppedItem(item: InventoryItem): void {
    this.addToGrid(this.mockGrid, item);
    this.itemDropped$.next(item);
    this.changes$.next();
  }

  getSnapshot(): (InventoryItem | null)[][][] {
    return this.clone(this.mockGrid);
  }

  restoreFromSnapshot(grid: (InventoryItem | null)[][][]): void {
    if (!grid) return;
    this.mockGrid = this.clone(grid);
  }

  private addToGrid(grid: (InventoryItem | null)[][][], item: InventoryItem): void {
    if (item.mergeable) {
      for (let t = 0; t < TABS; t++) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const existing = grid[t][r][c];
            if (existing?.mergeable && existing.name === item.name) {
              existing.sum = (existing.sum ?? 0) + (item.sum ?? 1);
              return;
            }
          }
        }
      }
    }
    for (let t = 0; t < TABS; t++) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!grid[t][r][c]) {
            grid[t][r][c] = item;
            return;
          }
        }
      }
    }
  }

  generateId(): string {
    return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // --- Mock: edita aquí los items de prueba ---

  private seedMockData(): void {
    this.mockGrid[0][0][0] = { id: 'mock-1', name: 'Espada',  mergeable: false, order: 2 };
    this.mockGrid[0][0][1] = { id: 'mock-2', name: 'Escudo',  mergeable: false, order: 1 };
    this.mockGrid[0][1][0] = { id: 'mock-3', name: 'Poción',  mergeable: false, order: 3 };
    this.mockGrid[0][2][2] = { id: 'mock-4', name: 'Hierro',  mergeable: true, sum: 2, order: 4 };
    this.mockGrid[0][2][3] = { id: 'mock-5', name: 'Hierro',  mergeable: true, sum: 3, order: 5 };
  }

  // --- Supabase (pendiente de implementar) ---

  private async loadFromSupabase(_inventoryType: string): Promise<(InventoryItem | null)[][][]> {
    // TODO: inyectar SupabaseService y hacer el fetch aquí
    // SELECT * FROM inventory_slots WHERE character_id = ? AND inventory_type = ?
    console.warn('[InventoryService] Supabase no implementado — devolviendo grid vacío');
    return this.buildGrid();
  }

  private async saveToSupabase(_grid: (InventoryItem | null)[][][], _inventoryType: string): Promise<void> {
    // TODO: DELETE + INSERT de los slots ocupados
    console.warn('[InventoryService] Supabase no implementado — guardado omitido');
  }

  // --- Utilidades ---

  buildGrid(): (InventoryItem | null)[][][] {
    return Array.from({ length: TABS }, () =>
      Array.from({ length: ROWS }, () => Array(COLS).fill(null))
    );
  }

  private clone<T>(val: T): T {
    return JSON.parse(JSON.stringify(val));
  }
}
