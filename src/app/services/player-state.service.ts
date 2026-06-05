import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Subject } from 'rxjs';

export interface PlayerState {
  coins: number;
  specialCoins: number;
  exp: number;
  lvl: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  lifetimeCoins: number;
  totalDeaths: number;
}

export const MAX_LEVEL = 100;

/** Exp requerida para pasar del nivel `lvl` al siguiente */
export function expNeeded(lvl: number): number {
  return lvl * 100;
}

const INITIAL_STATE: PlayerState = {
  coins: 0,
  specialCoins: 0,
  exp: 0,
  lvl: 1,
  hp: 100,
  hpMax: 100,
  mp: 100,
  mpMax: 100,
  lifetimeCoins: 0,
  totalDeaths: 0,
};

@Injectable({ providedIn: 'root' })
export class PlayerStateService {
  private readonly _state$ = new BehaviorSubject<PlayerState>(INITIAL_STATE);

  readonly coinDropped$  = new Subject<number>();
  readonly levelUp$      = new Subject<number>();
  readonly state$        = this._state$.asObservable();
  readonly coins$        = this.state$.pipe(map(s => s.coins),        distinctUntilChanged());
  readonly specialCoins$ = this.state$.pipe(map(s => s.specialCoins), distinctUntilChanged());
  readonly exp$          = this.state$.pipe(map(s => s.exp),          distinctUntilChanged());
  readonly lvl$          = this.state$.pipe(map(s => s.lvl),          distinctUntilChanged());
  readonly expProgress$  = this.state$.pipe(
    map(s => s.lvl >= MAX_LEVEL ? 1 : s.exp / expNeeded(s.lvl)),
    distinctUntilChanged()
  );

  setFromProfile(profile: any): void {
    if (!profile) return;
    this._state$.next({
      coins:         profile.coins          ?? 0,
      specialCoins:  profile.special_coins  ?? 0,
      exp:           profile.exp            ?? 0,
      lvl:           profile.lvl            ?? 1,
      hp:            profile.hp             ?? profile.current_hp ?? 100,
      hpMax:         profile.hpMax          ?? profile.max_hp     ?? 100,
      mp:            profile.mp             ?? 100,
      mpMax:         profile.mpMax          ?? 100,
      lifetimeCoins: profile.lifetimeCoins  ?? 0,
      totalDeaths:   profile.totalDeaths    ?? 0,
    });
  }

  addCoins(amount: number): void {
    this._patch({ coins: this._state$.getValue().coins + amount });
  }

  collectCoins(amount: number): void {
    const s = this._state$.getValue();
    this._patch({ coins: s.coins + amount, lifetimeCoins: (s.lifetimeCoins ?? 0) + amount });
    this.coinDropped$.next(amount);
  }

  recordDeath(): void {
    const s = this._state$.getValue();
    this._patch({ totalDeaths: (s.totalDeaths ?? 0) + 1 });
  }

  addExp(amount: number): void {
    const s = this._state$.getValue();
    if (s.lvl >= MAX_LEVEL) return;
    let { exp, lvl } = s;
    exp += amount;
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
