import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ActiveBuff {
  id: string;
  stat: string;
  value: number;
  icon: string;
  startTime: number;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class BuffService {
  private _buffs: ActiveBuff[] = [];
  readonly buffs$ = new BehaviorSubject<ActiveBuff[]>([]);

  apply(buff: ActiveBuff): void {
    this._buffs = this._buffs.filter(b => b.id !== buff.id);
    this._buffs.push(buff);
    this.buffs$.next([...this._buffs]);
  }

  tick(): void {
    const now = Date.now();
    const prev = this._buffs.length;
    this._buffs = this._buffs.filter(b => now - b.startTime < b.duration);
    if (this._buffs.length !== prev) this.buffs$.next([...this._buffs]);
  }

  ratio(buff: ActiveBuff): number {
    return Math.max(0, 1 - (Date.now() - buff.startTime) / buff.duration);
  }

  getValue(stat: string): number {
    const now = Date.now();
    return this._buffs
      .filter(b => b.stat === stat && now - b.startTime < b.duration)
      .reduce((sum, b) => sum + b.value, 0);
  }
}
