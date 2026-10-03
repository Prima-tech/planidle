import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { WorkbenchService, WorkbenchRecipe } from 'src/app/services/workbench.service';
import { QuestService } from 'src/app/services/quest.service';

/** Casillas por página de la tira de recetas (swipe horizontal entre páginas). */
const PER_PAGE = 4;

/**
 * Ventana de la MESA DE TRABAJO (se abre a la izquierda al pulsar/activar la mesa
 * construida, junto al inventario a la derecha, igual que la forja). Arriba, las
 * recetas (WORKBENCH_RECIPES) en casillas de 4 en 4 con swipe; abajo, la ficha de la
 * seleccionada: materiales tengo/necesito y botón de fabricar (o candado si aún no
 * está desbloqueada).
 */
@Component({
  selector: 'app-workbench-window',
  templateUrl: './workbench-window.component.html',
  styleUrls: ['./workbench-window.component.scss'],
  standalone: false,
})
export class WorkbenchWindowComponent {
  wb = inject(WorkbenchService);
  private quests = inject(QuestService);

  @ViewChild('strip') private strip?: ElementRef<HTMLDivElement>;

  /** Receta seleccionada (por id). Por defecto: la que pide la guía, si no la
   *  primera desbloqueada, si no la primera. */
  private selectedId: string | null = null;
  /** Página visible de la tira (la fija el scroll-snap del swipe). */
  page = 0;

  get recipes(): WorkbenchRecipe[] { return this.wb.recipes; }

  get pages(): WorkbenchRecipe[][] {
    const out: WorkbenchRecipe[][] = [];
    for (let i = 0; i < this.recipes.length; i += PER_PAGE) out.push(this.recipes.slice(i, i + PER_PAGE));
    return out;
  }

  get selected(): WorkbenchRecipe | null {
    const list = this.recipes;
    return list.find(r => r.id === this.selectedId)
      ?? list.find(r => this.isGuide(r))
      ?? list.find(r => this.wb.isUnlocked(r))
      ?? list[0] ?? null;
  }

  select(r: WorkbenchRecipe): void { this.selectedId = r.id; }

  craft(r: WorkbenchRecipe): void { this.wb.craft(r); }

  /** % de la barra de un material (tengo/necesito, tope 100). */
  barPct(c: { name: string; qty: number }): number {
    return Math.min(100, (this.wb.have(c.name) / c.qty) * 100);
  }

  /** Swipe: la página visible sale del scroll de la tira (cada página = su ancho). */
  onStripScroll(): void {
    const el = this.strip?.nativeElement;
    if (!el || !el.clientWidth) return;
    this.page = Math.round(el.scrollLeft / el.clientWidth);
  }

  /** Flechas/puntos: desplaza la tira a la página `n`. */
  goPage(n: number): void {
    const el = this.strip?.nativeElement;
    if (!el) return;
    const p = Math.max(0, Math.min(this.pages.length - 1, n));
    el.scrollTo({ left: p * el.clientWidth, behavior: 'smooth' });
    this.page = p;
  }

  /** Guía: la misión en curso pide equipar este resultado y aún no lo tienes → brilla
   *  su casilla y su botón Fabricar (al fabricarlo la guía pasa a la mochila). */
  isGuide(r: WorkbenchRecipe): boolean {
    return r.result === this.quests.pendingEquipItem() && this.wb.have(r.result) === 0;
  }
}
