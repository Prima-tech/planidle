import { Injectable } from "@angular/core";
import { Enemy } from "src/app/enemy/enemy";
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
    private enemy: Enemy;
    private spaceKey: Phaser.Input.Keyboard.Key;
    currentMap: any;

    preload() {
      this.load.spritesheet('player', 'assets/sprites/player/character/body/tanned.png', { frameWidth: 64, frameHeight: 64});
      this.load.spritesheet('enemyTexture', 'assets/sprites/enemy/orc1/orc1_idle_full.png', { frameWidth: 64, frameHeight: 64 }); 
      this.load.image("tiles", "assets/tilemaps/test/cloud_tileset.png");
      this.load.tilemapTiledJSON("cloud-city-map", "assets/tilemaps/test/cloud_city.json");
    }

    create() {
      this.initMap();
      this.initPlayer();
      this.createPhysics();
      this.initEnemies();
      this.createGameControls();
      this.initCamera();

    }

    initCamera() {
      this.cameras.main.setZoom(0.4);
    }

    createGameControls() {
      //CLICK MAP
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.onGameClick(pointer);
      });
      
      // ESPACIO
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.spaceKey.on('down', () => {
        this.player.playerAttack();
      });
    }

    initEnemies() {
      let frames = {
        [Direction.UP]: { start: 0, end: 3 },
        [Direction.LEFT]: { start: 4, end: 7 },
        [Direction.DOWN]: { start: 8, end: 11 },
        [Direction.RIGHT]: { start: 12, end: 15 },      
      }
    //  this.createTopDownRightLeftAnim('IDLE', 'enemy_idle_', 'enemyTexture', frames)
      
      const enemySprite = this.add.sprite(0, 0, "enemyTexture");
      enemySprite.setDepth(2);
      enemySprite.scale = 3;
      this.enemy = new Enemy(enemySprite, new Phaser.Math.Vector2(8, 8));
    }

    override update(_time: number, delta: number) {
      this.gridControls.update();
      this.gridPhysics.update(delta);
    }

    initPlayer() {
      const playerSprite = this.add.sprite(0, 0, "player");
      playerSprite.setDepth(2);
      playerSprite.scale = 3;
      this.cameras.main.startFollow(playerSprite);
      this.cameras.main.roundPixels = true;
      this.player = new Player(this, playerSprite, new Phaser.Math.Vector2(6, 6));
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

    onGameClick(pointer: Phaser.Input.Pointer) {
      console.log('Clic en:', pointer.worldX, pointer.worldY);
      // Aquí va tu lógica
    }


    
}