import { Injectable } from "@angular/core";
import { GridControls } from "src/app/physics/gridcontrols";
import { GridPhysics } from "src/app/physics/gridphisics";
import { Direction } from "src/app/pnj/interfaces/Direction";
import { Player } from "src/app/pnj/player/player";

@Injectable({
    providedIn: 'root'
  })
export class GameScene extends Phaser.Scene {

    static readonly TILE_SIZE = 48;

    private gridControls: GridControls;
    private gridPhysics: GridPhysics;
    private player: Player;
    private spaceKey: Phaser.Input.Keyboard.Key;
    currentMap: any;

    preload() {
      //this.load.spritesheet('player', 'assets/sprites/player1/characters.png', { frameWidth: 26, frameHeight: 36});

      this.load.spritesheet('player', 'assets/sprites/player/character/body/tanned.png', { frameWidth: 64, frameHeight: 64});

      this.load.image("tiles", "assets/tilemaps/test/cloud_tileset.png");
      this.load.tilemapTiledJSON("cloud-city-map", "assets/tilemaps/test/cloud_city.json");
    }

    create() {
      this.initMap();
      this.initPlayer();
      this.createPhysics();
      this.initPlayerAnimation();
      this.cameras.main.setZoom(0.4);
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.onGameClick(pointer);
      });
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.spaceKey.on('down', () => {
        this.playerAttack();
      });
    }
    onGameClick(pointer: Phaser.Input.Pointer) {
      console.log('Clic en:', pointer.worldX, pointer.worldY);
      // Aquí va tu lógica
    }

    initPlayerAnimation()  {
      this.createPlayerAnimation(Direction.UP, 104, 112);
      this.createPlayerAnimation(Direction.RIGHT, 143, 150);
      this.createPlayerAnimation(Direction.DOWN, 130, 138);
      this.createPlayerAnimation(Direction.LEFT, 117, 125);
    }

    private createPlayerAnimation(
        name: string,
        startFrame: number,
        endFrame: number
      ) {
        this.anims.create({
          key: name,
          frames: this.anims.generateFrameNumbers("player", {
            start: startFrame,
            end: endFrame,
          }),
          frameRate: 10,
          repeat: -1
        });
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
      this.currentMap = this.make.tilemap({ key: "cloud-city-map" });
      this.currentMap.addTilesetImage("Cloud City", "tiles");
      for (let i = 0; i < this.currentMap.layers.length; i++) {
        const layer = this.currentMap
          .createLayer(i, "Cloud City", 0, 0)
        layer.setDepth(i);
        layer.scale = 3;
      }
    }

    createPhysics() {
      this.gridPhysics = new GridPhysics(this.player, this.currentMap);
      this.gridControls = new GridControls(
        this.input,
        this.gridPhysics
      );
    }

    private playerAttack() {
      console.log('Player attacked!');
      // Aquí puedes agregar la lógica del ataque, como animaciones o daño.
    }
    
}