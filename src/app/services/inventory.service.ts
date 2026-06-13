import { inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { InventoryUnlockService } from './inventory-unlock.service';

// Cambia a false cuando Supabase esté listo para inventario
const USE_MOCK = true;

export interface InventoryItem {
  id: string;
  name: string;
  category?: string;       // tipo de slot (ej. 'Casco', 'Arma') — usado por EquipmentService
  icon?: string;
  iconSheet?: string;
  iconFrame?: number;
  iconFrameSize?: number;    // tamaño físico del frame en px (por defecto 32 para icons1)
  iconFrameCols?: number;    // columnas en el sheet (por defecto 12 para icons1)
  iconContentSize?: number;  // tamaño real del arte dentro del frame (si difiere de iconFrameSize)
  mergeable?: boolean;
  sum?: number;
  order?: number;
  description?: string;
  stats?: Record<string, number>;
  inventorySlots?: number;   // bolsas: nº de celdas de inventario que desbloquea al equiparse
}

const TABS = 4;
const ROWS = 4;
const COLS = 5;

@Injectable({ providedIn: 'root' })
export class InventoryService {

  readonly itemDropped$   = new Subject<InventoryItem>();
  readonly changes$       = new Subject<void>();
  readonly removeRequest$ = new Subject<{ tabIndex: number; row: number; col: number }>();
  /** Item que no cabe en el inventario y debe soltarse al suelo (lo escucha la escena Phaser). */
  readonly dropToWorld$   = new Subject<InventoryItem>();

  private mockGrid: (InventoryItem | null)[][][] = this.buildGrid();

  private unlock = inject(InventoryUnlockService);

  constructor() { }

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

  /** Suelta un item al suelo del mapa (no cabe en el inventario). */
  dropToWorld(item: InventoryItem): void {
    this.dropToWorld$.next(item);
  }

  getSnapshot(): (InventoryItem | null)[][][] {
    return this.clone(this.mockGrid);
  }

  restoreFromSnapshot(grid: (InventoryItem | null)[][][]): void {
    if (!grid) return;
    this.mockGrid = this.clone(grid);
    this.changes$.next();
  }

  private addToGrid(grid: (InventoryItem | null)[][][], item: InventoryItem): void {
    if (item.mergeable) {
      for (let t = 0; t < TABS; t++) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!this.unlock.isUnlocked(t, r, c)) continue;
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
          if (!this.unlock.isUnlocked(t, r, c)) continue;
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
    this.mockGrid[0][0][0] = { id: 'mock-1', name: 'Espada', icon: 'assets/icon/weapons/sword8.png', mergeable: false, order: 2, description: 'Espada de hierro forjada en Asgard.', stats: { damage: 5 } };
    this.mockGrid[0][0][1] = { id: 'mock-2', name: 'Escudo',                                         mergeable: false, order: 1, description: 'Escudo de madera reforzado con metal.', stats: { defense: 3 } };
    this.mockGrid[0][1][0] = { id: 'mock-3', name: 'Poción', icon: 'assets/icon/potion.svg',         mergeable: true,  sum: 1, order: 3, description: 'Restaura puntos de vida al usarla.', stats: { healing: 6 } };
    this.mockGrid[0][2][2] = { id: 'mock-4', name: 'Hierro',                                         mergeable: true,  sum: 2, order: 4, description: 'Material básico de forja.' };
    this.mockGrid[0][2][3] = { id: 'mock-5', name: 'Hierro',                                         mergeable: true,  sum: 3, order: 5, description: 'Material básico de forja.' };
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
