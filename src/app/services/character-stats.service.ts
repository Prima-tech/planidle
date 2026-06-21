import { Injectable } from '@angular/core';
import { merge, Observable, Subject, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { BuffService } from './buff.service';
import { EquipmentService } from './equipment.service';
import { PlayerStateService } from './player-state.service';
import { TalentService } from './talent.service';

export interface DamageBreakdown {
  base:      number;
  equipment: number;  // daño plano de equipo
  talents:   number;
  percent:   number;  // % adicional de armas (damagePercent), sobre el subtotal
  total:     number;
}

export interface HpBreakdown {
  base:      number; // HP_BASE + CONST * 10
  equipment: number;
  talents:   number;
  total:     number;
}

export interface MpBreakdown {
  base:      number; // MP_BASE + MAG * 5
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
  talents:   number;
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
  str:       number;  // floor(STR/5), min 0
  equipment: number;
  buffs:     number;
  total:     number;  // %
}

export interface MagicDamageBreakdown {
  base:      number;  // DAMAGE_BASE + INT
  equipment: number;
  talents:   number;
  total:     number;
}

export interface RegenBreakdown {
  base:      number;  // CONST (hp) or MAG (mp)
  equipment: number;
  talents:   number;
  total:     number;
  min:       number;  // floor(total / 2)
}

export interface DropRateBreakdown {
  chr:       number;  // floor(CHR/2), min 0
  equipment: number;
  talents:   number;
  total:     number;  // % bonus sobre la chance base
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
  STR:   0,
  DEX:   0,
  CONST: 0,
  INT:   0,
  MAG:   0,
  CHR:   0,
};

const RESET_BASE_STATS: BaseStats = {
  STR:   0,
  DEX:   0,
  CONST: 0,
  INT:   0,
  MAG:   0,
  CHR:   0,
};

const HP_PER_CONST = 10;
const MP_PER_MAG   = 5;

// Valores base con todas las stats a 0 (nivel 1). Cada punto de stat suma encima.
const HP_BASE     = 50;   // + CONST * HP_PER_CONST
const MP_BASE     = 50;   // + MAG  * MP_PER_MAG
const DAMAGE_BASE = 10;   // + STR (físico) / + INT (mágico)
const POINTS_PER_LEVEL = 1; // 0 puntos al nivel 1; +1 por cada nivel

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
  readonly hpRegen$:    Observable<RegenBreakdown>;
  readonly mpRegen$:    Observable<RegenBreakdown>;
  readonly dropRate$:   Observable<DropRateBreakdown>;
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
    if (this.stats[key] > 0) {
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
    this.hpRegen$  = trigger$.pipe(map(() => this._calcHpRegen()));
    this.mpRegen$  = trigger$.pipe(map(() => this._calcMpRegen()));
    this.dropRate$ = trigger$.pipe(map(() => this._calcDropRate()));

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
    const spent = (Object.values(this.stats) as number[]).reduce((a, v) => a + v, 0);
    return (lvl - 1) * POINTS_PER_LEVEL - spent;
  }

  private _calcDamage(): DamageBreakdown {
    const base      = DAMAGE_BASE + this.stats.STR;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['damage'] ?? 0), 0
    );
    const talents = this.talent.getBonus().atk;
    // Armas con damagePercent multiplican el daño físico total (no suman plano)
    const percent = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['damagePercent'] ?? 0), 0
    );
    const subtotal = base + equipment + talents;
    return { base, equipment, talents, percent, total: Math.floor(subtotal * (1 + percent / 100)) };
  }

  private _calcMagicDamage(): MagicDamageBreakdown {
    const base      = DAMAGE_BASE + this.stats.INT;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['magicDamage'] ?? 0), 0
    );
    const talents = this.talent.getBonus().magicAtk;  // nodos magicAtk + base de habilidades mágicas
    return { base, equipment, talents, total: base + equipment + talents };
  }

  private _calcHpRegen(): RegenBreakdown {
    const base      = this.stats.CONST;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['hpRegen'] ?? 0), 0
    );
    const talents = this.talent.getBonus().hpRegen;
    const total   = base + equipment + talents;
    return { base, equipment, talents, total, min: Math.floor(total / 2) };
  }

  private _calcMpRegen(): RegenBreakdown {
    const base      = this.stats.MAG;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['mpRegen'] ?? 0), 0
    );
    const talents = this.talent.getBonus().mpRegen;
    const total   = base + equipment + talents;
    return { base, equipment, talents, total, min: Math.floor(total / 2) };
  }

  private _calcDropRate(): DropRateBreakdown {
    const chr       = Math.max(0, Math.floor(this.stats.CHR / 2));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['dropRate'] ?? 0), 0
    );
    const talents = this.talent.getBonus().dropRate ?? 0;
    return { chr, equipment, talents, total: chr + equipment + talents };
  }

  private syncMpMax(): void {
    const { total } = this._calcMp();
    const current   = this.playerState.snapshot().mp ?? total;
    this.playerState.setMp(Math.min(current, total), total);
  }

  private _calcHp(): HpBreakdown {
    const base      = HP_BASE + this.stats.CONST * HP_PER_CONST;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['hp'] ?? 0), 0
    );
    const talents = this.talent.getBonus().hp;
    return { base, equipment, talents, total: base + equipment + talents };
  }

  private _calcMp(): MpBreakdown {
    const base      = MP_BASE + this.stats.MAG * MP_PER_MAG;
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['mp'] ?? 0), 0
    );
    const talents = this.talent.getBonus().mp;
    return { base, equipment, talents, total: base + equipment + talents };
  }

  get currentDamage():       number { return this._calcDamage().total; }
  // DEX → defensa/evasión: cada 10 puntos = +1 def / +1% evasión
  get currentDefense():      number { return this._calcDefense().total; }
  get currentEvasion():      number { return this._calcEvasion().total; }
  get currentCritChance():   number { return this._calcCritChance().total; }
  get currentCritDamage():   number { return this._calcCritDamage().total; }
  get currentMagicDamage():  number { return this._calcMagicDamage().total; }
  get currentHpRegen():      RegenBreakdown { return this._calcHpRegen(); }
  get currentMpRegen():      RegenBreakdown { return this._calcMpRegen(); }
  get currentDropRateBonus(): number { return this._calcDropRate().total; }

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
    const str       = Math.max(0, Math.floor(this.stats.STR / 5));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['critDamage'] ?? 0), 0
    );
    const buffs = this.buff.getValue('critDamage');
    return { base, str, equipment, buffs, total: base + str + equipment + buffs };
  }

  private _calcEvasion(): EvasionBreakdown {
    const dex       = Math.max(0, Math.floor(this.stats.DEX / 10));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['evasion'] ?? 0), 0
    );
    const talents = this.talent.getBonus().evasion;
    const buffs   = this.buff.getValue('evasion');
    return { dex, equipment, talents, buffs, total: dex + equipment + talents + buffs };
  }

  private _calcDefense(): DefenseBreakdown {
    const dex       = Math.max(0, Math.floor(this.stats.DEX / 10));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['defense'] ?? 0), 0
    );
    const talents = this.talent.getBonus().defense;
    const buffs   = this.buff.getValue('defense');
    return { dex, equipment, talents, buffs, total: dex + equipment + talents + buffs };
  }
}
