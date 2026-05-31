import { Injectable } from "@angular/core";
import { Enemy } from "src/app/enemy/enemy";
import { GridControls } from "src/app/physics/gridcontrols";
import { GridDrops } from "src/app/physics/griddrops";
import { GridPhysics } from "src/app/physics/gridphisics";
import { Direction } from "src/app/pnj/interfaces/Direction";
import { Player } from "src/app/pnj/player/player";
import { MapConfig } from "./map-config";

@Injectable({
    providedIn: 'root'
  })
export class GameScene extends Phaser.Scene {

    static readonly TILE_SIZE = 48;
    private gridControls: GridControls;
    private gridPhysics: GridPhysics;
    private gridDrops: GridDrops;
    private player: Player;
    private enemies: Enemy[] = [];
    private spaceKey: Phaser.Input.Keyboard.Key;
    private mapNameText: Phaser.GameObjects.Text;
    private portalCooldown = false;
    private currentMapConfig: MapConfig;
    asgardService: any;
    worldService: any;
    currentMap: any;

      constructor(
       ) {
        super({ key: 'GameScene' });
      }

    preload() {
      this.asgardService = this.game.registry.get('asgardService');
      this.worldService = this.game.registry.get('worldService');
      this.load.spritesheet('player', 'assets/sprites/player/character/body/main.png', { frameWidth: 64, frameHeight: 64});
      this.load.spritesheet('enemyTexture', 'assets/sprites/enemy/orc1/orc1_idle_full.png', { frameWidth: 64, frameHeight: 64 });
      this.load.image('sword', 'assets/icon/weapons/sword8.png');
      this.load.image("tiles", "assets/tilemaps/test/cloud_tileset.png");
      this.load.tilemapTiledJSON("cloud-city-map", "assets/tilemaps/test/cloud_city.json");
    }

    create() {
      this.enemies = [];
      this.portalCooldown = false;
      this.currentMapConfig = this.worldService.getCurrentMap();
      this.initMap();
      this.initPlayer();
      this.createPhysics();
      this.initEnemies();
      this.createGameControls();
      this.initCamera();
      this.createDrops();
      this.initPortals();
      this.initMapNameText();
      this.cameras.main.fadeIn(500, 0, 0, 0);
    }

    override update(_time: number, delta: number) {
      this.gridControls.update();
      this.gridPhysics.update(delta);
      const playerPos = this.player.getPosition();
      this.enemies.forEach(enemy => enemy.update(delta, playerPos));
      this.checkPortals(playerPos);
    }

    initMap() {
      this.currentMap = this.make.tilemap({ key: "cloud-city-map" });
      this.currentMap.addTilesetImage("Cloud City", "tiles");
      for (let i = 0; i < this.currentMap.layers.length; i++) {
        const layer = this.currentMap.createLayer(i, "Cloud City", 0, 0);
        layer.setDepth(i);
        layer.scale = 3;
      }
    }

    initPlayer() {
      const playerSprite = this.physics.add.sprite(0, 0, "player");
      playerSprite.setDepth(2);
      playerSprite.scale = 3;
      this.cameras.main.startFollow(playerSprite);
      this.cameras.main.roundPixels = true;
      const sprites = {
        mainScene: this,
        sprite: playerSprite,
        tilePos: new Phaser.Math.Vector2(6, 6)
      };
      this.asgardService.setInitialSprites(sprites);
      this.player = this.asgardService.getPlayer();
    }

    initEnemies() {
      this.currentMapConfig.enemies.forEach(spawn => {
        const enemySprite = this.add.sprite(0, 0, "enemyTexture");
        enemySprite.setDepth(2);
        enemySprite.scale = 3;
        this.enemies.push(
          new Enemy(this, enemySprite, new Phaser.Math.Vector2(spawn.tilePos.x, spawn.tilePos.y), this.currentMap)
        );
      });
    }

    initPortals() {
      const gfx = this.add.graphics();
      gfx.setDepth(3);
      this.currentMapConfig.portals.forEach(portal => {
        const px = portal.tilePos.x * GameScene.TILE_SIZE;
        const py = portal.tilePos.y * GameScene.TILE_SIZE;
        gfx.fillStyle(0x00ffff, 0.45);
        gfx.fillRect(px, py, GameScene.TILE_SIZE, GameScene.TILE_SIZE);
        gfx.lineStyle(2, 0xffffff, 0.9);
        gfx.strokeRect(px, py, GameScene.TILE_SIZE, GameScene.TILE_SIZE);
      });
    }

    initMapNameText() {
      const { width, height } = this.scale;
      this.mapNameText = this.add.text(width - 16, height - 16, this.currentMapConfig.name, {
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
        fontFamily: 'monospace'
      })
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(10);
    }

    checkPortals(playerPos: Phaser.Math.Vector2) {
      if (this.portalCooldown) return;
      const tileX = Math.floor(playerPos.x / GameScene.TILE_SIZE);
      const tileY = Math.floor((playerPos.y - GameScene.TILE_SIZE / 2) / GameScene.TILE_SIZE);

      for (const portal of this.currentMapConfig.portals) {
        if (tileX === portal.tilePos.x && tileY === portal.tilePos.y) {
          this.portalCooldown = true;
          this.cameras.main.fadeOut(500, 0, 0, 0);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.worldService.setCurrentMap(portal.targetMapId);
            this.scene.restart();
          });
          break;
        }
      }
    }

    initCamera() {
      this.cameras.main.setZoom(0.4);
    }

    createGameControls() {
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.onGameClick(pointer);
      });

      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.spaceKey.on('down', () => {
        this.player.playerAttack();
        this.gridPhysics.attackEnemy();
      });
    }

    createPhysics() {
      this.gridPhysics = new GridPhysics(this.player, this.currentMap, this.enemies);
      this.gridControls = new GridControls(
        this.input,
        this.gridPhysics
      );
    }

    createDrops() {
      const inventoryService = this.game.registry.get('inventoryService');
      this.gridDrops = new GridDrops(this.player, this, inventoryService);
    }

    onGameClick(pointer: Phaser.Input.Pointer) {
      console.log('Clic en:', pointer.worldX, pointer.worldY);
    }

    private onItemCollected(item: Phaser.GameObjects.Image) {
      console.log("Item collected!");
      item.destroy();
      this.events.emit('itemCollected', item);
    }

}
