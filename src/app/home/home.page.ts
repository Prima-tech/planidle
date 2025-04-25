import { Component, OnInit } from '@angular/core';
import Phaser from 'phaser';
import { FakeApiService } from '../services/fakeapi';
import { ProfileService } from '../services/profile';

class GameScene extends Phaser.Scene {
    constructor(config: any) {
        super(config);
    }

    static readonly TILE_SIZE = 48;

    preload() {
      this.load.spritesheet('idle', 'assets/sprites/player1/idle.png', { frameWidth: 64, frameHeight: 64, endFrame: 40 });
      this.load.image("repeating-background", "assets/delete/default-back.png");
    }

    create() {
      const config = {
        key: 'explodeAnimation',
        frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 40, first: 0 }),
        frameRate: 20,
        repeat: -1
    };

      // You can access the game's config to read the width & height
      const { width, height } = this.sys.game.config;
      // Creating a repeating background sprite
      const bg = this.add.tileSprite(0, 0, <any>width, <any>height, "repeating-background");
      bg.setOrigin(0, 0);


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
    config: Phaser.Types.Core.GameConfig | undefined;

    constructor(
     public service: FakeApiService,
     public profile: ProfileService,
    ) {
      this.loadScene();
    }

    ngOnInit(): void {
        this.phaserGame = new Phaser.Game(this.config);
        this.service.getUserData().subscribe((data) => {
          console.log('soy la data', data)
        })
    }

    loadScene() {
      this.config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: 200,
        backgroundColor: "#222222",
        physics: {
            default: 'arcade'
        },
        parent: 'game',
        scene: GameScene
     };
    }

    test() {
      this.profile.setStatus(10);
    }

}