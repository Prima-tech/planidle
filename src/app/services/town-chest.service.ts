import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { StorageService } from './storage.service';
import { InventoryItem } from './inventory.service';

/**
 * Cofre de ciudad: almacén de items INDEPENDIENTE por cofre, COMPARTIDO entre
 * todos los personajes.
 *
 * Cada cofre físico tiene su propio ID (`chestId`) y su propio grid, persistido
 * en una clave global propia (`STORAGE_PREFIX + chestId`) directamente vía
 * StorageService. Así distintos cofres guardan cosas distintas, y cualquier
 * personaje puede dejar/recoger de cada uno (es global, no por personaje como el
 * inventario del snapshot de SaveService).
 *
 * Solo hay UNA ventana de cofre abierta a la vez, así que los IDs de celda CDK y
 * `removeRequest$` operan siempre sobre "el cofre actualmente cargado"; lo único
 * que distingue a un cofre de otro es qué clave de almacén se carga/guarda.
 */

const STORAGE_PREFIX = 'town_chest:';

/** ID reservado del cofre fijo de Asgard (no es una construcción del jugador). */
export const HOME_CHEST_ID = 'home';

const TABS = 4;
const ROWS = 4;
const COLS = 5;

@Injectable({ providedIn: 'root' })
export class TownChestService {

  /** Petición de borrado de una celda (la emite quien retira un item del cofre). */
  readonly removeRequest$ = new Subject<{ tabIndex: number; row: number; col: number }>();

  private storage = inject(StorageService);

  /** Cache de grids por ID de cofre. */
  private grids = new Map<string, (InventoryItem | null)[][][]>();

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

  async load(chestId: string): Promise<(InventoryItem | null)[][][]> {
    let grid = this.grids.get(chestId);
    if (!grid) {
      const saved: (InventoryItem | null)[][][] | null = await this.storage.get(STORAGE_PREFIX + chestId);
      grid = saved ? this.normalize(saved) : this.buildGrid();
      this.grids.set(chestId, grid);
    }
    return this.clone(grid);
  }

  async save(chestId: string, grid: (InventoryItem | null)[][][]): Promise<void> {
    const copy = this.clone(grid);
    this.grids.set(chestId, copy);
    await this.storage.set(STORAGE_PREFIX + chestId, copy);
  }

  /** Vacía por completo un cofre (al borrar el edificio que lo contiene). */
  async clear(chestId: string): Promise<void> {
    this.grids.delete(chestId);
    await this.storage.remove(STORAGE_PREFIX + chestId);
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
