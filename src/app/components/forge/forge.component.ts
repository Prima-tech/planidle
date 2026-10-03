import { Component, inject, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CdkDragDrop, CdkDrag } from '@angular/cdk/drag-drop';
import { ForgeService, ForgeGrid, ForgeBar, forgeRarityOdds } from 'src/app/services/forge.service';
import { ItemRarity } from 'src/app/services/inventory.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { GlobalTalentsService } from 'src/app/services/global-talents.service';
import { ITEM_CATALOG } from 'src/app/physics/griddrops';

/**
 * Menú de la fragua (crisol + bandeja). Arriba: mineral y combustible en columna a la
 * izquierda, crisol central que se llena de metal con el progreso de la barra actual y
 * el lote a la derecha (barras que quedan + tiempo total). Debajo: probabilidad de cada
 * rareza, bandeja de salida de 10 huecos (scroll si se desborda) y botones Fundir/Pausar
 * y Recoger todo.
 * Toda la lógica (recetas, combustible, progreso, persistencia) vive en ForgeService.
 */
@Component({
  selector: 'app-forge',
  templateUrl: './forge.component.html',
  styleUrls: ['./forge.component.scss'],
  standalone: false,
})
export class ForgeComponent implements OnInit, AfterViewInit, OnDestroy {
  private forge     = inject(ForgeService);
  private inventory = inject(InventoryService);
  private equipment = inject(EquipmentService);
  private globalTalents = inject(GlobalTalentsService);
  private zone      = inject(NgZone);

  /** Talento de cuenta: si está desbloqueado, la forja muestra sus pestañas (Forja/Mejoras). */
  readonly forgeUpgradesUnlocked$ = this.globalTalents.forgeUpgradesUnlocked$;

  // Celdas de la forja ACTIVA (getters: cambian al cambiar de forja).
  get mat()  { return this.forge.mat; }
  get fuel() { return this.forge.fuel; }
  get out()  { return this.forge.out; }

  /** Pestaña del panel: el ciclo de producción o las mejoras de ESTA forja. */
  tab: 'forja' | 'mejoras' = 'forja';
  setTab(t: 'forja' | 'mejoras'): void { this.tab = t; }

  readonly producing$ = this.forge.producing$;
  readonly running$ = this.forge.running$;
  readonly progress$ = this.forge.progress$;
  /** Segundos restantes de la barra actual (cuenta atrás). */
  readonly remaining$ = this.forge.remaining$;
  /** Progreso (0..1) y tiempo restante del lote total con el stock disponible. */
  readonly totalProgress$ = this.forge.totalProgress$;
  readonly totalRemaining$ = this.forge.totalRemaining$;
  /** Barras que aún se pueden producir con el stock (contador en la fragua). */
  readonly producible$ = this.forge.producible$;
  /** Barra que saldrá según el mineral puesto (auto). */
  readonly currentBar$ = this.forge.currentBar$;
  /** true → hay mineral válido + combustible → play activable. */
  readonly ready$ = this.forge.ready$;

  /** IDs de celda del inventario a las que se puede arrastrar de vuelta. */
  inventoryCellIds: string[] = [];

  // Metal fundido del crisol (unidad) y barra total: se pintan cada frame con el
  // progreso interpolado del servicio (fuera de la zona de Angular, sin CD), así
  // van continuos y llegan al 100% aunque la lógica avance a 1 Hz.
  @ViewChild('moltenFill') moltenFill?: ElementRef<HTMLElement>;
  @ViewChild('totalFill') totalFill?: ElementRef<HTMLElement>;
  private rafId = 0;

  ngOnInit(): void {
    this.inventoryCellIds = this.equipment.inventoryCellIds;
    this.forge.setOpen(true);
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        const molten = this.moltenFill?.nativeElement;
        if (molten) molten.style.height = (this.forge.liveUnitFraction() * 100) + '%';
        const total = this.totalFill?.nativeElement;
        if (total) total.style.width = (this.forge.liveTotalFraction() * 100) + '%';
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    this.forge.setOpen(false);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  /** Predicados de arrastre: una celda solo se resalta/acepta si el item le sirve.
   *  Arrow functions para conservar `this`. `drag.data.item` = item arrastrado. */
  matEnter  = (drag: CdkDrag): boolean => this.forge.canAccept('mat',  drag.data?.item);
  fuelEnter = (drag: CdkDrag): boolean => this.forge.canAccept('fuel', drag.data?.item);
  outEnter  = (_drag: CdkDrag): boolean => false;   // la salida nunca acepta

  /** Botón único play/pausa. */
  toggle(): void { this.forge.toggle(); }

  /** Formatea segundos como HH:MM:SS. */
  fmtTime(s: number | null): string {
    const v = Math.max(0, Math.floor(s ?? 0));
    const h = Math.floor(v / 3600);
    const m = Math.floor((v % 3600) / 60);
    const sec = v % 60;
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${p(h)}:${p(m)}:${p(sec)}`;
  }

  /** Doble clic (detectado por tiempo, sin depender del evento nativo que cdkDrag
   *  se traga) en una celda de la forja → pide retirar el item al inventario. */
  private lastCellClick: { grid: ForgeGrid; index: number; time: number } | null = null;
  onCellClick(grid: ForgeGrid, index: number): void {
    const now = Date.now();
    const lc = this.lastCellClick;
    if (lc && lc.grid === grid && lc.index === index && now - lc.time < 350) {
      this.lastCellClick = null;
      this.forge.requestWithdraw(grid, index);
      return;
    }
    this.lastCellClick = { grid, index, time: now };
  }

  /** Huecos de salida que caben a la vista en la bandeja (el resto, con scroll). */
  private static readonly TRAY_VISIBLE = 5;

  /** ¿Hay algo en la bandeja más allá de los huecos visibles? → se activa el scroll. */
  outOverflows(): boolean {
    return this.out.some((c, i) => !!c && i >= ForgeComponent.TRAY_VISIBLE);
  }

  hasOutput(): boolean { return this.out.some(c => !!c); }

  /** Recoger todo: pide retirar cada casilla de salida al inventario (cada una entra
   *  solo si cabe; lo que no quepa se queda en la bandeja). */
  collectAll(): void {
    this.out.forEach((c, i) => { if (c) this.forge.requestWithdraw('out', i); });
  }

  /** Probabilidad de cada rareza para la barra actual (barra de probabilidades).
   *  Cacheada por barra: la plantilla la pide en cada detección de cambios. */
  private oddsCache: { tier: number | null; list: { rarity: ItemRarity; pct: number }[] } | null = null;
  odds(bar: ForgeBar | null): { rarity: ItemRarity; pct: number }[] {
    const tier = bar?.tier ?? null;
    if (!this.oddsCache || this.oddsCache.tier !== tier) this.oddsCache = { tier, list: forgeRarityOdds(bar) };
    return this.oddsCache.list;
  }

  /** Clave i18n del nombre de una rareza. */
  rarityKey(r: ItemRarity): string { return 'BUILD.RARITY_' + r.toUpperCase(); }

  /** Icono de la barra = el MISMO del objeto en el catálogo (inventario/salida), así
   *  cambiar el PNG de una barra se ve también en el crisol. */
  barIcon(bar: ForgeBar): string | undefined {
    return ITEM_CATALOG.find(e => e.name === bar.name)?.icon;
  }

  /** Drop en una celda de la fundición: desde el inventario (entra) o interno. */
  onCellDrop(event: CdkDragDrop<any>, grid: ForgeGrid, index: number): void {
    const data = event.item.data;
    if (data.sourceContext === 'inventory') {
      // dropFromInventory acepta/apila o INTERCAMBIA (cambiar de mineral): el nuevo
      // sale de su celda del inventario y el viejo desplazado vuelve al inventario.
      const r = this.forge.dropFromInventory(grid, index, data.item);
      if (r.ok) {
        this.inventory.removeRequest$.next({ tabIndex: data.tabIndex, row: data.row, col: data.col });
        if (r.returned) this.inventory.itemDropped$.next(r.returned);
      }
      return;
    }
    if (data.sourceContext === 'forge') {
      this.forge.moveInternal({ g: data.grid, index: data.index }, { g: grid, index });
    }
  }

  // ── Iconos (mismo cálculo que inventario/tienda para sheets) ────────────────

  getSheetPos(frame = 0, cols = 12, frameSize = 32, contentSize?: number): string {
    const cs = contentSize ?? frameSize;
    const scale = 32 / cs;
    const c = frame % cols;
    const r = Math.floor(frame / cols);
    return `-${c * frameSize * scale}px -${r * frameSize * scale}px`;
  }

  getSheetBgSize(cols = 12, frameSize = 32, contentSize?: number): string {
    const cs = contentSize ?? frameSize;
    return `${cols * frameSize * (32 / cs)}px auto`;
  }

  trackByIndex(i: number): number { return i; }
}
