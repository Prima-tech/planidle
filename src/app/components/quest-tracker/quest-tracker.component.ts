import { Component, inject } from '@angular/core';
import { QuestService } from 'src/app/services/quest.service';

/**
 * Rastreador de misiones activas en el HUD (arriba-izquierda, bajo el widget
 * de personaje). Solo muestra qué hay que hacer y el progreso de cada misión
 * fijada. La activación/desactivación se hace desde la pestaña Misiones.
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
export class QuestTrackerComponent {
  quests = inject(QuestService);
}
