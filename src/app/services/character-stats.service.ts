import { Injectable } from '@angular/core';
import { merge, Observable, Subject, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { BuffService } from './buff.service';
import { EquipmentService } from './equipment.service';
import { PlayerStateService } from './player-state.service';
import { TalentService } from './talent.service';

export interface DamageBreakdown {
  base:      number;
  equipment: number;
  talents:   number;
  total:     number;
}

export interface HpBreakdown {
  base:      number; // CONST * 10
  equipment: number;
  talents:   number;
  total:     number;
}

export interface MpBreakdown {
  base:      number; // MAG * 5
  equipment: number;
  talents:   number;
  total:     number;
}

export interface DefenseBreakdown {
  equipment: number;
  buffs:     number;
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
const MP_PER_MAG   = 5;

@Injectable({ providedIn: 'root' })
export class CharacterStatsService {

  readonly damage$:  Observable<DamageBreakdown>;
  readonly hp$:      Observable<HpBreakdown>;
  readonly mp$:      Observable<MpBreakdown>;
  readonly defense$: Observable<DefenseBreakdown>;
  readonly stats: BaseStats = { ...DEFAULT_BASE_STATS };

  private readonly statsChanged$ = new Subject<void>();

  increment(key: keyof BaseStats): void {
    this.stats[key]++;
    this.statsChanged$.next();
    if (key === 'CONST') this.syncHpMax();
    if (key === 'MAG')   this.syncMpMax();
  }

  decrement(key: keyof BaseStats): void {
    if (this.stats[key] > 0) {
      this.stats[key]--;
      this.statsChanged$.next();
      if (key === 'CONST') this.syncHpMax();
      if (key === 'MAG')   this.syncMpMax();
    }
  }

  constructor(
    private equipment: EquipmentService,
    private playerState: PlayerStateService,
    private talent: TalentService,
    private buff: BuffService,
  ) {
    const trigger$  = merge(this.equipment.changes$, this.statsChanged$, this.talent.changes$).pipe(startWith(null as void));
    const defTrigger$ = merge(trigger$, this.buff.buffs$);

    this.damage$  = trigger$.pipe(map(() => this._calcDamage()));
    this.hp$      = trigger$.pipe(map(() => this._calcHp()));
    this.mp$      = trigger$.pipe(map(() => this._calcMp()));
    this.defense$ = defTrigger$.pipe(map(() => this._calcDefense()));

    trigger$.subscribe(() => {
      this.syncHpMax();
      this.syncMpMax();
    });
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
    const talents = this.talent.getBonus().atk;
    return { base, equipment, talents, total: base + equipment + talents };
  }

  private syncMpMax(): void {
    const { total } = this._calcMp();
    const current   = this.playerState.snapshot().mp ?? total;
    this.playerState.setMp(Math.min(current, total), total);
  }

  private _calcHp(): HpBreakdown {
    const base      = this.stats.CONST * HP_PER_CONST;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['hp'] ?? 0), 0
    );
    const talents = this.talent.getBonus().hp;
    return { base, equipment, talents, total: base + equipment + talents };
  }

  private _calcMp(): MpBreakdown {
    const base      = this.stats.MAG * MP_PER_MAG;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['mp'] ?? 0), 0
    );
    const talents = this.talent.getBonus().mp;
    return { base, equipment, talents, total: base + equipment + talents };
  }

  private _calcDefense(): DefenseBreakdown {
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['defense'] ?? 0), 0
    );
    const buffs = this.buff.getValue('defense');
    return { equipment, buffs, total: equipment + buffs };
  }
}
