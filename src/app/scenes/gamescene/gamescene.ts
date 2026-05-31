import { Injectable } from "@angular/core";
import { Enemy } from "src/app/enemy/enemy";
import { ActionConfig, ENEMY_REGISTRY } from "src/app/enemy/enemy-config";
import { AnimationService } from "./animation.service";
import { GridControls } from "src/app/physics/gridcontrols";
import { GridDrops } from "src/app/physics/griddrops";
import { GridPhysics } from "src/app/physics/gridphisics";
import { Direction } from "src/app/pnj/interfaces/Direction";
import { Player } from "src/app/pnj/player/player";
import { MapConfig, SpawnConfig } from "./map-config";

interface SpawnTracker {
  config: SpawnConfig;
  count: number;
}

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
    private spawnTrackers: SpawnTracker[] = [];
    private spaceKey: Phaser.Input.Keyboard.Key;
    private portalCooldown = false;
    private currentMapConfig: MapConfig;
    asgardService: any;
    worldService: any;
    killService: any;
    currentMap: any;

      constructor(
       ) {
        super({ key: 'GameScene' });
      }

    preload() {
      this.asgardService = this.game.registry.get('asgardService');
      this.worldService  = this.game.registry.get('worldService');
      this.killService   = this.game.registry.get('killService');

      this.load.spritesheet('player', 'assets/sprites/player/character/body/main.png', { frameWidth: 64, frameHeight: 64 });
      this.load.image('sword', 'assets/icon/weapons/sword8.png');

      const mapCfg = this.worldService.getCurrentMap();
      this.load.image(mapCfg.tilesetKey, mapCfg.tilesetImage);
      this.load.tilemapTiledJSON(mapCfg.tilemapKey, mapCfg.tilemapJson);

      // Carga todos los spritesheets de los tipos de enemigo del mapa actual
      const usedTypes = [...new Set<string>(mapCfg.spawns.map((s: SpawnConfig) => s.enemyType))];
      for (const type of usedTypes) {
        const cfg = ENEMY_REGISTRY[type];
        if (!cfg) { console.warn(`Enemy type "${type}" not found in ENEMY_REGISTRY`); continue; }
        for (const [action, actionCfg] of Object.entries(cfg.actions) as [string, ActionConfig][]) {
          const key = `${type}_${action}`;
          if (!this.textures.exists(key)) {
            this.load.spritesheet(
              key,
              `assets/sprites/enemy/${type}/${actionCfg.filename}.png`,
              { frameWidth: actionCfg.frameWidth, frameHeight: actionCfg.frameHeight },
            );
          }
        }
      }
    }

    create() {
      this.enemies = [];
      this.spawnTrackers = [];
      this.portalCooldown = false;
      this.currentMapConfig = this.worldService.getCurrentMap();
      this.initMap();
      this.initPlayer();
      this.registerEnemyAnimations();
      this.createPhysics();
      this.initSpawns();
      this.initEnemyAttackListener();
      this.createGameControls();
      this.initCamera();
      this.createDrops();
      this.initPortals();
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
      const cfg = this.currentMapConfig;
      this.currentMap = this.make.tilemap({ key: cfg.tilemapKey });
      this.currentMap.addTilesetImage(cfg.tilesetName, cfg.tilesetKey);
      for (let i = 0; i < this.currentMap.layers.length; i++) {
        const layer = this.currentMap.createLayer(i, cfg.tilesetName, 0, 0);
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

    initSpawns() {
      const gfx = this.add.graphics().setDepth(3);

      for (const cfg of this.currentMapConfig.spawns) {
        // Dibuja el área de spawn (cuadrado pequeño, solo borde)
        const px = cfg.zone.tileX * GameScene.TILE_SIZE;
        const py = cfg.zone.tileY * GameScene.TILE_SIZE;
        const pw = cfg.zone.width  * GameScene.TILE_SIZE;
        const ph = cfg.zone.height * GameScene.TILE_SIZE;
        gfx.lineStyle(2, 0xff4444, 0.5);
        gfx.strokeRect(px, py, pw, ph);

        const tracker: SpawnTracker = { config: cfg, count: 0 };
        this.spawnTrackers.push(tracker);

        // Spawna los enemigos escalonados (uno cada 2s) para que no aparezcan todos a la vez
        for (let i = 0; i < cfg.maxCount; i++) {
          this.time.delayedCall(i * 2000, () => this.spawnEnemy(cfg, tracker));
        }
      }
    }

    private spawnEnemy(cfg: SpawnConfig, tracker: SpawnTracker) {
      if (tracker.count >= cfg.maxCount) return;

      const enemyCfg = ENEMY_REGISTRY[cfg.enemyType];
      if (!enemyCfg) { console.warn(`Enemy type "${cfg.enemyType}" not in ENEMY_REGISTRY`); return; }

      const tileX = Phaser.Math.Between(cfg.zone.tileX, cfg.zone.tileX + cfg.zone.width  - 1);
      const tileY = Phaser.Math.Between(cfg.zone.tileY, cfg.zone.tileY + cfg.zone.height - 1);

      // Sprite inicial con la textura idle del tipo de enemigo
      const idleKey = `${cfg.enemyType}_idle`;
      const sprite  = this.add.sprite(0, 0, idleKey);
      sprite.setDepth(2);

      const enemy = new Enemy(
        this, sprite,
        new Phaser.Math.Vector2(tileX, tileY),
        this.currentMap,
        enemyCfg,
        cfg.behavior,
        cfg.visionRadius,
        () => {
          // Elimina del array sin reasignar (GridPhysics mantiene la referencia)
          const idx = this.enemies.indexOf(enemy);
          if (idx !== -1) this.enemies.splice(idx, 1);
          tracker.count--;
          // Respawn tras 3 segundos
          this.time.delayedCall(3000, () => this.spawnEnemy(cfg, tracker));
        }
      );

      this.enemies.push(enemy);
      tracker.count++;
    }

    private registerEnemyAnimations(): void {
      const animService = new AnimationService(this);
      const usedTypes = [...new Set(this.currentMapConfig.spawns.map(s => s.enemyType))];
      for (const type of usedTypes) {
        const cfg = ENEMY_REGISTRY[type];
        if (cfg) animService.registerEnemyAnimations(cfg);
      }
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
      const playerStateService = this.game.registry.get('playerStateService');
      this.gridDrops = new GridDrops(this.player, this, inventoryService, playerStateService);
    }

    onGameClick(pointer: Phaser.Input.Pointer) {
      console.log('Clic en:', pointer.worldX, pointer.worldY);
    }

    private onItemCollected(item: Phaser.GameObjects.Image) {
      console.log("Item collected!");
      item.destroy();
      this.events.emit('itemCollected', item);
    }

    initEnemyAttackListener() {
      this.events.on('enemyAttackPlayer', ({ damage }: { damage: number }) => {
        this.asgardService.setAttackToPlayer({ HP: -damage });
        this.flashPlayer();
      });

      this.events.on('enemyDied', ({ type }: { type: string }) => {
        const mapId = this.worldService.getCurrentMap().id;
        this.killService?.recordKill(mapId, type);
      });
    }

    private flashPlayer() {
      const sprite = this.player.getSprite();
      sprite.setTint(0xff4444);
      this.time.delayedCall(150, () => sprite.clearTint());
    }

}
