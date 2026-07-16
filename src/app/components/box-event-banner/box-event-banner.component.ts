import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { BoxEventHint, PlayerBridgeService } from 'src/app/services/player-bridge.service';

/**
 * Banner del Modo Mundo (arriba-centro): al golpear una caja "?" desde abajo, la
 * WorldRunScene emite `boxEventHint$` con la CLAVE i18n del evento sorteado; aquí se
 * muestra su nombre unos segundos y se desvanece. Solo el nombre del evento.
 *
 * Phaser corre fuera de la zona de Angular, así que el estado se actualiza dentro de
 * `ngZone.run` para que la detección de cambios lo pinte (y el setTimeout de ocultar
 * dispare CD al expirar).
 */
const BANNER_VISIBLE_MS = 2600;   // cuánto se queda visible antes de desvanecerse
const BANNER_FADE_MS = 300;       // margen para que se vea el fade-out antes de desmontar

@Component({
  selector: 'app-box-event-banner',
  templateUrl: './box-event-banner.component.html',
  styleUrls: ['./box-event-banner.component.scss'],
  standalone: false,
})
export class BoxEventBannerComponent implements OnInit, OnDestroy {
  private playerBridge = inject(PlayerBridgeService);
  private ngZone = inject(NgZone);

  /** Clave i18n del evento montado (null = desmontado). `visible` controla el fade. */
  nameKey: string | null = null;
  /** Estrellas otorgadas por el evento (si las da al instante), para pintar debajo. */
  amount: number | null = null;
  visible = false;

  private eventSub?: Subscription;
  private runModeSub?: Subscription;
  private hideTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.eventSub = this.playerBridge.boxEventHint$.subscribe(hint => {
      this.ngZone.run(() => this.reveal(hint));
    });
    // Al salir del Modo Mundo, ocultar de inmediato.
    this.runModeSub = this.playerBridge.runMode$.subscribe(active => {
      if (!active) this.ngZone.run(() => this.hide());
    });
  }

  ngOnDestroy(): void {
    this.eventSub?.unsubscribe();
    this.runModeSub?.unsubscribe();
    clearTimeout(this.hideTimer);
  }

  private reveal(hint: BoxEventHint): void {
    this.nameKey = hint.nameKey;
    this.amount = hint.amount ?? null;
    this.visible = true;   // el CSS anima la entrada
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.ngZone.run(() => this.hide()), BANNER_VISIBLE_MS);
  }

  private hide(): void {
    this.visible = false;   // dispara el fade-out (transición CSS)
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.ngZone.run(() => { this.nameKey = null; }), BANNER_FADE_MS);
  }
}
