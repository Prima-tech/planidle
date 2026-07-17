import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { StorageService } from './storage.service';
import { PlayerStateService } from './player-state.service';
import { RUN_WEAPONS, RunWeaponDef, weaponUpgradeCost, weaponStarsPerSec, unlockedRunWeapons } from '../scenes/worldrun/run-weapons';
import { starProdPerMin } from './run-milestones';

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
  starsPeak: number;        // saldo MÁXIMO alcanzado a la vez (desbloqueo de armas)
  milestones: string[];
  weaponLevels: Record<string, number>;   // nivel de cada arma generadora de estrellas
  perChar: Record<string, RunCharStats>;
  mergedChars: string[];
  onboardPanelSeen?: boolean;   // onboarding: ¿ya abrió el panel? (paso 1→2 del tutorial)
}

const STORAGE_KEY = 'run_progress';
const EMPTY_CHAR: RunCharStats = { kills: 0, deaths: 0, bestDistanceM: 0 };

/** Tope suave de los bonos de REALIMENTACIÓN (oleada estelar, inflación, naranja). Esos
 *  hitos rinden un % de tu producción de ★/s ACTUAL por cada recogida; sin tope compondrían
 *  geométricamente (producción → bono → compras → más producción → bono mayor…) y el número
 *  se dispara. Con este tope, la producción "efectiva" que alimenta el bono se satura:
 *      efectiva = sps · CAP / (sps + CAP)
 *  → para sps « CAP se comporta casi como el % lineal (mismo tacto al principio); para
 *  sps » CAP se aplana hacia CAP, así el bono NUNCA supera fraction·CAP y el bucle deja de
 *  explotar. ES EL ÚNICO MANDO: súbelo para permitir bonos mayores, bájalo para cortar antes. */
const FEEDBACK_SOFT_CAP = 2000;

/** Estrellas necesarias para arrancar el ONBOARDING de exploración (primer login): al
 *  cruzarlas aparece el badge en el botón que abre el panel → abrir → badge en la compra
 *  de la espada nv1 → comprarla cierra el tutorial para siempre. */
const ONBOARD_STARS = 10;

@Injectable({ providedIn: 'root' })
export class RunProgressService {
  private storage = inject(StorageService);
  private playerState = inject(PlayerStateService);

  private stars = 0;
  private starsCollected = 0;   // total recogido de por vida (solo sube; comprar NO lo baja)
  private starsPeak = 0;        // saldo máximo alcanzado a la vez (desbloqueo de armas)
  private milestones: string[] = [];
  private weaponLevels: Record<string, number> = {};   // generadores de estrellas (armas)
  private starCarry = 0;        // fracción de estrella acumulada del tick (no se persiste)
  private perChar: Record<string, RunCharStats> = {};
  private mergedChars = new Set<string>();
  private onboardPanelSeen = false;   // onboarding de exploración (paso 1→2). Ver ONBOARD_STARS.
  private loadPromise: Promise<void>;

  readonly stars$          = new BehaviorSubject<number>(0);
  readonly starsCollected$ = new BehaviorSubject<number>(0);
  readonly milestones$     = new BehaviorSubject<string[]>([]);
  readonly weapons$        = new BehaviorSubject<Record<string, number>>({});
  /** Emite en cualquier cambio (para HUD/paneles que quieran refrescar totales). */
  readonly changes$    = new BehaviorSubject<void>(undefined);
  /** Emite la cantidad al RECOGER una estrella física (para el game-log de abajo-izq).
   *  NO lo disparan los generadores pasivos (armas/hitos), solo la recogida real. */
  readonly starPicked$ = new Subject<number>();

  constructor() { this.loadPromise = this.load(); }

  /** Resuelve cuando la carga local inicial terminó (para migraciones seguras). */
  ready(): Promise<void> { return this.loadPromise; }

  // ── Estrellas ────────────────────────────────────────────────────────────────
  getStars(): number { return this.stars; }
  /** Total a MOSTRAR: saldo entero + la fracción aún acumulándose del generador de
   *  armas (para enseñar decimales cuando se produce menos de 1 ★/seg). El saldo real
   *  (getStars) sigue siendo entero para comprar. */
  starsDisplay(): number { return this.stars + this.starCarry; }
  /** Total de estrellas recogidas de por vida (no baja al gastar en hitos). */
  getStarsCollected(): number { return this.starsCollected; }
  collectStars(amount: number): void {
    if (!amount) return;
    this.stars = Math.max(0, this.stars + amount);
    if (amount > 0) {
      this.starsCollected += amount;
      this.starsCollected$.next(this.starsCollected);
    }
    if (this.stars > this.starsPeak) this.starsPeak = this.stars;   // desbloqueo de armas
    this.stars$.next(this.stars);
    this.persist();
  }

  /** Pico de estrellas alcanzado a la vez (saldo máximo). Desbloquea armas por hito. */
  getStarsPeak(): number { return this.starsPeak; }

  // ── Onboarding de exploración (primer login, una sola vez) ────────────────────────
  // Trayecto guiado con el punto rojo de novedad (.notif-dot): cruzar ONBOARD_STARS ★ →
  // badge en el botón que abre el panel → abrirlo → badge en la compra de la espada nv1 →
  // comprarla lo cierra PARA SIEMPRE. Todo DERIVADO de estado persistido (no del
  // NotificationBadgeService, que es en memoria), así sobrevive recargas y relogin.

  /** ¿Sigue activo el tutorial? Acaba en cuanto la espada tiene nivel ≥ 1. */
  private onboardActive(): boolean { return this.weaponLevel('sword') < 1; }

  /** Badge en el botón que ABRE el panel: cruzaste las 10★ y aún no lo has abierto. */
  onboardBadgeOpener(): boolean {
    return this.onboardActive() && !this.onboardPanelSeen && this.starsPeak >= ONBOARD_STARS;
  }

  /** Badge en la compra de la ESPADA nv1: ya abriste el panel y aún no la compraste. */
  onboardBadgeSword(): boolean {
    return this.onboardActive() && this.onboardPanelSeen;
  }

  /** Marca que el panel se abrió (mueve el badge del botón a la espada). Solo cuenta si el
   *  tutorial está activo y ya cruzaste el umbral: abrir el panel ANTES de las 10★ no
   *  consume el paso (la guía aún no ha empezado). Persiste para sobrevivir recargas. */
  markOnboardPanelSeen(): void {
    if (this.onboardPanelSeen) return;
    if (!this.onboardActive() || this.starsPeak < ONBOARD_STARS) return;
    this.onboardPanelSeen = true;
    this.changes$.next();
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

  // ── Armas: generadores pasivos de ESTRELLAS (estilo Idle Slayer) ──────────────
  /** Armas ya desbloqueadas (según el pico de estrellas alcanzado). */
  unlockedWeapons(): RunWeaponDef[] { return unlockedRunWeapons(this.starsPeak); }

  /** Nivel actual de un arma (0 = sin comprar). */
  weaponLevel(id: string): number { return this.weaponLevels[id] ?? 0; }

  /** Coste (en ESTRELLAS) de subir el arma un nivel más desde su nivel actual. */
  weaponCost(def: RunWeaponDef): number { return weaponUpgradeCost(def, this.weaponLevel(def.id)); }

  /** ¿Alcanzan las estrellas para subir el arma un nivel? */
  canBuyWeapon(def: RunWeaponDef): boolean {
    return this.stars >= this.weaponCost(def);
  }

  /** Sube un nivel el arma gastando ESTRELLAS. false si no alcanza. */
  buyWeapon(def: RunWeaponDef): boolean {
    const cost = this.weaponCost(def);
    if (this.stars < cost) return false;
    this.stars -= cost;   // gasta estrellas
    this.weaponLevels = { ...this.weaponLevels, [def.id]: this.weaponLevel(def.id) + 1 };
    this.stars$.next(this.stars);
    this.weapons$.next(this.weaponLevels);
    this.changes$.next();
    this.persist();
    return true;
  }

  /** Multiplicador global a la producción PASIVA de estrellas (armas + generadores de
   *  hitos). Hito 'sardine' → +2%. Se aplica DENTRO de las tasas de abajo, así ningún
   *  caller puede olvidarlo. */
  starProdMult(): number { return 1 + (this.has('sardine') ? 0.02 : 0); }

  /** Estrellas/seg SOLO de armas (suma de niveles × su tasa), con el multiplicador de
   *  producción ya aplicado. Parcial: para la tasa "de verdad" usa starsPerSecTotal().
   *  Solo la usan el tick de armas y el propio starsPerSecTotal(). */
  weaponStarsPerSecTotal(): number {
    const base = RUN_WEAPONS.reduce((s, w) => s + weaponStarsPerSec(w, this.weaponLevel(w.id)), 0);
    return base * this.starProdMult();
  }

  /** Estrellas/min de los generadores de hitos (STAR_PROD_TIERS), con el multiplicador
   *  de producción ya aplicado. Úsalo en vez de la función pura starProdPerMin(). */
  starProdPerMinTotal(): number {
    return starProdPerMin(this.milestones) * this.starProdMult();
  }

  /** ÚNICA fuente de verdad de "tu estrella por segundo actual": producción pasiva
   *  TOTAL = armas + generadores de hitos (con el x% de sardine ya dentro). La usan el
   *  HUD, la oleada estelar, la caja "1 min", los hitos 'naranja'/'inflacion' y el AFK. */
  starsPerSecTotal(): number {
    return this.weaponStarsPerSecTotal() + this.starProdPerMinTotal() / 60;
  }

  /** Bono de REALIMENTACIÓN = `fraction` de tu producción ACTUAL por recogida, pero con
   *  TOPE SUAVE (ver FEEDBACK_SOFT_CAP): la producción que alimenta el bono se satura, así
   *  el bucle producción→bono→producción no compone sin límite. Fuente ÚNICA para los tres
   *  hitos '% de tu ★/s' (oleada estelar, inflación, naranja): así todos topan igual y nadie
   *  puede olvidarse del cap. Devuelve entero (las estrellas/oro no llevan decimales). */
  feedbackBonus(fraction: number): number {
    const sps = this.starsPerSecTotal();
    if (sps <= 0 || fraction <= 0) return 0;
    const effective = (sps * FEEDBACK_SOFT_CAP) / (sps + FEEDBACK_SOFT_CAP);
    return Math.floor(effective * fraction);
  }

  /** Tick del generador de estrellas de las armas: llámalo desde el bucle de exploración
   *  con el delta (ms). Acumula fracciones y entrega estrellas ENTERAS con `collectStars`
   *  (suben el saldo y el total recogido). */
  tickWeaponStars(deltaMs: number): void {
    const perSec = this.weaponStarsPerSecTotal();
    if (perSec <= 0) return;
    this.starCarry += perSec * (deltaMs / 1000);
    if (this.starCarry >= 1) {
      const n = Math.floor(this.starCarry);
      this.starCarry -= n;
      this.collectStars(n);
    }
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
    this.weapons$.next(this.weaponLevels);
    this.changes$.next();
  }

  private apply(raw: RunProgressSnapshot): void {
    this.stars = typeof raw.stars === 'number' ? raw.stars : 0;
    // Saves antiguos no traían el total recogido: siémbralo con el saldo actual (al
    // menos eso se recogió) para no arrancar en 0 con estrellas ya en el bolsillo.
    this.starsCollected = typeof raw.starsCollected === 'number'
      ? raw.starsCollected : Math.max(0, this.stars);
    // Saves antiguos no traían el pico: siémbralo con el saldo actual (al menos eso se
    // llegó a tener a la vez) para no re-bloquear armas ya desbloqueadas.
    this.starsPeak = typeof raw.starsPeak === 'number'
      ? raw.starsPeak : Math.max(0, this.stars);
    this.milestones = Array.isArray(raw.milestones)
      ? raw.milestones.filter(x => typeof x === 'string') : [];
    this.weaponLevels = (raw.weaponLevels && typeof raw.weaponLevels === 'object')
      ? raw.weaponLevels : {};
    this.perChar = (raw.perChar && typeof raw.perChar === 'object') ? raw.perChar : {};
    this.mergedChars = new Set(Array.isArray(raw.mergedChars) ? raw.mergedChars : []);
    this.onboardPanelSeen = raw.onboardPanelSeen === true;
  }

  /**
   * RESET TOTAL del Modo Exploración: deja la progresión del runner como recién
   * empezada — 0 estrellas (saldo, total recogido y pico), sin hitos ni niveles de
   * arma (0 ★/min y 0 ★/seg) y sin stats por personaje (kills/muertes/récord). Emite
   * todos los observables y reescribe la clave local. NO sobrescribe la nube: como
   * `restore()` es aditivo (une hitos, toma el máximo de estrellas/niveles), el
   * llamador DEBE hacer `SaveService.forceSave(true)` tras esto para pisar el snapshot
   * de la nube; si no, al re-loguear se re-inflaría todo.
   */
  resetExploration(): void {
    this.stars = 0;
    this.starsCollected = 0;
    this.starsPeak = 0;
    this.milestones = [];
    this.weaponLevels = {};
    this.starCarry = 0;
    this.perChar = {};
    this.onboardPanelSeen = false;   // reset total → el tutorial vuelve a estar disponible
    this.stars$.next(0);
    this.starsCollected$.next(0);
    this.milestones$.next([]);
    this.weapons$.next({});
    this.changes$.next();
    this.persist();
  }

  private persist(): void { this.storage.set(STORAGE_KEY, this.getSnapshot()); }

  getSnapshot(): RunProgressSnapshot {
    return {
      stars: this.stars,
      starsCollected: this.starsCollected,
      starsPeak: this.starsPeak,
      milestones: this.milestones,
      weaponLevels: this.weaponLevels,
      perChar: this.perChar,
      mergedChars: [...this.mergedChars],
      onboardPanelSeen: this.onboardPanelSeen,
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
    // Niveles de arma: monotónicos → nos quedamos con el nivel más alto (nube vs local).
    for (const [id, lvl] of Object.entries(cloud.weaponLevels ?? {})) {
      this.weaponLevels[id] = Math.max(this.weaponLevels[id] ?? 0, lvl ?? 0);
    }
    for (const [id, st] of Object.entries(cloud.perChar ?? {})) {
      const local = this.perChar[id];
      this.perChar[id] = local ? {
        kills:         Math.max(local.kills || 0,         st.kills || 0),
        deaths:        Math.max(local.deaths || 0,        st.deaths || 0),
        bestDistanceM: Math.max(local.bestDistanceM || 0, st.bestDistanceM || 0),
      } : { ...st };
    }
    this.mergedChars = new Set([...this.mergedChars, ...(cloud.mergedChars ?? [])]);
    // Onboarding: monotónico (una vez abierto el panel, seguido en cualquier dispositivo).
    this.onboardPanelSeen = this.onboardPanelSeen || cloud.onboardPanelSeen === true;
    this.stars$.next(this.stars);
    this.starsCollected$.next(this.starsCollected);
    this.milestones$.next(this.milestones);
    this.weapons$.next(this.weaponLevels);
    this.changes$.next();
    this.persist();
  }
}
