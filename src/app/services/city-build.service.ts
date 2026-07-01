import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { StorageService } from './storage.service';
import { TownChestService } from './town-chest.service';

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
  /** true → al pulsar el edificio en el mapa abre su ventana (openWindow$). */
  opensWindow?: boolean;
  /** true → pinta una elipse de sombra bajo el sprite en el mapa. */
  shadow?: boolean;
  /** Animación a reproducir en bucle (ghost + sprite colocado). Sus frames son
   *  [frame, frame+1, frame+2]. La crea/registra `gamescene` en `create()`. */
  animKey?: string;

  // ── Estado "encendido" (fragua/fundición): la animación de fuego se muestra solo
  //    mientras su menú está abierto. En reposo se ve `spriteKey` (…_off). ──
  /** Clave del anim de fuego (lo crea gamescene desde litTexture+litFrames). */
  litAnimKey?: string;
  /** Textura sobre la que viven los frames del anim de fuego. */
  litTexture?: string;
  /** Índices de frame (en litTexture) del anim de fuego. */
  litFrames?: number[];
  /** FPS del anim de fuego (default 6). */
  litFrameRate?: number;

  // ── Render del preview en el panel (DOM). Por defecto: hoja 'chests'
  //    (assets/sprites/resources/<spriteKey>.png, 10 cols, 32×32, ×2). ──
  /** URL del PNG para el preview (si la hoja no está en resources/). */
  previewUrl?: string;
  /** Recorte explícito (px) del frame dentro de la hoja `previewUrl`. */
  previewSrc?: { x: number; y: number; w: number; h: number };
  /** Tamaño total (px) de la hoja `previewUrl` (para el background-size). */
  previewSheet?: { w: number; h: number };
  /** Escala del recorte en el preview. Default 2 (hoja chests). */
  previewScale?: number;
}

/** Hoja stations.png: 6 columnas (64px) × 5 filas de ALTO IRREGULAR. La fila de
 *  fraguas (0) es más alta y se solapa con la fila 1, así que no se puede partir
 *  con una altura uniforme: estos son los topes reales de cada fila (+ el final). */
export const STATION_SHEET = { url: 'assets/sprites/stations/stations.png', w: 384, h: 352 };
const STATION_ROW_TOP = [0, 92, 161, 226, 291, 352];

/** Rect (px) del frame `index` (0..29) en stations.png. Cada estación ocupa 3
 *  columnas consecutivas (su animación): base = fila·6 + lado·3. */
export function stationFrameRect(index: number): { x: number; y: number; w: number; h: number } {
  const col = index % 6, row = Math.floor(index / 6);
  return { x: col * 64, y: STATION_ROW_TOP[row], w: 64, h: STATION_ROW_TOP[row + 1] - STATION_ROW_TOP[row] };
}

function station(type: string, name: string, row: number, side: 0 | 1, scale = 2): BuildableDef {
  const frame = row * 6 + side * 3;
  const rect = stationFrameRect(frame);
  return {
    type, name,
    spriteKey: 'stations', frame,
    frameSize: 64, scale,
    tilesW: 3, tilesH: 3,
    unique: false,
    animKey: `station_${type}`,
    previewUrl: STATION_SHEET.url,
    previewSrc: rect,
    previewSheet: { w: STATION_SHEET.w, h: STATION_SHEET.h },
    // Normaliza la altura en la ficha a ~58px (la fila irregular se ve pareja).
    previewScale: +(58 / rect.h).toFixed(3),
  };
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
    unique: false,   // varios cofres, cada uno con su almacén independiente
    isTownChest: true,
  },
  {
    type: 'shop',
    name: 'BUILD.SHOP',
    spriteKey: 'chests',
    frame: 2,            // cofre 2 (placeholder; se cambiará a futuro)
    frameSize: 32,
    scale: 4,
    tilesW: 3,
    tilesH: 3,
    unique: true,
    opensWindow: true,
  },

  // ── Estaciones de oficio (decorativas + animadas) ──
  // Horno detallado (128×208). En reposo apagado (furnace_central_off); al abrir su
  // ventana (menú de la forja) se enciende el fuego (litAnimKey 'furnace_central').
  // Para usar el otro horno: cambia spriteKey a 'furnace_lvl1_off' (y carga su hoja).
  {
    type: 'forge', name: 'BUILD.FORGE',
    spriteKey: 'furnace_central_off', frame: 0,
    frameSize: 128, scale: 0.8,
    tilesW: 3, tilesH: 3, unique: false,
    opensWindow: true,
    litAnimKey: 'furnace_central', litTexture: 'furnace_central',
    litFrames: [0,1,2,3,4,5,6,7,8,9,10,11], litFrameRate: 10,
    previewUrl: 'assets/sprites/stations/furnace_central_off.png',
    previewSrc: { x: 0, y: 0, w: 128, h: 224 },
    previewSheet: { w: 128, h: 224 },
    previewScale: +(58 / 224).toFixed(3),
  },
  // Fundición: usa su textura apagada propia (smelter_off, fuego retirado) y sin
  // animKey, así que no parpadea fuego. Se pulsa para abrir su menú (opensWindow).
  {
    ...station('smelter', 'BUILD.SMELTER', 0, 1),
    spriteKey: 'smelter_off', frame: 0, animKey: undefined,
    scale: 1.5,   // 1/4 más pequeño que la escala base (2) al pintarlo en el mapa
    shadow: true,
    opensWindow: true,
    litAnimKey: 'smelter_lit', litTexture: 'stations', litFrames: [3,4,5], litFrameRate: 4,
    previewUrl: 'assets/sprites/stations/smelter_off.png',
    previewSrc: { x: 0, y: 0, w: 64, h: 92 },
    previewSheet: { w: 64, h: 92 },
    previewScale: +(58 / 92).toFixed(3),
  },
  station('alchemy_table',    'BUILD.ALCHEMY_TABLE',    1, 0),
  station('alembic',          'BUILD.ALEMBIC',          1, 1),
  station('workbench',        'BUILD.WORKBENCH',        2, 0),
  station('loom',             'BUILD.LOOM',             2, 1),
  station('enchanting_table', 'BUILD.ENCHANTING_TABLE', 3, 0),
  station('drying_rack',      'BUILD.DRYING_RACK',      3, 1),
  station('butcher_table',    'BUILD.BUTCHER_TABLE',    4, 0),
];

/** Una construcción ya colocada en el mapa de la ciudad. */
export interface PlacedBuilding {
  type: string;
  tileX: number;
  tileY: number;
  /** ID estable propio de esta construcción. Identifica su almacén (p.ej. el
   *  cofre de ciudad) para que el contenido le siga aunque se mueva de sitio. */
  id?: string;
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
  /** true tras pulsar "Mover edificio": la escena espera a que pinches un edificio. */
  readonly moveMode$ = new BehaviorSubject<boolean>(false);
  /** true tras pulsar "Borrar edificio": la escena espera a que pinches un edificio. */
  readonly deleteMode$ = new BehaviorSubject<boolean>(false);
  /** Edificio pendiente de confirmación de borrado (alimenta el modal). */
  readonly pendingDelete$ = new BehaviorSubject<PlacedBuilding | null>(null);
  /** Emite el edificio borrado (la escena quita su sprite y colisión). */
  readonly removed$ = new Subject<PlacedBuilding>();
  /** Emite el `type` de un edificio pulsado en el mapa para abrir su ventana. */
  readonly openWindow$ = new Subject<string>();
  /** true mientras una ventana de edificio (p.ej. la tienda) está abierta. */
  readonly windowOpen$ = new BehaviorSubject<boolean>(false);
  /** La escena pide cerrar la ventana abierta (el jugador se alejó del edificio). */
  readonly closeWindow$ = new Subject<void>();

  private storage = inject(StorageService);
  private townChest = inject(TownChestService);
  private cache: PlacedBuilding[] | null = null;

  /** ID estable único para una construcción. */
  private generateBuildingId(): string {
    return `bld-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /** Carga (y cachea) la lista de construcciones compartida. */
  async load(): Promise<PlacedBuilding[]> {
    if (!this.cache) {
      const saved: PlacedBuilding[] | null = await this.storage.get(STORAGE_KEY);
      this.cache = Array.isArray(saved) ? saved : [];
      // Backfill de IDs para construcciones guardadas antes de tener ID propio.
      let changed = false;
      for (const b of this.cache) {
        if (!b.id) { b.id = this.generateBuildingId(); changed = true; }
      }
      if (changed) await this.storage.set(STORAGE_KEY, this.cache);
    }
    return this.cache.map(b => ({ ...b }));
  }

  /** Persiste una nueva construcción y notifica a Angular. Asigna un ID estable
   *  de forma SÍNCRONA sobre `b` (antes del primer await) para que quien llama
   *  pueda usar `b.id` justo después sin esperar la promesa. */
  async add(b: PlacedBuilding): Promise<void> {
    if (!b.id) b.id = this.generateBuildingId();
    if (!this.cache) await this.load();
    this.cache!.push({ ...b });
    await this.storage.set(STORAGE_KEY, this.cache);
    this.placed$.next(b);
  }

  /** ¿Ya hay una construcción de este tipo? (para ocultar uniques del menú). */
  isBuilt(type: string): boolean {
    return !!this.cache?.some(b => b.type === type);
  }

  /** ¿Hay alguna construcción colocada? (para habilitar "Mover edificio"). */
  hasBuildings(): boolean {
    return !!this.cache?.length;
  }

  /** Reubica una construcción ya colocada (mismo tipo, de su tile a otro). */
  async move(from: PlacedBuilding, to: { tileX: number; tileY: number }): Promise<void> {
    if (!this.cache) await this.load();
    const idx = this.cache!.findIndex(
      b => b.type === from.type && b.tileX === from.tileX && b.tileY === from.tileY,
    );
    if (idx !== -1) this.cache![idx] = { ...this.cache![idx], tileX: to.tileX, tileY: to.tileY };
    else this.cache!.push({ type: from.type, tileX: to.tileX, tileY: to.tileY });
    await this.storage.set(STORAGE_KEY, this.cache);
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

  /** La escena pide abrir la ventana de un edificio pulsado en el mapa. */
  requestOpenWindow(type: string): void {
    this.openWindow$.next(type);
  }

  /** La escena pide cerrar la ventana abierta (jugador fuera de rango). */
  requestCloseWindow(): void {
    if (this.windowOpen$.value) this.closeWindow$.next();
  }

  startMoveMode(): void {
    this.moveMode$.next(true);
  }

  cancelMoveMode(): void {
    if (this.moveMode$.value) this.moveMode$.next(false);
  }

  startDeleteMode(): void {
    this.deleteMode$.next(true);
  }

  cancelDeleteMode(): void {
    if (this.deleteMode$.value) this.deleteMode$.next(false);
  }

  /** La escena pide confirmar el borrado de un edificio (abre el modal). */
  requestDelete(b: PlacedBuilding): void {
    this.pendingDelete$.next(b);
  }

  cancelDelete(): void {
    this.pendingDelete$.next(null);
  }

  /** Borra definitivamente el edificio pendiente: storage + interior (cofre) +
   *  notifica a la escena para quitar el sprite. */
  async confirmDelete(): Promise<void> {
    const b = this.pendingDelete$.value;
    if (!b) return;
    if (!this.cache) await this.load();
    const idx = this.cache!.findIndex(
      x => x.type === b.type && x.tileX === b.tileX && x.tileY === b.tileY,
    );
    if (idx !== -1) this.cache!.splice(idx, 1);
    await this.storage.set(STORAGE_KEY, this.cache);

    // Vaciar el interior si el edificio almacena items (su propio cofre por ID)
    const def = this.def(b.type);
    if (def?.isTownChest && b.id) await this.townChest.clear(b.id);

    this.pendingDelete$.next(null);
    this.removed$.next(b);
  }
}
