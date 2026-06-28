import { Component, inject, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CdkDragDrop, CdkDrag } from '@angular/cdk/drag-drop';
import { ForgeService, ForgeGrid } from 'src/app/services/forge.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { AccountUpgradesService } from 'src/app/services/account-upgrades.service';

/**
 * Menú de la fundición. De arriba a abajo:
 *  1. Slider de 8 celdas — materiales a fundir (arrastrados desde el inventario).
 *  2. Slider de 8 celdas — combustible (madera, carbón…).
 *  3. Cuadro de producción — qué se está fundiendo ahora + barra de progreso.
 *  4. Slider de 8 celdas — salida; se arrastra de vuelta al inventario.
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
  private accountUpgrades = inject(AccountUpgradesService);
  private zone      = inject(NgZone);

  /** Mejora de cuenta: si está activa, la forja muestra sus pestañas (Forja/Mejoras). */
  readonly forgeUpgradesUnlocked$ = this.accountUpgrades.forgeUpgradesUnlocked$;

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

  // Relleno del aro (unidad) y de la barra total: se pintan cada frame con el
  // progreso interpolado del servicio (fuera de la zona de Angular, sin CD), así
  // van continuos y llegan al 100% aunque la lógica avance a 1 Hz.
  @ViewChild('ringFill')  ringFill?:  ElementRef<SVGRectElement>;
  @ViewChild('totalFill') totalFill?: ElementRef<HTMLElement>;
  private rafId = 0;

  ngOnInit(): void {
    this.inventoryCellIds = this.equipment.inventoryCellIds;
    this.forge.setOpen(true);
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        const ring = this.ringFill?.nativeElement;
        if (ring) ring.style.strokeDashoffset = String(100 - this.forge.liveUnitFraction() * 100);
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

  /** Estilo de fondo que recorta la caja de una barra en Icons.png (480×320). */
  barStyle(box: { x: number; y: number; w: number; h: number }): Record<string, string> {
    return {
      'background-image':    'url(assets/icon/icons/Icons.png)',
      'background-repeat':   'no-repeat',
      'background-size':     '480px 320px',
      'background-position': `-${box.x}px -${box.y}px`,
      'image-rendering':     'pixelated',
      'width':               `${box.w}px`,
      'height':              `${box.h}px`,
    };
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
