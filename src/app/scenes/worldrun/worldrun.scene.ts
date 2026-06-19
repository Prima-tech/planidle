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

// Frame de relleno de tierra (col 11, fila 12 → 239). El césped (col8/fila7 → 141)
// se quitó: el personaje quedaba feo corriendo por encima de las briznas.
const FRAME_DIRT = 11 + 12 * TILESET_COLS;

// --- Mundo / chunks ---
const CHUNK_TILES = 16;              // ancho de un chunk en tiles
const CHUNK_W = CHUNK_TILES * RT;    // ancho de un chunk en px de mundo
const GROUND_TILES_TALL = 4;         // filas visibles de suelo (todo tierra)
// El colisionador del suelo coincide con el borde superior de la tierra: el
// personaje pisa justo encima del primer tile.
const SURFACE_INSET = 0;

// --- Física / movimiento ---
const GRAVITY_Y = 2200;
const RUN_SPEED = 420;               // px/s constantes hacia la derecha
const JUMP_VELOCITY = 880;           // impulso vertical del salto
const PX_PER_METER = RT;             // 1 tile = 1 metro

// --- Jugador (placeholder: cuerpo LPC corriendo de lado) ---
const PLAYER_SCALE = 2.5;            // misma escala que el jugador en el grid (gamescene.ts)
// LPC expandido: la animación RUN está en las filas 38-41 (8 frames). Run-derecha
// = fila 41 = frames 533-540 (≠ WALK derecha, que es 143-150).
const PLAYER_RUN_FRAMES = { start: 533, end: 540 };
const PLAYER_RUN_AIR_FRAME = 537;                     // frame congelado en el aire
const PLAYER_IDLE_FRAME = 325;                        // IDLE RIGHT

interface RunChunk {
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
  }

  create() {
    this.physics.world.gravity.y = GRAVITY_Y;
    this.cameras.main.setBackgroundColor('#7fb2d9'); // cielo provisional (irá parallax)

    const h = this.scale.height;
    // El suelo ocupa las últimas GROUND_TILES_TALL filas de la pantalla.
    this.groundTopY = h - GROUND_TILES_TALL * RT;

    this.registerAnims();
    this.buildInitialChunks();
    this.createPlayer();
    this.createHud();
    this.bindInput();

    // Cámara: sigue al jugador SOLO en X (scrollY fijo). Lo mantenemos a ~25% del
    // borde izquierdo para ver lo que viene por delante. roundPixels evita el
    // borrón del sprite (igual que en el grid).
    this.cameras.main.scrollY = 0;
    this.cameras.main.roundPixels = true;

    // Avisar a la UI Angular: oculta minimapa/skills/toggle del footer y convierte
    // el botón de ataque en botón de salto (que emite por jumpRequest$).
    this.reg.playerBridge.setRunMode(true);
    this.jumpSub = this.reg.playerBridge.jumpRequest$.subscribe(() => this.tryJump());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.jumpSub?.unsubscribe();
      this.reg.playerBridge.setRunMode(false);
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  override update() {
    if (!this.player.body) return;

    // Auto-run: velocidad X constante (se re-aplica cada frame por si una colisión
    // la anuló). El control manual está anulado: el único input es saltar.
    this.player.setVelocityX(RUN_SPEED);

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    this.updatePlayerAnim(onGround);

    // Cámara: scroll horizontal manteniendo al jugador a la izquierda.
    this.cameras.main.scrollX = this.player.x - this.scale.width * 0.25;

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

  private buildInitialChunks(): void {
    const needed = Math.ceil(this.scale.width / CHUNK_W) + 2;
    for (let i = 0; i < needed; i++) this.chunks.push(this.makeChunk(i));
    this.rightmostIndex = needed - 1;
  }

  private makeChunk(index: number): RunChunk {
    const leftX = index * CHUNK_W;
    const stripW = CHUNK_TILES * SRC_TILE; // ancho en px SIN escalar (el scale lo aplica)

    const dirt = this.add.tileSprite(leftX, this.groundTopY, stripW, SRC_TILE * GROUND_TILES_TALL, 'world_tiles', FRAME_DIRT)
      .setOrigin(0, 0).setScale(RENDER_SCALE).setDepth(0);

    // Colisionador estático del suelo (invisible), con el borde superior justo en
    // el tope de la tierra.
    const floorTop = this.groundTopY + SURFACE_INSET;
    const floorH = this.scale.height - floorTop + 100;
    const floor = this.add.rectangle(leftX + CHUNK_W / 2, floorTop + floorH / 2, CHUNK_W, floorH);
    floor.setVisible(false);
    this.physics.add.existing(floor, true);

    return { dirt, floor, index };
  }

  private positionChunk(chunk: RunChunk, index: number): void {
    const leftX = index * CHUNK_W;
    chunk.index = index;
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
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // No saltar al tocar el botón de salida (zona arriba-izquierda).
      if (pointer.x < 110 && pointer.y < 70) return;
      this.tryJump();
    });
  }

  private tryJump(): void {
    if (!this.player.body) return;
    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround) this.player.setVelocityY(-JUMP_VELOCITY);
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
