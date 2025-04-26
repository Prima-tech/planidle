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
      this.load.spritesheet('player', 'assets/sprites/player1/characters.png', { frameWidth: 26, frameHeight: 36});

      this.load.image("tiles", "assets/tilemaps/test/cloud_tileset.png");
      this.load.tilemapTiledJSON("cloud-city-map", "assets/tilemaps/test/cloud_city.json");
    }

    create() {
      this.initMap();
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

    initMap() {
      const cloudCityTilemap = this.make.tilemap({ key: "cloud-city-map" });
      cloudCityTilemap.addTilesetImage("Cloud City", "tiles");
      for (let i = 0; i < cloudCityTilemap.layers.length; i++) {
        const layer = cloudCityTilemap
          .createLayer(i, "Cloud City", 0, 0)
        layer.setDepth(i);
        layer.scale = 3;
      }
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

    items = [
      {
        id: 1,
        name: 'sword1',
        type: 'item',
        icon: 'sword1'
      },
      {
        id: 2,
        name: 'sword2',
        type: 'item',
        icon: 'sword2'
      },      {
        id: 3,
        name: 'sword3',
        type: 'item',
        icon: 'sword3'
      },      {
        id: 4,
        name: 'sword4',
        type: 'item',
        icon: 'sword4'
      },  {
        id: 5,
        name: 'sword5',
        type: 'item',
        icon: 'sword5'
      }, {
        id: 6,
        name: 'sword6',
        type: 'item',
        icon: 'sword6'
      }, {
        id: 7,
        name: 'sword7',
        type: 'item',
        icon: 'sword7'
      }, {
        id: 8,
        name: 'sword8',
        type: 'item',
        icon: 'sword8'
      }, {
        id: 9,
        name: 'sword9',
        type: 'item',
        icon: 'sword9'
      }, {
        id: 10,
        name: 'sword10',
        type: 'item',
        icon: 'sword10'
      }]

    

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