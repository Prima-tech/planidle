import { Injectable } from '@angular/core';
import { merge, Observable, Subject, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { EquipmentService } from './equipment.service';

export interface DamageBreakdown {
  base:      number;
  equipment: number;
  total:     number;
}

export interface BaseStats {
  STR:   number;
  DEX:   number;
  CONST: number;
  INT:   number;
  MAG:   number;
  CHR:   number;
}

const DEFAULT_BASE_STATS: BaseStats = {
  STR:   10,
  DEX:   10,
  CONST: 10,
  INT:   10,
  MAG:   10,
  CHR:   10,
};

@Injectable({ providedIn: 'root' })
export class CharacterStatsService {

  readonly damage$: Observable<DamageBreakdown>;
  readonly stats: BaseStats = { ...DEFAULT_BASE_STATS };

  private readonly statsChanged$ = new Subject<void>();

  increment(key: keyof BaseStats): void {
    this.stats[key]++;
    this.statsChanged$.next();
  }

  decrement(key: keyof BaseStats): void {
    if (this.stats[key] > 0) {
      this.stats[key]--;
      this.statsChanged$.next();
    }
  }

  constructor(private equipment: EquipmentService) {
    this.damage$ = merge(this.equipment.changes$, this.statsChanged$).pipe(
      startWith(null as void),
      map(() => this._calcDamage()),
    );
  }

  private _calcDamage(): DamageBreakdown {
    const base      = this.stats.STR;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['damage'] ?? 0),
      0
    );
    return { base, equipment, total: base + equipment };
  }
}
