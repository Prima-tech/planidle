import { Injectable } from '@angular/core';
import { Observable, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { EquipmentService } from './equipment.service';

const BASE_DAMAGE = 10;

export interface DamageBreakdown {
  base:      number;
  equipment: number;
  // attributes: number;  // futuro: bonificación por STR/AGI del personaje
  // buffs:      number;  // futuro: bufos temporales de pociones/habilidades
  // passives:   number;  // futuro: pasivas/talentos permanentes
  total:     number;
}

@Injectable({ providedIn: 'root' })
export class CharacterStatsService {

  readonly damage$: Observable<DamageBreakdown>;

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
    // Futuro: sumar aquí attributes + buffs + passives antes de retornar
    return { base: BASE_DAMAGE, equipment, total: BASE_DAMAGE + equipment };
  }
}
