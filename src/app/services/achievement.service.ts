import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { KillService } from './kill.service';
import { PlayerStateService } from './player-state.service';

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
 *  el resto solo tiene contador de personaje. */
export type AchievementMetric = 'kills' | 'level' | 'lifetimeCoins' | 'deaths';

export interface AchievementDef {
  id: string;                 // único global, sin espacios
  name: string;
  desc: string;
  scope: AchievementScope;
  metric: AchievementMetric;
  goal: number;
  icon: string;               // ion-icon
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Personaje ──────────────────────────────────────────────────────────────
  { id: 'kills_10',     name: 'Primer sangre', desc: 'Mata 10 enemigos con este personaje.',
    scope: 'char', metric: 'kills', goal: 10, icon: 'flash-outline' },
  { id: 'kills_100',    name: 'Cazador',      desc: 'Mata 100 enemigos con este personaje.',
    scope: 'char', metric: 'kills', goal: 100, icon: 'skull-outline' },
  { id: 'kills_1000',   name: 'Exterminador', desc: 'Mata 1000 enemigos con este personaje.',
    scope: 'char', metric: 'kills', goal: 1000, icon: 'flame-outline' },
  { id: 'level_10',     name: 'Veterano',     desc: 'Alcanza el nivel 10.',
    scope: 'char', metric: 'level', goal: 10, icon: 'arrow-up-circle-outline' },
  { id: 'coins_10000',  name: 'Tesorero',     desc: 'Acumula 10.000 monedas a lo largo de tu vida.',
    scope: 'char', metric: 'lifetimeCoins', goal: 10000, icon: 'cash-outline' },
  { id: 'deaths_10',    name: 'Inmortal a ratos', desc: 'Muere 10 veces. Pasa hasta en las mejores familias.',
    scope: 'char', metric: 'deaths', goal: 10, icon: 'heart-dislike-outline' },

  // ── Globales (toda la cuenta) ──────────────────────────────────────────────
  { id: 'gkills_1000',  name: 'Plaga',        desc: 'Mata 1000 enemigos entre todos tus personajes.',
    scope: 'global', metric: 'kills', goal: 1000, icon: 'earth-outline' },
  { id: 'gkills_10000', name: 'Apocalipsis',  desc: 'Mata 10.000 enemigos entre todos tus personajes.',
    scope: 'global', metric: 'kills', goal: 10000, icon: 'planet-outline' },
];

const GLOBAL_KEY = 'achievements_global';
const charKey = (id: string) => `achievements_char_${id}`;

@Injectable({ providedIn: 'root' })
export class AchievementService {

  private charId: string | null = null;
  private unlockedChar   = new Set<string>();
  private unlockedGlobal = new Set<string>();

  constructor(
    private storage: StorageService,
    private kills: KillService,
    private playerState: PlayerStateService,
  ) {}

  /** Llamado por SaveService al cargar un personaje */
  async loadForChar(charId: string): Promise<void> {
    this.charId = charId;
    this.unlockedChar   = new Set((await this.storage.get(charKey(charId))) ?? []);
    this.unlockedGlobal = new Set((await this.storage.get(GLOBAL_KEY)) ?? []);
  }

  defs(scope: AchievementScope): AchievementDef[] {
    return ACHIEVEMENTS.filter(a => a.scope === scope);
  }

  /** Valor actual del contador que mide el logro */
  progress(def: AchievementDef): number {
    switch (def.metric) {
      case 'kills':
        return def.scope === 'global' ? this.kills.totalGlobalKills() : this.kills.totalCharKills();
      case 'level':         return this.playerState.snapshot().lvl;
      case 'lifetimeCoins': return this.playerState.snapshot().lifetimeCoins ?? 0;
      case 'deaths':        return this.playerState.snapshot().totalDeaths ?? 0;
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
      this.unlock(def);
      return true;
    }
    return false;
  }

  private unlock(def: AchievementDef): void {
    const set = def.scope === 'global' ? this.unlockedGlobal : this.unlockedChar;
    set.add(def.id);
    this.persist(def.scope);
    this.syncRemote(def);
  }

  /** Borra logros del personaje activo (llamado desde clearCurrentCharacter) */
  async clearForChar(): Promise<void> {
    this.unlockedChar.clear();
    if (this.charId) {
      await this.storage.set(charKey(this.charId), []);
    }
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
