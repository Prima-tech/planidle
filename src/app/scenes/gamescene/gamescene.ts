import { Injectable } from "@angular/core";
import { GridControls } from "src/app/physics/gridcontrols";
import { GridPhysics } from "src/app/physics/gridphisics";
import { Player } from "src/app/pnj/player/player";

@Injectable({
    providedIn: 'root'
  })
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

    override update(_time: number, delta: number) {
      this.gridControls.update();
      this.gridPhysics.update(delta);
    }

    createMap() {

    }

    initPlayer() {
      const playerSprite = this.add.sprite(0, 0, "player");
      playerSprite.setDepth(2);
      playerSprite.scale = 3;
      this.cameras.main.startFollow(playerSprite);
      this.cameras.main.roundPixels = true;
      this.player = new Player(playerSprite, new Phaser.Math.Vector2(6, 6));
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