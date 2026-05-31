import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SpawnTracker } from '../scenes/gamescene/map-config';

export interface ActiveEnemyGroup {
  type: string;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class MapStatsService {
  private trackers: SpawnTracker[] = [];

  private _activeGroups = new BehaviorSubject<ActiveEnemyGroup[]>([]);
  private _totalMax     = new BehaviorSubject<number>(0);

  readonly activeGroups$ = this._activeGroups.asObservable();
  readonly totalMax$     = this._totalMax.asObservable();

  get totalActive(): number {
    return this._activeGroups.value.reduce((s, g) => s + g.count, 0);
  }

  reset(): void {
    this.trackers = [];
    this._activeGroups.next([]);
    this._totalMax.next(0);
  }

  setTrackers(trackers: SpawnTracker[]): void {
    this.trackers = trackers;
    this._emitMax();
  }

  updateActive(enemyTypes: string[]): void {
    const map: Record<string, number> = {};
    for (const t of enemyTypes) map[t] = (map[t] ?? 0) + 1;
    this._activeGroups.next(
      Object.entries(map).map(([type, count]) => ({ type, count }))
    );
  }

  incrementMax(): void {
    for (const t of this.trackers) t.config.maxCount++;
    this._emitMax();
  }

  decrementMax(): void {
    for (const t of this.trackers) {
      if (t.config.maxCount > 1) t.config.maxCount--;
    }
    this._emitMax();
  }

  private _emitMax(): void {
    this._totalMax.next(
      this.trackers.reduce((s, t) => s + t.config.maxCount, 0)
    );
  }
}
