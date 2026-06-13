import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { StorageService } from './storage.service';

/**
 * Sistema de construcción de la ciudad (mapa `hogar`/Asgard).
 *
 * Las construcciones se persisten en una clave global única (`STORAGE_KEY`)
 * vía StorageService — igual que TownChestService — para que el mapa de la
 * ciudad sea COMPARTIDO entre todos los personajes: lo que un personaje
 * construye lo ven los demás.
 *
 * El servicio cubre tres responsabilidades:
 *  a) catálogo de construibles (`BUILDABLES`)
 *  b) persistencia global de lo ya colocado
 *  c) bridge Angular↔Phaser para el modo colocación (`placementMode$`)
 */

/** Definición de un item construible. */
export interface BuildableDef {
  type: string;       // id único, p.ej. 'town_chest'
  name: string;       // clave i18n para el panel
  spriteKey: string;  // textura Phaser ya cargada (p.ej. 'chests')
  frame: number;      // frame dentro del spritesheet
  frameSize: number;  // lado en px de un frame (32 para 'chests'); define el footprint
  scale: number;      // escala del sprite en el mundo
  tilesW: number;     // footprint en tiles (ancho)
  tilesH: number;     // footprint en tiles (alto)
  unique: boolean;    // true → solo uno por tipo (desaparece del menú al construir)
  /** true → al colocarlo se comporta como cofre de ciudad (abre el almacén compartido). */
  isTownChest?: boolean;
}

export const BUILDABLES: BuildableDef[] = [
  {
    type: 'town_chest',
    name: 'BUILD.TOWN_CHEST',
    spriteKey: 'chests',
    frame: 0,
    frameSize: 32,
    scale: 4,
    tilesW: 3,
    tilesH: 3,
    unique: true,
    isTownChest: true,
  },
];

/** Una construcción ya colocada en el mapa de la ciudad. */
export interface PlacedBuilding {
  type: string;
  tileX: number;
  tileY: number;
}

const STORAGE_KEY = 'city_buildings';

@Injectable({ providedIn: 'root' })
export class CityBuildService {

  readonly buildables = BUILDABLES;

  /** Def en colocación (ghost activo en Phaser) o null. */
  readonly placementMode$ = new BehaviorSubject<BuildableDef | null>(null);
  /** Emite cuando Phaser confirma una colocación (para refrescar el menú). */
  readonly placed$ = new Subject<PlacedBuilding>();
  /** Emite al borrar todas las construcciones (Phaser quita sprites y colisión). */
  readonly cleared$ = new Subject<void>();

  private storage = inject(StorageService);
  private cache: PlacedBuilding[] | null = null;

  /** Carga (y cachea) la lista de construcciones compartida. */
  async load(): Promise<PlacedBuilding[]> {
    if (!this.cache) {
      const saved: PlacedBuilding[] | null = await this.storage.get(STORAGE_KEY);
      this.cache = Array.isArray(saved) ? saved : [];
    }
    return this.cache.map(b => ({ ...b }));
  }

  /** Persiste una nueva construcción y notifica a Angular. */
  async add(b: PlacedBuilding): Promise<void> {
    if (!this.cache) await this.load();
    this.cache!.push({ ...b });
    await this.storage.set(STORAGE_KEY, this.cache);
    this.placed$.next(b);
  }

  /** ¿Ya hay una construcción de este tipo? (para ocultar uniques del menú). */
  isBuilt(type: string): boolean {
    return !!this.cache?.some(b => b.type === type);
  }

  /** Borra TODAS las construcciones (storage compartido) y notifica a la escena. */
  async clear(): Promise<void> {
    this.cache = [];
    await this.storage.remove(STORAGE_KEY);
    this.cancelPlacement();
    this.cleared$.next();
  }

  def(type: string): BuildableDef | undefined {
    return BUILDABLES.find(d => d.type === type);
  }

  startPlacement(def: BuildableDef): void {
    this.placementMode$.next(def);
  }

  cancelPlacement(): void {
    if (this.placementMode$.value) this.placementMode$.next(null);
  }
}
