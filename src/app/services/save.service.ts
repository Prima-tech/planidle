import { Injectable } from '@angular/core';
import { BehaviorSubject, debounceTime, merge, skip } from 'rxjs';
import { StorageService } from './storage.service';
import { PlayerStateService, PlayerState } from './player-state.service';
import { InventoryService, InventoryItem } from './inventory.service';
import { SupabaseService } from './supabase.service';

/** true → nunca llama a Supabase, solo guarda en local (desarrollo sin backend) */
const OFFLINE_MODE = false;

const SNAPSHOT_KEY = 'game_snapshot';
const SYNCED_KEY   = 'game_snapshot_synced';

export type SaveStatus = 'idle' | 'local' | 'remote' | 'saved' | 'error';

export interface GameSnapshot {
  playerState: PlayerState;
  inventory: (InventoryItem | null)[][][];
  lastModified: string;
}

export interface FieldChange {
  from: number;
  to: number;
  diff: number;
}

export interface InventoryItemDelta {
  name: string;
  type: 'added' | 'removed' | 'changed';
  from: number;
  to: number;
  diff: number;
}

export interface InventorySummaryEntry {
  name: string;
  total: number;
}

export interface ChangeDelta {
  hasChanges: boolean;
  isFirstSync: boolean;
  lastSyncedAt: string | null;
  currentLocalAt: string | null;
  playerState: Partial<Record<keyof PlayerState, FieldChange>>;
  inventoryChanged: boolean;
  inventoryDelta: InventoryItemDelta[];
}

export interface LocalInfo {
  playerState: PlayerState;
  itemCount: number;
  tabsUsed: number;
  inventorySummary: InventorySummaryEntry[];
  lastModified: string | null;
  lastSynced: string | null;
}

@Injectable({ providedIn: 'root' })
export class SaveService {

  readonly status$ = new BehaviorSubject<SaveStatus>('idle');

  constructor(
    private storage: StorageService,
    private playerState: PlayerStateService,
    private inventory: InventoryService,
    private supabase: SupabaseService,
  ) {
    merge(this.playerState.state$, this.inventory.changes$)
      .pipe(skip(1), debounceTime(2000))
      .subscribe(() => this.saveLocal());
  }

  async loadAll(): Promise<void> {
    const snapshot: GameSnapshot | null = await this.storage.get(SNAPSHOT_KEY);
    if (!snapshot) return;
    this.playerState.setFromProfile(snapshot.playerState);
    this.inventory.restoreFromSnapshot(snapshot.inventory);
  }

  async forceSave(): Promise<void> {
    await this.saveLocal();
    await this.saveRemote();
  }

  /** Datos actuales en local storage con resumen de inventario */
  async getLocalInfo(): Promise<LocalInfo> {
    const snap: GameSnapshot | null = await this.storage.get(SNAPSHOT_KEY);
    const synced: GameSnapshot | null = await this.storage.get(SYNCED_KEY);

    const grid = snap?.inventory ?? this.inventory.getSnapshot();
    const flat  = grid.flat(2).filter(Boolean) as InventoryItem[];
    const tabsUsed = grid.filter(tab => tab.flat().some(Boolean)).length;

    return {
      playerState:      snap?.playerState ?? this.playerState.snapshot(),
      itemCount:        flat.length,
      tabsUsed,
      inventorySummary: this.summarizeInventory(grid),
      lastModified:     snap?.lastModified  ?? null,
      lastSynced:       synced?.lastModified ?? null,
    };
  }

  /** Diferencias entre estado actual y último guardado en Supabase */
  async getDelta(): Promise<ChangeDelta> {
    const current = this.buildSnapshot();
    const synced: GameSnapshot | null = await this.storage.get(SYNCED_KEY);

    if (!synced) {
      const allItems = this.computeInventoryDelta([], current.inventory);
      return {
        hasChanges:       true,
        isFirstSync:      true,
        lastSyncedAt:     null,
        currentLocalAt:   current.lastModified,
        playerState:      {},
        inventoryChanged: allItems.length > 0,
        inventoryDelta:   allItems,
      };
    }

    const psChanges: ChangeDelta['playerState'] = {};
    const keys: (keyof PlayerState)[] = ['coins', 'specialCoins', 'exp', 'lvl'];
    for (const key of keys) {
      const from = synced.playerState[key] as number;
      const to   = current.playerState[key] as number;
      if (from !== to) psChanges[key] = { from, to, diff: to - from };
    }

    const inventoryDelta   = this.computeInventoryDelta(synced.inventory, current.inventory);
    const inventoryChanged = inventoryDelta.length > 0;

    return {
      hasChanges:       Object.keys(psChanges).length > 0 || inventoryChanged,
      isFirstSync:      false,
      lastSyncedAt:     synced.lastModified,
      currentLocalAt:   current.lastModified,
      playerState:      psChanges,
      inventoryChanged,
      inventoryDelta,
    };
  }

  // --- Utilidades de inventario ---

  /** Agrupa items por nombre sumando cantidades */
  private summarizeInventory(grid: (InventoryItem | null)[][][]): InventorySummaryEntry[] {
    const totals: Record<string, number> = {};
    grid.flat(2).filter(Boolean).forEach((item: InventoryItem) => {
      totals[item.name] = (totals[item.name] ?? 0) + (item.sum ?? 1);
    });
    return Object.entries(totals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Compara dos grids y devuelve los cambios por item */
  private computeInventoryDelta(
    from: (InventoryItem | null)[][][],
    to:   (InventoryItem | null)[][][],
  ): InventoryItemDelta[] {
    const sum = (grid: (InventoryItem | null)[][][]) => {
      const map: Record<string, number> = {};
      grid.flat(2).filter(Boolean).forEach((item: InventoryItem) => {
        map[item.name] = (map[item.name] ?? 0) + (item.sum ?? 1);
      });
      return map;
    };

    const fromMap = sum(from);
    const toMap   = sum(to);
    const names   = new Set([...Object.keys(fromMap), ...Object.keys(toMap)]);
    const delta: InventoryItemDelta[] = [];

    for (const name of names) {
      const f = fromMap[name] ?? 0;
      const t = toMap[name]   ?? 0;
      if (f === t) continue;
      delta.push({
        name,
        type: f === 0 ? 'added' : t === 0 ? 'removed' : 'changed',
        from: f,
        to:   t,
        diff: t - f,
      });
    }

    return delta.sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildSnapshot(): GameSnapshot {
    return {
      playerState:  this.playerState.snapshot(),
      inventory:    this.inventory.getSnapshot(),
      lastModified: new Date().toISOString(),
    };
  }

  private async saveLocal(): Promise<void> {
    this.status$.next('local');
    await this.storage.set(SNAPSHOT_KEY, this.buildSnapshot());
    this.status$.next('saved');
    setTimeout(() => this.status$.next('idle'), 2000);
  }

  private async saveRemote(): Promise<void> {
    if (OFFLINE_MODE) {
      console.log('[Save] Modo offline — guardado remoto omitido');
      return;
    }
    try {
      this.status$.next('remote');
      const current = this.buildSnapshot();
      const synced: GameSnapshot | null = await this.storage.get(SYNCED_KEY);

      // Solo envía los campos de playerState que hayan cambiado
      const partialPS: Partial<PlayerState> = {};
      const keys: (keyof PlayerState)[] = ['coins', 'specialCoins', 'exp', 'lvl'];
      for (const key of keys) {
        if (!synced || current.playerState[key] !== synced.playerState[key]) {
          partialPS[key] = current.playerState[key];
        }
      }
      const inventoryChanged =
        !synced || JSON.stringify(current.inventory) !== JSON.stringify(synced.inventory);

      if (Object.keys(partialPS).length === 0 && !inventoryChanged) {
        console.log('[Save] Sin cambios — sync omitida');
        this.status$.next('saved');
        setTimeout(() => this.status$.next('idle'), 2000);
        return;
      }

      await this.supabase.saveGameData(
        partialPS,
        inventoryChanged ? current.inventory : null
      );

      // Marca como sincronizado
      await this.storage.set(SYNCED_KEY, current);
      this.status$.next('saved');
      setTimeout(() => this.status$.next('idle'), 2000);
    } catch (e) {
      console.warn('[Save] Error al guardar en Supabase — datos seguros en local', e);
      this.status$.next('error');
      setTimeout(() => this.status$.next('idle'), 3000);
    }
  }
}
