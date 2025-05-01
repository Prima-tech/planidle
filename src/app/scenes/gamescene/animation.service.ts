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

  createTopDownRightLeftAnim(status: string, name: string, texture: string, frames: { [key: string]: { start: number; end: number } }) {
    this.createAnimation(name + Direction.UP, texture, frames[Direction.UP].start, frames[Direction.UP].end);
    this.createAnimation(name + Direction.LEFT, texture, frames[Direction.LEFT].start, frames[Direction.LEFT].end);
    this.createAnimation(name + Direction.DOWN, texture, frames[Direction.DOWN].start, frames[Direction.DOWN].end);
    this.createAnimation(name + Direction.RIGHT, texture, frames[Direction.RIGHT].start, frames[Direction.RIGHT].end);
  }

  private createAnimation(name: string, texture: string, startFrame: number, endFrame: number) {
    this.mainScene.anims.create({
      key: name,
      frames: this.mainScene.anims.generateFrameNumbers(texture, {
        start: startFrame,
        end: endFrame,
      }),
      frameRate: 10,
      repeat: -1
    });
  }
    
}