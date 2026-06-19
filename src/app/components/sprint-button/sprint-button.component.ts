import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';

/**
 * Botón de SPRINT del Modo Mundo: al lado del de saltar y con el mismo estilo
 * "esfera" que las habilidades. Da un empujón de velocidad (pico inicial muy
 * grande que decelera) y luego entra en cooldown, que se pinta como un aro igual
 * que el de las habilidades. La lógica/velocidad vive en PlayerBridgeService.
 */
@Component({
  selector: 'app-sprint-button',
  templateUrl: './sprint-button.component.html',
  styleUrls: ['./sprint-button.component.scss'],
  standalone: false,
})
export class SprintButtonComponent implements OnInit, OnDestroy {
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

  get onCooldown(): boolean { return this.playerBridge.sprintOnCooldown; }

  onPress(ev: PointerEvent): void {
    ev.preventDefault();
    if (this.onCooldown) return;
    this.pressed = true;
    if (this.playerBridge.activateSprint()) this.startCdLoop();
  }

  onRelease(): void { this.pressed = false; }

  /** Bucle ligero que refresca el aro de cooldown; se autoapaga al quedar listo. */
  private startCdLoop(): void {
    if (this.cdInterval) return;
    this.cdInterval = setInterval(() => {
      const ratio = this.playerBridge.sprintCooldownRatio;   // 1 recién usado → 0 listo
      this.cdAngle = ratio * 360;
      const secs = this.playerBridge.sprintCooldownSeconds;
      this.cdSeconds = secs > 0 ? String(secs) : '';
      if (ratio <= 0) { clearInterval(this.cdInterval!); this.cdInterval = null; }
    }, 50);
  }
}
