import { Enemy } from "src/app/enemy/enemy";
import { ActionConfig, ENEMY_REGISTRY, EnemyTypeConfig } from "src/app/enemy/enemy-config";
import { AnimationService } from "./animation.service";
import { GridControls } from "src/app/physics/gridcontrols";
import { GridDrops } from "src/app/physics/griddrops";
import { GridPhysics } from "src/app/physics/gridphisics";
import { Direction } from "src/app/pnj/interfaces/Direction";
import { Player } from "src/app/pnj/player/player";
import { MapConfig, SpawnConfig, SpawnTracker, MAP_ELITE_THRESHOLD, MAP_OBLIVION_THRESHOLD } from "./map-config";
import { GameRegistry } from "../game-registry";
import { InventoryItem } from "src/app/services/inventory.service";
import { EQUIP_LAYER_REGISTRY } from "src/app/pnj/player/equip-layer-registry";

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
    private sessionKills: Record<string, number> = {};
    private eliteKills = 0;
    private currentMapConfig: MapConfig;
    private reg: GameRegistry;
    private equipSub:  { unsubscribe(): void } | null = null;
    private summonSub: { unsubscribe(): void } | null = null;
    currentMap: any;

      constructor(
       ) {
        super({ key: 'GameScene' });
      }

    preload() {
      this.reg = new GameRegistry(this.game);

      this.load.spritesheet('player', 'assets/sprites/player/character/body/main.png', { frameWidth: 64, frameHeight: 64 });
      this.load.image('sword', 'assets/icon/weapons/sword8.png');
      this.load.spritesheet('drop_coin', 'assets/sprites/resources/coin.png', { frameWidth: 16, frameHeight: 16 });
      this.load.spritesheet('portal', 'assets/sprites/resources/Dimensional_Portal.png', { frameWidth: 32, frameHeight: 32 });

      for (const cfg of Object.values(EQUIP_LAYER_REGISTRY)) {
        if (!this.textures.exists(cfg.key)) {
          this.load.spritesheet(cfg.key, cfg.path, { frameWidth: cfg.frameWidth, frameHeight: cfg.frameHeight });
        }
      }

      const mapCfg = this.reg.world.getCurrentMap();
      this.load.image(mapCfg.tilesetKey, mapCfg.tilesetImage);
      this.load.tilemapTiledJSON(mapCfg.tilemapKey, mapCfg.tilemapJson);

      // Precarga todos los tipos de enemigo (no solo los del mapa actual) para que
      // summon nunca necesite cargas dinámicas que generan 'load' handler violations.
      for (const [type, cfg] of Object.entries(ENEMY_REGISTRY)) {
        const baseType = cfg.spriteType ?? type;
        for (const [action, actionCfg] of Object.entries(cfg.actions) as [string, ActionConfig][]) {
          const key = `${baseType}_${action}`;
          if (!this.textures.exists(key)) {
            this.load.spritesheet(
              key,
              `assets/sprites/enemy/${baseType}/${actionCfg.filename}.png`,
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
      this.sessionKills = {};
      this.eliteKills = 0;
      this.currentMapConfig = this.reg.world.getCurrentMap();
      this.reg.mapStats?.reset();

      // Inmediato: lo mínimo para que el primer frame sea válido
      this.initMap();
      this.initPlayer();
      this.createPhysics();
      this.createGameControls();
      this.initCamera();
      this.cameras.main.fadeIn(500, 0, 0, 0);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.equipSub?.unsubscribe();
        this.summonSub?.unsubscribe();
        this.player?.clearLayers();
      });

      // Diferido: trabajo pesado en el siguiente frame para no bloquear el
      // 'load' handler y evitar las [Violation] warnings.
      this.time.delayedCall(0, () => {
        this.registerEnemyAnimations();
        this.registerDropTextures();
        this.initSpawns();
        this.reg.mapStats?.setTrackers(this.spawnTrackers);
        this.initEnemyAttackListener();
        this.createDrops();
        this.initPortals();
        this.initMapStatsTimers();
        this.initEquipLayers();
        this.initSummonListener();
      });
    }

    override update(_time: number, delta: number) {
      this.gridControls.update();
      this.gridPhysics.update(delta);
      const playerPos = this.player.getPosition();
      this.enemies.forEach(enemy => enemy.update(delta, playerPos));
      this.checkPortals(playerPos);
      this.player.syncLayers();
    }

    private initEquipLayers(): void {
      const equipment = this.reg.equipment;
      if (!equipment) return;
      for (const slot of equipment.slots) {
        this.applyEquipLayer(slot.id, slot.item);
      }
      this.equipSub = equipment.changes$.subscribe(() => {
        for (const slot of this.reg.equipment.slots) {
          this.applyEquipLayer(slot.id, slot.item);
        }
      });
    }

    private applyEquipLayer(slotId: string, item: InventoryItem | null): void {
      if (!item) { this.player.removeLayer(slotId); return; }
      const cfg = EQUIP_LAYER_REGISTRY[item.name];
      if (!cfg || !this.textures.exists(cfg.key)) { this.player.removeLayer(slotId); return; }
      this.player.addLayer(slotId, cfg.key, cfg.depth);
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
      playerSprite.scale = 2;
      this.cameras.main.startFollow(playerSprite);
      this.cameras.main.roundPixels = true;
      const sprites = {
        mainScene: this,
        sprite: playerSprite,
        tilePos: new Phaser.Math.Vector2(6, 6)
      };
      this.reg.playerBridge.setInitialSprites(sprites);
      this.player = this.reg.playerBridge.getPlayer();
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
      for (const cfg of Object.values(ENEMY_REGISTRY)) {
        animService.registerEnemyAnimations(cfg);
      }
    }

    private registerDropTextures(): void {
      if (!this.anims.exists('coin_spin')) {
        this.anims.create({
          key: 'coin_spin',
          frames: this.anims.generateFrameNumbers('drop_coin', { start: 0, end: 3 }),
          frameRate: 8,
          repeat: -1,
        });
      }

      if (!this.textures.exists('drop_potion')) {
        const g = this.add.graphics();
        g.fillStyle(0x7a3b00);
        g.fillRect(5, 0, 6, 4);          // corcho
        g.fillStyle(0xcc55ff);
        g.fillRect(6, 4, 4, 6);          // cuello
        g.fillStyle(0xaa33ff);
        g.fillCircle(8, 17, 7);          // cuerpo base
        g.fillStyle(0xcc55ff, 0.7);
        g.fillCircle(8, 16, 5);          // cuerpo claro
        g.fillStyle(0xffffff, 0.35);
        g.fillCircle(5, 14, 2);          // reflejo
        g.generateTexture('drop_potion', 16, 24);
        g.destroy();
      }
    }

    initPortals() {
      if (!this.anims.exists('portal_spin')) {
        this.anims.create({
          key: 'portal_spin',
          frames: this.anims.generateFrameNumbers('portal', { start: 0, end: 5 }),
          frameRate: 6,
          repeat: -1,
        });
      }

      this.currentMapConfig.portals.forEach(portal => {
        const px = portal.tilePos.x * GameScene.TILE_SIZE + GameScene.TILE_SIZE / 2;
        const py = portal.tilePos.y * GameScene.TILE_SIZE + GameScene.TILE_SIZE / 2;
        const sprite = this.add.sprite(px, py, 'portal');
        sprite.setDepth(1);
        sprite.setScale(3);
        sprite.play('portal_spin');
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
            this.reg.world.setCurrentMap(portal.targetMapId);
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
      this.gridDrops = new GridDrops(this.player, this, this.reg.inventory, this.reg.playerState);
    }

    onGameClick(pointer: Phaser.Input.Pointer) {
      console.log('Clic en:', pointer.worldX, pointer.worldY);
    }


    initEnemyAttackListener() {
      this.events.on('enemyAttackPlayer', ({ damage }: { damage: number }) => {
        this.reg.playerBridge.setAttackToPlayer({ HP: -damage });
        this.flashPlayer();
      });

      this.events.on('enemyDied', ({ type, position }: { type: string, position: Phaser.Math.Vector2 }) => {
        const mapId = this.reg.world.getCurrentMap().id;
        this.reg.kill?.recordKill(mapId, type);

        if (type.endsWith('_oblivion')) return;

        if (type.endsWith('_elite')) {
          this.eliteKills++;
          this.sessionKills[type] = (this.sessionKills[type] ?? 0) + 1;
          this.reg.mapStats?.updateSessionKills(this.sessionKills);
          const threshold = MAP_OBLIVION_THRESHOLD[mapId] ?? 5;
          if (this.eliteKills % threshold === 0) {
            const baseType = type.replace('_elite', '');
            this.spawnSpecial(`${baseType}_oblivion`, position);
          }
          return;
        }

        this.sessionKills[type] = (this.sessionKills[type] ?? 0) + 1;
        this.reg.mapStats?.updateSessionKills(this.sessionKills);
        const threshold = MAP_ELITE_THRESHOLD[mapId] ?? 20;
        if (this.sessionKills[type] % threshold === 0) {
          this.spawnSpecial(`${type}_elite`, position);
        }
      });
    }

    private spawnSpecial(enemyType: string, nearPosition: Phaser.Math.Vector2): void {
      const cfg = ENEMY_REGISTRY[enemyType];
      if (!cfg) { console.warn(`spawnSpecial: "${enemyType}" no está en ENEMY_REGISTRY`); return; }

      const baseTileX = Math.floor(nearPosition.x / GameScene.TILE_SIZE);
      const baseTileY = Math.floor(nearPosition.y / GameScene.TILE_SIZE);
      const tileX     = baseTileX + Phaser.Math.Between(-2, 2);
      const tileY     = baseTileY + Phaser.Math.Between(-2, 2);

      const idleKey = `${cfg.spriteType ?? cfg.type}_idle`;
      const sprite  = this.add.sprite(0, 0, idleKey);
      sprite.setDepth(2);

      const enemy = new Enemy(
        this, sprite,
        new Phaser.Math.Vector2(tileX, tileY),
        this.currentMap,
        cfg,
        'aggressive',
        8,
        () => {
          const idx = this.enemies.indexOf(enemy);
          if (idx !== -1) this.enemies.splice(idx, 1);
        },
      );

      this.enemies.push(enemy);
    }

    private flashPlayer() {
      const sprite = this.player.getSprite();
      sprite.setTint(0xff4444);
      this.time.delayedCall(150, () => sprite.clearTint());
    }

    private initMapStatsTimers() {
      // Actualiza el conteo de enemigos activos cada 500ms
      this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => this.reg.mapStats?.updateActive(this.enemies.map(e => e.type)),
      });

      // Comprueba si hay que spawnear más enemigos (cuando el max sube)
      this.time.addEvent({
        delay: 3000,
        loop: true,
        callback: () => {
          for (const tracker of this.spawnTrackers) {
            while (tracker.count < tracker.config.maxCount) {
              this.spawnEnemy(tracker.config, tracker);
            }
          }
        },
      });
    }

    private initSummonListener(): void {
      this.summonSub = this.reg.summon.request$.subscribe(enemyType => {
        const playerPos = this.player.getPosition();
        const tileX = Math.floor(playerPos.x / GameScene.TILE_SIZE) + 3;
        const tileY = Math.floor(playerPos.y / GameScene.TILE_SIZE);
        this.summonEnemyAt(enemyType, tileX, tileY);
      });
    }

    private summonEnemyAt(enemyType: string, tileX: number, tileY: number): void {
      const cfg = ENEMY_REGISTRY[enemyType];
      if (!cfg) { console.warn(`summon: "${enemyType}" no está en ENEMY_REGISTRY`); return; }

      const baseType = cfg.spriteType ?? cfg.type;
      const idleKey  = `${baseType}_idle`;
      // Todas las texturas y animaciones se precargan en preload() + registerEnemyAnimations(),
      // por lo que no se necesita carga dinámica aquí.
      this.doSummon(cfg, idleKey, tileX, tileY);
    }

    private doSummon(cfg: EnemyTypeConfig, idleKey: string, tileX: number, tileY: number): void {
      const sprite = this.add.sprite(0, 0, idleKey);
      sprite.setDepth(2);

      const enemy = new Enemy(
        this, sprite,
        new Phaser.Math.Vector2(tileX, tileY),
        this.currentMap,
        cfg,
        'aggressive',
        12,
        () => {
          const idx = this.enemies.indexOf(enemy);
          if (idx !== -1) this.enemies.splice(idx, 1);
        },
      );
      this.enemies.push(enemy);
    }

}
