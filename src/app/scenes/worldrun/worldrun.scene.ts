import { Subscription } from 'rxjs';
import { GameRegistry } from '../game-registry';

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

// --- Tileset de suelo (assets/tilemaps/world/Ground_grass.png) ---
const SRC_TILE = 16;                 // px por tile en la hoja
const TILESET_COLS = 19;             // columnas de la hoja (304 / 16)
const RENDER_SCALE = 3;              // los tiles se dibujan a 3× → 48px, como el grid
const RT = SRC_TILE * RENDER_SCALE;  // tamaño de tile renderizado (48)

// Frames de la hoja: borde superior de césped (col8/fila7 → 141) + relleno de
// tierra (col11/fila12 → 239), como el mapa de la captura.
const FRAME_GRASS = 8  + 7  * TILESET_COLS;
const FRAME_DIRT  = 11 + 12 * TILESET_COLS;

// --- Mundo / chunks ---
const CHUNK_TILES = 16;              // ancho de un chunk en tiles
const CHUNK_W = CHUNK_TILES * RT;    // ancho de un chunk en px de mundo
const GROUND_TILES_TALL = 4.5;       // altura de la superficie sobre el borde inferior (en tiles). Más = suelo más arriba.
// El colisionador del suelo se hunde un poco dentro del tile de césped, de modo
// que el personaje pisa sobre el césped (las briznas quedan detrás de sus pies).
const SURFACE_INSET = RT * 0.55;

// --- Física / movimiento ---
const GRAVITY_Y = 2200;
const RUN_SPEED = 420;               // px/s constantes hacia la derecha
const PX_PER_METER = RT;             // 1 tile = 1 metro

// --- Salto variable (mantener = más alto, con tope) ---
const JUMP_INITIAL_VELOCITY = 480;   // impulso al pulsar (altura del toque mínimo)
const JUMP_HOLD_ACCEL = 3200;        // px/s² extra hacia arriba mientras se mantiene
const JUMP_MAX_HOLD_MS = 240;        // tiempo máx. que el mantener sigue impulsando
const JUMP_MAX_VELOCITY = 860;       // tope de velocidad de subida (límite de altura)

// --- Jugador (placeholder: cuerpo LPC corriendo de lado) ---
const PLAYER_SCALE = 2.5;            // misma escala que el jugador en el grid (gamescene.ts)
// LPC expandido: la animación RUN está en las filas 38-41 (8 frames). Run-derecha
// = fila 41 = frames 533-540 (≠ WALK derecha, que es 143-150).
const PLAYER_RUN_FRAMES = { start: 533, end: 540 };
const PLAYER_RUN_AIR_FRAME = 537;                     // frame congelado en el aire
const PLAYER_IDLE_FRAME = 325;                        // IDLE RIGHT

// --- Parallax de fondo (4 capas espaciales, 1920×1080) ---
const PARALLAX_DIR = 'assets/tilemaps/world/paralax/paralax01/';
const PARALLAX_SRC_H = 1080;
// De atrás (factor bajo = se mueve despacio) hacia delante.
const PARALLAX_LAYERS = [
  { key: 'wr_px_nebula',   file: 'l1_nebula-01',    factor: 0.08 },
  { key: 'wr_px_stars',    file: 'l2_stars-01',     factor: 0.18 },
  { key: 'wr_px_planet_b', file: 'l3_planet02-01',  factor: 0.34 },
  { key: 'wr_px_planet_f', file: 'l4_planet02-01',  factor: 0.55 },
];

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

  private distanceText!: Phaser.GameObjects.Text;
  private jumpSub?: Subscription;
  private jumpReleaseSub?: Subscription;
  private parallax: { ts: Phaser.GameObjects.TileSprite; factor: number }[] = [];

  // Estado del salto variable.
  private jumpHeld = false;
  private isJumping = false;
  private jumpHoldMs = 0;

  constructor() {
    super({ key: 'WorldRunScene', active: false });
  }

  preload() {
    this.reg = new GameRegistry(this.game);
    if (!this.textures.exists('world_tiles')) {
      this.load.spritesheet('world_tiles', 'assets/tilemaps/world/Ground_grass.png',
        { frameWidth: SRC_TILE, frameHeight: SRC_TILE });
    }
    // El cuerpo del jugador suele estar ya cargado por GameScene; lo aseguramos.
    if (!this.textures.exists('player')) {
      this.load.spritesheet('player', 'assets/sprites/player/character/body/main.png',
        { frameWidth: 64, frameHeight: 64 });
    }
    for (const l of PARALLAX_LAYERS) {
      if (!this.textures.exists(l.key)) this.load.image(l.key, PARALLAX_DIR + l.file + '.png');
    }
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

    this.physics.world.gravity.y = GRAVITY_Y;
    this.cameras.main.setBackgroundColor('#0a0a14'); // espacio (por si una capa no cubre)

    const h = this.scale.height;
    // El suelo ocupa las últimas GROUND_TILES_TALL filas de la pantalla.
    this.groundTopY = h - GROUND_TILES_TALL * RT;

    this.registerAnims();
    this.buildParallax();
    this.buildInitialChunks();
    this.createPlayer();
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
    this.jumpSub = this.reg.playerBridge.jumpRequest$.subscribe(() => this.pressJump());
    this.jumpReleaseSub = this.reg.playerBridge.jumpReleaseRequest$.subscribe(() => this.releaseJump());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.jumpSub?.unsubscribe();
      this.jumpReleaseSub?.unsubscribe();
      this.reg.playerBridge.setRunMode(false);
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  override update(_time: number, delta: number) {
    if (!this.player.body) return;

    // Auto-run: velocidad X constante (se re-aplica cada frame por si una colisión
    // la anuló). El control manual está anulado: el único input es saltar.
    this.player.setVelocityX(RUN_SPEED);

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround && this.player.body.velocity.y >= 0) this.isJumping = false;
    this.updateJump(delta);
    this.updatePlayerAnim(onGround);

    // (La cámara la mueve startFollow tras la física; aquí solo leemos su scroll.)
    this.updateParallax();
    this.recycleChunks();

    // Metros recorridos (Fase 2 lo llevará al HUD; por ahora texto en pantalla).
    this.distanceM = Math.max(0, Math.floor((this.player.x - this.startX) / PX_PER_METER));
    this.distanceText.setText(`${this.distanceM} m`);

    // Caída por un hueco (aún no hay huecos en Fase 1): reinicio simple.
    if (this.player.y > this.scale.height + 300) this.respawn();
  }

  // ---------------------------------------------------------------------------

  private registerAnims(): void {
    if (!this.anims.exists('wr_run')) {
      this.anims.create({
        key: 'wr_run',
        frames: this.anims.generateFrameNumbers('player', PLAYER_RUN_FRAMES),
        frameRate: 14,
        repeat: -1,
      });
    }
  }

  private buildParallax(): void {
    // Cada capa es un TileSprite fijo a la cámara (scrollFactor 0) que cubre toda
    // la pantalla; el "movimiento" se hace desplazando tilePositionX según el
    // scroll de la cámara y su factor de profundidad. Las imágenes se escalan a la
    // altura de pantalla (tileScale) y se repiten en horizontal de forma infinita.
    const tileScale = this.scale.height / PARALLAX_SRC_H;
    PARALLAX_LAYERS.forEach((l, i) => {
      const ts = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, l.key)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(-100 + i);
      ts.tileScaleX = tileScale;
      ts.tileScaleY = tileScale;
      this.parallax.push({ ts, factor: l.factor });
    });
  }

  private updateParallax(): void {
    const sx = this.cameras.main.scrollX;
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
    const stripW = CHUNK_TILES * SRC_TILE; // ancho en px SIN escalar (el scale lo aplica)

    // Fila de césped arriba (borde del mapa) + tierra debajo. Ambas detrás del
    // jugador (depth < 5) para que él pise sobre el césped.
    const grass = this.add.tileSprite(leftX, this.groundTopY, stripW, SRC_TILE, 'world_tiles', FRAME_GRASS)
      .setOrigin(0, 0).setScale(RENDER_SCALE).setDepth(1);
    // La tierra sobra por debajo del borde de la pantalla (overdraw de 2 tiles) para
    // que nunca quede hueco con el footer aunque el canvas no encaje al píxel.
    const dirtTopY = this.groundTopY + RT;
    const dirtPx = (this.scale.height + RT * 2) - dirtTopY;
    const dirt = this.add.tileSprite(leftX, dirtTopY, stripW, dirtPx / RENDER_SCALE, 'world_tiles', FRAME_DIRT)
      .setOrigin(0, 0).setScale(RENDER_SCALE).setDepth(0);

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
    this.startX = this.scale.width * 0.25;
    const floorTop = this.groundTopY + SURFACE_INSET;
    this.player = this.physics.add.sprite(this.startX, floorTop - 120, 'player', PLAYER_IDLE_FRAME);
    this.player.setScale(PLAYER_SCALE).setDepth(5).setOrigin(0.5, 1);
    // Cuerpo de colisión ajustado a los pies del cuerpo LPC (el frame 64×64 tiene
    // mucho aire). setOffset en coordenadas del frame sin escalar.
    this.player.body!.setSize(16, 26);
    (this.player.body as Phaser.Physics.Arcade.Body).setOffset(24, 36);
    this.player.setCollideWorldBounds(false);

    for (const chunk of this.chunks) this.physics.add.collider(this.player, chunk.floor);
  }

  private updatePlayerAnim(onGround: boolean): void {
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
    // Tap en el lienzo: mantener = saltar más alto.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // No saltar al tocar el botón de salida (zona arriba-izquierda).
      if (pointer.x < 110 && pointer.y < 70) return;
      this.pressJump();
    });
    this.input.on('pointerup', () => this.releaseJump());
    this.input.on('pointerupoutside', () => this.releaseJump());

    // Barra espaciadora (escritorio). addCapture evita que la página haga scroll.
    const kb = this.input.keyboard;
    if (kb) {
      kb.addCapture('SPACE');
      kb.on('keydown-SPACE', () => this.pressJump());
      kb.on('keyup-SPACE', () => this.releaseJump());
    }
  }

  /** Pulsación: arranca el salto si está en el suelo, y marca "mantenido". */
  private pressJump(): void {
    if (!this.player.body) return;
    this.jumpHeld = true;
    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround && !this.isJumping) {
      this.player.setVelocityY(-JUMP_INITIAL_VELOCITY);
      this.isJumping = true;
      this.jumpHoldMs = 0;
    }
  }

  private releaseJump(): void {
    this.jumpHeld = false;
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
    this.distanceText = this.add.text(this.scale.width / 2, 24, '0 m', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Botón provisional para volver al hogar (sin él, el runner es un callejón sin salida).
    const back = this.add.text(16, 16, '‹ Salir', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffffff',
      backgroundColor: '#00000080', padding: { x: 10, y: 6 },
    }).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.exitToHome());
  }

  private respawn(): void {
    const floorTop = this.groundTopY + SURFACE_INSET;
    this.player.setPosition(this.cameras.main.scrollX + this.scale.width * 0.25, floorTop - 120);
    this.player.setVelocity(0, 0);
  }

  private exitToHome(): void {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.reg.world.setCurrentMap('hogar');
      this.scene.start('GameScene');
      this.scene.stop();
    });
  }
}
