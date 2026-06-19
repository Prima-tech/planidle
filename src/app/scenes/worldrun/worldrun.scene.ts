import { Subscription } from 'rxjs';
import { GameRegistry } from '../game-registry';
import { mapFeatureId } from '../../services/unlock-config';
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

/**
 * Hitos del Modo Mundo: al alcanzar `distanceM` por PRIMERA vez (su flag aún sin
 * marcar) se desbloquea el mapa y aparece el modal de entrada.
 *   · `firstEver` = el primer mapa de todos: el modal solo ofrece "Aceptar" (entra).
 *     En los demás el modal ofrece "Aceptar" (entra) o "Cancelar" (sigue corriendo).
 * El "primera vez" se persiste como flag (char) en UnlockService; el botón "borrar
 * todo" limpia los flags, así que los hitos vuelven a dispararse desde cero.
 * Añadir más mapas = añadir entradas aquí (su distancia, flag y pin de mapa).
 */
interface RunUnlockPoint {
  distanceM: number;
  flag: string;     // flag (char) que desbloquea la feature 'map.X'
  mapId: string;    // id de pin del mapa (p.ej. '1-1')
  firstEver: boolean;
}
const RUN_UNLOCK_POINTS: RunUnlockPoint[] = [
  { distanceM: 100, flag: 'map_1_1', mapId: '1-1', firstEver: true },
];

// --- Estrellas coleccionables (assets/sprites/resources/world_mode/star/) ---
// 10 frames de un parpadeo: star.png (frame 1) + star2..star10.png, animados en
// bucle. Aparece una estrella cada STAR_INTERVAL_M metros, flotando sobre el suelo
// a la altura del cuerpo del jugador para recogerla al pasar (o con un saltito).
// El contador (estado del jugador, persistido como las monedas) sale arriba a la
// derecha. NOTA: si los PNG están vacíos/corruptos, Phaser pinta el cuadro verde
// "textura faltante" pero la estrella se sigue pudiendo recoger.
const STAR_KEYS = Array.from({ length: 10 }, (_, i) => `wr_star_${i + 1}`);
const STAR_FILES = STAR_KEYS.map((_, i) =>
  `assets/sprites/resources/world_mode/star/star${i === 0 ? '' : i + 1}.png`);
const STAR_ANIM = 'wr_star_twinkle';
const STAR_INTERVAL_M = 25;          // cada cuántos metros aparece una estrella
const STAR_SCALE = 1.8;
// Alturas (px sobre la línea del suelo) que van rotando estrella a estrella, para
// que no salgan todas a la misma altura: 50 = a ras del cuerpo (se recoge corriendo),
// las más altas piden un saltito (más alto = salto más largo). Ver el salto: con
// JUMP_MAX_VELOCITY se llega holgado a ~210px.
const STAR_HEIGHTS = [50, 120, 180, 90, 150];

// --- Mundo / chunks ---
const CHUNK_TILES = 16;              // ancho de un chunk en tiles
const CHUNK_W = CHUNK_TILES * RT;    // ancho de un chunk en px de mundo
// Filas de tiles de suelo visibles (de la hierba al borde inferior). 3 = se ven
// ~3 tiles en vertical: 1 fila de hierba (suelo_01) + 2 de tierra (suelo_02).
const GROUND_VISIBLE_ROWS = 3;
const GROUND_BAND_H = GROUND_VISIBLE_ROWS * GROUND_TILE;  // alto de la banda de suelo (px pantalla)
// El colisionador del suelo va casi en el borde superior del tile (suelo_01 tiene
// la hierba arriba del todo), así el personaje pisa justo sobre la hierba.
const SURFACE_INSET = RT * 0.12;

// --- Física / movimiento ---
const GRAVITY_Y = 2200;
const RUN_SPEED = 260;               // px/s constantes hacia la derecha (bajar = más lento)
const PX_PER_METER = RT;             // 1 tile = 1 metro

// --- Salto variable (mantener = más alto, con tope) ---
const JUMP_INITIAL_VELOCITY = 480;   // impulso al pulsar (altura del toque mínimo)
const JUMP_HOLD_ACCEL = 3200;        // px/s² extra hacia arriba mientras se mantiene
const JUMP_MAX_HOLD_MS = 240;        // tiempo máx. que el mantener sigue impulsando
const JUMP_MAX_VELOCITY = 860;       // tope de velocidad de subida (límite de altura)

// --- Jugador (placeholder: cuerpo LPC corriendo de lado) ---
const PLAYER_SCALE = 2.1;            // ~2 tiles de alto sobre el suelo. Subir = más grande.
// LPC expandido: la animación RUN está en las filas 38-41 (8 frames). Run-derecha
// = fila 41 = frames 533-540 (≠ WALK derecha, que es 143-150).
const PLAYER_RUN_FRAMES = { start: 533, end: 540 };
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

  private distanceText!: Phaser.GameObjects.Text;
  private starText!: Phaser.GameObjects.Text;
  // Estrellas vivas en el mundo y el siguiente hito (en "número de estrella") aún
  // sin generar. nextStarIndex 1 = primera estrella a STAR_INTERVAL_M metros.
  private stars!: Phaser.Physics.Arcade.Group;
  private nextStarIndex = 1;
  private jumpSub?: Subscription;
  private jumpReleaseSub?: Subscription;
  private parallaxSub?: Subscription;
  private enterMapSub?: Subscription;
  private dismissSub?: Subscription;
  private starsSub?: Subscription;
  private parallax: { ts: Phaser.GameObjects.TileSprite; factor: number }[] = [];
  // scrollX de referencia cuando se (re)construye el parallax: las capas se desplazan
  // respecto a este origen, no al scroll absoluto. Así un set recién cargado arranca
  // alineado (como en la primera entrada) en vez de aparecer descuadrado a media carrera.
  private parallaxBaseX = 0;

  // Estado del salto variable.
  private jumpHeld = false;
  private isJumping = false;
  private jumpHoldMs = 0;

  // Hitos ya disparados en esta carrera (por flag), para no re-evaluarlos cada frame.
  private firedPoints = new Set<string>();

  constructor() {
    super({ key: 'WorldRunScene', active: false });
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
    // El cuerpo del jugador suele estar ya cargado por GameScene; lo aseguramos.
    if (!this.textures.exists('player')) {
      this.load.spritesheet('player', 'assets/sprites/player/character/body/main.png',
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
    this.nextStarIndex = 1;
    this.firedPoints.clear();

    this.physics.world.gravity.y = GRAVITY_Y;
    this.cameras.main.setBackgroundColor('#0a0a14'); // espacio (por si una capa no cubre)

    const h = this.scale.height;
    // El suelo ocupa las últimas GROUND_VISIBLE_ROWS filas de la pantalla.
    this.groundTopY = h - GROUND_BAND_H;

    this.registerAnims();
    // Construye el parallax del set seleccionado y reacciona a cambios en ajustes
    // (emite el valor actual al suscribir, así que esto también lo construye ya).
    this.parallaxSub = this.reg.gameSettings.worldParallax$.subscribe(id => this.switchParallax(id));
    this.buildInitialChunks();
    this.createPlayer();
    this.createStars();
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
    this.jumpSub = this.reg.playerBridge.jumpRequest$.subscribe(() => this.pressJump());
    this.jumpReleaseSub = this.reg.playerBridge.jumpReleaseRequest$.subscribe(() => this.releaseJump());
    // Modal de entrada: "Entrar" viaja al mapa; "Cancelar" reanuda la carrera (la
    // pausamos al mostrar el modal, ver checkUnlockPoints).
    this.enterMapSub = this.reg.playerBridge.enterMapRequest$.subscribe(mapId => this.enterMap(mapId));
    this.dismissSub = this.reg.playerBridge.mapEntranceDismissed$.subscribe(() => this.scene.resume());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.jumpSub?.unsubscribe();
      this.jumpReleaseSub?.unsubscribe();
      this.parallaxSub?.unsubscribe();
      this.enterMapSub?.unsubscribe();
      this.dismissSub?.unsubscribe();
      this.starsSub?.unsubscribe();
      this.reg.playerBridge.setRunMode(false);
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  override update(_time: number, delta: number) {
    if (!this.player.body) return;

    // Auto-run: velocidad X constante (se re-aplica cada frame por si una colisión
    // la anuló). El control manual está anulado: el único input es saltar. El sprint
    // multiplica esta velocidad (pico al inicio, decelerando) mientras esté activo.
    this.player.setVelocityX(RUN_SPEED * this.reg.playerBridge.currentSprintMultiplier());

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround && this.player.body.velocity.y >= 0) this.isJumping = false;
    this.updateJump(delta);
    this.updatePlayerAnim(onGround);

    // (La cámara la mueve startFollow tras la física; aquí solo leemos su scroll.)
    this.updateParallax();
    this.recycleChunks();
    this.updateStars();

    // Metros recorridos (Fase 2 lo llevará al HUD; por ahora texto en pantalla).
    this.distanceM = Math.max(0, Math.floor((this.player.x - this.startX) / PX_PER_METER));
    this.distanceText.setText(`${this.distanceM} m`);

    this.checkUnlockPoints();

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
    const tileScale = cover
      ? Math.max(this.scale.width / WORLD_PARALLAX_SRC_W, this.scale.height / WORLD_PARALLAX_SRC_H)
      : this.scale.height / WORLD_PARALLAX_SRC_H;
    // Offset vertical (en px de textura, igual que tilePositionX): cuánto recortamos.
    const anchorY = set.anchorY ?? 1;
    const tilePosY = (WORLD_PARALLAX_SRC_H - this.scale.height / tileScale) * anchorY;
    set.files.forEach((f, i) => {
      const ts = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, worldParallaxKey(id, f))
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

  /** Letrero "→" de inicio: en la vista inicial, pegado a la derecha y sobre la
   *  hierba, para que se vea en cuanto el jugador arranca a correr. Es un marcador
   *  estático del mundo (no se recicla): la cámara lo deja atrás al avanzar. */
  private createStartSign(): void {
    this.textures.get(TEX_SIGN).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const x = this.scale.width - 64;                 // a la derecha del todo, fully visible
    const y = this.groundTopY + SURFACE_INSET;       // base sobre la línea del suelo
    this.add.image(x, y, TEX_SIGN).setOrigin(0.5, 1).setScale(SIGN_SCALE).setDepth(4);
  }

  /** Cartel "punto de interés" plantado en cada hito (mismo eje que el contador de
   *  metros: startX + distancia). Al alcanzarlo se desbloquea su mapa (ver
   *  checkUnlockPoints). Estáticos: la cámara los deja atrás al avanzar. */
  private createInterestSigns(): void {
    this.textures.get(TEX_INTEREST).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const y = this.groundTopY + SURFACE_INSET;
    for (const pt of RUN_UNLOCK_POINTS) {
      const x = this.startX + pt.distanceM * PX_PER_METER;
      this.add.image(x, y, TEX_INTEREST).setOrigin(0.5, 1).setScale(SIGN_SCALE).setDepth(4);
    }
  }

  /**
   * Hitos por distancia: la PRIMERA vez que se alcanza uno (su mapa aún sin
   * desbloquear) se persiste el flag y se muestra el modal de entrada, pausando la
   * carrera. En carreras posteriores el mapa ya está desbloqueado → sin modal.
   * `firedPoints` evita reevaluar el mismo hito en cada frame dentro de una carrera.
   */
  private checkUnlockPoints(): void {
    for (const pt of RUN_UNLOCK_POINTS) {
      if (this.firedPoints.has(pt.flag) || this.distanceM < pt.distanceM) continue;
      this.firedPoints.add(pt.flag);

      const firstTime = !this.reg.unlocks.isUnlocked(mapFeatureId(pt.mapId));
      this.reg.unlocks.setFlag(pt.flag, 'char');   // persiste el desbloqueo (idempotente)

      if (firstTime) {
        // Primera vez: modal de entrada (pausa la carrera hasta entrar o cancelar).
        this.reg.playerBridge.promptMapEntrance(pt.mapId, !pt.firstEver);
        this.scene.pause();
      } else {
        // Ya desbloqueado: icono de teletransporte arriba-derecha (10 s), sin pausar.
        this.reg.playerBridge.showMapEntranceHint(pt.mapId);
      }
    }
  }

  /** Viaje al mapa desde el modal de entrada: reanuda (estábamos en pausa) para que
   *  el fundido se anime y arranca GameScene en el mapa destino. */
  private enterMap(mapId: string): void {
    this.scene.resume();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.reg.world.setCurrentMap(mapId);
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
   * Genera estrellas por delante de la cámara (una cada STAR_INTERVAL_M metros) y
   * destruye las que ya quedaron atrás. Mundo infinito: solo existen las cercanas.
   */
  private updateStars(): void {
    const scrollX = this.cameras.main.scrollX;
    const spawnUntilX = scrollX + this.scale.width + CHUNK_W;   // un poco más allá del borde derecho
    const groundY = this.groundTopY + SURFACE_INSET;

    while (this.startX + this.nextStarIndex * STAR_INTERVAL_M * PX_PER_METER <= spawnUntilX) {
      const x = this.startX + this.nextStarIndex * STAR_INTERVAL_M * PX_PER_METER;
      // Altura rotada por el índice: cada estrella sale a una altura distinta.
      const height = STAR_HEIGHTS[(this.nextStarIndex - 1) % STAR_HEIGHTS.length];
      const star = this.stars.create(x, groundY - height, STAR_KEYS[0]) as Phaser.Physics.Arcade.Sprite;
      star.setScale(STAR_SCALE).setDepth(4);
      if (this.anims.exists(STAR_ANIM)) star.play(STAR_ANIM);  // solo si cargaron los frames
      this.nextStarIndex++;
    }

    // Limpieza: las que salieron por la izquierda (sin recoger) se eliminan.
    for (const obj of this.stars.getChildren()) {
      const star = obj as Phaser.Physics.Arcade.Sprite;
      if (star.x < scrollX - CHUNK_W) star.destroy();
    }
  }

  /** Recoge una estrella: suma al contador (persistido) y la hace desaparecer. */
  private collectStar(star: Phaser.Physics.Arcade.Sprite): void {
    if (!star.active) return;        // evita doble cobro si dos overlaps caen el mismo frame
    star.disableBody(true, false);   // quita el cuerpo pero deja el sprite para el tween
    this.reg.playerState.collectStars(1);
    this.tweens.add({
      targets: star, y: star.y - 40, alpha: 0, scale: STAR_SCALE * 1.6,
      duration: 250, ease: 'Quad.out', onComplete: () => star.destroy(),
    });
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

    // Contador de estrellas arriba a la derecha (icono + número), como el de monedas.
    // Lee el estado del jugador (persistido); se actualiza al recoger estrellas.
    const margin = 16;
    const icon = this.add.image(this.scale.width - margin, margin + 16, STAR_KEYS[0])
      .setOrigin(1, 0.5).setScale(1.4).setScrollFactor(0).setDepth(100);
    this.starText = this.add.text(icon.x - icon.displayWidth - 8, margin + 16, '0', {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffe066',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100);
    this.starsSub = this.reg.playerState.stars$.subscribe(n => this.starText.setText(`${n}`));

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
