import { Component, inject } from '@angular/core';
import { PlayerStateService } from 'src/app/services/player-state.service';

/**
 * HUD de estadísticas del Modo Mundo (arriba a la derecha, solo en run-mode).
 * Maquetado como la barra de vida: un widget enmarcado (madera + piedra, SIN barras)
 * con los contadores en vivo (estrellas + enemigos abatidos) y un tirador que
 * despliega hacia abajo un panel reservado para futuras cosas (de momento vacío).
 * El detalle de la expedición (récord de distancia, muertes) vive en el panel de la
 * barra de vida (top-bar), no aquí.
 */
@Component({
  selector: 'app-run-stats',
  templateUrl: './run-stats.component.html',
  styleUrls: ['./run-stats.component.scss'],
  standalone: false,
})
export class RunStatsComponent {
  private playerState = inject(PlayerStateService);

  readonly stars$ = this.playerState.stars$;
  readonly kills$ = this.playerState.currentKills$;   // enemigos de la run actual (se reinicia)

  panelOpen = false;
  togglePanel(): void { this.panelOpen = !this.panelOpen; }
}
