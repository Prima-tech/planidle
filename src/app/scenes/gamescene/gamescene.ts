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
import { InteractionContext } from "src/app/services/interaction.service";
import { EQUIP_LAYER_REGISTRY, EquipLayerConfig } from "src/app/pnj/player/equip-layer-registry";
import { SKILL_REGISTRY, SkillConfig } from "src/app/services/skill-config";
import { SPHERE_MULT } from "src/app/services/talent.service";
import { NATIVE_DPR } from "./constants";
import { BuildableDef, PlacedBuilding } from "src/app/services/city-build.service";
import { Pet } from "src/app/pnj/pet/pet";
import { PET_REGISTRY, petPickupRange } from "src/app/pnj/pet/pet-config";

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

// Skills cuyo arte es un único spritesheet (1 textura, frames numerados en rejilla).
// Mejor que frames sueltos: menos texturas/cargas. El registro de animación lo detecta solo.
const SKILL_SHEET_SOURCES: { key: string; path: string; frameWidth: number; frameHeight: number }[] = [
  { key: 'skill_warrior_slash',   path: 'assets/sprites/skills/warrior/attack_01.png', frameWidth: 128, frameHeight: 128 },
  { key: 'skill_warrior_slash_2', path: 'assets/sprites/skills/warrior/attack_02.png', frameWidth: 128, frameHeight: 128 },
  { key: 'skill_warrior_slash_3', path: 'assets/sprites/skills/warrior/attack_03.png', frameWidth: 128, frameHeight: 128 },
  { key: 'skill_warrior_slash_4', path: 'assets/sprites/skills/warrior/attack_04.png', frameWidth: 128, frameHeight: 128 },
  { key: 'skill_warrior_slash_5', path: 'assets/sprites/skills/warrior/attack_05.png', frameWidth: 128, frameHeight: 128 },
  { key: 'skill_smoke_1',         path: 'assets/sprites/skills/warrior/smoke_01.png',  frameWidth: 128, frameHeight: 128 },
  { key: 'skill_smoke_2',         path: 'assets/sprites/skills/warrior/smoke_02.png',  frameWidth: 128, frameHeight: 128 },
  { key: 'skill_smoke_3',         path: 'assets/sprites/skills/warrior/smoke_03.png',  frameWidth: 128, frameHeight: 128 },
  { key: 'skill_smoke_4',         path: 'assets/sprites/skills/warrior/smoke_04.png',  frameWidth: 128, frameHeight: 128 },
  { key: 'skill_warrior_fire_1',  path: 'assets/sprites/skills/warrior/fire_01.png',   frameWidth: 128, frameHeight: 128 },
  { key: 'skill_warrior_fire_2',  path: 'assets/sprites/skills/warrior/fire_02.png',   frameWidth: 192, frameHeight: 128 },
  { key: 'skill_warrior_fire_3',  path: 'assets/sprites/skills/warrior/fire_03.png',   frameWidth: 128, frameHeight: 128 },
  { key: 'skill_blood_1',         path: 'assets/sprites/skills/warrior/blood_01.png',  frameWidth: 128, frameHeight: 128 },
  { key: 'skill_blood_2',         path: 'assets/sprites/skills/warrior/blood_02.png',  frameWidth: 128, frameHeight: 128 },
];

interface ActiveChest {
  sprite: Phaser.GameObjects.Sprite;
  col: number;
  blocked: string[];
  opening: boolean;
  isTownChest?: boolean;
}

// Recolección de recursos del mapa (rocas con pico, árboles con hacha…).
type HarvestKindId = 'rock' | 'tree';

interface HarvestKind {
  texture: string;            // textura precargada del recurso
  toolCategory: string;       // categoría del item-herramienta requerido
  toolSlotId: string;         // slot de GatheringEquipment + slot de la capa LPC
  context: InteractionContext;// contexto del botón de acción ('mine' | 'chop')
  footprintW: number;         // ancho de la huella en tiles (colisión)
  footprintH: number;         // alto de la huella en tiles (colisión)
  scale: number;              // escala visual del sprite
  offsetY: number;            // ajuste vertical (px) para asentar la base en la huella
  count: number;              // cuántos generar por mapa
  debris: number[];           // colores de los escombros al golpear
}

// Config por tipo de recurso. Añadir aquí nuevos recolectables (caña→peces, etc.).
const HARVEST_KINDS: Record<HarvestKindId, HarvestKind> = {
  rock: {
    texture: 'rock_mine', toolCategory: 'Pico', toolSlotId: 'pickaxe', context: 'mine',
    footprintW: 2, footprintH: 2, scale: 3, offsetY: 0, count: 3,
    debris: [0x9a9a9a, 0x6f6f6f, 0xbdbdbd, 0x808080],
  },
  tree: {
    texture: 'tree_chop', toolCategory: 'Hacha', toolSlotId: 'axe', context: 'chop',
    footprintW: 2, footprintH: 2, scale: 3.2, offsetY: 80, count: 3,
    debris: [0x6b4a2b, 0x8a5a2b, 0x4e7a32, 0x3c6b28],   // madera + hojas
  },
};

// Nodo recolectable colocado en el mapa. Ocupa una huella de tiles (todas en
// `tileKeys` para la colisión).
interface HarvestNode {
  sprite: Phaser.GameObjects.Image;
  hits: number;
  tileKeys: string[];
  kind: HarvestKindId;
}

export class GameScene extends Phaser.Scene {

    static readonly TILE_SIZE = 48;
    // Distancia (tiles) a la que el auto-ataque se detiene para disparar con bastón.
    static readonly RANGED_STOP_TILES = 5;
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
    private gatherLayerSub: { unsubscribe(): void } | null = null;
    private summonSub:   { unsubscribe(): void } | null = null;
    private itemDropSub: { unsubscribe(): void } | null = null;
    private dropToWorldSub: { unsubscribe(): void } | null = null;
    private chestSub:       { unsubscribe(): void } | null = null;
    private placementSub:   { unsubscribe(): void } | null = null;
    private clearedSub:     { unsubscribe(): void } | null = null;
    private moveSub:        { unsubscribe(): void } | null = null;
    private deleteSub:      { unsubscribe(): void } | null = null;
    private removedSub:     { unsubscribe(): void } | null = null;
    // true tras pulsar "Mover edificio": el siguiente click sobre un edificio lo edita.
    private moveSelecting = false;
    // true tras pulsar "Borrar edificio": el siguiente click sobre un edificio pide confirmar.
    private deleteSelecting = false;
    // Evita reabrir la ventana de un edificio en cada frame mientras se mantiene el botón.
    private shopActionLatched = false;
    // Construcciones colocadas por el jugador (no el cofre fijo): para poder
    // quitarlas en caliente (borrar todo) o moverlas.
    private placedBuildings: {
      building: PlacedBuilding;
      sprite: Phaser.GameObjects.Sprite;
      blocked: string[];
      chestEntry?: ActiveChest;
      isOpenUnsub?: () => void;
    }[] = [];
    // Estado del modo colocación de construcciones (ghost + botones confirmar/cancelar)
    private buildPlacement: {
      def: BuildableDef;
      ghost: Phaser.GameObjects.Sprite;
      check: Phaser.GameObjects.Container;
      cancel: Phaser.GameObjects.Container;
      tileX: number;
      tileY: number;
      valid: boolean;
      dragging: boolean;
      moving?: PlacedBuilding;   // si está, es la reubicación de un edificio existente
    } | null = null;
    private collisionTiles: Set<string>                    = new Set();
    // Rocas minables: solo en mapas que no sean 'hogar'. Bloquean el paso y se
    // pican con el pico equipado (3 golpes → se destruyen).
    // Recursos recolectables del mapa (rocas, árboles…). Bloquean el paso.
    private nodes: HarvestNode[] = [];
    // Herramienta de recolección actualmente "en mano" (o null = arma). Se activa al
    // encarar un recurso con su herramienta y es PEGAJOSA: se mantiene aunque te alejes;
    // solo se quita al hacer un ataque normal (enemigo/al aire) u otra acción.
    private activeHarvest: HarvestKindId | null = null;
    // Hay una carga en caliente de texturas de equipo en curso → al completar se
    // repintan todas las capas una sola vez (evita apilar listeners 'complete').
    private equipReapplyQueued = false;
    private activeChests: ActiveChest[] = [];
    // Cache del "qué tienes cerca" (cofre/tienda/recurso): son comprobaciones O(n)
    // sobre cofres/edificios/nodos. Recalcularlas CADA frame (120/seg) es CPU
    // tirada; se refrescan cada pocos frames (sigue siendo instantáneo en la práctica).
    private interactFrame = 0;
    private cachedNearChest:  typeof this.activeChests[0]    | null = null;
    private cachedNearWindow: typeof this.placedBuildings[0] | null = null;
    private cachedNearNode:   HarvestNode | null = null;
    private statsSub:    { unsubscribe(): void } | null = null;
    private magicSub:    { unsubscribe(): void } | null = null;
    private skillSub:    { unsubscribe(): void } | null = null;
    private playerDamage      = 10;
    private playerMagicDamage = 10;
    private rangedWeapon      = false;   // arma equipada de tipo 'ranged' (bastón) → ataque básico a distancia
    private autoDbgMs = 0;   // TEMP: throttle del log de diagnóstico de auto-ataque
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
    // Mascota equipada que sigue al jugador (slot 'pet' de la pestaña secundaria)
    private pet: Pet | null = null;
    private petId: string | null = null;
    private petSub: { unsubscribe(): void } | null = null;
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

      // Mascotas: spritesheet por mascota (sprite que sigue al jugador + drop al invocar).
      for (const cfg of Object.values(PET_REGISTRY)) {
        if (!this.textures.exists(cfg.textureKey)) {
          this.load.spritesheet(cfg.textureKey, cfg.sheetPath, { frameWidth: cfg.frameWidth, frameHeight: cfg.frameHeight });
        }
      }

      // Recursos (drop al suelo desde el panel de invocación)
      this.load.image('wood', 'assets/icon/resources/wood.png');

      // Recursos recolectables (se colocan en mapas que no son el hogar)
      this.load.image('rock_mine', 'assets/sprites/map/skills/rocks/Rock1_3.png');
      this.load.image('tree_chop', 'assets/sprites/map/skills/trees/Tree1.png');

      // Pociones (consumibles)
      this.load.image('heal_01', 'assets/icon/resources/potions/heal_01.png');
      this.load.image('heal_02', 'assets/icon/resources/potions/heal_02.png');
      this.load.image('heal_03', 'assets/icon/resources/potions/heal_03.png');

      for (const s of SKILL_SPRITE_SOURCES) {
        for (let i = 1; i <= s.count; i++) {
          const k = `${s.key}_${i}`;
          if (!this.textures.exists(k)) this.load.image(k, `${s.path}${i}.png`);
        }
      }
      for (const s of SKILL_SHEET_SOURCES) {
        if (!this.textures.exists(s.key)) {
          this.load.spritesheet(s.key, s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
        }
      }

      // Equipo: SOLO se precargan las texturas de lo que el jugador lleva puesto
      // (+ la sombra). El registro completo son ~600 MB de textura descomprimida en
      // GPU (hojas LPC de 832–1664 px de ancho, varias cargadas dos veces a 64 y a
      // 128/192 px); subirlo entero satura la VRAM en móvil y provoca tirones. El
      // resto se carga bajo demanda al equipar (ver ensureEquipTextures).
      this.queueEquipSheets(EQUIP_LAYER_REGISTRY['Shadow']);
      for (const cfg of this.equippedLayerConfigs()) this.queueEquipSheets(cfg);

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
      this.placedBuildings = [];
      this.nodes = [];
      this.activeHarvest = null;
      this.moveSelecting = false;
      this.deleteSelecting = false;
      this.shopActionLatched = false;
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
        this.gatherLayerSub?.unsubscribe();
        this.summonSub?.unsubscribe();
        this.itemDropSub?.unsubscribe();
        this.dropToWorldSub?.unsubscribe();
        this.chestSub?.unsubscribe();
        this.placementSub?.unsubscribe();
        this.clearedSub?.unsubscribe();
        this.moveSub?.unsubscribe();
        this.deleteSub?.unsubscribe();
        this.removedSub?.unsubscribe();
        // No re-spawnear el original durante el teardown (la persistencia lo conserva).
        if (this.buildPlacement) this.buildPlacement.moving = undefined;
        this.cancelBuildPlacement();
        this.reg.cityBuild?.cancelPlacement();
        this.reg.cityBuild?.cancelMoveMode();
        this.reg.cityBuild?.cancelDeleteMode();
        this.moveSelecting = false;
        this.deleteSelecting = false;
        this.placedBuildings = [];
        this.activeChests = [];
        this.reg.interaction?.setContext('attack');
        this.statsSub?.unsubscribe();
        this.magicSub?.unsubscribe();
        this.skillSub?.unsubscribe();
        this.player?.clearLayers();
        this.petSub?.unsubscribe();
        this.petSub = null;
        this.pet?.destroy();
        this.pet = null;
        this.petId = null;
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
        this.initBuildPlacementListener();
        this.initBuildClearedListener();
        if (this.currentMapConfig.id === 'hogar') this.initPlacedBuildings();
        this.initHarvestNodes();
        this.initStatsListener();
        this.registerSkillAnimations();
        this.initSkillListener();
        this.initSkillTargetChecker();
        this.initPet();
        this.time.delayedCall(600, () => this.reg.playerBridge?.emitSceneReady());
      });
    }

    override update(_time: number, delta: number) {
      const __t0 = performance.now();
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

      // Contexto del botón de acción: cofre cerca → abrir cofre; si no, tienda
      // (u otro edificio con ventana) cerca → abrir ventana; si no → atacar.
      // Refresca el "qué tienes cerca" cada 4 frames, no cada frame → menos CPU.
      if ((this.interactFrame++ & 3) === 0) {
        this.cachedNearChest  = this.nearestOpenableChest();
        this.cachedNearWindow = this.cachedNearChest ? null : this.nearestWindowBuilding();
        this.cachedNearNode   = (!this.cachedNearChest && !this.cachedNearWindow) ? this.nearestHarvestable() : null;
      }
      const nearChest = this.cachedNearChest;
      const nearWindow = this.cachedNearWindow;
      const nearNode = this.cachedNearNode;
      // La herramienta es "pegajosa": al encarar un recurso se muestra y se MANTIENE
      // aunque te alejes. Solo se quita al atacar a un enemigo / otra acción (strike).
      if (nearNode) this.setActiveHarvest(nearNode.kind);
      this.reg.interaction?.setContext(
        nearChest ? 'chest' : nearWindow ? 'shop'
        : nearNode ? HARVEST_KINDS[nearNode.kind].context : 'attack');

      // Si la ventana de cofre de ciudad está abierta y el jugador se alejó de
      // TODOS los cofres de ciudad (fijo + construidos) → cerrar.
      if (this.reg.summon.townChestIsOpen$.value) {
        const pos   = this.player.getPosition();
        const range = GameScene.CHEST_INTERACT_RANGE;
        const anyNear = this.activeChests.some(c => {
          if (!c.isTownChest) return false;
          const dx = c.sprite.x - pos.x;
          const dy = c.sprite.y - pos.y;
          return dx * dx + dy * dy <= range * range;
        });
        if (!anyNear) this.reg.summon.townChestCloseRequest$.next();
      }

      // Si la ventana de un edificio (tienda) está abierta y el jugador se alejó
      // del edificio → cerrarla.
      if (this.reg.cityBuild?.windowOpen$.value && !this.nearestWindowBuilding()) {
        this.reg.cityBuild.requestCloseWindow();
      }

      // Botón de acción: cofre cerca → abrir; tienda cerca → abrir su ventana
      // (una sola vez por pulsación, vía latch); si no → golpear.
      if (this.mobileInput?.isAttackHeld) {
        if (nearChest) {
          this.openChest(nearChest);
        } else if (nearWindow) {
          if (!this.shopActionLatched) {
            this.shopActionLatched = true;
            this.reg.cityBuild.requestOpenWindow(nearWindow.building.type);
          }
        } else if (!this.player.isAttacking) {
          this.strike();
        }
      } else {
        this.shopActionLatched = false;   // botón soltado → permite reabrir
      }

      const playerPos = this.player.getPosition();
      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].update(delta, playerPos);
      }
      if (this.lvlUpText?.active) {
        this.lvlUpText.setPosition(playerPos.x, playerPos.y - 160);
      }
      this.checkPortals(playerPos);
      this.updatePet(delta, playerPos);
      this.player.syncLayers();
      this.player.getSprite().setDepth(playerPos.y);
      // Diagnóstico: tiempo de lógica de la escena (lo lee el overlay de FPS para
      // separar coste de update vs render). Coste despreciable (2× performance.now).
      (this.game as any).__logicMs = performance.now() - __t0;
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

      // Con bastón (ranged) el jugador se detiene lejos para disparar; en melee, pegado.
      const stopTiles = this.rangedWeapon ? GameScene.RANGED_STOP_TILES : 2;
      const STOP_RANGE = GameScene.TILE_SIZE * stopTiles;

      // Si el objetivo queda más allá del rango de ataque y tienes otro encima, no
      // pases de largo: cambia. El umbral escala con el rango de parada (melee 4, ranged +2).
      const FAR  = GameScene.TILE_SIZE * (stopTiles + 2);
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
      const cardinalDir = this.autoVecToCardinal(dx, dy);

      // TEMP diagnóstico auto-ataque (espada): revela rama y estado cada ~700ms.
      this.autoDbgMs -= delta;
      if (this.autoDbgMs <= 0) {
        this.autoDbgMs = 700;
        console.log('[AUTODBG]', JSON.stringify({
          ranged: this.rangedWeapon,
          distTiles: +(dist / GameScene.TILE_SIZE).toFixed(2),
          stopTiles,
          willStrike: dist <= STOP_RANGE,
          isAttacking: this.player.isAttacking,
          enemies: this.enemies.length,
        }));
      }

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
      this.syncAllEquipLayers();
      this.equipSub = equipment.changes$.subscribe(() => this.syncAllEquipLayers());

      // Al cambiar el equipo de recolección (p.ej. equipar/quitar una herramienta) se
      // recalcula qué se sostiene (arma o herramienta) según el recurso encarado.
      const gathering = this.reg.gathering;
      if (gathering) {
        this.gatherLayerSub = gathering.changes$.subscribe(() => this.refreshHeldLayer());
      }
    }

    /** Muestra la herramienta "en mano" (`activeHarvest`) ocultando el arma y las demás
     *  herramientas; si no hay ninguna (o no está equipada), muestra el arma. */
    private refreshHeldLayer(): void {
      // Oculta todas las capas de herramientas de recolección
      for (const kind of Object.values(HARVEST_KINDS)) this.applyEquipLayer(kind.toolSlotId, null);

      if (this.activeHarvest) {
        const kind = HARVEST_KINDS[this.activeHarvest];
        const tool = this.equippedTool(kind.toolCategory, kind.toolSlotId);
        if (tool) {
          this.applyEquipLayer('weapon', null);
          this.applyEquipLayer(kind.toolSlotId, tool);
          return;
        }
      }
      this.applyEquipLayer('weapon', this.reg.equipment?.slots.find(s => s.id === 'weapon')?.item ?? null);
    }

    private setActiveHarvest(kind: HarvestKindId | null): void {
      if (kind === this.activeHarvest) return;
      this.activeHarvest = kind;
      this.refreshHeldLayer();
    }

    /** Lee el arma equipada y marca si su ataque básico es a distancia (bastón). */
    private refreshWeaponKind(): void {
      const weapon = this.reg.equipment?.slots.find(s => s.id === 'weapon')?.item;
      this.rangedWeapon = weapon?.weaponKind === 'ranged';
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
          if (!this.textures.exists(sheet.key)) continue;   // hoja aún no cargada → se registrará tras su carga
          for (const anim of sheet.anims) {
            if (this.anims.exists(anim.key)) continue;
            const frames = this.anims.generateFrameNumbers(sheet.key, { start: anim.startFrame, end: anim.endFrame });
            if (frames.length) this.anims.create({ key: anim.key, frames, frameRate: anim.frameRate, repeat: anim.repeat });
          }
        }
      }
    }

    /** Pone en cola (sin arrancar el loader) las hojas de `cfg` que aún no estén
     *  cargadas. Devuelve true si encoló algo. */
    private queueEquipSheets(cfg: EquipLayerConfig | undefined): boolean {
      if (!cfg) return false;
      let queued = false;
      if (cfg.mode === 'anim') {
        for (const sheet of cfg.sheets ?? []) {
          if (!this.textures.exists(sheet.key)) {
            this.load.spritesheet(sheet.key, sheet.path, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
            queued = true;
          }
        }
      } else if (cfg.key && !this.textures.exists(cfg.key)) {
        this.load.spritesheet(cfg.key, cfg.path!, { frameWidth: cfg.frameWidth, frameHeight: cfg.frameHeight });
        queued = true;
      }
      return queued;
    }

    /** Configs de capa de TODO lo que el jugador lleva equipado ahora (equipo +
     *  herramientas de recolección). Base para precargar solo lo necesario. */
    private equippedLayerConfigs(): EquipLayerConfig[] {
      const names = new Set<string>();
      for (const slot of this.reg.equipment?.slots ?? []) if (slot.item) names.add(slot.item.name);
      for (const slot of this.reg.gathering?.slots ?? []) if (slot.item) names.add(slot.item.name);
      const out: EquipLayerConfig[] = [];
      for (const name of names) {
        const cfg = EQUIP_LAYER_REGISTRY[name];
        if (cfg) out.push(cfg);
      }
      return out;
    }

    /** Asegura cargadas las texturas de `cfg`. Si faltan (ítem equipado en caliente
     *  que no se precargó), las carga en caliente y programa un repintado único de
     *  todas las capas al completar. Devuelve true si ya estaban listas. */
    private ensureEquipTextures(cfg: EquipLayerConfig): boolean {
      if (!this.queueEquipSheets(cfg)) return true;
      if (!this.equipReapplyQueued) {
        this.equipReapplyQueued = true;
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
          this.equipReapplyQueued = false;
          this.registerEquipLayerAnims();
          this.syncAllEquipLayers();
        });
        // Arranca el loader en el próximo tick: así varias piezas equipadas en el
        // mismo frame (p.ej. cambio de loadout) se cargan en un único lote y se
        // repintan de una sola vez al completar.
        this.time.delayedCall(0, () => this.load.start());
      }
      return false;
    }

    /** Repinta todas las capas de equipo desde el estado actual (idempotente).
     *  Se usa al iniciar y tras una carga perezosa de texturas. */
    private syncAllEquipLayers(): void {
      for (const slot of this.reg.equipment?.slots ?? []) {
        if (slot.id === 'weapon') continue;   // arma/herramienta → refreshHeldLayer
        this.applyEquipLayer(slot.id, slot.item);
      }
      this.refreshWeaponKind();
      this.refreshHeldLayer();
    }

    private applyEquipLayer(slotId: string, item: InventoryItem | null): void {
      if (!item) { this.player.removeLayer(slotId); return; }
      const cfg = EQUIP_LAYER_REGISTRY[item.name];
      if (!cfg) { this.player.removeLayer(slotId); return; }
      if (!this.ensureEquipTextures(cfg)) return;   // cargando → se repintará al terminar
      if (cfg.mode === 'anim') {
        if (!(cfg.sheets ?? []).every(s => this.textures.exists(s.key))) return;
        this.player.addLayer(slotId, cfg.sheets![0].key, cfg.depth, cfg);
      } else {
        if (!cfg.key || !this.textures.exists(cfg.key)) return;
        this.player.addLayer(slotId, cfg.key, cfg.depth);
      }
    }

    // ── Mascota ──────────────────────────────────────────────────────────────
    // La mascota equipada (slot 'pet' de la pestaña secundaria) aparece en el mapa
    // y sigue al jugador. Se sincroniza con el equipo: equipar/desequipar o cambiar
    // de loadout la crea/destruye/cambia en caliente.

    private initPet(): void {
      const gathering = this.reg.gathering;
      if (!gathering) return;
      this.syncPet();
      this.petSub = gathering.changes$.subscribe(() => this.syncPet());
    }

    private syncPet(): void {
      const petItem = this.reg.gathering?.slots.find(s => s.id === 'pet')?.item ?? null;
      const newId = petItem?.petId ?? null;
      if (newId === this.petId) return;   // sin cambios

      this.pet?.destroy();
      this.pet = null;
      this.petId = newId;

      if (!newId) return;
      const cfg = PET_REGISTRY[newId];
      if (!cfg || !this.textures.exists(cfg.textureKey)) return;

      // Aparece un poco por detrás del jugador para que entre caminando hacia él.
      const pos = this.player.getPosition();
      this.pet = new Pet(this, cfg, pos.x - GameScene.TILE_SIZE, pos.y);
    }

    // Distancia a la que la mascota recoge un drop (generosa: la mascota se ancla
    // en los pies y el drop en su centro, hay desfase). El radio de DETECCIÓN es
    // el stat "rango de recogida" de la mascota, que escala con su nivel.
    private static readonly PET_COLLECT_DIST = 44;

    /**
     * Mueve la mascota: si hay un drop recogible cerca va a por él y lo recoge
     * (va al inventario del personaje); si no, sigue al jugador. Los items solo
     * se buscan si hay hueco en el inventario (lo decide nearestCollectableDrop).
     */
    private updatePet(delta: number, playerPos: Phaser.Math.Vector2): void {
      if (!this.pet) return;
      if (this.pet.isBusy()) return;   // reproduciendo la animación de recogida

      const petItem = this.reg.gathering?.slots.find(s => s.id === 'pet')?.item ?? null;
      const range   = petPickupRange(petItem?.petLevel ?? 1);

      const pp   = this.pet.getPosition();
      const drop = this.gridDrops?.nearestCollectableDrop(pp.x, pp.y, range) ?? null;

      if (drop) {
        // stopDist 0 → la mascota se acerca del todo; recoge en cuanto entra en radio
        this.pet.update(delta, drop.sprite.x, drop.sprite.y, 0);
        const np = this.pet.getPosition();
        if (Phaser.Math.Distance.Between(np.x, np.y, drop.sprite.x, drop.sprite.y) <= GameScene.PET_COLLECT_DIST) {
          drop.collect();
          this.pet.playPickup();   // jump → (500ms) → emerge → sigue
        }
      } else {
        this.pet.update(delta, playerPos.x, playerPos.y);
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
        getBuildings: () => this.getMinimapBuildings(),
        getNodes: () => this.getMinimapNodes(),
      };
    }

    /** Construcciones colocadas (cofre/tienda) en px de mundo, para el minimapa. */
    private getMinimapBuildings(): { x: number; y: number; kind: string }[] {
      return this.placedBuildings.map(pb => ({
        x: pb.sprite.x,
        y: pb.sprite.y,
        kind: pb.building.type === 'shop' ? 'shop' : 'chest',
      }));
    }

    /** Recursos recolectables (rocas/árboles) en px de mundo, para el minimapa.
     *  Usa el centro de la huella en el suelo (no el sprite, que en árboles sube mucho). */
    private getMinimapNodes(): { x: number; y: number; kind: string }[] {
      const TS = GameScene.TILE_SIZE;
      return this.nodes.map(n => {
        const kind = HARVEST_KINDS[n.kind];
        return {
          x: n.sprite.x,
          y: n.sprite.y - kind.offsetY - (kind.footprintH / 2) * TS,
          kind: n.kind,
        };
      });
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

    /** Elige un tile de spawn dentro de la zona evitando el entorno del jugador
     *  (para que no aparezcan enemigos encima) y los tiles ocupados (nodos/edificios).
     *  Si la zona es pequeña/saturada y no encuentra hueco, usa el último intento. */
    private pickSpawnTile(cfg: SpawnConfig): { x: number; y: number } {
      const z = cfg.zone;
      const TS = GameScene.TILE_SIZE;
      const MIN_DIST = 4;   // tiles mínimos de separación con el jugador
      const ppos = this.player.getPosition();
      const ptx = Math.floor(ppos.x / TS);
      const pty = Math.floor(ppos.y / TS);
      let last = { x: z.tileX, y: z.tileY };
      for (let i = 0; i < 12; i++) {
        const x = Phaser.Math.Between(z.tileX, z.tileX + z.width  - 1);
        const y = Phaser.Math.Between(z.tileY, z.tileY + z.height - 1);
        last = { x, y };
        const dx = x - ptx, dy = y - pty;
        if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) continue;   // demasiado cerca del jugador
        if (this.collisionTiles.has(`${x},${y}`)) continue;      // ocupado (nodo/edificio)
        return { x, y };
      }
      return last;
    }

    private spawnEnemy(cfg: SpawnConfig, tracker: SpawnTracker) {
      if (tracker.count >= cfg.maxCount) return;

      const enemyCfg = ENEMY_REGISTRY[cfg.enemyType];
      if (!enemyCfg) { console.warn(`Enemy type "${cfg.enemyType}" not in ENEMY_REGISTRY`); return; }

      const { x: tileX, y: tileY } = this.pickSpawnTile(cfg);

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
        // En modo colocación el toque mueve el ghost / confirma / cancela.
        if (this.buildPlacement) { this.handleBuildPointer(pointer); return; }
        // En modo "mover edificio" el toque selecciona el edificio a reubicar.
        if (this.moveSelecting) { this.handleMoveSelect(pointer); return; }
        // En modo "borrar edificio" el toque selecciona el edificio a borrar.
        if (this.deleteSelecting) { this.handleDeleteSelect(pointer); return; }
        // Pulsar un edificio con ventana propia (p.ej. la tienda) la abre.
        if (this.handleBuildingWindowTap(pointer)) return;
        this.reg.asgard.closeAllMenus();
        this.onGameClick(pointer);
      });

      // Arrastrar el ghost por el mapa mientras se mantiene pulsado.
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (this.buildPlacement?.dragging && pointer.isDown) this.moveGhostToPointer(pointer);
      });
      this.input.on('pointerup', () => {
        if (this.buildPlacement) this.buildPlacement.dragging = false;
      });

      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.spaceKey.on('down', () => {
        this.reg.autoAttack?.pauseAutomation();
        const chest = this.nearestOpenableChest();
        if (chest) { this.openChest(chest); return; }
        const win = this.nearestWindowBuilding();
        if (win) { this.reg.cityBuild.requestOpenWindow(win.building.type); return; }
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
        this.reg.gathering?.addEquippedPetExp(1);   // 1 exp por enemigo a la mascota equipada

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
      // Si mira a un recurso con la herramienta equipada → recolecta (el arma está
      // oculta y la capa de la herramienta hace el swing). Si no → ataque normal.
      const node = this.nearestHarvestable();
      if (node) {
        this.player.playerAttack();
        this.time.delayedCall(140, () => {
          if (node.sprite.active && this.nodes.includes(node)) this.harvestNode(node);
        });
        return;
      }
      // Ataque normal (enemigo / al aire): es "otra acción" → guarda la herramienta y
      // vuelve a mostrar el arma.
      this.setActiveHarvest(null);
      if (this.rangedWeapon) { this.rangedStrike(); return; }
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

    // ── Recolección (minería / tala) ─────────────────────────────────────────────
    // Recursos repartidos por los mapas (no en el hogar): rocas (pico) y árboles
    // (hacha). Bloquean el paso y solo se dañan con su herramienta equipada en el slot
    // de recolección. 3 golpes → destrucción. Config en HARVEST_KINDS.

    private initHarvestNodes(): void {
      if (this.currentMapConfig.id === 'hogar') return;
      for (const id of Object.keys(HARVEST_KINDS) as HarvestKindId[]) {
        const kind = HARVEST_KINDS[id];
        if (!this.textures.exists(kind.texture)) continue;   // sin sprite → no se genera
        for (let placed = 0, tries = 0; placed < kind.count && tries < 400; tries++) {
          if (this.trySpawnNode(id, kind)) placed++;
        }
      }
    }

    private trySpawnNode(id: HarvestKindId, kind: HarvestKind): boolean {
      const w = this.currentMap.width;
      const h = this.currentMap.height;
      const TS = GameScene.TILE_SIZE;
      const spawn = this.currentMapConfig.spawnPos ?? { x: 6, y: 6 };
      // tx/ty = esquina superior izquierda de la huella footprintW×footprintH
      const tx = Phaser.Math.Between(3, w - kind.footprintW - 2);
      const ty = Phaser.Math.Between(3, h - kind.footprintH - 2);
      const cells: [number, number][] = [];
      for (let dx = 0; dx < kind.footprintW; dx++)
        for (let dy = 0; dy < kind.footprintH; dy++) cells.push([tx + dx, ty + dy]);
      const keys = cells.map(([cx, cy]) => `${cx},${cy}`);
      // Todas las tiles deben estar libres y ser pisables
      if (keys.some(k => this.collisionTiles.has(k))) return false;
      if (cells.some(([cx, cy]) => this.gridPhysics.isTileBlocked(cx * TS + TS / 2, cy * TS + TS / 2))) return false;
      // No demasiado cerca del punto de aparición del jugador
      if (Math.abs(tx - spawn.x) < 3 && Math.abs(ty - spawn.y) < 3) return false;
      this.spawnNode(id, kind, tx, ty, keys);
      return true;
    }

    private spawnNode(id: HarvestKindId, kind: HarvestKind, tileX: number, tileY: number, tileKeys: string[]): void {
      const TS = GameScene.TILE_SIZE;
      // Centrado horizontal sobre la huella; anclado por su base (origin abajo) a la
      // fila inferior, + offsetY para asentar el tronco/base sobre el suelo.
      const baseY = (tileY + kind.footprintH) * TS;   // Y del suelo donde "se apoya"
      const cx = (tileX + kind.footprintW / 2) * TS;
      const cy = baseY + kind.offsetY;
      const sprite = this.add.image(cx, cy, kind.texture);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(kind.scale);
      // Depth por Y (como el jugador, que usa depth = su Y de pies): si el jugador está
      // por encima (más al norte) que la base del recurso, el recurso lo tapa (copa del
      // árbol); si está por debajo, el jugador pasa por delante.
      sprite.setDepth(baseY);
      for (const k of tileKeys) this.collisionTiles.add(k);   // bloquea su huella
      this.nodes.push({ sprite, hits: 0, tileKeys, kind: id });
    }

    /** Herramienta de la categoría dada equipada en su slot de recolección, o null. */
    private equippedTool(category: string, slotId: string): InventoryItem | null {
      const item = this.reg.gathering?.slots.find(s => s.id === slotId)?.item ?? null;
      return item && item.category === category ? item : null;
    }

    /** Recurso más cercano en rango y en la dirección de mirada cuya herramienta esté
     *  equipada. Define el contexto/capa de herramienta y el objetivo del golpe. */
    private nearestHarvestable(): HarvestNode | null {
      if (this.nodes.length === 0) return null;
      const pos = this.player.getPosition();
      const vec = this.dirVector(this.player.getDirection());
      const RANGE = GameScene.TILE_SIZE * 2.5;   // huella 2×2: alcance algo mayor
      let nearest: HarvestNode | null = null;
      let nearestDist = Infinity;
      for (const node of this.nodes) {
        const kind = HARVEST_KINDS[node.kind];
        if (!this.equippedTool(kind.toolCategory, kind.toolSlotId)) continue;   // sin herramienta no surte efecto
        // Punto de interacción = centro de la huella en el suelo (no la copa del árbol)
        const baseY = node.sprite.y - kind.offsetY - (kind.footprintH / 2) * GameScene.TILE_SIZE;
        const dx = node.sprite.x - pos.x;
        const dy = baseY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > RANGE || dist === 0) continue;
        if ((dx * vec.x + dy * vec.y) <= 0) continue;   // no está en la dirección de mirada
        if (dist < nearestDist) { nearestDist = dist; nearest = node; }
      }
      return nearest;
    }

    private harvestNode(node: HarvestNode): void {
      node.hits++;
      const kind = HARVEST_KINDS[node.kind];
      const s = node.sprite;
      const baseScale = kind.scale;

      // Flash blanco de impacto
      s.setTintFill(0xffffff);
      this.time.delayedCall(70, () => { if (s.active) s.clearTint(); });

      // Sacudida + aplastado breve
      this.tweens.killTweensOf(s);
      const baseX = s.x;
      this.tweens.add({
        targets: s, scaleX: baseScale * 1.1, scaleY: baseScale * 0.88, duration: 60, yoyo: true, ease: 'Quad.easeOut',
        onComplete: () => { if (s.active) { s.setScale(baseScale); s.x = baseX; } },
      });
      this.tweens.add({
        targets: s, x: baseX + Phaser.Math.Between(-5, 5), duration: 40, yoyo: true, repeat: 2,
        onComplete: () => { if (s.active) s.x = baseX; },
      });

      // Chispa + escombros + temblor de cámara (en el punto de impacto, no en la copa)
      const impactY = s.y - GameScene.TILE_SIZE * 0.8;
      this.spawnImpactSpark(s.x, impactY);
      this.spawnDebris(s.x, impactY, 8, kind.debris);
      this.cameras.main.shake(70, 0.0035);

      if (node.hits >= 3) this.destroyNode(node);
    }

    private destroyNode(node: HarvestNode): void {
      const idx = this.nodes.indexOf(node);
      if (idx !== -1) this.nodes.splice(idx, 1);
      for (const k of node.tileKeys) this.collisionTiles.delete(k);   // libera la huella

      const kind = HARVEST_KINDS[node.kind];
      const s = node.sprite;
      this.spawnDebris(s.x, s.y - GameScene.TILE_SIZE * 0.8, 16, kind.debris);   // estallido mayor
      this.cameras.main.shake(120, 0.005);
      this.tweens.killTweensOf(s);
      this.tweens.add({
        targets: s, scaleX: kind.scale * 1.2, scaleY: kind.scale * 1.2, alpha: 0, duration: 220, ease: 'Quad.easeOut',
        onComplete: () => s.destroy(),
      });
    }

    /** Pequeño destello blanco que se expande y desvanece en el punto de impacto. */
    private spawnImpactSpark(x: number, y: number): void {
      const spark = this.add.circle(x, y, 8, 0xffffff, 0.9);
      spark.setDepth(6000);
      this.tweens.add({
        targets: spark, scale: 3, alpha: 0, duration: 220, ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }

    /** Trozos (piedra/madera/hojas) saliendo despedidos en arco y desvaneciéndose. */
    private spawnDebris(x: number, y: number, count: number, colors: number[]): void {
      for (let i = 0; i < count; i++) {
        const size = Phaser.Math.Between(4, 8);
        const chip = this.add.rectangle(x, y, size, size, colors[i % colors.length]);
        chip.setDepth(6000);
        const ang  = Phaser.Math.FloatBetween(-Math.PI, 0);   // hacia arriba
        const dist = Phaser.Math.Between(28, 70);
        this.tweens.add({
          targets: chip,
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist + 22,   // cae un poco al final
          angle: Phaser.Math.Between(-180, 180),
          alpha: 0,
          duration: Phaser.Math.Between(300, 520),
          ease: 'Quad.easeOut',
          onComplete: () => chip.destroy(),
        });
      }
    }

    /** Vector unitario de la dirección de mirada del jugador. */
    private dirVector(dir: Direction): { x: number; y: number } {
      const D = 1 / Math.sqrt(2);
      switch (dir) {
        case Direction.UP:         return { x: 0,  y: -1 };
        case Direction.DOWN:       return { x: 0,  y: 1 };
        case Direction.LEFT:       return { x: -1, y: 0 };
        case Direction.RIGHT:      return { x: 1,  y: 0 };
        case Direction.UP_LEFT:    return { x: -D, y: -D };
        case Direction.UP_RIGHT:   return { x: D,  y: -D };
        case Direction.DOWN_LEFT:  return { x: -D, y: D };
        case Direction.DOWN_RIGHT: return { x: D,  y: D };
        default:                   return { x: 0,  y: 1 };
      }
    }

    // Ataque básico a distancia (bastón equipado): dispara una bola de fuego al
    // enemigo más cercano usando el daño MÁGICO. NO consume maná (no pasa por
    // executeSkill): es el golpe normal, solo que a distancia.
    private rangedStrike(): void {
      const cfg = SKILL_REGISTRY['fireball'];
      const target = this.findNearestEnemy(cfg.range * 3);
      if (!target) return;
      this.player.playerAttack(true);   // bastón → estocada (thrust), sincroniza con su capa
      // El proyectil sale al ~60% de la animación de ataque.
      const anim  = this.player.getSprite().anims.currentAnim;
      const delay = anim ? Math.round(anim.duration * 0.6) : 250;
      this.time.delayedCall(delay, () => {
        if (this.reg.playerBridge?.isDead || target.isDead) return;
        const { dmg, isCrit } = this.rollAttack(this.playerMagicDamage);
        this.launchProjectile(cfg, dmg, target);
        if (isCrit) this.critFeedback();
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

    private rollAttack(baseDamage = this.playerDamage): { dmg: number; isCrit: boolean } {
      const critChance = this.reg.charStats?.currentCritChance ?? 10;
      const isCrit     = Math.random() * 100 < critChance;
      const critMult   = isCrit ? (this.reg.charStats?.currentCritDamage ?? 150) / 100 : 1;
      return { dmg: Math.round(baseDamage * critMult), isCrit };
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
      // 4 tiles a la derecha del spawn del jugador (tile 30,30)
      this.addTownChest(34 * TS + TS / 2, 30 * TS + TS / 2);
    }

    /** Crea un cofre de ciudad (fijo o construido) en (x,y) px: sprite, colisión y
     *  sincronización con la ventana compartida. Ambos abren el mismo almacén.
     *  Devuelve el entry y un unsub del sync de frame (para quitarlo en caliente). */
    private addTownChest(x: number, y: number): {
      entry: ActiveChest;
      isOpenUnsub: () => void;
    } {
      const col = 0;

      const sprite = this.add.sprite(x, y, 'chests', col);
      sprite.setScale(4);
      sprite.setDepth(2);

      // Colisión: el sprite ocupa 128×128 px centrado en (x, y)
      const blocked = this.computeFootprintTiles(x, y, (32 * 4) / 2);
      for (const k of blocked) this.collisionTiles.add(k);

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
      const isOpenUnsub = () => isOpenSub.unsubscribe();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, isOpenUnsub);

      return { entry, isOpenUnsub };
    }

    // ─────────────────────────── Construcción de ciudad ───────────────────────────

    /** Lista de tiles `${x},${y}` cubiertas por una caja de lado 2·half px centrada en (x,y). */
    private computeFootprintTiles(centerX: number, centerY: number, half: number): string[] {
      const TS  = GameScene.TILE_SIZE;
      const tx0 = Math.floor((centerX - half) / TS);
      const tx1 = Math.floor((centerX + half - 1) / TS);
      const ty0 = Math.floor((centerY - half) / TS);
      const ty1 = Math.floor((centerY + half - 1) / TS);
      const tiles: string[] = [];
      for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = ty0; ty <= ty1; ty++) tiles.push(`${tx},${ty}`);
      }
      return tiles;
    }

    /** Centro en px de la construcción cuyo tile-ancla es (tileX, tileY). */
    private buildingCenterPx(tileX: number, tileY: number): { x: number; y: number } {
      const TS = GameScene.TILE_SIZE;
      return { x: tileX * TS + TS / 2, y: tileY * TS + TS / 2 };
    }

    /** Coloca una construcción persistida (al entrar en la ciudad). */
    private spawnBuilding(b: PlacedBuilding): void {
      const def = this.reg.cityBuild?.def(b.type);
      if (!def) { console.warn(`spawnBuilding: tipo "${b.type}" desconocido`); return; }
      const { x, y } = this.buildingCenterPx(b.tileX, b.tileY);
      const building = { ...b };
      if (def.isTownChest) {
        const { entry, isOpenUnsub } = this.addTownChest(x, y);
        this.placedBuildings.push({ building, sprite: entry.sprite, blocked: entry.blocked, chestEntry: entry, isOpenUnsub });
      } else {
        const sprite = this.add.sprite(x, y, def.spriteKey, def.frame);
        sprite.setScale(def.scale);
        sprite.setDepth(2);
        const blocked = this.computeFootprintTiles(x, y, (def.frameSize * def.scale) / 2);
        for (const k of blocked) this.collisionTiles.add(k);
        this.placedBuildings.push({ building, sprite, blocked });
      }
    }

    private initBuildClearedListener(): void {
      const cityBuild = this.reg.cityBuild;
      if (!cityBuild) return;
      this.clearedSub = cityBuild.cleared$.subscribe(() => this.removePlacedBuildings());
    }

    /** Quita en caliente todo lo construido por el jugador (no el cofre fijo). */
    private removePlacedBuildings(): void {
      for (const pb of [...this.placedBuildings]) this.detachPlacedBuilding(pb);
      // Si la ventana del cofre seguía abierta por un cofre construido, el loop
      // de update() la cerrará al no encontrar ningún cofre de ciudad cercano.
    }

    /** Quita de la escena UN edificio colocado (sprite + colisión + registro),
     *  sin tocar la persistencia. Usado por "borrar todo" y por "mover edificio". */
    private detachPlacedBuilding(pb: typeof this.placedBuildings[0]): void {
      pb.isOpenUnsub?.();
      pb.sprite.destroy();
      for (const k of pb.blocked) this.collisionTiles.delete(k);
      if (pb.chestEntry) {
        const i = this.activeChests.indexOf(pb.chestEntry);
        if (i !== -1) this.activeChests.splice(i, 1);
      }
      const j = this.placedBuildings.indexOf(pb);
      if (j !== -1) this.placedBuildings.splice(j, 1);
    }

    /** Modo "mover edificio": al pinchar, busca un edificio bajo el puntero y lo edita. */
    private handleMoveSelect(pointer: Phaser.Input.Pointer): void {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const pb = this.placedBuildings.find(b => b.sprite.getBounds().contains(world.x, world.y));
      this.moveSelecting = false;
      this.reg.cityBuild.cancelMoveMode();
      if (!pb) return;   // pinchó fuera de un edificio → salir del modo mover
      this.beginMoveBuilding(pb);
    }

    /** Saca el edificio de la escena y arranca el ghost en su posición (modo reubicar). */
    private beginMoveBuilding(pb: typeof this.placedBuildings[0]): void {
      const def = this.reg.cityBuild.def(pb.building.type);
      if (!def) return;
      const original = { ...pb.building };
      this.detachPlacedBuilding(pb);
      this.startBuildPlacement(def, original);
    }

    /** Modo "borrar edificio": al pinchar, pide confirmación para el edificio tocado. */
    private handleDeleteSelect(pointer: Phaser.Input.Pointer): void {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const pb = this.placedBuildings.find(b => b.sprite.getBounds().contains(world.x, world.y));
      this.deleteSelecting = false;
      this.reg.cityBuild.cancelDeleteMode();
      if (!pb) return;   // pinchó fuera de un edificio → salir del modo borrar
      this.reg.cityBuild.requestDelete({ ...pb.building });   // abre el modal de confirmación
    }

    /** Edificio con ventana propia (p.ej. tienda) dentro del rango de interacción, o null. */
    private nearestWindowBuilding(): typeof this.placedBuildings[0] | null {
      const pos   = this.player.getPosition();
      const range = GameScene.CHEST_INTERACT_RANGE;
      for (const pb of this.placedBuildings) {
        const def = this.reg.cityBuild?.def(pb.building.type);
        if (!def?.opensWindow) continue;
        const dx = pb.sprite.x - pos.x;
        const dy = pb.sprite.y - pos.y;
        if (dx * dx + dy * dy <= range * range) return pb;
      }
      return null;
    }

    /** Si el toque cae sobre un edificio con ventana propia, la abre. Devuelve true si lo gestionó. */
    private handleBuildingWindowTap(pointer: Phaser.Input.Pointer): boolean {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const pb = this.placedBuildings.find(b => b.sprite.getBounds().contains(world.x, world.y));
      if (!pb) return false;
      const def = this.reg.cityBuild.def(pb.building.type);
      if (!def?.opensWindow) return false;
      this.reg.cityBuild.requestOpenWindow(pb.building.type);
      return true;
    }

    /** Quita de la escena el edificio borrado (confirmado en el modal). */
    private removeBuildingFromScene(b: PlacedBuilding): void {
      const pb = this.placedBuildings.find(
        x => x.building.type === b.type && x.building.tileX === b.tileX && x.building.tileY === b.tileY,
      );
      if (pb) this.detachPlacedBuilding(pb);
    }

    private async initPlacedBuildings(): Promise<void> {
      const list = await this.reg.cityBuild.load();
      for (const b of list) this.spawnBuilding(b);
    }

    private initBuildPlacementListener(): void {
      const cityBuild = this.reg.cityBuild;
      if (!cityBuild) return;
      this.placementSub = cityBuild.placementMode$.subscribe(def => {
        if (def) this.startBuildPlacement(def);
        else     this.cancelBuildPlacement();
      });
      this.moveSub = cityBuild.moveMode$.subscribe(active => {
        // Solo se puede mover en la ciudad y sin un ghost ya activo.
        this.moveSelecting = active && this.currentMapConfig.id === 'hogar' && !this.buildPlacement;
      });
      this.deleteSub = cityBuild.deleteMode$.subscribe(active => {
        this.deleteSelecting = active && this.currentMapConfig.id === 'hogar' && !this.buildPlacement;
      });
      // Confirmado el borrado en el modal → quita el edificio de la escena.
      this.removedSub = cityBuild.removed$.subscribe(b => this.removeBuildingFromScene(b));
    }

    /** Arranca el ghost de colocación. Si `moving` está, es la reubicación de un
     *  edificio existente (arranca en su tile y al confirmar actualiza en vez de añadir). */
    private startBuildPlacement(def: BuildableDef, moving?: PlacedBuilding): void {
      this.cancelBuildPlacement();
      if (this.currentMapConfig.id !== 'hogar') { this.reg.cityBuild.cancelPlacement(); return; }

      // Ghost inicial: en el tile del edificio que se mueve, o sobre el jugador
      let tileX: number, tileY: number;
      if (moving) {
        tileX = moving.tileX;
        tileY = moving.tileY;
      } else {
        const pos = this.player.getPosition();
        tileX = Math.floor(pos.x / GameScene.TILE_SIZE);
        tileY = Math.floor(pos.y / GameScene.TILE_SIZE);
      }
      const { x, y } = this.buildingCenterPx(tileX, tileY);

      const ghost = this.add.sprite(x, y, def.spriteKey, def.frame);
      ghost.setScale(def.scale);
      ghost.setAlpha(0.6);
      ghost.setDepth(9000);

      const check  = this.makeBuildButton(0x2ecc40, '✓').setDepth(9001);
      const cancel = this.makeBuildButton(0xff4136, '✕').setDepth(9001);

      this.buildPlacement = { def, ghost, check, cancel, tileX, tileY, valid: false, dragging: false, moving };
      this.refreshGhost();
    }

    private cancelBuildPlacement(): void {
      const bp = this.buildPlacement;
      if (!bp) return;
      this.buildPlacement = null;
      bp.ghost.destroy();
      bp.check.destroy();
      bp.cancel.destroy();
      // Cancelar una reubicación sin confirmar → restaurar el edificio en su sitio.
      if (bp.moving) this.spawnBuilding(bp.moving);
    }

    /** Cierra el ghost actual reseteando además el estado del servicio. */
    private closePlacement(): void {
      if (this.reg.cityBuild.placementMode$.value) this.reg.cityBuild.cancelPlacement();
      this.cancelBuildPlacement();
    }

    /** Botón circular (✓ / ✕) como container para colocarlo en coordenadas de mundo. */
    private makeBuildButton(color: number, symbol: string): Phaser.GameObjects.Container {
      const R = 40;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, R);
      g.lineStyle(5, 0x000000, 1);
      g.strokeCircle(0, 0, R);
      const t = this.add.text(0, 0, symbol, {
        fontSize: '52px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#000000', strokeThickness: 6,
      }).setOrigin(0.5);
      return this.add.container(0, 0, [g, t]);
    }

    /** Recalcula validez (colisión + límites) y actualiza tinte + botones. */
    private refreshGhost(): void {
      const bp = this.buildPlacement;
      if (!bp) return;
      const { x, y } = this.buildingCenterPx(bp.tileX, bp.tileY);
      bp.ghost.setPosition(x, y);

      const TS    = GameScene.TILE_SIZE;
      const half  = (bp.def.frameSize * bp.def.scale) / 2;
      const tiles = this.computeFootprintTiles(x, y, half);
      const inBounds =
        Math.floor((x - half) / TS) >= 0 && Math.floor((y - half) / TS) >= 0 &&
        Math.floor((x + half - 1) / TS) < this.currentMap.width &&
        Math.floor((y + half - 1) / TS) < this.currentMap.height;
      const free = tiles.every(k => !this.collisionTiles.has(k));
      bp.valid = inBounds && free;

      bp.ghost.setTint(bp.valid ? 0x66ff66 : 0xff5555);

      // Botones por encima del ghost: ✓ a la derecha, ✕ a la izquierda
      const by = y - half - 50;
      bp.check.setPosition(x + 70, by);
      bp.cancel.setPosition(x - 70, by);
      bp.check.setVisible(bp.valid);   // el check solo aparece si se puede colocar
    }

    private handleBuildPointer(pointer: Phaser.Input.Pointer): void {
      const bp = this.buildPlacement;
      if (!bp) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // ¿Tocó un botón? (hit-test manual por distancia al centro en mundo)
      const HIT = 55;
      const onCheck  = bp.check.visible &&
        Phaser.Math.Distance.Between(world.x, world.y, bp.check.x, bp.check.y)  <= HIT;
      const onCancel =
        Phaser.Math.Distance.Between(world.x, world.y, bp.cancel.x, bp.cancel.y) <= HIT;

      if (onCancel) { this.closePlacement(); return; }
      if (onCheck && bp.valid) { this.confirmBuildPlacement(); return; }

      // Si no, mover el ghost al tile tocado e iniciar el arrastre (pointermove
      // lo seguirá mientras se mantenga pulsado).
      bp.dragging = true;
      this.moveGhostToPointer(pointer);
    }

    /** Mueve el ghost al tile bajo el puntero y reevalúa validez. */
    private moveGhostToPointer(pointer: Phaser.Input.Pointer): void {
      const bp = this.buildPlacement;
      if (!bp) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      bp.tileX = Math.floor(world.x / GameScene.TILE_SIZE);
      bp.tileY = Math.floor(world.y / GameScene.TILE_SIZE);
      this.refreshGhost();
    }

    private confirmBuildPlacement(): void {
      const bp = this.buildPlacement;
      if (!bp || !bp.valid) return;
      const b: PlacedBuilding = { type: bp.def.type, tileX: bp.tileX, tileY: bp.tileY };
      if (bp.moving) {
        this.reg.cityBuild.move(bp.moving, { tileX: bp.tileX, tileY: bp.tileY });  // reubica
      } else {
        this.reg.cityBuild.add(b);   // persiste (global, compartido) + notifica a Angular
      }
      this.spawnBuilding(b);         // construcción permanente con colisión en su sitio nuevo
      bp.moving = undefined;         // ya gestionado → que el cleanup no restaure el original
      this.closePlacement();         // limpia ghost/botones
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
        // Si existe una textura con la propia spriteKey → es un spritesheet (frames numerados 0..N-1).
        // Si no → frames sueltos (una textura por frame: `${animKey}_${i}`).
        let frames;
        if (this.textures.exists(animKey)) {
          frames = this.anims.generateFrameNumbers(animKey, { start: 0, end: cfg.frameCount - 1 });
        } else {
          frames = [];
          for (let i = 1; i <= cfg.frameCount; i++) {
            if (this.textures.exists(`${animKey}_${i}`)) frames.push({ key: `${animKey}_${i}` });
          }
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
        // No hubo objetivo: la skill no se lanza, así que devolvemos el maná gastado.
        if (cfg.manaCost) {
          const ps = this.reg.playerState;
          const state = ps?.snapshot();
          if (state) ps.setMp(Math.min(state.mp + cfg.manaCost, state.mpMax));
        }
        return;
      }
      // Skills melee: el personaje reproduce su animación de ataque al lanzar.
      if (cfg.playerAnim) this.player.playerAttack();
      if (cfg.effectType === 'projectile') {
        this.launchProjectile(cfg, damage, target);
      } else {
        this.playImpact(cfg, damage, target);
      }
    }

    /** Crea el sprite de un efecto de skill con la textura inicial correcta:
     *  spritesheet (textura única `spriteKey`, frame 0) o frames sueltos (`${spriteKey}_1`). */
    private addSkillSprite(cfg: SkillConfig, x: number, y: number): Phaser.GameObjects.Sprite {
      return this.textures.exists(cfg.spriteKey)
        ? this.add.sprite(x, y, cfg.spriteKey, 0)
        : this.add.sprite(x, y, `${cfg.spriteKey}_1`);
    }

    private playImpactSelf(cfg: SkillConfig): void {
      const pos = this.player.getPosition();
      const playerSprite = this.player.getSprite();
      const sprite = this.addSkillSprite(cfg, pos.x, pos.y - playerSprite.displayHeight * 0.5);
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
      const sprite = this.addSkillSprite(cfg, pos.x, pos.y);
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
      const proj = this.addSkillSprite(cfg, playerPos.x, playerPos.y);
      proj.setDepth(5);
      proj.setScale(cfg.scale);
      if (this.anims.exists(cfg.spriteKey)) {
        // projectileOnce: una sola pasada (no loop), para sprites con impacto al final
        proj.play(cfg.projectileOnce ? { key: cfg.spriteKey, repeat: 0 } : cfg.spriteKey);
      }
      proj.setRotation(Phaser.Math.Angle.Between(playerPos.x, playerPos.y, targetPos.x, targetPos.y));
      const dist = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, targetPos.x, targetPos.y);
      let duration = (dist / (cfg.speed ?? 400)) * 1000;
      // El viaje no dura más que una pasada de la animación → no se repite mientras vuela
      if (cfg.projectileOnce) duration = Math.min(duration, (cfg.frameCount / cfg.frameRate) * 1000);
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
