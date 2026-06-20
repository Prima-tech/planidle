import { Component, inject } from '@angular/core';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { RUN_MILESTONES, RunMilestoneDef } from 'src/app/services/run-milestones';

/**
 * HUD de estadísticas del Modo Mundo (arriba a la derecha, solo en run-mode).
 * Maquetado como la barra de vida: un widget enmarcado (madera + piedra, SIN barras)
 * con los contadores en vivo (estrellas + enemigos abatidos) y un tirador que
 * despliega hacia abajo un panel de HITOS comprables con estrellas (el primero
 * desbloquea el impulso de exploración). El detalle (récord, muertes) vive en el
 * panel de la barra de vida (top-bar), no aquí.
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
  readonly milestones$ = this.playerState.runMilestones$;

  readonly RUN_MILESTONES = RUN_MILESTONES;

  panelOpen = false;
  togglePanel(): void { this.panelOpen = !this.panelOpen; }

  owned(id: string): boolean { return this.playerState.hasRunMilestone(id); }

  /** ¿Se puede comprar ahora? (no comprado + estrellas suficientes). */
  canBuy(m: RunMilestoneDef): boolean {
    return !this.owned(m.id) && this.playerState.snapshot().stars >= m.cost;
  }

  buy(m: RunMilestoneDef): void {
    this.playerState.buyRunMilestone(m.id, m.cost);
  }
}
