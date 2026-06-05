import { Injectable } from '@angular/core';
import { Observable, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { EquipmentService } from './equipment.service';

const BASE_DAMAGE = 10;

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
  STR:   1,
  DEX:   1,
  CONST: 1,
  INT:   1,
  MAG:   1,
  CHR:   1,
};

@Injectable({ providedIn: 'root' })
export class CharacterStatsService {

  readonly damage$: Observable<DamageBreakdown>;
  readonly stats: BaseStats = { ...DEFAULT_BASE_STATS };

  constructor(private equipment: EquipmentService) {
    this.damage$ = this.equipment.changes$.pipe(
      startWith(null as void),
      map(() => this._calcDamage()),
    );
  }

  private _calcDamage(): DamageBreakdown {
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['damage'] ?? 0),
      0
    );
    return { base: BASE_DAMAGE, equipment, total: BASE_DAMAGE + equipment };
  }
}
