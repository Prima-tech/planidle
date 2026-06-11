import Phaser from 'phaser';
import { Direction } from '../pnj/interfaces/Direction';
import { REGISTRY_KEYS } from './game-registry';
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
}

export const MINIMAP_DATA_KEY = 'minimapData';

// All dimensions in screen pixels — HUD camera runs at zoom=1.
const DEAD     = 12;
const MAX_DRAG = 60;
const BASE_R   = 65;
const THUMB_R  = 26;
const BTN_R    = 38;

// ── Minimap ──────────────────────────────────────────────────────────────────
const MM_MAX_SIZE   = 130;  // lado mayor del minimapa en px de pantalla
const MM_MARGIN     = 10;   // separación del borde derecho
const MM_TOP        = 80;   // bajo la top-bar de Angular (72px)
const MM_DOT_PLAYER = 4;
const MM_DOT_ENEMY  = 3;
const MM_DOT_ELITE  = 4;
const MM_DOT_OBLIV  = 4.5;
const MM_DOT_PORTAL = 3;
const MM_COLOR_PLAYER = 0x2ecc71;
const MM_COLOR_ENEMY  = 0xff4444;
const MM_COLOR_ELITE  = 0xe67e22;  // mismos colores que el panel de mapa
const MM_COLOR_OBLIV  = 0x9b59b6;
const MM_COLOR_PORTAL = 0x48c4f8;

const DIRS_8: Direction[] = [
  Direction.RIGHT, Direction.DOWN_RIGHT, Direction.DOWN, Direction.DOWN_LEFT,
  Direction.LEFT,  Direction.UP_LEFT,    Direction.UP,   Direction.UP_RIGHT,
];
const DIRS_4: Direction[] = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP];

export class MobileHUDScene extends Phaser.Scene {

  // Minimap — la escena se reutiliza entre mapas, así que todo se resetea en create()
  private mmData: MinimapData | null = null;
  private mmX = 0;
  private mmY = 0;
  private mmW = 0;
  private mmH = 0;
  private mmScale = 0;
  private mmPlayerDot: Phaser.GameObjects.Arc | null = null;
  private mmEnemyDots: Phaser.GameObjects.Arc[] = [];

  constructor() { super({ key: 'MobileHUDScene' }); }

  preload(): void {
    this.load.image('atk_icon', 'assets/icon/weapons/icon_32_2_15.png');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Shared input object — GameScene initialises it in the registry before launching this scene
    const input = this.registry.get(MOBILE_INPUT_KEY) as MobileInput;

    this.createMinimap(W);

    // ── Joystick ──────────────────────────────────────────────────────────────
    const jx = 110, jy = H - 130;

    const base = this.add.circle(jx, jy, BASE_R, 0x000000, 0.25) as Phaser.GameObjects.Arc;
    const baseRing = this.add.circle(jx, jy, BASE_R, 0x000000, 0) as Phaser.GameObjects.Arc;
    baseRing.setStrokeStyle(2.5, 0xffffff, 0.40);
    const thumb = this.add.circle(jx, jy, THUMB_R, 0xffffff, 0.65) as Phaser.GameObjects.Arc;

    // ── Attack button ─────────────────────────────────────────────────────────
    const ax = W - 75, ay = H - 125;

    const atkShadow = this.add.circle(ax + 2, ay + 2, BTN_R, 0x000000, 0.50);
    const atkBtn    = this.add.circle(ax, ay, BTN_R, 0x1e3a5f, 0.95);
    const atkInner  = this.add.circle(ax, ay, BTN_R - 8, 0x2a2a3e, 0.80);
    const atkRing   = this.add.circle(ax, ay, BTN_R, 0x000000, 0);
    atkRing.setStrokeStyle(2, 0x3498db, 0.90);
    const atkLabel  = this.add.image(ax, ay, 'atk_icon')
      .setScale(2.1).setAlpha(0.95);

    // ── Joystick visibility ───────────────────────────────────────────────────
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
    let atkId: number | null = null;
    let joySrcX = 0, joySrcY = 0;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const joyEnabled = !gameSettings || gameSettings.showJoystick;
      if (p.x < W * 0.5 && joyId === null && joyEnabled) {
        joyId   = p.id;
        joySrcX = p.x;
        joySrcY = p.y;
        base.setPosition(p.x, p.y);
        baseRing.setPosition(p.x, p.y);
        thumb.setPosition(p.x, p.y);
      } else if (atkId === null && Phaser.Math.Distance.Between(p.x, p.y, ax, ay) <= BTN_R) {
        atkId              = p.id;
        input.isAttackHeld = true;
        atkBtn.setFillStyle(0x1a5a9f, 0.98);
        atkInner.setFillStyle(0x3498db, 0.80);
        this.tweens.killTweensOf([atkBtn, atkRing, atkInner]);
        this.tweens.add({
          targets: [atkBtn, atkRing, atkInner, atkShadow],
          scaleX: 0.85, scaleY: 0.85,
          duration: 70, ease: 'Power2',
        });
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
      if (p.id === atkId) {
        atkId              = null;
        input.isAttackHeld = false;
        atkBtn.setFillStyle(0x1e3a5f, 0.95);
        atkInner.setFillStyle(0x2a2a3e, 0.80);
        this.tweens.killTweensOf([atkBtn, atkRing, atkInner, atkShadow]);
        this.tweens.add({
          targets: [atkBtn, atkRing, atkInner, atkShadow],
          scaleX: 1, scaleY: 1,
          duration: 100, ease: 'Back.easeOut',
        });
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
    this.mmData       = null;
    this.mmPlayerDot  = null;
    this.mmEnemyDots  = [];

    const data = this.registry.get(MINIMAP_DATA_KEY) as MinimapData | undefined;
    if (!data || !data.mapWidthPx || !data.mapHeightPx) return;
    this.mmData = data;

    this.mmScale = Math.min(MM_MAX_SIZE / data.mapWidthPx, MM_MAX_SIZE / data.mapHeightPx);
    this.mmW     = data.mapWidthPx  * this.mmScale;
    this.mmH     = data.mapHeightPx * this.mmScale;
    this.mmX     = screenW - MM_MARGIN - this.mmW;
    this.mmY     = MM_TOP;

    const bg = this.add.rectangle(this.mmX, this.mmY, this.mmW, this.mmH, 0x1a1a2e, 0.55);
    bg.setOrigin(0, 0);
    const ring = this.add.rectangle(this.mmX, this.mmY, this.mmW, this.mmH, 0x000000, 0);
    ring.setOrigin(0, 0);
    ring.setStrokeStyle(1.5, 0x3498db, 0.5);

    // Portales: estáticos, se dibujan una sola vez
    for (const portal of data.portals) {
      this.add.circle(
        this.mmX + Phaser.Math.Clamp(portal.x * this.mmScale, 0, this.mmW),
        this.mmY + Phaser.Math.Clamp(portal.y * this.mmScale, 0, this.mmH),
        MM_DOT_PORTAL, MM_COLOR_PORTAL, 0.9,
      );
    }

    this.mmPlayerDot = this.add.circle(this.mmX, this.mmY, MM_DOT_PLAYER, MM_COLOR_PLAYER, 1);
    this.mmPlayerDot.setStrokeStyle(1, 0xffffff, 0.9);
  }

  private updateMinimap(): void {
    if (!this.mmData || !this.mmPlayerDot) return;

    const playerPos = this.mmData.getPlayerPos();
    this.mmPlayerDot.setPosition(
      this.mmX + Phaser.Math.Clamp(playerPos.x * this.mmScale, 0, this.mmW),
      this.mmY + Phaser.Math.Clamp(playerPos.y * this.mmScale, 0, this.mmH),
    );

    let used = 0;
    for (const enemy of this.mmData.enemies) {
      if (enemy.isDead) continue;
      const dot = this.getEnemyDot(used++);
      const pos = enemy.getPixelPos();
      dot.setPosition(
        this.mmX + Phaser.Math.Clamp(pos.x * this.mmScale, 0, this.mmW),
        this.mmY + Phaser.Math.Clamp(pos.y * this.mmScale, 0, this.mmH),
      );

      const color  = enemy.type.endsWith('_oblivion') ? MM_COLOR_OBLIV
                   : enemy.type.endsWith('_elite')    ? MM_COLOR_ELITE
                   : MM_COLOR_ENEMY;
      const radius = enemy.type.endsWith('_oblivion') ? MM_DOT_OBLIV
                   : enemy.type.endsWith('_elite')    ? MM_DOT_ELITE
                   : MM_DOT_ENEMY;
      // setFillStyle/setRadius regeneran geometría — solo cuando cambia el tier
      if (dot.fillColor !== color) dot.setFillStyle(color, 1);
      if (dot.radius !== radius)   dot.setRadius(radius);
      dot.setVisible(true);
    }
    // Oculta los puntos sobrantes del pool
    for (let i = used; i < this.mmEnemyDots.length; i++) {
      this.mmEnemyDots[i].setVisible(false);
    }
  }

  private getEnemyDot(index: number): Phaser.GameObjects.Arc {
    if (index >= this.mmEnemyDots.length) {
      this.mmEnemyDots.push(this.add.circle(0, 0, MM_DOT_ENEMY, MM_COLOR_ENEMY, 1));
    }
    return this.mmEnemyDots[index];
  }
}
