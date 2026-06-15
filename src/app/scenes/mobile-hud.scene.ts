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

export interface MinimapData {
  enemies: MinimapEnemy[];          // referencia viva al array de GameScene
  getPlayerPos: () => Phaser.Math.Vector2;
  mapWidthPx: number;
  mapHeightPx: number;
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
const MM_DOT_PLAYER    = 4   * DPR;
const MM_DOT_PORTAL    = 3   * DPR;
const MM_DOT_CHEST     = 4.5 * DPR;
const MM_COLOR_PLAYER  = 0x2ecc71;
const MM_COLOR_PORTAL  = 0x48c4f8;
const MM_COLOR_CHEST   = 0xf1c40f;
const MM_COLOR_SHOP    = 0x2ecc71;
const MM_DOT_NODE      = 3.5 * DPR;   // recursos recolectables (rocas/árboles)
const MM_COLOR_ROCK    = 0x9a9a9a;
const MM_COLOR_TREE    = 0x3c8c3c;
const MM_ICON_ENEMY_KEY = 'mm_enemy';
const MM_ICON_ELITE_KEY = 'mm_enemy_elite';
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
  private mmPlayerDot:  Phaser.GameObjects.Arc   | null = null;
  private mmEnemyIcons: Phaser.GameObjects.Image[] = [];
  private mmBuildingDots: Phaser.GameObjects.Arc[] = [];
  private mmNodeDots: Phaser.GameObjects.Arc[] = [];

  constructor() { super({ key: 'MobileHUDScene' }); }

  preload(): void {
    this.load.image(MM_ICON_ENEMY_KEY, 'assets/sprites/map/enemy.png');
    this.load.image(MM_ICON_ELITE_KEY, 'assets/sprites/map/enemy_elite.png');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Shared input object — GameScene initialises it in the registry before launching this scene
    const input = this.registry.get(MOBILE_INPUT_KEY) as MobileInput;

    this.createMinimap(W);

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

  override update(): void {
    this.updateMinimap();
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

    const data = this.registry.get(MINIMAP_DATA_KEY) as MinimapData | undefined;
    if (!data || !data.mapWidthPx || !data.mapHeightPx) return;
    this.mmData = data;

    this.mmCX    = screenW - MM_MARGIN - MM_RADIUS;
    this.mmCY    = MM_TOP + MM_RADIUS;
    this.mmScale = (MM_RADIUS * 2) / Math.max(data.mapWidthPx, data.mapHeightPx);
    this.mmOffX  = this.mmCX - (data.mapWidthPx  * this.mmScale) / 2;
    this.mmOffY  = this.mmCY - (data.mapHeightPx * this.mmScale) / 2;

    const bg = this.add.circle(this.mmCX, this.mmCY, MM_RADIUS, 0x1a1a2e, 0.55);
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

    this.mmPlayerDot = this.add.circle(this.mmCX, this.mmCY, MM_DOT_PLAYER, MM_COLOR_PLAYER, 1);
    this.mmPlayerDot.setStrokeStyle(1 * DPR, 0xffffff, 0.9);
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
    this.mmPlace(this.mmPlayerDot, playerPos.x, playerPos.y);

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
