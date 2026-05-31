import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Subject } from 'rxjs';

export interface PlayerState {
  coins: number;
  specialCoins: number;
  exp: number;
  lvl: number;
}

const INITIAL_STATE: PlayerState = {
  coins: 0,
  specialCoins: 0,
  exp: 0,
  lvl: 1,
};

@Injectable({ providedIn: 'root' })
export class PlayerStateService {
  private readonly _state$ = new BehaviorSubject<PlayerState>(INITIAL_STATE);

  readonly coinDropped$  = new Subject<number>();
  readonly state$        = this._state$.asObservable();
  readonly coins$        = this.state$.pipe(map(s => s.coins),        distinctUntilChanged());
  readonly specialCoins$ = this.state$.pipe(map(s => s.specialCoins), distinctUntilChanged());
  readonly exp$          = this.state$.pipe(map(s => s.exp),          distinctUntilChanged());
  readonly lvl$          = this.state$.pipe(map(s => s.lvl),          distinctUntilChanged());

  setFromProfile(profile: any): void {
    if (!profile) return;
    this._state$.next({
      coins:        profile.coins         ?? 0,
      specialCoins: profile.special_coins ?? 0,
      exp:          profile.exp           ?? 0,
      lvl:          profile.lvl           ?? 1,
    });
  }

  addCoins(amount: number): void {
    this._patch({ coins: this._state$.getValue().coins + amount });
  }

  collectCoins(amount: number): void {
    this.addCoins(amount);
    this.coinDropped$.next(amount);
  }

  addExp(amount: number): void {
    this._patch({ exp: this._state$.getValue().exp + amount });
  }

  /** Devuelve una copia plana lista para persistir en Supabase */
  snapshot(): PlayerState {
    return { ...this._state$.getValue() };
  }

  private _patch(partial: Partial<PlayerState>): void {
    this._state$.next({ ...this._state$.getValue(), ...partial });
  }
}
