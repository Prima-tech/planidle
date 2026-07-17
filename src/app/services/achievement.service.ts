import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { StorageService } from './storage.service';
import { KillService } from './kill.service';
import { PlayerStateService } from './player-state.service';
import { RunProgressService } from './run-progress.service';
import { NotificationBadgeService } from './notification-badge.service';

// Sistema de logros. Ver skill del proyecto: /new-achievement
//
// - El PROGRESO no se almacena: se deriva en vivo de los contadores que ya
//   existen (KillService, PlayerStateService). Añadir un logro nuevo solo
//   requiere una métrica que lo mida.
// - El DESBLOQUEO sí se persiste (por personaje o global según scope), para
//   que quede registrado aunque el contador luego baje y para sincronizarlo
//   con Supabase cuando salga de OFFLINE_MODE.

export type AchievementScope = 'char' | 'global';

/** Qué contador mide el logro. 'kills' funciona en ambos scopes;
 *  'starsCollected' solo es global (compartido por la cuenta); el resto solo
 *  tiene contador de personaje. */
export type AchievementMetric = 'kills' | 'level' | 'lifetimeCoins' | 'deaths' | 'starsCollected';

export interface AchievementDef {
  id: string;                 // único global, sin espacios
  name: string;
  desc: string;
  scope: AchievementScope;
  metric: AchievementMetric;
  goal: number;
  icon: string;               // ion-icon
}

// name/desc son CLAVES i18n: se traducen al mostrarlos (panel de logros con
// `| translate`, toast con translate.instant). Ver ACHIEVEMENTS.* en los json.
export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Personaje ──────────────────────────────────────────────────────────────
  { id: 'kills_10',     name: 'ACHIEVEMENTS.KILLS_10.NAME', desc: 'ACHIEVEMENTS.KILLS_10.DESC',
    scope: 'char', metric: 'kills', goal: 1, icon: 'flash-outline' },
  { id: 'kills_100',    name: 'ACHIEVEMENTS.KILLS_100.NAME', desc: 'ACHIEVEMENTS.KILLS_100.DESC',
    scope: 'char', metric: 'kills', goal: 100, icon: 'skull-outline' },
  { id: 'kills_1000',   name: 'ACHIEVEMENTS.KILLS_1000.NAME', desc: 'ACHIEVEMENTS.KILLS_1000.DESC',
    scope: 'char', metric: 'kills', goal: 1000, icon: 'flame-outline' },
  { id: 'level_10',     name: 'ACHIEVEMENTS.LEVEL_10.NAME', desc: 'ACHIEVEMENTS.LEVEL_10.DESC',
    scope: 'char', metric: 'level', goal: 10, icon: 'arrow-up-circle-outline' },
  { id: 'coins_10000',  name: 'ACHIEVEMENTS.COINS_10000.NAME', desc: 'ACHIEVEMENTS.COINS_10000.DESC',
    scope: 'char', metric: 'lifetimeCoins', goal: 10000, icon: 'cash-outline' },
  { id: 'deaths_10',    name: 'ACHIEVEMENTS.DEATHS_10.NAME', desc: 'ACHIEVEMENTS.DEATHS_10.DESC',
    scope: 'char', metric: 'deaths', goal: 10, icon: 'heart-dislike-outline' },

  // ── Globales (toda la cuenta) ──────────────────────────────────────────────
  { id: 'gkills_1000',  name: 'ACHIEVEMENTS.GKILLS_1000.NAME', desc: 'ACHIEVEMENTS.GKILLS_1000.DESC',
    scope: 'global', metric: 'kills', goal: 1000, icon: 'earth-outline' },
  { id: 'gkills_10000', name: 'ACHIEVEMENTS.GKILLS_10000.NAME', desc: 'ACHIEVEMENTS.GKILLS_10000.DESC',
    scope: 'global', metric: 'kills', goal: 10000, icon: 'planet-outline' },

  // ── Estrellas recogidas (modo exploración, total de la cuenta) ──────────────
  // Escalera x1000 tras el primer salto: 1k, 10k, 10M, 10B, 10T, 10q, 10Q, 10s,
  // 10S, 10o, 10n, 10d (= 10D). Sufijos del CompactNumberPipe.
  { id: 'gstars_1e3',  name: 'ACHIEVEMENTS.GSTARS_1E3.NAME',  desc: 'ACHIEVEMENTS.GSTARS_1E3.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e3,  icon: 'star-outline' },
  { id: 'gstars_1e4',  name: 'ACHIEVEMENTS.GSTARS_1E4.NAME',  desc: 'ACHIEVEMENTS.GSTARS_1E4.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e4,  icon: 'star-half-outline' },
  { id: 'gstars_1e7',  name: 'ACHIEVEMENTS.GSTARS_1E7.NAME',  desc: 'ACHIEVEMENTS.GSTARS_1E7.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e7,  icon: 'sparkles-outline' },
  { id: 'gstars_1e10', name: 'ACHIEVEMENTS.GSTARS_1E10.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E10.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e10, icon: 'star' },
  { id: 'gstars_1e13', name: 'ACHIEVEMENTS.GSTARS_1E13.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E13.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e13, icon: 'telescope-outline' },
  { id: 'gstars_1e16', name: 'ACHIEVEMENTS.GSTARS_1E16.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E16.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e16, icon: 'cloudy-night-outline' },
  { id: 'gstars_1e19', name: 'ACHIEVEMENTS.GSTARS_1E19.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E19.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e19, icon: 'moon-outline' },
  { id: 'gstars_1e22', name: 'ACHIEVEMENTS.GSTARS_1E22.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E22.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e22, icon: 'planet-outline' },
  { id: 'gstars_1e25', name: 'ACHIEVEMENTS.GSTARS_1E25.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E25.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e25, icon: 'rocket-outline' },
  { id: 'gstars_1e28', name: 'ACHIEVEMENTS.GSTARS_1E28.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E28.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e28, icon: 'diamond-outline' },
  { id: 'gstars_1e31', name: 'ACHIEVEMENTS.GSTARS_1E31.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E31.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e31, icon: 'infinite-outline' },
  { id: 'gstars_1e34', name: 'ACHIEVEMENTS.GSTARS_1E34.NAME', desc: 'ACHIEVEMENTS.GSTARS_1E34.DESC',
    scope: 'global', metric: 'starsCollected', goal: 1e34, icon: 'trophy-outline' },
];

const GLOBAL_KEY = 'achievements_global';
const charKey = (id: string) => `achievements_char_${id}`;

@Injectable({ providedIn: 'root' })
export class AchievementService implements OnDestroy {

  /** Emite cada vez que se desbloquea un logro (para la pastilla de notificación). */
  readonly unlocked$ = new Subject<AchievementDef>();

  private charId: string | null = null;
  private unlockedChar   = new Set<string>();
  private unlockedGlobal = new Set<string>();
  private killSub: Subscription;
  private starSub: Subscription;

  constructor(
    private storage: StorageService,
    private kills: KillService,
    private playerState: PlayerStateService,
    private runProgress: RunProgressService,
    private badges: NotificationBadgeService,
  ) {
    // kill$ solo emite en kills reales (no en restoreCharKills), así el toast
    // nunca se dispara al recargar con logros ya conseguidos.
    this.killSub = this.kills.kill$.subscribe(() => {
      for (const def of ACHIEVEMENTS) {
        if (def.metric === 'kills') this.checkAndUnlock(def);
      }
    });
    // starPicked$ solo emite al recoger una estrella FÍSICA (no en la producción
    // pasiva ni al restaurar), así el toast nunca salta al recargar. El progreso
    // se lee del total de por vida (getStarsCollected), que ya incluye lo pasivo.
    this.starSub = this.runProgress.starPicked$.subscribe(() => {
      for (const def of ACHIEVEMENTS) {
        if (def.metric === 'starsCollected') this.checkAndUnlock(def);
      }
    });
  }

  ngOnDestroy(): void {
    this.killSub?.unsubscribe();
    this.starSub?.unsubscribe();
  }

  /** Llamado por SaveService al cargar un personaje.
   *  `overrideChar` = logros de personaje restaurados del snapshot (nube).
   *  Los globales se leen siempre de la clave local (fetchAndSaveLocalData ya
   *  fusionó allí los de la cuenta al iniciar sesión). */
  async loadForChar(charId: string, overrideChar?: string[]): Promise<void> {
    this.charId = charId;
    this.unlockedChar   = new Set(overrideChar ?? ((await this.storage.get(charKey(charId))) ?? []));
    this.unlockedGlobal = new Set((await this.storage.get(GLOBAL_KEY)) ?? []);
    // Si los de personaje vinieron del snapshot, sincroniza la clave local.
    if (overrideChar) this.storage.set(charKey(charId), [...this.unlockedChar]);
  }

  /** Logros de PERSONAJE desbloqueados → van en el GameSnapshot del personaje. */
  getCharSnapshot(): string[] {
    return [...this.unlockedChar];
  }

  /** Logros de CUENTA (globales) desbloqueados → van en global_data.account. */
  getGlobalSnapshot(): string[] {
    return [...this.unlockedGlobal];
  }

  defs(scope: AchievementScope): AchievementDef[] {
    return ACHIEVEMENTS.filter(a => a.scope === scope);
  }

  /** Valor actual del contador que mide el logro */
  progress(def: AchievementDef): number {
    switch (def.metric) {
      case 'kills':
        return def.scope === 'global' ? this.kills.totalGlobalKills() : this.kills.totalCharKills();
      case 'level':          return this.playerState.snapshot().lvl;
      case 'lifetimeCoins':  return this.playerState.snapshot().lifetimeCoins ?? 0;
      case 'deaths':         return this.playerState.snapshot().totalDeaths ?? 0;
      case 'starsCollected': return this.runProgress.getStarsCollected();
    }
  }

  /** 0..1 para barras de progreso */
  ratio(def: AchievementDef): number {
    return Math.min(1, this.progress(def) / def.goal);
  }

  /** Comprueba (y registra si procede) el desbloqueo */
  isUnlocked(def: AchievementDef): boolean {
    const set = def.scope === 'global' ? this.unlockedGlobal : this.unlockedChar;
    if (set.has(def.id)) return true;
    if (this.progress(def) >= def.goal) {
      // silent=true: el commit perezoso desde templates no muestra pastilla
      this.unlock(def, true);
      return true;
    }
    return false;
  }

  /** Comprueba y desbloquea mostrando la pastilla. No llama a isUnlocked() para
   *  evitar que el commit perezoso de esa función se adelante y suprima el toast. */
  checkAndUnlock(def: AchievementDef): void {
    const set = def.scope === 'global' ? this.unlockedGlobal : this.unlockedChar;
    if (set.has(def.id)) return;
    if (this.progress(def) >= def.goal) this.unlock(def, false);
  }

  /** true si hay al menos un logro desbloqueado (de personaje o global). Revela la
   *  pestaña de Logros en la ventana de equipo (onboarding): antes del 1er logro
   *  está oculta. */
  hasAnyUnlocked(): boolean {
    return this.unlockedChar.size > 0 || this.unlockedGlobal.size > 0;
  }

  private unlock(def: AchievementDef, silent: boolean): void {
    const set = def.scope === 'global' ? this.unlockedGlobal : this.unlockedChar;
    set.add(def.id);
    this.persist(def.scope);
    this.syncRemote(def);
    if (!silent) {
      // Desbloqueo real (no el commit perezoso al mirar el panel): enciende el
      // aviso de la pestaña de Logros — que además se revela con hasAnyUnlocked().
      this.badges.flag('equip.achievements');
      this.unlocked$.next(def);
    }
  }

  /** Borra logros del personaje activo y los globales de cuenta. */
  async clearAll(): Promise<void> {
    this.unlockedChar.clear();
    this.unlockedGlobal.clear();
    const ops: Promise<any>[] = [this.storage.set(GLOBAL_KEY, [])];
    if (this.charId) ops.push(this.storage.set(charKey(this.charId), []));
    await Promise.all(ops);
  }

  private persist(scope: AchievementScope): void {
    if (scope === 'global') {
      this.storage.set(GLOBAL_KEY, [...this.unlockedGlobal]);
    } else if (this.charId) {
      this.storage.set(charKey(this.charId), [...this.unlockedChar]);
    }
  }

  // Sincronización con Supabase: mismo patrón que SaveService.saveRemote —
  // mientras OFFLINE_MODE esté activo solo persiste en local. Al activar el
  // backend: upsert en la tabla `achievements` (user_id, char_id|null,
  // achievement_id, unlocked_at). Ver skill /new-achievement.
  private syncRemote(_def: AchievementDef): void {
    // TODO Supabase: pendiente de OFFLINE_MODE en save.service.ts
  }
}
