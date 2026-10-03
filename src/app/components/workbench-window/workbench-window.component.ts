import { Component, inject } from '@angular/core';
import { WorkbenchService, WorkbenchRecipe } from 'src/app/services/workbench.service';
import { QuestService } from 'src/app/services/quest.service';

/**
 * Ventana de la MESA DE TRABAJO (se abre a la izquierda al pulsar/activar la mesa
 * construida, junto al inventario a la derecha, igual que la forja). Lista las
 * recetas (WORKBENCH_RECIPES): coste en materiales y botón de fabricar; las aún no
 * desbloqueadas se ven con candado.
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

  get recipes(): WorkbenchRecipe[] { return this.wb.recipes; }

  craft(r: WorkbenchRecipe): void { this.wb.craft(r); }

  /** Guía: la misión en curso pide equipar este resultado y aún no lo tienes → brilla
   *  su botón Fabricar (al fabricarlo la guía pasa a la mochila). */
  isGuide(r: WorkbenchRecipe): boolean {
    return r.result === this.quests.pendingEquipItem() && this.wb.have(r.result) === 0;
  }
}
