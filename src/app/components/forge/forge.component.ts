import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CdkDragDrop, CdkDrag } from '@angular/cdk/drag-drop';
import { ForgeService, ForgeGrid } from 'src/app/services/forge.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { EquipmentService } from 'src/app/services/equipment.service';

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
export class ForgeComponent implements OnInit, OnDestroy {
  private forge     = inject(ForgeService);
  private inventory = inject(InventoryService);
  private equipment = inject(EquipmentService);

  readonly mat  = this.forge.mat;
  readonly fuel = this.forge.fuel;
  readonly out  = this.forge.out;
  readonly producing$ = this.forge.producing$;
  readonly running$ = this.forge.running$;
  readonly progress$ = this.forge.progress$;
  /** Segundos restantes de la barra actual (cuenta atrás). */
  readonly remaining$ = this.forge.remaining$;
  /** Barra que saldrá según el mineral puesto (auto). */
  readonly currentBar$ = this.forge.currentBar$;
  /** true → hay mineral válido + combustible → play activable. */
  readonly ready$ = this.forge.ready$;

  /** IDs de celda del inventario a las que se puede arrastrar de vuelta. */
  inventoryCellIds: string[] = [];

  ngOnInit(): void {
    this.inventoryCellIds = this.equipment.inventoryCellIds;
    this.forge.setOpen(true);
  }

  ngOnDestroy(): void {
    this.forge.setOpen(false);
  }

  /** Predicados de arrastre: una celda solo se resalta/acepta si el item le sirve.
   *  Arrow functions para conservar `this`. `drag.data.item` = item arrastrado. */
  matEnter  = (drag: CdkDrag): boolean => this.forge.canAccept('mat',  drag.data?.item);
  fuelEnter = (drag: CdkDrag): boolean => this.forge.canAccept('fuel', drag.data?.item);
  outEnter  = (_drag: CdkDrag): boolean => false;   // la salida nunca acepta

  /** Botón único play/pausa. */
  toggle(): void { this.forge.toggle(); }

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
      if (this.forge.place(grid, index, data.item)) {
        this.inventory.removeRequest$.next({ tabIndex: data.tabIndex, row: data.row, col: data.col });
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
