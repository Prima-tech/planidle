import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Subject, interval } from 'rxjs';
import { StorageService } from './storage.service';
import { InventoryItem } from './inventory.service';
import { ITEM_CATALOG, LootEntry } from '../physics/griddrops';

/**
 * Forja (estación de oficio `forge`/`smelter`). Tres celdas:
 *  - material (entrada): el mineral a fundir. La barra a producir se DEDUCE de él.
 *  - combustible: cualquier item sirve de combustible (se gasta 1 por barra).
 *  - salida: barras producidas; se arrastran de vuelta al inventario.
 *
 * No se elige la receta: la barra resultante depende del mineral puesto (cada
 * mineral mapea a una barra en FORGE_BARS). Si hay mineral válido + combustible +
 * sitio en la salida, `ready$` es true (play activable). Con la forja en marcha
 * (`running$`), la barra de carga se rellena en SECONDS_PER_BAR; al completarse
 * gasta 1 mineral + 1 combustible y deja 1 barra en la salida. Mientras queden
 * materiales, encadena más barras. Sin combustible o sin mineral, no produce.
 *
 * Persistencia local (StorageService). El progreso se recupera al cargar
 * (catch-up por el tiempo transcurrido), así que la forja trabaja también cerrada.
 */

export type ForgeGrid = 'mat' | 'fuel' | 'out';

/** Barra de metal. El icono es un recorte de Icons.png (caja {x,y,w,h}).
 *  `mineral` = item que necesita para fundirse (lo que decide qué barra sale). */
export interface ForgeBar { tier: number; name: string; mineral: string; box: { x: number; y: number; w: number; h: number }; }

/** Barras de metal por tier (icono = recorte de Icons.png, mismo que el panel Mining). */
export const FORGE_BARS: ForgeBar[] = [
  { tier: 1,  name: 'Barra de Cobre',  mineral: 'Mineral de Cobre',  box: { x: 112, y: 64,  w: 32, h: 32 } }, // icono del antiguo tier 3
  { tier: 2,  name: 'Barra de Bronce', mineral: 'Mineral de Bronce', box: { x: 112, y: 0,   w: 32, h: 32 } },
  { tier: 3,  name: 'Barra de Hierro', mineral: 'Mineral de Hierro', box: { x: 112, y: 32,  w: 32, h: 32 } }, // icono del antiguo tier 1
  { tier: 4,  name: 'Barra Tier 4',  mineral: 'Mineral Tier 4',  box: { x: 112, y: 160, w: 32, h: 32 } },
  { tier: 5,  name: 'Barra Tier 5',  mineral: 'Mineral Tier 5',  box: { x: 112, y: 128, w: 32, h: 32 } },
  { tier: 6,  name: 'Barra Tier 6',  mineral: 'Mineral Tier 6',  box: { x: 112, y: 224, w: 32, h: 32 } },
  { tier: 7,  name: 'Barra Tier 7',  mineral: 'Mineral Tier 7',  box: { x: 112, y: 192, w: 32, h: 32 } },
  { tier: 8,  name: 'Barra Tier 8',  mineral: 'Mineral Tier 8',  box: { x: 112, y: 96,  w: 32, h: 32 } },
  { tier: 9,  name: 'Barra Tier 9',  mineral: 'Mineral Tier 9',  box: { x: 112, y: 256, w: 32, h: 32 } },
  { tier: 10, name: 'Barra Tier 10', mineral: 'Mineral Tier 10', box: { x: 112, y: 288, w: 32, h: 32 } },
];

/** Segundos para producir una barra. */
const SECONDS_PER_BAR = 5;

/** Combustible admitido: de momento solo madera (cualquier tier: 'Madera', 'Madera Tier 2'…). */
function isFuelItem(item: InventoryItem | null): boolean {
  return !!item && item.name.startsWith('Madera');
}

export const FORGE_SLOTS = 8;
const STORAGE_KEY = 'forge_state';
const MAX_CATCHUP_S = 8 * 3600;   // tope de avance offline al cargar (8 h)

interface Job { elapsedS: number; barTier: number; }

@Injectable({ providedIn: 'root' })
export class ForgeService {

  readonly mat:  (InventoryItem | null)[] = Array(FORGE_SLOTS).fill(null);
  readonly fuel: (InventoryItem | null)[] = Array(FORGE_SLOTS).fill(null);
  readonly out:  (InventoryItem | null)[] = Array(FORGE_SLOTS).fill(null);

  /** Barra que se producirá según el mineral puesto (auto). null = sin mineral válido. */
  readonly currentBar$ = new BehaviorSubject<ForgeBar | null>(null);
  /** true cuando hay mineral válido + combustible + sitio en salida → play activable. */
  readonly ready$ = new BehaviorSubject<boolean>(false);

  /** true = forja en marcha (play); false = parada (stop). */
  readonly running$ = new BehaviorSubject<boolean>(false);
  /** Progreso del ciclo actual (0..1) para la barra de carga. */
  readonly progress$ = new BehaviorSubject<number>(0);
  /** Segundos que faltan para terminar la barra actual (cuenta atrás 5→0). */
  readonly remaining$ = new BehaviorSubject<number>(SECONDS_PER_BAR);
  /** Item que se está produciendo ahora (la barra deducida) o null. */
  readonly producing$ = new BehaviorSubject<{ item: InventoryItem; progress: number } | null>(null);
  /** Emite tras cada cambio (drop, tick) para refrescar la UI si hace falta. */
  readonly changes$ = new Subject<void>();
  /** Petición de retirar un item de una celda hacia el inventario (doble clic).
   *  Lo escucha el inventario, que decide si hay sitio. */
  readonly withdraw$ = new Subject<{ grid: ForgeGrid; index: number; item: InventoryItem }>();

  /** true mientras el panel de la forja está abierto (lo marca ForgeComponent). */
  private _open = false;
  get isOpen(): boolean { return this._open; }
  setOpen(v: boolean): void { this._open = v; }

  /** IDs CDK de todas las celdas (para `cdkDropListConnectedTo` del inventario). */
  readonly cellIds: string[] = (['mat', 'fuel', 'out'] as ForgeGrid[])
    .flatMap(g => Array.from({ length: FORGE_SLOTS }, (_, i) => `forge-${g}-${i}`));

  private storage = inject(StorageService);
  private zone = inject(NgZone);

  private job: Job | null = null;
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

  // ── Barra deducida del mineral ───────────────────────────────────────────────

  /** Primera barra cuyo mineral esté en la celda de material (null si ninguno). */
  private currentBar(): ForgeBar | null {
    for (const bar of FORGE_BARS) {
      if (this.hasItem(this.mat, bar.mineral)) return bar;
    }
    return null;
  }

  private barByTier(tier: number): ForgeBar | null {
    return FORGE_BARS.find(b => b.tier === tier) ?? null;
  }

  // ── Play / Stop ─────────────────────────────────────────────────────────────

  /** Botón único: en marcha → pausa; parada → play. */
  toggle(): void {
    if (this.running$.value) this.pause();
    else this.play();
  }

  /** Arranca/reanuda la producción. Si hay un ciclo pausado a medias, sigue desde ahí. */
  play(): void {
    if (!this.canProduce()) return;
    this.running$.next(true);
    if (!this.job) this.job = { elapsedS: 0, barTier: this.currentBar()!.tier };
    this.emitState();
    this.changes$.next();
    this.persist();
  }

  /** Pausa: detiene el avance pero CONSERVA el progreso del ciclo en curso. */
  pause(): void {
    this.running$.next(false);
    this.emitState();
    this.changes$.next();
    this.persist();
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  /** Coloca `item` en la celda (g,index). Apila si es el mismo item apilable;
   *  rechaza si está ocupada por otro. Devuelve true si lo aceptó. */
  place(g: ForgeGrid, index: number, item: InventoryItem): boolean {
    if (g === 'out') return false;                          // la salida es SOLO salida: no se mete nada
    if (g === 'fuel' && !isFuelItem(item)) return false;    // la celda de combustible solo acepta madera
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

  /** Movimiento interno entre celdas de la forja (swap o apilado). */
  moveInternal(from: { g: ForgeGrid; index: number }, to: { g: ForgeGrid; index: number }): void {
    if (from.g === to.g && from.index === to.index) return;
    if (to.g === 'out') return;   // la salida es SOLO salida: no se mete nada
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

  // ── Transferencia rápida (doble clic) ───────────────────────────────────────

  /** Mete un item del inventario en su celda automática: madera → combustible,
   *  mineral de una barra → material. Devuelve true si lo aceptó (lo movió). */
  quickAdd(item: InventoryItem): boolean {
    if (isFuelItem(item)) return this.place('fuel', 0, item);
    if (FORGE_BARS.some(b => b.mineral === item.name)) return this.place('mat', 0, item);
    return false;   // no es combustible ni mineral de ninguna barra → no es de la forja
  }

  /** Pide retirar la celda (g,index) al inventario; este decide si hay sitio. */
  requestWithdraw(g: ForgeGrid, index: number): void {
    const item = this.grid(g)[index];
    if (item) this.withdraw$.next({ grid: g, index, item });
  }

  // ── Motor de producción ─────────────────────────────────────────────────────

  private tick(dt: number): void {
    if (!this.running$.value) return;       // parada: no avanza
    const beforeJob = this.job;
    const advanced = this.step(dt);
    if (!advanced && this.job === beforeJob) return;   // nada que hacer (sin materiales)
    this.zone.run(() => { this.emitState(); this.changes$.next(); });
    // Persistir cada 5 s de avance: el progreso a mitad se recupera por el catch-up.
    this.sincePersist += dt;
    if (this.job === null || this.sincePersist >= 5) { this.persist(); this.sincePersist = 0; }
  }

  /** Avanza la simulación `dt` segundos. Devuelve true si hubo progreso. */
  private step(dt: number): boolean {
    if (!this.running$.value) return false;
    let work = dt, progressed = false, guard = 0;
    while (work > 1e-6 && guard++ < 10000) {
      if (!this.job) {
        const bar = this.currentBar();
        if (!bar || !this.hasAnyFuel() || !this.outputHasSpace(bar.name)) break;
        this.job = { elapsedS: 0, barTier: bar.tier };
      }
      const slice = Math.min(work, SECONDS_PER_BAR - this.job.elapsedS);
      this.job.elapsedS += slice;
      work -= slice;
      progressed = true;
      if (this.job.elapsedS >= SECONDS_PER_BAR - 1e-6) {
        if (!this.completeBar()) { this.job = null; break; }   // sin materiales/sitio → parar
        this.job = null;
      }
    }
    return progressed;
  }

  /** ¿Se puede producir ahora? Mineral válido + combustible + hueco en la salida. */
  private canProduce(): boolean {
    const bar = this.currentBar();
    return !!bar && this.hasAnyFuel() && this.outputHasSpace(bar.name);
  }

  /** Completa la barra del ciclo: -1 mineral, -1 combustible, +1 barra. false si no se puede. */
  private completeBar(): boolean {
    const bar = this.barByTier(this.job!.barTier);
    if (!bar) return false;
    if (!this.hasItem(this.mat, bar.mineral) || !this.hasAnyFuel() || !this.outputHasSpace(bar.name)) return false;
    this.consumeOne(this.mat, bar.mineral);
    this.consumeAnyFuel();
    this.addOutput(bar.name);
    return true;
  }

  private hasItem(cells: (InventoryItem | null)[], name: string): boolean {
    return cells.some(c => c?.name === name);
  }

  private hasAnyFuel(): boolean {
    return this.fuel.some(c => isFuelItem(c));
  }

  /** Gasta 1 unidad del primer combustible (madera) disponible. */
  private consumeAnyFuel(): void {
    const i = this.fuel.findIndex(c => isFuelItem(c));
    if (i !== -1) this.decOne(this.fuel, i);
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

  /** Refresca currentBar$, ready$, producing$ y progress$ a partir del estado interno. */
  private emitState(): void {
    const bar = this.job ? this.barByTier(this.job.barTier) : this.currentBar();
    const progress = this.job ? Math.max(0, Math.min(1, this.job.elapsedS / SECONDS_PER_BAR)) : 0;
    const remaining = this.job ? Math.max(0, Math.ceil(SECONDS_PER_BAR - this.job.elapsedS)) : SECONDS_PER_BAR;
    this.currentBar$.next(bar);
    this.ready$.next(this.canProduce());
    this.progress$.next(progress);
    this.remaining$.next(remaining);
    this.producing$.next(this.job && bar ? { item: this.itemFromCatalog(bar.name), progress } : null);
  }

  private afterChange(): void {
    // Si quitaron el mineral en curso y ya no hay, cancela el ciclo.
    if (this.job) {
      const bar = this.barByTier(this.job.barTier);
      if (!bar || !this.hasItem(this.mat, bar.mineral)) this.job = null;
    }
    // Si está en marcha y ahora hay materiales, arranca el ciclo ya.
    if (this.running$.value && !this.job && this.canProduce()) {
      this.job = { elapsedS: 0, barTier: this.currentBar()!.tier };
    }
    this.emitState();
    this.changes$.next();
    this.persist();
  }

  // ── Persistencia ───────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const saved = (await this.storage.get(STORAGE_KEY)) as ForgeSnapshot | null;
      if (saved) {
        this.restoreGrid(this.mat,  saved.mat);
        this.restoreGrid(this.fuel, saved.fuel);
        this.restoreGrid(this.out,  saved.out);
        this.job = this.validJob(saved.job);
        this.running$.next(saved.running ?? false);
        const elapsed = saved.lastTick ? Math.min(MAX_CATCHUP_S, (Date.now() - saved.lastTick) / 1000) : 0;
        if (elapsed > 0 && this.running$.value) this.step(elapsed);   // avance offline solo si estaba en marcha
      }
    } catch (e) {
      console.warn('[forge] no se pudo restaurar el estado guardado:', e);
    } finally {
      // SIEMPRE marcar cargado: si esto falla, el tick quedaría bloqueado y la
      // forja "no haría nada" aunque el play se viera activable.
      this.loaded = true;
      this.emitState();
      this.changes$.next();
    }
  }

  /** Valida un job persistido contra el modelo actual (descarta formatos viejos). */
  private validJob(job: any): Job | null {
    if (job && typeof job.elapsedS === 'number' && typeof job.barTier === 'number' && this.barByTier(job.barTier)) {
      return { elapsedS: job.elapsedS, barTier: job.barTier };
    }
    return null;
  }

  private restoreGrid(target: (InventoryItem | null)[], src?: (InventoryItem | null)[]): void {
    if (!src) return;
    for (let i = 0; i < FORGE_SLOTS; i++) target[i] = src[i] ?? null;
  }

  private persist(): void {
    const snap: ForgeSnapshot = {
      mat: this.mat, fuel: this.fuel, out: this.out,
      job: this.job, running: this.running$.value, lastTick: Date.now(),
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
  running: boolean;
  lastTick: number;
}
