import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Subject, interval } from 'rxjs';
import { StorageService } from './storage.service';
import { InventoryItem } from './inventory.service';
import { ITEM_CATALOG, LootEntry } from '../physics/griddrops';

/**
 * Fundición (estación de oficio `forge`/`smelter`). Tiene tres rejillas:
 *  - materiales (entrada): items a fundir (los que tengan receta en FORGE_RECIPES).
 *  - combustible: cualquier item arde y aporta segundos de quemado (FUEL_SECONDS).
 *  - salida: items producidos; se arrastran de vuelta al inventario.
 * Un único trabajo en curso (`producing$`) avanza mientras haya combustible
 * quemándose y un material con receta; al completarse consume 1 material, gasta
 * combustible y deja 1 unidad del producto en la salida.
 *
 * Persistencia local (StorageService). El progreso se recupera al cargar (catch-up
 * por el tiempo transcurrido), así que la fundición trabaja también estando cerrada.
 */

export type ForgeGrid = 'mat' | 'fuel' | 'out';

/** EJEMPLO de recetas (input → output). Amplía/define las reales aquí. */
export const FORGE_RECIPES: Record<string, { output: string; seconds: number }> = {
  'Madera': { output: 'Carbón', seconds: 5 },   // fundir madera → carbón (ejemplo)
};

/** Segundos de quemado por unidad de combustible (cualquier otro item: DEFAULT). */
const FUEL_SECONDS: Record<string, number> = {
  'Carbón': 20,
  'Madera': 8,
};
const DEFAULT_FUEL_SECONDS = 5;

export const FORGE_SLOTS = 8;
const STORAGE_KEY = 'forge_state';
const MAX_CATCHUP_S = 8 * 3600;   // tope de avance offline al cargar (8 h)

interface Job { srcName: string; outName: string; neededS: number; elapsedS: number; }

@Injectable({ providedIn: 'root' })
export class ForgeService {

  readonly mat:  (InventoryItem | null)[] = Array(FORGE_SLOTS).fill(null);
  readonly fuel: (InventoryItem | null)[] = Array(FORGE_SLOTS).fill(null);
  readonly out:  (InventoryItem | null)[] = Array(FORGE_SLOTS).fill(null);

  /** Trabajo en curso para el cuadro de producción (null = nada). */
  readonly producing$ = new BehaviorSubject<{ item: InventoryItem; progress: number } | null>(null);
  /** Emite tras cada cambio (drop, tick) para refrescar la UI si hace falta. */
  readonly changes$ = new Subject<void>();

  /** IDs CDK de todas las celdas (para `cdkDropListConnectedTo` del inventario). */
  readonly cellIds: string[] = (['mat', 'fuel', 'out'] as ForgeGrid[])
    .flatMap(g => Array.from({ length: FORGE_SLOTS }, (_, i) => `forge-${g}-${i}`));

  private storage = inject(StorageService);
  private zone = inject(NgZone);

  private job: Job | null = null;
  private burnRemaining = 0;   // segundos de quemado que quedan del combustible actual
  private loaded = false;
  private sincePersist = 0;    // segundos desde el último guardado (throttle del tick)

  constructor() {
    this.load();
    // Tick 1 Hz fuera de la zona para no forzar CD global cada segundo; solo
    // re-entramos a la zona cuando hay un cambio real que mostrar.
    this.zone.runOutsideAngular(() => {
      interval(1000).subscribe(() => this.tick(1));
    });
  }

  private grid(g: ForgeGrid): (InventoryItem | null)[] {
    return g === 'mat' ? this.mat : g === 'fuel' ? this.fuel : this.out;
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  /** Coloca `item` en la celda (g,index). Apila si es el mismo item apilable;
   *  rechaza si está ocupada por otro. Devuelve true si lo aceptó. */
  place(g: ForgeGrid, index: number, item: InventoryItem): boolean {
    const cells = this.grid(g);
    const target = cells[index];
    if (target?.mergeable && item.mergeable && target.name === item.name) {
      target.sum = (target.sum ?? 1) + (item.sum ?? 1);
    } else if (target !== null) {
      return false;   // celda ocupada por otro item
    } else {
      cells[index] = item;
    }
    this.afterChange();
    return true;
  }

  /** Movimiento interno entre celdas de la fundición (swap o apilado). */
  moveInternal(from: { g: ForgeGrid; index: number }, to: { g: ForgeGrid; index: number }): void {
    if (from.g === to.g && from.index === to.index) return;
    const src = this.grid(from.g), dst = this.grid(to.g);
    const item = src[from.index];
    if (!item) return;
    const target = dst[to.index];
    if (target?.mergeable && item.mergeable && target.name === item.name) {
      target.sum = (target.sum ?? 1) + (item.sum ?? 1);
      src[from.index] = null;
    } else {
      dst[to.index] = item;
      src[from.index] = target;   // swap (target puede ser null)
    }
    this.afterChange();
  }

  /** Vacía una celda (el inventario se llevó el item). */
  removeCell(g: ForgeGrid, index: number): void {
    this.grid(g)[index] = null;
    this.afterChange();
  }

  // ── Motor de fundición ─────────────────────────────────────────────────────

  private tick(dt: number): void {
    if (!this.loaded) return;
    const before = this.job;
    const advanced = this.step(dt);
    if (!advanced && this.job === before) return;   // nada que hacer (forja en reposo)
    this.zone.run(() => { this.emitProducing(); this.changes$.next(); });
    // Persistir al cambiar de trabajo (arranque/fin) o cada 5 s de avance: el progreso
    // a mitad se recupera igual por el catch-up (lastTick + elapsedS), no hace falta
    // escribir en disco cada segundo.
    this.sincePersist += dt;
    if (this.job !== before || this.sincePersist >= 5) { this.persist(); this.sincePersist = 0; }
  }

  /** Avanza la simulación `dt` segundos. Devuelve true si hubo progreso. */
  private step(dt: number): boolean {
    let work = dt, progressed = false;
    let guard = 0;
    while (work > 1e-6 && guard++ < 10000) {
      if (!this.job && !this.startJob()) break;          // sin trabajo posible
      const j = this.job!;
      if (this.burnRemaining <= 1e-6 && !this.consumeFuel()) break;   // sin combustible → parar
      const slice = Math.min(work, this.burnRemaining, j.neededS - j.elapsedS);
      j.elapsedS += slice;
      this.burnRemaining -= slice;
      work -= slice;
      progressed = true;
      if (j.elapsedS >= j.neededS - 1e-6) {
        if (!this.completeJob()) break;   // sin sitio en salida → se queda lleno, parar
      }
    }
    return progressed;
  }

  /** Busca el primer material con receta y hueco de salida → arranca trabajo. */
  private startJob(): boolean {
    for (const cell of this.mat) {
      const recipe = cell && FORGE_RECIPES[cell.name];
      if (recipe && this.outputHasSpace(recipe.output)) {
        this.job = { srcName: cell!.name, outName: recipe.output, neededS: recipe.seconds, elapsedS: 0 };
        return true;
      }
    }
    return false;
  }

  /** Completa el trabajo: -1 material, +1 producto. Devuelve false si no cabe. */
  private completeJob(): boolean {
    const j = this.job!;
    if (!this.outputHasSpace(j.outName)) { j.elapsedS = j.neededS; return false; }
    if (!this.consumeOne(this.mat, j.srcName)) { this.job = null; return true; }   // material retirado
    this.addOutput(j.outName);
    this.job = null;
    return true;
  }

  /** Quema una unidad de combustible → suma sus segundos. false si no hay. */
  private consumeFuel(): boolean {
    for (let i = 0; i < this.fuel.length; i++) {
      const it = this.fuel[i];
      if (!it) continue;
      this.burnRemaining += FUEL_SECONDS[it.name] ?? DEFAULT_FUEL_SECONDS;
      this.decOne(this.fuel, i);
      return true;
    }
    return false;
  }

  private outputHasSpace(name: string): boolean {
    return this.out.some(c => c === null || (c.mergeable && c.name === name));
  }

  private addOutput(name: string): void {
    const existing = this.out.find(c => c?.mergeable && c.name === name);
    if (existing) { existing.sum = (existing.sum ?? 1) + 1; return; }
    const idx = this.out.findIndex(c => c === null);
    if (idx !== -1) this.out[idx] = this.itemFromCatalog(name);
  }

  /** Resta 1 unidad del primer item llamado `name` en `cells`. false si no hay. */
  private consumeOne(cells: (InventoryItem | null)[], name: string): boolean {
    const i = cells.findIndex(c => c?.name === name);
    if (i === -1) return false;
    this.decOne(cells, i);
    return true;
  }

  /** Resta 1 a la pila de la celda i (la vacía si llega a 0 o no es apilable). */
  private decOne(cells: (InventoryItem | null)[], i: number): void {
    const it = cells[i];
    if (!it) return;
    if (it.mergeable && (it.sum ?? 1) > 1) it.sum = (it.sum ?? 1) - 1;
    else cells[i] = null;
  }

  private emitProducing(): void {
    if (!this.job) { this.producing$.next(null); return; }
    this.producing$.next({
      item: this.itemFromCatalog(this.job.outName),
      progress: Math.max(0, Math.min(1, this.job.elapsedS / this.job.neededS)),
    });
  }

  private afterChange(): void {
    // Si retiraron el material que se estaba fundiendo, cancela el trabajo.
    if (this.job && !this.mat.some(c => c?.name === this.job!.srcName)) this.job = null;
    // Un drop puede haber dado material: arranca el trabajo ya (sin gastar combustible
    // todavía; eso lo hace el primer tick) para que el cuadro de producción lo muestre.
    if (!this.job) this.startJob();
    this.emitProducing();
    this.changes$.next();
    this.persist();
  }

  // ── Persistencia ───────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    if (this.loaded) return;
    const saved = (await this.storage.get(STORAGE_KEY)) as ForgeSnapshot | null;
    if (saved) {
      this.restoreGrid(this.mat,  saved.mat);
      this.restoreGrid(this.fuel, saved.fuel);
      this.restoreGrid(this.out,  saved.out);
      this.job = saved.job ?? null;
      this.burnRemaining = saved.burnRemaining ?? 0;
      const elapsed = saved.lastTick ? Math.min(MAX_CATCHUP_S, (Date.now() - saved.lastTick) / 1000) : 0;
      if (elapsed > 0) this.step(elapsed);   // avance offline
    }
    this.loaded = true;
    this.emitProducing();
    this.changes$.next();
  }

  private restoreGrid(target: (InventoryItem | null)[], src?: (InventoryItem | null)[]): void {
    if (!src) return;
    for (let i = 0; i < FORGE_SLOTS; i++) target[i] = src[i] ?? null;
  }

  private persist(): void {
    const snap: ForgeSnapshot = {
      mat: this.mat, fuel: this.fuel, out: this.out,
      job: this.job, burnRemaining: this.burnRemaining, lastTick: Date.now(),
    };
    this.storage.set(STORAGE_KEY, snap);
  }

  /** Construye un InventoryItem nuevo a partir del catálogo (por nombre). */
  private itemFromCatalog(name: string): InventoryItem {
    const e = ITEM_CATALOG.find(x => x.name === name);
    if (!e) return { id: `forge-${Date.now()}`, name, mergeable: true, sum: 1 };
    return this.toInventoryItem(e);
  }

  private toInventoryItem(e: LootEntry): InventoryItem {
    return {
      id: `forge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: e.name,
      category: e.category,
      icon: e.icon,
      iconSheet: e.iconSheet,
      iconFrame: e.iconFrame,
      iconFrameSize: e.iconFrameSize,
      iconFrameCols: e.iconFrameCols,
      iconContentSize: e.iconContentSize,
      mergeable: e.mergeable,
      sum: e.mergeable ? 1 : undefined,
      order: e.order,
      description: e.description,
      stats: e.stats,
    };
  }
}

interface ForgeSnapshot {
  mat:  (InventoryItem | null)[];
  fuel: (InventoryItem | null)[];
  out:  (InventoryItem | null)[];
  job: Job | null;
  burnRemaining: number;
  lastTick: number;
}
