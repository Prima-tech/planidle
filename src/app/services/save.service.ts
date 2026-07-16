import { Injectable } from '@angular/core';
import { auditTime, BehaviorSubject, filter, merge, skip } from 'rxjs';
import { StorageService } from './storage.service';
import { PlayerStateService, PlayerState } from './player-state.service';
import { InventoryService, InventoryItem } from './inventory.service';
import { slimItem, hydrateItem } from '../physics/griddrops';
import { EquipmentService, EquipmentSnapshot, EquipmentLoadouts } from './equipment.service';
import { GatheringEquipmentService } from './gathering-equipment.service';
import { GatheringSkillsService, GatheringSkillsSnapshot } from './gathering-skills.service';
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
import { ActivityService } from './activity.service';
import { CharacterStatsService } from './character-stats.service';
import { ConnectionService } from './connection.service';
import { ForgeService } from './forge.service';
import { GlobalTalentsService } from './global-talents.service';
import { MapUpgradesService } from './map-upgrades.service';
import { AccountShopService } from './account-shop.service';
import { RunProgressService } from './run-progress.service';
import { RUN_MILESTONES } from './run-milestones';

/**
 * true  → el botón "Guardar" solo escribe en local, nunca llama a Supabase.
 * false → el botón "Guardar" escribe en local Y sincroniza con Supabase.
 * El auto-guardado (debounce) NUNCA llama a Supabase independientemente de este flag.
 */
const OFFLINE_MODE = false;

export type SaveStatus = 'idle' | 'local' | 'remote' | 'saved' | 'error' | 'conflict';

/** Detalle de un conflicto de subida: la nube fue modificada desde otro dispositivo
 *  después de nuestra última sincronización, así que subir pisaría datos más nuevos. */
export interface SaveConflict {
  /** ISO del `last_modified` que tiene la nube ahora mismo. */
  remoteLastModified: string;
}

export interface GameSnapshot {
  playerState: PlayerState;
  inventory: (InventoryItem | null)[][][];
  /** Set activo (compat: roster/mapa leen el sprite de aquí) */
  equipment: EquipmentSnapshot;
  /** Los 3 sets de equipo; si falta (save antiguo), `equipment` migra al set 0 */
  equipmentLoadouts?: EquipmentLoadouts;
  /** Los 3 sets de equipo de recolección (pico, hacha, mochila…) */
  gatheringLoadouts?: EquipmentLoadouts;
  /** Progresión de skills de recolección (minería, tala): XP + nivel */
  gatheringSkills?: GatheringSkillsSnapshot;
  mapId: string;
  /** Qué hacía el personaje al dejarlo (matando, explorando, minando…). Lo muestra
   *  el roster para distinguir a los personajes AFK. */
  activity?: import('./activity.service').ActivityKind;
  kills: KillMap;
  /** Config activa de talentos (compat: saves antiguos de una sola config) */
  talents?: TalentSnapshot;
  /** Las 3 configs de talentos, ligadas a los sets de equipo */
  talentLoadouts?: TalentLoadouts;
  skillSlots?: SkillSlotsSnapshot;
  baseStats?: import('./character-stats.service').BaseStats;
  /** Atributos de minería repartidos a mano (sin coste) en la pestaña de minería */
  miningAlloc?: import('./character-stats.service').MiningAllocations;
  /** Misiones del personaje (progreso, completadas, activas) */
  quests?: QuestSave;
  /** IDs de pasivas AFK desbloqueadas por el personaje */
  afkPassives?: string[];
  /** IDs de logros de PERSONAJE desbloqueados (los globales van en global_data) */
  achievementsChar?: string[];
  lastSeen: string;
  lastModified: string;
}

// Oro y Marcas del condenado (moneda premium) iniciales de un personaje nuevo
// o tras "Borrar todo".
const STARTING_COINS = 500;
const STARTING_SPECIAL_COINS = 100;
const EMPTY_STATE: PlayerState = { coins: STARTING_COINS, specialCoins: STARTING_SPECIAL_COINS, worldKills: 0, currentKills: 0, worldBestDistanceM: 0, explorationDistanceM: 0, exp: 0, lvl: 1, hp: 100, hpMax: 100, mp: 100, mpMax: 100, lifetimeCoins: 0, totalDeaths: 0, currentDeaths: 0 };

@Injectable({ providedIn: 'root' })
export class SaveService {

  readonly status$       = new BehaviorSubject<SaveStatus>('idle');
  readonly pendingGains$ = new BehaviorSubject<OfflineGains | null>(null);
  /** Se emite cuando "Guardar" detecta que la nube es más nueva que nuestra base
   *  sincronizada (otro dispositivo guardó después). El llamador decide si forzar. */
  readonly conflict$    = new BehaviorSubject<SaveConflict | null>(null);
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
    private gatheringSkills: GatheringSkillsService,
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
    private activity: ActivityService,
    private forge: ForgeService,
    private globalTalents: GlobalTalentsService,
    private mapUpgrades: MapUpgradesService,
    private accountShop: AccountShopService,
    private runProgress: RunProgressService,
  ) {
    // auditTime (no debounceTime): con farmeo continuo las emisiones nunca paran
    // y un debounce no dispararía jamás — auditTime garantiza un save cada 2s de actividad
    // activity.current$ incluido: minar/talar/explorar cambia la actividad SIN tocar
    // playerState/inventory hasta destruir el nodo, así que sin esto el snapshot podía
    // quedarse con el 'killing' anterior y las ganancias AFK salían como combate.
    merge(this.playerState.state$, this.inventory.changes$, this.equipment.changes$, this.gathering.changes$, this.gatheringSkills.changes$, this.talent.changes$, this.skillEquip.changes$, this.activity.current$)
      .pipe(
        skip(1),
        filter(() => !this.isRestoring),
        auditTime(2000),
      )
      .subscribe(() => { if (!this.isRestoring) this.saveLocal(); })

    // El auto-save tiene un colchón de 2s (auditTime). Al refrescar o cerrar la
    // pestaña, los cambios de los últimos 2s no se habrían escrito → se perderían.
    // Forzamos un guardado cuando la página se oculta (pagehide cubre el refresco;
    // visibilitychange cubre cambiar de pestaña/minimizar en móvil).
    if (typeof window !== 'undefined') {
      const flush = () => { if (!this.isRestoring && this.charId) this.saveLocal(); };
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
    }
  }

  // --- Claves dinámicas por personaje ---

  private snapshotKey(): string {
    return this.charId ? `snapshot_char_${this.charId}` : 'snapshot_fallback';
  }

  private syncedKey(): string {
    return this.charId ? `snapshot_char_${this.charId}_synced` : 'snapshot_fallback_synced';
  }

  /** Clave de la `version` base sincronizada (concurrencia optimista). */
  private versionKey(): string {
    return this.charId ? `snapshot_char_${this.charId}_v` : 'snapshot_fallback_v';
  }

  private async getLocalVersion(): Promise<number | null> {
    const v = await this.storage.get(this.versionKey());
    return typeof v === 'number' ? v : null;
  }

  private async setLocalVersion(v: number): Promise<void> {
    await this.storage.set(this.versionKey(), v);
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
      // Rehidrata los items (icono, categoría, stats, descripción…) desde el catálogo
      // antes de repartir el snapshot: en disco solo se guardó identidad + dinámico.
      SaveService.mapSnapshotItems(snapshot, hydrateItem);
      this.playerState.setFromProfile(snapshot.playerState);
      // Migración: las estrellas/hitos vivían en el snapshot per-personaje. Fúndelos
      // (una vez por personaje) en la progresión COMPARTIDA de cuenta (RunProgress).
      await this.runProgress.mergeLegacyFromChar(
        charId,
        (snapshot.playerState as any)?.stars ?? 0,
        (snapshot.playerState as any)?.runMilestones ?? [],
      );
      this.inventory.restoreFromSnapshot(snapshot.inventory);
      this.equipment.restoreLoadouts(snapshot.equipmentLoadouts, snapshot.equipment ?? null);
      this.gathering.restoreLoadouts(snapshot.gatheringLoadouts ?? null);
      this.gatheringSkills.restoreFromSnapshot(snapshot.gatheringSkills ?? null);
      // Sincronizar: si los saves divergen, gathering sigue al combate
      if (this.gathering.activeLoadout !== this.equipment.activeLoadout) {
        this.gathering.switchLoadout(this.equipment.activeLoadout);
      }
      this.world.setCurrentMap(snapshot.mapId ?? 'hogar');
      // Restaura la actividad guardada: GameScene.create la lee para decidir si rebota
      // al Modo Mundo (activity 'exploring'); para el resto la sobrescribe según el
      // mapa. Sin esto, un personaje dejado explorando volvía siempre al combate.
      this.activity.set(snapshot.activity ?? 'idle');
      this.kills.restoreCharKills(snapshot.kills ?? {});
      this.talent.restoreLoadouts(snapshot.talentLoadouts, snapshot.talents ?? null);
      // Sincronizar: si los saves divergen, los talentos siguen al combate
      if (this.talent.activeLoadout !== this.equipment.activeLoadout) {
        this.talent.switchLoadout(this.equipment.activeLoadout);
      }
      this.skillEquip.restoreFromSnapshot(snapshot.skillSlots ?? null);
      if (snapshot.baseStats) this.charStats.restoreStats(snapshot.baseStats);
      else                    this.charStats.resetStats();
      this.charStats.restoreMining(snapshot.miningAlloc ?? null);
    } else {
      this.playerState.setFromProfile(EMPTY_STATE);
      this.inventory.restoreFromSnapshot(this.inventory.buildGrid());
      this.equipment.restoreLoadouts(null, null);
      this.gathering.restoreLoadouts(null);
      this.gatheringSkills.restoreFromSnapshot(null);
      this.world.setCurrentMap('hogar');
      this.activity.set('idle');
      this.kills.restoreCharKills({});
      this.talent.restoreLoadouts(null, null);
      this.skillEquip.restoreFromSnapshot(null);
      this.charStats.resetStats();
      this.charStats.restoreMining(null);
    }
    await this.kills.loadGlobalKills();
    // load AFK passives before calculating gains so multipliers are applied.
    // snapshot?.X = datos de la nube; si el save es antiguo y no los trae,
    // loadForChar cae a la clave local (sin regresión).
    await this.afkBonus.loadForChar(charId, snapshot?.afkPassives);
    await this.achievements.loadForChar(charId, snapshot?.achievementsChar);
    await this.quests.loadForChar(charId, snapshot?.quests);
    // Los mapas del run son desbloqueos de CUENTA: reasegura el flag GLOBAL de cada
    // mapa ya comprado (en RunProgress) ANTES de refrescar los desbloqueos, para que la
    // feature 'map.X' se otorgue en TODOS los personajes (incl. backfill de compras
    // antiguas que marcaron el flag solo per-personaje). Idempotente.
    await this.runProgress.ready();
    for (const m of RUN_MILESTONES) {
      if (m.unlockFlag && this.runProgress.has(m.id)) this.unlocks.setFlag(m.unlockFlag, 'global');
    }
    await this.unlocks.loadForChar(charId);

    // Tiempo offline: en modo Supabase lo reclama el SERVIDOR (claim_offline → segundos
    // capados con su reloj), así el del móvil no puede fabricar progreso. En modo local
    // (o si la RPC falla) caemos al cálculo con el timestamp del snapshot.
    let serverElapsedMs: number | undefined;
    if (snapshot && !OFFLINE_MODE && this.connection.useSupabase) {
      try {
        const secs = await this.supabase.claimOffline(charId);
        if (secs != null) serverElapsedMs = secs * 1000;
      } catch (e) {
        console.warn('[Save] claim_offline falló — uso tiempo local de respaldo', e);
      }
    }
    const gains = snapshot ? this.offlineGains.calculate(snapshot, serverElapsedMs) : null;
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
    this.gatheringSkills.clearAll();
    this.talent.restoreLoadouts(null, null);
    this.charStats.resetStats();
    this.charStats.restoreMining(null);
    await this.unlocks.clearAll();
    await this.kills.resetAll();
    // Al final, cuando ya no hay recálculos de equipo/stats que puedan parchear
    // el estado: resetea TODO el PlayerState (nivel 1, exp 0, monedas 0, hp/mp base)
    this.playerState.setFromProfile(EMPTY_STATE);
    await this.achievements.clearAll();
    await this.quests.clearAll();
    await this.saveLocal();
  }

  /**
   * Botón "Borrar todo": WIPE TOTAL de la cuenta. Borra TODO el storage de Ionic
   * (todos los personajes, snapshots y datos globales: ciudad, tienda, cofre,
   * logros/desbloqueos globales, kills…) más los datos de juego en localStorage.
   * Deja la app como recién instalada. El llamador debe recargar tras esto para
   * que los servicios singleton (asgard, unlocks, kills, talentos…) relean limpio.
   */
  async wipeAllData(): Promise<void> {
    this._isRestoring = true;                 // corta el auto-save mientras borramos
    await this.storage.clear();               // personajes + snapshots + globales
    try { localStorage.removeItem('hud_skill_slots'); } catch { /* sin storage */ }
    this.charId = null;
    // Reset en memoria de mapa y actividad: el llamador recarga después, pero si la
    // recarga se retrasa o se previene (en dev, webpack: "Reload prevented"), un
    // 'exploring' colgado haría que GameScene rebotara al Modo Mundo en vez de mostrar
    // Asgard. Así el estado queda limpio (hogar/idle) sin depender solo del reload.
    this.world.setCurrentMap('hogar');
    this.activity.set('idle');
    // No reseteamos _isRestoring: dejarlo en true evita que cualquier emisión
    // tardía re-escriba estado obsoleto antes de la recarga del llamador.
  }

  /**
   * Botón "Borrar cuenta (nube)": SOFT-DELETE de la cuenta de Supabase conectada.
   * 1. Marca `account.deleted` en la nube (no se borra ninguna fila: el login la
   *    rechaza vía accessBlock() y el admin puede restaurarla quitando el flag).
   * 2. Destruye la sesión guardada (signOut): sin auto-entrada al reabrir la app y
   *    sin "Continuar como invitado" en el login.
   * 3. Vacía el storage local para que el dispositivo no conserve datos obsoletos.
   * El llamador debe recargar después.
   */
  async wipeRemoteAccountData(): Promise<void> {
    await this.supabase.markAccountDeleted();   // nube primero (si falla, no tocamos nada local)
    await this.supabase.signOut();              // fuera la sesión persistida del login
    await this.wipeAllData();                   // luego el local de este dispositivo
  }

  /**
   * Botón "Guardar": escribe local y luego intenta remoto.
   * `force` = saltar el guard de conflicto y sobrescribir la nube (lo usa el llamador
   * tras confirmar con el usuario que quiere pisar una versión más nueva).
   */
  async forceSave(force = false): Promise<void> {
    await this.saveLocal();
    await this.saveRemote(force);
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

  /** Suma de niveles de TODOS los personajes de la cuenta (talentos globales).
   *  Lee el snapshot de cada personaje; si no tiene (nunca jugado) cuenta su lvl
   *  del roster (default 1). Mismo patrón que getGlobalCoins. */
  async getGlobalLevels(): Promise<number> {
    const chars: any[] = (await this.storage.get('characters')) ?? [];
    let total = 0;
    for (const char of chars) {
      const snap: GameSnapshot | null = await this.storage.get(`snapshot_char_${char.id}`);
      total += snap?.playerState?.lvl ?? char?.lvl ?? 1;
    }
    return total;
  }

  // --- Internos ---

  private buildSnapshot(): GameSnapshot {
    const now = new Date().toISOString();
    const snapshot: GameSnapshot = {
      playerState:  this.playerState.snapshot(),
      inventory:    this.inventory.getSnapshot(),
      equipment:    this.equipment.getSnapshot(),
      equipmentLoadouts: this.equipment.getLoadoutsSnapshot(),
      gatheringLoadouts: this.gathering.getLoadoutsSnapshot(),
      gatheringSkills: this.gatheringSkills.getSnapshot(),
      mapId:        this.world.getCurrentMap().id,
      activity:     this.activity.current,
      kills:        this.kills.getCharKillsSnapshot(),
      talents:      this.talent.getSnapshot(),
      talentLoadouts: this.talent.getLoadoutsSnapshot(),
      skillSlots:   this.skillEquip.getSnapshot(),
      baseStats:    { ...this.charStats.stats },
      miningAlloc:  { ...this.charStats.miningAlloc },
      quests:           this.quests.getSnapshot(),
      afkPassives:      this.afkBonus.getSnapshot(),
      achievementsChar: this.achievements.getCharSnapshot(),
      lastSeen:     now,
      lastModified: now,
    };
    // Vuelca las stats de por vida del run de ESTE personaje al agregado de cuenta
    // (RunProgress mantiene el total sumado de todos los personajes). Per-personaje
    // sigue en playerState; el total vive en RunProgress.
    if (this.charId) {
      const ps = snapshot.playerState;
      this.runProgress.reportCharStats(this.charId, {
        kills:         ps.worldKills ?? 0,
        deaths:        ps.totalDeaths ?? 0,
        bestDistanceM: ps.worldBestDistanceM ?? 0,
      });
    }
    // Persistir/sincronizar solo identidad + estado dinámico de cada item; los datos
    // estáticos (icono, categoría, stats, descripción…) son del catálogo de la app y
    // se rehidratan al cargar (ver loadCharacter). Reduce el payload y evita enviarlos.
    SaveService.mapSnapshotItems(snapshot, slimItem);
    return snapshot;
  }

  /** Aplica `fn` a cada item del snapshot esté donde esté: inventario, equipo activo
   *  y los 3 sets de equipo y de recolección. Muta el snapshot recibido (siempre es
   *  una copia fresca: recién construida al guardar, recién leída de storage al
   *  cargar). Se usa para adelgazar (slimItem) al guardar y rehidratar (hydrateItem)
   *  al cargar. */
  private static mapSnapshotItems(snapshot: GameSnapshot, fn: (it: InventoryItem) => InventoryItem): void {
    const inv = snapshot.inventory;
    if (Array.isArray(inv)) {
      for (const tab of inv) for (const row of tab) {
        for (let c = 0; c < row.length; c++) if (row[c]) row[c] = fn(row[c]!);
      }
    }
    const mapSet = (set: Record<string, InventoryItem | null> | null | undefined) => {
      if (!set) return;
      for (const k of Object.keys(set)) if (set[k]) set[k] = fn(set[k]!);
    };
    mapSet(snapshot.equipment);
    for (const s of snapshot.equipmentLoadouts?.sets ?? []) mapSet(s);
    for (const s of snapshot.gatheringLoadouts?.sets ?? []) mapSet(s);
  }

  private async saveLocal(): Promise<void> {
    if (!this.charId) return;
    this.status$.next('local');
    await this.storage.set(this.snapshotKey(), this.buildSnapshot());
    this.status$.next('saved');
    setTimeout(() => this.status$.next('idle'), 2000);
  }

  private async saveRemote(force = false): Promise<void> {
    // Sube a la nube solo si el master switch lo permite Y el usuario eligió
    // modo Supabase en el login. En modo local, el botón guarda solo en local.
    if (OFFLINE_MODE || !this.connection.useSupabase) {
      console.log('[Save] Modo local — guardado remoto omitido');
      return;
    }
    if (!this.charId) return;
    try {
      this.status$.next('remote');

      // ── Guard de conflicto (concurrencia optimista por VERSIÓN, sin relojes) ──
      // La nube lleva un contador `version`. Nuestra base = la versión que tenía la
      // nube en nuestra última sync (guardada en versionKey). El UPDATE solo escribe
      // si la versión sigue siendo esa; si otro dispositivo guardó, ya no coincide.
      const remoteMeta = await this.supabase.getRemoteCharacterMeta(this.charId);
      let base = await this.getLocalVersion();

      if (force || base == null) {
        // force: adoptamos la versión actual de la nube para garantizar la sobrescritura.
        // base == null (migración / primera sync de esta instalación): asumimos la nube
        // como nuestra base, sin disparar un falso conflicto.
        base = remoteMeta?.version ?? 0;
      } else if (remoteMeta && remoteMeta.version > base) {
        // La nube avanzó por encima de nuestra base → otro dispositivo guardó después.
        this.conflict$.next({ remoteLastModified: remoteMeta.lastModified ?? new Date().toISOString() });
        this.status$.next('conflict');
        setTimeout(() => this.status$.next('idle'), 3000);
        return;   // NO subimos: el llamador decide (forceSave(true)).
      }

      const current = this.buildSnapshot();
      // El botón es intención explícita del jugador: subimos el snapshot completo.
      const res = await this.supabase.saveCharacterSnapshot(this.charId, current, base);
      if (!res.ok) {
        // Perdimos la carrera entre el chequeo y la escritura (otro dispositivo se
        // adelantó), o la fila no existe. Re-leemos la meta para distinguir.
        const fresh = await this.supabase.getRemoteCharacterMeta(this.charId);
        if (fresh) {
          this.conflict$.next({ remoteLastModified: fresh.lastModified ?? new Date().toISOString() });
          this.status$.next('conflict');
        } else {
          this.status$.next('error');   // fila inexistente: no es un conflicto
        }
        setTimeout(() => this.status$.next('idle'), 3000);
        return;
      }
      // Logros de CUENTA (globales): viven en global_data, no en el personaje. Si esta
      // escritura falla (p.ej. RLS de global_data), NO debe tumbar el guardado del
      // personaje que ya tuvo éxito: lo aislamos.
      try {
        await this.supabase.saveAccountData({
          achievementsGlobal: this.achievements.getGlobalSnapshot(),
          globalTalents: this.globalTalents.getSnapshot(),   // talentos globales de cuenta
          mapUpgrades: this.mapUpgrades.getSnapshot(),       // mejoras de mapa (cofre central)
          accountShop: this.accountShop.getSnapshot(),       // compras de la tienda premium
          runProgress: this.runProgress.getSnapshot(),       // estrellas + hitos del run (compartidos)
        });
      } catch (e) {
        console.warn('[Save] global_data no se pudo actualizar (logros/mejoras de cuenta)', e);
      }
      // Forjas de cuenta: por RPC aparte, que sella el tiempo en el SERVIDOR
      // (anti-trampa de reloj). Aislado: si falla, no tumba el guardado.
      try {
        await this.supabase.saveForges(this.forge.getAccountSnapshot());
      } catch (e) {
        console.warn('[Save] forjas no se pudieron sincronizar', e);
      }
      await this.storage.set(this.syncedKey(), current);
      await this.setLocalVersion(res.version);   // nuestra nueva base sincronizada
      this.status$.next('saved');
      setTimeout(() => this.status$.next('idle'), 2000);
    } catch (e) {
      console.warn('[Save] Error al guardar en Supabase — datos seguros en local', e);
      this.status$.next('error');
      setTimeout(() => this.status$.next('idle'), 3000);
    }
  }

}
