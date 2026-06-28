import { Component, inject, OnInit } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ForgeService, ForgeGrid, ForgeBar } from 'src/app/services/forge.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { ITEM_CATALOG } from 'src/app/physics/griddrops';

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
export class ForgeComponent implements OnInit {
  private forge     = inject(ForgeService);
  private inventory = inject(InventoryService);
  private equipment = inject(EquipmentService);

  readonly mat  = this.forge.mat;
  readonly fuel = this.forge.fuel;
  readonly out  = this.forge.out;
  readonly producing$ = this.forge.producing$;
  readonly selectedRecipe$ = this.forge.selectedRecipe$;
  readonly availableBars = this.forge.availableBars;

  /** true → panel de selección de barras (recetas) abierto a la derecha. */
  recipePanelOpen = false;

  /** IDs de celda del inventario a las que se puede arrastrar de vuelta. */
  inventoryCellIds: string[] = [];

  ngOnInit(): void {
    this.inventoryCellIds = this.equipment.inventoryCellIds;
  }

  /** Pulsar el botón de producir: abre/cierra el panel de selección de barras. */
  toggleRecipePanel(): void { this.recipePanelOpen = !this.recipePanelOpen; }

  /** Elige una barra como receta y cierra el panel. */
  selectBar(bar: ForgeBar): void {
    this.forge.selectRecipe(bar);
    this.recipePanelOpen = false;
  }

  /** Item del catálogo del mineral que requiere la barra seleccionada (para el icono
   *  pista del cuadrado de material). null si no aplica. */
  requiredMineral(bar: ForgeBar | null): any {
    if (!bar) return null;
    return ITEM_CATALOG.find(e => e.name === bar.mineral) ?? null;
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
