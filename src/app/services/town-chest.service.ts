import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { StorageService } from './storage.service';
import { InventoryItem } from './inventory.service';

/**
 * Cofre de ciudad: almacén de items COMPARTIDO entre todos los personajes.
 *
 * A diferencia del inventario (que vive en el snapshot por personaje de
 * SaveService), el cofre se persiste en una clave global única
 * (`STORAGE_KEY`) directamente vía StorageService. Así un personaje puede
 * dejar algo y otro personaje recogerlo.
 */

const STORAGE_KEY = 'town_chest';

const TABS = 4;
const ROWS = 4;
const COLS = 5;

@Injectable({ providedIn: 'root' })
export class TownChestService {

  /** Petición de borrado de una celda (la emite quien retira un item del cofre). */
  readonly removeRequest$ = new Subject<{ tabIndex: number; row: number; col: number }>();

  private storage = inject(StorageService);

  private grid: (InventoryItem | null)[][][] | null = null;

  /** IDs CDK de cada celda del cofre (`chest-tab-row-col`). */
  private readonly _cellIds: string[] = (() => {
    const ids: string[] = [];
    for (let t = 0; t < TABS; t++)
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          ids.push(`chest-${t}-${r}-${c}`);
    return ids;
  })();

  get cellIds(): string[] {
    return this._cellIds;
  }

  async load(): Promise<(InventoryItem | null)[][][]> {
    if (!this.grid) {
      const saved: (InventoryItem | null)[][][] | null = await this.storage.get(STORAGE_KEY);
      this.grid = saved ? this.normalize(saved) : this.buildGrid();
    }
    return this.clone(this.grid);
  }

  async save(grid: (InventoryItem | null)[][][]): Promise<void> {
    this.grid = this.clone(grid);
    await this.storage.set(STORAGE_KEY, this.grid);
  }

  /** Vacía por completo el cofre (al borrar el edificio que lo contiene). */
  async clear(): Promise<void> {
    this.grid = this.buildGrid();
    await this.storage.set(STORAGE_KEY, this.grid);
  }

  buildGrid(): (InventoryItem | null)[][][] {
    return Array.from({ length: TABS }, () =>
      Array.from({ length: ROWS }, () => Array(COLS).fill(null))
    );
  }

  generateId(): string {
    return `chest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /** Rellena un grid guardado con dimensiones distintas para que siempre sea TABS×ROWS×COLS. */
  private normalize(saved: (InventoryItem | null)[][][]): (InventoryItem | null)[][][] {
    const grid = this.buildGrid();
    for (let t = 0; t < TABS; t++)
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          grid[t][r][c] = saved?.[t]?.[r]?.[c] ?? null;
    return grid;
  }

  private clone<T>(val: T): T {
    return JSON.parse(JSON.stringify(val));
  }
}
