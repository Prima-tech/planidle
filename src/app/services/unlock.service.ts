import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { StorageService } from './storage.service';
import { KillService } from './kill.service';
import { PlayerStateService } from './player-state.service';
import { AchievementService, ACHIEVEMENTS } from './achievement.service';
import { AdminService } from './admin.service';
import {
  FEATURES, FeatureDef, UnlockScope, UnlockSource, characterFeatureId,
} from './unlock-config';

// Servicio de desbloqueos. Ver unlock-config.ts para las reglas.
//
//   - Cada feature del registro está bloqueada hasta que se cumplen sus
//     condiciones; lo que no está en el registro está siempre disponible.
//   - El desbloqueo se persiste por scope (char/global) en Sets monotónicos,
//     igual que AchievementService. Se guarda al instante (no espera al
//     debounce del snapshot) y queda listo para sincronizar con Supabase.
//   - Los desbloqueos de personaje son por personaje (cada uno su propio Set).

const GLOBAL_KEY        = 'unlocks_global';
const GLOBAL_FLAGS_KEY  = 'flags_global';
const charKey      = (id: string) => `unlocks_char_${id}`;
const charFlagsKey = (id: string) => `flags_char_${id}`;

@Injectable({ providedIn: 'root' })
export class UnlockService {

  /** Emite cuando se desbloquea algo nuevo (para badges / notificaciones). */
  readonly changes$ = new Subject<void>();

  /** Emite la feature recién desbloqueada (no silencioso). El toast solo se
   *  muestra si la feature define `toast` (ver achievement-toast.component). */
  readonly unlocked$ = new Subject<FeatureDef>();

  private charId: string | null = null;

  private unlockedChar   = new Set<string>();
  private unlockedGlobal = new Set<string>();
  private flagsChar      = new Set<string>();
  private flagsGlobal    = new Set<string>();

  constructor(
    private storage: StorageService,
    private kills: KillService,
    private playerState: PlayerStateService,
    private achievements: AchievementService,
    private admin: AdminService,
  ) {}

  // ── Carga ─────────────────────────────────────────────────────────────────

  /** Carga el estado global (sin personaje). Úsalo en la pantalla de selección. */
  async loadGlobal(): Promise<void> {
    this.unlockedGlobal = new Set((await this.storage.get(GLOBAL_KEY)) ?? []);
    this.flagsGlobal    = new Set((await this.storage.get(GLOBAL_FLAGS_KEY)) ?? []);
    try { await this.kills.loadGlobalKills(); } catch { /* best-effort */ }
    this.refreshGlobal(true);
  }

  /** Llamado por SaveService.loadCharacter. Carga char + global y consolida. */
  async loadForChar(charId: string): Promise<void> {
    this.charId = charId;
    this.unlockedChar   = new Set((await this.storage.get(charKey(charId)))      ?? []);
    this.unlockedGlobal = new Set((await this.storage.get(GLOBAL_KEY))           ?? []);
    this.flagsChar      = new Set((await this.storage.get(charFlagsKey(charId))) ?? []);
    this.flagsGlobal    = new Set((await this.storage.get(GLOBAL_FLAGS_KEY))     ?? []);
    this.refresh(true);
  }

  // ── Consulta (para plantillas) ──────────────────────────────────────────────

  /** ¿Está desbloqueada/usable? Lo que no está en el registro siempre lo está. */
  isUnlocked(id: string): boolean {
    const def = this.def(id);
    if (!def) return true;
    const set = def.scope === 'global' ? this.unlockedGlobal : this.unlockedChar;
    if (set.has(id)) return true;
    // Commit perezoso y silencioso: mantiene las plantillas correctas sin
    // disparar changes$ durante la detección de cambios de Angular.
    if (this.isSatisfied(def)) { this.grant(def, true); return true; }
    return false;
  }

  /** ¿Debe renderizarse el elemento? Lo oculto desaparece; lo de candado se muestra. */
  isVisible(id: string): boolean {
    const def = this.def(id);
    if (!def) return true;
    return this.isUnlocked(id) || def.display === 'locked';
  }

  /** Visible pero todavía no usable (mostrar candado y bloquear interacción). */
  isLocked(id: string): boolean {
    return this.isVisible(id) && !this.isUnlocked(id);
  }

  /** Atajo para el roster: ¿está disponible este personaje del roster?
   *  En modo admin el roster está TODO desbloqueado (igual que el resto de la UI);
   *  en modo jugador depende del desbloqueo real (p.ej. reclutar a Kugo en 1-1). */
  isCharacterUnlocked(name: string): boolean {
    if (this.admin.isAdmin) return true;
    return this.isUnlocked(characterFeatureId(name));
  }

  // ── Eventos / mutación ──────────────────────────────────────────────────────

  /**
   * Marca un flag (evento puntual: misión, recompensa, "algo por definir") y
   * reevalúa los desbloqueos que dependan de él.
   */
  setFlag(id: string, scope: UnlockScope): void {
    const set = scope === 'global' ? this.flagsGlobal : this.flagsChar;
    if (set.has(id)) return;
    set.add(id);
    this.persistFlags(scope);
    if (scope === 'global') this.refreshGlobal(false);
    else this.refresh(false);
  }

  /** Desbloqueo manual directo de una feature (sin pasar por sus condiciones). */
  grantById(id: string): void {
    const def = this.def(id);
    if (def) this.grant(def, false);
  }

  /**
   * Reevalúa todas las features y consolida las recién satisfechas.
   * Llámalo tras un cambio relevante (subir nivel, completar misión…).
   * `silent` evita emitir changes$ (úsalo al cargar para no spamear badges).
   */
  refresh(silent = false): void {
    for (const def of FEATURES) {
      if (def.scope === 'char' && !this.charId) continue; // sin personaje: solo global
      const set = def.scope === 'global' ? this.unlockedGlobal : this.unlockedChar;
      if (!set.has(def.id) && this.isSatisfied(def)) this.grant(def, silent);
    }
  }

  /** Como refresh() pero solo features globales (pantalla de selección). */
  refreshGlobal(silent = false): void {
    for (const def of FEATURES) {
      if (def.scope !== 'global') continue;
      if (!this.unlockedGlobal.has(def.id) && this.isSatisfied(def)) this.grant(def, silent);
    }
  }

  /** Borra todos los desbloqueos y flags, de personaje y globales. */
  async clearAll(): Promise<void> {
    this.unlockedChar.clear();
    this.unlockedGlobal.clear();
    this.flagsChar.clear();
    this.flagsGlobal.clear();
    const ops: Promise<any>[] = [
      this.storage.set(GLOBAL_KEY,       []),
      this.storage.set(GLOBAL_FLAGS_KEY, []),
    ];
    if (this.charId) {
      ops.push(this.storage.set(charKey(this.charId),      []));
      ops.push(this.storage.set(charFlagsKey(this.charId), []));
    }
    await Promise.all(ops);
  }

  /**
   * Reset SELECTIVO: quita estos flags (global + char) y re-bloquea estas features
   * (las saca de los Sets de desbloqueadas). Persiste y emite si algo cambió. Lo usa
   * el reset del Modo Exploración para "descomprar" los mapas (flags 'map_1_x' +
   * features 'map.X'). Ojo: solo re-bloquea de verdad si además desaparece la
   * condición que las satisface — por eso se quitan sus flags a la vez.
   */
  resetUnlocks(flagIds: string[], featureIds: string[]): void {
    let global = false, char = false;
    for (const id of flagIds) {
      if (this.flagsGlobal.delete(id)) global = true;
      if (this.flagsChar.delete(id))   char = true;
    }
    for (const id of featureIds) {
      if (this.unlockedGlobal.delete(id)) global = true;
      if (this.unlockedChar.delete(id))   char = true;
    }
    if (global) { this.persist('global'); this.persistFlags('global'); }
    if (char)   { this.persist('char');   this.persistFlags('char'); }
    if (global || char) this.changes$.next();
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  private def(id: string): FeatureDef | undefined {
    return FEATURES.find(f => f.id === id);
  }

  private isSatisfied(def: FeatureDef): boolean {
    return def.requires.every(src => this.isSourceMet(src));
  }

  private isSourceMet(src: UnlockSource): boolean {
    switch (src.type) {
      case 'level':
        return this.playerState.snapshot().lvl >= src.value;
      case 'kills':
        return (src.scope === 'global'
          ? this.kills.totalGlobalKills()
          : this.kills.totalCharKills()) >= src.value;
      case 'achievement': {
        const ach = ACHIEVEMENTS.find(a => a.id === src.id);
        return ach ? this.achievements.isUnlocked(ach) : false;
      }
      case 'mission':
        return false; // TODO: cuando exista MissionService
      case 'flag':
        return this.flagsChar.has(src.id) || this.flagsGlobal.has(src.id);
    }
  }

  private grant(def: FeatureDef, silent: boolean): void {
    const set = def.scope === 'global' ? this.unlockedGlobal : this.unlockedChar;
    if (set.has(def.id)) return;
    set.add(def.id);
    this.persist(def.scope);
    if (!silent) {
      this.changes$.next();
      this.unlocked$.next(def);
    }
    this.syncRemote(def);
  }

  private persist(scope: UnlockScope): void {
    if (scope === 'global') {
      this.storage.set(GLOBAL_KEY, [...this.unlockedGlobal]);
    } else if (this.charId) {
      this.storage.set(charKey(this.charId), [...this.unlockedChar]);
    }
  }

  private persistFlags(scope: UnlockScope): void {
    if (scope === 'global') {
      this.storage.set(GLOBAL_FLAGS_KEY, [...this.flagsGlobal]);
    } else if (this.charId) {
      this.storage.set(charFlagsKey(this.charId), [...this.flagsChar]);
    }
  }

  // Sincronización con Supabase: mismo patrón que SaveService.saveRemote y
  // AchievementService.syncRemote — mientras OFFLINE_MODE esté activo solo
  // persiste en local. Al activar el backend: upsert en una tabla de
  // desbloqueos (user_id, char_id|null, feature_id, unlocked_at).
  private syncRemote(_def: FeatureDef): void {
    // TODO Supabase: pendiente de OFFLINE_MODE en save.service.ts
  }
}
