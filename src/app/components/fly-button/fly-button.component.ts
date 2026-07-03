import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';

/**
 * Botón de VUELO / boost del Modo Mundo: al lado del de impulso (sprint), con el
 * mismo estilo "esfera". Al pulsarlo el jugador vuela 10 s (gravedad off, controla la
 * altura manteniendo/soltando el salto), va al doble de velocidad y arrasa enemigos
 * al contacto (invulnerable). Luego entra en cooldown, pintado como aro. La
 * lógica/estado vive en PlayerBridgeService; la escena lee flyActive cada frame.
 */
@Component({
  selector: 'app-fly-button',
  templateUrl: './fly-button.component.html',
  styleUrls: ['./fly-button.component.scss'],
  standalone: false,
})
export class FlyButtonComponent implements OnInit, OnDestroy {
  private playerBridge = inject(PlayerBridgeService);

  pressed = false;
  cdAngle = 0;
  cdSeconds = '';

  private cdInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.startCdLoop();
  }

  ngOnDestroy(): void {
    if (this.cdInterval) clearInterval(this.cdInterval);
  }

  get onCooldown(): boolean { return this.playerBridge.flyOnCooldown; }

  onPress(ev: PointerEvent): void {
    ev.preventDefault();
    if (this.onCooldown) return;
    this.pressed = true;
    if (this.playerBridge.activateFly()) this.startCdLoop();
  }

  onRelease(): void { this.pressed = false; }

  /** Bucle ligero que refresca el aro de cooldown; se autoapaga al quedar listo. */
  private startCdLoop(): void {
    if (this.cdInterval) return;
    this.cdInterval = setInterval(() => {
      const ratio = this.playerBridge.flyCooldownRatio;   // 1 recién usado → 0 listo
      this.cdAngle = ratio * 360;
      const secs = this.playerBridge.flyCooldownSeconds;
      this.cdSeconds = secs > 0 ? String(secs) : '';
      if (ratio <= 0) { clearInterval(this.cdInterval!); this.cdInterval = null; }
    }, 50);
  }
}
