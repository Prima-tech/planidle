import Phaser from 'phaser';
import { Direction } from '../pnj/interfaces/Direction';

// All radius/size constants are in SCREEN pixels.
// Objects use setScrollFactor(0) so positions are in world units — convert with w().
const DEAD_ZONE     = 12;
const MAX_DRAG      = 60;
const BASE_R        = 65;
const THUMB_R       = 26;
const BTN_R         = 50;

const DIRS_8: Direction[] = [
  Direction.RIGHT, Direction.DOWN_RIGHT, Direction.DOWN, Direction.DOWN_LEFT,
  Direction.LEFT,  Direction.UP_LEFT,    Direction.UP,   Direction.UP_RIGHT,
];
const DIRS_4: Direction[] = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP];

export class MobileControls {
  direction: Direction       = Direction.NONE;
  lastCardinalDir: Direction = Direction.DOWN;
  isAttackHeld               = false;

  private readonly zoom: number;
  private readonly W: number;
  private readonly H: number;

  private joyId: number | null = null;
  private atkId: number | null = null;
  private joySrcX = 0;
  private joySrcY = 0;

  private base:        Phaser.GameObjects.Arc;
  private baseRing:    Phaser.GameObjects.Arc;
  private thumb:       Phaser.GameObjects.Arc;
  private atkBtn:      Phaser.GameObjects.Arc;
  private atkRing:     Phaser.GameObjects.Arc;
  private atkLabel:    Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.zoom = scene.cameras.main.zoom;
    this.W    = scene.scale.width;
    this.H    = scene.scale.height;
    this.buildUI();
    this.bindPointers();
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup',   this.onUp,   this);
    [this.base, this.baseRing, this.thumb,
     this.atkBtn, this.atkRing, this.atkLabel].forEach(o => o?.destroy());
  }

  // ── Private ────────────────────────────────────────────────────────────────

  // Screen pixels → world units for setScrollFactor(0) objects with this zoom.
  private w(px: number): number { return px / this.zoom; }

  private buildUI(): void {
    const { W, H } = this;

    // Joystick — appears at bottom-left
    const jx = this.w(110);
    const jy = this.w(H - 130);
    const bR = this.w(BASE_R);
    const tR = this.w(THUMB_R);

    this.base = this.scene.add
      .circle(jx, jy, bR, 0x000000, 0.25)
      .setScrollFactor(0).setDepth(200) as Phaser.GameObjects.Arc;

    this.baseRing = this.scene.add
      .circle(jx, jy, bR, 0x000000, 0)
      .setScrollFactor(0).setDepth(200) as Phaser.GameObjects.Arc;
    this.baseRing.setStrokeStyle(this.w(2.5), 0xffffff, 0.40);

    this.thumb = this.scene.add
      .circle(jx, jy, tR, 0xffffff, 0.65)
      .setScrollFactor(0).setDepth(201) as Phaser.GameObjects.Arc;

    // Attack button — fixed at bottom-right
    const ax = this.w(W - 90);
    const ay = this.w(H - 115);
    const btnR = this.w(BTN_R);

    this.atkBtn = this.scene.add
      .circle(ax, ay, btnR, 0xaa1111, 0.72)
      .setScrollFactor(0).setDepth(200) as Phaser.GameObjects.Arc;

    this.atkRing = this.scene.add
      .circle(ax, ay, btnR, 0x000000, 0)
      .setScrollFactor(0).setDepth(200) as Phaser.GameObjects.Arc;
    this.atkRing.setStrokeStyle(this.w(2.5), 0xff5555, 0.55);

    this.atkLabel = this.scene.add
      .text(ax, ay, '⚔', { fontSize: `${this.w(28)}px`, color: '#ffffff' })
      .setScrollFactor(0).setDepth(201).setOrigin(0.5).setAlpha(0.90);
  }

  private bindPointers(): void {
    this.scene.input.on('pointerdown', this.onDown, this);
    this.scene.input.on('pointermove', this.onMove, this);
    this.scene.input.on('pointerup',   this.onUp,   this);
  }

  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    if (p.x < this.W * 0.5 && this.joyId === null) {
      this.joyId   = p.id;
      this.joySrcX = p.x;
      this.joySrcY = p.y;
      this.base.setPosition(this.w(p.x), this.w(p.y));
      this.baseRing.setPosition(this.w(p.x), this.w(p.y));
      this.thumb.setPosition(this.w(p.x), this.w(p.y));
    } else if (p.x >= this.W * 0.5 && this.atkId === null) {
      this.atkId        = p.id;
      this.isAttackHeld = true;
      this.atkBtn.setFillStyle(0xdd2222, 0.92);
      this.scene.tweens.killTweensOf(this.atkBtn);
      this.scene.tweens.killTweensOf(this.atkLabel);
      this.scene.tweens.add({
        targets: [this.atkBtn, this.atkRing, this.atkLabel],
        scaleX: 0.88, scaleY: 0.88,
        duration: 70, ease: 'Power2',
      });
    }
  };

  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (p.id !== this.joyId) return;
    const dx   = p.x - this.joySrcX;
    const dy   = p.y - this.joySrcY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const nx    = dx / dist;
      const ny    = dy / dist;
      const clamp = Math.min(dist, MAX_DRAG);
      this.thumb.setPosition(
        this.w(this.joySrcX + nx * clamp),
        this.w(this.joySrcY + ny * clamp),
      );
    }
    this.calcDirection(dx, dy, dist);
  };

  private readonly onUp = (p: Phaser.Input.Pointer): void => {
    if (p.id === this.joyId) {
      this.joyId     = null;
      this.direction = Direction.NONE;
      this.thumb.setPosition(this.base.x, this.base.y);
    }
    if (p.id === this.atkId) {
      this.atkId        = null;
      this.isAttackHeld = false;
      this.atkBtn.setFillStyle(0xaa1111, 0.72);
      this.scene.tweens.killTweensOf(this.atkBtn);
      this.scene.tweens.killTweensOf(this.atkLabel);
      this.scene.tweens.add({
        targets: [this.atkBtn, this.atkRing, this.atkLabel],
        scaleX: 1, scaleY: 1,
        duration: 100, ease: 'Back.easeOut',
      });
    }
  };

  private calcDirection(dx: number, dy: number, dist: number): void {
    if (dist < DEAD_ZONE) { this.direction = Direction.NONE; return; }
    const deg     = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
    this.direction      = DIRS_8[Math.round(deg / 45) % 8];
    this.lastCardinalDir = DIRS_4[Math.round(deg / 90) % 4];
  }
}
