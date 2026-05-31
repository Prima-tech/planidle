import { Injectable } from "@angular/core";
import { Direction } from "src/app/pnj/interfaces/Direction";
import Phaser from 'phaser';

@Injectable({
    providedIn: 'root'
  })
export class AnimationService extends Phaser.Scene {
  private mainScene: Phaser.Scene;
  constructor(scene: Phaser.Scene) {
    super();
    this.mainScene = scene;
  }

  createTopDownRightLeftAnim(status: string, name: string, texture: string, frames: { [key: string]: { start: number; end: number } }, repeat: number = -1, frameRate: number = 10) {
    this.createAnimation(name + Direction.UP, texture, frames[Direction.UP].start, frames[Direction.UP].end, repeat, frameRate);
    this.createAnimation(name + Direction.LEFT, texture, frames[Direction.LEFT].start, frames[Direction.LEFT].end, repeat, frameRate);
    this.createAnimation(name + Direction.DOWN, texture, frames[Direction.DOWN].start, frames[Direction.DOWN].end, repeat, frameRate);
    this.createAnimation(name + Direction.RIGHT, texture, frames[Direction.RIGHT].start, frames[Direction.RIGHT].end, repeat, frameRate);        
  }

  createDieAnimation(sprite: Phaser.GameObjects.Sprite, onComplete: () => void): void {
    sprite.anims.stop();
    sprite.setTint(0xff3333);
    this.mainScene.tweens.add({
      targets:  sprite,
      alpha:    0,
      scaleX:   sprite.scaleX * 0.2,
      scaleY:   sprite.scaleY * 0.2,
      angle:    Phaser.Math.Between(-25, 25),
      delay:    60,
      duration: 380,
      ease:     'Power2',
      onComplete,
    });
  }

  private createAnimation(name: string, texture: string, startFrame: number, endFrame: number, repeat: number = -1, frameRate: number = 10) {
    this.mainScene.anims.create({
      key: name,
      frames: this.mainScene.anims.generateFrameNumbers(texture, {
        start: startFrame,
        end: endFrame,
      }),
      frameRate: frameRate,
      repeat: repeat
    });
  }
    
}