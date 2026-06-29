import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';
import { InventoryService } from './inventory.service';
import { MAP_REGISTRY, GEM_RESPAWN_MIN_MS, GEM_RESPAWN_MAX_MS } from '../scenes/gamescene/map-config';
import { LOOT_TABLES } from '../physics/griddrops';

/**
 * Mejoras de MAPA (ventana abierta desde el cofre central de cada mapa). Funcionan como
 * LOGROS de mapa: cada mejora se completa UNA vez (no acumulativa) y se paga con el
 * MATERIAL que sueltan los enemigos de ESE mapa (p.ej. en el 1 los "Ojos de Slime").
 * Globales entre personajes (el mapa es compartido). Persisten en local + cuenta de
 * Supabase (global_data.account.mapUpgrades).
 *
 * Los efectos los leen los sistemas de spawn (enemigos/menas) vía los getters de abajo.
 */

export interface MapUpgradeDef { id: string; name: string; desc: string; icon: string; effect: string; cost: number; }
export interface MapMaterial { name: string; icon: string; }

export const MAP_UPGRADES: MapUpgradeDef[] = [
  { id: 'unlockElite',    name: 'Desbloquear Élite',    desc: 'Permite que aparezcan enemigos de Élite en este mapa.',        icon: 'flame-outline',   effect: 'Élite',    cost: 50 },
  { id: 'unlockOblivion', name: 'Desbloquear Oblivion', desc: 'Permite que aparezcan enemigos de Oblivion (requiere Élite).', icon: 'skull-outline',   effect: 'Oblivion', cost: 100 },
  { id: 'maxEnemies',     name: 'Enemigos máx.',        desc: 'Aumenta el máximo de enemigos a la vez.',                      icon: 'people-outline',  effect: '+1',       cost: 15 },
  { id: 'respawn',        name: 'Reaparición',          desc: 'Los enemigos reaparecen antes.',                               icon: 'refresh-outline', effect: '−1s',      cost: 15 },
  { id: 'ore',            name: 'Menas máx.',           desc: 'Sube en 1 el máximo de menas a la vez.',                       icon: 'diamond-outline', effect: '+1',       cost: 25 },
  { id: 'oreRespawn',     name: 'Respawn de menas',     desc: 'Las menas reaparecen 1s antes.',                               icon: 'hourglass-outline', effect: '−1s',    cost: 25 },
  { id: 'unlockGem',      name: 'Desbloquear gemas',    desc: 'Permite que aparezcan gemas (máx. 1 a la vez) en este mapa.',  icon: 'prism-outline',   effect: 'Gemas',    cost: 75 },
  { id: 'gemRespawnMin',  name: 'Reaparición mín. gema', desc: 'Reduce 10s el tiempo MÍNIMO de reaparición de gemas.',         icon: 'hourglass-outline', effect: '−10s',   cost: 40 },
  { id: 'gemRespawnMax',  name: 'Reaparición máx. gema', desc: 'Reduce 10s el tiempo MÁXIMO de reaparición de gemas.',         icon: 'hourglass-outline', effect: '−10s',   cost: 40 },
  { id: 'treeMax',        name: 'Árboles máx.',         desc: 'Sube en 1 el máximo de árboles a la vez.',                     icon: 'leaf-outline',    effect: '+1',       cost: 25 },
  { id: 'treeRespawn',    name: 'Respawn de árboles',   desc: 'Los árboles reaparecen 1s antes.',                             icon: 'hourglass-outline', effect: '−1s',    cost: 25 },
];

const STORAGE_KEY = 'map_upgrades';

@Injectable({ providedIn: 'root' })
export class MapUpgradesService {
  private storage = inject(StorageService);
  private inventory = inject(InventoryService);

  /** completed[mapId] = [upgradeId…] mejoras ya completadas en ese mapa. */
  private completed: Record<string, string[]> = {};
  private loadPromise: Promise<void>;

  readonly changes$ = new BehaviorSubject<void>(undefined);

  constructor() {
    // El inventario cambia (drops, gasto) → refresca la UI (cuántos materiales hay).
    this.inventory.changes$.subscribe(() => this.changes$.next());
    this.loadPromise = this.load();
  }

  readonly defs = MAP_UPGRADES;
  private def(id: string): MapUpgradeDef | undefined { return MAP_UPGRADES.find(u => u.id === id); }

  /** Material de pago del mapa = el drop 'Material' del enemigo de ese mapa (p.ej. Ojo de Slime). */
  materialFor(mapId: string): MapMaterial | null {
    const enemyType = MAP_REGISTRY[mapId]?.spawns?.[0]?.enemyType;
    if (!enemyType) return null;
    const mat = (LOOT_TABLES[enemyType] ?? []).find(e => e.category === 'Material' && e.type === 'item');
    return mat ? { name: mat.name, icon: mat.icon ?? '' } : null;
  }

  /** Cuántas unidades del material del mapa tiene el jugador en el inventario. */
  materialCount(mapId: string): number {
    const mat = this.materialFor(mapId);
    return mat ? this.inventory.countByName(mat.name) : 0;
  }

  isCompleted(mapId: string, upId: string): boolean {
    const c = this.completed[mapId];
    return Array.isArray(c) && c.includes(upId);
  }
  cost(upId: string): number { return this.def(upId)?.cost ?? 0; }
  canComplete(mapId: string, upId: string): boolean {
    // Oblivion requiere tener Élite desbloqueado primero.
    if (upId === 'unlockOblivion' && !this.isCompleted(mapId, 'unlockElite')) return false;
    // Las reaparición de gema requieren tener gemas desbloqueadas primero.
    if ((upId === 'gemRespawnMin' || upId === 'gemRespawnMax') && !this.isCompleted(mapId, 'unlockGem')) return false;
    return !this.isCompleted(mapId, upId)
        && !!this.materialFor(mapId)
        && this.materialCount(mapId) >= this.cost(upId);
  }

  /** Mejoras pendientes / completadas del mapa (para las dos pestañas). */
  pending(mapId: string): MapUpgradeDef[] { return MAP_UPGRADES.filter(u => !this.isCompleted(mapId, u.id)); }
  done(mapId: string): MapUpgradeDef[] { return MAP_UPGRADES.filter(u => this.isCompleted(mapId, u.id)); }

  /** Completa una mejora (gasta el material del mapa, una sola vez). Devuelve true si pudo. */
  complete(mapId: string, upId: string): boolean {
    const mat = this.materialFor(mapId);
    if (!mat || !this.canComplete(mapId, upId)) return false;
    if (!this.inventory.consumeByName(mat.name, this.cost(upId))) return false;
    if (!this.completed[mapId]) this.completed[mapId] = [];
    this.completed[mapId].push(upId);
    this.changes$.next();
    this.persist();
    return true;
  }

  /** ¿Hay alguna mejora completada en este mapa? (habilita el botón Restablecer). */
  hasAnyCompleted(mapId: string): boolean { return (this.completed[mapId]?.length ?? 0) > 0; }

  /** Restablece el mapa: todas las mejoras vuelven a "Por completar" y sus efectos se
   *  revierten. No devuelve los materiales gastados. */
  reset(mapId: string): void {
    if (!this.hasAnyCompleted(mapId)) return;
    delete this.completed[mapId];
    this.changes$.next();
    this.persist();
  }

  // ── Efectos (los leen los sistemas de spawn) ─────────────────────────────────
  extraMaxEnemies(mapId: string): number { return this.isCompleted(mapId, 'maxEnemies') ? 1 : 0; }
  respawnReductionMs(mapId: string): number { return this.isCompleted(mapId, 'respawn') ? 1000 : 0; }
  extraOre(mapId: string): number { return this.isCompleted(mapId, 'ore') ? 1 : 0; }
  oreRespawnReductionMs(mapId: string): number { return this.isCompleted(mapId, 'oreRespawn') ? 1000 : 0; }
  extraTrees(mapId: string): number { return this.isCompleted(mapId, 'treeMax') ? 1 : 0; }
  treeRespawnReductionMs(mapId: string): number { return this.isCompleted(mapId, 'treeRespawn') ? 1000 : 0; }
  /** Hasta desbloquearlos, los enemigos de Élite/Oblivion NO aparecen en el mapa. */
  eliteUnlocked(mapId: string): boolean { return this.isCompleted(mapId, 'unlockElite'); }
  oblivionUnlocked(mapId: string): boolean { return this.isCompleted(mapId, 'unlockOblivion'); }

  /** Gemas: bloqueadas hasta desbloquearlas; entonces máx. 1 con respawn aleatorio entre
   *  min y max (cada extremo reducible con su mejora de mapa, suelo 5s). */
  gemUnlocked(mapId: string): boolean { return this.isCompleted(mapId, 'unlockGem'); }
  gemRespawnMinMs(mapId: string): number {
    return Math.max(5000, GEM_RESPAWN_MIN_MS - (this.isCompleted(mapId, 'gemRespawnMin') ? 10000 : 0));
  }
  gemRespawnMaxMs(mapId: string): number {
    return Math.max(this.gemRespawnMinMs(mapId), GEM_RESPAWN_MAX_MS - (this.isCompleted(mapId, 'gemRespawnMax') ? 10000 : 0));
  }

  // ── Persistencia ─────────────────────────────────────────────────────────────

  /** Acepta solo `Record<mapId, string[]>`; descarta entradas con formato antiguo (niveles). */
  private sanitize(raw: any): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    if (raw && typeof raw === 'object') {
      for (const mapId of Object.keys(raw)) {
        if (Array.isArray(raw[mapId])) out[mapId] = raw[mapId].filter((x: any) => typeof x === 'string');
      }
    }
    return out;
  }

  private async load(): Promise<void> {
    try {
      this.completed = this.sanitize(await this.storage.get(STORAGE_KEY));
    } catch (e) {
      console.warn('[map-upgrades] no se pudo restaurar', e);
    }
    this.changes$.next();
  }
  private persist(): void { this.storage.set(STORAGE_KEY, this.completed); }

  getSnapshot(): Record<string, string[]> { return this.completed; }
  async restore(data: any): Promise<void> {
    await this.loadPromise;
    if (data && typeof data === 'object') {
      this.completed = this.sanitize(data);
      this.changes$.next();
      this.persist();
    }
  }
}
