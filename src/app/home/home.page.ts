import { Component, OnInit } from '@angular/core';
import Phaser from 'phaser';
import { FakeApiService } from '../services/fakeapi';
import { ProfileService } from '../services/profile';
import { Player } from '../pnj/player/player';
import { GridControls } from '../physics/gridcontrols';
import { GridPhysics } from '../physics/gridphisics';

export class GameScene extends Phaser.Scene {
    constructor(config: any) {
        super(config);
    }

    static readonly TILE_SIZE = 48;

    private gridControls: GridControls;
    private gridPhysics: GridPhysics;
    private player: Player;

    preload() {
      this.load.spritesheet('player', 'assets/sprites/player1/idle.png', { frameWidth: 64, frameHeight: 64, endFrame: 40 });


    }

    create() {
      //this.createMap();
      this.initPlayer();
      this.createPhysics();
    }

    override update() {
    }

    createMap() {

    }

    initPlayer() {
      const playerSprite = this.add.sprite(0, 0, "player");
      playerSprite.setDepth(2);
      playerSprite.scale = 3;
      this.cameras.main.startFollow(playerSprite);
      this.cameras.main.roundPixels = true;
      this.player = new Player(playerSprite, new Phaser.Math.Vector2(0, 0));
    }

    createPhysics() {
      this.gridPhysics = new GridPhysics(this.player);
      this.gridControls = new GridControls(
        this.input,
        this.gridPhysics
      );
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
        title: "Sample",
        render: {
          antialias: false,
        },
        type: Phaser.AUTO,
        scene: GameScene,
        scale: {
          width: window.innerWidth,
          height: 200,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        parent: "game",
        backgroundColor: "#48C4F8",
     };
    }

    test() {
      this.profile.setStatus(10);
    }

}