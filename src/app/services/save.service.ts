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

export interface SupabaseTablePayload {
  table: string;
  operation: 'UPDATE' | 'SKIP';
  fields: Record<string, any>;
  note?: string;
}

export interface SupabasePayload {
  willSync: boolean;
  skipReason?: string;
  tables: SupabaseTablePayload[];
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

  /** Devuelve exactamente lo que se enviaría a Supabase si se pulsara "Guardar" ahora */
  async getSupabasePayload(): Promise<SupabasePayload> {
    if (OFFLINE_MODE) {
      return { willSync: false, skipReason: 'OFFLINE_MODE activo', tables: [] };
    }
    const current = this.buildSnapshot();
    const synced: GameSnapshot | null = await this.storage.get(SYNCED_KEY);
    return this.buildSupabasePayload(current, synced);
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
      const payload = this.buildSupabasePayload(current, synced);

      if (!payload.willSync) {
        console.log('[Save] Sin cambios — sync omitida');
        this.status$.next('saved');
        setTimeout(() => this.status$.next('idle'), 2000);
        return;
      }

      const globalDataTable = payload.tables.find(t => t.table === 'global_data');
      const inventoryTable  = payload.tables.find(t => t.table === 'inventory');

      const partialPS: Partial<PlayerState> = globalDataTable?.fields ?? {};
      const inventoryPayload = inventoryTable ? current.inventory : null;

      await this.supabase.saveGameData(partialPS, inventoryPayload);
      await this.storage.set(SYNCED_KEY, current);
      this.status$.next('saved');
      setTimeout(() => this.status$.next('idle'), 2000);
    } catch (e) {
      console.warn('[Save] Error al guardar en Supabase — datos seguros en local', e);
      this.status$.next('error');
      setTimeout(() => this.status$.next('idle'), 3000);
    }
  }

  private buildSupabasePayload(current: GameSnapshot, synced: GameSnapshot | null): SupabasePayload {
    const tables: SupabaseTablePayload[] = [];

    // --- global_data ---
    const psFields: Record<string, any> = {};
    const psKeys: (keyof PlayerState)[] = ['coins', 'specialCoins', 'exp', 'lvl'];
    for (const key of psKeys) {
      if (!synced || current.playerState[key] !== synced.playerState[key]) {
        psFields[key] = current.playerState[key];
      }
    }

    if (Object.keys(psFields).length > 0) {
      psFields['last_modified'] = current.lastModified;
      tables.push({ table: 'global_data', operation: 'UPDATE', fields: psFields });
    } else {
      tables.push({ table: 'global_data', operation: 'SKIP', fields: {}, note: 'Sin cambios' });
    }

    // --- inventory (pendiente de tabla propia) ---
    const inventoryChanged = !synced ||
      JSON.stringify(current.inventory) !== JSON.stringify(synced.inventory);

    if (inventoryChanged) {
      const itemCount = current.inventory.flat(2).filter(Boolean).length;
      tables.push({
        table: 'inventory',
        operation: 'UPDATE',
        fields: { slots: itemCount },
        note: `${itemCount} items (grid completo — tabla pendiente de normalizar)`,
      });
    } else {
      tables.push({ table: 'inventory', operation: 'SKIP', fields: {}, note: 'Sin cambios' });
    }

    const willSync = tables.some(t => t.operation === 'UPDATE');
    return {
      willSync,
      skipReason: willSync ? undefined : 'Todo sincronizado',
      tables,
    };
  }
}
