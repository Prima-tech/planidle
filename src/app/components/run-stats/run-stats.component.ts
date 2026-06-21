import { Component, EventEmitter, Output, inject } from '@angular/core';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
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
  private playerState  = inject(PlayerStateService);
  private playerBridge = inject(PlayerBridgeService);

  readonly stars$    = this.playerState.stars$;
  readonly distance$ = this.playerBridge.runDistanceM$;   // metros de la carrera actual
  readonly milestones$ = this.playerState.runMilestones$;

  readonly RUN_MILESTONES = RUN_MILESTONES;

  /** Botón de ajustes del widget (en exploración no hay minimap): lo abre el layout. */
  @Output() openSettings = new EventEmitter<void>();

  panelOpen = false;
  togglePanel(): void { this.panelOpen = !this.panelOpen; }

  /** Pestaña activa del panel: objetivos (por comprar) o completos (ya comprados). */
  tab: 'objetivos' | 'completos' = 'objetivos';

  /** Hitos a mostrar según la pestaña: objetivos = no comprados; completos = comprados. */
  forTab(owned: string[]): RunMilestoneDef[] {
    return RUN_MILESTONES.filter(m =>
      this.tab === 'objetivos' ? !owned.includes(m.id) : owned.includes(m.id));
  }

  owned(id: string): boolean { return this.playerState.hasRunMilestone(id); }

  /** ¿Se puede comprar ahora? (no comprado + estrellas suficientes). */
  canBuy(m: RunMilestoneDef): boolean {
    return !this.owned(m.id) && this.playerState.snapshot().stars >= m.cost;
  }

  buy(m: RunMilestoneDef): void {
    this.playerState.buyRunMilestone(m.id, m.cost);
  }
}
