import { Subscription } from 'rxjs';
import { GameRegistry } from '../game-registry';
import { mapFeatureId } from '../../services/unlock-config';
import { planetCapitalForMap } from '../gamescene/map-config';
import { RUN_UNLOCK_POINTS } from './run-unlock-points';
import { starProdPerMin } from '../../services/run-milestones';
import { unlockedStarPatterns, STAR_PATTERN_GAP_M, STAR_FIRST_M, STAR_HEIGHT_LEVELS, StarPattern } from './run-star-patterns';
import { bodySpriteFor } from '../../pnj/player/body-config';
import {
  WorldParallaxId, getWorldParallaxSet, worldParallaxKey, worldParallaxPath,
  worldParallaxFactor, WORLD_PARALLAX_SRC_W, WORLD_PARALLAX_SRC_H,
} from './parallax-sets';

/**
 * Modo Mundo — runner lateral 2D estilo Idle Slayer.
 *
 * Escena SEPARADA de GameScene (el juego grid top-down): aquí no hay tiles de
 * Tiled ni GridControls. El jugador corre solo hacia la derecha con gravedad,
 * un TAP salta, y el suelo es infinito generado por chunks reciclados.
 *
 * Fase 0+1: andamiaje + entrada + auto-run + suelo plano infinito + salto.
 * Pendiente (fases siguientes): contador de metros en HUD, monedas/monstruos,
 * desbloqueos por distancia, huecos y variedad procedural, parallax de fondo.
 */

// --- Tiles de suelo (imágenes sueltas en assets/tilemaps/world/) ---
//  suelo_01 = superficie con hierba (fila de arriba) · suelo_02 = relleno de tierra
const RT = 48;                       // tamaño de tile de juego (chunk/colisión/metros)
const SUELO_FILE = 64;               // px del archivo de suelo (suelo_01/02 son 64×64)
const GROUND_TILE = 64;              // tamaño EN PANTALLA de cada tile de suelo. Antes 32
                                     // (escala 0.5) → se veían diminutos. A 64 = tamaño
                                     // nítido 1:1 del archivo (subir = tiles más grandes).
const SUELO_TILE_SCALE = GROUND_TILE / SUELO_FILE;  // escala del texture (1.0 = sin escalar)
const TEX_SUELO_TOP = 'wr_suelo_top';
const TEX_SUELO_FILL = 'wr_suelo_fill';

// --- Letrero de inicio (follow.png: flecha "→", indica el sentido de carrera) ---
const TEX_SIGN = 'wr_sign';
const SIGN_SCALE = 2.5;              // 32px → 80px en pantalla (~1.25 tiles de alto)

// --- Puntos de interés (interest_point.png): hitos por distancia que desbloquean mapas ---
const TEX_INTEREST = 'wr_interest';

// --- Estrellas coleccionables (assets/sprites/resources/world_mode/star/) ---
// 10 frames de un parpadeo: star.png (frame 1) + star2..star10.png, animados en
// bucle. Las estrellas salen en GRUPOS (packs) con forma definida — ver
// run-star-patterns.ts. TODAS van altas (hay que saltar para cogerlas). El contador
// (estado del jugador, persistido como las monedas) sale arriba a la derecha. NOTA:
// si los PNG están vacíos/corruptos, Phaser pinta el cuadro verde "textura faltante"
// pero la estrella se sigue pudiendo recoger.
const STAR_KEYS = Array.from({ length: 10 }, (_, i) => `wr_star_${i + 1}`);
const STAR_FILES = STAR_KEYS.map((_, i) =>
  `assets/sprites/resources/world_mode/star/star${i === 0 ? '' : i + 1}.png`);
const STAR_ANIM = 'wr_star_twinkle';
const STAR_SCALE = 1.8;

// --- Corazones coleccionables (assets/sprites/resources/world_mode/hearth/) ---
// Mismo patrón que las estrellas: 10 frames (heart1..heart10.png) animados en bucle.
// Aparece un corazón cada HEART_INTERVAL_M metros; al recogerlo cura HEART_HEAL de
// vida. El sprite va al lado del de estrellas (carpeta hermana). Si los PNG están
// vacíos/corruptos, Phaser pinta el cuadro verde pero el corazón se sigue recogiendo.
const HEART_KEYS = Array.from({ length: 10 }, (_, i) => `wr_heart_${i + 1}`);
const HEART_FILES = HEART_KEYS.map((_, i) =>
  `assets/sprites/resources/world_mode/hearth/heart${i + 1}.png`);
const HEART_ANIM = 'wr_heart_beat';
const HEART_INTERVAL_M = 75;         // cada cuántos metros aparece un corazón
const HEART_SCALE = 1.8;
const HEART_HEAL = 10;               // vida que cura al recogerlo
const HEART_HEIGHTS = [50, 120, 90];

// --- Bloques "?" tipo Mario Bros (procedurales, sin asset) ---
// Cajas doradas flotantes: al SALTAR y golpearlas DESDE ABAJO (cabezazo) sueltan 1
// estrella y quedan "gastadas" (no vuelven a dar). Se generan por delante (una cada
// BLOCK_INTERVAL_MS por TIEMPO) y se reciclan al quedar atrás, como corazones/estrellas.
// La textura se dibuja por código en buildBlockTextures() (patrón de ARROW/AURA): si
// luego quieres arte propio, sustituye BLOCK_KEY/BLOCK_USED_KEY por sprites cargados.
const BLOCK_KEY = 'wr_qblock';        // caja con "?"
const BLOCK_USED_KEY = 'wr_qblock_used';   // caja gastada (tras el golpe)
const BLOCK_TEX = 32;                 // px del texture generado
const BLOCK_SCALE = 1.6;              // 32 → ~51 px en pantalla (~1 tile)
const BLOCK_DISPLAY = BLOCK_TEX * BLOCK_SCALE;
// Ritmo de aparición POR TIEMPO (no por distancia): un bloque cada BLOCK_INTERVAL_MS.
// Parámetro variable: baja para más cajas, sube para menos. 10000 = 1 cada 10 s.
const BLOCK_INTERVAL_MS = 10000;
// Centro del bloque sobre la línea de suelo (px). TODOS a la misma altura, alta:
// pide un salto mantenido para llegar. En reposo NO se tocan (hay que saltar).
const BLOCK_HEIGHT = 260;

// --- Lluvia de estrellas (recompensa #2 de la Caja aleatoria) ---
// Durante STAR_RAIN_MS se siembran estrellas normales (coleccionables, mismo grupo que
// las de siempre) en el MAPA NUEVO que va apareciendo por delante del borde derecho:
// NO surgen de golpe en mitad de la pantalla, nacen fuera y entran con el scroll. Cada
// estrella se coloca en un hueco LIBRE (nunca encima de otra). Los patrones normales
// siguen igual — esto se suma por encima.
const STAR_RAIN_MS = 10000;          // duración del evento
const STAR_RAIN_SPAWN_MS = 260;      // cada cuánto se siembra una tanda (mitad de densidad)
const STAR_RAIN_PER_TICK = 3;        // estrellas por tanda
const STAR_RAIN_AHEAD_W = 420;       // ancho (px) de la franja de mapa nuevo donde sembrar
const STAR_RAIN_MIN_GAP = 46;        // distancia mínima entre estrellas (sin solaparse)

// --- Enemigos decorativos (assets/sprites/enemy/world/rat/rat.png) ---
// Hoja 768×160 con frames de 64×32 (NO 32×32): 12 cols × 5 filas. El contenido va
// centrado en cada celda de 64px (verificado por alfa: centros en x=32,96,160…).
// Filas: idle 0 (4fr), move 1 (8fr), attack 2 (12fr), damage 3 (4fr), death 4 (5fr).
// En el Modo Mundo la rata está plantada en idle y reproduce el ataque al pasar el
// jugador (de momento decorativo, sin daño). Una cada RAT_INTERVAL_M metros.
const TEX_RAT = 'wr_rat';
const RAT_SHEET = 'assets/sprites/enemy/world/rat/rat.png';
const RAT_FW = 64;
const RAT_FH = 32;
const RAT_COLS = 12;
const RAT_ANIM_IDLE = 'wr_rat_idle';
const RAT_ANIM_ATTACK = 'wr_rat_attack';
const RAT_ANIM_DEATH = 'wr_rat_death';
const RAT_IDLE_FRAMES   = { start: 0,            end: 3 };                 // fila 0 (4 fr)
const RAT_ATTACK_FRAMES = { start: 2 * RAT_COLS, end: 2 * RAT_COLS + 11 }; // fila 2 (12 fr)
const RAT_DEATH_FRAMES  = { start: 4 * RAT_COLS, end: 4 * RAT_COLS + 4 };  // fila 4 (5 fr)
const RAT_INTERVAL_M = 25;            // una rata cada 25 m
const RAT_SCALE = 4.4;
const RAT_FACE_LEFT = true;           // mira hacia el jugador que llega por la izquierda
// Combate: la rata telegrafía su ataque al acercarte por el suelo y te hace daño al
// contacto; si saltas y caes sobre su lomo, la matas sin recibir daño (rebote).
const RAT_DAMAGE = 30;                // daño al jugador al chocar a ras de suelo (×3)
const RAT_SENSE_PX = 150;             // distancia a la que empieza su animación de ataque
const RAT_CONTACT_PX = 60;            // distancia horizontal de contacto (aplica daño)
const RAT_STOMP_HALF_W = 60;          // medio ancho del lomo para el pisotón
// Franja de altura (px de los pies sobre el suelo) en la que cuenta el pisotón: hay
// que CAER sobre el cuerpo de la rata, ni muy alto (vuelas por encima) ni a ras de
// suelo (eso es choque con daño). Bajar RAT_STOMP_HIGH = hay que descender más.
const RAT_STOMP_LOW = 18;             // por debajo de esto = estás en el suelo (choque)
const RAT_STOMP_HIGH = 52;            // por encima de esto = vas demasiado alto (no pisas)
const RAT_STOMP_BOUNCE = 520;         // impulso de rebote al pisarla

// --- Fénix (enemigo volador): assets/sprites/enemy/world/fenix ---
// Hoja 1024×384 con frames de 64×64 (16 cols × 6 filas). Filas (frames reales):
// idle 0 (4), fly 1 (4), attack 2 (8), damage 3 (4), death 4 (8), rebirth 5 (9).
// Vuela en el aire (no toca el suelo) y aparece cada FENIX_INTERVAL_M m desde
// FENIX_START_M (25, 75, 125…), intercalándose con las ratas (que salen en 50, 100…).
const TEX_FENIX = 'wr_fenix';
const FENIX_SHEET = 'assets/sprites/enemy/world/fenix/Phoenixling Sprite Sheet.png';
const FENIX_FW = 64;
const FENIX_FH = 64;
const FENIX_COLS = 16;
const FENIX_ANIM_FLY = 'wr_fenix_fly';
const FENIX_ANIM_DEATH = 'wr_fenix_death';
const FENIX_FLY_FRAMES   = { start: 1 * FENIX_COLS, end: 1 * FENIX_COLS + 3 };  // fila 1 (4 fr)
const FENIX_DEATH_FRAMES = { start: 4 * FENIX_COLS, end: 4 * FENIX_COLS + 7 };  // fila 4 (8 fr)
const FENIX_INTERVAL_M = 50;          // un fénix cada 50 m
const FENIX_START_M = 25;             // el primero a los 25 m (luego 75, 125…)
const FENIX_SCALE = 3.0;
const FENIX_FACE_LEFT = true;         // mira hacia el jugador que llega por la izquierda
const FENIX_HEIGHT = 190;             // px sobre el suelo a los que vuela (centro del sprite)
const FENIX_BOB = 14;                 // amplitud del balanceo de vuelo (px)
// Combate: igual que la rata pero la franja del pisotón es relativa a SU centro (está
// en el aire). Caer sobre él = muerte sin daño + rebote; tocarlo de otra forma = daño.
const FENIX_DAMAGE = 12;              // daño si chocas con él sin pisarlo
const FENIX_STOMP_HALF_W = 60;        // medio ancho horizontal para el pisotón
const FENIX_STOMP_ABOVE = 45;         // pies hasta esto por ENCIMA de su centro = pisotón
const FENIX_STOMP_BELOW = 16;         // ...y hasta esto por debajo de su centro
const FENIX_BODY_HALF_W = 52;         // medio cuerpo (para el daño por contacto)
const FENIX_BODY_HALF_H = 30;         // medio alto del cuerpo
const FENIX_STOMP_BOUNCE = 540;       // impulso de rebote al pisarlo
// Ataque: al acercarte, el fénix lanza UNA bola de fuego que cae al suelo y rueda
// hacia ti; la esquivas saltándola. La bola reutiliza los frames de skills/fire.
const FENIX_ANIM_ATTACK = 'wr_fenix_attack';
const FENIX_ATTACK_FRAMES = { start: 2 * FENIX_COLS, end: 2 * FENIX_COLS + 7 };  // fila 2 (8 fr)
const FENIX_ATTACK_PX = 460;          // distancia a la que dispara (una vez por fénix)
const FIREBALL_KEY = 'skill_fireball';  // prefijo de los frames _1.._15 (precargados por GameScene)
const FIREBALL_FRAMES = 15;
const FIREBALL_PATH = 'assets/sprites/skills/fire/Fireball/fireball_';
const FIREBALL_ANIM = 'wr_fireball';
const FIREBALL_SCALE = 0.8;           // la mitad que antes
const FIREBALL_SPEED = 340;           // px/s hacia el jugador (izquierda); más rápida = más "lanzada"
const FIREBALL_GRAVITY = 520;         // arco MÁS PLANO: la lanza hacia delante en vez de soltarla
const FIREBALL_GROUND_OFFSET = 30;    // altura del centro sobre el suelo al rodar
const FIREBALL_DAMAGE = 12;           // daño si te alcanza
const FIREBALL_HIT_W = 34;            // medio ancho de colisión con el jugador
const FIREBALL_HIT_H = 26;            // si los pies del jugador quedan por encima → la saltó

// --- Mundo / chunks ---
const CHUNK_TILES = 16;              // ancho de un chunk en tiles
const CHUNK_W = CHUNK_TILES * RT;    // ancho de un chunk en px de mundo
// Filas de tiles de suelo visibles (de la hierba al borde inferior). 2 = se ven
// ~2 tiles en vertical: 1 fila de hierba (suelo_01) + 1 de tierra (suelo_02).
const GROUND_VISIBLE_ROWS = 2;
const GROUND_BAND_H = GROUND_VISIBLE_ROWS * GROUND_TILE;  // alto de la banda de suelo (px pantalla)
// El colisionador del suelo va casi en el borde superior del tile (suelo_01 tiene
// la hierba arriba del todo), así el personaje pisa justo sobre la hierba.
const SURFACE_INSET = RT * 0.12;

// --- Física / movimiento ---
const GRAVITY_Y = 5500;              // más gravedad = salto más rápido (menos flotante)
const RUN_SPEED = 260;               // px/s constantes hacia la derecha (bajar = más lento)
const PX_PER_METER = RT;             // 1 tile = 1 metro

// --- Salto variable (mantener = más alto, con tope) ---
// Impulsos y gravedad escalados juntos: el salto es más rápido pero mantiene casi la
// misma altura alcanzable (las estrellas van colocadas a alturas concretas).
const JUMP_INITIAL_VELOCITY = 759;   // impulso al pulsar (altura del toque mínimo)
const JUMP_HOLD_ACCEL = 8000;        // px/s² extra hacia arriba mientras se mantiene
const JUMP_MAX_HOLD_MS = 167;        // tiempo máx. que el mantener sigue impulsando
const JUMP_MAX_VELOCITY = 1360;      // tope de velocidad de subida (límite de altura)

// --- Habilidades estilo Idle Slayer ---
// Controles: TAP salta · TAP en el aire = doble salto · swipe DERECHA = embestida
// (dash) · swipe ABAJO = golpe descendente (slam). Teclado: ESPACIO / D o → / S o ↓.
// El arco dispara solo (flecha recta hacia delante cada X segundos, a la altura a la
// que vayas: saltando puedes flechar a un fénix).
const DOUBLE_JUMP_VELOCITY = 1106;   // impulso del 2º salto (algo menor que el 1º a tope)
const DASH_SPEED = 1050;             // px/s durante la embestida (~4× la carrera)
const DASH_MS = 260;                 // duración de la embestida
const DASH_COOLDOWN_MS = 2500;       // enfriamiento entre embestidas
const DASH_KILL_PAD = 30;            // margen extra de "atropello" durante el dash
const SLAM_SPEED = 1500;             // velocidad de caída del golpe descendente
const SLAM_KILL_RADIUS = 110;        // radio (px) del impacto al aterrizar: mata ratas
const ARROW_INTERVAL_MS = 2800;      // cadencia del arco automático
const ARROW_SPEED = 900;             // px/s de la flecha (hacia la derecha)
const ARROW_KEY = 'wr_arrow';        // textura generada por código (sin asset)
const ARROW_HIT_X = 46;              // medio ancho de impacto de la flecha
const SWIPE_MIN_PX = 46;             // desplazamiento mínimo para que un toque sea swipe
const SWIPE_MAX_MS = 320;            // tiempo máximo del gesto

// Boost (botón junto al de impulso). Dura 10 s (lo mide PlayerBridgeService, flyActive).
// Mientras dura: ×5 de velocidad, invulnerable y arrasa enemigos al contacto, con aura.
// Corre y salta con normalidad (sin vuelo).
const FLY_SPEED_MULT = 5;            // ×5 la velocidad de carrera durante el boost
const AURA_KEY = 'wr_fly_aura';      // textura de partícula del aura (generada por código)
// Aura sprite (Dragon Ball): PNG limpio de 4 frames 100×100 con fondo transparente,
// extraído de la fila dorada de assets/sprites/test/aura.jpg (tools/jimp, ver memoria).
const AURA_SHEET = 'wr_aura_sheet';  // spritesheet cargado (aura_gold.png)
const AURA_ANIM = 'wr_aura_anim';    // animación del aura
const AURA_FRAME_W = 100;
const AURA_FRAME_H = 100;
const AURA_COLS = 4;
const AURA_SPRITE_SCALE = 1.8;       // tamaño del aura respecto al frame (envuelve al jugador)
const AURA_Y_OFFSET = 80;            // sube el aura de los pies (origin del jugador) al torso
const AURA_X_OFFSET = 20;            // ajuste horizontal fino del aura respecto al jugador

// --- Escalera de mejoras (hitos comprables con estrellas, ver run-milestones.ts) ---
// El loop estilo Idle Slayer: matar da estrellas → compras la siguiente mejora →
// llegas más lejos → más estrellas. Efectos por hito:
const MAGNET_RADIUS_1 = 140;         // 'magnet1': radio (px) que atrae estrellas/corazones
const MAGNET_RADIUS_2 = 260;         // 'magnet2': radio ampliado
const MAGNET_PULL = 620;             // px/s a los que vuelan hacia ti los atraídos
const HEART_HEAL_BOOSTED = 25;       // 'heart_boost': curación del corazón mejorada
const STAR_PER_KILL = 5;             // estrellas base por enemigo abatido (× estrellas valiosas)
const SECOND_CHANCE_INVULN_MS = 1500; // 'second_chance': invulnerable tras revivir

// --- Jugador (placeholder: cuerpo LPC corriendo de lado) ---
const PLAYER_SCALE = 2.1;            // ~2 tiles de alto sobre el suelo. Subir = más grande.
// LPC expandido: la animación RUN está en las filas 38-41 (8 frames). Run-derecha
// = fila 41 = frames 533-540 (≠ WALK derecha, que es 143-150).
const PLAYER_RUN_FRAMES = { start: 533, end: 540 };
const PLAYER_DEATH_FRAMES = { start: 260, end: 265 };   // animación de muerte (cuerpo LPC)
const PLAYER_RUN_AIR_FRAME = 537;                     // frame congelado en el aire
const PLAYER_IDLE_FRAME = 325;                        // IDLE RIGHT

// El parallax de fondo es configurable (varios sets) desde ajustes; ver parallax-sets.ts.

interface RunChunk {
  grass: Phaser.GameObjects.TileSprite;
  dirt:  Phaser.GameObjects.TileSprite;
  floor: Phaser.GameObjects.Rectangle;
  index: number;   // posición del chunk: ocupa [index*CHUNK_W, (index+1)*CHUNK_W]
}

export class WorldRunScene extends Phaser.Scene {
  private reg!: GameRegistry;

  private player!: Phaser.Physics.Arcade.Sprite;
  private chunks: RunChunk[] = [];
  private rightmostIndex = 0;
  private groundTopY = 0;
  private startX = 0;
  private distanceM = 0;
  // Distancia (m) a la que arranca la carrera. >0 cuando entras desde el portal de
  // salida de un mapa: apareces en la ENTRADA de ese mapa, no en el km 0. Lo fija
  // init() a partir del mapa de origen (ver entryDistanceFor / RUN_UNLOCK_POINTS).
  private startDistanceM = 0;

  // Estrellas vivas en el mundo. Salen en packs (run-star-patterns.ts):
  //  - nextPatternM: metros del ancla del PRÓXIMO pack a plantar.
  //  - patternCursor: índice del pack en la lista desbloqueada (rota en bucle).
  private stars!: Phaser.Physics.Arcade.Group;
  private nextPatternM = STAR_FIRST_M;
  private patternCursor = 0;
  // Corazones: igual que las estrellas pero uno cada HEART_INTERVAL_M metros; curan
  // al recogerlos. nextHeartIndex 1 = primer corazón a HEART_INTERVAL_M metros.
  private hearts!: Phaser.Physics.Arcade.Group;
  private nextHeartIndex = 1;
  // Bloques "?" tipo Mario: aparece uno cada BLOCK_INTERVAL_MS (por TIEMPO); al
  // golpearlos desde abajo saltando sueltan 1 estrella. nextBlockAt = instante (ms de
  // la escena) del próximo spawn.
  private blocks!: Phaser.Physics.Arcade.Group;
  private nextBlockAt = 0;
  // Lluvia de estrellas (recompensa de la Caja aleatoria): activa hasta starRainUntil;
  // nextRainStarAt = instante de la próxima tanda. Usa el grupo `stars` normal.
  private starRainUntil = 0;
  private nextRainStarAt = 0;
  // Ratas: plantadas en idle; el jugador las mata al pasar a su lado. Mundo infinito:
  // solo existen las cercanas (se generan por delante y se reciclan al quedar atrás).
  // Al morir salen del array y se animan/destruyen por su cuenta (ver playRatDeath).
  private rats: { sprite: Phaser.GameObjects.Sprite; attacking: boolean; hit: boolean }[] = [];
  private nextRatIndex = 1;
  // Fénix voladores: hover en el aire; lo matas saltándole encima (pisotón). Se
  // generan por delante y se reciclan al quedar atrás. nextFenixIndex 0 = primero a
  // FENIX_START_M metros.
  private fenixes: { sprite: Phaser.GameObjects.Sprite; hit: boolean; attacked: boolean }[] = [];
  private nextFenixIndex = 0;
  // Bolas de fuego del fénix: caen al suelo y ruedan hacia el jugador (se mueven a mano).
  private fireballs: { sprite: Phaser.GameObjects.Sprite; vx: number; vy: number; grounded: boolean }[] = [];
  private jumpSub?: Subscription;
  private jumpReleaseSub?: Subscription;
  private parallaxSub?: Subscription;
  private enterMapSub?: Subscription;
  private exitSub?: Subscription;
  // Mapa por cuyo portal se entró al Modo Mundo: determina el planeta (y por tanto su
  // capital) al que vuelve el botón "volver al mapa principal".
  private entryMapId = 'hogar';
  // true mientras el jugador está muerto (escena pausada, modal "Has muerto" abierto):
  // bloquea más daño hasta que se acepte y se vaya a la capital.
  private dead = false;
  private parallax: { ts: Phaser.GameObjects.TileSprite; factor: number }[] = [];
  // scrollX de referencia cuando se (re)construye el parallax: las capas se desplazan
  // respecto a este origen, no al scroll absoluto. Así un set recién cargado arranca
  // alineado (como en la primera entrada) en vez de aparecer descuadrado a media carrera.
  private parallaxBaseX = 0;

  // Estado del salto variable.
  private jumpHeld = false;
  private isJumping = false;
  private jumpHoldMs = 0;

  // Habilidades estilo Idle Slayer (ver constantes DASH_*/SLAM_*/ARROW_*).
  private jumpsUsed = 0;               // 0 en el suelo · 1 tras saltar · 2 tras el doble salto
  private dashing = false;
  private dashUntil = 0;               // time.now hasta el que dura la embestida
  private dashReadyAt = 0;             // time.now a partir del que se puede volver a embestir
  private lastGhostAt = 0;             // estela de la embestida (fantasmas del sprite)
  private slamming = false;            // golpe descendente en curso (hasta aterrizar)
  private flying = false;              // vuelo / boost en curso (lo dispara el botón vía bridge)
  private auraEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;  // aura "ki" del vuelo
  private auraSprite?: Phaser.GameObjects.Sprite;   // aura sprite (hoja DBZ) del vuelo
  private arrows: Phaser.GameObjects.Image[] = [];
  private lastArrowAt = 0;
  // Detección de swipes (derecha=dash, abajo=slam) sobre el lienzo.
  private swipeStart: { x: number; y: number; t: number } | null = null;
  private swipeFired = false;
  // 'second_chance': una resurrección por carrera; invulnerable un instante al revivir.
  private usedSecondChance = false;
  private invulnUntil = 0;
  // Generadores pasivos ('star_prod1/2/3'): fracción de estrella acumulada del tick.
  private starProdCarry = 0;

  // Hitos ya disparados en esta carrera (por flag), para no re-evaluarlos cada frame.
  private firedPoints = new Set<string>();

  constructor() {
    super({ key: 'WorldRunScene', active: false });
  }

  /** Phaser pasa aquí los datos de scene.start(). `entryMapId` = mapa del que sales
   *  por su portal: arrancamos en su distancia de entrada (km 0 si no tiene hito). */
  init(data?: { entryMapId?: string }) {
    this.entryMapId = data?.entryMapId ?? 'hogar';
    this.startDistanceM = this.entryDistanceFor(data?.entryMapId);
  }

  /** Distancia (m) del hito de entrada de un mapa, o 0 si no está en RUN_UNLOCK_POINTS
   *  (p.ej. 'hogar', o mapas cuyo hito aún no se ha definido → arranque normal). */
  private entryDistanceFor(mapId?: string): number {
    const pt = mapId ? RUN_UNLOCK_POINTS.find(p => p.mapId === mapId) : undefined;
    return pt ? pt.distanceM : 0;
  }

  preload() {
    this.reg = new GameRegistry(this.game);
    if (!this.textures.exists(TEX_SUELO_TOP)) {
      this.load.image(TEX_SUELO_TOP,  'assets/tilemaps/world/suelo_01.png');
      this.load.image(TEX_SUELO_FILL, 'assets/tilemaps/world/suelo_02.png');
    }
    if (!this.textures.exists(TEX_SIGN)) {
      this.load.image(TEX_SIGN, 'assets/tilemaps/world/follow.png');
    }
    if (!this.textures.exists(TEX_INTEREST)) {
      this.load.image(TEX_INTEREST, 'assets/tilemaps/world/interest_point.png');
    }
    // Frames del parpadeo de la estrella (imágenes sueltas).
    STAR_KEYS.forEach((key, i) => {
      if (!this.textures.exists(key)) this.load.image(key, STAR_FILES[i]);
    });
    // Frames del latido del corazón (imágenes sueltas).
    HEART_KEYS.forEach((key, i) => {
      if (!this.textures.exists(key)) this.load.image(key, HEART_FILES[i]);
    });
    // Rata (enemigo decorativo): hoja con frames de 64×32.
    if (!this.textures.exists(TEX_RAT)) {
      this.load.spritesheet(TEX_RAT, RAT_SHEET, { frameWidth: RAT_FW, frameHeight: RAT_FH });
    }
    // Fénix (enemigo volador): hoja con frames de 64×64.
    if (!this.textures.exists(TEX_FENIX)) {
      this.load.spritesheet(TEX_FENIX, FENIX_SHEET, { frameWidth: FENIX_FW, frameHeight: FENIX_FH });
    }
    // Aura de vuelo (Dragon Ball): PNG limpio de 4 frames con transparencia. El ?v=
    // rompe la caché del navegador cuando se regenera el PNG (mismo nombre de archivo).
    if (!this.textures.exists(AURA_SHEET)) {
      this.load.spritesheet(AURA_SHEET, 'assets/sprites/world_mode/aura/aura_gold.png?v=3',
        { frameWidth: AURA_FRAME_W, frameHeight: AURA_FRAME_H });
    }
    // Bola de fuego del fénix: frames sueltos (los suele tener ya GameScene; aseguramos).
    for (let i = 1; i <= FIREBALL_FRAMES; i++) {
      const k = `${FIREBALL_KEY}_${i}`;
      if (!this.textures.exists(k)) this.load.image(k, `${FIREBALL_PATH}${i}.png`);
    }
    // El cuerpo del jugador suele estar ya cargado por GameScene (con el modelo del
    // personaje seleccionado); lo aseguramos por si se entra sin pasar por ella.
    if (!this.textures.exists('player')) {
      this.load.spritesheet('player', bodySpriteFor(this.reg.asgard?.selectedPlayer?.name),
        { frameWidth: 64, frameHeight: 64 });
    }
    // Precargamos SOLO el set de parallax seleccionado (cada capa es 1920×1080; cargar
    // todos saturaría VRAM). El resto se cargan bajo demanda al cambiarlo en ajustes.
    this.queueParallaxTextures(this.reg.gameSettings.worldParallax);
  }

  private queueParallaxTextures(id: WorldParallaxId): string[] {
    const missing: string[] = [];
    for (const f of getWorldParallaxSet(id).files) {
      const key = worldParallaxKey(id, f);
      if (!this.textures.exists(key)) {
        this.load.image(key, worldParallaxPath(id, f));
        missing.push(key);
      }
    }
    return missing;
  }

  create() {
    // La instancia de escena se reutiliza entre start/stop: reseteamos el estado
    // para no arrastrar objetos ya destruidos del paso anterior.
    this.chunks = [];
    this.parallax = [];
    this.rightmostIndex = 0;
    this.jumpHeld = false;
    this.isJumping = false;
    this.jumpHoldMs = 0;
    // Resumimos desde la distancia de exploración persistida (la que crece corriendo
    // y también estando AFK, +10 m/min): nunca arrancamos por detrás de lo ya
    // explorado. La entrada del portal (startDistanceM de init) actúa como suelo.
    this.startDistanceM = Math.max(this.startDistanceM, this.reg.playerState.snapshot().explorationDistanceM ?? 0);

    // Saltamos los coleccionables/enemigos que quedarían DETRÁS de la distancia de
    // arranque (al entrar por un portal apareces más adelante): así no se generan en
    // masa solo para reciclarse en el primer frame. El generador empieza en estos
    // índices y crea lo que toca por delante.
    const skip = this.startDistanceM;
    // Packs de estrellas: el primero, por delante del arranque (STAR_FIRST_M como
    // mínimo). Al reentrar por un portal, plantamos a partir de la distancia de skip.
    this.nextPatternM   = Math.max(STAR_FIRST_M, skip + STAR_PATTERN_GAP_M);
    this.patternCursor  = 0;
    this.nextHeartIndex = Math.max(1, Math.floor(skip / HEART_INTERVAL_M));
    this.nextBlockAt = this.time.now + BLOCK_INTERVAL_MS;   // primer bloque tras un intervalo
    this.starRainUntil = 0;   // sin lluvia de estrellas al arrancar
    this.nextRainStarAt = 0;
    this.rats = [];
    this.nextRatIndex   = Math.max(1, Math.floor(skip / RAT_INTERVAL_M));
    this.fenixes = [];
    this.nextFenixIndex = Math.max(0, Math.floor((skip - FENIX_START_M) / FENIX_INTERVAL_M));
    this.fireballs = [];
    // Los hitos cuya distancia ya queda en/atrás del arranque no deben dispararse
    // (apareces en la entrada del mapa del que vienes → no re-ofrecerla).
    this.firedPoints.clear();
    for (const pt of RUN_UNLOCK_POINTS) {
      if (pt.distanceM <= this.startDistanceM) this.firedPoints.add(pt.flag);
    }

    this.exiting = false;   // la instancia se reutiliza entre start/stop; rearmar la salida
    this.dead = false;
    // Habilidades: estado limpio en cada carrera.
    this.jumpsUsed = 0;
    this.dashing = false;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.slamming = false;
    this.flying = false;
    this.arrows = [];
    this.lastArrowAt = this.time.now;
    this.swipeStart = null;
    this.swipeFired = false;
    this.usedSecondChance = false;
    this.invulnUntil = 0;
    this.starProdCarry = 0;
    // Textura de la flecha del arco (generada por código, sin asset).
    if (!this.textures.exists(ARROW_KEY)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x8a6a3a, 1).fillRect(0, 0, 3, 4);                 // plumas
      g.fillStyle(0xd8b45a, 1).fillRect(3, 1, 14, 2);                // asta
      g.fillStyle(0xf5f1e0, 1).fillTriangle(17, 0, 22, 2, 17, 4);    // punta
      g.generateTexture(ARROW_KEY, 22, 4);
      g.destroy();
    }
    // Partícula suave (blob radial) del aura de vuelo: círculos concéntricos de poca
    // alpha que se acumulan hacia el centro → degradado sin asset.
    if (!this.textures.exists(AURA_KEY)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const R = 16;
      for (let r = R; r > 0; r--) g.fillStyle(0xffffff, 0.06).fillCircle(R, R, r);
      g.generateTexture(AURA_KEY, R * 2, R * 2);
      g.destroy();
    }
    // La instancia de escena se reutiliza: si una carrera anterior salió volando
    // (exitToHome hace early-return en update y no llama endFly), limpia el aura.
    this.auraEmitter?.destroy();
    this.auraEmitter = undefined;
    this.auraSprite?.destroy();
    this.auraSprite = undefined;
    this.reg.playerState.resetRunKills();   // los enemigos abatidos son por run (HUD)

    this.physics.world.gravity.y = GRAVITY_Y;
    this.cameras.main.setBackgroundColor('#0a0a14'); // espacio (por si una capa no cubre)

    const h = this.scale.height;
    // El suelo ocupa las últimas GROUND_VISIBLE_ROWS filas de la pantalla.
    this.groundTopY = h - GROUND_BAND_H;

    this.registerAnims();
    this.buildAuraSheet();
    // Construye el parallax del set seleccionado y reacciona a cambios en ajustes
    // (emite el valor actual al suscribir, así que esto también lo construye ya).
    this.parallaxSub = this.reg.gameSettings.worldParallax$.subscribe(id => this.switchParallax(id));
    this.buildInitialChunks();
    this.createPlayer();
    this.createStars();
    this.createHearts();
    this.buildBlockTextures();
    this.createBlocks();
    this.createRats();
    this.createFenixes();
    this.createStartSign();
    this.createInterestSigns();
    this.createHud();
    this.bindInput();

    // Cámara: sigue al jugador SOLO en X. Usamos startFollow (no scrollX manual en
    // update): el follow corre en la fase de render, DESPUÉS del paso de física, así
    // que el jugador no "tiembla" respecto a la cámara. lerpY=0 → la cámara nunca se
    // mueve en Y (los saltos no la mueven). El offset lo coloca a ~25% de la izda.
    // roundPixels evita el borrón del sprite (igual que en el grid).
    this.cameras.main.roundPixels = true;
    this.cameras.main.startFollow(this.player, true, 1, 0);
    this.cameras.main.setFollowOffset(-this.scale.width * 0.25, 0);
    // startFollow centra al jugador también en Y (sobrescribe el scroll). Con
    // lerpY=0 la cámara no vuelve a tocar Y, así que fijamos scrollY=0 DESPUÉS para
    // anclar el suelo al fondo de la vista (si no, queda mundo vacío bajo el suelo).
    this.cameras.main.scrollY = 0;

    // Avisar a la UI Angular: oculta minimapa/skills/toggle del footer y convierte
    // el botón de ataque en botón de salto (que emite por jumpRequest$).
    this.reg.playerBridge.setRunMode(true);
    // El runner es pantalla completa: cierra cualquier ventana que quedara abierta en la
    // ciudad (inventario, equipo, info de mapa, roster…). Lo escuchan footer y top-bar.
    this.reg.playerBridge.requestCloseMenus();
    this.reg.activity?.set('exploring');   // actividad AFK: explorando el Modo Mundo
    this.jumpSub = this.reg.playerBridge.jumpRequest$.subscribe(() => this.pressJump());
    this.jumpReleaseSub = this.reg.playerBridge.jumpReleaseRequest$.subscribe(() => this.releaseJump());
    // Entrar a un mapa desde el icono de teletransporte (o el mapa mundial): viaja a él.
    this.enterMapSub = this.reg.playerBridge.enterMapRequest$.subscribe(mapId => this.enterMap(mapId));
    // Botón "volver al mapa principal" (HTML, solo en modo carrera): sale a la capital.
    this.exitSub = this.reg.playerBridge.exitRunRequest$.subscribe(() => this.exitToHome());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.jumpSub?.unsubscribe();
      this.jumpReleaseSub?.unsubscribe();
      this.parallaxSub?.unsubscribe();
      this.enterMapSub?.unsubscribe();
      this.exitSub?.unsubscribe();
      this.reg.playerBridge.setRunMode(false);
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Avisar a Angular de que la escena está lista para ocultar la pantalla de carga.
    // Imprescindible en el rebote desde GameScene (recarga / cambio de personaje
    // estando AFK explorando): allí GameScene retorna ANTES de su emitSceneReady, así
    // que si WorldRunScene no la emite, `sceneVisible` se queda en false y el juego se
    // queda colgado en "Cargando". En la entrada por portal es idempotente (ya era true).
    this.time.delayedCall(300, () => this.reg.playerBridge?.emitSceneReady());
  }

  override update(_time: number, delta: number) {
    if (!this.player.body) return;
    if (this.dead) return;   // muerto: congelado hasta aceptar el modal "Has muerto"
    if (this.exiting) return; // volviendo a casa: no seguir reportando distancia (deshacía el reset de goHomeReset durante el fundido)

    const now = this.time.now;
    // Fin de la embestida: restaurar la gravedad y volver a la velocidad de carrera.
    if (this.dashing && now >= this.dashUntil) this.endDash();

    // Vuelo / boost: el botón lo marca activo en el bridge durante 10 s; aquí entramos
    // y salimos del modo vuelo según ese estado.
    const flyWanted = this.reg.playerBridge.flyActive;
    if (flyWanted && !this.flying) this.startFly();
    else if (!flyWanted && this.flying) this.endFly();

    // Auto-run: velocidad X constante (se re-aplica cada frame por si una colisión
    // la anuló). El control manual está anulado: el único input es saltar. El sprint
    // multiplica esta velocidad (pico al inicio, decelerando) mientras esté activo.
    // El vuelo la DOBLA. Durante la embestida manda DASH_SPEED.
    this.player.setVelocityX(this.dashing
      ? DASH_SPEED
      : RUN_SPEED * this.reg.playerBridge.currentSprintMultiplier()
          * (this.flying ? FLY_SPEED_MULT : 1));
    if (this.dashing && now - this.lastGhostAt > 45) this.spawnDashGhost(now);
    // El aura sprite acompaña al jugador durante el boost.
    if (this.auraSprite) this.auraSprite.setPosition(this.player.x + AURA_X_OFFSET, this.player.y - AURA_Y_OFFSET);

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround && this.player.body.velocity.y >= 0) {
      this.isJumping = false;
      this.jumpsUsed = 0;                      // en el suelo se recargan ambos saltos
    }
    if (this.slamming && onGround) this.slamImpact();   // aterrizaje del golpe descendente
    this.updateJump(delta);
    this.updatePlayerAnim(onGround);
    this.updateArrows(now, delta);
    this.updateStarProduction(delta);
    this.reg.runProgress.tickWeaponStars(delta);   // generadores de estrellas (armas)

    // (La cámara la mueve startFollow tras la física; aquí solo leemos su scroll.)
    this.updateParallax();
    this.recycleChunks();
    this.updateStars(delta);
    this.updateHearts(delta);
    this.updateBlocks();
    this.updateStarRain();
    this.updateRats();
    this.updateFenixes();
    this.updateFireballs(delta);

    // Metros recorridos: los muestra el HUD de Angular (run-stats) vía runDistanceM$.
    const meters = Math.max(0, Math.floor((this.player.x - this.startX) / PX_PER_METER));
    if (meters !== this.distanceM) {
      this.distanceM = meters;
      this.reg.playerBridge.runDistanceM$.next(meters);   // solo al cambiar de metro
    }
    this.reg.playerState.reportWorldDistance(this.distanceM);   // récord (solo persiste si bate)

    this.checkUnlockPoints();

    // Caída por un hueco (aún no hay huecos en Fase 1): reinicio simple.
    if (this.player.y > this.scale.height + 300) this.respawn();
  }

  // ---------------------------------------------------------------------------

  private registerAnims(): void {
    // 'wr_run' guarda referencias DIRECTAS a los frames de la textura 'player'. Esa
    // textura se quita y recarga al cambiar de personaje (GameScene), dejando esos
    // frames destruidos; reproducir la anim apuntaría a un frame nulo → crash
    // 'sourceSize'. Por eso la rehacemos SIEMPRE contra la textura actual (no basta
    // el guard `exists`). Mismo problema/fix que las anims player_* en gamescene.
    if (this.textures.exists('player')) {
      this.anims.remove('wr_run');
      const runFrames = this.anims.generateFrameNumbers('player', PLAYER_RUN_FRAMES);
      if (runFrames.length) {
        this.anims.create({ key: 'wr_run', frames: runFrames, frameRate: 14, repeat: -1 });
      }
      // Animación de muerte del jugador (frames universales 260-265 del cuerpo LPC).
      // Misma razón que wr_run: rehacerla cada vez contra la textura 'player' actual.
      this.anims.remove('wr_death');
      const deathFrames = this.anims.generateFrameNumbers('player', PLAYER_DEATH_FRAMES);
      if (deathFrames.length) {
        this.anims.create({ key: 'wr_death', frames: deathFrames, frameRate: 9, repeat: 0 });
      }
    }
    // Parpadeo de la estrella: cada frame es una textura suelta (no spritesheet).
    // Solo con las que CARGARON: si los PNG están vacíos/corruptos, crear el anim con
    // frames inexistentes hace que play() reviente al leer 'frame'. Sin frames válidos
    // no creamos el anim (las estrellas se ven como cuadro verde, pero no crashea).
    if (!this.anims.exists(STAR_ANIM)) {
      const frames = STAR_KEYS.filter(key => this.textures.exists(key)).map(key => ({ key }));
      if (frames.length > 0) {
        this.anims.create({ key: STAR_ANIM, frames, frameRate: 12, repeat: -1 });
      }
    }
    // Latido del corazón: mismo criterio que la estrella (solo con frames cargados).
    if (!this.anims.exists(HEART_ANIM)) {
      const frames = HEART_KEYS.filter(key => this.textures.exists(key)).map(key => ({ key }));
      if (frames.length > 0) {
        this.anims.create({ key: HEART_ANIM, frames, frameRate: 12, repeat: -1 });
      }
    }
    // Rata: idle en bucle + ataque una vez (vuelve a idle al terminar, ver updateRats).
    if (this.textures.exists(TEX_RAT)) {
      if (!this.anims.exists(RAT_ANIM_IDLE)) {
        this.anims.create({
          key: RAT_ANIM_IDLE,
          frames: this.anims.generateFrameNumbers(TEX_RAT, RAT_IDLE_FRAMES),
          frameRate: 8, repeat: -1,
        });
      }
      if (!this.anims.exists(RAT_ANIM_ATTACK)) {
        this.anims.create({
          key: RAT_ANIM_ATTACK,
          frames: this.anims.generateFrameNumbers(TEX_RAT, RAT_ATTACK_FRAMES),
          frameRate: 14, repeat: 0,
        });
      }
      if (!this.anims.exists(RAT_ANIM_DEATH)) {
        this.anims.create({
          key: RAT_ANIM_DEATH,
          frames: this.anims.generateFrameNumbers(TEX_RAT, RAT_DEATH_FRAMES),
          frameRate: 12, repeat: 0,
        });
      }
    }
    // Fénix: aleteo de vuelo en bucle (fila 1) + muerte una vez (fila 4).
    if (this.textures.exists(TEX_FENIX)) {
      if (!this.anims.exists(FENIX_ANIM_FLY)) {
        this.anims.create({
          key: FENIX_ANIM_FLY,
          frames: this.anims.generateFrameNumbers(TEX_FENIX, FENIX_FLY_FRAMES),
          frameRate: 8, repeat: -1,
        });
      }
      if (!this.anims.exists(FENIX_ANIM_DEATH)) {
        this.anims.create({
          key: FENIX_ANIM_DEATH,
          frames: this.anims.generateFrameNumbers(TEX_FENIX, FENIX_DEATH_FRAMES),
          frameRate: 12, repeat: 0,
        });
      }
      if (!this.anims.exists(FENIX_ANIM_ATTACK)) {
        this.anims.create({
          key: FENIX_ANIM_ATTACK,
          frames: this.anims.generateFrameNumbers(TEX_FENIX, FENIX_ATTACK_FRAMES),
          frameRate: 14, repeat: 0,
        });
      }
    }
    // Bola de fuego (frames sueltos): solo con los que cargaron.
    if (!this.anims.exists(FIREBALL_ANIM)) {
      const frames: Phaser.Types.Animations.AnimationFrame[] = [];
      for (let i = 1; i <= FIREBALL_FRAMES; i++) {
        const k = `${FIREBALL_KEY}_${i}`;
        if (this.textures.exists(k)) frames.push({ key: k });
      }
      if (frames.length > 0) this.anims.create({ key: FIREBALL_ANIM, frames, frameRate: 18, repeat: -1 });
    }
  }

  /** Cambia el set de parallax: carga sus texturas si faltan y luego lo reconstruye. */
  private switchParallax(id: WorldParallaxId): void {
    const missing = this.queueParallaxTextures(id);
    if (missing.length === 0) { this.rebuildParallax(id); return; }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.rebuildParallax(id));
    this.load.start();
  }

  private rebuildParallax(id: WorldParallaxId): void {
    for (const p of this.parallax) p.ts.destroy();
    this.parallax = [];
    // Rebaseamos al scroll actual: el set nuevo empieza alineado aquí.
    this.parallaxBaseX = this.cameras.main.scrollX;

    // Cada capa es un TileSprite fijo a la cámara (scrollFactor 0) que cubre toda la
    // pantalla; el "movimiento" se hace desplazando tilePositionX según el scroll de
    // la cámara y su factor de profundidad. Se escalan a la altura de pantalla
    // (tileScale) y se repiten en horizontal de forma infinita.
    const set = getWorldParallaxSet(id);
    // 'height' (cielos): la imagen cabe entera de arriba a abajo y se repite a lo
    // ancho (la repetición no se nota en escenas uniformes).
    // 'cover' (paisajes): UNA copia llena el ancho (sin duplicar montaña/sol), y se
    // recorta el alto mostrando la franja `anchorY` (1=abajo/horizonte).
    const cover = set.fit === 'cover';
    const anchorY = set.anchorY ?? 1;
    set.files.forEach((f, i) => {
      const key = worldParallaxKey(id, f);
      // Tamaño REAL de la textura (no asumir 1920×1080: las nubes son 576×324, etc.).
      const src = this.textures.get(key).getSourceImage();
      const srcW = src.width || WORLD_PARALLAX_SRC_W;
      const srcH = src.height || WORLD_PARALLAX_SRC_H;
      // 'height': cabe entera de alto y se repite a lo ancho.
      // 'cover': una copia llena el ancho y se recorta el alto (franja anchorY).
      const tileScale = cover
        ? Math.max(this.scale.width / srcW, this.scale.height / srcH)
        : this.scale.height / srcH;
      // Offset vertical (en px de textura): cuánto recortamos por arriba.
      const tilePosY = (srcH - this.scale.height / tileScale) * anchorY;
      const ts = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, key)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(-100 + i);
      ts.tileScaleX = tileScale;
      ts.tileScaleY = tileScale;
      ts.tilePositionY = tilePosY;
      this.parallax.push({ ts, factor: worldParallaxFactor(i, set.files.length) });
    });
    // Posiciona ya las capas (evita un frame con tilePositionX=0 al cambiar de set).
    this.updateParallax();
  }

  private updateParallax(): void {
    const sx = this.cameras.main.scrollX - this.parallaxBaseX;
    for (const p of this.parallax) {
      // tilePositionX está en px de textura (antes de tileScale), por eso dividimos.
      p.ts.tilePositionX = (sx * p.factor) / p.ts.tileScaleX;
    }
  }

  private buildInitialChunks(): void {
    const needed = Math.ceil(this.scale.width / CHUNK_W) + 2;
    for (let i = 0; i < needed; i++) this.chunks.push(this.makeChunk(i));
    this.rightmostIndex = needed - 1;
  }

  private makeChunk(index: number): RunChunk {
    const leftX = index * CHUNK_W;

    // Fila de superficie (suelo_01, con hierba) arriba + relleno (suelo_02) debajo.
    // Ambas detrás del jugador (depth < 5) para que él pise sobre la hierba. Los
    // TileSprite se dimensionan en px de pantalla; tileScale encoge el tile 64→32.
    const grass = this.add.tileSprite(leftX, this.groundTopY, CHUNK_W, GROUND_TILE, TEX_SUELO_TOP)
      .setOrigin(0, 0).setDepth(1);
    grass.tileScaleX = SUELO_TILE_SCALE;
    grass.tileScaleY = SUELO_TILE_SCALE;
    // La tierra sobra por debajo del borde de la pantalla (overdraw) para que nunca
    // quede hueco con el footer aunque el canvas no encaje al píxel.
    const dirtTopY = this.groundTopY + GROUND_TILE;
    const dirtH = (this.scale.height + RT * 2) - dirtTopY;
    const dirt = this.add.tileSprite(leftX, dirtTopY, CHUNK_W, dirtH, TEX_SUELO_FILL)
      .setOrigin(0, 0).setDepth(0);
    dirt.tileScaleX = SUELO_TILE_SCALE;
    dirt.tileScaleY = SUELO_TILE_SCALE;

    // Colisionador estático del suelo (invisible), hundido en el césped (SURFACE_INSET).
    const floorTop = this.groundTopY + SURFACE_INSET;
    const floorH = this.scale.height - floorTop + 100;
    const floor = this.add.rectangle(leftX + CHUNK_W / 2, floorTop + floorH / 2, CHUNK_W, floorH);
    floor.setVisible(false);
    this.physics.add.existing(floor, true);

    return { grass, dirt, floor, index };
  }

  private positionChunk(chunk: RunChunk, index: number): void {
    const leftX = index * CHUNK_W;
    chunk.index = index;
    chunk.grass.x = leftX;
    chunk.dirt.x = leftX;
    chunk.floor.x = leftX + CHUNK_W / 2;
    (chunk.floor.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
  }

  private recycleChunks(): void {
    const scrollX = this.cameras.main.scrollX;
    for (const chunk of this.chunks) {
      // Si el chunk quedó totalmente fuera por la izquierda, lo reciclamos al final.
      if ((chunk.index + 1) * CHUNK_W < scrollX - CHUNK_W) {
        this.rightmostIndex++;
        this.positionChunk(chunk, this.rightmostIndex);
      }
    }
  }

  private createPlayer(): void {
    // El jugador SIEMPRE aparece físicamente al 25% de la pantalla; lo que cambia es
    // el origen de distancias (startX): lo retrasamos `startDistanceM` metros para que
    // su "metro 0" quede detrás y la carrera arranque ya en la entrada del mapa. Todo
    // (signos de interés, spawns, contador) se mide desde startX, así que basta esto.
    const playerStartX = this.scale.width * 0.25;
    this.startX = playerStartX - this.startDistanceM * PX_PER_METER;
    const floorTop = this.groundTopY + SURFACE_INSET;
    this.player = this.physics.add.sprite(playerStartX, floorTop - 120, 'player', PLAYER_IDLE_FRAME);
    this.player.setScale(PLAYER_SCALE).setDepth(5).setOrigin(0.5, 1);
    // Cuerpo de colisión ajustado a los pies del cuerpo LPC (el frame 64×64 tiene
    // mucho aire). setOffset en coordenadas del frame sin escalar.
    this.player.body!.setSize(16, 26);
    (this.player.body as Phaser.Physics.Arcade.Body).setOffset(24, 36);
    this.player.setCollideWorldBounds(false);

    for (const chunk of this.chunks) this.physics.add.collider(this.player, chunk.floor);
  }

  /** Letrero "→" de inicio: en la vista inicial, pegado a la derecha y sobre la
   *  hierba, para que se vea en cuanto el jugador arranca a correr. Es un marcador
   *  estático del mundo (no se recicla): la cámara lo deja atrás al avanzar. */
  private createStartSign(): void {
    // Solo en un arranque desde el km 0 (desde el hogar): si entras por el portal de
    // salida de un mapa apareces a media carrera y este letrero no pinta nada.
    if (this.startDistanceM > 0) return;
    this.textures.get(TEX_SIGN).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const x = this.scale.width - 64;                 // a la derecha del todo, fully visible
    const y = this.groundTopY + SURFACE_INSET;       // base sobre la línea del suelo
    this.add.image(x, y, TEX_SIGN).setOrigin(0.5, 1).setScale(SIGN_SCALE).setDepth(4);
  }

  /** Cartel "punto de interés" plantado en cada posición de mapa (startX + distancia).
   *  Al cruzar el de un mapa YA COMPRADO aparece su botón de entrada (checkUnlockPoints);
   *  si no, es decorativo. Estáticos: la cámara los deja atrás al avanzar. */
  private createInterestSigns(): void {
    this.textures.get(TEX_INTEREST).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const y = this.groundTopY + SURFACE_INSET;
    for (const pt of RUN_UNLOCK_POINTS) {
      const x = this.startX + pt.distanceM * PX_PER_METER;
      this.add.image(x, y, TEX_INTEREST).setOrigin(0.5, 1).setScale(SIGN_SCALE).setDepth(4);
    }
  }

  /**
   * Carteles de mapa por distancia: los mapas ya NO se desbloquean por metros —
   * se COMPRAN con estrellas en el panel de hitos (map_1_x, run-milestones.ts).
   * Al cruzar el cartel de un mapa COMPRADO aparece su botón de entrada (sin
   * pausar); si no está comprado, el cartel es decorativo. `firedPoints` evita
   * reevaluar el mismo punto cada frame dentro de una carrera.
   */
  private checkUnlockPoints(): void {
    for (const pt of RUN_UNLOCK_POINTS) {
      if (this.firedPoints.has(pt.flag) || this.distanceM < pt.distanceM) continue;
      this.firedPoints.add(pt.flag);
      if (this.reg.unlocks.isUnlocked(mapFeatureId(pt.mapId))) {
        this.reg.playerBridge.showMapEntranceHint(pt.mapId);
      }
    }
  }

  /** Viaje al mapa desde el icono de teletransporte o el mapa mundial: fundido y
   *  arranca GameScene en el mapa destino (resume defensivo por si estuviera en pausa). */
  private enterMap(mapId: string): void {
    this.scene.resume();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.reg.world.setCurrentMap(mapId);
      // Salimos de la exploración a propósito: limpiamos la actividad para que
      // GameScene.create NO rebote de vuelta al Modo Mundo (su create la ajusta luego
      // al mapa). Ver el rebote por 'exploring' en gamescene.ts.
      this.reg.activity?.set('idle');
      this.scene.start('GameScene');
      this.scene.stop();
    });
  }

  /** Grupo de estrellas (sin gravedad) + overlap con el jugador para recogerlas. */
  private createStars(): void {
    this.textures.get(STAR_KEYS[0]).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.stars = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.stars,
      (_p, star) => this.collectStar(star as Phaser.Physics.Arcade.Sprite));
  }

  /**
   * Genera estrellas por delante de la cámara EN PACKS (run-star-patterns.ts) y
   * destruye las que ya quedaron atrás. Mundo infinito: solo existen las cercanas.
   * Con el imán comprado, las cercanas vuelan hacia el jugador.
   */
  private updateStars(delta: number): void {
    const scrollX = this.cameras.main.scrollX;
    const spawnUntilX = scrollX + this.scale.width + CHUNK_W;   // un poco más allá del borde derecho
    const groundY = this.groundTopY + SURFACE_INSET;
    const patterns = this.activeStarPatterns();

    // Planta packs completos mientras su ANCLA entre en la zona de spawn.
    while (this.startX + this.nextPatternM * PX_PER_METER <= spawnUntilX) {
      const pattern = patterns[this.patternCursor % patterns.length];
      this.spawnStarPattern(pattern, this.nextPatternM, groundY);
      this.nextPatternM += pattern.widthM + STAR_PATTERN_GAP_M;
      this.patternCursor++;
    }

    // Limpieza + imán: las que salieron por la izquierda (sin recoger) se eliminan.
    for (const obj of this.stars.getChildren()) {
      const star = obj as Phaser.Physics.Arcade.Sprite;
      if (star.x < scrollX - CHUNK_W) { star.destroy(); continue; }
      this.magnetPull(star, delta);
    }
  }

  /** Packs desbloqueados según los hitos comprados (los base + los desbloqueados). */
  private activeStarPatterns(): StarPattern[] {
    return unlockedStarPatterns(this.reg.runProgress.getMilestones());
  }

  /** Planta todas las estrellas de un pack, ancladas en `anchorM` metros. Al pack
   * entero se le suma una elevación al azar (STAR_HEIGHT_LEVELS): misma forma, altura
   * variable. El nivel 0 lo deja en la altura más baja (la de siempre). */
  private spawnStarPattern(pattern: StarPattern, anchorM: number, groundY: number): void {
    const lift = Phaser.Math.RND.pick(STAR_HEIGHT_LEVELS);
    for (const p of pattern.points) {
      const x = this.startX + (anchorM + p.dxM) * PX_PER_METER;
      const star = this.stars.create(x, groundY - (p.dy + lift), STAR_KEYS[0]) as Phaser.Physics.Arcade.Sprite;
      star.setScale(STAR_SCALE).setDepth(4);
      if (this.anims.exists(STAR_ANIM)) star.play(STAR_ANIM);  // solo si cargaron los frames
    }
  }

  /** Radio del imán según los hitos comprados (0 = sin imán). */
  private magnetRadius(): number {
    if (this.ms('magnet2')) return MAGNET_RADIUS_2;
    if (this.ms('magnet1')) return MAGNET_RADIUS_1;
    return 0;
  }

  /** Atrae un coleccionable hacia el jugador si está dentro del radio del imán. */
  private magnetPull(item: Phaser.Physics.Arcade.Sprite, delta: number): void {
    const radius = this.magnetRadius();
    if (radius <= 0 || !item.active) return;
    const px = this.player.x, py = this.player.y - this.player.displayHeight * 0.5;
    const d = Phaser.Math.Distance.Between(item.x, item.y, px, py);
    if (d > radius || d < 6) return;
    const step = MAGNET_PULL * (delta / 1000);
    item.x += ((px - item.x) / d) * step;
    item.y += ((py - item.y) / d) * step;
    (item.body as Phaser.Physics.Arcade.Body)?.updateFromGameObject?.();
  }

  /** Valor de cada estrella (recogida o de kill): 1 + hitos "estrellas valiosas". */
  private starValue(): number {
    return 1 + (this.ms('star_value1') ? 1 : 0) + (this.ms('star_value2') ? 1 : 0)
             + (this.ms('star_value3') ? 1 : 0);
  }

  /** ¿Está comprado este hito del Modo Mundo? (atajo). */
  private ms(id: string): boolean {
    return this.reg.runProgress.has(id);
  }

  /** Hito "oleada estelar": cada estrella recogida rinde ADEMÁS un 25% de tu producción
   *  de estrellas/seg actual (armas + generadores de hitos). 0 si no está comprado. */
  private starSurgeBonus(): number {
    if (!this.ms('star_surge')) return 0;
    const perSec = this.reg.runProgress.starsPerSec()
      + starProdPerMin(this.reg.runProgress.getMilestones()) / 60;
    return Math.floor(perSec * 0.25);
  }

  /** Recoge una estrella: suma al contador (persistido, × estrellas valiosas + oleada). */
  private collectStar(star: Phaser.Physics.Arcade.Sprite): void {
    if (!star.active) return;        // evita doble cobro si dos overlaps caen el mismo frame
    star.disableBody(true, false);   // quita el cuerpo pero deja el sprite para el tween
    const n = this.starValue() + this.starSurgeBonus();
    this.reg.runProgress.collectStars(n);
    this.reg.runProgress.starPicked$.next(n);   // game-log abajo-izq (acumula por línea)
    if (n > 1) this.showStarGain(star.x, star.y, n);
    this.tweens.add({
      targets: star, y: star.y - 40, alpha: 0, scale: STAR_SCALE * 1.6,
      duration: 250, ease: 'Quad.out', onComplete: () => star.destroy(),
    });
  }

  /** "+N ★" dorado flotando (feedback de estrellas ganadas por kills o multiplicadas). */
  private showStarGain(x: number, y: number, n: number): void {
    const text = this.add.text(x, y - 20, `+${n} ★`, {
      fontSize: '22px', color: '#ffd94a', fontStyle: 'bold',
      stroke: '#5a3d08', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(5000);
    this.tweens.add({
      targets: text, y: y - 62, alpha: 0,
      duration: 700, ease: 'Power2', onComplete: () => text.destroy(),
    });
  }

  /** Grupo de corazones (sin gravedad) + overlap con el jugador para recogerlos. */
  private createHearts(): void {
    this.textures.get(HEART_KEYS[0]).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.hearts = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.hearts,
      (_p, heart) => this.collectHeart(heart as Phaser.Physics.Arcade.Sprite));
  }

  /**
   * Genera corazones por delante de la cámara (uno cada HEART_INTERVAL_M metros) y
   * destruye los que ya quedaron atrás. Mismo esquema que updateStars().
   */
  private updateHearts(delta: number): void {
    const scrollX = this.cameras.main.scrollX;
    const spawnUntilX = scrollX + this.scale.width + CHUNK_W;
    const groundY = this.groundTopY + SURFACE_INSET;

    if (!this.ms('hearts')) {
      // Hito "Corazones" sin comprar: no aparecen (índice al día, como enemies/fénix,
      // para que al comprarlo salgan por delante y no un tropel).
      const aheadM = (spawnUntilX - this.startX) / PX_PER_METER;
      this.nextHeartIndex = Math.max(this.nextHeartIndex, Math.floor(aheadM / HEART_INTERVAL_M) + 1);
    } else {
      while (this.startX + this.nextHeartIndex * HEART_INTERVAL_M * PX_PER_METER <= spawnUntilX) {
        const x = this.startX + this.nextHeartIndex * HEART_INTERVAL_M * PX_PER_METER;
        const height = HEART_HEIGHTS[(this.nextHeartIndex - 1) % HEART_HEIGHTS.length];
        const heart = this.hearts.create(x, groundY - height, HEART_KEYS[0]) as Phaser.Physics.Arcade.Sprite;
        heart.setScale(HEART_SCALE).setDepth(4);
        if (this.anims.exists(HEART_ANIM)) heart.play(HEART_ANIM);
        this.nextHeartIndex++;
      }
    }

    for (const obj of this.hearts.getChildren()) {
      const heart = obj as Phaser.Physics.Arcade.Sprite;
      if (heart.x < scrollX - CHUNK_W) { heart.destroy(); continue; }
      this.magnetPull(heart, delta);
    }
  }

  /** Recoge un corazón: cura (más con 'heart_boost') y lo hace desaparecer. */
  private collectHeart(heart: Phaser.Physics.Arcade.Sprite): void {
    if (!heart.active) return;
    heart.disableBody(true, false);
    const heal = this.ms('heart_boost') ? HEART_HEAL_BOOSTED : HEART_HEAL;
    // showNumber=false: el "+X" de healPlayer se pinta sobre el sprite del GameScene
    // (no el del runner), así que aquí lo replicamos sobre NUESTRO jugador.
    this.reg.playerBridge.healPlayer(heal, false);
    this.showHealEffect(heal);
    this.tweens.add({
      targets: heart, y: heart.y - 40, alpha: 0, scale: HEART_SCALE * 1.6,
      duration: 250, ease: 'Quad.out', onComplete: () => heart.destroy(),
    });
  }

  // ── Bloques "?" tipo Mario Bros ───────────────────────────────────────────────
  /** Grupo de bloques (sin gravedad, inmóviles) + overlap con el jugador. Usamos
   *  OVERLAP (no collider sólido) a propósito: así el bloque nunca frena el auto-run
   *  ni bloquea al jugador de lado; solo detectamos el cabezazo desde abajo. */
  private createBlocks(): void {
    this.blocks = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.blocks,
      (_p, b) => this.hitBlock(b as Phaser.Physics.Arcade.Sprite));
  }

  /**
   * Genera bloques POR TIEMPO (uno cada BLOCK_INTERVAL_MS) justo por delante del borde
   * derecho, y destruye los que quedaron atrás. Puerta del hito 'random_box' (Caja
   * aleatoria): sin comprar no aparecen y el temporizador se aplaza, para que al
   * comprarlo el primero salga tras un intervalo completo (no de golpe).
   */
  private updateBlocks(): void {
    const scrollX = this.cameras.main.scrollX;
    const now = this.time.now;

    if (!this.ms('random_box')) {
      this.nextBlockAt = now + BLOCK_INTERVAL_MS;
    } else if (now >= this.nextBlockAt) {
      const x = scrollX + this.scale.width + 80;   // por delante del borde derecho
      const y = (this.groundTopY + SURFACE_INSET) - BLOCK_HEIGHT;
      const block = this.blocks.create(x, y, BLOCK_KEY) as Phaser.Physics.Arcade.Sprite;
      block.setScale(BLOCK_SCALE).setDepth(4);
      block.setData('used', false);
      block.setData('baseY', y);   // altura de reposo (para el rebote del cabezazo)
      this.nextBlockAt = now + BLOCK_INTERVAL_MS;
    }

    for (const obj of this.blocks.getChildren()) {
      const block = obj as Phaser.Physics.Arcade.Sprite;
      if (block.x < scrollX - CHUNK_W) block.destroy();
    }
  }

  /** Overlap jugador↔bloque: solo cuenta si el jugador SUBE (cabezazo desde abajo).
   *  Cayendo o en el apex no pasa nada — hay que saltar y golpearlo por debajo. */
  private hitBlock(block: Phaser.Physics.Arcade.Sprite): void {
    if (!block.active || block.getData('used')) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y >= 0) return;   // no sube: está cayendo/quieto → no es un cabezazo
    this.bonkBlock(block);
  }

  /** Golpea el bloque: lo marca gastado, lo rebota, empuja al jugador hacia abajo y
   *  entrega una recompensa ALEATORIA (ver grantRandomBoxReward). */
  private bonkBlock(block: Phaser.Physics.Arcade.Sprite): void {
    block.setData('used', true);
    block.setTexture(BLOCK_USED_KEY);
    const baseY = block.getData('baseY') as number;
    // Rebote del bloque: sube un poco y vuelve (el clásico "bump" de Mario).
    this.tweens.add({ targets: block, y: baseY - 10, duration: 80, yoyo: true, ease: 'Quad.out' });
    // El jugador rebota hacia abajo tras el cabezazo.
    this.player.setVelocityY(160);
    this.grantRandomBoxReward(block.x, baseY - BLOCK_DISPLAY * 0.5);
  }

  /**
   * Recompensa ALEATORIA de la Caja aleatoria. Sortea UNIFORME entre las disponibles
   * (misma probabilidad cada una → con 2 eventos, 50% y 50%; se reajusta solo al añadir
   * más):
   *   #1 · Un minuto de la generación pasiva de estrellas.
   *   #2 · Lluvia de estrellas: 10 s de estrellas naciendo en el mapa nuevo.
   * Añadir más = otra entrada en la lista.
   */
  private grantRandomBoxReward(x: number, y: number): void {
    const rewards = [
      () => this.rewardMinuteOfStars(x, y),
      () => this.rewardStarRain(),
    ];
    Phaser.Math.RND.pick(rewards)();
  }

  /** Recompensa #1: 1 minuto de la generación pasiva de estrellas — las ★/s de las
   *  armas (×60) más las ★/min de los hitos de producción. Mínimo 1 para que la caja
   *  siempre dé algo aunque aún no generes nada. */
  private rewardMinuteOfStars(x: number, y: number): void {
    const perMin = this.reg.runProgress.starsPerSec() * 60
      + starProdPerMin(this.reg.runProgress.getMilestones());
    const n = Math.max(1, Math.floor(perMin));
    this.reg.runProgress.collectStars(n);
    this.popBlockStar(x, y, n);
  }

  /** Estrella que "sale" del bloque con el "+N ★" flotando: el sprite sube y se
   *  desvanece (reutiliza el feedback de las estrellas normales). */
  private popBlockStar(x: number, y: number, n: number): void {
    this.showStarGain(x, y, n);
    const star = this.add.sprite(x, y, STAR_KEYS[0]).setScale(STAR_SCALE).setDepth(6);
    if (this.anims.exists(STAR_ANIM)) star.play(STAR_ANIM);
    this.tweens.add({
      targets: star, y: y - 48, alpha: 0, scale: STAR_SCALE * 1.4,
      duration: 420, ease: 'Quad.out', onComplete: () => star.destroy(),
    });
  }

  /** Recompensa #2: activa la LLUVIA DE ESTRELLAS durante STAR_RAIN_MS. Las estrellas
   *  las va sembrando updateStarRain por toda la pantalla; los patrones normales siguen
   *  igual (esto se suma por encima). */
  private rewardStarRain(): void {
    this.starRainUntil = this.time.now + STAR_RAIN_MS;
    this.nextRainStarAt = 0;   // primera tanda ya en el próximo frame
  }

  /** Mientras la lluvia esté activa, siembra tandas de estrellas normales
   *  (coleccionables, mismo grupo `stars`) en la franja de MAPA NUEVO por delante del
   *  borde derecho: nacen fuera de pantalla y entran con el scroll (no surgen de golpe
   *  en mitad de la vista). Cada una en un hueco libre, sin solaparse. La limpieza y el
   *  imán los gestiona updateStars, igual que cualquier estrella. */
  private updateStarRain(): void {
    const now = this.time.now;
    if (now >= this.starRainUntil || now < this.nextRainStarAt) return;
    this.nextRainStarAt = now + STAR_RAIN_SPAWN_MS;
    const groundY = this.groundTopY + SURFACE_INSET;
    const xBase = this.cameras.main.scrollX + this.scale.width + 40;   // más allá del borde derecho
    for (let i = 0; i < STAR_RAIN_PER_TICK; i++) {
      const pos = this.findFreeStarSpot(xBase, groundY);
      if (!pos) continue;   // no hay hueco sin solapar en esta franja: se salta
      const star = this.stars.create(pos.x, pos.y, STAR_KEYS[0]) as Phaser.Physics.Arcade.Sprite;
      star.setScale(STAR_SCALE).setDepth(4);
      if (this.anims.exists(STAR_ANIM)) star.play(STAR_ANIM);
    }
  }

  /** Punto en la franja de mapa nuevo (por delante del borde) que NO solape con ninguna
   *  estrella ya existente (mín. STAR_RAIN_MIN_GAP). null si tras varios intentos no hay
   *  hueco libre — así nunca nacen estrellas encima de otras. */
  private findFreeStarSpot(xBase: number, groundY: number): { x: number; y: number } | null {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = xBase + Phaser.Math.Between(0, STAR_RAIN_AHEAD_W);
      const y = Phaser.Math.Between(60, Math.floor(groundY - 30));
      let free = true;
      for (const obj of this.stars.getChildren()) {
        const s = obj as Phaser.Physics.Arcade.Sprite;
        if (s.active && Phaser.Math.Distance.Between(x, y, s.x, s.y) < STAR_RAIN_MIN_GAP) {
          free = false;
          break;
        }
      }
      if (free) return { x, y };
    }
    return null;
  }

  /** Dibuja por código las texturas del bloque "?" y del bloque gastado (pixel-art,
   *  sin asset). Idempotente: solo la primera vez. Sustituible por sprites propios. */
  private buildBlockTextures(): void {
    const S = BLOCK_TEX;
    const DARK = 0x3a2708, GOLD = 0xf0b429, HI = 0xffd76b, LO = 0xc07d10;
    if (!this.textures.exists(BLOCK_KEY)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(DARK, 1).fillRect(0, 0, S, S);          // borde oscuro
      g.fillStyle(GOLD, 1).fillRect(2, 2, S - 4, S - 4);  // cuerpo dorado
      g.fillStyle(HI, 1).fillRect(2, 2, S - 4, 2);        // biselado arriba/izquierda
      g.fillStyle(HI, 1).fillRect(2, 2, 2, S - 4);
      g.fillStyle(LO, 1).fillRect(2, S - 4, S - 4, 2);    // sombra abajo/derecha
      g.fillStyle(LO, 1).fillRect(S - 4, 2, 2, S - 4);
      // Remaches en las esquinas.
      g.fillStyle(DARK, 1);
      for (const [rx, ry] of [[5, 5], [S - 8, 5], [5, S - 8], [S - 8, S - 8]]) g.fillRect(rx, ry, 3, 3);
      // Interrogante "?" en bloques (pixel-art a base de rectángulos).
      g.fillStyle(DARK, 1);
      g.fillRect(11, 7, 10, 3);   // arco superior
      g.fillRect(18, 9, 3, 5);    // hombro derecho
      g.fillRect(14, 13, 5, 3);   // curva al centro
      g.fillRect(14, 16, 3, 5);   // tallo
      g.fillRect(14, 23, 3, 3);   // punto
      g.generateTexture(BLOCK_KEY, S, S);
      g.destroy();
      this.textures.get(BLOCK_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (!this.textures.exists(BLOCK_USED_KEY)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const BR = 0x7a5a2a, BRHI = 0x9a7a44, BRLO = 0x5a3d1a;
      g.fillStyle(DARK, 1).fillRect(0, 0, S, S);
      g.fillStyle(BR, 1).fillRect(2, 2, S - 4, S - 4);
      g.fillStyle(BRHI, 1).fillRect(2, 2, S - 4, 2);
      g.fillStyle(BRLO, 1).fillRect(2, S - 4, S - 4, 2);
      g.fillStyle(DARK, 1);
      for (const [rx, ry] of [[5, 5], [S - 8, 5], [5, S - 8], [S - 8, S - 8]]) g.fillRect(rx, ry, 3, 3);
      g.generateTexture(BLOCK_USED_KEY, S, S);
      g.destroy();
      this.textures.get(BLOCK_USED_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  /** Efecto de curación sobre el jugador del runner: "+X" verde que flota hacia
   *  arriba + pequeñas '+' subiendo alrededor (réplica del de los otros mapas, que
   *  se pinta sobre el sprite del GameScene y aquí no se vería). */
  private showHealEffect(amount: number): void {
    if (amount <= 0) return;
    const cx = this.player.x;
    const topY = this.player.y - this.player.displayHeight * 0.9;

    const text = this.add.text(cx, topY, `+${amount}`, {
      fontSize: '30px',
      color: '#3ad12f',
      fontStyle: 'bold',
      stroke: '#0a3d08',
      strokeThickness: 6,
    });
    text.setOrigin(0.5, 1).setDepth(5000);
    this.tweens.add({
      targets: text, y: topY - 42, alpha: 0,
      duration: 900, ease: 'Power2', onComplete: () => text.destroy(),
    });

    for (let i = 0; i < 5; i++) {
      const px = cx + Phaser.Math.Between(-22, 22);
      const py = this.player.y - Phaser.Math.Between(0, 30);
      const plus = this.add.text(px, py, '+', {
        fontSize: `${Phaser.Math.Between(14, 22)}px`,
        color: '#7dff5a',
        fontStyle: 'bold',
        stroke: '#0a3d08',
        strokeThickness: 3,
      });
      plus.setOrigin(0.5, 1).setDepth(4999).setAlpha(0);
      this.tweens.add({
        targets: plus, y: py - Phaser.Math.Between(40, 70),
        alpha: { from: 0.9, to: 0 },
        duration: Phaser.Math.Between(700, 1100), delay: i * 80,
        ease: 'Sine.easeOut', onComplete: () => plus.destroy(),
      });
    }
  }

  /** Filtro nearest para que la rata se vea nítida (pixel-art). */
  private createRats(): void {
    if (this.textures.exists(TEX_RAT)) {
      this.textures.get(TEX_RAT).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  /**
   * Genera ratas por delante (una cada RAT_INTERVAL_M metros) y resuelve el combate:
   * a ras de suelo te atacan y te hacen daño; si saltas y caes sobre el lomo las
   * matas sin daño (pisotón con rebote). Recicla las que quedan atrás. Mundo
   * infinito: solo existen las cercanas.
   */
  private updateRats(): void {
    if (!this.anims.exists(RAT_ANIM_IDLE)) return;   // textura/anim no disponibles
    const scrollX = this.cameras.main.scrollX;
    const spawnUntilX = scrollX + this.scale.width + CHUNK_W;
    const groundY = this.groundTopY + SURFACE_INSET;

    if (!this.ms('enemies')) {
      // Hito "Enemigos" sin comprar: no aparecen. Mantenemos el índice al día para
      // que, al comprarlo a mitad de carrera, salgan por DELANTE (no un tropel).
      const aheadM = (spawnUntilX - this.startX) / PX_PER_METER;
      this.nextRatIndex = Math.max(this.nextRatIndex, Math.floor(aheadM / RAT_INTERVAL_M) + 1);
    } else {
      while (this.startX + this.nextRatIndex * RAT_INTERVAL_M * PX_PER_METER <= spawnUntilX) {
        const x = this.startX + this.nextRatIndex * RAT_INTERVAL_M * PX_PER_METER;
        const sprite = this.add.sprite(x, groundY, TEX_RAT)
          .setOrigin(0.5, 1).setScale(RAT_SCALE).setDepth(4).setFlipX(RAT_FACE_LEFT);
        sprite.play(RAT_ANIM_IDLE);
        this.rats.push({ sprite, attacking: false, hit: false });
        this.nextRatIndex++;
      }
    }

    for (let i = this.rats.length - 1; i >= 0; i--) {
      const rat = this.rats[i];
      const s = rat.sprite;
      // Recicla las que ya quedaron atrás.
      if (s.x < scrollX - CHUNK_W) {
        s.destroy();
        this.rats.splice(i, 1);
        continue;
      }

      const dx = this.player.x - s.x;
      const absdx = Math.abs(dx);
      // Altura de los pies del jugador (origin 0.5,1) sobre el suelo (>0 = en el aire).
      const feetAbove = s.y - this.player.y;
      const onBack = feetAbove >= RAT_STOMP_LOW && feetAbove <= RAT_STOMP_HIGH;
      const falling = (this.player.body?.velocity.y ?? 0) >= 0;

      // Embestida o vuelo: cualquier rata alcanzada muere (atropello, sin daño).
      if ((this.dashing || this.flying) && absdx < RAT_STOMP_HALF_W + DASH_KILL_PAD && feetAbove <= RAT_STOMP_HIGH + 30) {
        this.killRatAt(i);
        continue;
      }

      // Pisotón: caes sobre el cuerpo de la rata (dentro de la franja) y bajando →
      // la matas, sin daño, y rebotas.
      if (absdx < RAT_STOMP_HALF_W && onBack && falling) {
        this.rats.splice(i, 1);
        this.playRatDeath(s);
        this.killRatReward(s.x, s.y - 40);
        this.player.setVelocityY(-RAT_STOMP_BOUNCE);
        continue;
      }

      // Telegrafía el ataque al acercarte por la izquierda (antes de llegar).
      if (!rat.attacking && dx <= 0 && absdx < RAT_SENSE_PX) {
        rat.attacking = true;
        s.play(RAT_ANIM_ATTACK);
        s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (s.active) s.play(RAT_ANIM_IDLE);
        });
      }

      // Daño al contacto si vas a ras de suelo (no saltaste por encima). Una vez.
      if (!rat.hit && absdx < RAT_CONTACT_PX && feetAbove < RAT_STOMP_LOW) {
        rat.hit = true;
        this.damagePlayer(RAT_DAMAGE);
      }
    }
  }

  /** Aplica daño al jugador y un destello rojo de impacto. Si el golpe llega a 0 HP,
   *  el jugador MUERE (playerDie). */
  private damagePlayer(amount: number): void {
    if (this.dead) return;                           // ya muerto: el modal está abierto
    if (this.dashing || this.flying) return;         // embistiendo o volando eres invulnerable
    if (this.time.now < this.invulnUntil) return;    // gracia tras la segunda oportunidad
    const p = this.reg.playerBridge.player;
    if (p) {
      if (p.status.HP - amount <= 0) {
        // 'second_chance': una vez por carrera, el golpe mortal te deja al 50% en
        // vez de matarte, con un instante de invulnerabilidad (estilo Idle Slayer).
        if (this.ms('second_chance') && !this.usedSecondChance) {
          this.usedSecondChance = true;
          this.invulnUntil = this.time.now + SECOND_CHANCE_INVULN_MS;
          const half = Math.max(1, Math.floor(p.status.HPMax / 2));
          this.reg.playerBridge.resetPlayerStatus(half, p.status.HPMax);
          this.reg.playerState.setHp(half, p.status.HPMax);
          this.cameras.main.flash(350, 255, 235, 140);
          this.showHealEffect(half);
          return;
        }
        this.playerDie();
        return;
      }
      this.reg.playerBridge.damagePlayer(amount);
    }
    this.player.setTint(0xff5555);
    this.time.delayedCall(110, () => { if (this.player.active) this.player.clearTint(); });
  }

  /** Muerte en el Modo Mundo: cuenta la muerte (total de por vida, para estadísticas),
   *  congela la carrera (pausa la escena) y pide a Angular el modal "Has muerto". Su
   *  "Aceptar" → requestExitRun() → exitToHome() teletransporta a la capital. */
  private playerDie(): void {
    if (this.dead) return;
    this.dead = true;
    if (this.flying) this.endFly();   // quita aura/brillo del boost antes de la anim de muerte
    this.reg.playerState.recordDeath();
    // Congela al jugador SIN pausar la escena (la escena debe seguir corriendo para que
    // la animación de muerte avance y el fundido de exitToHome se anime; pausarla rompía
    // el callback FADE_OUT_COMPLETE). update() hace early-return con `dead`.
    this.player.setVelocity(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.player.clearTint();
    this.player.setFlipX(false);                      // muere mirando a la derecha (como al correr)
    // Animación de muerte; el modal "Has muerto" sale al terminarla (si no existe, ya).
    if (this.anims.exists('wr_death')) {
      this.player.play('wr_death');
      this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.reg.playerBridge.notifyRunDeath();
      });
    } else {
      this.reg.playerBridge.notifyRunDeath();
    }
  }

  /** La rata recibe el pisotón: flash de impacto, animación de muerte y se APLASTA
   *  contra el suelo (origin abajo → encoge hacia los pies) mientras se desvanece, en
   *  vez de salir volando hacia arriba. Luego se destruye. */
  private playRatDeath(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setTintFill(0xffffff);                                   // destello del impacto
    this.time.delayedCall(70, () => { if (sprite.active) sprite.clearTint(); });
    if (this.anims.exists(RAT_ANIM_DEATH)) sprite.play(RAT_ANIM_DEATH);
    this.tweens.add({
      targets: sprite,
      x: sprite.x + 16,                  // pequeño empujón en el sentido de la carrera
      scaleY: sprite.scaleY * 0.6,       // se aplasta hacia el suelo (un punto menos)
      alpha: 0,
      duration: 320, ease: 'Quad.out',
      onComplete: () => { if (sprite.active) sprite.destroy(); },
    });
  }

  /** Filtro nearest para que el fénix se vea nítido (pixel-art). */
  private createFenixes(): void {
    if (this.textures.exists(TEX_FENIX)) {
      this.textures.get(TEX_FENIX).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  /**
   * Genera fénix voladores por delante (cada FENIX_INTERVAL_M m desde FENIX_START_M),
   * hovereando en el aire, y resuelve el combate: si saltas y caes sobre él lo matas
   * sin daño (pisotón con rebote); si chocas de otra forma te hace daño. Recicla los
   * que quedan atrás.
   */
  private updateFenixes(): void {
    if (!this.anims.exists(FENIX_ANIM_FLY)) return;   // textura/anim no disponibles
    const scrollX = this.cameras.main.scrollX;
    const spawnUntilX = scrollX + this.scale.width + CHUNK_W;
    const flyY = this.groundTopY + SURFACE_INSET - FENIX_HEIGHT;

    if (!this.ms('flying_enemies')) {
      // Hito "Enemigos voladores" sin comprar: no aparecen (índice al día, como las ratas).
      const aheadM = (spawnUntilX - this.startX) / PX_PER_METER;
      this.nextFenixIndex = Math.max(this.nextFenixIndex,
        Math.floor((aheadM - FENIX_START_M) / FENIX_INTERVAL_M) + 1);
    } else {
      let nextM = FENIX_START_M + this.nextFenixIndex * FENIX_INTERVAL_M;
      while (this.startX + nextM * PX_PER_METER <= spawnUntilX) {
        const x = this.startX + nextM * PX_PER_METER;
        const sprite = this.add.sprite(x, flyY, TEX_FENIX)
          .setScale(FENIX_SCALE).setDepth(4).setFlipX(FENIX_FACE_LEFT);
        sprite.play(FENIX_ANIM_FLY);
        // Balanceo de vuelo: sube y baja suave en bucle.
        this.tweens.add({
          targets: sprite, y: flyY - FENIX_BOB, duration: 850,
          yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
        this.fenixes.push({ sprite, hit: false, attacked: false });
        this.nextFenixIndex++;
        nextM = FENIX_START_M + this.nextFenixIndex * FENIX_INTERVAL_M;
      }
    }

    const falling = (this.player.body?.velocity.y ?? 0) >= 0;
    for (let i = this.fenixes.length - 1; i >= 0; i--) {
      const fenix = this.fenixes[i];
      const s = fenix.sprite;
      // Recicla los que quedaron atrás. killTweensOf: el balanceo es infinito.
      if (s.x < scrollX - CHUNK_W) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.fenixes.splice(i, 1);
        continue;
      }

      const dx = this.player.x - s.x;
      const absdx = Math.abs(dx);
      const rel = this.player.y - s.y;   // pies del jugador respecto al centro del fénix (neg = encima)

      // Embestida o vuelo: atravesarlo lo mata (atropello aéreo, sin daño).
      if ((this.dashing || this.flying) && absdx < FENIX_BODY_HALF_W + DASH_KILL_PAD && Math.abs(rel) < FENIX_BODY_HALF_H + 30) {
        this.killFenixAt(i);
        continue;
      }

      // Pisotón: caes sobre él (pies en la franja superior de su cuerpo) y bajando.
      if (absdx < FENIX_STOMP_HALF_W && rel >= -FENIX_STOMP_ABOVE && rel <= FENIX_STOMP_BELOW && falling) {
        this.fenixes.splice(i, 1);
        this.playFenixDeath(s);
        this.killReward(s.x, s.y - 40);
        this.player.setVelocityY(-FENIX_STOMP_BOUNCE);
        continue;
      }

      // Ataque: al acercarte por la izquierda lanza UNA bola de fuego (anim de ataque).
      if (!fenix.attacked && dx <= 0 && absdx < FENIX_ATTACK_PX) {
        fenix.attacked = true;
        s.play(FENIX_ANIM_ATTACK);
        s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (s.active) s.play(FENIX_ANIM_FLY);
        });
        this.spawnFireball(s.x, s.y);
      }

      // Choque sin pisarlo (de lado o subiendo hacia él): daño una vez… salvo que
      // vayas en golpe descendente: el slam lo atraviesa y lo mata.
      if (!fenix.hit && absdx < FENIX_BODY_HALF_W && Math.abs(rel) < FENIX_BODY_HALF_H) {
        if (this.slamming) {
          this.killFenixAt(i);
          continue;
        }
        fenix.hit = true;
        this.damagePlayer(FENIX_DAMAGE);
      }
    }
  }

  /** Lanza una bola de fuego desde el fénix: cae con gravedad hasta el suelo y luego
   *  rueda hacia el jugador (la mueve updateFireballs). */
  private spawnFireball(x: number, y: number): void {
    if (!this.anims.exists(FIREBALL_ANIM)) return;
    const sprite = this.add.sprite(x, y, `${FIREBALL_KEY}_1`).setScale(FIREBALL_SCALE).setDepth(5);
    sprite.play(FIREBALL_ANIM);
    this.fireballs.push({ sprite, vx: -FIREBALL_SPEED, vy: 0, grounded: false });
  }

  /** Mueve las bolas de fuego (caída + rodar hacia el jugador), aplica daño si no las
   *  saltas y limpia las que salen de pantalla. */
  private updateFireballs(delta: number): void {
    if (this.fireballs.length === 0) return;
    const dt = delta / 1000;
    const scrollX = this.cameras.main.scrollX;
    const groundLevel = this.groundTopY + SURFACE_INSET - FIREBALL_GROUND_OFFSET;

    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.sprite.x += fb.vx * dt;
      if (!fb.grounded) {
        fb.vy += FIREBALL_GRAVITY * dt;
        fb.sprite.y += fb.vy * dt;
        if (fb.sprite.y >= groundLevel) { fb.sprite.y = groundLevel; fb.grounded = true; }
      }
      // Fuera de pantalla por la izquierda → limpiar.
      if (fb.sprite.x < scrollX - 120) {
        fb.sprite.destroy();
        this.fireballs.splice(i, 1);
        continue;
      }
      // Impacto (solo cuando ya rueda por el suelo): solapa en X y los pies del jugador
      // NO están por encima de la bola (si saltó lo bastante alto, la libra).
      // Embistiendo la revienta sin daño.
      if (fb.grounded &&
          Math.abs(this.player.x - fb.sprite.x) < FIREBALL_HIT_W &&
          this.player.y > fb.sprite.y - FIREBALL_HIT_H) {
        if (this.dashing || this.flying) { this.popFireball(i); continue; }
        this.damagePlayer(FIREBALL_DAMAGE);
        fb.sprite.destroy();
        this.fireballs.splice(i, 1);
      }
    }
  }

  /** El fénix recibe el pisotón: flash, animación de muerte y cae girando mientras se
   *  desvanece, luego se destruye. Mata antes su tween de balanceo (infinito). */
  private playFenixDeath(sprite: Phaser.GameObjects.Sprite): void {
    this.tweens.killTweensOf(sprite);                              // corta el balanceo
    sprite.setTintFill(0xffffff);                                  // destello del impacto
    this.time.delayedCall(70, () => { if (sprite.active) sprite.clearTint(); });
    if (this.anims.exists(FENIX_ANIM_DEATH)) sprite.play(FENIX_ANIM_DEATH);
    this.tweens.add({
      targets: sprite,
      y: sprite.y + 90,            // cae al morir (estaba volando)
      x: sprite.x + 20,
      angle: 70,
      alpha: 0,
      duration: 480, ease: 'Quad.in',
      onComplete: () => { if (sprite.active) sprite.destroy(); },
    });
  }

  private updatePlayerAnim(onGround: boolean): void {
    if (this.dashing) {
      // Embistiendo: pose fija de impulso (la estela de fantasmas hace el resto).
      if (this.player.anims.isPlaying) this.player.anims.stop();
      this.player.setFrame(PLAYER_RUN_AIR_FRAME);
      return;
    }
    if (onGround) {
      // Reanudar al aterrizar. Hay que comprobar isPlaying, no solo la key: en el
      // aire hacemos anims.stop() (isPlaying=false) pero currentAnim sigue siendo
      // 'wr_run', así que mirar solo la key dejaría al personaje congelado.
      if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== 'wr_run') {
        this.player.play('wr_run');
      }
    } else {
      // En el aire: congelar en un frame de carrera (look "salto").
      if (this.player.anims.isPlaying) this.player.anims.stop();
      this.player.setFrame(PLAYER_RUN_AIR_FRAME);
    }
  }

  private bindInput(): void {
    // Tap en el lienzo: mantener = saltar más alto. Un tap en el aire = doble salto.
    // Los gestos (estilo Idle Slayer) se evalúan sobre el mismo toque: swipe DERECHA
    // = embestida, swipe ABAJO = golpe descendente.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // No saltar al tocar el botón de salida (zona arriba-izquierda).
      if (pointer.x < 110 && pointer.y < 70) return;
      // Tocar la pantalla cierra cualquier menú abierto (además de saltar).
      this.reg.playerBridge.requestCloseMenus();
      this.swipeStart = { x: pointer.x, y: pointer.y, t: this.time.now };
      this.swipeFired = false;
      this.pressJump();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) this.checkSwipe(pointer);
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.checkSwipe(pointer);
      this.releaseJump();
      this.swipeStart = null;
    });
    this.input.on('pointerupoutside', () => { this.releaseJump(); this.swipeStart = null; });

    // Teclado (escritorio): ESPACIO salta · D o → embestida · S o ↓ golpe descendente.
    // addCapture evita que la página haga scroll con esas teclas.
    const kb = this.input.keyboard;
    if (kb) {
      kb.addCapture(['SPACE', 'D', 'S', 'RIGHT', 'DOWN']);
      kb.on('keydown-SPACE', () => this.pressJump());
      kb.on('keyup-SPACE', () => this.releaseJump());
      kb.on('keydown-D', () => this.startDash());
      kb.on('keydown-RIGHT', () => this.startDash());
      kb.on('keydown-S', () => this.startSlam());
      kb.on('keydown-DOWN', () => this.startSlam());
    }
  }

  /** Evalúa si el toque en curso es un swipe (una vez por toque): derecha = embestida,
   *  abajo = golpe descendente. El gesto anula el "mantener" del salto que arrancó
   *  con el pointerdown, para que ese salto se quede en el toque mínimo. */
  private checkSwipe(pointer: Phaser.Input.Pointer): void {
    if (!this.swipeStart || this.swipeFired) return;
    if (this.time.now - this.swipeStart.t > SWIPE_MAX_MS) return;
    const dx = pointer.x - this.swipeStart.x;
    const dy = pointer.y - this.swipeStart.y;
    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;
    this.swipeFired = true;
    this.releaseJump();
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) this.startDash();
    } else if (dy > 0) {
      this.startSlam();
    }
  }

  /** Pulsación: salta si está en el suelo; en el aire gasta el DOBLE salto (uno). */
  private pressJump(): void {
    if (!this.player.body || this.dead || this.exiting) return;
    this.jumpHeld = true;
    if (this.dashing || this.slamming) return;   // durante una habilidad no se salta
    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround && !this.isJumping) {
      this.player.setVelocityY(-JUMP_INITIAL_VELOCITY);
      this.isJumping = true;
      this.jumpHoldMs = 0;
      this.jumpsUsed = 1;
    } else if (!onGround && this.jumpsUsed < 2 && this.reg.runProgress.has('double_jump')) {
      // Doble salto (hito comprable con estrellas): un impulso extra en el aire.
      this.player.setVelocityY(-DOUBLE_JUMP_VELOCITY);
      this.isJumping = true;
      this.jumpHoldMs = 0;
      this.jumpsUsed = 2;
      this.showDoubleJumpPuff();
    }
  }

  private releaseJump(): void {
    this.jumpHeld = false;
  }

  // --- Embestida (dash) -------------------------------------------------------
  /** Embestida hacia delante: ráfaga horizontal breve, invulnerable, que MATA a
   *  cualquier enemigo que toque (el "slayer" de Idle Slayer). Con enfriamiento. */
  private startDash(): void {
    if (!this.reg.runProgress.has('dash')) return;   // hito sin comprar
    const now = this.time.now;
    if (this.dashing || this.dead || this.exiting || now < this.dashReadyAt) return;
    if (this.slamming) return;                        // en pleno slam no se embiste
    this.dashing = true;
    this.dashUntil = now + DASH_MS;
    this.dashReadyAt = now + DASH_COOLDOWN_MS;
    this.lastGhostAt = 0;
    this.isJumping = false;
    // Vuelo recto: sin gravedad ni velocidad vertical mientras dura.
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.player.setVelocityY(0);
    this.player.setTint(0x9bd8ff);
  }

  private endDash(): void {
    if (!this.dashing) return;
    this.dashing = false;
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    this.player.clearTint();
  }

  // --- Boost (sin vuelo) -------------------------------------------------------
  /** Entra en modo boost: ×5 velocidad, invulnerable y arrasa enemigos (ramas
   *  `this.flying` en damagePlayer/updateRats/Fenixes/Fireballs), con brillo dorado +
   *  aura DBZ. Corre y salta con normalidad (gravedad intacta). Dura mientras flyActive. */
  private startFly(): void {
    this.flying = true;
    this.player.setTint(0xffd27f);
    this.startFlyAura();
    // Aura sprite (hoja DBZ) detrás del jugador (depth 4 < jugador 5), envolviéndolo.
    if (this.anims.exists(AURA_ANIM)) {
      this.auraSprite = this.add.sprite(this.player.x + AURA_X_OFFSET, this.player.y - AURA_Y_OFFSET, AURA_SHEET, 0)
        .setScale(AURA_SPRITE_SCALE).setDepth(4);
      this.auraSprite.play(AURA_ANIM);
    }
  }

  /** Sale del modo boost: quita el brillo y el aura. */
  private endFly(): void {
    if (!this.flying) return;
    this.flying = false;
    this.player.clearTint();
    this.stopFlyAura();
    this.auraSprite?.destroy();
    this.auraSprite = undefined;
  }

  /** Registra la animación del aura (4 frames del spritesheet ya limpio). */
  private buildAuraSheet(): void {
    if (this.anims.exists(AURA_ANIM)) return;         // ya construido (anims globales)
    if (!this.textures.exists(AURA_SHEET)) return;    // el png no cargó (no rompe el vuelo)
    this.anims.create({
      key: AURA_ANIM,
      frames: this.anims.generateFrameNumbers(AURA_SHEET, { start: 0, end: AURA_COLS - 1 }),
      frameRate: 12, repeat: -1,
    });
  }

  /** Aura "ki" estilo Dragon Ball: llamas doradas que suben alrededor del cuerpo, en
   *  modo aditivo (brillo). Sigue al jugador; sin sprites (textura AURA_KEY por código). */
  private startFlyAura(): void {
    this.auraEmitter?.destroy();
    this.auraEmitter = this.add.particles(0, 0, AURA_KEY, {
      follow: this.player,
      followOffset: { x: 0, y: -50 },   // el jugador tiene el origen en los pies: subir al torso
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 34, 78) as any },
      lifespan: 420,
      frequency: 14,
      quantity: 2,
      scale: { start: 0.95, end: 0 },
      alpha: { start: 0.85, end: 0 },
      speedX: { min: -45, max: 45 },
      speedY: { min: -190, max: -70 },   // suben (llama)
      tint: [0xfff2a0, 0xffcf4d, 0xff9a1f],
      blendMode: 'ADD',
    });
    this.auraEmitter.setDepth(4);   // detrás del jugador (depth 5), como un halo
  }

  /** Detiene el aura: deja de emitir y la destruye cuando las partículas vivas se apagan. */
  private stopFlyAura(): void {
    if (!this.auraEmitter) return;
    const em = this.auraEmitter;
    this.auraEmitter = undefined;
    em.stop();
    this.time.delayedCall(450, () => em.destroy());
  }

  /** Estela de la embestida: "fantasmas" del sprite que se desvanecen por detrás. */
  private spawnDashGhost(now: number): void {
    this.lastGhostAt = now;
    const ghost = this.add.image(this.player.x, this.player.y, 'player', this.player.frame.name)
      .setOrigin(0.5, 1).setScale(PLAYER_SCALE).setDepth(4)
      .setAlpha(0.45).setTint(0x9bd8ff);
    this.tweens.add({
      targets: ghost, alpha: 0, duration: 220, ease: 'Quad.out',
      onComplete: () => ghost.destroy(),
    });
  }

  // --- Golpe descendente (slam) ------------------------------------------------
  /** Golpe descendente: solo en el aire. Cae en picado; al aterrizar, onda que mata
   *  a las ratas cercanas (y revienta bolas de fuego). Atravesar a un fénix bajando
   *  también lo mata (ver updateFenixes). */
  private startSlam(): void {
    if (!this.reg.runProgress.has('slam')) return;   // hito sin comprar
    if (!this.player.body || this.dead || this.exiting || this.slamming) return;
    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround) return;
    if (this.dashing) this.endDash();                 // el slam corta la embestida
    this.slamming = true;
    this.isJumping = false;
    this.jumpHeld = false;
    this.player.setVelocityY(SLAM_SPEED);
  }

  /** Aterrizaje del golpe descendente: sacudida, onda expansiva y bajas cercanas. */
  private slamImpact(): void {
    this.slamming = false;
    this.cameras.main.shake(90, 0.004);
    // Onda expansiva (anillo que crece y se desvanece a ras de suelo).
    const y = this.groundTopY + SURFACE_INSET;
    const ring = this.add.ellipse(this.player.x, y, 40, 14).setDepth(4);
    ring.setStrokeStyle(4, 0xffffff, 0.9);
    ring.isFilled = false;
    this.tweens.add({
      targets: ring, scaleX: SLAM_KILL_RADIUS / 20, scaleY: 2.2, alpha: 0,
      duration: 280, ease: 'Quad.out', onComplete: () => ring.destroy(),
    });
    // Bajas en el radio del impacto: ratas y bolas de fuego rodando.
    for (let i = this.rats.length - 1; i >= 0; i--) {
      if (Math.abs(this.rats[i].sprite.x - this.player.x) < SLAM_KILL_RADIUS) this.killRatAt(i);
    }
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      if (Math.abs(this.fireballs[i].sprite.x - this.player.x) < SLAM_KILL_RADIUS) this.popFireball(i);
    }
  }

  // --- Arco automático ---------------------------------------------------------
  /** Dispara solo cada ARROW_INTERVAL_MS una flecha recta hacia delante a la altura
   *  del pecho: corriendo barre ratas; saltando puede alcanzar a un fénix. También
   *  revienta bolas de fuego. Mueve/limpia las flechas y resuelve sus impactos. */
  private updateArrows(now: number, delta: number): void {
    if (!this.dead && !this.exiting && now - this.lastArrowAt >= ARROW_INTERVAL_MS
        && this.reg.runProgress.has('bow')) {
      this.lastArrowAt = now;
      const arrow = this.add.image(
        this.player.x + 30,
        this.player.y - this.player.displayHeight * 0.55,
        ARROW_KEY,
      ).setScale(2).setDepth(5);
      this.arrows.push(arrow);
      // 'double_arrows': una segunda flecha rasante (barre lo que va a ras de suelo).
      if (this.ms('double_arrows')) {
        const low = this.add.image(
          this.player.x + 30,
          this.groundTopY + SURFACE_INSET - 34,
          ARROW_KEY,
        ).setScale(2).setDepth(5);
        this.arrows.push(low);
      }
    }
    if (this.arrows.length === 0) return;

    const dt = delta / 1000;
    const scrollX = this.cameras.main.scrollX;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      arrow.x += ARROW_SPEED * dt;
      // Fuera de pantalla por la derecha → limpiar.
      if (arrow.x > scrollX + this.scale.width + 100) {
        arrow.destroy();
        this.arrows.splice(i, 1);
        continue;
      }
      let spent = false;
      // Ratas: cuentan si la flecha va baja (ras de suelo, donde está su cuerpo).
      for (let r = this.rats.length - 1; r >= 0 && !spent; r--) {
        const s = this.rats[r].sprite;
        if (Math.abs(arrow.x - s.x) < ARROW_HIT_X && arrow.y > s.y - 100 && arrow.y < s.y + 8) {
          this.killRatAt(r);
          spent = true;
        }
      }
      // Fénix: a la altura de su cuerpo.
      for (let f = this.fenixes.length - 1; f >= 0 && !spent; f--) {
        const s = this.fenixes[f].sprite;
        if (Math.abs(arrow.x - s.x) < ARROW_HIT_X && Math.abs(arrow.y - s.y) < FENIX_BODY_HALF_H + 25) {
          this.killFenixAt(f);
          spent = true;
        }
      }
      // Bolas de fuego: las revienta en el aire o rodando.
      for (let b = this.fireballs.length - 1; b >= 0 && !spent; b--) {
        const s = this.fireballs[b].sprite;
        if (Math.abs(arrow.x - s.x) < 34 && Math.abs(arrow.y - s.y) < 34) {
          this.popFireball(b);
          spent = true;
        }
      }
      if (spent) {
        arrow.destroy();
        this.arrows.splice(i, 1);
      }
    }
  }

  /** Generadores pasivos ('star_prod1/2/3'): producen ★/min mientras corres, en
   *  fracciones acumuladas; al completar una estrella se cobra con su "+N ★".
   *  (La misma tasa corre AFK explorando, ver OfflineGainsService.) */
  private updateStarProduction(delta: number): void {
    const perMin = starProdPerMin(this.reg.runProgress.getMilestones());
    if (perMin <= 0) return;
    this.starProdCarry += perMin * (delta / 60000);
    if (this.starProdCarry >= 1) {
      const n = Math.floor(this.starProdCarry);
      this.starProdCarry -= n;
      this.reg.runProgress.collectStars(n);
      this.showStarGain(this.player.x, this.player.y - this.player.displayHeight, n);
    }
  }

  /** Nube del doble salto: elipse blanca bajo los pies que se expande y desvanece. */
  private showDoubleJumpPuff(): void {
    const puff = this.add.ellipse(this.player.x, this.player.y, 46, 14, 0xffffff, 0.7).setDepth(4);
    this.tweens.add({
      targets: puff, scaleX: 1.7, scaleY: 0.6, alpha: 0,
      duration: 260, ease: 'Quad.out', onComplete: () => puff.destroy(),
    });
  }

  /** Mata la rata `i` (habilidades: dash/slam/flecha) — anim + kill contabilizado. */
  private killRatAt(i: number): void {
    const rat = this.rats[i];
    this.rats.splice(i, 1);
    this.playRatDeath(rat.sprite);
    this.killRatReward(rat.sprite.x, rat.sprite.y - 40);
  }

  /** Recompensa de una rata: la de mundo (estrellas/HUD) + cuenta la baja para las
   *  misiones de matar (family 'rats'). Solo las ratas la usan (no los fénix), para
   *  que la misión de la rata no la satisfaga otro enemigo del Modo Mundo. */
  private killRatReward(x: number, y: number): void {
    this.killReward(x, y);
    this.reg.kill?.emitQuestKill('rats_world');
  }

  /** Mata el fénix `i` (habilidades) — anim de caída + kill contabilizado. */
  private killFenixAt(i: number): void {
    const fenix = this.fenixes[i];
    this.fenixes.splice(i, 1);
    this.playFenixDeath(fenix.sprite);
    this.killReward(fenix.sprite.x, fenix.sprite.y - 40);
  }

  /** Recompensa de una baja: el kill del HUD + ESTRELLAS (el loop de Idle Slayer:
   *  matar da moneda). El valor escala con los hitos "estrellas valiosas". */
  private killReward(x: number, y: number): void {
    this.reg.playerState.addWorldKills();
    const n = STAR_PER_KILL * this.starValue();
    this.reg.runProgress.collectStars(n);
    this.showStarGain(x, y, n);
  }

  /** Revienta la bola de fuego `i` (dash/slam/flecha la neutralizan). */
  private popFireball(i: number): void {
    const fb = this.fireballs[i];
    this.fireballs.splice(i, 1);
    this.tweens.add({
      targets: fb.sprite, alpha: 0, scale: fb.sprite.scale * 1.8,
      duration: 160, ease: 'Quad.out', onComplete: () => fb.sprite.destroy(),
    });
  }

  /** Salto variable: mientras se mantiene (y dentro de la ventana de tiempo), se
   *  sigue empujando hacia arriba; al soltar o agotar el tiempo, manda la gravedad. */
  private updateJump(deltaMs: number): void {
    if (!this.isJumping) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.jumpHeld && this.jumpHoldMs < JUMP_MAX_HOLD_MS && body.velocity.y < 0) {
      this.jumpHoldMs += deltaMs;
      const v = body.velocity.y - JUMP_HOLD_ACCEL * (deltaMs / 1000);
      body.velocity.y = Math.max(v, -JUMP_MAX_VELOCITY);
    } else {
      this.isJumping = false;
    }
  }

  private createHud(): void {
    // Todo el HUD (metros recorridos, estrellas, botón de volver…) lo pinta Angular
    // (app-run-stats arriba a la derecha + layout), no Phaser. Los metros se publican
    // en playerBridge.runDistanceM$ desde update(). Aquí ya no se dibuja nada.
    this.reg.playerBridge.runDistanceM$.next(0);   // reinicia el contador al empezar la carrera
  }

  private respawn(): void {
    const floorTop = this.groundTopY + SURFACE_INSET;
    this.player.setPosition(this.cameras.main.scrollX + this.scale.width * 0.25, floorTop - 120);
    this.player.setVelocity(0, 0);
  }

  private exiting = false;
  private exitToHome(): void {
    if (this.exiting) return;   // evita doble pulsación durante el fundido
    this.exiting = true;
    // Reset YA (no dentro del callback del fundido, que podía no dispararse): volver a
    // casa = fin de expedición → estrellas, distancia explorada y muertes actuales a 0;
    // se conservan récord de distancia y total de muertes (estadísticas). Ver goHomeReset.
    this.reg.playerState.goHomeReset();
    // Llegar a la capital cura al 100% (sobre todo tras morir, que llegas con poca vida).
    const p = this.reg.playerBridge.player;
    if (p) {
      this.reg.playerBridge.resetPlayerStatus(p.status.HPMax, p.status.HPMax);
      this.reg.playerState.setHp(p.status.HPMax, p.status.HPMax);
    }
    // Mapa principal (capital) del planeta explorado (Asgard en la Tierra) y actividad
    // 'idle' para que GameScene.create no rebote al Modo Mundo (ver rebote 'exploring').
    this.reg.world.setCurrentMap(planetCapitalForMap(this.entryMapId));
    this.reg.activity?.set('idle');
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GameScene');
      this.scene.stop();
    });
  }
}
