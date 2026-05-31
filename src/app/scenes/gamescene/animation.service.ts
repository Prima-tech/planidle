import { Injectable } from "@angular/core";
import { Direction } from "src/app/pnj/interfaces/Direction";
import { ActionConfig, DirectionFrames, EnemyTypeConfig, OmniFrames } from "src/app/enemy/enemy-config";
import Phaser from 'phaser';

@Injectable({ providedIn: 'root' })
export class AnimationService extends Phaser.Scene {
  private mainScene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    super();
    this.mainScene = scene;
  }

  // ── Player ─────────────────────────────────────────────────────────────────

  createTopDownRightLeftAnim(
    status: string, name: string, texture: string,
    frames: { [key: string]: { start: number; end: number } },
    repeat: number = -1, frameRate: number = 10,
  ) {
    this.makeAnim(name + Direction.UP,    texture, frames[Direction.UP].start,    frames[Direction.UP].end,    repeat, frameRate);
    this.makeAnim(name + Direction.LEFT,  texture, frames[Direction.LEFT].start,  frames[Direction.LEFT].end,  repeat, frameRate);
    this.makeAnim(name + Direction.DOWN,  texture, frames[Direction.DOWN].start,  frames[Direction.DOWN].end,  repeat, frameRate);
    this.makeAnim(name + Direction.RIGHT, texture, frames[Direction.RIGHT].start, frames[Direction.RIGHT].end, repeat, frameRate);
  }

  // ── Enemies ────────────────────────────────────────────────────────────────

  /**
   * Registra todas las animaciones de un tipo de enemigo.
   * Llámalo en create() después de cargar los sprites en preload().
   */
  registerEnemyAnimations(config: EnemyTypeConfig): void {
    const DIRS: Direction[] = [Direction.DOWN, Direction.LEFT, Direction.UP, Direction.RIGHT];

    for (const [actionName, action] of Object.entries(config.actions) as [string, ActionConfig][]) {
      const textureKey = this.enemyTextureKey(config.type, actionName);

      if (action.directional) {
        const dirFrames = action.frames as DirectionFrames;
        for (const dir of DIRS) {
          const key = this.enemyAnimKey(config.type, actionName, dir);
          if (!this.mainScene.anims.exists(key)) {
            this.makeAnim(key, textureKey, dirFrames[dir].start, dirFrames[dir].end, action.repeat, action.frameRate);
          }
        }
      } else {
        const key = this.enemyAnimKey(config.type, actionName);
        if (!this.mainScene.anims.exists(key)) {
          const omni = action.frames as OmniFrames;
          this.makeAnim(key, textureKey, omni.start, omni.end, action.repeat, action.frameRate);
        }
      }
    }
  }

  /** Clave de textura: 'orc1_idle' */
  enemyTextureKey(type: string, action: string): string {
    return `${type}_${action}`;
  }

  /** Clave de animación: 'orc1_idle_down' | 'orc1_death' */
  enemyAnimKey(type: string, action: string, dir?: Direction): string {
    if (dir && dir !== Direction.NONE) return `${type}_${action}_${dir}`;
    return `${type}_${action}`;
  }

  // ── Death tween (fallback cuando no hay sprite de muerte) ──────────────────

  createDieAnimation(sprite: Phaser.GameObjects.Sprite, onComplete: () => void): void {
    if (!sprite?.active) { onComplete(); return; }
    try { sprite.anims.stop(); } catch { /* sprite en estado inválido */ }
    sprite.setTint(0xff3333);
    this.mainScene.tweens.add({
      targets: sprite, alpha: 0,
      scaleX: sprite.scaleX * 0.2, scaleY: sprite.scaleY * 0.2,
      angle: Phaser.Math.Between(-25, 25),
      delay: 60, duration: 380, ease: 'Power2',
      onComplete,
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private makeAnim(
    key: string, texture: string, start: number, end: number,
    repeat: number, frameRate: number,
  ): void {
    const frames = this.mainScene.anims.generateFrameNumbers(texture, { start, end });
    if (!frames.length) {
      console.warn(`[AnimationService] "${key}": no frames found in "${texture}" (${start}-${end}). Adjust framesPerDir in enemy-config.ts.`);
      return;
    }
    this.mainScene.anims.create({ key, frames, frameRate, repeat });
  }
}
