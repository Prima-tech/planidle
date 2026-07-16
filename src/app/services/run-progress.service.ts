import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';

/**
 * Progresión del MODO EXPLORACIÓN (world run) COMPARTIDA entre todos los personajes
 * de la cuenta. A diferencia de PlayerState (per-personaje, se sobrescribe entero en
 * cada loadCharacter), este servicio es un singleton GLOBAL — mismo patrón que
 * GlobalTalentsService / MapUpgradesService: clave local propia + persistencia en
 * `global_data.account.runProgress` (Supabase), restaurada UNA sola vez al login y NO
 * por personaje.
 *
 *  - `stars`       Moneda del runner. Compartida entre personajes; NUNCA se resetea
 *                  (solo una ASCENSIÓN futura la reiniciará — aún sin definir).
 *  - `milestones`  Hitos/desbloqueos comprados con estrellas: desbloquear algo en un
 *                  personaje = desbloqueado en TODOS.
 *  - `perChar`     Stats de por vida de CADA personaje en el run (kills, muertes, mejor
 *                  distancia). Se guardan por personaje, pero además exponemos el TOTAL
 *                  de la cuenta (suma de todos): totalKills / totalDeaths / totalDistanceM.
 *  - `mergedChars` Guard de migración: qué personajes ya fusionaron su progreso LEGACY
 *                  (las estrellas/hitos que vivían en su snapshot per-personaje) para no
 *                  doble-contar. Ver mergeLegacyFromChar (SaveService.loadCharacter).
 */
export interface RunCharStats {
  kills: number;
  deaths: number;
  bestDistanceM: number;
}

export interface RunProgressSnapshot {
  stars: number;
  starsCollected: number;   // total de por vida recogido (nunca baja al gastar)
  milestones: string[];
  perChar: Record<string, RunCharStats>;
  mergedChars: string[];
}

const STORAGE_KEY = 'run_progress';
const EMPTY_CHAR: RunCharStats = { kills: 0, deaths: 0, bestDistanceM: 0 };

@Injectable({ providedIn: 'root' })
export class RunProgressService {
  private storage = inject(StorageService);

  private stars = 0;
  private starsCollected = 0;   // total recogido de por vida (solo sube; comprar NO lo baja)
  private milestones: string[] = [];
  private perChar: Record<string, RunCharStats> = {};
  private mergedChars = new Set<string>();
  private loadPromise: Promise<void>;

  readonly stars$          = new BehaviorSubject<number>(0);
  readonly starsCollected$ = new BehaviorSubject<number>(0);
  readonly milestones$     = new BehaviorSubject<string[]>([]);
  /** Emite en cualquier cambio (para HUD/paneles que quieran refrescar totales). */
  readonly changes$    = new BehaviorSubject<void>(undefined);

  constructor() { this.loadPromise = this.load(); }

  /** Resuelve cuando la carga local inicial terminó (para migraciones seguras). */
  ready(): Promise<void> { return this.loadPromise; }

  // ── Estrellas ────────────────────────────────────────────────────────────────
  getStars(): number { return this.stars; }
  /** Total de estrellas recogidas de por vida (no baja al gastar en hitos). */
  getStarsCollected(): number { return this.starsCollected; }
  collectStars(amount: number): void {
    if (!amount) return;
    this.stars = Math.max(0, this.stars + amount);
    if (amount > 0) {
      this.starsCollected += amount;
      this.starsCollected$.next(this.starsCollected);
    }
    this.stars$.next(this.stars);
    this.persist();
  }

  // ── Hitos / desbloqueos ───────────────────────────────────────────────────────
  getMilestones(): string[] { return this.milestones; }
  has(id: string): boolean { return this.milestones.includes(id); }

  /** Otorga un hito SIN coste (p.ej. recompensa de misión). Idempotente. */
  grant(id: string): void {
    if (this.milestones.includes(id)) return;
    this.milestones = [...this.milestones, id];
    this.milestones$.next(this.milestones);
    this.changes$.next();
    this.persist();
  }

  /** Compra un hito gastando `cost` estrellas. false si ya está o no alcanza. */
  buy(id: string, cost: number): boolean {
    if (this.milestones.includes(id) || this.stars < cost) return false;
    this.stars -= cost;
    this.milestones = [...this.milestones, id];
    this.stars$.next(this.stars);
    this.milestones$.next(this.milestones);
    this.changes$.next();
    this.persist();
    return true;
  }

  // ── Stats por personaje + TOTAL de la cuenta ──────────────────────────────────
  /** Vuelca las stats de por vida del personaje (las guarda SaveService al construir
   *  el snapshot). Per-personaje, pero alimenta los totales agregados de la cuenta. */
  reportCharStats(charId: string, stats: RunCharStats): void {
    if (!charId) return;
    const prev = this.perChar[charId];
    if (prev && prev.kills === stats.kills && prev.deaths === stats.deaths
        && prev.bestDistanceM === stats.bestDistanceM) return;
    this.perChar[charId] = { ...stats };
    this.changes$.next();
    this.persist();
  }
  charStats(charId: string): RunCharStats { return this.perChar[charId] ?? { ...EMPTY_CHAR }; }
  private sum(pick: (c: RunCharStats) => number): number {
    return Object.values(this.perChar).reduce((s, c) => s + (pick(c) || 0), 0);
  }
  /** Enemigos abatidos en el run sumando TODOS los personajes. */
  totalKills(): number { return this.sum(c => c.kills); }
  /** Muertes en el run sumando TODOS los personajes. */
  totalDeaths(): number { return this.sum(c => c.deaths); }
  /** Distancia (suma de la mejor marca de cada personaje). */
  totalDistanceM(): number { return this.sum(c => c.bestDistanceM); }
  /** Mejor marca de distancia de TODA la cuenta (récord global). */
  accountBestDistanceM(): number {
    return Object.values(this.perChar).reduce((m, c) => Math.max(m, c.bestDistanceM || 0), 0);
  }

  // ── Migración: fusiona el progreso LEGACY per-personaje UNA sola vez ───────────
  /** Absorbe las estrellas/hitos que un personaje tenía en su snapshot per-personaje
   *  (esquema antiguo) hacia la progresión global. Idempotente por personaje: el guard
   *  `mergedChars` evita doble-contar aunque se recargue el personaje varias veces. */
  async mergeLegacyFromChar(charId: string, legacyStars: number, legacyMilestones: string[]): Promise<void> {
    await this.loadPromise;
    if (!charId || this.mergedChars.has(charId)) return;
    this.mergedChars.add(charId);
    if (legacyStars > 0) {
      this.stars += legacyStars;
      this.starsCollected += legacyStars;   // eran estrellas recogidas históricamente
    }
    if (legacyMilestones?.length) {
      this.milestones = [...new Set([...this.milestones, ...legacyMilestones])];
    }
    this.stars$.next(this.stars);
    this.starsCollected$.next(this.starsCollected);
    this.milestones$.next(this.milestones);
    this.changes$.next();
    this.persist();
  }

  // ── Persistencia ──────────────────────────────────────────────────────────────
  private async load(): Promise<void> {
    try {
      const raw = await this.storage.get(STORAGE_KEY);
      if (raw && typeof raw === 'object') this.apply(raw as RunProgressSnapshot);
    } catch (e) {
      console.warn('[run-progress] no se pudo restaurar', e);
    }
    this.stars$.next(this.stars);
    this.starsCollected$.next(this.starsCollected);
    this.milestones$.next(this.milestones);
    this.changes$.next();
  }

  private apply(raw: RunProgressSnapshot): void {
    this.stars = typeof raw.stars === 'number' ? raw.stars : 0;
    // Saves antiguos no traían el total recogido: siémbralo con el saldo actual (al
    // menos eso se recogió) para no arrancar en 0 con estrellas ya en el bolsillo.
    this.starsCollected = typeof raw.starsCollected === 'number'
      ? raw.starsCollected : Math.max(0, this.stars);
    this.milestones = Array.isArray(raw.milestones)
      ? raw.milestones.filter(x => typeof x === 'string') : [];
    this.perChar = (raw.perChar && typeof raw.perChar === 'object') ? raw.perChar : {};
    this.mergedChars = new Set(Array.isArray(raw.mergedChars) ? raw.mergedChars : []);
  }

  private persist(): void { this.storage.set(STORAGE_KEY, this.getSnapshot()); }

  getSnapshot(): RunProgressSnapshot {
    return {
      stars: this.stars,
      starsCollected: this.starsCollected,
      milestones: this.milestones,
      perChar: this.perChar,
      mergedChars: [...this.mergedChars],
    };
  }

  /** Restaura desde la nube (una vez al login). La cuenta manda para las estrellas;
   *  los hitos y `mergedChars` se UNEN (monotónicos, nunca hacen daño) y las stats por
   *  personaje se mezclan tomando el máximo de cada campo. */
  async restore(data: any): Promise<void> {
    await this.loadPromise;
    if (!data || typeof data !== 'object') return;
    const cloud = data as RunProgressSnapshot;
    if (typeof cloud.stars === 'number') this.stars = cloud.stars;
    // Total recogido: monotónico → nos quedamos con el máximo (nube vs local).
    this.starsCollected = Math.max(
      this.starsCollected,
      typeof cloud.starsCollected === 'number' ? cloud.starsCollected : 0);
    this.milestones = [...new Set([...this.milestones, ...(cloud.milestones ?? [])])];
    for (const [id, st] of Object.entries(cloud.perChar ?? {})) {
      const local = this.perChar[id];
      this.perChar[id] = local ? {
        kills:         Math.max(local.kills || 0,         st.kills || 0),
        deaths:        Math.max(local.deaths || 0,        st.deaths || 0),
        bestDistanceM: Math.max(local.bestDistanceM || 0, st.bestDistanceM || 0),
      } : { ...st };
    }
    this.mergedChars = new Set([...this.mergedChars, ...(cloud.mergedChars ?? [])]);
    this.stars$.next(this.stars);
    this.starsCollected$.next(this.starsCollected);
    this.milestones$.next(this.milestones);
    this.changes$.next();
    this.persist();
  }
}
