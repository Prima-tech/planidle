import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { KillService } from './kill.service';
import { MapUpgradesService } from './map-upgrades.service';
import { MAP_REGISTRY } from '../scenes/gamescene/map-config';

/**
 * Dominio de mapa: barra de progreso por mapa con objetivos (kills por rareza,
 * desbloqueos de élite/oblivion y mejoras del cofre central). Todo se CALCULA en
 * vivo desde datos ya persistidos de cuenta (globalKills de KillService + mejoras
 * de MapUpgradesService), así que no necesita snapshot propio. Al 100% el mapa
 * queda "dominado" y otorga un bonus de botín permanente en ese mapa (lo consumen
 * griddrops en vivo y offline-gains para las tasas AFK).
 */

// Tramos incrementales de kills, iguales para todos los mapas de momento.
// Cada tramo cuenta como un paso más hacia el 100%; la UI muestra solo el tramo activo.
const BASE_KILL_TIERS     = [100, 500];
const ELITE_KILL_TIERS    = [50, 200];
const OBLIVION_KILL_TIERS = [25, 100];

/** Bonus de botín (%) permanente en un mapa dominado (solo items, como el resto de bonus). */
export const DOMINION_DROP_BONUS = 10;

export interface DominionStep {
  id: string;
  labelKey: string;                       // clave i18n (MAP.DOM_*)
  labelParams?: Record<string, number>;   // p.ej. { n: 100 } para "Mata {{n}} enemigos"
  current: number;
  target: number;
  done: boolean;
  /** Tramo actual/total en objetivos incrementales (p.ej. "1/2"); solo si hay varios. */
  stage?: string;
}

export interface DominionState {
  mapId: string;
  steps: DominionStep[];
  percent: number;      // 0..100 (entero)
  dominated: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapDominionService {

  private kill        = inject(KillService);
  private mapUpgrades = inject(MapUpgradesService);

  /** Se reemite cuando cambia cualquier insumo del dominio (kills de cuenta o mejoras). */
  readonly changes$ = new BehaviorSubject<void>(undefined);

  constructor() {
    this.kill.globalKills$.subscribe(() => this.changes$.next());
    this.mapUpgrades.changes$.subscribe(() => this.changes$.next());
  }

  /** ¿Tiene dominio este mapa? Solo los que spawnean enemigo propio (el hogar no). */
  hasDominion(mapId: string): boolean {
    return (MAP_REGISTRY[mapId]?.spawns?.length ?? 0) > 0;
  }

  /** Estado completo del dominio de un mapa, calculado en vivo. */
  state(mapId: string): DominionState {
    // Solo cuentan los enemigos propios del mapa (y sus variantes); los animales
    // de caza también quedan registrados en globalKills pero no suman dominio.
    const baseTypes = (MAP_REGISTRY[mapId]?.spawns ?? []).map(s => s.enemyType);
    const kills = this.kill.getGlobalMapKills(mapId);
    const countKills = (suffix: string) =>
      baseTypes.reduce((sum, t) => sum + (kills[t + suffix] ?? 0), 0);

    const steps: DominionStep[] = [];
    // Cada entrada es la fracción [0..1] de un paso; el % es su media. Los objetivos
    // incrementales aportan una fracción POR TRAMO (aunque la UI muestre solo uno).
    const fractions: number[] = [];

    const addTiered = (id: string, labelKey: string, current: number, tiers: number[]) => {
      for (const t of tiers) fractions.push(Math.min(1, current / t));
      const idx = tiers.findIndex(t => current < t);       // tramo activo (-1 = todos hechos)
      const target = idx === -1 ? tiers[tiers.length - 1] : tiers[idx];
      steps.push({
        id, labelKey,
        labelParams: { n: target },
        current: Math.min(current, target),
        target,
        done: idx === -1,
        stage: tiers.length > 1 ? `${idx === -1 ? tiers.length : idx + 1}/${tiers.length}` : undefined,
      });
    };
    const addBool = (id: string, labelKey: string, done: boolean) => {
      fractions.push(done ? 1 : 0);
      steps.push({ id, labelKey, current: done ? 1 : 0, target: 1, done });
    };

    addTiered('kills_base', 'MAP.DOM_KILL_BASE', countKills(''), BASE_KILL_TIERS);
    addBool('unlock_elite', 'MAP.DOM_UNLOCK_ELITE', this.mapUpgrades.eliteUnlocked(mapId));
    addTiered('kills_elite', 'MAP.DOM_KILL_ELITE', countKills('_elite'), ELITE_KILL_TIERS);
    addBool('unlock_oblivion', 'MAP.DOM_UNLOCK_OBLIVION', this.mapUpgrades.oblivionUnlocked(mapId));
    addTiered('kills_oblivion', 'MAP.DOM_KILL_OBLIVION', countKills('_oblivion'), OBLIVION_KILL_TIERS);

    // Mejoras del cofre central: todas compradas.
    const totalUpgrades = this.mapUpgrades.defs.length;
    const doneUpgrades  = this.mapUpgrades.done(mapId).length;
    fractions.push(totalUpgrades > 0 ? doneUpgrades / totalUpgrades : 1);
    steps.push({ id: 'chest', labelKey: 'MAP.DOM_CHEST', current: doneUpgrades, target: totalUpgrades, done: doneUpgrades >= totalUpgrades });

    const dominated = steps.every(s => s.done);
    const percent = dominated ? 100
      : Math.floor(fractions.reduce((s, f) => s + f, 0) / fractions.length * 100);

    return { mapId, steps, percent, dominated };
  }

  isDominated(mapId: string): boolean {
    return this.hasDominion(mapId) && this.state(mapId).dominated;
  }

  /** Multiplicador de botín del mapa (p.ej. 1.10 si está dominado, 1 si no). */
  dropMultiplier(mapId: string | undefined): number {
    if (!mapId) return 1;
    return this.isDominated(mapId) ? 1 + DOMINION_DROP_BONUS / 100 : 1;
  }
}
