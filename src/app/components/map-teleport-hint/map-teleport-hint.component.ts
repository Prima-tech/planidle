import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';

/**
 * Icono de teletransporte del Modo Mundo (arriba-derecha). Aparece al pasar por la
 * entrada de un mapa YA desbloqueado (la WorldRunScene emite `mapEntranceHint$`),
 * se queda visible 10 s y debajo muestra el mapa destino. Al pulsarlo viaja a ese
 * mapa (mismo camino que el modal: `requestEnterMap` → la escena arranca GameScene).
 *
 * Phaser corre fuera de la zona de Angular, así que el estado se actualiza dentro de
 * `ngZone.run` para que la detección de cambios lo pinte (y el setTimeout de ocultar
 * dispare CD al expirar).
 */
const HINT_VISIBLE_MS = 10_000;

@Component({
  selector: 'app-map-teleport-hint',
  templateUrl: './map-teleport-hint.component.html',
  styleUrls: ['./map-teleport-hint.component.scss'],
  standalone: false,
})
export class MapTeleportHintComponent implements OnInit, OnDestroy {
  private playerBridge = inject(PlayerBridgeService);
  private ngZone = inject(NgZone);

  mapId: string | null = null;

  private hintSub?: Subscription;
  private runModeSub?: Subscription;
  private hideTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.hintSub = this.playerBridge.mapEntranceHint$.subscribe(mapId => {
      this.ngZone.run(() => this.show(mapId));
    });
    // Si se sale del Modo Mundo (p.ej. al teletransportarse), oculta el icono.
    this.runModeSub = this.playerBridge.runMode$.subscribe(active => {
      if (!active) this.ngZone.run(() => this.hide());
    });
  }

  ngOnDestroy(): void {
    this.hintSub?.unsubscribe();
    this.runModeSub?.unsubscribe();
    clearTimeout(this.hideTimer);
  }

  enter(): void {
    if (!this.mapId) return;
    this.playerBridge.requestEnterMap(this.mapId);
    this.hide();
  }

  private show(mapId: string): void {
    this.mapId = mapId;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.ngZone.run(() => this.hide()), HINT_VISIBLE_MS);
  }

  private hide(): void {
    this.mapId = null;
    clearTimeout(this.hideTimer);
  }
}
