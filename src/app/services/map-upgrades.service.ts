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

// name/desc son CLAVES i18n (se traducen con `| translate` en la ventana de mejoras
// de mapa). `effect` es una etiqueta corta/símbolo que se muestra tal cual. Ver
// MAP_UPGRADES.* en los json.
export const MAP_UPGRADES: MapUpgradeDef[] = [
  { id: 'unlockElite',    name: 'MAP_UPGRADES.UNLOCK_ELITE.NAME',    desc: 'MAP_UPGRADES.UNLOCK_ELITE.DESC',    icon: 'flame-outline',   effect: 'Élite',    cost: 50 },
  { id: 'unlockOblivion', name: 'MAP_UPGRADES.UNLOCK_OBLIVION.NAME', desc: 'MAP_UPGRADES.UNLOCK_OBLIVION.DESC', icon: 'skull-outline',   effect: 'Oblivion', cost: 100 },
  { id: 'maxEnemies',     name: 'MAP_UPGRADES.MAX_ENEMIES.NAME',     desc: 'MAP_UPGRADES.MAX_ENEMIES.DESC',     icon: 'people-outline',  effect: '+1',       cost: 15 },
  { id: 'respawn',        name: 'MAP_UPGRADES.RESPAWN.NAME',         desc: 'MAP_UPGRADES.RESPAWN.DESC',         icon: 'refresh-outline', effect: '−1s',      cost: 15 },
  { id: 'ore',            name: 'MAP_UPGRADES.ORE.NAME',             desc: 'MAP_UPGRADES.ORE.DESC',             icon: 'diamond-outline', effect: '+1',       cost: 25 },
  { id: 'oreRespawn',     name: 'MAP_UPGRADES.ORE_RESPAWN.NAME',     desc: 'MAP_UPGRADES.ORE_RESPAWN.DESC',     icon: 'hourglass-outline', effect: '−1s',    cost: 25 },
  { id: 'unlockGem',      name: 'MAP_UPGRADES.UNLOCK_GEM.NAME',      desc: 'MAP_UPGRADES.UNLOCK_GEM.DESC',      icon: 'prism-outline',   effect: 'Gemas',    cost: 75 },
  { id: 'gemRespawnMin',  name: 'MAP_UPGRADES.GEM_RESPAWN_MIN.NAME', desc: 'MAP_UPGRADES.GEM_RESPAWN_MIN.DESC', icon: 'hourglass-outline', effect: '−10s',   cost: 40 },
  { id: 'gemRespawnMax',  name: 'MAP_UPGRADES.GEM_RESPAWN_MAX.NAME', desc: 'MAP_UPGRADES.GEM_RESPAWN_MAX.DESC', icon: 'hourglass-outline', effect: '−10s',   cost: 40 },
  { id: 'treeMax',        name: 'MAP_UPGRADES.TREE_MAX.NAME',        desc: 'MAP_UPGRADES.TREE_MAX.DESC',        icon: 'leaf-outline',    effect: '+1',       cost: 25 },
  { id: 'treeRespawn',    name: 'MAP_UPGRADES.TREE_RESPAWN.NAME',    desc: 'MAP_UPGRADES.TREE_RESPAWN.DESC',    icon: 'hourglass-outline', effect: '−1s',    cost: 25 },
  { id: 'unlockRabbit',   name: 'MAP_UPGRADES.UNLOCK_RABBIT.NAME',   desc: 'MAP_UPGRADES.UNLOCK_RABBIT.DESC',   icon: 'paw-outline',     effect: 'Conejos',  cost: 30 },
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
  /** Conejos: no aparecen hasta completar "Desbloquear conejos" en el mapa. */
  rabbitUnlocked(mapId: string): boolean { return this.isCompleted(mapId, 'unlockRabbit'); }

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
