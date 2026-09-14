import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { QuestDef, QuestService } from 'src/app/services/quest.service';
import { PanelStateService } from 'src/app/services/panel-state.service';
import { InventoryService } from 'src/app/services/inventory.service';

/**
 * Rastreador de misiones activas en el HUD (arriba-izquierda, bajo el widget
 * de personaje). Solo muestra qué hay que hacer y el progreso de cada misión
 * fijada. La activación/desactivación se hace desde la pestaña Misiones.
 *
 * Tiene un botón para ocultar/mostrar la lista (el estado se recuerda en sesión
 * vía PanelStateService).
 *
 * Reactivo: `active$` re-emite en cada cambio (incluido el avance de progreso,
 * porque QuestService.notify() se llama en cada baja contabilizada). Además
 * escucha el inventario (`changes$`) para refrescar los contadores tengo/necesito
 * de las misiones de recogida (collect) al recoger materiales: como esos drops
 * ocurren en Phaser (fuera de la zona de Angular), reentramos en NgZone.
 */
@Component({
  selector: 'app-quest-tracker',
  templateUrl: './quest-tracker.component.html',
  styleUrls: ['./quest-tracker.component.scss'],
  standalone: false,
})
export class QuestTrackerComponent implements OnInit, OnDestroy {
  quests = inject(QuestService);
  private panelState = inject(PanelStateService);
  private inventory = inject(InventoryService);
  private zone = inject(NgZone);

  collapsed = false;
  private invSub?: Subscription;

  ngOnInit(): void {
    this.collapsed = this.panelState.get('quest.trackerHidden', false);
    // Refresca los contadores de material al cambiar el inventario (recoger piedra/madera).
    this.invSub = this.inventory.changes$.subscribe(() => this.zone.run(() => {}));
  }

  ngOnDestroy(): void {
    this.invSub?.unsubscribe();
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.panelState.set('quest.trackerHidden', this.collapsed);
  }

  /** Materiales a recoger de una misión de recogida (vacío si no es de ese tipo). */
  collectItems(q: QuestDef): { name: string; qty: number }[] {
    return q.objective.type === 'collect' ? q.objective.items : [];
  }

  /** Cuánto tiene el jugador de un material (por nombre) en el inventario. */
  have(name: string): number {
    return this.inventory.countByName(name);
  }
}
