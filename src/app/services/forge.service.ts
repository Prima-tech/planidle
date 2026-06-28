import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Subject, interval } from 'rxjs';
import { StorageService } from './storage.service';
import { InventoryItem } from './inventory.service';
import { ITEM_CATALOG, LootEntry } from '../physics/griddrops';

/**
 * Forjas (estación de oficio `forge`/`smelter`). MULTI-INSTANCIA: puede haber
 * varias forjas independientes, cada una con su propio estado (material, combustible,
 * salida, trabajo en curso, contador de lote… y a futuro mejoras). Todas simulan en
 * segundo plano aunque no se vean; la UI muestra la ACTIVA (`activeId`).
 *
 * Cada forja: la barra a producir se DEDUCE del mineral puesto (FORGE_BARS). Con
 * mineral válido + madera + sitio en salida, se puede dar al play; cada barra tarda
 * SECONDS_PER_BAR, gasta 1 mineral + 1 madera y deja 1 barra en la salida.
 *
 * Persistencia local (StorageService) de TODAS las forjas; al cargar hace catch-up
 * por el tiempo transcurrido, así que trabajan también con la app cerrada. Son
 * globales entre personajes (el servicio no está ligado a ningún pj).
 *
 * En modo conectado se sincronizan a la nube (columna `global_data.forges`) y el
 * tiempo offline lo calcula el SERVIDOR (RPC `claim_forge_offline`), así que no se
 * puede trampear adelantando el reloj del móvil. Ver `supabase/forge_offline.sql`.
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
/** Periodo del tick de simulación (ms). Fino para que el ciclo complete al instante. */
const TICK_MS = 100;

/** Combustible admitido: de momento solo madera (cualquier tier: 'Madera', 'Madera Tier 2'…). */
function isFuelItem(item: InventoryItem | null): boolean {
  return !!item && item.name.startsWith('Madera');
}

/** Mineral admitido en la celda de material: el que pide alguna barra de FORGE_BARS. */
function isMineralItem(item: InventoryItem | null): boolean {
  return !!item && FORGE_BARS.some(b => b.mineral === item.name);
}

export const FORGE_SLOTS = 8;
const STORAGE_KEY = 'forge_state_v2';   // v2 = multi-instancia (el v1 era una sola forja)
const MAX_CATCHUP_S = 8 * 3600;         // tope de avance offline al cargar (8 h)

interface Job { elapsedS: number; barTier: number; }

/** Una forja: todo su estado. `lastTickMs` es de runtime (interpolación), no se persiste. */
export interface ForgeInstance {
  id: string;
  name: string;
  mat:  (InventoryItem | null)[];
  fuel: (InventoryItem | null)[];
  out:  (InventoryItem | null)[];
  job: Job | null;
  running: boolean;
  producedCount: number;
  lastTickMs: number;
}

/** Resumen ligero de una forja para la lista/selector de la UI. */
export interface ForgeSummary { id: string; name: string; running: boolean; }

@Injectable({ providedIn: 'root' })
export class ForgeService {

  // ── Estado multi-instancia ───────────────────────────────────────────────────
  private forges: ForgeInstance[] = [];
  private activeId = '';

  /** Lista de forjas (para el selector) y cuál está activa. */
  readonly forges$ = new BehaviorSubject<ForgeSummary[]>([]);
  readonly activeId$ = new BehaviorSubject<string>('');

  // ── Observables de la forja ACTIVA (la API que consume la plantilla) ──────────
  readonly currentBar$ = new BehaviorSubject<ForgeBar | null>(null);
  readonly ready$ = new BehaviorSubject<boolean>(false);
  readonly running$ = new BehaviorSubject<boolean>(false);
  readonly progress$ = new BehaviorSubject<number>(0);
  readonly remaining$ = new BehaviorSubject<number>(SECONDS_PER_BAR);
  readonly totalProgress$ = new BehaviorSubject<number>(0);
  readonly totalRemaining$ = new BehaviorSubject<number>(0);
  readonly producible$ = new BehaviorSubject<number>(0);
  readonly producing$ = new BehaviorSubject<{ item: InventoryItem; progress: number } | null>(null);
  readonly changes$ = new Subject<void>();
  readonly withdraw$ = new Subject<{ grid: ForgeGrid; index: number; item: InventoryItem }>();

  /** true mientras el panel de la forja está abierto (lo marca ForgeComponent). */
  private _open = false;
  get isOpen(): boolean { return this._open; }
  setOpen(v: boolean): void { this._open = v; }

  /** IDs CDK de las celdas de la forja activa (para `cdkDropListConnectedTo`). */
  readonly cellIds: string[] = (['mat', 'fuel', 'out'] as ForgeGrid[])
    .flatMap(g => Array.from({ length: FORGE_SLOTS }, (_, i) => `forge-${g}-${i}`));

  private storage = inject(StorageService);
  private zone = inject(NgZone);

  private loaded = false;
  private loadPromise!: Promise<void>;   // se resuelve cuando el estado local está cargado
  private sincePersist = 0;

  constructor() {
    // Forja por defecto SÍNCRONA: así `active` nunca es undefined antes de que
    // `load()` (async) restaure el estado guardado (que la reemplazará si existe).
    const def = this.makeForge('Forja 1');
    this.forges = [def];
    this.activeId = def.id;
    this.emitActive(); this.emitForges();
    this.loadPromise = this.load();
    // Tick a 100 ms fuera de la zona: la lógica avanza fino (la barra completa al
    // instante). Solo re-entramos a la zona (CD) cuando cambia algo MOSTRADO de la
    // forja activa. El aro/barra van por rAF, sin CD.
    this.zone.runOutsideAngular(() => {
      interval(TICK_MS).subscribe(() => this.tick(TICK_MS / 1000));
    });
  }

  // ── Forja activa y vistas ────────────────────────────────────────────────────

  private get active(): ForgeInstance {
    return this.forges.find(f => f.id === this.activeId) ?? this.forges[0];
  }

  /** Celdas de la forja activa (lo que ve/edita la plantilla). */
  get mat():  (InventoryItem | null)[] { return this.active.mat; }
  get fuel(): (InventoryItem | null)[] { return this.active.fuel; }
  get out():  (InventoryItem | null)[] { return this.active.out; }

  get activeName(): string { return this.active?.name ?? ''; }

  private grid(g: ForgeGrid): (InventoryItem | null)[] {
    const f = this.active;
    return g === 'mat' ? f.mat : g === 'fuel' ? f.fuel : f.out;
  }

  // ── Gestión de forjas ────────────────────────────────────────────────────────

  private makeForge(name: string): ForgeInstance {
    return {
      id: `forge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      mat: Array(FORGE_SLOTS).fill(null),
      fuel: Array(FORGE_SLOTS).fill(null),
      out: Array(FORGE_SLOTS).fill(null),
      job: null, running: false, producedCount: 0, lastTickMs: Date.now(),
    };
  }

  /** Cambia la forja visible. */
  selectForge(id: string): void {
    if (!this.forges.some(f => f.id === id)) return;
    this.activeId = id;
    this.emitActive(); this.emitForges(); this.changes$.next(); this.persist();
  }

  /** Crea una forja nueva y la deja activa. */
  addForge(): void {
    const f = this.makeForge(`Forja ${this.forges.length + 1}`);
    this.forges.push(f);
    this.activeId = f.id;
    this.emitActive(); this.emitForges(); this.changes$.next(); this.persist();
  }

  /** Elimina una forja (mínimo queda 1). */
  removeForge(id: string): void {
    if (this.forges.length <= 1) return;
    const i = this.forges.findIndex(f => f.id === id);
    if (i === -1) return;
    this.forges.splice(i, 1);
    if (this.activeId === id) this.activeId = this.forges[0].id;
    this.emitActive(); this.emitForges(); this.changes$.next(); this.persist();
  }

  // ── Barra deducida del mineral ───────────────────────────────────────────────

  private currentBarOf(f: ForgeInstance): ForgeBar | null {
    for (const bar of FORGE_BARS) if (this.hasItem(f.mat, bar.mineral)) return bar;
    return null;
  }

  private barByTier(tier: number): ForgeBar | null {
    return FORGE_BARS.find(b => b.tier === tier) ?? null;
  }

  /** Si hay una barra en la salida, el mineral que la produce (el único que se puede
   *  meter en material para no mezclar barras distintas). null si la salida está vacía. */
  private outputMineral(f: ForgeInstance): string | null {
    for (const c of f.out) {
      if (!c) continue;
      const bar = FORGE_BARS.find(b => b.name === c.name);
      if (bar) return bar.mineral;
    }
    return null;
  }

  // ── Play / Pausa (sobre la activa) ───────────────────────────────────────────

  toggle(): void { this.active.running ? this.pause() : this.play(); }

  play(): void {
    const f = this.active;
    if (!this.canProduceForge(f)) return;
    f.running = true;
    if (!f.job) f.job = { elapsedS: 0, barTier: this.currentBarOf(f)!.tier };
    f.lastTickMs = Date.now();
    this.emitActive(); this.emitForges(); this.changes$.next(); this.persist();
  }

  pause(): void {
    const f = this.active;
    f.running = false;
    this.emitActive(); this.emitForges(); this.changes$.next(); this.persist();
  }

  // ── Drag & drop (sobre la activa) ────────────────────────────────────────────

  place(g: ForgeGrid, index: number, item: InventoryItem): boolean {
    if (g === 'out') return false;
    if (g === 'fuel' && !isFuelItem(item)) return false;
    if (g === 'mat'  && !isMineralItem(item)) return false;
    // Si ya hay una barra en la salida, solo se admite su mismo mineral (no mezclar).
    if (g === 'mat') {
      const need = this.outputMineral(this.active);
      if (need && item.name !== need) return false;
    }
    const cells = this.grid(g);
    const target = cells[index];
    if (target?.mergeable && item.mergeable && target.name === item.name) {
      target.sum = (target.sum ?? 1) + (item.sum ?? 1);
    } else if (target !== null) {
      return false;
    } else {
      cells[index] = item;
    }
    this.afterChange();
    return true;
  }

  /** Drop desde el inventario: coloca/apila, o INTERCAMBIA si la celda está ocupada
   *  por otro item válido (p. ej. cambiar de mineral). El swap solo procede si el item
   *  es admisible (`canAccept` ya aplica la regla de "no mezclar con la barra de salida").
   *  Devuelve `ok` (si lo aceptó) y `returned` = item desplazado que debe volver al
   *  inventario (null si no desplazó nada). */
  dropFromInventory(g: ForgeGrid, index: number, item: InventoryItem): { ok: boolean; returned: InventoryItem | null } {
    if (!this.canAccept(g, item)) return { ok: false, returned: null };   // tipo válido + regla de salida
    const cells = this.grid(g);
    const target = cells[index];
    if (target?.mergeable && item.mergeable && target.name === item.name) {
      target.sum = (target.sum ?? 1) + (item.sum ?? 1);
      this.afterChange();
      return { ok: true, returned: null };
    }
    if (target === null) {
      cells[index] = item;
      this.afterChange();
      return { ok: true, returned: null };
    }
    // Ocupada por otro item válido → intercambio (el viejo vuelve al inventario).
    cells[index] = item;
    this.afterChange();
    return { ok: true, returned: target };
  }

  moveInternal(from: { g: ForgeGrid; index: number }, to: { g: ForgeGrid; index: number }): void {
    if (from.g === to.g && from.index === to.index) return;
    if (to.g === 'out') return;
    const src = this.grid(from.g), dst = this.grid(to.g);
    const item = src[from.index];
    if (!item) return;
    const target = dst[to.index];
    if (target?.mergeable && item.mergeable && target.name === item.name) {
      target.sum = (target.sum ?? 1) + (item.sum ?? 1);
      src[from.index] = null;
    } else {
      dst[to.index] = item;
      src[from.index] = target;
    }
    this.afterChange();
  }

  removeCell(g: ForgeGrid, index: number): void {
    this.grid(g)[index] = null;
    this.afterChange();
  }

  quickAdd(item: InventoryItem): boolean {
    if (isFuelItem(item)) return this.place('fuel', 0, item);
    if (isMineralItem(item)) return this.place('mat', 0, item);
    return false;
  }

  requestWithdraw(g: ForgeGrid, index: number): void {
    const item = this.grid(g)[index];
    if (item) this.withdraw$.next({ grid: g, index, item });
  }

  canAccept(g: ForgeGrid, item: InventoryItem | null): boolean {
    if (!item) return false;
    if (g === 'fuel') return isFuelItem(item);
    if (g === 'mat') {
      if (!isMineralItem(item)) return false;
      const need = this.outputMineral(this.active);   // hay barra en salida → solo su mineral
      return !need || item.name === need;
    }
    return false;
  }

  // ── Motor de producción (sobre cualquier forja) ──────────────────────────────

  private tick(dt: number): void {
    const a = this.active;
    const beforeJob = a.job;
    const beforeSec = this.unitSecOf(a);
    let any = false;
    for (const f of this.forges) {
      if (!f.running) continue;
      const adv = this.stepForge(f, dt);
      if (adv) { f.lastTickMs = Date.now(); any = true; }
      this.normalize(f);
    }
    // Solo CD si cambió lo que se ve de la forja ACTIVA (cronómetro/contador/completar).
    if (a.job !== beforeJob || this.unitSecOf(a) !== beforeSec) {
      this.zone.run(() => { this.emitActive(); this.emitForges(); this.changes$.next(); });
    }
    if (any) {
      this.sincePersist += dt;
      if (this.sincePersist >= 5) { this.persist(); this.sincePersist = 0; }
    }
  }

  private unitSecOf(f: ForgeInstance): number {
    return f.job ? Math.max(0, Math.ceil(SECONDS_PER_BAR - f.job.elapsedS)) : SECONDS_PER_BAR;
  }

  private stepForge(f: ForgeInstance, dt: number): boolean {
    if (!f.running) return false;
    let work = dt, progressed = false, guard = 0;
    while (work > 1e-6 && guard++ < 10000) {
      if (!f.job) {
        const bar = this.currentBarOf(f);
        if (!bar || !this.hasAnyFuelOf(f) || !this.outputHasSpaceOf(f, bar.name)) break;
        f.job = { elapsedS: 0, barTier: bar.tier };
      }
      const slice = Math.min(work, SECONDS_PER_BAR - f.job.elapsedS);
      f.job.elapsedS += slice;
      work -= slice;
      progressed = true;
      if (f.job.elapsedS >= SECONDS_PER_BAR - 1e-6) {
        if (!this.completeBarForge(f)) { f.job = null; break; }
        f.job = null;
      }
    }
    return progressed;
  }

  private canProduceForge(f: ForgeInstance): boolean {
    const bar = this.currentBarOf(f);
    return !!bar && this.hasAnyFuelOf(f) && this.outputHasSpaceOf(f, bar.name);
  }

  private completeBarForge(f: ForgeInstance): boolean {
    const bar = this.barByTier(f.job!.barTier);
    if (!bar) return false;
    if (!this.hasItem(f.mat, bar.mineral) || !this.hasAnyFuelOf(f) || !this.outputHasSpaceOf(f, bar.name)) return false;
    this.consumeOne(f.mat, bar.mineral);
    this.consumeAnyFuelOf(f);
    this.addOutputTo(f, bar.name);
    f.producedCount++;
    return true;
  }

  /** Reinicia el contador de lote cuando se agotó (sin trabajo ni stock). */
  private normalize(f: ForgeInstance): void {
    if (!f.job && this.producibleNowOf(f) === 0) f.producedCount = 0;
  }

  private hasItem(cells: (InventoryItem | null)[], name: string): boolean {
    return cells.some(c => c?.name === name);
  }
  private hasAnyFuelOf(f: ForgeInstance): boolean {
    return f.fuel.some(c => isFuelItem(c));
  }
  private countOf(cells: (InventoryItem | null)[], name: string): number {
    return cells.reduce((n, c) => n + (c?.name === name ? (c.sum ?? 1) : 0), 0);
  }
  private fuelCountOf(f: ForgeInstance): number {
    return f.fuel.reduce((n, c) => n + (isFuelItem(c) ? (c!.sum ?? 1) : 0), 0);
  }

  /** Fracción (0..1) de la barra en curso de la forja ACTIVA, interpolada con reloj. */
  liveUnitFraction(): number {
    const f = this.active;
    if (!f.job) return 0;
    let e = f.job.elapsedS;
    if (f.running) e += (Date.now() - f.lastTickMs) / 1000;
    return Math.max(0, Math.min(1, e / SECONDS_PER_BAR));
  }

  /** Fracción (0..1) del lote total de la forja ACTIVA. */
  liveTotalFraction(): number {
    const f = this.active;
    const producible = this.producibleNowOf(f);
    const total = f.producedCount + producible;
    if (total <= 0) return 0;
    const partial = f.job ? this.liveUnitFraction() : 0;
    return Math.max(0, Math.min(1, (f.producedCount + partial) / total));
  }

  private producibleNowOf(f: ForgeInstance): number {
    const bar = f.job ? this.barByTier(f.job.barTier) : this.currentBarOf(f);
    if (!bar) return 0;
    return Math.min(this.countOf(f.mat, bar.mineral), this.fuelCountOf(f));
  }

  private consumeAnyFuelOf(f: ForgeInstance): void {
    const i = f.fuel.findIndex(c => isFuelItem(c));
    if (i !== -1) this.decOne(f.fuel, i);
  }

  private outputHasSpaceOf(f: ForgeInstance, name: string): boolean {
    return f.out.some(c => c === null || (c.mergeable && c.name === name));
  }

  private addOutputTo(f: ForgeInstance, name: string): void {
    const existing = f.out.find(c => c?.mergeable && c.name === name);
    if (existing) { existing.sum = (existing.sum ?? 1) + 1; return; }
    const idx = f.out.findIndex(c => c === null);
    if (idx !== -1) f.out[idx] = this.itemFromCatalog(name);
  }

  private consumeOne(cells: (InventoryItem | null)[], name: string): boolean {
    const i = cells.findIndex(c => c?.name === name);
    if (i === -1) return false;
    this.decOne(cells, i);
    return true;
  }

  private decOne(cells: (InventoryItem | null)[], i: number): void {
    const it = cells[i];
    if (!it) return;
    if (it.mergeable && (it.sum ?? 1) > 1) it.sum = (it.sum ?? 1) - 1;
    else cells[i] = null;
  }

  /** Refresca los observables de la forja ACTIVA. */
  private emitActive(): void {
    const f = this.active;
    const bar = f.job ? this.barByTier(f.job.barTier) : this.currentBarOf(f);
    const elapsed = f.job ? f.job.elapsedS : 0;
    const frac = Math.max(0, Math.min(1, elapsed / SECONDS_PER_BAR));
    const remaining = f.job ? Math.max(0, Math.ceil(SECONDS_PER_BAR - elapsed)) : SECONDS_PER_BAR;

    this.normalize(f);
    const producible = this.producibleNowOf(f);
    const total = f.producedCount + producible;
    const totalProgress = total > 0 ? Math.min(1, (f.producedCount + frac) / total) : 0;
    const totalRemaining = Math.max(0, Math.ceil(producible * SECONDS_PER_BAR - elapsed));

    this.currentBar$.next(bar);
    this.ready$.next(this.canProduceForge(f));
    this.running$.next(f.running);
    this.progress$.next(frac);
    this.remaining$.next(remaining);
    this.totalProgress$.next(totalProgress);
    this.totalRemaining$.next(totalRemaining);
    this.producible$.next(producible);
    this.producing$.next(f.job && bar ? { item: this.itemFromCatalog(bar.name), progress: frac } : null);
  }

  private emitForges(): void {
    this.forges$.next(this.forges.map(f => ({ id: f.id, name: f.name, running: f.running })));
    this.activeId$.next(this.activeId);
  }

  private afterChange(): void {
    const f = this.active;
    if (f.job) {
      const bar = this.barByTier(f.job.barTier);
      if (!bar || !this.hasItem(f.mat, bar.mineral)) f.job = null;
    }
    if (f.running && !f.job && this.canProduceForge(f)) {
      f.job = { elapsedS: 0, barTier: this.currentBarOf(f)!.tier };
      f.lastTickMs = Date.now();
    }
    this.normalize(f);
    this.emitActive(); this.changes$.next(); this.persist();
  }

  // ── Persistencia ───────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const saved = (await this.storage.get(STORAGE_KEY)) as ForgeSnapshot | null;
      if (saved?.forges?.length) this.buildForges(saved);
    } catch (e) {
      console.warn('[forge] no se pudo restaurar el estado guardado:', e);
    } finally {
      if (!this.forges.length) {
        const f = this.makeForge('Forja 1');
        this.forges = [f];
        this.activeId = f.id;
      }
      this.loaded = true;
      this.emitActive(); this.emitForges(); this.changes$.next();
    }
  }

  private validJob(job: any): Job | null {
    if (job && typeof job.elapsedS === 'number' && typeof job.barTier === 'number' && this.barByTier(job.barTier)) {
      return { elapsedS: job.elapsedS, barTier: job.barTier };
    }
    return null;
  }

  private normGrid(src?: (InventoryItem | null)[]): (InventoryItem | null)[] {
    const out: (InventoryItem | null)[] = Array(FORGE_SLOTS).fill(null);
    if (src) for (let i = 0; i < FORGE_SLOTS; i++) out[i] = src[i] ?? null;
    return out;
  }

  /** Reconstruye las forjas en memoria desde un snapshot (local o nube) + catch-up.
   *  `overrideElapsedS` = segundos calculados por el SERVIDOR (anti-trampa de reloj);
   *  si no se pasa, cae al cálculo local `now - lastSave` (modo offline). */
  private buildForges(snap: ForgeSnapshot, overrideElapsedS?: number): void {
    this.forges = snap.forges.map(s => ({
      id: s.id, name: s.name,
      mat: this.normGrid(s.mat), fuel: this.normGrid(s.fuel), out: this.normGrid(s.out),
      job: this.validJob(s.job), running: !!s.running, producedCount: s.producedCount ?? 0,
      lastTickMs: Date.now(),
    }));
    this.activeId = snap.activeId && this.forges.some(f => f.id === snap.activeId)
      ? snap.activeId : this.forges[0].id;
    // Catch-up offline.
    const elapsed = overrideElapsedS != null
      ? Math.min(MAX_CATCHUP_S, Math.max(0, overrideElapsedS))
      : (snap.lastSave ? Math.min(MAX_CATCHUP_S, (Date.now() - snap.lastSave) / 1000) : 0);
    if (elapsed > 0) for (const f of this.forges) if (f.running) { this.stepForge(f, elapsed); this.normalize(f); }
  }

  /** Snapshot serializable de TODAS las forjas (mismo formato local y de cuenta). */
  private buildSnapshot(): ForgeSnapshot {
    return {
      forges: this.forges.map(f => ({
        id: f.id, name: f.name, mat: f.mat, fuel: f.fuel, out: f.out,
        job: f.job, running: f.running, producedCount: f.producedCount,
      })),
      activeId: this.activeId,
      lastSave: Date.now(),
    };
  }

  private persist(): void {
    this.storage.set(STORAGE_KEY, this.buildSnapshot());
  }

  // ── Sincronización de cuenta (Supabase: columna global_data.forges + server-time) ──

  /** Snapshot para subir a la nube (lo llama SaveService al guardar). */
  getAccountSnapshot(): ForgeSnapshot {
    return this.buildSnapshot();
  }

  /** Aplica el snapshot de la NUBE al loguear (modo conectado). La nube + el tiempo
   *  del SERVIDOR mandan: el estado local avanza con el reloj del cliente, que es
   *  trampeable, así que NO se respeta aquí (se reconstruye desde la nube de forma
   *  determinista con el tiempo real del servidor). `serverElapsedS` = segundos
   *  offline calculados por el servidor (claim_forge_offline); si es null, cae al
   *  reloj local como respaldo. Espera a que el estado local esté cargado. */
  async syncFromCloud(cloud: ForgeSnapshot | null, serverElapsedS?: number | null): Promise<void> {
    if (!cloud?.forges?.length) return;
    await this.loadPromise;
    this.buildForges(cloud, serverElapsedS ?? undefined);
    this.persist();
    this.emitActive(); this.emitForges(); this.changes$.next();
  }

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

export interface ForgeSnapshot {
  forges: {
    id: string; name: string;
    mat: (InventoryItem | null)[];
    fuel: (InventoryItem | null)[];
    out: (InventoryItem | null)[];
    job: Job | null;
    running: boolean;
    producedCount: number;
  }[];
  activeId: string;
  lastSave: number;
}
