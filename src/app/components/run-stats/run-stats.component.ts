import { Component, inject } from '@angular/core';
import { PlayerStateService } from 'src/app/services/player-state.service';

/**
 * HUD de estadísticas del Modo Mundo, renderizado en Angular (antes el contador de
 * estrellas vivía en el HUD de Phaser de WorldRunScene). Se muestra arriba a la
 * derecha solo en run-mode (ver layout.component.html) y lee el estado persistido
 * del jugador: estrellas recogidas, enemigos abatidos y mejor distancia.
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
  readonly bestDistance$ = this.playerState.worldBestDistanceM$;
  // Muertes de la expedición actual (se reinician al volver a casa).
  readonly deaths$ = this.playerState.currentDeaths$;
}
