import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Subject } from 'rxjs';

export interface PlayerState {
  coins: number;
  specialCoins: number;
  stars: number;
  worldKills: number;        // enemigos abatidos en el Modo Mundo: TOTAL de por vida (stats)
  currentKills: number;      // enemigos abatidos en la EXPEDICIÓN actual (se reinicia por run)
  worldBestDistanceM: number; // mejor distancia (m) alcanzada en una carrera
  explorationDistanceM: number; // distancia (m) explorada acumulada: crece corriendo
                                 // Y estando AFK (+10 m/min); la carrera resume desde aquí
  exp: number;
  lvl: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  lifetimeCoins: number;
  totalDeaths: number;       // muertes TOTALES de por vida (para estadísticas; nunca se reinicia)
  currentDeaths: number;     // muertes de la expedición ACTUAL; se reinicia al volver a casa
  runMilestones: string[];   // hitos del Modo Mundo comprados con estrellas (ids desbloqueados)
}

export const MAX_LEVEL = 100;

/** Exp requerida para pasar del nivel `lvl` al siguiente */
export function expNeeded(lvl: number): number {
  return lvl * 100;
}

const INITIAL_STATE: PlayerState = {
  coins: 0,
  specialCoins: 0,
  stars: 0,
  worldKills: 0,
  currentKills: 0,
  worldBestDistanceM: 0,
  explorationDistanceM: 0,
  exp: 0,
  lvl: 1,
  hp: 100,
  hpMax: 100,
  mp: 100,
  mpMax: 100,
  lifetimeCoins: 0,
  totalDeaths: 0,
  currentDeaths: 0,
  runMilestones: [],
};

@Injectable({ providedIn: 'root' })
export class PlayerStateService {
  private readonly _state$ = new BehaviorSubject<PlayerState>(INITIAL_STATE);

  readonly coinDropped$  = new Subject<number>();
  readonly levelUp$      = new Subject<number>();
  readonly state$        = this._state$.asObservable();
  readonly coins$        = this.state$.pipe(map(s => s.coins || 0),   distinctUntilChanged());
  readonly specialCoins$ = this.state$.pipe(map(s => s.specialCoins), distinctUntilChanged());
  readonly stars$        = this.state$.pipe(map(s => s.stars ?? 0),    distinctUntilChanged());
  readonly worldKills$   = this.state$.pipe(map(s => s.worldKills ?? 0), distinctUntilChanged());
  readonly currentKills$ = this.state$.pipe(map(s => s.currentKills ?? 0), distinctUntilChanged());
  readonly worldBestDistanceM$ = this.state$.pipe(map(s => s.worldBestDistanceM ?? 0), distinctUntilChanged());
  readonly currentDeaths$ = this.state$.pipe(map(s => s.currentDeaths ?? 0), distinctUntilChanged());
  readonly runMilestones$ = this.state$.pipe(map(s => s.runMilestones ?? []), distinctUntilChanged());
  readonly totalDeaths$  = this.state$.pipe(map(s => s.totalDeaths ?? 0), distinctUntilChanged());
  readonly exp$          = this.state$.pipe(map(s => s.exp || 0),     distinctUntilChanged());
  readonly lvl$          = this.state$.pipe(map(s => s.lvl),          distinctUntilChanged());
  readonly expProgress$  = this.state$.pipe(
    map(s => s.lvl >= MAX_LEVEL ? 1 : (s.exp || 0) / expNeeded(s.lvl)),
    distinctUntilChanged()
  );

  setFromProfile(profile: any): void {
    if (!profile) return;
    this._state$.next({
      coins:         profile.coins          ?? 0,
      specialCoins:  profile.special_coins  ?? 0,
      stars:         profile.stars          ?? 0,
      worldKills:    profile.worldKills     ?? 0,
      currentKills:  profile.currentKills   ?? 0,
      worldBestDistanceM: profile.worldBestDistanceM ?? 0,
      explorationDistanceM: profile.explorationDistanceM ?? 0,
      exp:           profile.exp            ?? 0,
      lvl:           profile.lvl            ?? 1,
      hp:            profile.hp             ?? profile.current_hp ?? 100,
      hpMax:         profile.hpMax          ?? profile.max_hp     ?? 100,
      mp:            profile.mp             ?? 100,
      mpMax:         profile.mpMax          ?? 100,
      lifetimeCoins: profile.lifetimeCoins  ?? 0,
      totalDeaths:   profile.totalDeaths    ?? 0,
      currentDeaths: profile.currentDeaths  ?? 0,
      runMilestones: profile.runMilestones  ?? [],
    });
  }

  addCoins(amount: number): void {
    this._patch({ coins: (this._state$.getValue().coins || 0) + (amount || 0) });
  }

  collectCoins(amount: number): void {
    const s = this._state$.getValue();
    const add = amount || 0;   // evita NaN si llega undefined/NaN
    this._patch({ coins: (s.coins || 0) + add, lifetimeCoins: (s.lifetimeCoins || 0) + add });
    this.coinDropped$.next(add);
  }

  /** Moneda de pago (especial): contador propio, persistido junto a las monedas.
   *  Se recoge al pisar el drop especial (type 'special'). */
  collectSpecialCoins(amount: number): void {
    const s = this._state$.getValue();
    this._patch({ specialCoins: (s.specialCoins ?? 0) + (amount || 0) });
  }

  /** Estrellas del Modo Mundo: contador propio, persistido como las monedas. */
  collectStars(amount: number): void {
    const s = this._state$.getValue();
    this._patch({ stars: (s.stars ?? 0) + amount });
  }

  /** ¿Está desbloqueado este hito del Modo Mundo? */
  hasRunMilestone(id: string): boolean {
    return (this._state$.getValue().runMilestones ?? []).includes(id);
  }

  /** Compra un hito del Modo Mundo gastando `cost` estrellas. Devuelve false si ya
   *  está comprado o no hay estrellas suficientes. */
  buyRunMilestone(id: string, cost: number): boolean {
    const s = this._state$.getValue();
    const owned = s.runMilestones ?? [];
    if (owned.includes(id) || (s.stars ?? 0) < cost) return false;
    this._patch({ stars: (s.stars ?? 0) - cost, runMilestones: [...owned, id] });
    return true;
  }

  /** Suma enemigos abatidos en el Modo Mundo: total de por vida + contador de la run. */
  addWorldKills(amount = 1): void {
    const s = this._state$.getValue();
    this._patch({
      worldKills:   (s.worldKills ?? 0) + amount,
      currentKills: (s.currentKills ?? 0) + amount,
    });
  }

  /** Reinicia el contador de enemigos de la expedición actual (al empezar una run). */
  resetRunKills(): void {
    this._patch({ currentKills: 0 });
  }

  /** Registra la distancia de la carrera actual. Empuja el récord (worldBestDistanceM)
   *  y la distancia explorada (explorationDistanceM, desde donde resume la próxima
   *  carrera). Ambas son monótonas: solo crecen. */
  reportWorldDistance(meters: number): void {
    const s = this._state$.getValue();
    const patch: Partial<PlayerState> = {};
    if (meters > (s.worldBestDistanceM ?? 0))   patch.worldBestDistanceM = meters;
    if (meters > (s.explorationDistanceM ?? 0)) patch.explorationDistanceM = meters;
    if (patch.worldBestDistanceM !== undefined || patch.explorationDistanceM !== undefined) {
      this._patch(patch);
    }
  }

  /** Suma metros explorados estando AFK (Modo Mundo). No toca el récord de carrera
   *  (worldBestDistanceM): el AFK avanza la exploración pero no cuenta como "mejor
   *  carrera". Ver OfflineGainsService. */
  addExplorationDistance(meters: number): void {
    if (meters <= 0) return;
    const s = this._state$.getValue();
    this._patch({ explorationDistanceM: (s.explorationDistanceM ?? 0) + meters });
  }

  recordDeath(): void {
    const s = this._state$.getValue();
    // Sube el total de por vida (estadísticas) y el contador de la expedición actual
    // (que se reinicia al volver a casa).
    this._patch({
      totalDeaths:   (s.totalDeaths ?? 0) + 1,
      currentDeaths: (s.currentDeaths ?? 0) + 1,
    });
  }

  /** "Volver a casa" desde el Modo Mundo: reinicia el progreso de la expedición
   *  actual (distancia explorada a 0, contadores de muertes/kills a 0).
   *  Se conserva lo "almacenado": las ESTRELLAS (moneda persistente con la que se
   *  compran los hitos/habilidades del runner), el récord de distancia
   *  (worldBestDistanceM) y el total de muertes de por vida (totalDeaths). */
  goHomeReset(): void {
    this._patch({ explorationDistanceM: 0, currentDeaths: 0, currentKills: 0 });
  }

  addExp(amount: number): void {
    const s = this._state$.getValue();
    if (s.lvl >= MAX_LEVEL) return;
    let exp = s.exp || 0;            // '|| 0' neutraliza NaN/undefined (?? no atrapa NaN)
    let lvl = s.lvl || 1;
    exp += amount || 0;
    while (lvl < MAX_LEVEL && exp >= expNeeded(lvl)) {
      exp -= expNeeded(lvl);
      lvl++;
      this.levelUp$.next(lvl);
    }
    if (lvl >= MAX_LEVEL) exp = 0;
    this._patch({ exp, lvl });
  }

  resetExpCurrentLevel(): void {
    this._patch({ exp: 0 });
  }

  setHp(hp: number, hpMax?: number): void {
    const patch: Partial<PlayerState> = { hp: Math.max(0, hp) };
    if (hpMax !== undefined) patch.hpMax = hpMax;
    this._patch(patch);
  }

  setMp(mp: number, mpMax?: number): void {
    const patch: Partial<PlayerState> = { mp: Math.max(0, mp) };
    if (mpMax !== undefined) patch.mpMax = mpMax;
    this._patch(patch);
  }

  /** Devuelve una copia plana lista para persistir en Supabase */
  snapshot(): PlayerState {
    return { ...this._state$.getValue() };
  }

  private _patch(partial: Partial<PlayerState>): void {
    this._state$.next({ ...this._state$.getValue(), ...partial });
  }
}
