import { Injectable } from '@angular/core';
import { auditTime, BehaviorSubject, filter, merge, skip } from 'rxjs';
import { StorageService } from './storage.service';
import { PlayerStateService, PlayerState } from './player-state.service';
import { InventoryService, InventoryItem } from './inventory.service';
import { EquipmentService, EquipmentSnapshot, EquipmentLoadouts } from './equipment.service';
import { GatheringEquipmentService } from './gathering-equipment.service';
import { SupabaseService } from './supabase.service';
import { WorldService } from './world.service';
import { KillService, KillMap } from './kill.service';
import { OfflineGainsService, OfflineGains } from './offline-gains.service';
import { TalentService, TalentSnapshot, TalentLoadouts } from './talent.service';
import { SkillEquipService, SkillSlotsSnapshot } from './skill-equip.service';
import { AfkBonusService } from './afk-bonus.service';
import { AchievementService } from './achievement.service';
import { QuestService, QuestSave } from './quest.service';
import { UnlockService } from './unlock.service';
import { CharacterStatsService } from './character-stats.service';
import { ConnectionService } from './connection.service';

/**
 * true  → el botón "Guardar" solo escribe en local, nunca llama a Supabase.
 * false → el botón "Guardar" escribe en local Y sincroniza con Supabase.
 * El auto-guardado (debounce) NUNCA llama a Supabase independientemente de este flag.
 */
const OFFLINE_MODE = false;

export type SaveStatus = 'idle' | 'local' | 'remote' | 'saved' | 'error';

export interface GameSnapshot {
  playerState: PlayerState;
  inventory: (InventoryItem | null)[][][];
  /** Set activo (compat: roster/mapa leen el sprite de aquí) */
  equipment: EquipmentSnapshot;
  /** Los 3 sets de equipo; si falta (save antiguo), `equipment` migra al set 0 */
  equipmentLoadouts?: EquipmentLoadouts;
  /** Los 3 sets de equipo de recolección (pico, hacha, mochila…) */
  gatheringLoadouts?: EquipmentLoadouts;
  mapId: string;
  kills: KillMap;
  /** Config activa de talentos (compat: saves antiguos de una sola config) */
  talents?: TalentSnapshot;
  /** Las 3 configs de talentos, ligadas a los sets de equipo */
  talentLoadouts?: TalentLoadouts;
  skillSlots?: SkillSlotsSnapshot;
  baseStats?: import('./character-stats.service').BaseStats;
  /** Misiones del personaje (progreso, completadas, activas) */
  quests?: QuestSave;
  /** IDs de pasivas AFK desbloqueadas por el personaje */
  afkPassives?: string[];
  /** IDs de logros de PERSONAJE desbloqueados (los globales van en global_data) */
  achievementsChar?: string[];
  lastSeen: string;
  lastModified: string;
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
    private gathering: GatheringEquipmentService,
    private supabase: SupabaseService,
    private world: WorldService,
    private kills: KillService,
    private offlineGains: OfflineGainsService,
    private talent: TalentService,
    private skillEquip: SkillEquipService,
    private afkBonus: AfkBonusService,
    private achievements: AchievementService,
    private quests: QuestService,
    private unlocks: UnlockService,
    private charStats: CharacterStatsService,
    private connection: ConnectionService,
  ) {
    // auditTime (no debounceTime): con farmeo continuo las emisiones nunca paran
    // y un debounce no dispararía jamás — auditTime garantiza un save cada 2s de actividad
    merge(this.playerState.state$, this.inventory.changes$, this.equipment.changes$, this.gathering.changes$, this.talent.changes$, this.skillEquip.changes$)
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
    this.gathering.currentCharId = charId;   // para validar el vínculo de mascotas
    const snapshot: GameSnapshot | null = await this.storage.get(this.snapshotKey());

    if (snapshot) {
      this.playerState.setFromProfile(snapshot.playerState);
      this.inventory.restoreFromSnapshot(snapshot.inventory);
      this.equipment.restoreLoadouts(snapshot.equipmentLoadouts, snapshot.equipment ?? null);
      this.gathering.restoreLoadouts(snapshot.gatheringLoadouts ?? null);
      // Sincronizar: si los saves divergen, gathering sigue al combate
      if (this.gathering.activeLoadout !== this.equipment.activeLoadout) {
        this.gathering.switchLoadout(this.equipment.activeLoadout);
      }
      this.world.setCurrentMap(snapshot.mapId ?? 'hogar');
      this.kills.restoreCharKills(snapshot.kills ?? {});
      this.talent.restoreLoadouts(snapshot.talentLoadouts, snapshot.talents ?? null);
      // Sincronizar: si los saves divergen, los talentos siguen al combate
      if (this.talent.activeLoadout !== this.equipment.activeLoadout) {
        this.talent.switchLoadout(this.equipment.activeLoadout);
      }
      this.skillEquip.restoreFromSnapshot(snapshot.skillSlots ?? null);
      if (snapshot.baseStats) this.charStats.restoreStats(snapshot.baseStats);
    } else {
      this.playerState.setFromProfile(EMPTY_STATE);
      this.inventory.restoreFromSnapshot(this.inventory.buildGrid());
      this.equipment.restoreLoadouts(null, null);
      this.gathering.restoreLoadouts(null);
      this.world.setCurrentMap('hogar');
      this.kills.restoreCharKills({});
      this.talent.restoreLoadouts(null, null);
      this.skillEquip.restoreFromSnapshot(null);
    }
    await this.kills.loadGlobalKills();
    // load AFK passives before calculating gains so multipliers are applied.
    // snapshot?.X = datos de la nube; si el save es antiguo y no los trae,
    // loadForChar cae a la clave local (sin regresión).
    await this.afkBonus.loadForChar(charId, snapshot?.afkPassives);
    await this.achievements.loadForChar(charId, snapshot?.achievementsChar);
    await this.quests.loadForChar(charId, snapshot?.quests);
    await this.unlocks.loadForChar(charId);
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
    this.gathering.clearAll();
    this.talent.restoreLoadouts(null, null);
    this.charStats.resetStats();
    await this.unlocks.clearAll();
    await this.kills.resetAll();
    // Al final, cuando ya no hay recálculos de equipo/stats que puedan parchear
    // el estado: resetea TODO el PlayerState (nivel 1, exp 0, monedas 0, hp/mp base)
    this.playerState.setFromProfile(EMPTY_STATE);
    await this.achievements.clearAll();
    await this.quests.clearAll();
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

  // --- Internos ---

  private buildSnapshot(): GameSnapshot {
    const now = new Date().toISOString();
    return {
      playerState:  this.playerState.snapshot(),
      inventory:    this.inventory.getSnapshot(),
      equipment:    this.equipment.getSnapshot(),
      equipmentLoadouts: this.equipment.getLoadoutsSnapshot(),
      gatheringLoadouts: this.gathering.getLoadoutsSnapshot(),
      mapId:        this.world.getCurrentMap().id,
      kills:        this.kills.getCharKillsSnapshot(),
      talents:      this.talent.getSnapshot(),
      talentLoadouts: this.talent.getLoadoutsSnapshot(),
      skillSlots:   this.skillEquip.getSnapshot(),
      baseStats:    { ...this.charStats.stats },
      quests:           this.quests.getSnapshot(),
      afkPassives:      this.afkBonus.getSnapshot(),
      achievementsChar: this.achievements.getCharSnapshot(),
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
    // Sube a la nube solo si el master switch lo permite Y el usuario eligió
    // modo Supabase en el login. En modo local, el botón guarda solo en local.
    if (OFFLINE_MODE || !this.connection.useSupabase) {
      console.log('[Save] Modo local — guardado remoto omitido');
      return;
    }
    if (!this.charId) return;
    try {
      this.status$.next('remote');
      const current = this.buildSnapshot();
      // El botón es intención explícita del jugador: subimos el snapshot completo.
      await this.supabase.saveCharacterSnapshot(this.charId, current);
      // Logros de CUENTA (globales): viven en global_data, no en el personaje.
      await this.supabase.saveAccountData({ achievementsGlobal: this.achievements.getGlobalSnapshot() });
      await this.storage.set(this.syncedKey(), current);
      this.status$.next('saved');
      setTimeout(() => this.status$.next('idle'), 2000);
    } catch (e) {
      console.warn('[Save] Error al guardar en Supabase — datos seguros en local', e);
      this.status$.next('error');
      setTimeout(() => this.status$.next('idle'), 3000);
    }
  }

}
