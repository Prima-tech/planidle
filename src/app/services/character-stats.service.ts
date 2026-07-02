import { Injectable } from '@angular/core';
import { merge, Observable, Subject, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { BuffService } from './buff.service';
import { EquipmentService } from './equipment.service';
import { PlayerStateService } from './player-state.service';
import { TalentService } from './talent.service';
import { GatheringEquipmentService } from './gathering-equipment.service';

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
  percent:   number;  // % de armaduras (hpPercent), sobre el subtotal
  total:     number;
}

export interface MpBreakdown {
  base:      number; // MP_BASE + MAG * 5
  equipment: number;
  talents:   number;
  total:     number;
}

export interface DefenseBreakdown {
  vit:       number;  // floor(CONST/10) — la defensa es de Constitución
  equipment: number;
  talents:   number;
  buffs:     number;
  total:     number;
}

export interface EvasionBreakdown {
  chr:       number;  // floor(CHR/10) — las probabilidades son de Carisma (suerte)
  equipment: number;
  talents:   number;
  buffs:     number;
  total:     number;
}

export interface CritChanceBreakdown {
  base:      number;  // always 10
  chr:       number;  // floor(CHR/10) — suerte
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

export interface AttackSpeedBreakdown {
  dex:       number;  // +1% por punto de DEX
  equipment: number;  // stat attackSpeed de equipo
  talents:   number;  // nodos attackSpeed del árbol (rama DEX)
  buffs:     number;
  total:     number;  // % de velocidad extra del golpe básico, capado a +100
}

export interface MagicDamageBreakdown {
  base:      number;  // DAMAGE_BASE + INT
  equipment: number;
  talents:   number;
  percent:   number;  // % de bastones (magicDamagePercent), sobre el subtotal
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

export interface MiningEfficiencyBreakdown {
  str:       number;  // floor(STR/5), min 0 (la fuerza rige minería Y tala)
  equipment: number;  // stat miningEfficiency del pico equipado (equipo de recolección)
  talents:   number;  // talento miningEfficiency
  manual:    number;  // puntos repartidos a mano en la pestaña de minería
  total:     number;
}

export interface WoodcuttingEfficiencyBreakdown {
  str:       number;  // floor(STR/5), min 0 (skill base 0, +1 por cada 5 de Fuerza)
  equipment: number;  // stat woodcuttingEfficiency del hacha equipada (equipo de recolección)
  talents:   number;  // talento woodcuttingEfficiency (fuente futura)
  total:     number;
}

export interface MiningPowerBreakdown {
  equipment: number;  // fuerza de minado de objetos (pico) — base 0
  talents:   number;
  manual:    number;  // puntos repartidos a mano en la pestaña de minería
  total:     number;  // daño por golpe acertado a la vida de la mena
}

export interface WoodcuttingPowerBreakdown {
  equipment: number;  // fuerza de tala del hacha — base 0
  talents:   number;
  total:     number;  // daño por golpe acertado a la vida del árbol
}

export interface MiningExpBreakdown {
  chr:       number;  // floor(CHR/2) — Carisma sube la exp de las skills (individual)
  equipment: number;  // bonus de exp de minería de objetos
  talents:   number;
  manual:    number;  // puntos repartidos a mano en la pestaña de minería
  total:     number;  // exp extra por mena recolectada
}

export interface WoodcuttingExpBreakdown {
  chr:       number;  // floor(CHR/2) — individual, no comparte con minería
  equipment: number;  // stat woodcuttingExp del hacha (fuente futura)
  talents:   number;
  total:     number;  // exp extra por árbol talado
}

export interface ExpBonusBreakdown {
  chr:       number;  // floor(CHR/2) — % de EXP extra al matar enemigos
  equipment: number;  // stat expBonus de equipo (fuente futura)
  total:     number;  // %
}

export interface ExplorationBreakdown {
  int:       number;  // +1% de metros por punto de INT
  talents:   number;  // nodos exploration del árbol (rama CHR)
  total:     number;  // % de metros extra en expediciones AFK del Modo Mundo
}

/** Atributos de minería que el jugador reparte a mano (sin coste) en la pestaña. */
export type MiningAttr = 'miningPower' | 'miningEfficiency' | 'miningExp';

export interface MiningAllocations {
  miningPower:      number;
  miningEfficiency: number;
  miningExp:        number;
}

export interface BaseStats {
  STR:   number;
  DEX:   number;
  CONST: number;
  INT:   number;
  MAG:   number;
  CHR:   number;
}

/** Poder de combate: media geométrica de daño-por-segundo × vida efectiva.
 *  La misma fórmula para el jugador y para el enemigo de un mapa → comparables
 *  en la misma escala. La raíz premia el equilibrio (subir solo daño o solo vida
 *  rinde menos que repartir) y mantiene los números manejables. */
export function combatPowerScore(dps: number, effectiveHp: number): number {
  return Math.round(Math.sqrt(Math.max(0, dps) * Math.max(1, effectiveHp)));
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
  readonly attackSpeed$: Observable<AttackSpeedBreakdown>;
  readonly freePoints$: Observable<number>;
  readonly hpRegen$:    Observable<RegenBreakdown>;
  readonly mpRegen$:    Observable<RegenBreakdown>;
  readonly dropRate$:   Observable<DropRateBreakdown>;
  readonly miningEfficiency$: Observable<MiningEfficiencyBreakdown>;
  readonly woodcuttingEfficiency$: Observable<WoodcuttingEfficiencyBreakdown>;
  readonly miningPower$: Observable<MiningPowerBreakdown>;
  readonly woodcuttingPower$: Observable<WoodcuttingPowerBreakdown>;
  readonly miningExp$:   Observable<MiningExpBreakdown>;
  readonly woodcuttingExp$: Observable<WoodcuttingExpBreakdown>;
  readonly expBonus$:    Observable<ExpBonusBreakdown>;
  readonly exploration$: Observable<ExplorationBreakdown>;
  readonly stats: BaseStats = { ...DEFAULT_BASE_STATS };

  /** Puntos de minería repartidos a mano (sin coste) en la pestaña de minería. */
  readonly miningAlloc: MiningAllocations = { miningPower: 0, miningEfficiency: 0, miningExp: 0 };

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

  // ── Atributos de minería (reparto libre, sin coste) ─────────────────────────

  /** Suma 1 punto al atributo de minería indicado. */
  incrementMining(key: MiningAttr): void {
    this.miningAlloc[key]++;
    this.statsChanged$.next();
  }

  /** Quita 1 punto al atributo de minería indicado (mín 0). */
  decrementMining(key: MiningAttr): void {
    if (this.miningAlloc[key] <= 0) return;
    this.miningAlloc[key]--;
    this.statsChanged$.next();
  }

  /** Total de puntos repartidos a mano (para habilitar/ocultar el botón de reset). */
  get miningAllocTotal(): number {
    return this.miningAlloc.miningPower + this.miningAlloc.miningEfficiency + this.miningAlloc.miningExp;
  }

  /** Devuelve a 0 todos los atributos de minería subidos a mano. */
  resetMining(): void {
    this.miningAlloc.miningPower = 0;
    this.miningAlloc.miningEfficiency = 0;
    this.miningAlloc.miningExp = 0;
    this.statsChanged$.next();
  }

  restoreMining(alloc: MiningAllocations | null | undefined): void {
    this.miningAlloc.miningPower      = alloc?.miningPower      ?? 0;
    this.miningAlloc.miningEfficiency = alloc?.miningEfficiency ?? 0;
    this.miningAlloc.miningExp        = alloc?.miningExp        ?? 0;
    this.statsChanged$.next();
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
    private gathering: GatheringEquipmentService,
  ) {
    const trigger$  = merge(this.equipment.changes$, this.statsChanged$, this.talent.changes$).pipe(startWith(null as void));
    const defTrigger$ = merge(trigger$, this.buff.buffs$);
    // La eficiencia de minado depende también del pico equipado (equipo de recolección).
    const mineTrigger$ = merge(trigger$, this.gathering.changes$);

    this.damage$       = trigger$.pipe(map(() => this._calcDamage()));
    this.magicDamage$  = trigger$.pipe(map(() => this._calcMagicDamage()));
    this.hp$      = trigger$.pipe(map(() => this._calcHp()));
    this.mp$      = trigger$.pipe(map(() => this._calcMp()));
    this.defense$    = defTrigger$.pipe(map(() => this._calcDefense()));
    this.evasion$    = defTrigger$.pipe(map(() => this._calcEvasion()));
    this.critChance$ = defTrigger$.pipe(map(() => this._calcCritChance()));
    this.critDamage$ = defTrigger$.pipe(map(() => this._calcCritDamage()));
    this.attackSpeed$ = defTrigger$.pipe(map(() => this._calcAttackSpeed()));
    this.freePoints$ = merge(this.statsChanged$, this.playerState.state$).pipe(
      startWith(null),
      map(() => this._calcFreePoints()),
    );
    this.hpRegen$  = trigger$.pipe(map(() => this._calcHpRegen()));
    this.mpRegen$  = trigger$.pipe(map(() => this._calcMpRegen()));
    this.dropRate$ = trigger$.pipe(map(() => this._calcDropRate()));
    this.miningEfficiency$ = mineTrigger$.pipe(map(() => this._calcMiningEfficiency()));
    this.woodcuttingEfficiency$ = mineTrigger$.pipe(map(() => this._calcWoodcuttingEfficiency()));
    this.miningPower$ = mineTrigger$.pipe(map(() => this._calcMiningPower()));
    this.woodcuttingPower$ = mineTrigger$.pipe(map(() => this._calcWoodcuttingPower()));
    this.miningExp$   = mineTrigger$.pipe(map(() => this._calcMiningExp()));
    this.woodcuttingExp$ = mineTrigger$.pipe(map(() => this._calcWoodcuttingExp()));
    this.expBonus$    = trigger$.pipe(map(() => this._calcExpBonus()));
    this.exploration$ = trigger$.pipe(map(() => this._calcExploration()));

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
    // Bastones con magicDamagePercent multiplican el daño mágico total (espejo de
    // damagePercent en las espadas).
    const percent = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['magicDamagePercent'] ?? 0), 0
    );
    const subtotal = base + equipment + talents;
    return { base, equipment, talents, percent, total: Math.floor(subtotal * (1 + percent / 100)) };
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

  // Eficiencia de minado: skill base 0, +1 por cada 5 de Fuerza (STR — la fuerza rige
  // minería y tala); + pico equipado + talento miningEfficiency. La usan las menas
  // para decidir el % de acierto al picar.
  private _calcMiningEfficiency(): MiningEfficiencyBreakdown {
    const str       = Math.max(0, Math.floor(this.stats.STR / 5));
    const equipment = this.gathering.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['miningEfficiency'] ?? 0), 0
    );
    const talents = this.talent.getBonus().miningEfficiency ?? 0;
    const manual  = this.miningAlloc.miningEfficiency;
    return { str, equipment, talents, manual, total: str + equipment + talents + manual };
  }

  // Eficiencia de tala: skill base 0, +1 por cada 5 de Fuerza (STR); + hacha equipada
  // (stat woodcuttingEfficiency). La usan los árboles para el % de acierto al talar.
  private _calcWoodcuttingEfficiency(): WoodcuttingEfficiencyBreakdown {
    const str       = Math.max(0, Math.floor(this.stats.STR / 5));
    const equipment = this.gathering.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['woodcuttingEfficiency'] ?? 0), 0
    );
    const talents = (this.talent.getBonus() as any).woodcuttingEfficiency ?? 0;
    return { str, equipment, talents, total: str + equipment + talents };
  }

  // Fuerza de minado: daño por golpe acertado a la vida de la mena. Base 0; el pico la
  // sube (stat miningPower). Sin talento propio aún (queda como fuente futura).
  private _calcMiningPower(): MiningPowerBreakdown {
    const equipment = this.gathering.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['miningPower'] ?? 0), 0
    );
    const talents = 0;
    const manual  = this.miningAlloc.miningPower;
    return { equipment, talents, manual, total: equipment + talents + manual };
  }

  // Fuerza de tala: daño por golpe acertado a la vida del árbol. Base 0; el hacha la
  // sube (stat woodcuttingPower). Sin talento propio aún (fuente futura).
  private _calcWoodcuttingPower(): WoodcuttingPowerBreakdown {
    const equipment = this.gathering.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['woodcuttingPower'] ?? 0), 0
    );
    const talents = 0;
    return { equipment, talents, total: equipment + talents };
  }

  // Exp de minería extra por mena recolectada. CHR (floor/2) + objetos (stat
  // miningExp) + talentos (fuente futura) + puntos manuales.
  private _calcMiningExp(): MiningExpBreakdown {
    const chr       = Math.max(0, Math.floor(this.stats.CHR / 2));
    const equipment = this.gathering.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['miningExp'] ?? 0), 0
    );
    const talents = 0;
    const manual  = this.miningAlloc.miningExp;
    return { chr, equipment, talents, manual, total: chr + equipment + talents + manual };
  }

  // Exp de tala extra por árbol talado — individual, NO comparte con minería.
  private _calcWoodcuttingExp(): WoodcuttingExpBreakdown {
    const chr       = Math.max(0, Math.floor(this.stats.CHR / 2));
    const equipment = this.gathering.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['woodcuttingExp'] ?? 0), 0
    );
    const talents = 0;
    return { chr, equipment, talents, total: chr + equipment + talents };
  }

  // % de EXP extra al matar enemigos (CHR = carisma/mentor). Lo aplican griddrops
  // (kills en vivo) y offline-gains (AFK) sobre EXP_REWARDS.
  private _calcExpBonus(): ExpBonusBreakdown {
    const chr       = Math.max(0, Math.floor(this.stats.CHR / 2));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['expBonus'] ?? 0), 0
    );
    return { chr, equipment, total: chr + equipment };
  }

  // % de metros extra en expediciones AFK del Modo Mundo: INT (+1%/punto) +
  // talentos exploration (rama CHR). Lo consume offline-gains.calculateExploring.
  private _calcExploration(): ExplorationBreakdown {
    const int     = Math.max(0, this.stats.INT);
    const talents = this.talent.getBonus().exploration ?? 0;
    return { int, talents, total: int + talents };
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
    // Armaduras con hpPercent multiplican la vida total (mismo modelo que
    // damagePercent en armas): escala con el personaje — clave para las futuras
    // promociones, donde a nivel 1 un % de poca base es poco.
    const percent = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['hpPercent'] ?? 0), 0
    );
    const subtotal = base + equipment + talents;
    return { base, equipment, talents, percent, total: Math.floor(subtotal * (1 + percent / 100)) };
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
  // CONST → defensa (cada 10 = +1 def) · CHR → evasión/crítico (cada 10 = +1%)
  get currentDefense():      number { return this._calcDefense().total; }
  get currentEvasion():      number { return this._calcEvasion().total; }
  get currentCritChance():   number { return this._calcCritChance().total; }
  get currentCritDamage():   number { return this._calcCritDamage().total; }
  get currentAttackSpeed():  number { return this._calcAttackSpeed().total; }
  get currentMagicDamage():  number { return this._calcMagicDamage().total; }

  /** Poder de combate del personaje (mismo baremo que el mapa). Junta ofensiva
   *  (mejor daño × velocidad × factor de crítico) y supervivencia (HP máx +
   *  defensa como HP equivalente, ampliado por la evasión). */
  get combatPower(): number {
    const dmg = Math.max(this.currentDamage, this.currentMagicDamage);
    const critFactor = 1 + (this.currentCritChance / 100) * (this.currentCritDamage / 100 - 1);
    const dps = dmg * (1 + this.currentAttackSpeed / 100) * critFactor;
    const hpMax = this._calcHp().total;
    const eva   = Math.min(75, this.currentEvasion);   // tope para que no dispare el poder
    const ehp   = (hpMax + this.currentDefense * 20) / (1 - eva / 100);
    return combatPowerScore(dps, ehp);
  }
  get currentHpRegen():      RegenBreakdown { return this._calcHpRegen(); }
  get currentMpRegen():      RegenBreakdown { return this._calcMpRegen(); }
  get currentDropRateBonus(): number { return this._calcDropRate().total; }
  get currentMiningEfficiency(): number { return this._calcMiningEfficiency().total; }
  get currentWoodcuttingEfficiency(): number { return this._calcWoodcuttingEfficiency().total; }
  get currentMiningPower():      number { return this._calcMiningPower().total; }
  get currentWoodcuttingPower(): number { return this._calcWoodcuttingPower().total; }
  get currentMiningExp():        number { return this._calcMiningExp().total; }
  get currentWoodcuttingExp():   number { return this._calcWoodcuttingExp().total; }
  get currentExpBonus():         number { return this._calcExpBonus().total; }
  get currentExplorationBonus(): number { return this._calcExploration().total; }

  private _calcCritChance(): CritChanceBreakdown {
    const base      = 10;
    const chr       = Math.max(0, Math.floor(this.stats.CHR / 10));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['critChance'] ?? 0), 0
    );
    const talents = this.talent.getBonus().critChance ?? 0;
    const buffs   = this.buff.getValue('critChance');
    return { base, chr, equipment, talents, buffs, total: base + chr + equipment + talents + buffs };
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

  // Velocidad de ataque del golpe básico: +1% por punto de DEX + equipo (stat
  // attackSpeed) + buffs. Capada a +100% (el golpe nunca va a más del doble).
  // GameScene la convierte en timeScale de la animación de ataque: 1 + total/100.
  private _calcAttackSpeed(): AttackSpeedBreakdown {
    const dex       = Math.max(0, this.stats.DEX);
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['attackSpeed'] ?? 0), 0
    );
    const talents = this.talent.getBonus().attackSpeed ?? 0;
    const buffs   = this.buff.getValue('attackSpeed');
    return { dex, equipment, talents, buffs, total: Math.min(100, dex + equipment + talents + buffs) };
  }

  private _calcEvasion(): EvasionBreakdown {
    const chr       = Math.max(0, Math.floor(this.stats.CHR / 10));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['evasion'] ?? 0), 0
    );
    const talents = this.talent.getBonus().evasion;
    const buffs   = this.buff.getValue('evasion');
    return { chr, equipment, talents, buffs, total: chr + equipment + talents + buffs };
  }

  private _calcDefense(): DefenseBreakdown {
    const vit       = Math.max(0, Math.floor(this.stats.CONST / 10));
    const equipment = this.equipment.slots.reduce(
      (sum, slot) => sum + (slot.item?.stats?.['defense'] ?? 0), 0
    );
    const talents = this.talent.getBonus().defense;
    const buffs   = this.buff.getValue('defense');
    return { vit, equipment, talents, buffs, total: vit + equipment + talents + buffs };
  }
}
