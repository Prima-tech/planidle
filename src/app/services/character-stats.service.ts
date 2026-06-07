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
  dex:       number;
  equipment: number;
  talents:   number;
  buffs:     number;
  total:     number;
}

export interface EvasionBreakdown {
  dex:       number;
  equipment: number;
  buffs:     number;
  total:     number;
}

export interface CritChanceBreakdown {
  base:      number;  // always 10
  equipment: number;
  buffs:     number;
  talents:   number;
  total:     number;  // %
}

export interface CritDamageBreakdown {
  base:      number;  // always 150
  str:       number;  // floor((STR-20)/5), min 0
  equipment: number;
  buffs:     number;
  total:     number;  // %
}

export interface MagicDamageBreakdown {
  base:      number;  // INT
  equipment: number;
  talents:   number;
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

const RESET_BASE_STATS: BaseStats = {
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

  readonly damage$:       Observable<DamageBreakdown>;
  readonly magicDamage$:  Observable<MagicDamageBreakdown>;
  readonly hp$:      Observable<HpBreakdown>;
  readonly mp$:      Observable<MpBreakdown>;
  readonly defense$:    Observable<DefenseBreakdown>;
  readonly evasion$:    Observable<EvasionBreakdown>;
  readonly critChance$: Observable<CritChanceBreakdown>;
  readonly critDamage$: Observable<CritDamageBreakdown>;
  readonly freePoints$: Observable<number>;
  readonly stats: BaseStats = { ...DEFAULT_BASE_STATS };

  private readonly statsChanged$ = new Subject<void>();

  increment(key: keyof BaseStats): void {
    if (this.freePoints <= 0) return;
    this.stats[key]++;
    this.statsChanged$.next();
    if (key === 'CONST') this.syncHpMax();
    if (key === 'MAG')   this.syncMpMax();
  }

  decrement(key: keyof BaseStats): void {
    if (this.stats[key] > 10) {
      this.stats[key]--;
      this.statsChanged$.next();
      if (key === 'CONST') this.syncHpMax();
      if (key === 'MAG')   this.syncMpMax();
    }
  }

  resetStats(): void {
    Object.assign(this.stats, RESET_BASE_STATS);
    this.statsChanged$.next();
    this.syncHpMax();
    this.syncMpMax();
  }

  restoreStats(stats: BaseStats): void {
    Object.assign(this.stats, stats);
    this.statsChanged$.next();
    this.syncHpMax();
    this.syncMpMax();
  }

  get freePoints(): number { return this._calcFreePoints(); }

  constructor(
    private equipment: EquipmentService,
    private playerState: PlayerStateService,
    private talent: TalentService,
    private buff: BuffService,
  ) {
    const trigger$  = merge(this.equipment.changes$, this.statsChanged$, this.talent.changes$).pipe(startWith(null as void));
    const defTrigger$ = merge(trigger$, this.buff.buffs$);

    this.damage$       = trigger$.pipe(map(() => this._calcDamage()));
    this.magicDamage$  = trigger$.pipe(map(() => this._calcMagicDamage()));
    this.hp$      = trigger$.pipe(map(() => this._calcHp()));
    this.mp$      = trigger$.pipe(map(() => this._calcMp()));
    this.defense$    = defTrigger$.pipe(map(() => this._calcDefense()));
    this.evasion$    = defTrigger$.pipe(map(() => this._calcEvasion()));
    this.critChance$ = defTrigger$.pipe(map(() => this._calcCritChance()));
    this.critDamage$ = defTrigger$.pipe(map(() => this._calcCritDamage()));
    this.freePoints$ = merge(this.statsChanged$, this.playerState.state$).pipe(
      startWith(null),
      map(() => this._calcFreePoints()),
    );

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

  private _calcFreePoints(): number {
    const lvl   = this.playerState.snapshot().lvl;
    const spent = (Object.values(this.stats) as number[]).reduce((a, v) => a + v, 0) - 60;
    return 8 + (lvl - 1) - spent;
  }

  private _calcDamage(): DamageBreakdown {
    const base      = this.stats.STR;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['damage'] ?? 0), 0
    );
    const talents = this.talent.getBonus().atk;
    return { base, equipment, talents, total: base + equipment + talents };
  }

  private _calcMagicDamage(): MagicDamageBreakdown {
    const base      = this.stats.INT;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['magicDamage'] ?? 0), 0
    );
    const talents = this.talent.getBonus().atk;  // magic tree atk nodes count too
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

  // DEX → defensa/evasión: los primeros 10 puntos no cuentan, cada 10 adicionales = +1 def / +1%
  get currentDefense():      number { return this._calcDefense().total; }
  get currentEvasion():      number { return this._calcEvasion().total; }
  get currentCritChance():   number { return this._calcCritChance().total; }
  get currentCritDamage():   number { return this._calcCritDamage().total; }
  get currentMagicDamage():  number { return this._calcMagicDamage().total; }

  private _calcCritChance(): CritChanceBreakdown {
    const base      = 10;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['critChance'] ?? 0), 0
    );
    const talents = this.talent.getBonus().critChance ?? 0;
    const buffs   = this.buff.getValue('critChance');
    return { base, equipment, talents, buffs, total: base + equipment + talents + buffs };
  }

  private _calcCritDamage(): CritDamageBreakdown {
    const base      = 150;
    const str       = Math.max(0, Math.floor((this.stats.STR - 20) / 5));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['critDamage'] ?? 0), 0
    );
    const buffs = this.buff.getValue('critDamage');
    return { base, str, equipment, buffs, total: base + str + equipment + buffs };
  }

  private _calcEvasion(): EvasionBreakdown {
    const dex       = Math.max(0, Math.floor((this.stats.DEX - 10) / 10));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['evasion'] ?? 0), 0
    );
    const buffs = this.buff.getValue('evasion');
    return { dex, equipment, buffs, total: dex + equipment + buffs };
  }

  private _calcDefense(): DefenseBreakdown {
    const dex       = Math.max(0, Math.floor((this.stats.DEX - 10) / 10));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['defense'] ?? 0), 0
    );
    const talents = this.talent.getBonus().defense;
    const buffs   = this.buff.getValue('defense');
    return { dex, equipment, talents, buffs, total: dex + equipment + talents + buffs };
  }
}
