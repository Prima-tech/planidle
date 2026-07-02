import { Enemy } from "src/app/enemy/enemy";
import { ActionConfig, ENEMY_REGISTRY, EnemyTypeConfig, ANIMAL_TYPES, rollDamageVariance } from "src/app/enemy/enemy-config";
import { AnimationService } from "./animation.service";
import { GridControls } from "src/app/physics/gridcontrols";
import { GridDrops, ITEM_CATALOG } from "src/app/physics/griddrops";
import { GridPhysics } from "src/app/physics/gridphisics";
import { MobileInput, MOBILE_INPUT_KEY, MinimapData, MinimapTerrain, MINIMAP_DATA_KEY } from "src/app/scenes/mobile-hud.scene";
import { Direction } from "src/app/pnj/interfaces/Direction";
import { Player } from "src/app/pnj/player/player";
import { bodySpriteFor } from "src/app/pnj/player/body-config";
import { MapConfig, SpawnConfig, SpawnTracker, PortalConfig, MAP_ELITE_THRESHOLD, MAP_OBLIVION_THRESHOLD, ENEMY_RESPAWN_MS, ORE_RESPAWN_MS, TREE_RESPAWN_MS } from "./map-config";
import { GameRegistry } from "../game-registry";
import { InventoryItem } from "src/app/services/inventory.service";
import { HarvestKind, HarvestKindId, HARVEST_KINDS, miningTier, gemTier, treeTier, MiningTier } from "./harvest-config";
import { EQUIP_LAYER_REGISTRY, EquipLayerConfig } from "src/app/pnj/player/equip-layer-registry";
import { SKILL_REGISTRY, SkillConfig } from "src/app/services/skill-config";
import { SPHERE_MULT } from "src/app/services/talent.service";
import { NATIVE_DPR, playerTags } from "./constants";
import { spawnFloatingText } from "./floating-text";
import { BuildableDef, PlacedBuilding, stationFrameRect } from "src/app/services/city-build.service";
import { HOME_CHEST_ID } from "src/app/services/town-chest.service";
import { PARALLAX_THEMES, ParallaxThemeId, ParallaxLayer, ParallaxTheme } from "./parallax-themes";
import { Subscription } from "rxjs";
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
  /** Cofres de ciudad: ID de su almacén independiente. */
  chestId?: string;
}

// Recolección de recursos del mapa (rocas con pico, árboles con hacha…).
/** NPCs fijos de la ciudad (Asgard): personajes decorativos quietos (idle mirando
 *  abajo). `name` = nombre en body-config (bodySpriteFor) para cargar su hoja;
 *  `texKey` = clave de textura propia. Añadir uno = una línea más aquí. */
const CITY_NPCS: { name: string; texKey: string; tileX: number; tileY: number }[] = [
];

/** NPCs reclutables: aparecen en un mapa concreto (no el hogar) hasta que se les
 *  habla. Al hablarles sueltan su frase, ponen un flag global que desbloquea su
 *  personaje (aparece en el roster) y dejan de aparecer: la próxima vez que se
 *  entra al mapa ya no están (el spawn se salta si el personaje está desbloqueado).
 *  `name` debe existir en body-config (bodySpriteFor) y en ROSTER_TEMPLATE. */
const RECRUIT_NPCS: { name: string; texKey: string; mapId: string; tileX: number; tileY: number; charFlag: string }[] = [
  { name: 'Kugo',    texKey: 'npc_kugo',    mapId: '1-1', tileX: 33, tileY: 25, charFlag: 'char_kugo' },
  { name: 'Italien', texKey: 'npc_italien', mapId: '1-1', tileX: 27, tileY: 25, charFlag: 'char_italien' },
  { name: 'Rake',    texKey: 'npc_rake',    mapId: '1-1', tileX: 30, tileY: 22, charFlag: 'char_rake' },
];

// Nodo recolectable colocado en el mapa. Ocupa una huella de tiles (todas en
// `tileKeys` para la colisión).
interface HarvestNode {
  sprite: Phaser.GameObjects.Image;
  hits: number;          // (legacy) contador de golpes; el destruir va por mineHp
  mineHp?: number;       // vida restante del recurso (mena/gema/árbol); se destruye al llegar a 0
  mineHpMax?: number;    // vida inicial (para barra/feedback)
  tileKeys: string[];
  kind: HarvestKindId;
  // Barra de vida: se crea/muestra en cuanto el recurso baja del 100% de vida.
  hpBarTrack?: Phaser.GameObjects.Rectangle;
  hpBarFill?:  Phaser.GameObjects.Rectangle;
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
    // Portales vivos en la escena. Siempre abiertos: ya no se desbloquean matando.
    private activePortals: {
      config: PortalConfig;
      sprite: Phaser.GameObjects.Sprite;
    }[] = [];
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
    // true desde que ESTE apretón del botón de acción abrió un cofre o una ventana
    // de edificio. Sirve para (a) no reabrir la ventana cada frame y (b) no soltar
    // un golpe cuando el cofre/ventana deja de contar como "cercano" tras abrirse.
    private interactLatched = false;
    // Construcciones colocadas por el jugador (no el cofre fijo): para poder
    // quitarlas en caliente (borrar todo) o moverlas.
    private placedBuildings: {
      building: PlacedBuilding;
      sprite: Phaser.GameObjects.Sprite;
      blocked: string[];
      chestEntry?: ActiveChest;
      isOpenUnsub?: () => void;
      shadow?: Phaser.GameObjects.Ellipse;
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
    // Caché de color medio por tile para el minimapa: clave `tilesetName:index` → rgb
    // (0xRRGGBB) o -1 si el tile es (casi) transparente. Estática: persiste entre mapas.
    private static mmTileColors = new Map<string, number>();
    /** Tilesets que el minimapa ignora (decoración: hierbas/flores del mapgen). */
    private static readonly MM_DECOR_TILESETS = new Set(['Details']);
    private mmSampleCanvas?: HTMLCanvasElement;
    // NPCs vivos en la escena para detectar cercanía y hablar (fijos de la ciudad +
    // reclutables). `recruit` solo lo llevan los reclutables (Kugo en 1-1).
    private cityNpcs: { sprite: Phaser.GameObjects.Sprite; x: number; y: number; name: string; recruit?: typeof RECRUIT_NPCS[0] }[] = [];
    // Parallax de mar profundo detrás del mapa (cubre el borde azul del juego con
    // dos capas que derivan a distinta velocidad → sensación de profundidad).
    private pxFar?:  Phaser.GameObjects.TileSprite;
    private pxNear?: Phaser.GameObjects.TileSprite;
    private pxImage?: Phaser.GameObjects.Image;   // base de los temas 'scenic'
    private pxWarp?: Phaser.GameObjects.Graphics; // estelas del tema 'warp'
    private pxWarpP: { nx: number; fy: number; spd: number; ci: number }[] = [];
    private pxWarpStart = 0;   // pxTime al activar el warp (para la rampa de despegue)
    private pxTime = 0;
    private pxTheme: ParallaxTheme = PARALLAX_THEMES['sea'];
    private pxSub?: Subscription;
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
    // Cofre central del mapa (cofre 2): fixture propio (no es construcción del jugador).
    // Abre una ventana a la izquierda (placeholder) vía requestOpenWindow('mapChest').
    private mapChest: { sprite: Phaser.GameObjects.Sprite; blocked: string[] } | null = null;
    // Cache del "qué tienes cerca" (cofre/tienda/recurso): son comprobaciones O(n)
    // sobre cofres/edificios/nodos. Recalcularlas CADA frame (120/seg) es CPU
    // tirada; se refrescan cada pocos frames (sigue siendo instantáneo en la práctica).
    private interactFrame = 0;
    private cachedNearChest:  typeof this.activeChests[0]    | null = null;
    private cachedNearMapChest = false;
    private cachedNearWindow: typeof this.placedBuildings[0] | null = null;
    private cachedNearNode:   HarvestNode | null = null;
    private cachedNearNpc:    typeof this.cityNpcs[0] | null = null;
    // true una vez el jugador ha estado cerca de un edificio con ventana abierta:
    // a partir de ahí, alejarse la cierra (ver bloque de cierre por proximidad).
    private windowProximityArmed = false;
    // Estación cuyo menú se está abriendo (candidata a encender) y la que está
    // encendida ahora mismo. Se sincronizan con cityBuild.windowOpen$ (ver create()).
    private pendingLitBuilding: typeof this.placedBuildings[0] | null = null;
    private litBuilding:        typeof this.placedBuildings[0] | null = null;
    private windowOpenSub: { unsubscribe(): void } | null = null;
    private forgeProducingSub: { unsubscribe(): void } | null = null;
    private statsSub:    { unsubscribe(): void } | null = null;
    private gridSub:     { unsubscribe(): void } | null = null;
    private gridLayer:   Phaser.GameObjects.Container | null = null;   // overlay de rejilla de tiles (debug)
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
    private autoTargetMarker: Phaser.GameObjects.Text | null = null; // "▼" sobre el objetivo actual
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

      // Cuerpo del personaje seleccionado (Gutts tiene modelo propio; el resto main).
      // Forzamos recarga quitando la textura anterior: al cambiar de personaje el
      // loader, si no, reutilizaría la cacheada y no actualizaría el modelo.
      if (this.textures.exists('player')) {
        this.textures.remove('player');
        // Las animaciones del cuerpo (player_*) se crean una sola vez (makeAnim tiene
        // guard `exists`) y guardan referencias DIRECTAS a los frames de la textura.
        // Al quitar la textura esos frames quedan destruidos; si no recreamos las anims,
        // reproducirlas apunta a un frame nulo → crash 'sourceSize' (visible sobre todo
        // al cambiar de personaje, cuando la textura pasa a otra imagen). Las borramos
        // para que initPlayerAnimation las reconstruya contra la textura nueva.
        for (const tag of [playerTags.WALK, playerTags.IDLE, playerTags.ATTACK, playerTags.THRUST, playerTags.DEATH]) {
          for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
            this.anims.remove(tag + dir);
          }
        }
      }
      this.load.spritesheet('player', bodySpriteFor(this.reg.asgard?.selectedPlayer?.name), { frameWidth: 64, frameHeight: 64 });
      // NPCs fijos de la ciudad: sus cuerpos solo hacen falta en el hogar (Asgard).
      if (this.reg.world.getCurrentMap()?.id === 'hogar') {
        for (const n of CITY_NPCS) {
          if (!this.textures.exists(n.texKey)) {
            this.load.spritesheet(n.texKey, bodySpriteFor(n.name), { frameWidth: 64, frameHeight: 64 });
          }
        }
      }
      // NPCs reclutables del mapa actual (p.ej. Kugo e Italien en 1-1): cargan su cuerpo
      // solo mientras no se hayan reclutado (si ya están desbloqueados no aparecen).
      const recruitMapId = this.reg.world.getCurrentMap()?.id;
      for (const recruit of RECRUIT_NPCS.filter(r => r.mapId === recruitMapId)) {
        if (!this.reg.unlocks?.isCharacterUnlocked(recruit.name) && !this.textures.exists(recruit.texKey)) {
          this.load.spritesheet(recruit.texKey, bodySpriteFor(recruit.name), { frameWidth: 64, frameHeight: 64 });
        }
      }
      this.load.spritesheet('drop_coin', 'assets/sprites/resources/coin.png', { frameWidth: 16, frameHeight: 16 });
      this.load.spritesheet('chests', 'assets/sprites/resources/chests.png', { frameWidth: 32, frameHeight: 32 });
      // Estaciones de oficio (construibles). Cargada como imagen: las filas miden
      // 70.4px, así que registramos los frames a mano en registerStationAnimations().
      this.load.image('stations', 'assets/sprites/stations/stations.png');
      // Fragua apagada (textura propia 64×92, sin animación de fuego).
      this.load.spritesheet('forge_off', 'assets/sprites/stations/forge_off.png', { frameWidth: 64, frameHeight: 92 });
      // Fundición apagada (frame de la hoja stations con el fuego retirado, 64×92).
      this.load.spritesheet('smelter_off', 'assets/sprites/stations/smelter_off.png', { frameWidth: 64, frameHeight: 92 });
      // Hornos detallados (reemplazan a la fragua). Cada uno: hoja encendida de 12
      // frames 128×208 (animación de fuego) + textura apagada del mismo tamaño.
      // city-build elige cuál con su spriteKey (…_off); cambiar de horno = 1 línea.
      for (const f of ['furnace_central', 'furnace_lvl1']) {
        this.load.spritesheet(f,          `assets/sprites/stations/${f}.png`,     { frameWidth: 128, frameHeight: 224 });
        this.load.spritesheet(`${f}_off`, `assets/sprites/stations/${f}_off.png`, { frameWidth: 128, frameHeight: 224 });
      }
      // Imagen escénica para los temas de parallax 'scenic_*' (vista de mundo).
      this.load.image('paralax_scene', 'assets/sprites/resources/paralax.jpg');
      // portal_01.png: 4 col × 4 fila (128×192), cada fila es un portal de 4 frames
      // (32×48). Fila 0 azul (back), fila 2 naranja (next). Los portales van siempre
      // abiertos (ya no hay variante gris "bloqueada").
      this.load.spritesheet('portal', 'assets/sprites/resources/portal_01.png', { frameWidth: 32, frameHeight: 48 });

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
      this.load.image('madera', 'assets/icon/resources/madera_t1.png');   // drop de Madera (icono #19)
      this.load.image('crushed_stone', 'assets/icon/resources/mining/polvo.png');   // (carbón reutiliza este sprite)

      // Hoja de iconos (Icons.png) como spritesheet 32px: sprite del drop de mineral
      // (frame 17 = icono #23). Mismo frame que el icono de inventario.
      this.load.spritesheet('icons_sheet', 'assets/icon/icons/Icons.png', { frameWidth: 32, frameHeight: 32 });

      // Recursos recolectables (se colocan en mapas que no son el hogar)
      // Menas por tier (el mapa decide cuál spawnea via MapConfig.mineTier).
      this.load.image('rock_tier1', 'assets/sprites/map/skills/rocks/tier1_rock.png');
      this.load.image('rock_tier2', 'assets/sprites/map/skills/rocks/tier2_rock.png');
      this.load.image('rock_tier3', 'assets/sprites/map/skills/rocks/tier3_rock.png');
      this.load.image('rock_tier4', 'assets/sprites/map/skills/rocks/tier4_rock.png');
      this.load.image('rock_tier5', 'assets/sprites/map/skills/rocks/tier5_rock.png');
      this.load.image('rock_tier6', 'assets/sprites/map/skills/rocks/tier6_rock.png');
      this.load.image('rock_tier7', 'assets/sprites/map/skills/rocks/tier7_rock.png');
      this.load.image('rock_tier8', 'assets/sprites/map/skills/rocks/tier8_rock.png');
      this.load.image('rock_tier9', 'assets/sprites/map/skills/rocks/tier9_rock.png');
      this.load.image('rock_tier10', 'assets/sprites/map/skills/rocks/tier10_rock.png');
      this.load.image('rock_gem1', 'assets/sprites/map/skills/rocks/gem1_rock.png');
      this.load.image('rock_gem2', 'assets/sprites/map/skills/rocks/gem2_rock.png');
      this.load.image('rock_gem3', 'assets/sprites/map/skills/rocks/gem3_rock.png');
      this.load.image('rock_gem4', 'assets/sprites/map/skills/rocks/gem4_rock.png');
      this.load.image('rock_gem5', 'assets/sprites/map/skills/rocks/gem5_rock.png');
      this.load.image('rock_gem6', 'assets/sprites/map/skills/rocks/gem6_rock.png');
      this.load.image('rock_gem7', 'assets/sprites/map/skills/rocks/gem7_rock.png');
      this.load.image('rock_gem8', 'assets/sprites/map/skills/rocks/gem8_rock.png');
      this.load.image('rock_gem9', 'assets/sprites/map/skills/rocks/gem9_rock.png');
      this.load.image('rock_gem10', 'assets/sprites/map/skills/rocks/gem10_rock.png');
      this.load.image('mineral_tier2', 'assets/icon/resources/mining/tier2_drop.png');
      this.load.image('mineral_tier3', 'assets/icon/resources/mining/tier3_drop.png');
      this.load.image('mineral_tier4', 'assets/icon/resources/mining/tier4_drop.png');
      this.load.image('mineral_tier5', 'assets/icon/resources/mining/tier5_drop.png');
      this.load.image('mineral_tier6', 'assets/icon/resources/mining/tier6_drop.png');
      this.load.image('mineral_tier7', 'assets/icon/resources/mining/tier7_drop.png');
      this.load.image('mineral_tier8', 'assets/icon/resources/mining/tier8_drop.png');
      this.load.image('mineral_tier9', 'assets/icon/resources/mining/tier9_drop.png');
      this.load.image('mineral_tier10', 'assets/icon/resources/mining/tier10_drop.png');
      this.load.image('gem_tier1', 'assets/icon/resources/gems/gem1_drop.png');
      this.load.image('gem_tier2', 'assets/icon/resources/gems/gem2_drop.png');
      this.load.image('gem_tier3', 'assets/icon/resources/gems/gem3_drop.png');
      this.load.image('gem_tier4', 'assets/icon/resources/gems/gem4_drop.png');
      this.load.image('gem_tier5', 'assets/icon/resources/gems/gem5_drop.png');
      this.load.image('gem_tier6', 'assets/icon/resources/gems/gem6_drop.png');
      this.load.image('gem_tier7', 'assets/icon/resources/gems/gem7_drop.png');
      this.load.image('gem_tier8', 'assets/icon/resources/gems/gem8_drop.png');
      this.load.image('gem_tier9', 'assets/icon/resources/gems/gem9_drop.png');
      this.load.image('gem_tier10', 'assets/icon/resources/gems/gem10_drop.png');
      // Árboles por tier (MapConfig.treeTier, default 1).
      this.load.image('tree_tier1', 'assets/sprites/map/skills/trees/tree_tier1.png');
      this.load.image('tree_tier2', 'assets/sprites/map/skills/trees/tree_tier2.png');
      this.load.image('tree_tier3', 'assets/sprites/map/skills/trees/tree_tier3.png');
      this.load.image('madera_tier2', 'assets/icon/resources/madera_t2.png');
      this.load.image('madera_tier3', 'assets/icon/resources/madera_t3.png');

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

      // Datos de animación del agua (fotogramas de orillas/agua del pack). Ver initWaterAnimation().
      if (!this.cache.json.exists('water-anims'))
        this.load.json('water-anims', 'assets/tilemaps/biomas/grasslands/water-anims.json');

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
      // Animales de caza: spawnean en todos los mapas no-hogar → cargar siempre.
      if (mapCfg.id !== 'hogar') for (const t of ANIMAL_TYPES) typesToLoad.add(t);
      for (const type of typesToLoad) {
        const cfg = ENEMY_REGISTRY[type];
        if (!cfg) continue;
        const baseType = cfg.spriteType ?? type;
        const base = cfg.spriteBase ?? `assets/sprites/enemy/${baseType}`;
        for (const [action, actionCfg] of Object.entries(cfg.actions) as [string, ActionConfig][]) {
          const key = `${baseType}_${action}`;
          if (!this.textures.exists(key)) {
            this.load.spritesheet(
              key,
              `${base}/${actionCfg.filename}.png`,
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
      this.activePortals = [];
      this.autoTarget = null;
      this.autoStuckMs = 0;
      this.autoBlacklist.clear();
      this.placedBuildings = [];
      this.nodes = [];
      this.cityNpcs = [];
      this.activeHarvest = null;
      this.moveSelecting = false;
      this.deleteSelecting = false;
      this.interactLatched = false;
      this.currentMapConfig = this.reg.world.getCurrentMap();

      // Si el personaje quedó AFK explorando, loadCharacter restauró su actividad como
      // 'exploring': en vez de montar el mapa de combate, rebotamos al Modo Mundo. El
      // preload ya recargó la textura 'player' del personaje seleccionado, y aquí
      // todavía no hemos creado ningún sprite ni lanzado el HUD, así que arrancar
      // WorldRunScene es seguro (mismo camino que el portal de entrada). entryMapId =
      // último mapa de combate donde estaba (de ahí resume la distancia explorada).
      if (this.reg.activity?.current === 'exploring') {
        this.scene.start('WorldRunScene', { entryMapId: this.currentMapConfig.id });
        this.scene.stop();
        return;
      }

      // GameScene NUNCA es Modo Mundo: aseguramos runMode=false (si quedara en true tras
      // salir del runner, el footer ocultaría el minimapa/tienda y dejaría la UI de
      // carrera encima, impidiendo abrir los menús de ciudad).
      this.reg.playerBridge.setRunMode(false);

      this.animService      = new AnimationService(this);
      this.reg.mapStats?.reset();
      // Actividad AFK: si el personaje quedó recolectando (mining/chopping), conservamos
      // esa actividad — loadCharacter la restauró del snapshot y seguía minando/talando
      // cuando se desconectó, no peleando (vuelve a 'killing' al atacar un enemigo). Los
      // portales limpian el mining/chopping colgado, así que aquí solo sobrevive tras un
      // reload. En cualquier otro caso manda el mapa: con enemigos = matando, sin = idle.
      const resumed = this.reg.activity?.current;
      if (this.currentMapConfig.id === 'hogar') {
        // El hogar es zona segura: nunca se pelea/mina/tala ahí. Forzamos idle SIEMPRE
        // (incluso si se venía recolectando), porque al teletransportarse a la ciudad
        // desde el mapa no se cruza un portal y la actividad colgada seguiría contando
        // AFK (minando/talando) dentro de la ciudad.
        this.reg.activity?.set('idle');
      } else if (resumed !== 'mining' && resumed !== 'chopping') {
        this.reg.activity?.set((this.currentMapConfig.spawns?.length ?? 0) > 0 ? 'killing' : 'idle');
      }

      // Inmediato: lo mínimo para que el primer frame sea válido
      this.initMap();
      this.initDebugGrid();
      this.initPlayer();
      this.initCamera();
      this.initParallax();
      this.mobileInput = { direction: Direction.NONE, lastCardinalDir: Direction.DOWN, isAttackHeld: false };
      this.registry.set(MOBILE_INPUT_KEY, this.mobileInput);
      this.registry.set(MINIMAP_DATA_KEY, this.buildMinimapData());
      this.scene.launch('MobileHUDScene');
      this.createPhysics();
      this.createGameControls();
      this.initLevelUpWatcher();
      // Entrada en negro: arrancamos opaco y revelamos cuando el trabajo pesado de
      // la escena (el delayedCall de abajo) ya ha pasado, no a ciegas. Así el tirón
      // de la carga ocurre con la pantalla quieta en negro y el fade-in sale suave.
      // (El fade-OUT al salir por un portal es corto, 250ms, para que se sienta ágil.)
      this.cameras.main.fadeOut(0, 0, 0, 0);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scene.stop('MobileHUDScene');
        this.mobileInput = null;
        this.gridSub?.unsubscribe();
        this.equipSub?.unsubscribe();
        this.gatherLayerSub?.unsubscribe();
        this.summonSub?.unsubscribe();
        this.itemDropSub?.unsubscribe();
        this.dropToWorldSub?.unsubscribe();
        this.chestSub?.unsubscribe();
        this.placementSub?.unsubscribe();
        this.clearedSub?.unsubscribe();
        this.windowOpenSub?.unsubscribe();
        this.forgeProducingSub?.unsubscribe();
        this.moveSub?.unsubscribe();
        this.deleteSub?.unsubscribe();
        this.removedSub?.unsubscribe();
        this.pxSub?.unsubscribe();
        this.pxWarpP.length = 0;
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
        this.mapChest = null;
        this.cachedNearMapChest = false;
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
        this.registerStationAnimations();
        this.initSpawns();
        this.initAnimalSpawns();
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
        if (this.currentMapConfig.id === 'hogar') this.initCityNpcs();
        this.initRecruitNpcs();
        this.initHarvestNodes();
        this.initStatsListener();
        this.registerSkillAnimations();
        this.initSkillListener();
        this.initSkillTargetChecker();
        this.initPet();
        // Pesado terminado → margen de un par de frames para que el stall de subida
        // de texturas a GPU pase con la pantalla quieta en negro, y revelar suave.
        this.time.delayedCall(60, () => this.cameras.main.fadeIn(400, 0, 0, 0));
        this.time.delayedCall(600, () => this.reg.playerBridge?.emitSceneReady());
      });
    }

    override update(_time: number, delta: number) {
      const __t0 = performance.now();

      // Tras tocar un portal: el jugador frena en seco y se queda quieto durante el
      // fundido (sin input, sin automatización, sin físicas), en vez de seguir
      // andando mientras la cámara hace fade. Da sensación de "entrar" al portal.
      if (this.portalCooldown) {
        this.reg.autoAttack?.pauseAutomation();
        this.gridPhysics.stop();
        this.player.syncLayers();
        return;
      }

      // Colocando/moviendo/borrando un edificio: el PJ se queda quieto (el toque y el
      // arrastre son para el ghost, no para mover). El fondo sí sigue animándose.
      if (this.buildPlacement || this.moveSelecting || this.deleteSelecting) {
        this.reg.autoAttack?.pauseAutomation();
        this.gridPhysics.stop();
        this.player.syncLayers();
        this.updateParallax(delta);
        return;
      }

      this.gridControls.update();
      this.updateParallax(delta);

      // Input manual (ataque o movimiento) → pausa la automatización unos segundos
      const auto = this.reg.autoAttack;
      if (this.mobileInput?.isAttackHeld || this.gridControls.hasManualInput()) {
        auto?.pauseAutomation();
      }
      const autoPaused = auto?.isPausedByManual ?? false;
      if (auto?.isEnabled && !autoPaused) this.runAutoAttack(delta);
      if (auto?.skillsEnabled && !autoPaused) this.runAutoSkills(delta);
      this.updateAutoTargetMarker(auto?.isEnabled === true && !autoPaused);
      this.gridPhysics.update(delta);

      // Contexto del botón de acción: cofre cerca → abrir cofre; si no, tienda
      // (u otro edificio con ventana) cerca → abrir ventana; si no → atacar.
      // Refresca el "qué tienes cerca" cada 4 frames, no cada frame → menos CPU.
      if ((this.interactFrame++ & 3) === 0) {
        this.cachedNearChest    = this.nearestOpenableChest();
        this.cachedNearMapChest = this.cachedNearChest ? false : this.nearMapChest();
        this.cachedNearWindow   = (this.cachedNearChest || this.cachedNearMapChest) ? null : this.nearestWindowBuilding();
        this.cachedNearNode     = (!this.cachedNearChest && !this.cachedNearMapChest && !this.cachedNearWindow) ? this.nearestHarvestable() : null;
        this.cachedNearNpc      = (!this.cachedNearChest && !this.cachedNearMapChest && !this.cachedNearWindow && !this.cachedNearNode) ? this.nearestNpc() : null;
      }
      const nearChest = this.cachedNearChest;
      const nearMapChest = this.cachedNearMapChest;
      const nearWindow = this.cachedNearWindow;
      const nearNode = this.cachedNearNode;
      const nearNpc = this.cachedNearNpc;
      // La herramienta es "pegajosa": al encarar un recurso se muestra y se MANTIENE
      // aunque te alejes. Solo se quita al atacar a un enemigo / otra acción (strike).
      if (nearNode) this.setActiveHarvest(nearNode.kind);
      this.reg.interaction?.setContext(
        nearChest ? 'chest'
        : nearMapChest ? 'chest'
        : nearWindow ? (nearWindow.building.type === 'shop' ? 'shop' : 'forge')
        : nearNode ? HARVEST_KINDS[nearNode.kind].context
        : nearNpc ? 'talk' : 'attack');

      // Diálogo abierto + ya no hay NPC cerca → cerrarlo (te alejaste).
      if (!nearNpc && this.reg.dialogue?.isOpen) this.reg.dialogue.dismiss();

      // Si la ventana de cofre de ciudad está abierta y el jugador se alejó del
      // cofre CONCRETO que abrió (cada cofre es su propio almacén) → cerrar.
      const openChestId = this.reg.summon.townChestIsOpen$.value;
      if (openChestId) {
        const pos   = this.player.getPosition();
        const range = GameScene.CHEST_INTERACT_RANGE;
        const near = this.activeChests.some(c => {
          if (!c.isTownChest || c.chestId !== openChestId) return false;
          // Bordes del sprite (coherente con nearestOpenableChest): si no, al estar
          // pegado a un cofre grande lo daría por "lejos" y lo cerraría al instante.
          const b = c.sprite.getBounds();
          const dx = Math.max(b.left - pos.x, 0, pos.x - b.right);
          const dy = Math.max(b.top  - pos.y, 0, pos.y - b.bottom);
          return dx * dx + dy * dy <= range * range;
        });
        if (!near) this.reg.summon.townChestCloseRequest$.next();
      }

      // Ventana de edificio (tienda/fragua) abierta: se cierra al ALEJARTE, pero solo
      // tras haber estado cerca al menos una vez (windowProximityArmed). Si no, pulsar
      // el edificio desde lejos lo abriría y el mismo frame lo cerraría (parecía que "no
      // pasaba nada"): el jugador no se mueve hacia el edificio al pulsarlo.
      if (this.reg.cityBuild?.windowOpen$.value) {
        if (this.nearestWindowBuilding() || this.nearMapChest()) {
          this.windowProximityArmed = true;
        } else if (this.windowProximityArmed) {
          this.reg.cityBuild.requestCloseWindow();
        }
      } else {
        this.windowProximityArmed = false;   // ventana cerrada → re-armar para la próxima
      }

      // Botón de acción: cofre cerca → abrir; tienda cerca → abrir su ventana
      // (una sola vez por pulsación, vía latch); si no → golpear.
      // El latch marca que este apretón ya interactuó: así, cuando el cofre/ventana
      // deja de contar como "cercano" tras abrirse (p.ej. el cofre de ciudad sale de
      // nearestOpenableChest al abrirse), el botón aún pulsado NO suelta un golpe.
      if (this.mobileInput?.isAttackHeld) {
        if (nearChest) {
          if (!this.interactLatched) {
            this.interactLatched = true;
            this.openChest(nearChest);
          }
        } else if (nearMapChest) {
          if (!this.interactLatched) {
            this.interactLatched = true;
            this.reg.cityBuild.requestOpenWindow('mapChest');
          }
        } else if (nearWindow) {
          if (!this.interactLatched) {
            this.interactLatched = true;
            this.pendingLitBuilding = nearWindow;
            this.reg.cityBuild.requestOpenWindow(nearWindow.building.type);
          }
        } else if (nearNpc) {
          if (!this.interactLatched) {
            this.interactLatched = true;
            this.talkToNpc(nearNpc);
          }
        } else if (!this.player.isAttacking && !this.interactLatched) {
          this.strike();
        }
      } else {
        this.interactLatched = false;   // botón soltado → permite reabrir
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
    /** Flechita "▼" flotando sobre el objetivo actual del auto-ataque: con varios
     *  enemigos en pantalla hace legible a por cuál va el personaje. Se oculta sin
     *  objetivo, con el auto apagado o pausado por input manual. */
    private updateAutoTargetMarker(autoActive: boolean): void {
      // El restart de escena destruye el texto pero el campo sobrevive (la instancia
      // de GameScene se reutiliza) → soltar la referencia muerta.
      if (this.autoTargetMarker && !this.autoTargetMarker.active) this.autoTargetMarker = null;

      const t = this.autoTarget;
      if (!autoActive || !t || t.isDead || !t.sprite?.active) {
        this.autoTargetMarker?.setVisible(false);
        return;
      }
      if (!this.autoTargetMarker) {
        this.autoTargetMarker = this.add.text(0, 0, '▼', {
          fontSize: '26px', color: '#ffd700', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 5,
        }).setOrigin(0.5, 1).setDepth(6000);
      }
      const bob = Math.sin(this.time.now / 160) * 3;   // balanceo suave
      this.autoTargetMarker
        .setVisible(true)
        .setPosition(t.sprite.x, t.sprite.y - t.sprite.displayHeight * 0.45 + bob);
    }

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
      // La actividad AFK sigue el MODO recolección, no cada golpe suelto: con la
      // herramienta en mano (kind) estás minando/talando, y se mantiene estable entre
      // golpes; al soltarla (atacar a un enemigo / alejarte tras strike) vuelves a
      // pelear (mapa con enemigos) o a idle. Antes se fijaba por cada strike, así que
      // en un mapa de minado CON enemigos un golpe al aire/slime la volvía a 'killing'
      // y el snapshot guardaba combate aunque siguieras minando.
      if (kind) {
        this.reg.activity?.set(HARVEST_KINDS[kind].skill === 'woodcutting' ? 'chopping' : 'mining');
      } else {
        this.reg.activity?.set((this.currentMapConfig.spawns?.length ?? 0) > 0 ? 'killing' : 'idle');
      }
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
      this.initWaterAnimation();
    }

    /** Anima el agua reproduciendo los flipbooks de Tiled del pack (Phaser no lo hace solo).
     *  Recorre las casillas de las capas, detecta tiles animados (por tileset+id local vía
     *  water-anims.json) y cada 150ms les cambia el índice al siguiente fotograma → la espuma
     *  de las orillas se mueve. El timer se limpia solo al reiniciar la escena. */
    private initWaterAnimation(): void {
      const anims = this.cache.json.get('water-anims') as Record<string, Record<string, number[]>>;
      if (!anims) return;
      const map = this.currentMap;

      // La tabla se extrajo del pack GRANDE. Si el mapa usa la versión pequeña del
      // tileset (home01: Water_coasts de 612 tiles), los mismos números de tile son
      // OTRO dibujo y los fotogramas caen fuera del tileset → putTileAt con un gid
      // sin entrada en map.tiles revienta Phaser ("reading '2'"). Solo vale el
      // tileset cuyo tamaño alcanza el mayor fotograma de su tabla.
      const setOk = new Map<string, boolean>();
      for (const ts of map.tilesets) {
        const table = anims[ts.name];
        if (!table) { setOk.set(ts.name, false); continue; }
        let maxFrame = 0;
        for (const key of Object.keys(table)) for (const f of table[key]) if (f > maxFrame) maxFrame = f;
        setOk.set(ts.name, ts.total > maxFrame);
      }

      // celdas animadas: capa + posición + fotogramas ya en gid absoluto
      const cells: Array<{ layer: any; x: number; y: number; frames: number[] }> = [];
      for (const ld of map.layers) {
        const layer = ld.tilemapLayer;
        if (!layer) continue;
        for (let y = 0; y < map.height; y++) {
          for (let x = 0; x < map.width; x++) {
            const tile = ld.data[y]?.[x];
            if (!tile || tile.index < 0) continue;
            // tileset dueño de este gid = el de mayor firstgid <= index
            let name = null, firstgid = 0;
            for (const ts of map.tilesets)
              if (tile.index >= ts.firstgid && ts.firstgid >= firstgid) { name = ts.name; firstgid = ts.firstgid; }
            if (!name || !setOk.get(name)) continue;
            const table = anims[name];
            const frames = table && table[String(tile.index - firstgid)];
            if (!frames || !frames.length) continue;
            cells.push({ layer, x, y, frames: frames.map(f => firstgid + f) });
          }
        }
      }
      if (!cells.length) return;

      let frame = 0;
      this.time.addEvent({
        delay: 150, loop: true,
        callback: () => {
          frame++;
          for (const c of cells) c.layer.putTileAt(c.frames[frame % c.frames.length], c.x, c.y, false);
        },
      });
    }

    // ── Overlay de rejilla de tiles (debug de posiciones) ───────────────────────
    private initDebugGrid(): void {
      this.gridLayer = null;   // la escena se reutiliza; el container anterior ya murió en el shutdown
      const gs = this.reg.gameSettings;
      if (!gs) return;
      this.setGridVisible(gs.showGrid);
      this.gridSub = gs.showGrid$.subscribe((v: boolean) => this.setGridVisible(v));
    }

    private setGridVisible(on: boolean): void {
      if (on) { if (!this.gridLayer) this.buildDebugGrid(); }
      else    { this.gridLayer?.destroy(true); this.gridLayer = null; }
    }

    /** Dibuja líneas por tile (48px) + coordenadas cada 5 tiles. Por encima de todo. */
    private buildDebugGrid(): void {
      const TS = GameScene.TILE_SIZE;
      const W = this.currentMap.width, H = this.currentMap.height;
      const c = this.add.container(0, 0).setDepth(1000);

      const g = this.add.graphics();
      g.lineStyle(2, 0xffffff, 0.3);                       // líneas finas por tile
      for (let x = 0; x <= W; x++) g.lineBetween(x * TS, 0, x * TS, H * TS);
      for (let y = 0; y <= H; y++) g.lineBetween(0, y * TS, W * TS, y * TS);
      g.lineStyle(3, 0xffd700, 0.55);                      // líneas marcadas cada 5 tiles
      for (let x = 0; x <= W; x += 5) g.lineBetween(x * TS, 0, x * TS, H * TS);
      for (let y = 0; y <= H; y += 5) g.lineBetween(0, y * TS, W * TS, y * TS);
      c.add(g);

      for (let x = 0; x < W; x += 5) {
        for (let y = 0; y < H; y += 5) {
          c.add(this.add.text(x * TS + 3, y * TS + 2, `${x},${y}`,
            { fontSize: '18px', color: '#ffd700', fontStyle: 'bold' }));
        }
      }
      this.gridLayer = c;
    }

    initPlayer() {
      const playerSprite = this.physics.add.sprite(0, 0, "player");
      playerSprite.setDepth(2);
      playerSprite.scale = 2.5;
      // Seguimiento con lerp (0.2) en vez de clavado: la cámara "persigue" al jugador
      // con un pelín de retardo → sensación de peso/fluidez al moverse. roundPixels=true
      // mantiene el pixel-art nítido (sin shimmer). Subir hacia 1 = más rígido.
      this.cameras.main.startFollow(playerSprite, true, 0.2, 0.2);
      // Baja un poco al jugador en pantalla. Offset en unidades de mundo (~0.4 px-pantalla
      // por unidad): +75 ≈ 30px hacia abajo. Positivo = más abajo. Ajustar si hace falta.
      this.cameras.main.setFollowOffset(0, 75);
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
        terrain: this.buildMinimapTerrain(),
      };
    }

    /** Muestrea el color medio del suelo de cada tile para pintar el minimapa
     *  (hierba verde, agua azul…). Recorre todas las capas de abajo arriba: la
     *  última tile no vacía de cada celda gana (la superficie visible). */
    private buildMinimapTerrain(): MinimapTerrain | undefined {
      const map = this.currentMap;
      const W = map?.width  ?? 0;
      const H = map?.height ?? 0;
      if (!W || !H) return undefined;

      const data = new Uint32Array(W * H);   // 0 = vacío
      let any = false;
      for (const ld of map.layers) {
        const layer: Phaser.Tilemaps.TilemapLayer | null = ld.tilemapLayer;
        if (!layer) continue;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const tile = layer.getTileAt(x, y);
            if (!tile || tile.index < 0) continue;
            const packed = this.avgTileColor(tile.index);
            if (packed < 0) continue;
            const cov = Math.floor(packed / 0x1000000) / 255;   // cobertura del tile (0..1)
            const rgb = packed % 0x1000000;
            const i   = y * W + x;
            const prev = data[i];
            if (cov >= 0.9 || prev === 0) {
              // Tile lleno (suelo/agua) → pisa lo de abajo, como siempre
              data[i] = 0xff000000 | rgb;
            } else {
              // Tile parcial de la capa superior (orillas del agua…): se FUNDE
              // sobre el color del suelo con el alfa reforzado ×2.5, en vez de
              // pisarlo con un color diluido — la costa queda suave en el minimapa.
              // (La decoración de matas/flores ni llega aquí: MM_DECOR_TILESETS.)
              const a  = Math.min(1, cov * 2.5);
              const r  = Math.round(((rgb >>> 16) & 0xff) * a + ((prev >>> 16) & 0xff) * (1 - a));
              const g  = Math.round(((rgb >>> 8)  & 0xff) * a + ((prev >>> 8)  & 0xff) * (1 - a));
              const b  = Math.round((rgb & 0xff)          * a + (prev & 0xff)          * (1 - a));
              data[i] = 0xff000000 | (r << 16) | (g << 8) | b;
            }
            any = true;
          }
        }
      }
      return any ? { cols: W, rows: H, data } : undefined;
    }

    /** Color medio de un tile empaquetado como `cobertura·0x1000000 + 0xRRGGBB`,
     *  o -1 si es (casi) transparente. El color es la media SOLO de los píxeles
     *  visibles (ponderada por alfa) — así una flor pequeña conserva su color real
     *  en vez de diluirse hacia negro — y la cobertura (0-255) dice cuánto tile
     *  ocupan. Cachea por `tilesetName:index`. Muestrea la región a 4×4 px. */
    private avgTileColor(index: number): number {
      const tileset = this.tilesetForIndex(index);
      if (!tileset) return -1;
      // Tilesets de pura decoración (matas/flores esparcidas por el mapgen): NO se
      // pintan en el minimapa — solo meten ruido de puntitos sobre el césped.
      if (GameScene.MM_DECOR_TILESETS.has(tileset.name)) return -1;
      const key = `${tileset.name}:${index}`;
      const cached = GameScene.mmTileColors.get(key);
      if (cached !== undefined) return cached;

      const coord = tileset.getTileTextureCoordinates(index) as { x: number; y: number } | null;
      const src = tileset.image?.getSourceImage() as CanvasImageSource | undefined;
      if (!coord || !src) { GameScene.mmTileColors.set(key, -1); return -1; }

      const tw = tileset.tileWidth, th = tileset.tileHeight;
      if (!this.mmSampleCanvas) this.mmSampleCanvas = document.createElement('canvas');
      const c = this.mmSampleCanvas;
      const S = 4;
      c.width = S; c.height = S;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) { GameScene.mmTileColors.set(key, -1); return -1; }
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(src, coord.x, coord.y, tw, th, 0, 0, S, S);
      const d = ctx.getImageData(0, 0, S, S).data;
      let sa = 0, sr = 0, sg = 0, sb = 0;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        sa += a;
        sr += d[i] * a; sg += d[i + 1] * a; sb += d[i + 2] * a;
      }
      const cov = Math.min(255, Math.round(sa / (S * S)));   // alfa medio 0-255
      if (cov < 8) { GameScene.mmTileColors.set(key, -1); return -1; }   // ~vacío
      const r = Math.round(sr / sa), g = Math.round(sg / sa), b = Math.round(sb / sa);
      const packed = cov * 0x1000000 + ((r << 16) | (g << 8) | b);
      GameScene.mmTileColors.set(key, packed);
      return packed;
    }

    /** Tileset que contiene un índice global de tile (maneja múltiples tilesets). */
    private tilesetForIndex(index: number): Phaser.Tilemaps.Tileset | null {
      for (const ts of this.currentMap.tilesets) {
        if (ts.containsTileIndex(index)) return ts;
      }
      return null;
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
    private getMinimapNodes(): { x: number; y: number; kind: string; frame?: number }[] {
      const TS = GameScene.TILE_SIZE;
      return this.nodes.map(n => {
        const kind = HARVEST_KINDS[n.kind];
        return {
          x: n.sprite.x,
          y: n.sprite.y - kind.offsetY - (kind.footprintH / 2) * TS,
          kind: n.kind,
          frame: this.harvestTierOf(n.kind)?.mmFrame,   // icono por tier (roca/gema); árbol → undefined
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

    /** Animales de caza: spawnea unos pocos al azar (tipo + posición) en mapas no-hogar.
     *  Son enemigos pasivos (vagan, no atacan), 10 HP, golpeables. Reusa spawnEnemy
     *  (que respawnea al morir). No se añaden a spawnTrackers para no contar en mapStats. */
    private initAnimalSpawns(): void {
      if (this.currentMapConfig.id === 'hogar') return;
      const mapId = this.currentMapConfig.id;
      const W = this.currentMap.width, H = this.currentMap.height;
      const ZW = 12, ZH = 12;

      // Tipos de animal del mapa. Por defecto: 4 al azar de ANIMAL_TYPES. En 1-1 son
      // SOLO conejos (liebre) y únicamente si la mejora de mapa "Desbloquear conejos"
      // está completada (si no, no aparece ningún conejo).
      let pool = ANIMAL_TYPES;
      const COUNT = 4;
      if (mapId === '1-1') {
        if (!this.reg.mapUpgrades?.rabbitUnlocked(mapId)) return;
        pool = ['hare'];
      }

      for (let i = 0; i < COUNT; i++) {
        const type = pool[Phaser.Math.Between(0, pool.length - 1)];
        const zx = Phaser.Math.Between(3, Math.max(3, W - ZW - 3));
        const zy = Phaser.Math.Between(3, Math.max(3, H - ZH - 3));
        const cfg: SpawnConfig = {
          enemyType: type,
          zone: { tileX: zx, tileY: zy, width: ZW, height: ZH },
          maxCount: 1, behavior: 'passive', visionRadius: 0,
        };
        const tracker: SpawnTracker = { config: cfg, count: 0 };
        this.time.delayedCall(i * 800, () => this.spawnEnemy(cfg, tracker));
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

    /** Máx. de enemigos simultáneos de un grupo, incluyendo la mejora de mapa "Enemigos máx.". */
    private effectiveMaxCount(cfg: SpawnConfig): number {
      const bonus = this.reg.mapUpgrades?.extraMaxEnemies(this.currentMapConfig.id) ?? 0;
      return cfg.maxCount + bonus;
    }

    /** Respawn (ms) reducido por la mejora de mapa "Reaparición" (−1s al completarla, suelo 500ms). */
    private effectiveRespawnMs(): number {
      const reduction = this.reg.mapUpgrades?.respawnReductionMs(this.currentMapConfig.id) ?? 0;
      return Math.max(500, ENEMY_RESPAWN_MS - reduction);
    }

    private spawnEnemy(cfg: SpawnConfig, tracker: SpawnTracker) {
      if (tracker.count >= this.effectiveMaxCount(cfg)) return;

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
          // Reserva la plaza mientras corre el respawn (pending) para que el bucle de
          // relleno NO tape el hueco antes de tiempo (si no, reaparecía casi al instante).
          tracker.pending = (tracker.pending ?? 0) + 1;
          // Respawn tras el delay efectivo (reducido por la mejora de mapa "Reaparición")
          this.time.delayedCall(this.effectiveRespawnMs(), () => {
            tracker.pending = Math.max(0, (tracker.pending ?? 0) - 1);
            this.spawnEnemy(cfg, tracker);
          });
        },
        this.collisionTiles,
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
      if (this.currentMapConfig.id !== 'hogar') for (const t of ANIMAL_TYPES) typesToRegister.add(t);
      for (const type of typesToRegister) {
        const cfg = ENEMY_REGISTRY[type];
        if (cfg) this.animService.registerEnemyAnimations(cfg);
      }
    }

    /** Hoja stations.png: 6 columnas × 5 filas de ALTO IRREGULAR (la fila de
     *  fraguas es más alta y se solapa con la de abajo). Registramos cada frame
     *  con su rect real (stationFrameRect) para no cortar los sprites, y creamos
     *  una animación en bucle por estación (3 columnas = sus 3 frames). */
    private registerStationAnimations(): void {
      if (!this.textures.exists('stations')) return;
      const tex = this.textures.get('stations');
      if (!tex.has('0')) {
        for (let i = 0; i < 30; i++) {
          const r = stationFrameRect(i);
          tex.add(i, 0, r.x, r.y, r.w, r.h);
        }
      }
      for (const def of this.reg.cityBuild?.buildables ?? []) {
        if (!def.animKey || this.anims.exists(def.animKey)) continue;
        this.anims.create({
          key: def.animKey,
          frames: this.anims.generateFrameNumbers('stations', { frames: [def.frame, def.frame + 1, def.frame + 2] }),
          frameRate: 4,
          repeat: -1,
        });
      }
      // Animación "encendida" de cada estación (fragua, fundición…): se muestra solo
      // mientras su menú está abierto (ver setStationLit). En reposo la estación usa su
      // textura apagada (spriteKey …_off); al abrir el menú se reproduce este anim.
      for (const def of this.reg.cityBuild?.buildables ?? []) {
        if (!def.litAnimKey || !def.litFrames || this.anims.exists(def.litAnimKey)) continue;
        if (!this.textures.exists(def.litTexture ?? '')) continue;
        this.anims.create({
          key: def.litAnimKey,
          frames: this.anims.generateFrameNumbers(def.litTexture!, { frames: def.litFrames }),
          frameRate: def.litFrameRate ?? 6,
          repeat: -1,
        });
      }
    }

    /** Enciende (anim de fuego) o apaga (textura …_off estática) la estación `pb`.
     *  La forja se enciende mientras PRODUCE (ver anyProducing$), no al abrir su menú. */
    private setStationLit(pb: typeof this.placedBuildings[0], lit: boolean): void {
      const def = this.reg.cityBuild?.def(pb.building.type);
      if (!def) return;
      if (lit && def.litAnimKey && this.anims.exists(def.litAnimKey)) {
        pb.sprite.play(def.litAnimKey);
      } else {
        pb.sprite.stop();
        pb.sprite.setTexture(def.spriteKey, def.frame);
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
      // Dos variantes del portal — cada fila del sprite es un color:
      //   azul = back (frames 0-3) · naranja = next (8-11). Siempre abiertos.
      const portalAnims: [string, number, number][] = [
        ['portal_blue',   0,  3],
        ['portal_orange', 8,  11],
      ];
      for (const [key, start, end] of portalAnims) {
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers('portal', { start, end }),
            frameRate: 10,
            repeat: -1,
          });
        }
      }

      const TS = GameScene.TILE_SIZE;
      this.currentMapConfig.portals.forEach(portal => {
        const px = portal.tilePos.x * TS + TS / 2;
        const py = portal.tilePos.y * TS + TS / 2;
        const sprite = this.add.sprite(px, py, 'portal').setDepth(1).setScale(2.5);
        // Color por sentido: naranja avanza ('next'), azul retrocede ('back').
        sprite.play(portal.direction === 'next' ? 'portal_orange' : 'portal_blue');
        this.activePortals.push({ config: portal, sprite });
      });
    }

    checkPortals(playerPos: Phaser.Math.Vector2) {
      if (this.portalCooldown) return;
      const TS = GameScene.TILE_SIZE;
      // Posición del jugador en el MISMO espacio que el centro del portal (mismo
      // offset de -TS/2 en Y que usaba el cálculo de tile original).
      const px = playerPos.x;
      const py = playerPos.y - TS / 2;
      // Radio de activación: un poco más de un tile, para que salte al tocar el
      // portal (o un pelín antes) en lugar de exigir el tile central exacto.
      const range = TS * 1.1;
      const r2 = range * range;

      for (const p of this.activePortals) {
        const cx = p.config.tilePos.x * TS + TS / 2;
        const cy = p.config.tilePos.y * TS + TS / 2;
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r2) {
          this.portalCooldown = true;
          this.cameras.main.fadeOut(250, 0, 0, 0);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            // Modo Mundo (runner): escena aparte, no es un mapa de grid. Arrancamos
            // WorldRunScene y paramos GameScene (su SHUTDOWN apaga también el HUD).
            if (p.config.targetMapId === 'world-run') {
              // El runner reaparece al jugador en la ENTRADA del mapa del que sale
              // (su hito de distancia); 'hogar' no tiene hito → arranca en el km 0.
              this.scene.start('WorldRunScene', { entryMapId: this.currentMapConfig.id });
              this.scene.stop();
              return;
            }
            this.reg.world.setCurrentMap(p.config.targetMapId);
            // Cruzar un portal rompe la recolección: limpiamos cualquier mining/chopping
            // colgado para que no se cuele al mapa destino (create() lo conservaría). El
            // nuevo mapa fija su actividad (killing/idle) en create().
            const act = this.reg.activity?.current;
            if (act === 'mining' || act === 'chopping') this.reg.activity?.set('idle');
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

    /** Estallido dorado al subir de nivel: anillo expansivo + partículas radiales
     *  desde el jugador + destello (destello respeta el ajuste de efectos). */
    private spawnLevelUpBurst(x: number, y: number): void {
      const ring = this.add.circle(x, y, 12, 0xffe680, 0);
      ring.setStrokeStyle(5, 0xffd700, 0.9);
      ring.setDepth(5999);
      this.tweens.add({
        targets: ring, scale: 5, alpha: 0, duration: 500, ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
      const n = 12;
      for (let i = 0; i < n; i++) {
        const p = this.add.circle(x, y, Phaser.Math.Between(3, 6), 0xffd700, 1);
        p.setDepth(5999);
        const ang  = (Math.PI * 2 * i) / n;
        const dist = Phaser.Math.Between(50, 100);
        this.tweens.add({
          targets: p, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist * 0.8 - 20,
          alpha: 0, scale: 0.3, duration: Phaser.Math.Between(500, 800), ease: 'Quad.easeOut',
          onComplete: () => p.destroy(),
        });
      }
      this.fxFlash(260, 90, 70, 0);   // destello dorado tenue
    }

    private showLevelUp(): void {
      this.lvlUpText?.destroy();
      const pos = this.player.getPosition();
      this.spawnLevelUpBurst(pos.x, pos.y);
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
      // Limpiar en NEGRO (no en el azul #48C4F8 del juego): durante el cambio de
      // escena hay 1-2 frames en que el mapa aún no cubre y se veía un "frame azul"
      // + parpadeos. Con la cámara en negro ese hueco y los parpadeos son
      // negro-sobre-negro = invisibles. El mapa cubre todo en juego normal.
      this.cameras.main.setBackgroundColor('#000000');
    }

    /** Margen extra (world px) para que las capas sobren del viewport visible y
     *  nunca asomen bordes negros aunque la cámara/zoom cambien. */
    private static readonly PX_PAD = 256;

    /** Fondo con parallax detrás del mapa. Soporta temas procedurales (dos capas
     *  tileables), imagen escénica (paralax.jpg teñida) e hipervelocidad (estelas).
     *  Las piezas existen siempre; el tema activo decide cuáles se ven y qué se anima. */
    private initParallax(): void {
      this.pxTime = 0;
      this.pxWarpP.length = 0;
      const sea = PARALLAX_THEMES['sea'];
      if (sea.kind === 'procedural') {
        this.makeLayerTexture('px_far_sea',  sea.far);
        this.makeLayerTexture('px_near_sea', sea.near);
      }
      // Tamaño/posición reales se fijan en updateParallax desde cam.worldView.
      this.pxFar   = this.add.tileSprite(0, 0, 64, 64, 'px_far_sea').setOrigin(0).setDepth(-100);
      this.pxNear  = this.add.tileSprite(0, 0, 64, 64, 'px_near_sea').setOrigin(0).setDepth(-99);
      this.pxImage = this.add.image(0, 0, 'paralax_scene').setOrigin(0.5).setDepth(-100).setVisible(false);
      this.pxWarp  = this.add.graphics().setDepth(-98).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      // Cambio en caliente desde Ajustes (BehaviorSubject → aplica el actual ya).
      this.pxSub = this.reg.gameSettings?.parallaxTheme$
        .subscribe((tid: ParallaxThemeId) => this.applyParallaxTheme(tid));
      if (!this.pxSub) this.applyParallaxTheme((this.reg.gameSettings?.parallaxTheme ?? 'sea') as ParallaxThemeId);
      this.updateParallax(0);   // cubre ya el primer frame
    }

    /** Cambia el tema: genera (una vez) sus texturas, alterna qué capas se ven y
     *  prepara el efecto animado (estelas) según corresponda. */
    private applyParallaxTheme(id: ParallaxThemeId): void {
      if (!this.pxFar || !this.pxNear || !this.pxImage || !this.pxWarp) return;
      const theme = PARALLAX_THEMES[id] ?? PARALLAX_THEMES['sea'];
      this.pxTheme = theme;
      this.clearParallaxFx();
      switch (theme.kind) {
        case 'procedural':
          this.pxImage.setVisible(false);
          this.pxWarp.setVisible(false);
          this.setProceduralLayers(id, theme.far, theme.near);
          break;
        case 'warp':
          this.pxImage.setVisible(false);
          this.pxNear.setVisible(false);
          this.makeLayerTexture(`px_far_${id}`, theme.far);
          this.pxFar.setTexture(`px_far_${id}`).setVisible(true);
          this.pxWarp.setVisible(true);
          this.pxWarpStart = this.pxTime;
          {
            const nColors = theme.colors?.length ?? 0;
            this.pxWarpP = Array.from({ length: theme.count }, () => ({
              nx: Math.random() - 0.5, fy: Math.random(), spd: 0.4 + Math.random() * 0.9,
              ci: nColors ? Math.floor(Math.random() * nColors) : 0,
            }));
          }
          break;
        case 'image':
          this.pxFar.setVisible(false);
          this.pxWarp.setVisible(false);
          this.pxImage.setTexture(theme.texture).setTint(theme.tint).setVisible(true);
          if (theme.overlay) {
            this.makeLayerTexture(`px_ovl_${id}`, theme.overlay);
            this.pxNear.setTexture(`px_ovl_${id}`).setVisible(true);
          } else {
            this.pxNear.setVisible(false);
          }
          break;
      }
    }

    private setProceduralLayers(id: string, far: ParallaxLayer, near: ParallaxLayer): void {
      this.makeLayerTexture(`px_far_${id}`,  far);
      this.makeLayerTexture(`px_near_${id}`, near);
      this.pxFar!.setTexture(`px_far_${id}`).setVisible(true);
      this.pxNear!.setTexture(`px_near_${id}`).setVisible(true);
    }

    /** Limpia las estelas de hipervelocidad (al cambiar de tema). */
    private clearParallaxFx(): void {
      this.pxWarp?.clear();
    }

    /** Cada frame: ajusta las capas al área de mundo visible (cam.worldView). */
    private updateParallax(delta: number): void {
      if (!this.pxFar || !this.pxNear || !this.pxImage || !this.pxWarp) return;
      this.pxTime += delta;
      const v = this.cameras.main.worldView;
      const theme = this.pxTheme;
      switch (theme.kind) {
        case 'procedural':
          this.driveTileLayer(this.pxFar,  theme.far,  v);
          this.driveTileLayer(this.pxNear, theme.near, v);
          break;
        case 'warp':
          this.driveTileLayer(this.pxFar, theme.far, v);
          this.updateWarp(theme, v, delta);
          break;
        case 'image':
          this.driveSceneImage(this.pxImage, theme, v);
          if (theme.overlay && this.pxNear.visible) this.driveTileLayer(this.pxNear, theme.overlay, v);
          break;
      }
    }

    /** Redibuja las estelas de hipervelocidad: caen en vertical de arriba abajo. La
     *  velocidad/grosor varía por estela (capas), pero el movimiento es recto. Con
     *  `rampMs` arranca casi parado (puntos = estrellas) y acelera a estelas largas. */
    private updateWarp(theme: { color: number; colors?: number[]; speed: number; startSpeed?: number; rampMs?: number }, v: Phaser.Geom.Rectangle, delta: number): void {
      const g = this.pxWarp!;
      g.clear();
      const vh = v.height;
      // Velocidad efectiva: con rampa, acelera (ease-in) de startSpeed a speed y se queda.
      let s = theme.speed;
      if (theme.rampMs) {
        const from = theme.startSpeed ?? 0.04;
        const t = Math.min(1, (this.pxTime - this.pxWarpStart) / theme.rampMs);
        s = from + (theme.speed - from) * (t * t);
      }
      const norm = theme.speed > 0 ? s / theme.speed : 1;   // 0 = parado, 1 = a tope
      for (const p of this.pxWarpP) {
        // avance en fracciones de alto/ms → velocidad constante sea cual sea el zoom
        p.fy += (p.spd * s * 0.0014) * delta;
        const len = (0.012 + p.spd * 0.14 * norm) * vh;     // corto (punto) parado → largo a tope
        if (p.fy * vh > vh + len) { p.fy = -len / vh; p.nx = Math.random() - 0.5; }
        const x  = v.x + (0.5 + p.nx) * v.width;
        const y2 = v.y + p.fy * vh;
        const color = theme.colors ? theme.colors[p.ci] : theme.color;
        g.lineStyle(2 + p.spd * 4, color, Math.min(1, 0.30 + p.spd * 0.6));
        g.lineBetween(x, y2 - len, x, y2);
      }
    }

    /** Capa tileable: cubre el viewport (con margen) y desplaza su textura según el
     *  scroll (factor < 1 = más lento = más lejos) + deriva temporal suave. */
    private driveTileLayer(ts: Phaser.GameObjects.TileSprite, layer: ParallaxLayer, v: Phaser.Geom.Rectangle): void {
      const pad = GameScene.PX_PAD;
      ts.setPosition(v.x - pad, v.y - pad).setSize(v.width + pad * 2, v.height + pad * 2);
      ts.tilePositionX = v.x * layer.factor + this.pxTime * layer.driftX;
      ts.tilePositionY = v.y * layer.factor + this.pxTime * layer.driftY;
    }

    /** Imagen escénica: la escala para CUBRIR el viewport con un 30% de margen y la
     *  desplaza con un poco de parallax (scroll·factor) + un vaivén lento tipo Ken
     *  Burns, todo acotado al margen para que nunca asomen los bordes de la imagen. */
    private driveSceneImage(img: Phaser.GameObjects.Image, theme: { factor: number; drift: number }, v: Phaser.Geom.Rectangle): void {
      const src = img.texture.getSourceImage() as { width: number; height: number };
      const cover = Math.max(v.width / src.width, v.height / src.height) * 1.3;
      img.setScale(cover);
      const maxX = Math.max(0, (src.width  * cover - v.width)  / 2);
      const maxY = Math.max(0, (src.height * cover - v.height) / 2);
      const swayX = Math.sin(this.pxTime * 0.00004) * maxX * theme.drift;
      const swayY = Math.cos(this.pxTime * 0.00003) * maxY * theme.drift;
      const ox = Phaser.Math.Clamp(-v.x * theme.factor + swayX, -maxX, maxX);
      const oy = Phaser.Math.Clamp(-v.y * theme.factor + swayY, -maxY, maxY);
      img.setPosition(v.centerX + ox, v.centerY + oy);
    }

    /** Textura tileable de una capa de parallax: relleno opaco opcional + manchas
     *  radiales suaves (dibujadas con copias envueltas en los bordes → repite sin
     *  costura). Se cachea por `key`, así que cada tema se genera una sola vez. */
    private makeLayerTexture(key: string, layer: ParallaxLayer): void {
      if (this.textures.exists(key)) return;
      const size = 256;
      const t = this.textures.createCanvas(key, size, size);
      if (!t) return;
      const ctx = t.getContext();
      if (layer.baseFill) {
        ctx.fillStyle = layer.baseFill;
        ctx.fillRect(0, 0, size, size);
      }
      for (const b of layer.blobs) this.paintBlobs(ctx, size, b.rgb, b.alpha, b.count, b.maxR);
      t.refresh();
    }

    /** Pinta `count` manchas radiales suaves del color `rgb` (alpha→0 en el borde),
     *  repitiendo cada una en las 8 copias envueltas para que la textura tile sin junta. */
    private paintBlobs(ctx: CanvasRenderingContext2D, size: number, rgb: string, alpha: number, count: number, maxR: number): void {
      for (let i = 0; i < count; i++) {
        const x = Math.random() * size, y = Math.random() * size;
        const r = maxR * (0.4 + Math.random() * 0.6);
        for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
          const cx = x + ox, cy = y + oy;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(${rgb},${alpha})`);
          g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
    }

    createGameControls() {
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // En modo colocación el toque mueve el ghost / confirma / cancela.
        if (this.buildPlacement) { this.handleBuildPointer(pointer); return; }
        // En modo "mover edificio" el toque selecciona el edificio a reubicar.
        if (this.moveSelecting) { this.handleMoveSelect(pointer); return; }
        // En modo "borrar edificio" el toque selecciona el edificio a borrar.
        if (this.deleteSelecting) { this.handleDeleteSelect(pointer); return; }
        // Pulsar un edificio con ventana propia (la tienda, la fragua…) la abre.
        if (this.handleBuildingWindowTap(pointer)) return;
        // Un toque en cualquier punto del mapa cierra el diálogo de NPC abierto.
        if (this.reg.dialogue?.isOpen) { this.reg.dialogue.dismiss(); return; }
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
        // Si ya hay un diálogo abierto, el espacio lo cierra.
        if (this.reg.dialogue?.isOpen) { this.reg.dialogue.dismiss(); return; }
        this.reg.autoAttack?.pauseAutomation();
        const chest = this.nearestOpenableChest();
        if (chest) { this.openChest(chest); return; }
        if (this.nearMapChest()) { this.reg.cityBuild.requestOpenWindow('mapChest'); return; }
        const win = this.nearestWindowBuilding();
        if (win) { this.pendingLitBuilding = win; this.reg.cityBuild.requestOpenWindow(win.building.type); return; }
        const npc = this.nearestNpc();
        if (npc) { this.talkToNpc(npc); return; }
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
      this.events.on('enemyAttackPlayer', ({ damage, isCrit, sourceX, sourceY, knockback }: { damage: number; isCrit?: boolean; sourceX?: number; sourceY?: number; knockback?: boolean }) => {
        const now = this.time.now;
        // Anti-stack: ventana mínima para que dos golpes que impactan el MISMO instante
        // no se sientan uno doble injusto. El ritmo real de daño lo marca el cooldown
        // de CADA enemigo → más enemigos encima = más daño (antes 500ms globales
        // capaban a las hordas al DPS de un solo enemigo).
        if (now - this.lastDamageTime < 150) return;
        this.lastDamageTime = now;

        // Modo admin: invulnerable (damagePlayer ya ignora el daño) → tampoco
        // feedback de golpe (tinte/temblor/destello/número, que parecía un bug).
        if (this.reg.admin?.isAdmin) return;

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
        this.reg.playerBridge.damagePlayer(effectiveDamage);
        this.flashPlayer();
        // Contundencia al recibir: temblor siempre; el destello ROJO de pantalla solo
        // en golpes que duelen de verdad (≥ 1/4 de la vida máxima) — con golpes
        // frecuentes y flojos la pantalla parpadeaba sin parar.
        this.fxShake(isCrit ? 160 : 90, isCrit ? 0.006 : 0.003);
        const hpMax = this.reg.playerBridge.player?.status?.HPMax ?? 100;
        if (effectiveDamage >= hpMax * 0.25) {
          this.fxFlash(isCrit ? 200 : 120, 120, 0, 0);
        }
        this.showPlayerDamage(effectiveDamage, isCrit);
        // Empuja al jugador hacia atrás: crítico enemigo o golpes con empujón
        // propio (la embestida siempre atropella).
        if ((isCrit || knockback) && sourceX != null && sourceY != null) {
          this.knockbackPlayer(sourceX, sourceY);
        }
      });

      this.events.on('enemyDied', ({ type, position }: { type: string, position: Phaser.Math.Vector2 }) => {
        const mapId = this.reg.world.getCurrentMap().id;
        this.reg.kill?.recordKill(mapId, type);
        this.reg.gathering?.addEquippedPetExp(1);   // 1 exp por enemigo a la mascota equipada

        // Los animales de caza no tienen élite/oblivion ni progresión de kills.
        if (ANIMAL_TYPES.includes(type)) return;

        if (type.endsWith('_oblivion')) return;

        if (type.endsWith('_elite')) {
          this.eliteKills++;
          this.sessionKills[type] = (this.sessionKills[type] ?? 0) + 1;
          this.reg.mapStats?.updateSessionKills(this.sessionKills);
          const threshold = MAP_OBLIVION_THRESHOLD[mapId] ?? 5;
          // Oblivion bloqueado hasta desbloquearlo en las mejoras del mapa.
          if (this.reg.mapUpgrades?.oblivionUnlocked(mapId) && this.eliteKills % threshold === 0) {
            const baseType = type.replace('_elite', '');
            this.spawnSpecial(`${baseType}_oblivion`, position);
          }
          return;
        }

        this.sessionKills[type] = (this.sessionKills[type] ?? 0) + 1;
        this.reg.mapStats?.updateSessionKills(this.sessionKills);
        const threshold = MAP_ELITE_THRESHOLD[mapId] ?? 20;
        // Élite bloqueado hasta desbloquearlo en las mejoras del mapa.
        if (this.reg.mapUpgrades?.eliteUnlocked(mapId) && this.sessionKills[type] % threshold === 0) {
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
        this.collisionTiles,
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
      // Recurso de cara pero SIN su herramienta equipada → balanceo + aviso
      // "need pickaxe"/"need axe" (en vez de un ataque normal contra la nada).
      const missing = this.nearestNode(false);
      if (missing) {
        this.setActiveHarvest(null);
        this.player.playerAttack();
        this.showNeedToolText(missing);
        return;
      }
      // Ataque normal (enemigo / al aire): es "otra acción" → guarda la herramienta y
      // vuelve a mostrar el arma. setActiveHarvest(null) ya devuelve la actividad a
      // 'killing' (mapa con enemigos) o 'idle', así que tras minar/talar el avatar de
      // la barra vuelve a la espada sin fijar la actividad aquí a mano.
      this.setActiveHarvest(null);
      if (this.rangedWeapon) { this.rangedStrike(); return; }
      const ts = this.attackTimeScale();
      this.player.playerAttack(false, ts);
      const anim  = this.player.getSprite().anims.currentAnim;
      const delay = anim ? Math.round(anim.duration * 0.4 / ts) : 150;
      this.time.delayedCall(delay, () => {
        if (this.reg.playerBridge?.isDead) return;
        const { dmg, isCrit } = this.rollAttack();
        const hits = this.gridPhysics.attackEnemy(dmg, isCrit);
        if (hits > 0) {
          // Peso en CADA golpe que conecta: crítico = hit-stop + shake fuerte;
          // normal = micro-temblor (antes el golpe normal no tenía "punch").
          this.reg.audio?.play('hit');
          if (isCrit) this.critFeedback();
          else        this.fxShake(45, 0.0016);
        }
      });
    }

    // ── Recolección (minería / tala) ─────────────────────────────────────────────
    // Recursos repartidos por los mapas (no en el hogar): rocas (pico) y árboles
    // (hacha). Bloquean el paso y solo se dañan con su herramienta equipada en el slot
    // de recolección. 3 golpes → destrucción. Config en HARVEST_KINDS.

    /** Tier efectivo de un nodo en el mapa actual: rocas→mineTier (siempre hay),
     *  gemas→gemTier (null si el mapa no tiene gemas), árboles→null (sin tier). */
    private harvestTierOf(id: HarvestKindId): MiningTier | null {
      if (id === 'rock') return miningTier(this.currentMapConfig.mineTier);
      if (id === 'gem')  return gemTier(this.currentMapConfig.gemTier);
      if (id === 'tree') return treeTier(this.currentMapConfig.treeTier);
      return null;
    }
    /** Textura del sprite de un nodo (la del tier si lo tiene; si no, la fija del kind). */
    private harvestTexture(id: HarvestKindId): string {
      return this.harvestTierOf(id)?.rockTexture ?? HARVEST_KINDS[id].texture;
    }
    /** Escala visual de un nodo (la del tier si la define; si no, la del kind). */
    private harvestScale(id: HarvestKindId): number {
      return this.harvestTierOf(id)?.scale ?? HARVEST_KINDS[id].scale;
    }

    private initHarvestNodes(): void {
      if (this.currentMapConfig.id === 'hogar') return;
      const mapId = this.currentMapConfig.id;
      for (const id of Object.keys(HARVEST_KINDS) as HarvestKindId[]) {
        const kind = HARVEST_KINDS[id];
        // Gemas: solo si el mapa tiene gemTier Y están desbloqueadas en la ventana de mapa.
        if (id === 'gem' && (!this.harvestTierOf('gem') || !this.reg.mapUpgrades?.gemUnlocked(mapId))) continue;
        if (!this.textures.exists(this.harvestTexture(id))) continue;   // sin sprite → no se genera
        // Menas, gemas y árboles usan máximo + respawn temporizado; el resto se colocan
        // todos de golpe al entrar al mapa.
        const target = id === 'rock' ? this.maxOre() : id === 'gem' ? this.maxGem() : id === 'tree' ? this.maxTree() : kind.count;
        for (let placed = 0, tries = 0; placed < target && tries < 400; tries++) {
          if (this.trySpawnNode(id, kind)) placed++;
        }
      }
      this.scheduleOreRespawn();
      this.scheduleGemRespawn();
      this.scheduleTreeRespawn();
    }

    /** Máx. de menas (rocas) a la vez = 1 base + mejora de mapa "Menas máx.". */
    private maxOre(): number {
      return 1 + (this.reg.mapUpgrades?.extraOre(this.currentMapConfig.id) ?? 0);
    }

    /** Respawn de menas (ms) = base − reducción de la mejora "Respawn de menas" (suelo 5s). */
    private effectiveOreRespawnMs(): number {
      const reduction = this.reg.mapUpgrades?.oreRespawnReductionMs(this.currentMapConfig.id) ?? 0;
      return Math.max(5000, ORE_RESPAWN_MS - reduction);
    }

    private countOreNodes(): number {
      return this.nodes.reduce((n, node) => n + (node.kind === 'rock' ? 1 : 0), 0);
    }

    /** Máx. de gemas a la vez en el mapa (de momento 1, tras desbloquearlas). */
    private maxGem(): number { return 1; }

    private countGemNodes(): number {
      return this.nodes.reduce((n, node) => n + (node.kind === 'gem' ? 1 : 0), 0);
    }

    /** Programa el respawn de gemas: tiempo ALEATORIO entre min y max (mejoras de mapa
     *  los reducen). Solo spawnea si están desbloqueadas y hay hueco bajo el máximo. */
    private scheduleGemRespawn(): void {
      const mapId = this.currentMapConfig.id;
      const mu = this.reg.mapUpgrades;
      if (mapId === 'hogar' || !this.harvestTierOf('gem') || !mu) return;   // mapa sin gemas
      const delay = Phaser.Math.Between(mu.gemRespawnMinMs(mapId), mu.gemRespawnMaxMs(mapId));
      this.time.delayedCall(delay, () => {
        if (mu.gemUnlocked(mapId) && this.countGemNodes() < this.maxGem()) {
          this.trySpawnNode('gem', HARVEST_KINDS['gem']);
        }
        this.scheduleGemRespawn();   // se reprograma con otro tiempo aleatorio
      });
    }

    /** Programa el respawn de menas: cada effectiveOreRespawnMs aparece una nueva si hay
     *  hueco bajo el máximo. Se reprograma sola para reflejar cambios de la mejora. */
    private scheduleOreRespawn(): void {
      if (this.currentMapConfig.id === 'hogar') return;
      this.time.delayedCall(this.effectiveOreRespawnMs(), () => {
        if (this.countOreNodes() < this.maxOre()) this.trySpawnNode('rock', HARVEST_KINDS['rock']);
        this.scheduleOreRespawn();
      });
    }

    /** Máx. de árboles a la vez = 1 base + mejora de mapa "Árboles máx.". */
    private maxTree(): number {
      return 1 + (this.reg.mapUpgrades?.extraTrees(this.currentMapConfig.id) ?? 0);
    }

    /** Respawn de árboles (ms) = base − mejora "Respawn de árboles" (suelo 5s). */
    private effectiveTreeRespawnMs(): number {
      const reduction = this.reg.mapUpgrades?.treeRespawnReductionMs(this.currentMapConfig.id) ?? 0;
      return Math.max(5000, TREE_RESPAWN_MS - reduction);
    }

    private countTreeNodes(): number {
      return this.nodes.reduce((n, node) => n + (node.kind === 'tree' ? 1 : 0), 0);
    }

    /** Programa el respawn de árboles: cada effectiveTreeRespawnMs aparece uno nuevo si
     *  hay hueco bajo el máximo. Réplica del respawn de menas. */
    private scheduleTreeRespawn(): void {
      if (this.currentMapConfig.id === 'hogar') return;
      this.time.delayedCall(this.effectiveTreeRespawnMs(), () => {
        if (this.countTreeNodes() < this.maxTree()) this.trySpawnNode('tree', HARVEST_KINDS['tree']);
        this.scheduleTreeRespawn();
      });
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
      // Roca/gema → sprite del tier del mapa; árbol → su textura fija.
      const sprite = this.add.image(cx, cy, this.harvestTexture(id));
      sprite.setOrigin(0.5, 1);
      sprite.setScale(this.harvestScale(id));
      // Depth por Y (como el jugador, que usa depth = su Y de pies): si el jugador está
      // por encima (más al norte) que la base del recurso, el recurso lo tapa (copa del
      // árbol); si está por debajo, el jugador pasa por delante.
      sprite.setDepth(baseY);
      for (const k of tileKeys) this.collisionTiles.add(k);   // bloquea su huella
      // El recurso nace con la vida de su tier (menas, gemas y árboles); cada golpe le
      // resta la fuerza del jugador (minado/tala).
      const mineHp = this.harvestTierOf(id)?.mineHp ?? 20;
      this.nodes.push({ sprite, hits: 0, mineHp, mineHpMax: mineHp, tileKeys, kind: id });
    }

    /** Herramienta de la categoría dada equipada en su slot de recolección, o null. */
    private equippedTool(category: string, slotId: string): InventoryItem | null {
      const item = this.reg.gathering?.slots.find(s => s.id === slotId)?.item ?? null;
      return item && item.category === category ? item : null;
    }

    /** Recurso más cercano en rango y en la dirección de mirada cuya herramienta esté
     *  equipada. Define el contexto/capa de herramienta y el objetivo del golpe. */
    private nearestHarvestable(): HarvestNode | null {
      return this.nearestNode(true);
    }

    /** Recurso más cercano en rango y dirección de mirada. `withTool` true = solo los
     *  recolectables (herramienta equipada); false = solo aquellos cuya herramienta
     *  FALTA (para avisar "need <tool>" al golpearlos sin ella). */
    private nearestNode(withTool: boolean): HarvestNode | null {
      if (this.nodes.length === 0) return null;
      const pos = this.player.getPosition();
      const vec = this.dirVector(this.player.getDirection());
      const RANGE = GameScene.TILE_SIZE * 2.5;   // huella 2×2: alcance algo mayor
      let nearest: HarvestNode | null = null;
      let nearestDist = Infinity;
      for (const node of this.nodes) {
        const kind = HARVEST_KINDS[node.kind];
        const hasTool = !!this.equippedTool(kind.toolCategory, kind.toolSlotId);
        if (hasTool !== withTool) continue;
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

    /** Aviso flotante "need pickaxe"/"need axe" sobre un recurso golpeado sin su
     *  herramienta (estilo del número de daño de enemigos, en rojo). */
    private showNeedToolText(node: HarvestNode): void {
      const kind = HARVEST_KINDS[node.kind];
      spawnFloatingText(this,
        node.sprite.x + Phaser.Math.Between(-20, 20),
        node.sprite.y - GameScene.TILE_SIZE * 1.8,   // bien por encima del recurso
        `need ${kind.toolSlotId}`,
        { fontSize: 32, color: '#ffd700', strokeThickness: 7, rise: 45, duration: 1300 });
    }

    /** Eficiencia de minado del personaje (stat derivado): floor(DEX/5) + pico + talento.
     *  Cuanta más, más golpes acierta contra menas duras (tiers altos piden más). */
    private playerMiningEfficiency(): number {
      return this.reg.charStats?.currentMiningEfficiency ?? 0;
    }

    /** Eficiencia del personaje para un recurso: tala (hacha) para árboles, minería
     *  (pico) para menas/gemas. */
    private playerHarvestEfficiency(kind: HarvestKindId): number {
      return kind === 'tree'
        ? (this.reg.charStats?.currentWoodcuttingEfficiency ?? 0)
        : this.playerMiningEfficiency();
    }

    /** Nº de unidades que suelta un recurso según el ratio de eficiencia (jugador/requerida):
     *  floor(ratio) garantizadas + 1 más con prob. = parte decimal (mín. 1). reqEff 0 → 1. */
    private efficiencyDropCount(playerEff: number, reqEff: number): number {
      if (reqEff <= 0) return 1;
      const ratio = playerEff / reqEff;
      const floor = Math.floor(ratio);
      const extra = Math.random() < (ratio - floor) ? 1 : 0;
      return Math.max(1, floor + extra);
    }

    /** Fuerza de minado: daño por golpe acertado a la vida de la mena (stat derivado). */
    private playerMiningPower(): number {
      return this.reg.charStats?.currentMiningPower ?? 0;
    }

    /** Fuerza del personaje para un recurso: tala (hacha) para árboles, minería (pico)
     *  para menas/gemas. Daño por golpe acertado a la vida del recurso. */
    private playerHarvestPower(kind: HarvestKindId): number {
      return kind === 'tree'
        ? (this.reg.charStats?.currentWoodcuttingPower ?? 0)
        : this.playerMiningPower();
    }

    /** Número de daño flotante sobre una mena al picarla (como el daño a enemigos). */
    private showMiningDamage(node: HarvestNode, amount: number): void {
      spawnFloatingText(this,
        node.sprite.x + Phaser.Math.Between(-18, 18), node.sprite.y - GameScene.TILE_SIZE * 1.2,
        `-${amount}`, { fontSize: 24, color: '#ffe08a', strokeThickness: 5, rise: 36, duration: 800 });
    }

    /** Barra de vida del recurso: se crea de forma perezosa cuando el recurso baja del
     *  100% de vida y permanece visible (actualizándose con cada golpe) hasta que se
     *  recolecta. A vida completa no existe/no se ve. */
    private showNodeHpBar(node: HarvestNode): void {
      const s = node.sprite;
      const W = Math.max(72, s.displayWidth * 0.9);
      const H = 14;
      const x = s.x;
      const y = s.getTopCenter().y - 24;   // un poco por encima del recurso

      if (!node.hpBarTrack || !node.hpBarFill) {
        node.hpBarTrack = this.add.rectangle(x, y, W, H, 0x21130e, 0.9)
          .setOrigin(0.5, 0.5).setStrokeStyle(3, 0x3a2c20).setDepth(4800);
        node.hpBarFill = this.add.rectangle(x - W / 2 + 2, y, W - 4, H - 4, 0xc0392b)
          .setOrigin(0, 0.5).setDepth(4801);
      }

      const pct = Phaser.Math.Clamp((node.mineHp ?? 0) / (node.mineHpMax || 1), 0, 1);
      node.hpBarFill.setSize((W - 4) * pct, H - 4);
    }

    /** Destruye la barra de vida (al recolectar el recurso). */
    private destroyNodeHpBar(node: HarvestNode): void {
      node.hpBarTrack?.destroy();
      node.hpBarFill?.destroy();
      node.hpBarTrack = undefined;
      node.hpBarFill  = undefined;
    }

    /** Texto flotante "MISS" sobre una mena cuando el golpe falla por falta de eficiencia. */
    private showMissText(node: HarvestNode): void {
      spawnFloatingText(this,
        node.sprite.x + Phaser.Math.Between(-18, 18), node.sprite.y - GameScene.TILE_SIZE * 1.2,
        'MISS', { fontSize: 26, color: '#d8d8d8', rise: 40, duration: 900 });
    }

    private harvestNode(node: HarvestNode): void {
      const kind = HARVEST_KINDS[node.kind];
      // Actividad AFK: lo último golpeado manda (minando una roca / talando un árbol).
      this.reg.activity?.set(kind.skill === 'woodcutting' ? 'chopping' : 'mining');

      // Eficiencia (minería o tala): el golpe acierta con prob = eficiencia del jugador /
      // eficiencia requerida del recurso. Un fallo muestra "MISS" y NO cuenta para
      // destruirlo. reqEff 0 → siempre acierta.
      {
        const reqEff = this.harvestTierOf(node.kind)?.efficiency ?? 0;
        if (reqEff > 0 && Math.random() > Math.min(1, this.playerHarvestEfficiency(node.kind) / reqEff)) {
          this.showMissText(node);
          return;
        }
      }

      const s = node.sprite;
      const baseScale = this.harvestScale(node.kind);   // escala real del tier, no la global

      // Golpe acertado: resta la fuerza (minado/tala) a la vida del recurso y muestra el
      // número de daño. Mismo modelo para menas, gemas y árboles.
      const dmg = Math.max(1, this.playerHarvestPower(node.kind));
      node.mineHp = (node.mineHp ?? 0) - dmg;
      this.showMiningDamage(node, dmg);
      const destroyed = node.mineHp <= 0;

      // Barra de vida: aparece solo al hacer daño y se actualiza con cada golpe.
      if (!destroyed) this.showNodeHpBar(node);

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
      this.fxShake(70, 0.0035);
      this.reg.audio?.play('mine');

      if (destroyed) this.destroyNode(node);
    }

    private destroyNode(node: HarvestNode): void {
      const idx = this.nodes.indexOf(node);
      if (idx !== -1) this.nodes.splice(idx, 1);
      this.destroyNodeHpBar(node);
      for (const k of node.tileKeys) this.collisionTiles.delete(k);   // libera la huella

      const kind = HARVEST_KINDS[node.kind];
      // Progresión de la skill de recolección (minería / tala): XP al recolectar.
      // En minería, el atributo "exp mining" suma XP extra por mena.
      const bonusXp = kind.skill === 'mining'      ? (this.reg.charStats?.currentMiningExp ?? 0)
                    : kind.skill === 'woodcutting' ? (this.reg.charStats?.currentWoodcuttingExp ?? 0)
                    : 0;
      this.reg.gatheringSkills?.addXp(kind.skill, kind.xp + bonusXp);
      const s = node.sprite;
      // Suelta el recurso del nodo (árbol → madera; roca/gema → item del tier del mapa).
      if (kind.drop) {
        const dropName = this.harvestTierOf(node.kind)?.dropName ?? kind.drop.name;
        const base = ITEM_CATALOG.find(e => e.name === dropName);
        if (base) {
          // Talentos de minería multiplican el botín de las rocas: mult = 1 + suma de
          // miningDrop (base 1 sin gema → ×2). Solo aplica a la skill 'mining'.
          const dropMult = kind.skill === 'mining'
            ? 1 + (this.reg.talent?.getBonus().miningDrop ?? 0)
            : 1;
          // Multi-drop por eficiencia: ratio = eficiencia del jugador (minería o tala) /
          // eficiencia del recurso. Suelta floor(ratio) garantizados + 1 más con prob. =
          // la parte decimal (mín. 1). Ej.: ratio 2.5 → 2 + 50% de soltar una 3ª.
          const reqEff = this.harvestTierOf(node.kind)?.efficiency ?? 0;
          const effQty = this.efficiencyDropCount(this.playerHarvestEfficiency(node.kind), reqEff);
          const qty = Phaser.Math.Between(kind.drop.min, kind.drop.max) * effQty * dropMult;
          const baseY = s.y - GameScene.TILE_SIZE;
          const origin = new Phaser.Math.Vector2(s.x, baseY);
          // Cada unidad sale volando desde el centro del nodo hacia un punto de caída
          // esparcido a su alrededor, en vez de nacer todas en el mismo sitio.
          for (let i = 0; i < qty; i++) {
            const loot = { ...base, minQty: 1, maxQty: 1 };
            const px = s.x + Phaser.Math.Between(-GameScene.TILE_SIZE, GameScene.TILE_SIZE);
            const py = baseY + Phaser.Math.Between(-GameScene.TILE_SIZE * 0.5, GameScene.TILE_SIZE * 0.5);
            this.gridDrops?.spawnDrop(new Phaser.Math.Vector2(px, py), loot, origin);
          }
        }
      }
      this.spawnDebris(s.x, s.y - GameScene.TILE_SIZE * 0.8, 16, kind.debris);   // estallido mayor
      this.fxShake(120, 0.005);
      this.tweens.killTweensOf(s);
      const baseScale = this.harvestScale(node.kind);
      this.tweens.add({
        targets: s, scaleX: baseScale * 1.2, scaleY: baseScale * 1.2, alpha: 0, duration: 220, ease: 'Quad.easeOut',
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
      const ts = this.attackTimeScale();
      this.player.playerAttack(true, ts);   // bastón → estocada (thrust), sincroniza con su capa
      // Sin objetivo: la estocada se lanza igual (que el botón no se sienta muerto),
      // solo que al aire y sin proyectil.
      if (!target) return;
      // El proyectil sale al ~60% de la animación de ataque.
      const anim  = this.player.getSprite().anims.currentAnim;
      const delay = anim ? Math.round(anim.duration * 0.6 / ts) : 250;
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
        this.fxShake(100, 0.0035);
      }, 60);
    }

    // Efectos de pantalla (temblor/destello) respetando el ajuste "screenShake": si el
    // jugador lo desactiva (partidas AFK largas), no hay sacudidas ni flashes.
    private fxShake(duration: number, intensity: number): void {
      if (this.reg.gameSettings?.screenShake ?? true) this.cameras.main.shake(duration, intensity);
    }
    private fxFlash(duration: number, r: number, g: number, b: number): void {
      if (this.reg.gameSettings?.screenShake ?? true) this.cameras.main.flash(duration, r, g, b);
    }

    private rollAttack(baseDamage = this.playerDamage): { dmg: number; isCrit: boolean } {
      // Modo admin: golpe fijo de 1000 (para testear sin grindear stats).
      if (this.reg.admin?.isAdmin) return { dmg: 1000, isCrit: false };
      const critChance = this.reg.charStats?.currentCritChance ?? 10;
      const isCrit     = Math.random() * 100 < critChance;
      const critMult   = isCrit ? (this.reg.charStats?.currentCritDamage ?? 150) / 100 : 1;
      // Varianza ±15%: que los golpes no peguen siempre el mismo número exacto.
      const variance = rollDamageVariance();
      return { dmg: Math.floor(baseDamage * variance * critMult), isCrit };
    }

    /** Multiplicador de velocidad del golpe básico (animación + momento del daño):
     *  1 + velocidad de ataque/100 (stat derivado de DEX + equipo + buffs). */
    private attackTimeScale(): number {
      return 1 + (this.reg.charStats?.currentAttackSpeed ?? 0) / 100;
    }

    /** Línea de visión: muestrea el segmento cada medio tile; un tile con colisión la
     *  corta. La usan el bastón y las skills para no apuntar a través de muros. */
    private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
      const step  = GameScene.TILE_SIZE / 2;
      const dist  = Phaser.Math.Distance.Between(x1, y1, x2, y2);
      const steps = Math.floor(dist / step);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (this.gridPhysics.isTileBlocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
      }
      return true;
    }

    private flashPlayer() {
      const sprite = this.player.getSprite();
      sprite.setTint(0xff4444);
      this.time.delayedCall(150, () => sprite.clearTint());
    }

    private showPlayerImmune(): void {
      const sprite = this.player.getSprite();
      spawnFloatingText(this,
        sprite.x + Phaser.Math.Between(-20, 20), sprite.y - sprite.displayHeight * 0.5,
        'IMMUNE', { fontSize: 22, color: '#f0a020', strokeThickness: 5 });
    }

    private showPlayerMiss(): void {
      const sprite = this.player.getSprite();
      spawnFloatingText(this,
        sprite.x + Phaser.Math.Between(-20, 20), sprite.y - sprite.displayHeight * 0.5,
        'EVADE', { fontSize: 24, color: '#1abc9c', strokeThickness: 5 });
    }

    private showPlayerDamage(amount: number, isCrit = false): void {
      const sprite = this.player.getSprite();
      spawnFloatingText(this,
        sprite.x + Phaser.Math.Between(-20, 20), sprite.y - sprite.displayHeight * 0.5,
        isCrit ? `-${amount}!` : `-${amount}`, {
          fontSize:        isCrit ? 36 : 28,
          color:           isCrit ? '#ff8800' : '#ff4444',   // crítico en naranja y más grande
          strokeThickness: isCrit ? 7 : 6,
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
            // count + pending: solo rellena plazas NUEVAS (p.ej. al subir el maxCount),
            // no las que están esperando su respawn de muerte (esas ya tienen su timer).
            while (tracker.count + (tracker.pending ?? 0) < this.effectiveMaxCount(tracker.config)) {
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
      // Registra las 10 animaciones de apertura (una por columna del spritesheet).
      // chests.png: 10 cols × 4 rows, 32×32 px. Frames izq-dcha, arriba-abajo.
      // Cofre col: idle=col (fila 0 = cerrado), anim=[col+10, col+20, col+30]
      for (let col = 0; col < 10; col++) {
        const key = `chest_open_${col}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: [
              { key: 'chests', frame: col + 10 },
              { key: 'chests', frame: col + 20 },
              { key: 'chests', frame: col + 30 },
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

      // Cofre central del mapa (cofre 2): en TODOS los mapas, abre su ventana.
      this.spawnMapChest();

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
        // Distancia a los BORDES del sprite (no al centro): así el espacio abre el cofre
        // estando pegado, aunque su centro quede lejos (igual que la tienda).
        const b = chest.sprite.getBounds();
        const dx = Math.max(b.left - pos.x, 0, pos.x - b.right);
        const dy = Math.max(b.top  - pos.y, 0, pos.y - b.bottom);
        if (dx * dx + dy * dy <= range * range) return chest;
      }
      return null;
    }

    private spawnTownChest(): void {
      const TS  = GameScene.TILE_SIZE;
      // 4 tiles a la derecha del spawn del jugador (tile 30,30). Almacén reservado 'home'.
      this.addTownChest(34 * TS + TS / 2, 30 * TS + TS / 2, HOME_CHEST_ID);
    }

    /** NPCs fijos de la ciudad (Asgard): personajes decorativos que se quedan
     *  quietos. Por ahora Kugo, plantado cerca del spawn con su idle mirando abajo. */
    private initCityNpcs(): void {
      for (const n of CITY_NPCS) {
        const animKey = `${n.texKey}_idle_down`;
        this.ensureNpcAnim(n.texKey, animKey);
        this.spawnCityNpc(n.name, n.texKey, animKey, n.tileX, n.tileY);
      }
    }

    /** NPCs reclutables del mapa actual (Kugo e Italien en 1-1): cada uno aparece
     *  mientras no se le haya reclutado. Tras hablarle se desbloquea como personaje
     *  y ya no se spawnea. */
    private initRecruitNpcs(): void {
      for (const r of RECRUIT_NPCS.filter(rn => rn.mapId === this.currentMapConfig.id)) {
        if (this.reg.unlocks?.isCharacterUnlocked(r.name)) continue;   // ya reclutado
        if (!this.textures.exists(r.texKey)) continue;
        const animKey = `${r.texKey}_idle_down`;
        this.ensureNpcAnim(r.texKey, animKey);
        this.spawnCityNpc(r.name, r.texKey, animKey, r.tileX, r.tileY, r);
      }
    }

    /** Idle (mirando abajo) de un NPC: frames LPC 312-313, mismo layout que el jugador. */
    private ensureNpcAnim(texKey: string, animKey: string): void {
      if (this.anims.exists(animKey)) return;
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(texKey, { start: 312, end: 313 }),
        frameRate: 2,
        repeat: -1,
      });
    }

    /** Coloca un NPC quieto en el tile (tileX,tileY): mismo tamaño/profundidad que el
     *  jugador, idle en bucle, y su tile bloqueado para que no se le pueda pisar. */
    private spawnCityNpc(name: string, texKey: string, animKey: string, tileX: number, tileY: number, recruit?: typeof RECRUIT_NPCS[0]): void {
      const TS = GameScene.TILE_SIZE;
      // --- Ajustes del NPC (tocar estos si no cuadra) ---
      // Misma escala que el jugador (initPlayer: 2.5): con 2.8 los NPCs salían más
      // grandes y se veían más pixelados que el PJ pese a usar la misma hoja LPC.
      const SCALE       = 2.5;   // tamaño del sprite (igual que el jugador)
      const FOOT_OFFSET = 29;    // px que sube el sprite para que los pies caigan en el tile (∝ escala)
      // Caja de colisión en TILES, relativa al tile de los pies (tileX,tileY). Generosa
      // a propósito: el jugador colisiona por su CENTRO, y con sprites LPC altos hay que
      // bloquear de más para chocar ANTES de solaparse con el dibujo. Ancho impar = centrado.
      const COL_W   = 3;         // ancho (tiles)
      const COL_UP  = 1;         // filas por encima de los pies (cuerpo/cabeza)
      const COL_DOWN = 1;        // filas por debajo de los pies (evita meterse por abajo)

      const footX = tileX * TS + TS / 2;
      const footY = tileY * TS + TS / 2;

      const npc = this.add.sprite(footX, footY - FOOT_OFFSET, texKey, 312);
      npc.setScale(SCALE);
      npc.setDepth(footY);
      if (this.anims.exists(animKey)) npc.play(animKey);

      // Sombra elíptica a los PIES REALES del sprite. OJO: NO va en `footY` (el tile):
      // el personaje LPC se dibuja con los pies bastante por debajo del centro, así que
      // una sombra en footY quedaba flotando tras el cuerpo y no se veía. La anclamos al
      // sprite (alto*0.40 por debajo del centro = los pies). Profundidad basada en `y`
      // (footY-1): detrás del NPC y por ENCIMA de las capas del mapa (que van en depth
      // 0,1,2,3… por capa, antes la tapaban).
      const feetY = npc.y + npc.displayHeight * 0.40;
      this.add.ellipse(footX, feetY, npc.displayWidth * 0.36, npc.displayWidth * 0.14, 0x000000, 0.38)
        .setDepth(footY - 1);

      // Punto de interacción para hablar: los pies del NPC.
      this.cityNpcs.push({ sprite: npc, x: footX, y: footY, name, recruit });

      // Bloquea la caja completa alrededor del cuerpo.
      const halfW = Math.floor(COL_W / 2);
      for (let dx = -halfW; dx <= halfW; dx++) {
        for (let ty = tileY - COL_UP; ty <= tileY + COL_DOWN; ty++) {
          this.collisionTiles.add(`${tileX + dx},${ty}`);
        }
      }
    }

    /** NPC hablable más cercano (dentro de rango), o null. */
    private nearestNpc(): { sprite: Phaser.GameObjects.Sprite; x: number; y: number; name: string } | null {
      if (this.cityNpcs.length === 0) return null;
      const pos = this.player.getPosition();
      const RANGE = GameScene.TILE_SIZE * 2.2;
      let nearest: typeof this.cityNpcs[0] | null = null;
      let nearestDist = Infinity;
      for (const npc of this.cityNpcs) {
        const dx = npc.x - pos.x;
        const dy = npc.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > RANGE) continue;
        if (dist < nearestDist) { nearestDist = dist; nearest = npc; }
      }
      return nearest;
    }

    /** Habla con un NPC: si es reclutable y aún no está reclutado, suelta su frase de
     *  reclutamiento y lo desbloquea como personaje (flag global → aparece en el
     *  roster); si no, dice su línea normal. */
    private talkToNpc(npc: typeof this.cityNpcs[0]): void {
      if (npc.recruit && !this.reg.unlocks?.isCharacterUnlocked(npc.name)) {
        const player = this.reg.asgard?.selectedPlayer?.name ?? 'viajero';
        this.reg.dialogue?.show(npc.name,
          `Hombre ${player}, ¿qué tal? A partir de ahora puedes elegirme para jugar contigo.`);
        this.reg.unlocks?.setFlag(npc.recruit.charFlag, 'global');
        return;
      }
      this.reg.dialogue?.show(npc.name, this.npcLine(npc.name));
    }

    /** Línea que dice un NPC al hablarle. Kugo saluda al jugador por su nombre. */
    private npcLine(name: string): string {
      const player = this.reg.asgard?.selectedPlayer?.name ?? 'viajero';
      switch (name) {
        case 'Kugo':    return `${player}, ¡cuánto tiempo!`;
        case 'Italien': return `Eh, ${player}, ¿listo para la aventura?`;
        case 'Rake':    return `${player}, cuando quieras partimos.`;
        default:        return '...';
      }
    }

    /** Crea un cofre de ciudad (fijo o construido) en (x,y) px: sprite, colisión y
     *  sincronización con la ventana compartida. Ambos abren el mismo almacén.
     *  Devuelve el entry y un unsub del sync de frame (para quitarlo en caliente). */
    private addTownChest(x: number, y: number, chestId: string): {
      entry: ActiveChest;
      isOpenUnsub: () => void;
    } {
      const col = 5;   // Cofre 6 (chests.png: columna 5 → idle, anim col+10/+20/+30)

      const sprite = this.add.sprite(x, y, 'chests', col);
      sprite.setScale(4);
      sprite.setDepth(2);

      // Colisión: el sprite ocupa 128×128 px centrado en (x, y)
      const blocked = this.computeFootprintTiles(x, y, (32 * 4) / 2);
      for (const k of blocked) this.collisionTiles.add(k);

      const entry = { sprite, col, blocked, opening: false, isTownChest: true, chestId };
      this.activeChests.push(entry);

      // Al terminar la animación: permite reabrir (la ventana ya controla el frame)
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        entry.opening = false;
      });

      // Sincroniza el frame con el estado de la ventana Angular: se ve ABIERTO solo
      // si la ventana abierta es la de ESTE cofre (col+30 = último frame; col = cerrado).
      const isOpenSub = this.reg.summon.townChestIsOpen$.subscribe(openId => {
        // Guarda anti-crash: townChestIsOpen$ es un servicio global que sobrevive a los
        // restart de escena; si esta suscripción no se limpió a tiempo puede dispararse
        // sobre un sprite ya destruido (textura sin frames → setFrame peta con 'cutWidth').
        if (!sprite.active || !sprite.scene) return;
        sprite.setFrame(openId === chestId ? col + 30 : col);
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

    /** Tiles ocupados por el jugador y los NPCs de ciudad, para impedir construir
     *  encima de ellos. Ambos colisionan por su CENTRO; bloqueamos su tile de pies y
     *  el de encima (el cuerpo del sprite LPC es alto y se solaparía con la construcción). */
    private occupantTiles(): Set<string> {
      const TS = GameScene.TILE_SIZE;
      const tiles = new Set<string>();
      const add = (px: number, py: number) => {
        const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
        tiles.add(`${tx},${ty}`);
        tiles.add(`${tx},${ty - 1}`);
      };
      const pos = this.player.getPosition();
      add(pos.x, pos.y);
      for (const npc of this.cityNpcs) add(npc.x, npc.y);
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
        const { entry, isOpenUnsub } = this.addTownChest(x, y, building.id ?? HOME_CHEST_ID);
        this.placedBuildings.push({ building, sprite: entry.sprite, blocked: entry.blocked, chestEntry: entry, isOpenUnsub });
      } else {
        const sprite = this.add.sprite(x, y, def.spriteKey, def.frame);
        sprite.setScale(def.scale);
        sprite.setDepth(2);
        if (def.animKey && this.anims.exists(def.animKey)) sprite.play(def.animKey);
        // Sombra de elipse bajo la base del sprite (objetos estáticos).
        let shadow: Phaser.GameObjects.Ellipse | undefined;
        if (def.shadow) {
          const baseY = sprite.y + sprite.displayHeight / 2;
          shadow = this.add.ellipse(sprite.x, baseY - sprite.displayHeight * 0.06,
            sprite.displayWidth * 0.5, sprite.displayHeight * 0.16, 0x000000, 0.28);
          shadow.setDepth(1.9);   // bajo el sprite (depth 2), sobre el suelo
        }
        // Los edificios con ventana (fragua, fundición, tienda…) se pulsan para abrir
        // su menú: los marcamos interactivos para que los controles móviles
        // (joystick/ataque ocupan media pantalla) ignoren el toque que cae sobre ellos
        // y no disparen movimiento/ataque al abrir la ventana.
        if (def.opensWindow) {
          sprite.setInteractive();
          sprite.setData('blockControls', true);
        }
        const blocked = this.computeFootprintTiles(x, y, (def.frameSize * def.scale) / 2);
        for (const k of blocked) this.collisionTiles.add(k);
        const pb = { building, sprite, blocked, shadow };
        this.placedBuildings.push(pb);
        // Si es una forja y ya se está produciendo, nace encendida.
        if (def.litAnimKey && this.reg.forge?.anyProducing$.value) this.setStationLit(pb, true);
      }
    }

    private initBuildClearedListener(): void {
      const cityBuild = this.reg.cityBuild;
      if (!cityBuild) return;
      this.clearedSub = cityBuild.cleared$.subscribe(() => this.removePlacedBuildings());
      // El fuego de las forjas se enciende mientras PRODUCEN (no al abrir/tocar el menú).
      // Al cambiar el estado de producción, enciende/apaga todas las forjas colocadas.
      this.forgeProducingSub = this.reg.forge?.anyProducing$.subscribe(producing => {
        this.setForgesLit(!!producing);
      }) ?? null;
    }

    /** Enciende/apaga el fuego de TODAS las forjas colocadas (estaciones con litAnimKey). */
    private setForgesLit(lit: boolean): void {
      for (const pb of this.placedBuildings) {
        const def = this.reg.cityBuild?.def(pb.building.type);
        if (def?.litAnimKey) this.setStationLit(pb, lit);
      }
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
      // No dejar referencias a un sprite a punto de destruirse (evita encender/apagar
      // una estación ya borrada o movida).
      if (this.pendingLitBuilding === pb) this.pendingLitBuilding = null;
      if (this.litBuilding === pb)        this.litBuilding = null;
      pb.sprite.destroy();
      pb.shadow?.destroy();
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

    /** Cofre central del mapa (cofre 2 = col 1) en el centro. Bloquea su huella. */
    private spawnMapChest(): void {
      if (!this.currentMap) return;
      if (this.currentMapConfig.id === 'hogar') return;   // en Asgard no hay mejoras de mapa
      const TS = GameScene.TILE_SIZE;
      // Centro del mapa desplazado a la derecha (el spawn del jugador cae en el centro).
      const x = (this.currentMap.width  * TS) / 2 + TS * 6;
      const y = (this.currentMap.height * TS) / 2;
      const sprite = this.add.sprite(x, y, 'chests', 1);   // 1 = cofre 2, frame cerrado
      sprite.setScale(4);
      sprite.setDepth(2);
      const half = (32 * 4) / 2;
      const blocked = this.computeFootprintTiles(x, y, half);
      for (const k of blocked) this.collisionTiles.add(k);
      this.mapChest = { sprite, blocked };
    }

    /** ¿El jugador está junto al cofre central? (bordes del sprite, como los demás cofres). */
    private nearMapChest(): boolean {
      if (!this.mapChest) return false;
      const pos = this.player.getPosition();
      const range = GameScene.CHEST_INTERACT_RANGE;
      const b = this.mapChest.sprite.getBounds();
      const dx = Math.max(b.left - pos.x, 0, pos.x - b.right);
      const dy = Math.max(b.top  - pos.y, 0, pos.y - b.bottom);
      return dx * dx + dy * dy <= range * range;
    }

    /** Edificio con ventana propia (p.ej. tienda) dentro del rango de interacción, o null. */
    private nearestWindowBuilding(): typeof this.placedBuildings[0] | null {
      const pos   = this.player.getPosition();
      const range = GameScene.CHEST_INTERACT_RANGE;
      for (const pb of this.placedBuildings) {
        const def = this.reg.cityBuild?.def(pb.building.type);
        if (!def?.opensWindow) continue;
        // Distancia a los BORDES del edificio (no al centro): los sprites grandes (la
        // tienda) tienen el centro lejos aunque estés justo al lado. Así el espacio
        // abre la ventana estando pegado, igual que pinchando el edificio.
        const b = pb.sprite.getBounds();
        const dx = Math.max(b.left - pos.x, 0, pos.x - b.right);
        const dy = Math.max(b.top  - pos.y, 0, pos.y - b.bottom);
        if (dx * dx + dy * dy <= range * range) return pb;
      }
      return null;
    }

    /** Si el toque cae sobre un edificio con ventana propia, la abre. Devuelve true si lo gestionó. */
    private handleBuildingWindowTap(pointer: Phaser.Input.Pointer): boolean {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      // Cofre central del mapa.
      if (this.mapChest && this.mapChest.sprite.getBounds().contains(world.x, world.y)) {
        this.reg.cityBuild.requestOpenWindow('mapChest');
        return true;
      }
      const pb = this.placedBuildings.find(b => b.sprite.getBounds().contains(world.x, world.y));
      if (!pb) return false;
      const def = this.reg.cityBuild.def(pb.building.type);
      if (!def?.opensWindow) return false;
      this.pendingLitBuilding = pb;   // candidata a encender si la ventana se abre
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
      if (def.animKey && this.anims.exists(def.animKey)) ghost.play(def.animKey);

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
      // No dejar construir encima del jugador ni de otros personajes (NPCs de ciudad).
      const occupants = this.occupantTiles();
      const free = tiles.every(k => !this.collisionTiles.has(k) && !occupants.has(k));
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
      // Al mover, conserva el id del edificio original → su almacén (cofre) le sigue.
      const b: PlacedBuilding = { type: bp.def.type, tileX: bp.tileX, tileY: bp.tileY, id: bp.moving?.id };
      if (bp.moving) {
        this.reg.cityBuild.move(bp.moving, { tileX: bp.tileX, tileY: bp.tileY });  // reubica
      } else {
        this.reg.cityBuild.add(b);   // persiste (global, compartido) + notifica a Angular (asigna b.id)
      }
      this.spawnBuilding(b);         // construcción permanente con colisión en su sitio nuevo
      bp.moving = undefined;         // ya gestionado → que el cleanup no restaure el original
      this.closePlacement();         // limpia ghost/botones
    }

    private openChest(chest: typeof this.activeChests[0]): void {
      chest.opening = true;
      chest.sprite.play(`chest_open_${chest.col}`);
      if (chest.isTownChest) {
        this.reg.summon.townChestOpen$.next(chest.chestId ?? HOME_CHEST_ID);
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
          const base = cfg.spriteBase ?? `assets/sprites/enemy/${baseType}`;
          this.load.spritesheet(key, `${base}/${actionCfg.filename}.png`, {
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
        this.collisionTiles,
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
      // TEMP diagnóstico: revela CUALQUIER skill que se lance (auto o manual) y si es AoE.
      console.log('[SKILLCAST]', abilityId, 'aoeRadius=', cfg.aoeRadius ?? '—', 'effect=', cfg.effectType);
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
        if (dist <= RANGE && dist < nearestDist
          && this.hasLineOfSight(playerPos.x, playerPos.y, ePos.x, ePos.y)) {
          nearest = enemy; nearestDist = dist;
        }
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
