import { inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { InventoryUnlockService } from './inventory-unlock.service';

// El inventario vive en memoria en este servicio y se persiste (local y Supabase)
// dentro del GameSnapshot vía SaveService (getSnapshot/restoreFromSnapshot).
export interface InventoryItem {
  id: string;
  name: string;
  category?: string;       // tipo de slot (ej. 'Casco', 'Arma') — usado por EquipmentService
  icon?: string;
  iconSheet?: string;
  iconFrame?: number;
  iconFrameSize?: number;    // tamaño físico del frame en px (por defecto 32)
  iconFrameCols?: number;    // columnas en el sheet (por defecto 12)
  iconContentSize?: number;  // tamaño real del arte dentro del frame (si difiere de iconFrameSize)
  mergeable?: boolean;
  sum?: number;
  order?: number;
  description?: string;
  stats?: Record<string, number>;
  inventorySlots?: number;   // bolsas: nº de celdas de inventario que desbloquea al equiparse
  weaponKind?: 'melee' | 'ranged';  // armas: 'ranged' (bastones) → ataque básico a distancia
  petId?: string;            // mascotas: id en PET_REGISTRY para renderizar/seguir al jugador
  petLevel?: number;         // mascotas: nivel propio (1..PET_MAX_LEVEL)
  petExp?: number;           // mascotas: exp acumulada hacia el siguiente nivel
  boundCharId?: string;      // mascotas: id del personaje al que está vinculada (solo equipable ahí)
  boundCharName?: string;    // mascotas: nombre del personaje vinculado (para mostrar en la ficha)
}

const TABS = 4;
const ROWS = 4;
const COLS = 5;

@Injectable({ providedIn: 'root' })
export class InventoryService {

  readonly itemDropped$   = new Subject<InventoryItem>();
  readonly changes$       = new Subject<void>();
  readonly removeRequest$ = new Subject<{ tabIndex: number; row: number; col: number }>();
  /** Pide al componente de inventario que recargue su grid vivo desde el grid del servicio
   *  (tras un consumo externo, p.ej. pagar una mejora de mapa con materiales). */
  readonly reload$        = new Subject<void>();
  /** Item que no cabe en el inventario y debe soltarse al suelo (lo escucha la escena Phaser). */
  readonly dropToWorld$   = new Subject<InventoryItem>();

  private grid: (InventoryItem | null)[][][] = this.buildGrid();

  private unlock = inject(InventoryUnlockService);

  constructor() { }

  async load(): Promise<(InventoryItem | null)[][][]> {
    return this.clone(this.grid);
  }

  async save(grid: (InventoryItem | null)[][][]): Promise<void> {
    this.grid = this.clone(grid);
    this.changes$.next();
  }

  addDroppedItem(item: InventoryItem): void {
    this.addToGrid(this.grid, item);
    this.itemDropped$.next(item);
    this.changes$.next();
  }

  /** Suelta un item al suelo del mapa (no cabe en el inventario). */
  dropToWorld(item: InventoryItem): void {
    this.dropToWorld$.next(item);
  }

  /** Mete el item en el inventario; si está lleno, lo suelta al suelo del mapa. */
  addOrDropToWorld(item: InventoryItem): void {
    if (this.addToGrid(this.grid, item)) {
      this.itemDropped$.next(item);
      this.changes$.next();
    } else {
      this.dropToWorld(item);
    }
  }

  getSnapshot(): (InventoryItem | null)[][][] {
    return this.clone(this.grid);
  }

  restoreFromSnapshot(grid: (InventoryItem | null)[][][]): void {
    if (!grid) return;
    this.grid = this.clone(grid);
    this.changes$.next();
  }

  /**
   * ¿Cabe este item en el inventario? true si es apilable y ya hay una pila del
   * mismo nombre, o si queda alguna celda desbloqueada vacía. Lo usa la mascota
   * para decidir si recoge un drop del suelo.
   */
  hasSpaceFor(item: { name: string; mergeable?: boolean }): boolean {
    if (item.mergeable) {
      for (let t = 0; t < TABS; t++)
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++) {
            if (!this.unlock.isUnlocked(t, r, c)) continue;
            const existing = this.grid[t][r][c];
            if (existing?.mergeable && existing.name === item.name) return true;
          }
    }
    for (let t = 0; t < TABS; t++)
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          if (!this.unlock.isUnlocked(t, r, c)) continue;
          if (!this.grid[t][r][c]) return true;
        }
    return false;
  }

  /** Coloca/apila el item en el grid. Devuelve true si cupo, false si estaba lleno. */
  private addToGrid(grid: (InventoryItem | null)[][][], item: InventoryItem): boolean {
    if (item.mergeable) {
      for (let t = 0; t < TABS; t++) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!this.unlock.isUnlocked(t, r, c)) continue;
            const existing = grid[t][r][c];
            if (existing?.mergeable && existing.name === item.name) {
              existing.sum = (existing.sum ?? 0) + (item.sum ?? 1);
              return true;
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
            return true;
          }
        }
      }
    }
    return false;
  }

  /** Suma total de un material apilable por nombre (todas las pilas del inventario). */
  countByName(name: string): number {
    let total = 0;
    for (let t = 0; t < TABS; t++)
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const it = this.grid[t][r][c];
          if (it && it.name === name) total += it.sum ?? 1;
        }
    return total;
  }

  /** Gasta `qty` unidades de un material por nombre. Devuelve false (sin tocar nada) si no hay suficientes. */
  consumeByName(name: string, qty: number): boolean {
    if (qty <= 0) return true;
    if (this.countByName(name) < qty) return false;
    let left = qty;
    for (let t = 0; t < TABS && left > 0; t++)
      for (let r = 0; r < ROWS && left > 0; r++)
        for (let c = 0; c < COLS && left > 0; c++) {
          const it = this.grid[t][r][c];
          if (!it || it.name !== name) continue;
          const have = it.sum ?? 1;
          const take = Math.min(have, left);
          left -= take;
          if (have - take > 0) it.sum = have - take;
          else this.grid[t][r][c] = null;
        }
    this.changes$.next();
    // El componente de inventario (si está vivo) trabaja sobre su propio clon y
    // reescribe el grid al guardar; pídele que recargue para que no pise el descuento.
    this.reload$.next();
    return true;
  }

  generateId(): string {
    return `itm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
