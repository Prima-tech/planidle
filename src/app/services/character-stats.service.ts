import { Injectable } from '@angular/core';
import { merge, Observable, Subject, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { EquipmentService } from './equipment.service';
import { PlayerStateService } from './player-state.service';

export interface DamageBreakdown {
  base:      number;
  equipment: number;
  total:     number;
}

export interface HpBreakdown {
  base:      number; // CONST * 10
  equipment: number; // bonus de armaduras etc.
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

const HP_PER_CONST = 10;

@Injectable({ providedIn: 'root' })
export class CharacterStatsService {

  readonly damage$: Observable<DamageBreakdown>;
  readonly hp$:     Observable<HpBreakdown>;
  readonly stats: BaseStats = { ...DEFAULT_BASE_STATS };

  private readonly statsChanged$ = new Subject<void>();

  increment(key: keyof BaseStats): void {
    this.stats[key]++;
    this.statsChanged$.next();
    if (key === 'CONST') this.syncHpMax();
  }

  decrement(key: keyof BaseStats): void {
    if (this.stats[key] > 0) {
      this.stats[key]--;
      this.statsChanged$.next();
      if (key === 'CONST') this.syncHpMax();
    }
  }

  constructor(private equipment: EquipmentService, private playerState: PlayerStateService) {
    const trigger$ = merge(this.equipment.changes$, this.statsChanged$).pipe(startWith(null as void));

    this.damage$ = trigger$.pipe(map(() => this._calcDamage()));
    this.hp$     = trigger$.pipe(map(() => this._calcHp()));

    // Sincronizar hpMax inicial
    this.syncHpMax();
  }

  private syncHpMax(): void {
    const { total } = this._calcHp();
    const current   = this.playerState.snapshot().hp;
    this.playerState.setHp(Math.min(current, total), total);
  }

  private _calcDamage(): DamageBreakdown {
    const base      = this.stats.STR;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['damage'] ?? 0), 0
    );
    return { base, equipment, total: base + equipment };
  }

  private _calcHp(): HpBreakdown {
    const base      = this.stats.CONST * HP_PER_CONST;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['hp'] ?? 0), 0
    );
    return { base, equipment, total: base + equipment };
  }
}
