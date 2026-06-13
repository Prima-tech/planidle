import { Injectable } from '@angular/core';
import { auditTime, BehaviorSubject, filter, merge, skip } from 'rxjs';
import { StorageService } from './storage.service';
import { PlayerStateService, PlayerState } from './player-state.service';
import { InventoryService, InventoryItem } from './inventory.service';
import { EquipmentService, EquipmentSnapshot, EquipmentLoadouts } from './equipment.service';
import { SupabaseService } from './supabase.service';
import { WorldService } from './world.service';
import { KillService, KillMap } from './kill.service';
import { OfflineGainsService, OfflineGains } from './offline-gains.service';
import { TalentService, TalentSnapshot } from './talent.service';
import { SkillEquipService, SkillSlotsSnapshot } from './skill-equip.service';
import { AfkBonusService } from './afk-bonus.service';
import { AchievementService } from './achievement.service';
import { CharacterStatsService } from './character-stats.service';

/**
 * true  → el botón "Guardar" solo escribe en local, nunca llama a Supabase.
 * false → el botón "Guardar" escribe en local Y sincroniza con Supabase.
 * El auto-guardado (debounce) NUNCA llama a Supabase independientemente de este flag.
 */
const OFFLINE_MODE = true;

export type SaveStatus = 'idle' | 'local' | 'remote' | 'saved' | 'error';

export interface GameSnapshot {
  playerState: PlayerState;
  inventory: (InventoryItem | null)[][][];
  /** Set activo (compat: roster/mapa leen el sprite de aquí) */
  equipment: EquipmentSnapshot;
  /** Los 3 sets de equipo; si falta (save antiguo), `equipment` migra al set 0 */
  equipmentLoadouts?: EquipmentLoadouts;
  mapId: string;
  kills: KillMap;
  talents?: TalentSnapshot;
  skillSlots?: SkillSlotsSnapshot;
  baseStats?: import('./character-stats.service').BaseStats;
  lastSeen: string;
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

const EMPTY_STATE: PlayerState = { coins: 0, specialCoins: 0, exp: 0, lvl: 1, hp: 100, hpMax: 100, mp: 100, mpMax: 100, lifetimeCoins: 0, totalDeaths: 0 };

@Injectable({ providedIn: 'root' })
export class SaveService {

  readonly status$       = new BehaviorSubject<SaveStatus>('idle');
  readonly pendingGains$ = new BehaviorSubject<OfflineGains | null>(null);
  private charId: string | null = null;
  private _isRestoring  = false;

  /** true mientras loadCharacter() restaura un snapshot (bloquea auto-save y
   *  sirve de guard para no disparar efectos con los valores restaurados) */
  get isRestoring(): boolean { return this._isRestoring; }

  constructor(
    private storage: StorageService,
    private playerState: PlayerStateService,
    private inventory: InventoryService,
    private equipment: EquipmentService,
    private supabase: SupabaseService,
    private world: WorldService,
    private kills: KillService,
    private offlineGains: OfflineGainsService,
    private talent: TalentService,
    private skillEquip: SkillEquipService,
    private afkBonus: AfkBonusService,
    private achievements: AchievementService,
    private charStats: CharacterStatsService,
  ) {
    // auditTime (no debounceTime): con farmeo continuo las emisiones nunca paran
    // y un debounce no dispararía jamás — auditTime garantiza un save cada 2s de actividad
    merge(this.playerState.state$, this.inventory.changes$, this.equipment.changes$, this.talent.changes$, this.skillEquip.changes$)
      .pipe(
        skip(1),
        filter(() => !this.isRestoring),
        auditTime(2000),
      )
      .subscribe(() => { if (!this.isRestoring) this.saveLocal(); })
  }

  // --- Claves dinámicas por personaje ---

  private snapshotKey(): string {
    return this.charId ? `snapshot_char_${this.charId}` : 'snapshot_fallback';
  }

  private syncedKey(): string {
    return this.charId ? `snapshot_char_${this.charId}_synced` : 'snapshot_fallback_synced';
  }

  // --- Ciclo de vida de personaje ---

  /**
   * Llama al seleccionar un personaje.
   * Carga su snapshot local (si existe) o inicializa en limpio.
   */
  async loadCharacter(charId: string): Promise<void> {
    this._isRestoring = true;
    this.charId = charId;
    const snapshot: GameSnapshot | null = await this.storage.get(this.snapshotKey());

    if (snapshot) {
      this.playerState.setFromProfile(snapshot.playerState);
      this.inventory.restoreFromSnapshot(snapshot.inventory);
      this.equipment.restoreLoadouts(snapshot.equipmentLoadouts, snapshot.equipment ?? null);
      this.world.setCurrentMap(snapshot.mapId ?? 'hogar');
      this.kills.restoreCharKills(snapshot.kills ?? {});
      this.talent.restoreFromSnapshot(snapshot.talents ?? null);
      this.skillEquip.restoreFromSnapshot(snapshot.skillSlots ?? null);
      if (snapshot.baseStats) this.charStats.restoreStats(snapshot.baseStats);
    } else {
      this.playerState.setFromProfile(EMPTY_STATE);
      this.inventory.restoreFromSnapshot(this.inventory.buildGrid());
      this.equipment.restoreLoadouts(null, null);
      this.world.setCurrentMap('hogar');
      this.kills.restoreCharKills({});
      this.talent.restoreFromSnapshot(null);
      this.skillEquip.restoreFromSnapshot(null);
    }
    await this.kills.loadGlobalKills();
    // load AFK passives before calculating gains so multipliers are applied
    await this.afkBonus.loadForChar(charId);
    await this.achievements.loadForChar(charId);
    const gains = snapshot ? this.offlineGains.calculate(snapshot) : null;
    this.pendingGains$.next(gains);
    this._isRestoring = false;
  }

  /**
   * Llama antes de cambiar de personaje.
   * Guarda en local el estado actual del personaje activo.
   */
  async saveCurrentCharacter(): Promise<void> {
    if (!this.charId) return;
    await this.saveLocal();
  }

  /**
   * Botón "Borrar todo": resetea monedas a 0 e inventario vacío para el personaje activo.
   */
  async clearCurrentCharacter(): Promise<void> {
    if (!this.charId) return;
    this.inventory.restoreFromSnapshot(this.inventory.buildGrid());
    this.equipment.clearAll();
    this.talent.restoreFromSnapshot(null);
    this.charStats.resetStats();
    // Al final, cuando ya no hay recálculos de equipo/stats que puedan parchear
    // el estado: resetea TODO el PlayerState (nivel 1, exp 0, monedas 0, hp/mp base)
    this.playerState.setFromProfile(EMPTY_STATE);
    await this.achievements.clearForChar();
    await this.saveLocal();
  }

  /** Botón "Guardar": escribe local y luego intenta remoto */
  async forceSave(): Promise<void> {
    await this.saveLocal();
    await this.saveRemote();
  }

  // --- Inspección ---

  async getGlobalCoins(): Promise<number> {
    const chars: any[] = (await this.storage.get('characters')) ?? [];
    let total = 0;
    for (const char of chars) {
      const snap: GameSnapshot | null = await this.storage.get(`snapshot_char_${char.id}`);
      if (snap?.playerState) total += snap.playerState.coins ?? 0;
    }
    return total;
  }

  async getLocalInfo(): Promise<LocalInfo> {
    const snap: GameSnapshot | null   = await this.storage.get(this.snapshotKey());
    const synced: GameSnapshot | null = await this.storage.get(this.syncedKey());

    const grid     = snap?.inventory ?? this.inventory.getSnapshot();
    const flat     = grid.flat(2).filter(Boolean) as InventoryItem[];
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

  async getDelta(): Promise<ChangeDelta> {
    const current = this.buildSnapshot();
    const synced: GameSnapshot | null = await this.storage.get(this.syncedKey());

    if (!synced) {
      const allItems = this.computeInventoryDelta([], current.inventory);
      return {
        hasChanges: true, isFirstSync: true,
        lastSyncedAt: null, currentLocalAt: current.lastModified,
        playerState: {}, inventoryChanged: allItems.length > 0, inventoryDelta: allItems,
      };
    }

    const psChanges: ChangeDelta['playerState'] = {};
    for (const key of (['coins', 'specialCoins', 'exp', 'lvl'] as (keyof PlayerState)[])) {
      const from = synced.playerState[key] as number;
      const to   = current.playerState[key] as number;
      if (from !== to) psChanges[key] = { from, to, diff: to - from };
    }

    const inventoryDelta   = this.computeInventoryDelta(synced.inventory, current.inventory);
    const inventoryChanged = inventoryDelta.length > 0;

    return {
      hasChanges: Object.keys(psChanges).length > 0 || inventoryChanged,
      isFirstSync: false,
      lastSyncedAt: synced.lastModified, currentLocalAt: current.lastModified,
      playerState: psChanges, inventoryChanged, inventoryDelta,
    };
  }

  async getSupabasePayload(): Promise<SupabasePayload> {
    if (OFFLINE_MODE) return { willSync: false, skipReason: 'OFFLINE_MODE activo', tables: [] };
    const current = this.buildSnapshot();
    const synced: GameSnapshot | null = await this.storage.get(this.syncedKey());
    return this.buildSupabasePayload(current, synced);
  }

  // --- Internos ---

  private buildSnapshot(): GameSnapshot {
    const now = new Date().toISOString();
    return {
      playerState:  this.playerState.snapshot(),
      inventory:    this.inventory.getSnapshot(),
      equipment:    this.equipment.getSnapshot(),
      equipmentLoadouts: this.equipment.getLoadoutsSnapshot(),
      mapId:        this.world.getCurrentMap().id,
      kills:        this.kills.getCharKillsSnapshot(),
      talents:      this.talent.getSnapshot(),
      skillSlots:   this.skillEquip.getSnapshot(),
      baseStats:    { ...this.charStats.stats },
      lastSeen:     now,
      lastModified: now,
    };
  }

  private async saveLocal(): Promise<void> {
    if (!this.charId) return;
    this.status$.next('local');
    await this.storage.set(this.snapshotKey(), this.buildSnapshot());
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
      const synced: GameSnapshot | null = await this.storage.get(this.syncedKey());
      const payload = this.buildSupabasePayload(current, synced);

      if (!payload.willSync) {
        console.log('[Save] Sin cambios — sync omitida');
        this.status$.next('saved');
        setTimeout(() => this.status$.next('idle'), 2000);
        return;
      }

      const globalDataTable = payload.tables.find(t => t.table === 'global_data');
      const inventoryTable  = payload.tables.find(t => t.table === 'inventory');
      await this.supabase.saveGameData(
        globalDataTable?.fields ?? {},
        inventoryTable ? current.inventory : null
      );
      await this.storage.set(this.syncedKey(), current);
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

    const psFields: Record<string, any> = {};
    for (const key of (['coins', 'specialCoins', 'exp', 'lvl'] as (keyof PlayerState)[])) {
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

    const inventoryChanged = !synced ||
      JSON.stringify(current.inventory) !== JSON.stringify(synced.inventory);
    if (inventoryChanged) {
      const itemCount = current.inventory.flat(2).filter(Boolean).length;
      tables.push({
        table: 'inventory', operation: 'UPDATE', fields: { slots: itemCount },
        note: `${itemCount} items (grid completo — tabla pendiente de normalizar)`,
      });
    } else {
      tables.push({ table: 'inventory', operation: 'SKIP', fields: {}, note: 'Sin cambios' });
    }

    const lastSeenChanged = !synced || current.lastSeen !== synced.lastSeen;
    if (lastSeenChanged) {
      tables.push({ table: 'characters', operation: 'UPDATE', fields: { last_seen: current.lastSeen } });
    } else {
      tables.push({ table: 'characters', operation: 'SKIP', fields: {}, note: 'Sin cambios' });
    }

    const willSync = tables.some(t => t.operation === 'UPDATE');
    return { willSync, skipReason: willSync ? undefined : 'Todo sincronizado', tables };
  }

  private summarizeInventory(grid: (InventoryItem | null)[][][]): InventorySummaryEntry[] {
    const totals: Record<string, number> = {};
    grid.flat(2).filter(Boolean).forEach((item: InventoryItem) => {
      totals[item.name] = (totals[item.name] ?? 0) + (item.sum ?? 1);
    });
    return Object.entries(totals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

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
      delta.push({ name, type: f === 0 ? 'added' : t === 0 ? 'removed' : 'changed', from: f, to: t, diff: t - f });
    }
    return delta.sort((a, b) => a.name.localeCompare(b.name));
  }
}
