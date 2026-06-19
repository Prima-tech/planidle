import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SceneManager } from 'src/app/scenes/scene-manager';
import { MobileInput, MOBILE_INPUT_KEY } from 'src/app/scenes/mobile-hud.scene';
import { InteractionService, InteractionContext } from 'src/app/services/interaction.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';

@Component({
  selector: 'app-attack-button',
  templateUrl: './attack-button.component.html',
  styleUrls: ['./attack-button.component.scss'],
  standalone: false,
})
export class AttackButtonComponent implements OnInit, OnDestroy {
  private sceneManager  = inject(SceneManager);
  private interaction   = inject(InteractionService);
  private playerBridge  = inject(PlayerBridgeService);

  pressed  = false;
  context: InteractionContext = 'attack';
  runMode = false;
  private ctxSub: Subscription;
  private runModeSub: Subscription;

  private get input(): MobileInput | null {
    return this.sceneManager.game?.registry.get(MOBILE_INPUT_KEY) ?? null;
  }

  ngOnInit(): void {
    this.ctxSub = this.interaction.context$.subscribe(ctx => this.context = ctx);
    this.runModeSub = this.playerBridge.runMode$.subscribe(v => this.runMode = v);
  }

  onPress(ev: PointerEvent): void {
    ev.preventDefault();
    this.pressed = true;
    // En el Modo Mundo (runner) este botón salta en vez de atacar.
    if (this.runMode) {
      this.playerBridge.requestJump();
      return;
    }
    const input = this.input;
    if (input) input.isAttackHeld = true;
  }

  onRelease(): void {
    if (!this.pressed) return;
    this.pressed = false;
    // En runner, soltar termina el salto variable (deja de impulsar hacia arriba).
    if (this.runMode) {
      this.playerBridge.releaseJump();
      return;
    }
    const input = this.input;
    if (input) input.isAttackHeld = false;
  }

  ngOnDestroy(): void {
    this.onRelease();
    this.ctxSub?.unsubscribe();
    this.runModeSub?.unsubscribe();
  }
}
