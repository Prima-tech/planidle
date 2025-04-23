import { Component, OnInit } from '@angular/core';
import Phaser from 'phaser';

class GameScene extends Phaser.Scene {
    constructor(config: any) {
        super(config);
    }

    preload() {
      this.load.spritesheet('idle', 'assets/sprites/player1/idle.png', { frameWidth: 64, frameHeight: 64, endFrame: 40 });
    }

    create() {
      const config = {
        key: 'explodeAnimation',
        frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 40, first: 0 }),
        frameRate: 20,
        repeat: -1
    };

      this.anims.create(config);
      this.add.sprite(100, 100, 'idle').play('explodeAnimation');

    }

    override update() {
    }
}

@Component({
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
    standalone: false,
})
export class HomePage implements OnInit {
    phaserGame: Phaser.Game | undefined;
    config: Phaser.Types.Core.GameConfig;

    constructor() {
        this.config = {
            type: Phaser.AUTO,
            width: 300,
            height: 300,
            physics: {
                default: 'arcade'
            },
            parent: 'game',
            scene: GameScene
        };
    }

    ngOnInit(): void {
        this.phaserGame = new Phaser.Game(this.config);
    }
}