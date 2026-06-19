import { Component, inject } from '@angular/core';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';

/**
 * Modal de entrada a un mapa (Modo Mundo). Siempre montado en el layout; se
 * muestra la PRIMERA vez que el jugador alcanza la entrada de un mapa recién
 * desbloqueado (la WorldRunScene llama a `promptMapEntrance(mapId, canCancel)`).
 *
 * Variantes (las decide la escena con `canCancel`):
 *   · Primer mapa de todos → solo "Aceptar": entra automáticamente.
 *   · Mapas siguientes      → "Aceptar" (entra) o "Cancelar" (sigue corriendo).
 *
 * "Entrar" hace el viaje (la escena escucha `enterMapRequest$` y arranca
 * GameScene en el mapa nuevo). "Cancelar" reanuda la carrera.
 */
@Component({
  selector: 'app-map-entrance-modal',
  templateUrl: './map-entrance-modal.component.html',
  styleUrls: ['./map-entrance-modal.component.scss'],
  standalone: false,
})
export class MapEntranceModalComponent {
  private playerBridge = inject(PlayerBridgeService);

  readonly pending$ = this.playerBridge.mapEntrancePrompt$;

  enter(mapId: string): void {
    this.playerBridge.requestEnterMap(mapId);
  }

  cancel(): void {
    this.playerBridge.dismissMapEntrance();
  }
}
