import Phaser from 'phaser';
import { Direction } from '../pnj/interfaces/Direction';
import { REGISTRY_KEYS } from './game-registry';
import { NATIVE_DPR } from './gamescene/constants';
import { Subscription } from 'rxjs';

export interface MobileInput {
  direction: Direction;
  lastCardinalDir: Direction;
  isAttackHeld: boolean;
}

export const MOBILE_INPUT_KEY = 'mobileInput';

// Datos que GameScene publica para el minimapa. Tipado estructural para no
// importar Enemy aquí (evita el ciclo enemy → gamescene → mobile-hud).
export interface MinimapEnemy {
  isDead: boolean;
  type: string;
  getPixelPos(): Phaser.Math.Vector2;
}

/** Terreno downsampleado: un color (0xRRGGBB) por tile; data[i]===0 → tile vacío.
 *  GameScene lo calcula muestreando el color medio de cada tile del tileset. */
export interface MinimapTerrain {
  cols: number;
  rows: number;
  data: Uint32Array;   // length = cols*rows; 0 = vacío, si no 0xFF000000|rgb
}

export interface MinimapData {
  enemies: MinimapEnemy[];          // referencia viva al array de GameScene
  getPlayerPos: () => Phaser.Math.Vector2;
  mapWidthPx: number;
  mapHeightPx: number;
  terrain?: MinimapTerrain;         // mapa de colores del suelo (opcional)
  portals: { x: number; y: number }[];  // posiciones en px de mundo
  townChest?: { x: number; y: number }; // cofre de ciudad fijo (solo en hogar)
  // Construcciones colocadas (cofre/tienda); referencia viva, cambian al construir/mover/borrar
  getBuildings?: () => { x: number; y: number; kind: string }[];
  // Recursos recolectables (rocas/árboles); referencia viva, desaparecen al destruirse
  getNodes?: () => { x: number; y: number; kind: string }[];
}

export const MINIMAP_DATA_KEY = 'minimapData';

// Medidas en px CSS de pantalla × NATIVE_DPR: el canvas corre a resolución
// nativa y se reduce con zoom CSS, así que en pantalla miden lo de siempre.
// El botón de ataque ya no vive aquí: es HTML (AttackButtonComponent).
const DPR      = NATIVE_DPR;
const DEAD     = 12 * DPR;
const MAX_DRAG = 60 * DPR;
const BASE_R   = 65 * DPR;
const THUMB_R  = 26 * DPR;

// ── Minimap ──────────────────────────────────────────────────────────────────
const MM_RADIUS     = 49 * DPR;   // radio del minimapa circular (px CSS × DPR)
const MM_MARGIN     = 15 * DPR;   // separación del borde derecho (aro HTML a 10px + 5px de bisel)
const MM_TOP        = 15 * DPR;   // separación del borde superior (aro HTML a 10px + 5px de bisel)
const MM_DOT_PORTAL    = 3   * DPR;
const MM_DOT_CHEST     = 4.5 * DPR;
const MM_COLOR_PORTAL  = 0x48c4f8;
const MM_COLOR_CHEST   = 0xf1c40f;
const MM_COLOR_SHOP    = 0x2ecc71;
const MM_DOT_NODE      = 3.5 * DPR;   // recursos recolectables (rocas/árboles)
const MM_COLOR_ROCK    = 0x9a9a9a;
const MM_COLOR_TREE    = 0x3c8c3c;
const MM_ICON_ENEMY_KEY = 'mm_enemy';
const MM_ICON_ELITE_KEY = 'mm_enemy_elite';
const MM_ICON_PLAYER_KEY = 'mm_player';
const MM_ICON_HALF_PLAYER = 7 * DPR;      // medio tamaño del icono del jugador
const MM_TERRAIN_TEX    = 'mm_terrain';   // CanvasTexture del suelo coloreado (se regenera por mapa)
const MM_ICON_HALF      = 8   * DPR;   // half-size regular
const MM_ICON_HALF_EL   = 10  * DPR;   // half-size elite / oblivion

const DIRS_8: Direction[] = [
  Direction.RIGHT, Direction.DOWN_RIGHT, Direction.DOWN, Direction.DOWN_LEFT,
  Direction.LEFT,  Direction.UP_LEFT,    Direction.UP,   Direction.UP_RIGHT,
];
const DIRS_4: Direction[] = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP];

export class MobileHUDScene extends Phaser.Scene {

  // Minimap — la escena se reutiliza entre mapas, así que todo se resetea en create()
  private mmData: MinimapData | null = null;
  private mmCX = 0;       // centro del círculo en pantalla
  private mmCY = 0;
  private mmOffX = 0;     // origen del mapa proyectado (centrado en el círculo)
  private mmOffY = 0;
  private mmScale = 0;
  private mmPlayerDot:  Phaser.GameObjects.Image | null = null;
  private mmEnemyIcons: Phaser.GameObjects.Image[] = [];
  private mmBuildingDots: Phaser.GameObjects.Arc[] = [];
  private mmNodeDots: Phaser.GameObjects.Arc[] = [];
  private mmTerrain: Phaser.GameObjects.Image | null = null;       // imagen del suelo coloreado
  private mmTerrainMask: Phaser.GameObjects.Graphics | null = null; // máscara circular del terreno
  private mmAccum = 0;   // acumulador para throttlear el redibujado del minimapa

  // ── Overlay de rendimiento (toggle en ajustes: showFps) ─────────────────────
  private fpsText: Phaser.GameObjects.Text | null = null;
  private fpsSub: Subscription | null = null;
  private fpsAccum  = 0;   // ms acumulados desde el último refresco del texto
  private fpsFrames = 0;   // frames contados en esa ventana
  private fpsWorst  = 0;   // peor frame (delta máx) en la ventana actual
  private spikeHold  = 0;  // peor frame retenido (ms) — mantiene el tirón visible
  private spikeHoldT = 0;  // tiempo restante (ms) reteniendo ese peor frame
  private drawsMax   = 0;  // pico de draw calls en la ventana actual
  private hasDrawCounter = false;
  private logicMax   = 0;  // pico de tiempo de lógica (GameScene.update) en la ventana
  private renderMax  = 0;  // pico de tiempo de CPU de render (emisión del batch) en la ventana

  constructor() { super({ key: 'MobileHUDScene' }); }

  preload(): void {
    this.load.image(MM_ICON_ENEMY_KEY, 'assets/icon/minimap/enemy.png');
    this.load.image(MM_ICON_ELITE_KEY, 'assets/icon/minimap/enemy_elite.png');
    this.load.image(MM_ICON_PLAYER_KEY, 'assets/icon/minimap/player.png');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Shared input object — GameScene initialises it in the registry before launching this scene
    const input = this.registry.get(MOBILE_INPUT_KEY) as MobileInput;

    this.createMinimap(W);
    this.createFpsOverlay();

    // ── Joystick ──────────────────────────────────────────────────────────────
    const jx = 110 * DPR, jy = H - 130 * DPR;

    const base = this.add.circle(jx, jy, BASE_R, 0x000000, 0.25) as Phaser.GameObjects.Arc;
    const baseRing = this.add.circle(jx, jy, BASE_R, 0x000000, 0) as Phaser.GameObjects.Arc;
    baseRing.setStrokeStyle(2.5 * DPR, 0xffffff, 0.40);
    const thumb = this.add.circle(jx, jy, THUMB_R, 0xffffff, 0.65) as Phaser.GameObjects.Arc;

    // ── Joystick visibility ───────────────────────────────────────────────────
    // El toggle de ajustes solo oculta los gráficos: la entrada táctil en la
    // mitad izquierda sigue funcionando igual con el joystick invisible.
    const joystickElements = [base, baseRing, thumb];
    const gameSettings = this.game.registry.get(REGISTRY_KEYS.GAME_SETTINGS);
    let joystickSub: Subscription | null = null;

    if (gameSettings) {
      const setJoyVisible = (v: boolean) => joystickElements.forEach(e => e.setVisible(v));
      setJoyVisible(gameSettings.showJoystick);
      joystickSub = gameSettings.showJoystick$.subscribe((v: boolean) => setJoyVisible(v));
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => joystickSub?.unsubscribe());

    // ── Pointer tracking ──────────────────────────────────────────────────────
    let joyId: number | null = null;
    let joySrcX = 0, joySrcY = 0;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < W * 0.5 && joyId === null) {
        joyId   = p.id;
        joySrcX = p.x;
        joySrcY = p.y;
        base.setPosition(p.x, p.y);
        baseRing.setPosition(p.x, p.y);
        thumb.setPosition(p.x, p.y);
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== joyId) return;
      const dx   = p.x - joySrcX;
      const dy   = p.y - joySrcY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const clamp = Math.min(dist, MAX_DRAG);
        thumb.setPosition(
          joySrcX + (dx / dist) * clamp,
          joySrcY + (dy / dist) * clamp,
        );
      }

      if (dist < DEAD) { input.direction = Direction.NONE; return; }
      const deg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      input.direction       = DIRS_8[Math.round(deg / 45) % 8];
      input.lastCardinalDir = DIRS_4[Math.round(deg / 90) % 4];
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === joyId) {
        joyId           = null;
        input.direction = Direction.NONE;
        thumb.setPosition(base.x, base.y);
      }
    });
  }

  override update(_time: number, delta: number): void {
    this.updateFps(delta);

    // El minimapa corría a 120 fps (recorriendo enemigos/edificios/nodos y
    // reposicionando objetos cada frame). Un radar no necesita tanto: ~20 Hz basta
    // y libera CPU del hilo principal (clave cuando el móvil throttlea sin cable).
    this.mmAccum += delta;
    if (this.mmAccum < 50) return;
    this.mmAccum = 0;
    this.updateMinimap();
  }

  // ── Overlay de rendimiento ────────────────────────────────────────────────────

  private createFpsOverlay(): void {
    // Reset (la escena se relanza en cada cambio de mapa)
    this.fpsAccum = this.fpsFrames = this.fpsWorst = 0;
    this.spikeHold = this.spikeHoldT = this.drawsMax = this.logicMax = this.renderMax = 0;
    this.setupDrawCounter();

    // Abajo a la izquierda, justo encima del footer (~51px CSS). Origen inferior
    // (0,1) → la y marca la BASE del texto, así crece hacia arriba sin tapar el footer.
    const FOOTER_H = 51 * DPR;
    this.fpsText = this.add.text(8 * DPR, this.scale.height - FOOTER_H - 8 * DPR, '', {
      fontFamily: 'monospace',
      fontSize: `${10 * DPR}px`,
      color: '#9effa0',
      backgroundColor: 'rgba(0,0,0,0.55)',
      padding: { x: 4 * DPR, y: 3 * DPR },
      lineSpacing: 2 * DPR,
    });
    this.fpsText.setOrigin(0, 1);
    this.fpsText.setScrollFactor(0);
    this.fpsText.setDepth(10000);

    const gameSettings = this.game.registry.get(REGISTRY_KEYS.GAME_SETTINGS);
    if (gameSettings) {
      this.fpsText.setVisible(gameSettings.showFps);
      this.fpsSub = gameSettings.showFps$.subscribe((v: boolean) => this.fpsText?.setVisible(v));
    } else {
      this.fpsText.setVisible(false);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.fpsSub?.unsubscribe());
  }

  // Cuenta draw calls reales envolviendo el contexto WebGL. Phaser no expone esta
  // métrica, pero es la que mejor explica el lag por GPU en móvil (fillrate/batching).
  // Se engancha una sola vez (gl persiste toda la vida del juego, aunque la escena
  // se relance por cambio de mapa), por eso el guard __dcWrapped.
  private setupDrawCounter(): void {
    const r  = this.game.renderer as any;
    const gl = r.gl;
    if (!gl) { this.hasDrawCounter = false; return; }
    this.hasDrawCounter = true;
    if (gl.__dcWrapped) return;
    gl.__dcWrapped = true;
    r.__drawCalls = 0;
    r.__drawCallsLast = 0;

    const elements = gl.drawElements.bind(gl);
    gl.drawElements = function (...a: any[]) { r.__drawCalls++; return elements(...a); };
    const arrays = gl.drawArrays.bind(gl);
    gl.drawArrays = function (...a: any[]) { r.__drawCalls++; return arrays(...a); };

    // PRE_RENDER: marca de inicio del render (CPU que tarda Phaser en emitir el batch)
    this.game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
      r.__renderT0 = performance.now();
    });
    // POST_RENDER: draws del frame + tiempo de CPU de render (NO incluye la GPU async)
    this.game.events.on(Phaser.Core.Events.POST_RENDER, () => {
      r.__drawCallsLast = r.__drawCalls;
      r.__drawCalls = 0;
      r.__renderMs = performance.now() - (r.__renderT0 || performance.now());
    });
  }

  private updateFps(delta: number): void {
    if (!this.fpsText || !this.fpsText.visible) return;

    this.fpsAccum += delta;
    this.fpsFrames++;
    if (delta > this.fpsWorst) this.fpsWorst = delta;

    const draws = this.hasDrawCounter ? ((this.game.renderer as any).__drawCallsLast || 0) : 0;
    if (draws > this.drawsMax) this.drawsMax = draws;

    const logic = (this.game as any).__logicMs || 0;
    if (logic > this.logicMax) this.logicMax = logic;

    const render = (this.game.renderer as any).__renderMs || 0;
    if (render > this.renderMax) this.renderMax = render;

    if (this.fpsAccum < 500) return;   // refrescar el texto ~2 veces/seg

    const avgFps  = Math.round((this.fpsFrames * 1000) / this.fpsAccum);
    const worstMs = this.fpsWorst;
    const minFps  = Math.round(1000 / worstMs);

    // Retiene el peor frame ~3s para que un tirón puntual no desaparezca al instante
    this.spikeHoldT -= this.fpsAccum;
    if (worstMs >= this.spikeHold || this.spikeHoldT <= 0) {
      this.spikeHold  = worstMs;
      this.spikeHoldT = 3000;
    }

    const enemies = this.mmData ? this.mmData.enemies.filter(e => !e.isDead).length : 0;

    let heap = '';
    const mem = (performance as any).memory;
    if (mem) heap = `  heap ${Math.round(mem.usedJSHeapSize / 1048576)}MB`;

    const drawsLine = this.hasDrawCounter
      ? `draws ${draws}  (pico ${this.drawsMax})\n`
      : 'render Canvas (sin WebGL!)\n';

    this.fpsText.setText(
      `FPS ${avgFps}   min ${minFps}\n` +
      `worst ${worstMs.toFixed(0)}ms  (3s ${this.spikeHold.toFixed(0)}ms)\n` +
      `logic ${logic.toFixed(1)}ms  (pico ${this.logicMax.toFixed(1)})\n` +
      `render ${render.toFixed(1)}ms  (pico ${this.renderMax.toFixed(1)})\n` +
      drawsLine +
      `enemigos ${enemies}${heap}`,
    );
    // Verde si todo fluido; rojo si hubo un frame > 22ms (< ~45fps) en los últimos 3s,
    // o si cayó a Canvas (sin GL es lag asegurado en móvil)
    this.fpsText.setColor(this.spikeHold > 22 || !this.hasDrawCounter ? '#ff5555' : '#9effa0');

    this.fpsAccum  = 0;
    this.fpsFrames = 0;
    this.fpsWorst  = 0;
    this.drawsMax  = 0;
    this.logicMax  = 0;
    this.renderMax = 0;
  }

  // ── Minimap ─────────────────────────────────────────────────────────────────

  private createMinimap(screenW: number): void {
    // Reset: la escena se relanza en cada cambio de mapa y los GameObjects
    // anteriores ya fueron destruidos en el shutdown.
    this.mmData         = null;
    this.mmPlayerDot    = null;
    this.mmEnemyIcons   = [];
    this.mmBuildingDots = [];
    this.mmNodeDots     = [];
    // La máscara no vive en la display list → no se destruye sola en el relanzamiento.
    this.mmTerrainMask?.destroy();
    this.mmTerrain      = null;
    this.mmTerrainMask  = null;

    const data = this.registry.get(MINIMAP_DATA_KEY) as MinimapData | undefined;
    if (!data || !data.mapWidthPx || !data.mapHeightPx) return;
    this.mmData = data;

    this.mmCX    = screenW - MM_MARGIN - MM_RADIUS;
    this.mmCY    = MM_TOP + MM_RADIUS;
    this.mmScale = (MM_RADIUS * 2) / Math.max(data.mapWidthPx, data.mapHeightPx);
    this.mmOffX  = this.mmCX - (data.mapWidthPx  * this.mmScale) / 2;
    this.mmOffY  = this.mmCY - (data.mapHeightPx * this.mmScale) / 2;

    // Suelo coloreado (verde hierba, azul agua…). Si hay terreno, el fondo oscuro
    // se vuelve transparente para que se vea; si no, mantiene el relleno de siempre.
    const hasTerrain = data.terrain ? this.renderTerrain(data.terrain) : false;

    const bg = this.add.circle(this.mmCX, this.mmCY, MM_RADIUS, 0x1a1a2e, hasTerrain ? 0 : 0.55);
    bg.setStrokeStyle(1.5 * DPR, 0x3498db, 0.5);

    // Portales: estáticos, se dibujan una sola vez
    for (const portal of data.portals) {
      const dot = this.add.circle(0, 0, MM_DOT_PORTAL, MM_COLOR_PORTAL, 0.9);
      this.mmPlace(dot, portal.x, portal.y);
    }

    // Cofre de ciudad (solo en hogar): estático
    if (data.townChest) {
      const dot = this.add.circle(0, 0, MM_DOT_CHEST, MM_COLOR_CHEST, 1);
      dot.setStrokeStyle(1 * DPR, 0xffffff, 0.6);
      this.mmPlace(dot, data.townChest.x, data.townChest.y);
    }

    this.mmPlayerDot = this.add.image(this.mmCX, this.mmCY, MM_ICON_PLAYER_KEY);
    this.mmPlayerDot.setDisplaySize(MM_ICON_HALF_PLAYER * 2, MM_ICON_HALF_PLAYER * 2);
  }

  /** Pinta el suelo coloreado dentro del círculo. Genera una CanvasTexture de
   *  cols×rows px (1 px por tile) y la escala al tamaño del mapa proyectado,
   *  recortada al círculo del minimapa. Devuelve false si no se pudo crear. */
  private renderTerrain(t: MinimapTerrain): boolean {
    if (!t.cols || !t.rows || t.data.length < t.cols * t.rows) return false;

    if (this.textures.exists(MM_TERRAIN_TEX)) this.textures.remove(MM_TERRAIN_TEX);
    const tex = this.textures.createCanvas(MM_TERRAIN_TEX, t.cols, t.rows);
    if (!tex) return false;

    const ctx = tex.context;
    const img = ctx.createImageData(t.cols, t.rows);
    const px = img.data;
    for (let i = 0; i < t.cols * t.rows; i++) {
      const v = t.data[i];
      const o = i * 4;
      if (v === 0) { px[o + 3] = 0; continue; }   // tile vacío → transparente
      px[o]     = (v >> 16) & 0xff;
      px[o + 1] = (v >> 8)  & 0xff;
      px[o + 2] =  v        & 0xff;
      px[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();

    const dispW = this.mmData!.mapWidthPx  * this.mmScale;
    const dispH = this.mmData!.mapHeightPx * this.mmScale;
    const im = this.add.image(this.mmCX, this.mmCY, MM_TERRAIN_TEX);
    im.setDisplaySize(dispW, dispH);

    // Máscara circular: el suelo no se sale del aro del minimapa.
    const mask = this.make.graphics({});
    mask.fillStyle(0xffffff);
    mask.fillCircle(this.mmCX, this.mmCY, MM_RADIUS - 1 * DPR);
    im.setMask(mask.createGeometryMask());

    this.mmTerrain = im;
    this.mmTerrainMask = mask;
    return true;
  }

  // Proyecta px de mundo al minimapa y retiene el punto dentro del círculo
  // (lo que queda fuera se pega al borde, estilo radar)
  private mmPlace(dot: Phaser.GameObjects.Arc, worldX: number, worldY: number): void {
    let dx = this.mmOffX + worldX * this.mmScale - this.mmCX;
    let dy = this.mmOffY + worldY * this.mmScale - this.mmCY;
    const maxR = MM_RADIUS - dot.radius - 2 * DPR;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxR) {
      dx = (dx / d) * maxR;
      dy = (dy / d) * maxR;
    }
    dot.setPosition(this.mmCX + dx, this.mmCY + dy);
  }

  private updateMinimap(): void {
    if (!this.mmData || !this.mmPlayerDot) return;

    const playerPos = this.mmData.getPlayerPos();
    this.mmPlaceImg(this.mmPlayerDot, MM_ICON_HALF_PLAYER, playerPos.x, playerPos.y);

    let used = 0;
    for (const enemy of this.mmData.enemies) {
      if (enemy.isDead) continue;
      const isElite = enemy.type.endsWith('_elite') || enemy.type.endsWith('_oblivion');
      const texKey  = isElite ? MM_ICON_ELITE_KEY : MM_ICON_ENEMY_KEY;
      const half    = isElite ? MM_ICON_HALF_EL   : MM_ICON_HALF;

      const img = this.getEnemyIcon(used++);
      if (img.texture.key !== texKey) img.setTexture(texKey);
      const sz = half * 2;
      if (img.displayWidth !== sz) img.setDisplaySize(sz, sz);

      const pos = enemy.getPixelPos();
      this.mmPlaceImg(img, half, pos.x, pos.y);
      img.setVisible(true);
    }
    for (let i = used; i < this.mmEnemyIcons.length; i++) {
      this.mmEnemyIcons[i].setVisible(false);
    }

    // Construcciones colocadas (cofre/tienda): dinámicas (aparecen/cambian al construir)
    const buildings = this.mmData.getBuildings?.() ?? [];
    let bUsed = 0;
    for (const b of buildings) {
      const dot = this.getBuildingDot(bUsed++);
      dot.setFillStyle(b.kind === 'shop' ? MM_COLOR_SHOP : MM_COLOR_CHEST, 1);
      this.mmPlace(dot, b.x, b.y);
      dot.setVisible(true);
    }
    for (let i = bUsed; i < this.mmBuildingDots.length; i++) {
      this.mmBuildingDots[i].setVisible(false);
    }

    // Recursos recolectables (rocas/árboles): dinámicos (desaparecen al destruirse)
    const nodes = this.mmData.getNodes?.() ?? [];
    let nUsed = 0;
    for (const n of nodes) {
      const dot = this.getNodeDot(nUsed++);
      dot.setFillStyle(n.kind === 'tree' ? MM_COLOR_TREE : MM_COLOR_ROCK, 1);
      this.mmPlace(dot, n.x, n.y);
      dot.setVisible(true);
    }
    for (let i = nUsed; i < this.mmNodeDots.length; i++) {
      this.mmNodeDots[i].setVisible(false);
    }
  }

  private getNodeDot(index: number): Phaser.GameObjects.Arc {
    if (index >= this.mmNodeDots.length) {
      const dot = this.add.circle(0, 0, MM_DOT_NODE, MM_COLOR_ROCK, 1);
      this.mmNodeDots.push(dot);
    }
    return this.mmNodeDots[index];
  }

  private getBuildingDot(index: number): Phaser.GameObjects.Arc {
    if (index >= this.mmBuildingDots.length) {
      const dot = this.add.circle(0, 0, MM_DOT_CHEST, MM_COLOR_CHEST, 1);
      dot.setStrokeStyle(1 * DPR, 0xffffff, 0.6);
      this.mmBuildingDots.push(dot);
    }
    return this.mmBuildingDots[index];
  }

  private getEnemyIcon(index: number): Phaser.GameObjects.Image {
    if (index >= this.mmEnemyIcons.length) {
      const img = this.add.image(0, 0, MM_ICON_ENEMY_KEY);
      img.setDisplaySize(MM_ICON_HALF * 2, MM_ICON_HALF * 2);
      this.mmEnemyIcons.push(img);
    }
    return this.mmEnemyIcons[index];
  }

  private mmPlaceImg(img: Phaser.GameObjects.Image, half: number, worldX: number, worldY: number): void {
    let dx = this.mmOffX + worldX * this.mmScale - this.mmCX;
    let dy = this.mmOffY + worldY * this.mmScale - this.mmCY;
    const maxR = MM_RADIUS - half - 2 * DPR;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxR) { dx = (dx / d) * maxR; dy = (dy / d) * maxR; }
    img.setPosition(this.mmCX + dx, this.mmCY + dy);
  }
}
