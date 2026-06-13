import { Enemy } from "src/app/enemy/enemy";
import { ActionConfig, ENEMY_REGISTRY, EnemyTypeConfig } from "src/app/enemy/enemy-config";
import { AnimationService } from "./animation.service";
import { GridControls } from "src/app/physics/gridcontrols";
import { GridDrops } from "src/app/physics/griddrops";
import { GridPhysics } from "src/app/physics/gridphisics";
import { MobileInput, MOBILE_INPUT_KEY, MinimapData, MINIMAP_DATA_KEY } from "src/app/scenes/mobile-hud.scene";
import { Direction } from "src/app/pnj/interfaces/Direction";
import { Player } from "src/app/pnj/player/player";
import { MapConfig, SpawnConfig, SpawnTracker, MAP_ELITE_THRESHOLD, MAP_OBLIVION_THRESHOLD } from "./map-config";
import { GameRegistry } from "../game-registry";
import { InventoryItem } from "src/app/services/inventory.service";
import { EQUIP_LAYER_REGISTRY } from "src/app/pnj/player/equip-layer-registry";
import { SKILL_REGISTRY, SkillConfig } from "src/app/services/skill-config";
import { SPHERE_MULT } from "src/app/services/talent.service";
import { NATIVE_DPR } from "./constants";

const SKILL_SPRITE_SOURCES: { key: string; path: string; count: number }[] = [
  { key: 'skill_fire',           path: 'assets/sprites/skills/fire/Fire/fire_',                     count: 6  },
  { key: 'skill_fireball',       path: 'assets/sprites/skills/fire/Fireball/fireball_',              count: 15 },
  { key: 'skill_fire_flower',    path: 'assets/sprites/skills/fire/Fire_flower/fire_flower_',        count: 11 },
  { key: 'skill_fire_hurricane', path: 'assets/sprites/skills/fire/Fire_hurracane/Fire_hurracane',   count: 14 },
  { key: 'skill_fire_pillar',    path: 'assets/sprites/skills/fire/Fire_pillar/fire_pillar_',        count: 8  },
  { key: 'skill_fire_shield',    path: 'assets/sprites/skills/fire/Fire_shield/fire_shield_',        count: 8  },
  { key: 'skill_lava_drop',      path: 'assets/sprites/skills/fire/Lava_drop/lava_drop_',            count: 16 },
  { key: 'skill_lava_paddle',    path: 'assets/sprites/skills/fire/Lava_paddle/lava_padlle_',        count: 10 },
  { key: 'skill_magma_geyser',   path: 'assets/sprites/skills/fire/Magma_geyser/magma_geyser_',     count: 11 },
  { key: 'skill_phoenix',        path: 'assets/sprites/skills/fire/Phoenix/phoenix_',                count: 16 },
  { key: 'skill_small_fire',     path: 'assets/sprites/skills/fire/Small_fire/phoenix_',             count: 6  },
  { key: 'skill_water_geyser',  path: 'assets/sprites/skills/water/Geyser/',                         count: 7  },
  { key: 'skill_ice_crystal',   path: 'assets/sprites/skills/water/Ice_crystal/',                    count: 10 },
  { key: 'skill_ice_spike',     path: 'assets/sprites/skills/water/Ice_spike/',                      count: 12 },
  { key: 'skill_kraken',        path: 'assets/sprites/skills/water/Kraken/',                         count: 19 },
  { key: 'skill_snowflake',     path: 'assets/sprites/skills/water/Snowflake/',                      count: 13 },
  { key: 'skill_waterball',     path: 'assets/sprites/skills/water/Waterball/',                      count: 16 },
  { key: 'skill_water_drop',    path: 'assets/sprites/skills/water/Water_drop/',                     count: 19 },
  { key: 'skill_water_splash',  path: 'assets/sprites/skills/water/Water_and_splash/Splash/',        count: 9  },
  { key: 'skill_circle_smoke',      path: 'assets/sprites/skills/smoker/Circle_smoke/Circle_smoke',           count: 10 },
  { key: 'skill_curved_smoke',      path: 'assets/sprites/skills/smoker/Curved_smoke/Curved_smoke',           count: 24 },
  { key: 'skill_cycled_smoke',      path: 'assets/sprites/skills/smoker/Cycled_smoke/Cycled_smoke',           count: 6  },
  { key: 'skill_cycled_smoke_long', path: 'assets/sprites/skills/smoker/Cycled_smoke_long/Cycled_smoke_long', count: 6  },
  { key: 'skill_falling_smoke',     path: 'assets/sprites/skills/smoker/Falling_smoke/Falling_smoke',        count: 16 },
  { key: 'skill_horisontal_smoke',  path: 'assets/sprites/skills/smoker/Horisontal_smoke/Horisontal_smoke',  count: 12 },
  { key: 'skill_rising_smoke',      path: 'assets/sprites/skills/smoker/Rising_smoke/Rising_smoke',           count: 14 },
  { key: 'skill_smoke_ghost',            path: 'assets/sprites/skills/smoker/Smoke_ghost/Smoke_ghost',                           count: 18 },
  { key: 'skill_circle_explosion',      path: 'assets/sprites/skills/explosion/Circle_explosion/Circle_explosion',             count: 10 },
  { key: 'skill_explosion',             path: 'assets/sprites/skills/explosion/Explosion/Explosion',                           count: 10 },
  { key: 'skill_explosion_blue_circle', path: 'assets/sprites/skills/explosion/Explosion_blue_circle/Explosion_blue_circle',   count: 10 },
  { key: 'skill_explosion_blue_oval',   path: 'assets/sprites/skills/explosion/Explosion_blue_oval/Explosion_blue_oval',       count: 10 },
  { key: 'skill_explosion_gas',         path: 'assets/sprites/skills/explosion/Explosion_gas/Explosion_gas',                   count: 10 },
  { key: 'skill_explosion_gas_circle',  path: 'assets/sprites/skills/explosion/Explosion_gas_circle/Explosion_gas_circle',     count: 10 },
  { key: 'skill_explosion_two_colors',  path: 'assets/sprites/skills/explosion/Explosion_two_colors/Explosion_two_colors',     count: 10 },
];

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
    private lastDamageTime = -Infinity;
    private sessionKills: Record<string, number> = {};
    private eliteKills = 0;
    private currentMapConfig: MapConfig;
    private reg: GameRegistry;
    private animService: AnimationService;
    private equipSub:    { unsubscribe(): void } | null = null;
    private summonSub:   { unsubscribe(): void } | null = null;
    private itemDropSub: { unsubscribe(): void } | null = null;
    private dropToWorldSub: { unsubscribe(): void } | null = null;
    private chestSub:       { unsubscribe(): void } | null = null;
    private collisionTiles: Set<string>                    = new Set();
    private activeChests: { sprite: Phaser.GameObjects.Sprite; col: number; blocked: string[]; opening: boolean; isTownChest?: boolean }[] = [];
    private statsSub:    { unsubscribe(): void } | null = null;
    private magicSub:    { unsubscribe(): void } | null = null;
    private skillSub:    { unsubscribe(): void } | null = null;
    private playerDamage      = 10;
    private playerMagicDamage = 10;
    private mobileInput: MobileInput | null = null;
    private pendingDashMoveDir: Direction | null = null;
    private pendingDashAnimDir: Direction | null = null;
    // Auto-ataque: objetivo fijo + anti-atasco
    private autoTarget: Enemy | null = null;
    private autoStuckMs = 0;
    private autoLastX = 0;
    private autoLastY = 0;
    private autoBlacklist = new Map<Enemy, number>(); // enemigo → time.now hasta el que se ignora
    private autoSkillGapMs = 0; // cuenta atrás hasta el próximo auto-cast permitido
    private autoSkillIdx   = 0; // rotación round-robin entre las skills equipadas
    // Animación de subida de nivel
    private lvlSub: { unsubscribe(): void } | null = null;
    private lastLvl: number | null = null;
    private lvlUpText: Phaser.GameObjects.Text | null = null;
    currentMap: any;

      constructor(
       ) {
        super({ key: 'GameScene' });
      }

    preload() {
      this.reg = new GameRegistry(this.game);

      this.load.spritesheet('player', 'assets/sprites/player/character/body/main.png', { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet('drop_coin', 'assets/sprites/resources/coin.png', { frameWidth: 16, frameHeight: 16 });
      this.load.spritesheet('chests', 'assets/sprites/resources/chests.png', { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet('portal', 'assets/sprites/resources/portal.png', { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet('icons1', 'assets/icon/icons/icons1.png', { frameWidth: 32, frameHeight: 32 });

      // Bolsas (equipo secundario): iconos sueltos usados como sprite del drop al invocar.
      this.load.image('bag_1', 'assets/icon/bags/bag_01.png');
      this.load.image('bag_2', 'assets/icon/bags/bag_02.png');
      this.load.image('bag_3', 'assets/icon/bags/bag_3.png');
      this.load.image('bag_4', 'assets/icon/bags/bag_4.png');

      for (const s of SKILL_SPRITE_SOURCES) {
        for (let i = 1; i <= s.count; i++) {
          const k = `${s.key}_${i}`;
          if (!this.textures.exists(k)) this.load.image(k, `${s.path}${i}.png`);
        }
      }

      for (const cfg of Object.values(EQUIP_LAYER_REGISTRY)) {
        if (cfg.mode === 'anim') {
          for (const sheet of cfg.sheets ?? []) {
            if (!this.textures.exists(sheet.key)) {
              this.load.spritesheet(sheet.key, sheet.path, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
            }
          }
        } else if (cfg.key && !this.textures.exists(cfg.key)) {
          this.load.spritesheet(cfg.key, cfg.path!, { frameWidth: cfg.frameWidth, frameHeight: cfg.frameHeight });
        }
      }

      const mapCfg = this.reg.world.getCurrentMap();
      this.load.image(mapCfg.tilesetKey, mapCfg.tilesetImage);
      for (const ts of mapCfg.extraTilesets ?? []) {
        if (!this.textures.exists(ts.key)) this.load.image(ts.key, ts.image);
      }
      this.load.tilemapTiledJSON(mapCfg.tilemapKey, mapCfg.tilemapJson);

      // Solo carga texturas para los enemigos del mapa actual + variantes elite/oblivion.
      // Las texturas persisten entre reinicios de escena (textures.exists guard),
      // así que cada tipo se carga una sola vez en toda la sesión.
      const spawnTypes = mapCfg.spawns.map((s: { enemyType: string }) => s.enemyType);
      const typesToLoad = new Set<string>();
      for (const base of spawnTypes) {
        typesToLoad.add(base);
        typesToLoad.add(`${base}_elite`);
        typesToLoad.add(`${base}_oblivion`);
      }
      for (const type of typesToLoad) {
        const cfg = ENEMY_REGISTRY[type];
        if (!cfg) continue;
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
      this.autoTarget = null;
      this.autoStuckMs = 0;
      this.autoBlacklist.clear();
      this.currentMapConfig = this.reg.world.getCurrentMap();
      this.animService      = new AnimationService(this);
      this.reg.mapStats?.reset();

      // Inmediato: lo mínimo para que el primer frame sea válido
      this.initMap();
      this.initPlayer();
      this.initCamera();
      this.mobileInput = { direction: Direction.NONE, lastCardinalDir: Direction.DOWN, isAttackHeld: false };
      this.registry.set(MOBILE_INPUT_KEY, this.mobileInput);
      this.registry.set(MINIMAP_DATA_KEY, this.buildMinimapData());
      this.scene.launch('MobileHUDScene');
      this.createPhysics();
      this.createGameControls();
      this.initLevelUpWatcher();
      this.cameras.main.fadeIn(500, 0, 0, 0);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scene.stop('MobileHUDScene');
        this.mobileInput = null;
        this.equipSub?.unsubscribe();
        this.summonSub?.unsubscribe();
        this.itemDropSub?.unsubscribe();
        this.dropToWorldSub?.unsubscribe();
        this.chestSub?.unsubscribe();
        this.activeChests = [];
        this.reg.interaction?.setContext('attack');
        this.statsSub?.unsubscribe();
        this.magicSub?.unsubscribe();
        this.skillSub?.unsubscribe();
        this.player?.clearLayers();
        this.lvlSub?.unsubscribe();
        this.lvlSub = null;
        this.lvlUpText = null;   // el shutdown de la escena ya destruye el texto
        this.events.off('enemyAttackPlayer');
        this.events.off('enemyDied');
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
        this.initItemDropListener();
        this.initPortals();
        this.initMapStatsTimers();
        this.initEquipLayers();
        this.initSummonListener();
        this.initChestListener();
        this.initStatsListener();
        this.registerSkillAnimations();
        this.initSkillListener();
        this.initSkillTargetChecker();
        this.time.delayedCall(600, () => this.reg.playerBridge?.emitSceneReady());
      });
    }

    override update(_time: number, delta: number) {
      this.gridControls.update();

      // Input manual (ataque o movimiento) → pausa la automatización unos segundos
      const auto = this.reg.autoAttack;
      if (this.mobileInput?.isAttackHeld || this.gridControls.hasManualInput()) {
        auto?.pauseAutomation();
      }
      const autoPaused = auto?.isPausedByManual ?? false;
      if (auto?.isEnabled && !autoPaused) this.runAutoAttack(delta);
      if (auto?.skillsEnabled && !autoPaused) this.runAutoSkills(delta);
      this.gridPhysics.update(delta);

      // Detecta si hay un cofre interactuable cerca y cambia el contexto del botón
      const nearChest = this.nearestOpenableChest();
      this.reg.interaction?.setContext(nearChest ? 'chest' : 'attack');

      // Si la ventana de cofre de ciudad está abierta y el jugador se alejó → cerrar
      if (this.reg.summon.townChestIsOpen$.value) {
        const tc  = this.activeChests.find(c => c.isTownChest);
        if (tc) {
          const pos = this.player.getPosition();
          const dx  = tc.sprite.x - pos.x;
          const dy  = tc.sprite.y - pos.y;
          if (dx * dx + dy * dy > GameScene.CHEST_INTERACT_RANGE * GameScene.CHEST_INTERACT_RANGE) {
            this.reg.summon.townChestCloseRequest$.next();
          }
        }
      }

      // Botón de acción: si hay cofre cerca → abrir; si no → golpear
      if (this.mobileInput?.isAttackHeld) {
        if (nearChest) {
          this.openChest(nearChest);
        } else if (!this.player.isAttacking) {
          this.strike();
        }
      }

      const playerPos = this.player.getPosition();
      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].update(delta, playerPos);
      }
      if (this.lvlUpText?.active) {
        this.lvlUpText.setPosition(playerPos.x, playerPos.y - 160);
      }
      this.checkPortals(playerPos);
      this.player.syncLayers();
      this.player.getSprite().setDepth(playerPos.y);
    }

    private runAutoAttack(delta: number): void {
      const pos = this.player.getPosition();

      // Objetivo inválido (muerto o de un mapa anterior) → re-seleccionar
      if (this.autoTarget && (this.autoTarget.isDead || !this.enemies.includes(this.autoTarget))) {
        this.autoTarget = null;
      }
      if (!this.autoTarget) {
        this.autoTarget = this.pickAutoTarget(pos.x, pos.y);
        this.autoStuckMs = 0;
        if (!this.autoTarget) return;
      }

      let target = this.autoTarget;
      let ep = target.getPixelPos();
      let dx = ep.x - pos.x;
      let dy = ep.y - pos.y;
      let distSq = dx * dx + dy * dy;

      // Si el objetivo queda lejos y tienes otro encima, no pases de largo: cambia
      const FAR  = GameScene.TILE_SIZE * 4;
      const NEAR = GameScene.TILE_SIZE * 2.2;
      if (distSq > FAR * FAR) {
        const close = this.pickCloseEnemy(pos.x, pos.y, NEAR);
        if (close && close !== target) {
          this.autoTarget = target = close;
          ep = target.getPixelPos();
          dx = ep.x - pos.x;
          dy = ep.y - pos.y;
          distSq = dx * dx + dy * dy;
          this.autoStuckMs = 0;
        }
      }

      const dist = Math.sqrt(distSq);
      const STOP_RANGE = GameScene.TILE_SIZE * 2;
      const cardinalDir = this.autoVecToCardinal(dx, dy);

      if (dist <= STOP_RANGE) {
        this.autoStuckMs = 0;
        this.player.currentDirection = cardinalDir;
        if (!this.player.isAttacking) {
          this.strike();
        }
        return;
      }

      this.gridPhysics.movePlayer(this.autoVecTo8Dir(dx, dy), cardinalDir);

      // Anti-atasco: si llevamos >1.2s sin avanzar (pared, esquina), descartamos
      // este objetivo unos segundos y probamos con el siguiente
      const movedSq = (pos.x - this.autoLastX) ** 2 + (pos.y - this.autoLastY) ** 2;
      this.autoLastX = pos.x;
      this.autoLastY = pos.y;
      if (movedSq < 0.25) {
        this.autoStuckMs += delta;
        if (this.autoStuckMs > 1200) {
          this.autoBlacklist.set(target, this.time.now + 4000);
          this.autoTarget = null;
          this.autoStuckMs = 0;
        }
      } else {
        this.autoStuckMs = 0;
      }
    }

    // Auto-skills: lanza UNA habilidad por pasada, rotando entre las equipadas
    // (HUD + barra de skills), con una pausa entre casts para que se encadenen
    // con ritmo en vez de dispararse todas a la vez. Mismo camino que pulsar el
    // botón (request → activate$): respeta maná, cooldown y daño por esfera.
    private runAutoSkills(delta: number): void {
      this.autoSkillGapMs -= delta;
      if (this.autoSkillGapMs > 0) return;

      const talent = this.reg.talent;
      const acts   = this.reg.skillActivation;
      if (!talent || !acts) return;

      const ids: string[] = [];
      for (const id of this.reg.hudSlots?.slots ?? []) {
        if (id && !ids.includes(id)) ids.push(id);
      }
      const slots = this.reg.skillEquip?.slots;
      if (slots) {
        for (const id of Object.values(slots)) {
          if (id && !ids.includes(id)) ids.push(id);
        }
      }
      if (!ids.length) return;

      for (let i = 0; i < ids.length; i++) {
        const nodeId  = ids[(this.autoSkillIdx + i) % ids.length];
        const node    = talent.nodes.find(n => n.id === nodeId);
        const ability = node?.effect?.ability;
        if (!ability || ability === 'dash') continue;   // dash automático marearía
        if (acts.isOnCooldown(ability) || !acts.hasTarget(ability)) continue;
        const sphere = talent.slotted[nodeId];
        const damage = node.effect.base * (sphere ? SPHERE_MULT[sphere] : 1);
        acts.request(ability, damage, true);
        // La siguiente pasada continúa por la skill posterior a esta
        this.autoSkillIdx   = (this.autoSkillIdx + i + 1) % ids.length;
        this.autoSkillGapMs = 1100;
        return;
      }

      // Ninguna lista (cooldowns / sin objetivo): re-chequear en breve
      this.autoSkillGapMs = 250;
    }

    // Mejor objetivo: el más cercano, con fuerte preferencia por los que ya
    // te persiguen (vienen hacia ti — matarlos primero evita daño gratis)
    private pickAutoTarget(px: number, py: number): Enemy | null {
      const now = this.time.now;
      let best: Enemy | null = null;
      let bestScore = Infinity;

      for (const e of this.enemies) {
        if (e.isDead) continue;
        const until = this.autoBlacklist.get(e);
        if (until && until > now) continue;
        const ep = e.getPixelPos();
        const ddx = ep.x - px;
        const ddy = ep.y - py;
        let score = ddx * ddx + ddy * ddy;
        if (e.isChasingPlayer()) score *= 0.25;
        if (score < bestScore) { bestScore = score; best = e; }
      }

      // Todos vetados → limpiar la lista y reintentar una vez
      if (!best && this.autoBlacklist.size) {
        this.autoBlacklist.clear();
        return this.pickAutoTarget(px, py);
      }
      return best;
    }

    private pickCloseEnemy(px: number, py: number, radius: number): Enemy | null {
      let best: Enemy | null = null;
      let bestSq = radius * radius;
      for (const e of this.enemies) {
        if (e.isDead) continue;
        const ep = e.getPixelPos();
        const ddx = ep.x - px;
        const ddy = ep.y - py;
        const dSq = ddx * ddx + ddy * ddy;
        if (dSq < bestSq) { bestSq = dSq; best = e; }
      }
      return best;
    }

    private autoVecToCardinal(dx: number, dy: number): Direction {
      return Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? Direction.RIGHT : Direction.LEFT)
        : (dy > 0 ? Direction.DOWN  : Direction.UP);
    }

    private autoVecTo8Dir(dx: number, dy: number): Direction {
      const deg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      if (deg < 22.5  || deg >= 337.5) return Direction.RIGHT;
      if (deg < 67.5)                  return Direction.DOWN_RIGHT;
      if (deg < 112.5)                 return Direction.DOWN;
      if (deg < 157.5)                 return Direction.DOWN_LEFT;
      if (deg < 202.5)                 return Direction.LEFT;
      if (deg < 247.5)                 return Direction.UP_LEFT;
      if (deg < 292.5)                 return Direction.UP;
      return Direction.UP_RIGHT;
    }

    private initStatsListener(): void {
      const charStats = this.reg.charStats;
      if (!charStats) return;
      this.statsSub = charStats.damage$.subscribe(breakdown => {
        this.playerDamage = breakdown.total;
      });
      this.magicSub = charStats.magicDamage$.subscribe(breakdown => {
        this.playerMagicDamage = breakdown.total;
      });
    }

    private initEquipLayers(): void {
      this.registerEquipLayerAnims();
      this.initShadowLayer();
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

    private initShadowLayer(): void {
      const cfg = EQUIP_LAYER_REGISTRY['Shadow'];
      if (!cfg || !cfg.sheets) return;
      const allLoaded = cfg.sheets.every(s => this.textures.exists(s.key));
      if (!allLoaded) return;
      this.player.addLayer('shadow', cfg.sheets[0].key, cfg.depth, cfg);
    }

    private registerEquipLayerAnims(): void {
      for (const cfg of Object.values(EQUIP_LAYER_REGISTRY)) {
        if (cfg.mode !== 'anim' || !cfg.sheets) continue;
        for (const sheet of cfg.sheets) {
          for (const anim of sheet.anims) {
            if (this.anims.exists(anim.key)) continue;
            const frames = this.anims.generateFrameNumbers(sheet.key, { start: anim.startFrame, end: anim.endFrame });
            if (frames.length) this.anims.create({ key: anim.key, frames, frameRate: anim.frameRate, repeat: anim.repeat });
          }
        }
      }
    }

    private applyEquipLayer(slotId: string, item: InventoryItem | null): void {
      if (!item) { this.player.removeLayer(slotId); return; }
      const cfg = EQUIP_LAYER_REGISTRY[item.name];
      if (!cfg) { this.player.removeLayer(slotId); return; }
      if (cfg.mode === 'anim') {
        const allLoaded = (cfg.sheets ?? []).every(s => this.textures.exists(s.key));
        if (!allLoaded) { this.player.removeLayer(slotId); return; }
        this.player.addLayer(slotId, cfg.sheets![0].key, cfg.depth, cfg);
      } else {
        if (!cfg.key || !this.textures.exists(cfg.key)) { this.player.removeLayer(slotId); return; }
        this.player.addLayer(slotId, cfg.key, cfg.depth);
      }
    }

    initMap() {
      const cfg = this.currentMapConfig;
      this.currentMap = this.make.tilemap({ key: cfg.tilemapKey });
      const allTilesetNames = [cfg.tilesetName];
      this.currentMap.addTilesetImage(cfg.tilesetName, cfg.tilesetKey);
      for (const ts of cfg.extraTilesets ?? []) {
        this.currentMap.addTilesetImage(ts.name, ts.key);
        allTilesetNames.push(ts.name);
      }
      let depth = 0;
      for (let i = 0; i < this.currentMap.layers.length; i++) {
        const layer = this.currentMap.createLayer(i, allTilesetNames, 0, 0);
        if (!layer) continue; // object layers devuelven null
        layer.setDepth(depth++);
        layer.scale = 3;
      }
    }

    initPlayer() {
      const playerSprite = this.physics.add.sprite(0, 0, "player");
      playerSprite.setDepth(2);
      playerSprite.scale = 2.5;
      this.cameras.main.startFollow(playerSprite);
      this.cameras.main.roundPixels = true;
      const spawn = this.currentMapConfig.spawnPos ?? { x: 6, y: 6 };
      const sprites = {
        mainScene: this,
        sprite: playerSprite,
        tilePos: new Phaser.Math.Vector2(spawn.x, spawn.y)
      };
      this.reg.playerBridge.setInitialSprites(sprites);
      this.player = this.reg.playerBridge.getPlayer();
    }

    // El HUD lee esto cada frame: `enemies` es la referencia viva al array
    // (spawnEnemy hace push y el callback de muerte splice sobre el mismo array)
    private buildMinimapData(): MinimapData {
      const ts = GameScene.TILE_SIZE;
      return {
        enemies: this.enemies,
        getPlayerPos: () => this.player.getPosition(),
        mapWidthPx:  this.currentMap.width  * ts,
        mapHeightPx: this.currentMap.height * ts,
        portals: this.currentMapConfig.portals.map(p => ({
          x: p.tilePos.x * ts + ts / 2,
          y: p.tilePos.y * ts + ts / 2,
        })),
        townChest: this.currentMapConfig.id === 'hogar'
          ? { x: 34 * ts + ts / 2, y: 30 * ts + ts / 2 }
          : undefined,
      };
    }

    initSpawns() {
      for (const cfg of this.currentMapConfig.spawns) {
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

      enemy.setWanderZone(cfg.zone.tileX, cfg.zone.tileY, cfg.zone.width, cfg.zone.height);
      this.enemies.push(enemy);
      tracker.count++;
    }

    private registerEnemyAnimations(): void {
      const spawnTypes = this.currentMapConfig.spawns.map(s => s.enemyType);
      const typesToRegister = new Set<string>();
      for (const base of spawnTypes) {
        typesToRegister.add(base);
        typesToRegister.add(`${base}_elite`);
        typesToRegister.add(`${base}_oblivion`);
      }
      for (const type of typesToRegister) {
        const cfg = ENEMY_REGISTRY[type];
        if (cfg) this.animService.registerEnemyAnimations(cfg);
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

    }

    initPortals() {
      if (!this.anims.exists('portal_spin')) {
        this.anims.create({
          key: 'portal_spin',
          frames: this.anims.generateFrameNumbers('portal', { start: 0, end: 7 }),
          frameRate: 10,
          repeat: -1,
        });
      }

      this.currentMapConfig.portals.forEach(portal => {
        const px = portal.tilePos.x * GameScene.TILE_SIZE + GameScene.TILE_SIZE / 2;
        const py = portal.tilePos.y * GameScene.TILE_SIZE + GameScene.TILE_SIZE / 2;
        const sprite = this.add.sprite(px, py, 'portal');
        sprite.setDepth(1);
        sprite.setScale(1.5);
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

    // "LVL UP!" dorado sobre el personaje al subir de nivel (5s, sigue al jugador)
    private initLevelUpWatcher(): void {
      this.lastLvl = null;
      this.lvlSub?.unsubscribe();
      this.lvlSub = this.reg.playerState.lvl$.subscribe((lvl: number) => {
        // El primer valor tras crear la escena es el nivel cargado, no una subida
        if (this.lastLvl !== null && lvl > this.lastLvl) this.showLevelUp();
        this.lastLvl = lvl;
      });
    }

    private showLevelUp(): void {
      this.lvlUpText?.destroy();
      const pos = this.player.getPosition();
      const txt = this.add.text(pos.x, pos.y - 160, 'LVL UP!', {
        fontSize: '52px',        // más grande que el daño (28px) y el crítico (48px)
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 10,
      }).setOrigin(0.5, 1).setDepth(6000);
      this.lvlUpText = txt;

      // Pop de entrada y después pulso suave
      txt.setScale(0);
      this.tweens.add({
        targets: txt,
        scale: 1,
        duration: 250,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (!txt.active) return;
          this.tweens.add({
            targets: txt,
            scale: { from: 1, to: 1.12 },
            duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          });
        },
      });

      // A los 4.5s se desvanece medio segundo y desaparece (5s en total)
      this.time.delayedCall(4500, () => {
        if (!txt.active) return;
        this.tweens.add({
          targets: txt,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            txt.destroy();
            if (this.lvlUpText === txt) this.lvlUpText = null;
          },
        });
      });
    }

    initCamera() {
      // 0.4 de zoom de diseño × DPR: con el canvas a resolución nativa, la
      // escala efectiva de los sprites queda alineada con el píxel físico
      this.cameras.main.setZoom(0.4 * NATIVE_DPR);
    }

    createGameControls() {
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.reg.asgard.closeAllMenus();
        this.onGameClick(pointer);
      });

      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.spaceKey.on('down', () => {
        this.reg.autoAttack?.pauseAutomation();
        const chest = this.nearestOpenableChest();
        if (chest) { this.openChest(chest); return; }
        if (this.player.isAttacking) return;
        this.strike();
      });
    }

    createPhysics() {
      this.collisionTiles = this.buildCollisionTiles();
      this.gridPhysics  = new GridPhysics(this.player, this.currentMap, this.enemies, this.collisionTiles);
      this.gridControls = new GridControls(this.input, this.gridPhysics, this.mobileInput,
        (md, ad) => this.onDashDoubleTap(md, ad));
    }

    private buildCollisionTiles(): Set<string> {
      const blocked = new Set<string>();
      const tw = this.currentMap.tileWidth;
      for (const objLayer of this.currentMap.objects) {
        const hasCollides = objLayer.properties?.some(
          (p: any) => p.name === 'collides' && p.value === true
        );
        if (!hasCollides) continue;
        for (const obj of objLayer.objects) {
          const x0 = Math.floor(obj.x / tw);
          const y0 = Math.floor(obj.y / tw);
          const x1 = Math.ceil((obj.x + (obj.width ?? tw)) / tw);
          const y1 = Math.ceil((obj.y + (obj.height ?? tw)) / tw);
          for (let tx = x0; tx < x1; tx++) {
            for (let ty = y0; ty < y1; ty++) {
              blocked.add(`${tx},${ty}`);
            }
          }
        }
      }
      return blocked;
    }

    createDrops() {
      this.gridDrops = new GridDrops(this.player, this, this.reg.inventory, this.reg.playerState, this.reg.charStats, this.reg.world);
    }

    onGameClick(_pointer: Phaser.Input.Pointer) { }

    private onDashDoubleTap(moveDir: Direction, animDir: Direction): void {
      if (!this.isDashEquipped()) return;
      this.pendingDashMoveDir = moveDir;
      this.pendingDashAnimDir = animDir;
      this.reg.skillActivation?.request('dash', 0);
    }

    private isDashEquipped(): boolean {
      if (this.reg.hudSlots?.slots.some(id => id === 'dash')) return true;
      const slots = this.reg.skillEquip?.slots;
      if (slots && Object.values(slots).some(id => id === 'dash')) return true;
      return false;
    }


    initEnemyAttackListener() {
      this.events.on('enemyAttackPlayer', ({ damage, isCrit, sourceX, sourceY }: { damage: number; isCrit?: boolean; sourceX?: number; sourceY?: number }) => {
        const now = this.time.now;
        if (now - this.lastDamageTime < 500) return;
        this.lastDamageTime = now;

        const evasion = this.reg.charStats?.currentEvasion ?? 0;
        if (evasion > 0 && Math.random() * 100 < evasion) {
          this.showPlayerMiss();
          return;
        }

        const defense         = this.reg.charStats?.currentDefense ?? 0;
        const effectiveDamage = Math.max(0, damage - defense);
        if (effectiveDamage === 0) {
          this.showPlayerImmune();
          return;
        }
        this.reg.playerBridge.setAttackToPlayer({ HP: -effectiveDamage });
        this.flashPlayer();
        this.showPlayerDamage(effectiveDamage, isCrit);
        // Un crítico enemigo empuja al jugador hacia atrás, alejándolo del enemigo.
        if (isCrit && sourceX != null && sourceY != null) {
          this.knockbackPlayer(sourceX, sourceY);
        }
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

    // Golpe del jugador: lanza la animación y aplica el daño al ~40% de su
    // duración para que coincida con el frame de impacto (como los enemigos).
    private strike(): void {
      this.player.playerAttack();
      const anim  = this.player.getSprite().anims.currentAnim;
      const delay = anim ? Math.round(anim.duration * 0.4) : 150;
      this.time.delayedCall(delay, () => {
        if (this.reg.playerBridge?.isDead) return;
        const { dmg, isCrit } = this.rollAttack();
        const hits = this.gridPhysics.attackEnemy(dmg, isCrit);
        if (hits > 0 && isCrit) this.critFeedback();
      });
    }

    // Hit-stop + sacudida de cámara: pausa real de la escena un instante.
    // setTimeout (no this.time): el reloj de la escena queda congelado.
    private critFeedback(): void {
      this.scene.pause();
      setTimeout(() => {
        this.scene.resume();
        this.cameras.main.shake(100, 0.0035);
      }, 60);
    }

    private rollAttack(): { dmg: number; isCrit: boolean } {
      const critChance = this.reg.charStats?.currentCritChance ?? 10;
      const isCrit     = Math.random() * 100 < critChance;
      const critMult   = isCrit ? (this.reg.charStats?.currentCritDamage ?? 150) / 100 : 1;
      return { dmg: Math.round(this.playerDamage * critMult), isCrit };
    }

    private flashPlayer() {
      const sprite = this.player.getSprite();
      sprite.setTint(0xff4444);
      this.time.delayedCall(150, () => sprite.clearTint());
    }

    private showPlayerImmune(): void {
      const sprite = this.player.getSprite();
      const x = sprite.x + Phaser.Math.Between(-20, 20);
      const y = sprite.y - sprite.displayHeight * 0.5;
      const text = this.add.text(x, y, 'IMMUNE', {
        fontSize: '22px', color: '#f0a020', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5,
      });
      text.setOrigin(0.5, 1).setDepth(5000);
      this.tweens.add({
        targets: text, y: y - 35, alpha: 0, duration: 700, ease: 'Power2',
        onComplete: () => text.destroy(),
      });
    }

    private showPlayerMiss(): void {
      const sprite = this.player.getSprite();
      const x = sprite.x + Phaser.Math.Between(-20, 20);
      const y = sprite.y - sprite.displayHeight * 0.5;
      const text = this.add.text(x, y, 'EVADE', {
        fontSize: '24px', color: '#1abc9c', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5,
      });
      text.setOrigin(0.5, 1).setDepth(5000);
      this.tweens.add({
        targets: text, y: y - 35, alpha: 0, duration: 700, ease: 'Power2',
        onComplete: () => text.destroy(),
      });
    }

    private showPlayerDamage(amount: number, isCrit = false): void {
      const sprite = this.player.getSprite();
      const x = sprite.x + Phaser.Math.Between(-20, 20);
      const y = sprite.y - sprite.displayHeight * 0.5;
      const text = this.add.text(x, y, isCrit ? `-${amount}!` : `-${amount}`, {
        fontSize: isCrit ? '36px' : '28px',
        color:    isCrit ? '#ff8800' : '#ff4444',   // crítico en naranja y más grande
        fontStyle: 'bold',
        stroke: '#000000', strokeThickness: isCrit ? 7 : 6,
      });
      text.setOrigin(0.5, 1).setDepth(5000);
      this.tweens.add({
        targets: text, y: y - 35, alpha: 0, duration: 700, ease: 'Power2',
        onComplete: () => text.destroy(),
      });
    }

    // Empujón corto del jugador alejándose del enemigo que ha hecho crítico.
    // El movimiento del jugador es por píxeles (no snap a rejilla), así que un
    // tween directo del sprite es seguro; se frena si el destino choca con tile.
    private knockbackPlayer(fromX: number, fromY: number): void {
      const sprite = this.player.getSprite();
      const dx = sprite.x - fromX;
      const dy = sprite.y - fromY;
      const d  = Math.sqrt(dx * dx + dy * dy) || 1;
      const push = 26;
      const nx = sprite.x + (dx / d) * push;
      const ny = sprite.y + (dy / d) * push;
      if (this.gridPhysics.isTileBlocked(nx, ny)) return;

      this.tweens.killTweensOf(sprite);
      this.tweens.add({
        targets: sprite,
        x: nx, y: ny,
        duration: 110,
        ease: 'Power2',
      });
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

    private initItemDropListener(): void {
      this.itemDropSub = this.reg.summon.itemDrop$.subscribe(entry => {
        const pos  = this.player.getPosition();
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist  = Phaser.Math.Between(120, 200);
        const spawn = new Phaser.Math.Vector2(
          pos.x + Math.cos(angle) * dist,
          pos.y + Math.sin(angle) * dist,
        );
        this.gridDrops.spawnDrop(spawn, entry);
      });

      // Items que no caben al cambiar de mochila → al suelo, junto al jugador
      this.dropToWorldSub = this.reg.inventory.dropToWorld$.subscribe(item => {
        const pos   = this.player.getPosition();
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist  = Phaser.Math.Between(40, 90);
        const spawn = new Phaser.Math.Vector2(
          pos.x + Math.cos(angle) * dist,
          pos.y + Math.sin(angle) * dist,
        );
        this.gridDrops.dropInventoryItem(spawn, item);
      });
    }

    private initChestListener(): void {
      // Registra las 9 animaciones de apertura (una por columna del spritesheet).
      // chests.png: 9 cols × 4 rows, 32×32 px. Frames izq-dcha, arriba-abajo.
      // Cofre col: idle=col, anim=[col+9, col+18, col+27]
      for (let col = 0; col < 9; col++) {
        const key = `chest_open_${col}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: [
              { key: 'chests', frame: col + 9  },
              { key: 'chests', frame: col + 18 },
              { key: 'chests', frame: col + 27 },
            ],
            frameRate: 6,
            repeat: 0,
          });
        }
      }

      // Cofre fijo de ciudad en el mapa Asgard
      if (this.currentMapConfig.id === 'hogar') {
        this.spawnTownChest();
      }

      this.chestSub = this.reg.summon.chestSpawn$.subscribe(col => {
        const pos = this.player.getPosition();
        const TS  = GameScene.TILE_SIZE;
        // Aparece 3 tiles a la derecha del jugador
        const x = pos.x + TS * 3;
        const y = pos.y;

        const sprite = this.add.sprite(x, y, 'chests', col);
        sprite.setScale(4);
        sprite.setDepth(2);

        // Calcular tiles bloqueadas (128×128 px centrado en x,y)
        const half = (32 * 4) / 2;
        const tx0 = Math.floor((x - half) / TS);
        const tx1 = Math.floor((x + half - 1) / TS);
        const ty0 = Math.floor((y - half) / TS);
        const ty1 = Math.floor((y + half - 1) / TS);
        const blocked: string[] = [];
        for (let tx = tx0; tx <= tx1; tx++) {
          for (let ty = ty0; ty <= ty1; ty++) {
            const k = `${tx},${ty}`;
            blocked.push(k);
            this.collisionTiles.add(k);
          }
        }

        const chest = { sprite, col, blocked, opening: false };
        this.activeChests.push(chest);

        // Al terminar la animación: vuelve al frame cerrado y se queda en el mapa.
        // opening=true ya impide que vuelva a interactuarse.
        sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          sprite.setFrame(col);
        });
      });
    }

    /** Distancia a la que el jugador puede interactuar con un cofre (px). */
    private static readonly CHEST_INTERACT_RANGE = 96;

    private nearestOpenableChest(): typeof this.activeChests[0] | null {
      const pos = this.player.getPosition();
      const range = GameScene.CHEST_INTERACT_RANGE;
      for (const chest of this.activeChests) {
        if (chest.opening) continue;
        if (chest.isTownChest && this.reg.summon.townChestIsOpen$.value) continue;
        const sp = chest.sprite;
        const dx = sp.x - pos.x;
        const dy = sp.y - pos.y;
        if (dx * dx + dy * dy <= range * range) return chest;
      }
      return null;
    }

    private spawnTownChest(): void {
      const TS  = GameScene.TILE_SIZE;
      const col = 0;
      // 4 tiles a la derecha del spawn del jugador (tile 30,30)
      const x = 34 * TS + TS / 2;
      const y = 30 * TS + TS / 2;

      const sprite = this.add.sprite(x, y, 'chests', col);
      sprite.setScale(4);
      sprite.setDepth(2);

      // Colisión: el sprite ocupa 128×128 px centrado en (x, y)
      const half = (32 * 4) / 2;
      const tx0 = Math.floor((x - half) / TS);
      const tx1 = Math.floor((x + half - 1) / TS);
      const ty0 = Math.floor((y - half) / TS);
      const ty1 = Math.floor((y + half - 1) / TS);
      const blocked: string[] = [];
      for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = ty0; ty <= ty1; ty++) {
          const k = `${tx},${ty}`;
          blocked.push(k);
          this.collisionTiles.add(k);
        }
      }

      const entry = { sprite, col, blocked, opening: false, isTownChest: true };
      this.activeChests.push(entry);

      // Al terminar la animación: permite reabrir (la ventana ya controla el frame)
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        entry.opening = false;
      });

      // Sincroniza el frame con el estado de la ventana Angular:
      // col+27 = último frame (abierto), col = cerrado
      const isOpenSub = this.reg.summon.townChestIsOpen$.subscribe(isOpen => {
        sprite.setFrame(isOpen ? col + 27 : col);
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => isOpenSub.unsubscribe());
    }

    private openChest(chest: typeof this.activeChests[0]): void {
      chest.opening = true;
      chest.sprite.play(`chest_open_${chest.col}`);
      if (chest.isTownChest) {
        this.reg.summon.townChestOpen$.next();
      }
    }

    private summonEnemyAt(enemyType: string, tileX: number, tileY: number): void {
      const cfg = ENEMY_REGISTRY[enemyType];
      if (!cfg) { console.warn(`summon: "${enemyType}" no está en ENEMY_REGISTRY`); return; }

      const baseType = cfg.spriteType ?? cfg.type;
      const idleKey  = `${baseType}_idle`;

      if (this.textures.exists(idleKey)) {
        this.animService.registerEnemyAnimations(cfg);
        this.doSummon(cfg, idleKey, tileX, tileY);
        return;
      }

      // Carga dinámica: registra los sprites que falten y espera a que carguen
      let needsLoad = false;
      for (const [action, actionCfg] of Object.entries(cfg.actions) as [string, ActionConfig][]) {
        const key = `${baseType}_${action}`;
        if (!this.textures.exists(key)) {
          this.load.spritesheet(key, `assets/sprites/enemy/${baseType}/${actionCfg.filename}.png`, {
            frameWidth: actionCfg.frameWidth,
            frameHeight: actionCfg.frameHeight,
          });
          needsLoad = true;
        }
      }

      if (needsLoad) {
        this.load.once('complete', () => {
          this.animService.registerEnemyAnimations(cfg);
          this.doSummon(cfg, idleKey, tileX, tileY);
        });
        this.load.start();
      } else {
        this.animService.registerEnemyAnimations(cfg);
        this.doSummon(cfg, idleKey, tileX, tileY);
      }
    }

    private doSummon(cfg: EnemyTypeConfig, idleKey: string, tileX: number, tileY: number): void {
      const sprite = this.add.sprite(0, 0, idleKey);
      sprite.setDepth(2);

      const enemy = new Enemy(
        this, sprite,
        new Phaser.Math.Vector2(tileX, tileY),
        this.currentMap,
        cfg,
        'passive',
        12,
        () => {
          const idx = this.enemies.indexOf(enemy);
          if (idx !== -1) this.enemies.splice(idx, 1);
        },
      );
      this.enemies.push(enemy);
    }

    private initSkillTargetChecker(): void {
      const skillSvc = this.reg.skillActivation;
      if (!skillSvc) return;
      this.time.addEvent({ delay: 500, loop: true, callback: () => this.recheckSkillTargets() });
      this.events.on('enemyDied', () => this.recheckSkillTargets());
    }

    private recheckSkillTargets(): void {
      const skillSvc = this.reg.skillActivation;
      if (!skillSvc) return;
      const playerPos = this.player.getPosition();
      for (const cfg of Object.values(SKILL_REGISTRY)) {
        if (cfg.effectType === 'buff' || cfg.effectType === 'dash' || cfg.target === 'self') { skillSvc.setTargetAvailable(cfg.abilityId, true); continue; }
        const rangePx = GameScene.TILE_SIZE * cfg.range * 3;
        const has = this.enemies.some(e => {
          if (e.isDead) return false;
          const p = e.getPixelPos();
          const dx = p.x - playerPos.x, dy = p.y - playerPos.y;
          return dx * dx + dy * dy <= rangePx * rangePx;
        });
        skillSvc.setTargetAvailable(cfg.abilityId, has);
      }
    }

    private registerSkillAnimations(): void {
      for (const cfg of Object.values(SKILL_REGISTRY)) {
        const animKey = cfg.spriteKey;
        if (this.anims.exists(animKey)) continue;
        const frames = [];
        for (let i = 1; i <= cfg.frameCount; i++) {
          if (this.textures.exists(`${animKey}_${i}`)) frames.push({ key: `${animKey}_${i}` });
        }
        if (frames.length) {
          this.anims.create({ key: animKey, frames, frameRate: cfg.frameRate, repeat: -1 });
        }
      }
    }

    private initSkillListener(): void {
      const skillSvc = this.reg.skillActivation;
      if (!skillSvc) return;
      this.skillSub = skillSvc.activate$.subscribe(({ abilityId, damage }) => this.executeSkill(abilityId, damage));
    }

    private executeSkill(abilityId: string, damage: number): void {
      const cfg = SKILL_REGISTRY[abilityId];
      if (!cfg) return;
      if (cfg.manaCost) {
        const ps = this.reg.playerState;
        const state = ps?.snapshot();
        if (!state || state.mp < cfg.manaCost) {
          this.reg.skillActivation?.refundCooldown(abilityId);
          return;
        }
        ps.setMp(state.mp - cfg.manaCost);
      }
      if (cfg.effectType === 'dash') {
        const moveDir = this.pendingDashMoveDir ?? this.player.getDirection();
        const animDir = this.pendingDashAnimDir ?? this.player.getDirection();
        this.pendingDashMoveDir = null;
        this.pendingDashAnimDir = null;
        this.gridPhysics.dash(moveDir, animDir);
        this.playImpactSelf(cfg);
        return;
      }
      if (cfg.effectType === 'buff') {
        this.playImpactSelf(cfg);
        if (cfg.buff) {
          this.reg.buff?.apply({
            id: cfg.abilityId,
            stat: cfg.buff.stat,
            value: cfg.buff.value,
            icon: cfg.iconPath ?? '',
            startTime: Date.now(),
            duration: cfg.cooldown,
          });
        }
        return;
      }
      if (cfg.target === 'self') {
        this.playImpactSelf(cfg);
        return;
      }
      const target = this.findNearestEnemy(cfg.range * 3);
      if (!target) {
        this.reg.skillActivation?.refundCooldown(abilityId);
        return;
      }
      if (cfg.effectType === 'projectile') {
        this.launchProjectile(cfg, damage, target);
      } else {
        this.playImpact(cfg, damage, target);
      }
    }

    private playImpactSelf(cfg: SkillConfig): void {
      const pos = this.player.getPosition();
      const playerSprite = this.player.getSprite();
      const sprite = this.add.sprite(pos.x, pos.y - playerSprite.displayHeight * 0.5, `${cfg.spriteKey}_1`);
      sprite.setDepth(6);
      sprite.setScale(cfg.scale);
      if (this.anims.exists(cfg.spriteKey)) sprite.play(cfg.spriteKey);
      const duration = (cfg.frameCount / cfg.frameRate) * 1000;
      this.time.delayedCall(duration, () => sprite.destroy());
    }

    private findNearestEnemy(rangeTiles: number): Enemy | null {
      const RANGE = GameScene.TILE_SIZE * rangeTiles;
      const playerPos = this.player.getPosition();
      let nearest: Enemy | null = null;
      let nearestDist = Infinity;
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        const ePos = enemy.getPixelPos();
        const dx = ePos.x - playerPos.x;
        const dy = ePos.y - playerPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= RANGE && dist < nearestDist) { nearest = enemy; nearestDist = dist; }
      }
      return nearest;
    }

    private getEnemiesInRadius(cx: number, cy: number, radiusTiles: number): Enemy[] {
      const rangePx = GameScene.TILE_SIZE * radiusTiles;
      return this.enemies.filter(e => {
        if (e.isDead) return false;
        const p = e.getPixelPos();
        const dx = p.x - cx, dy = p.y - cy;
        return dx * dx + dy * dy <= rangePx * rangePx;
      });
    }

    // El sprite aparece en el enemigo y se destruye al terminar el ciclo de animación
    private playImpact(cfg: SkillConfig, damage: number, target: Enemy): void {
      // sprite.y ya es el centro del enemigo (origin 0.5, 0.5)
      const pos = target.getPixelPos();
      const sprite = this.add.sprite(pos.x, pos.y, `${cfg.spriteKey}_1`);
      sprite.setDepth(6);
      sprite.setScale(cfg.scale);
      if (this.anims.exists(cfg.spriteKey)) sprite.play(cfg.spriteKey);
      if (cfg.aoeRadius) {
        this.getEnemiesInRadius(pos.x, pos.y, cfg.aoeRadius).forEach(e => e.takeDamage(damage));
      } else {
        target.takeDamage(damage);
      }
      const duration = (cfg.frameCount / cfg.frameRate) * 1000;
      this.time.delayedCall(duration, () => sprite.destroy());
    }

    // El sprite viaja desde el jugador hasta el enemigo y aplica daño al llegar
    private launchProjectile(cfg: SkillConfig, damage: number, target: Enemy): void {
      const playerPos = this.player.getPosition();
      const targetPos = target.getPixelPos();
      const proj = this.add.sprite(playerPos.x, playerPos.y, `${cfg.spriteKey}_1`);
      proj.setDepth(5);
      proj.setScale(cfg.scale);
      if (this.anims.exists(cfg.spriteKey)) proj.play(cfg.spriteKey);
      proj.setRotation(Phaser.Math.Angle.Between(playerPos.x, playerPos.y, targetPos.x, targetPos.y));
      const dist = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, targetPos.x, targetPos.y);
      const duration = (dist / (cfg.speed ?? 400)) * 1000;
      this.tweens.add({
        targets: proj, x: targetPos.x, y: targetPos.y, duration, ease: 'Linear',
        onComplete: () => {
          proj.destroy();
          if (cfg.aoeRadius) {
            this.getEnemiesInRadius(targetPos.x, targetPos.y, cfg.aoeRadius).forEach(e => e.takeDamage(damage));
          } else if (!target.isDead) {
            target.takeDamage(damage);
          }
        },
      });
    }

}
