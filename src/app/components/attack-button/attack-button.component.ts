import { Component, inject, OnDestroy } from '@angular/core';
import { SceneManager } from 'src/app/scenes/scene-manager';
import { MobileInput, MOBILE_INPUT_KEY } from 'src/app/scenes/mobile-hud.scene';

@Component({
  selector: 'app-attack-button',
  templateUrl: './attack-button.component.html',
  styleUrls: ['./attack-button.component.scss'],
  standalone: false,
})
export class AttackButtonComponent implements OnDestroy {
  private sceneManager = inject(SceneManager);

  pressed = false;

  // El objeto MobileInput se recrea en cada create() de GameScene,
  // así que se lee del registry en cada evento en vez de cachearlo.
  private get input(): MobileInput | null {
    return this.sceneManager.game?.registry.get(MOBILE_INPUT_KEY) ?? null;
  }

  onPress(ev: PointerEvent): void {
    ev.preventDefault();
    this.pressed = true;
    const input = this.input;
    if (input) input.isAttackHeld = true;
  }

  onRelease(): void {
    if (!this.pressed) return;
    this.pressed = false;
    const input = this.input;
    if (input) input.isAttackHeld = false;
  }

  ngOnDestroy(): void {
    this.onRelease();
  }
}
