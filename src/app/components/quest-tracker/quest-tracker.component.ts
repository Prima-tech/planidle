import { Component, OnInit, inject } from '@angular/core';
import { QuestService } from 'src/app/services/quest.service';
import { PanelStateService } from 'src/app/services/panel-state.service';

/**
 * Rastreador de misiones activas en el HUD (arriba-izquierda, bajo el widget
 * de personaje). Solo muestra qué hay que hacer y el progreso de cada misión
 * fijada. La activación/desactivación se hace desde la pestaña Misiones.
 *
 * Tiene un botón para ocultar/mostrar la lista (el estado se recuerda en sesión
 * vía PanelStateService).
 *
 * Reactivo: `active$` re-emite en cada cambio (incluido el avance de progreso,
 * porque QuestService.notify() se llama en cada baja contabilizada).
 */
@Component({
  selector: 'app-quest-tracker',
  templateUrl: './quest-tracker.component.html',
  styleUrls: ['./quest-tracker.component.scss'],
  standalone: false,
})
export class QuestTrackerComponent implements OnInit {
  quests = inject(QuestService);
  private panelState = inject(PanelStateService);

  collapsed = false;

  ngOnInit(): void {
    this.collapsed = this.panelState.get('quest.trackerHidden', false);
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.panelState.set('quest.trackerHidden', this.collapsed);
  }
}
