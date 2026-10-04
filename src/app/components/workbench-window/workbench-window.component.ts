import { Component, inject } from '@angular/core';
import { WorkbenchService, WorkbenchRecipe, WorkbenchKind } from 'src/app/services/workbench.service';
import { QuestService } from 'src/app/services/quest.service';

/**
 * Ventana de la MESA DE TRABAJO (se abre a la izquierda al pulsar/activar la mesa
 * construida, junto al inventario a la derecha, igual que la forja). Arriba, pestañas
 * por tipo (herramientas / armas / armaduras); en medio, las recetas de esa pestaña en
 * fichas de 3 en fila con su estado (LISTO / FALTA / candado); abajo, una barra fija con
 * la receta seleccionada: materiales tengo/necesito y Fabricar (o candado).
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

  readonly KINDS: { key: WorkbenchKind; icon: string; label: string }[] = [
    { key: 'tool',   icon: 'construct', label: 'WORKBENCH.TAB_TOOLS' },
    { key: 'weapon', icon: 'flash',     label: 'WORKBENCH.TAB_WEAPONS' },
    { key: 'armor',  icon: 'shield',    label: 'WORKBENCH.TAB_ARMOR' },
  ];

  /** Pestaña elegida a mano; sin ella, la de la receta seleccionada por defecto. */
  private kindPicked: WorkbenchKind | null = null;
  /** Receta elegida a mano (por id). */
  private selectedId: string | null = null;

  get recipes(): WorkbenchRecipe[] { return this.wb.recipes; }

  /** Receta por defecto: la que pide la guía, si no la primera desbloqueada, si no la primera. */
  private get defaultRecipe(): WorkbenchRecipe | null {
    const list = this.recipes;
    return list.find(r => this.isGuide(r)) ?? list.find(r => this.wb.isUnlocked(r)) ?? list[0] ?? null;
  }

  /** Pestaña activa: la elegida, o la de la receta por defecto (así abre donde está la guía). */
  get kind(): WorkbenchKind {
    if (this.kindPicked) return this.kindPicked;
    const d = this.defaultRecipe;
    return d ? this.wb.kindOf(d) : 'tool';
  }

  /** Recetas de la pestaña activa. */
  get tabRecipes(): WorkbenchRecipe[] {
    return this.recipes.filter(r => this.wb.kindOf(r) === this.kind);
  }

  /** Seleccionada dentro de la pestaña activa (la elegida, la de la guía o la primera). */
  get selected(): WorkbenchRecipe | null {
    const list = this.tabRecipes;
    return list.find(r => r.id === this.selectedId)
      ?? list.find(r => this.isGuide(r))
      ?? list.find(r => this.wb.isUnlocked(r))
      ?? list[0] ?? null;
  }

  /** ¿Alguna receta de esa pestaña brilla por la guía? (brilla la pestaña si no es la activa) */
  kindHasGuide(k: WorkbenchKind): boolean {
    return this.recipes.some(r => this.wb.kindOf(r) === k && this.isGuide(r) && this.wb.canCraft(r));
  }

  setKind(k: WorkbenchKind): void {
    this.kindPicked = k;
    this.selectedId = null;
  }

  select(r: WorkbenchRecipe): void { this.selectedId = r.id; }

  craft(r: WorkbenchRecipe): void { this.wb.craft(r); }

  /** Estado de la ficha: bloqueada, lista para fabricar o le falta material. */
  status(r: WorkbenchRecipe): 'locked' | 'ready' | 'missing' {
    if (!this.wb.isUnlocked(r)) return 'locked';
    return this.wb.canCraft(r) ? 'ready' : 'missing';
  }

  trackRecipe(_: number, r: WorkbenchRecipe): string { return r.id; }

  /** Guía: la misión en curso pide equipar este resultado y aún no lo tienes → brilla
   *  su ficha y su botón Fabricar (al fabricarlo la guía pasa a la mochila). */
  isGuide(r: WorkbenchRecipe): boolean {
    return this.quests.pendingEquipItems().includes(r.result) && this.wb.have(r.result) === 0;
  }
}
