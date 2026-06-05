import Phaser from 'phaser';
import { Direction } from '../pnj/interfaces/Direction';

export interface MobileInput {
  direction: Direction;
  lastCardinalDir: Direction;
  isAttackHeld: boolean;
}

export const MOBILE_INPUT_KEY = 'mobileInput';

// All dimensions in screen pixels — HUD camera runs at zoom=1.
const DEAD     = 12;
const MAX_DRAG = 60;
const BASE_R   = 65;
const THUMB_R  = 26;
const BTN_R    = 38;

const DIRS_8: Direction[] = [
  Direction.RIGHT, Direction.DOWN_RIGHT, Direction.DOWN, Direction.DOWN_LEFT,
  Direction.LEFT,  Direction.UP_LEFT,    Direction.UP,   Direction.UP_RIGHT,
];
const DIRS_4: Direction[] = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP];

export class MobileHUDScene extends Phaser.Scene {

  constructor() { super({ key: 'MobileHUDScene' }); }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Shared input object — GameScene initialises it in the registry before launching this scene
    const input = this.registry.get(MOBILE_INPUT_KEY) as MobileInput;

    // ── Joystick ──────────────────────────────────────────────────────────────
    const jx = 110, jy = H - 130;

    const base = this.add.circle(jx, jy, BASE_R, 0x000000, 0.25) as Phaser.GameObjects.Arc;
    const baseRing = this.add.circle(jx, jy, BASE_R, 0x000000, 0) as Phaser.GameObjects.Arc;
    baseRing.setStrokeStyle(2.5, 0xffffff, 0.40);
    const thumb = this.add.circle(jx, jy, THUMB_R, 0xffffff, 0.65) as Phaser.GameObjects.Arc;

    // ── Attack button ─────────────────────────────────────────────────────────
    const ax = W - 75, ay = H - 105;

    const atkShadow = this.add.circle(ax + 2, ay + 2, BTN_R, 0x000000, 0.45);
    const atkBtn    = this.add.circle(ax, ay, BTN_R, 0x8b0000, 0.90);
    const atkInner  = this.add.circle(ax, ay, BTN_R - 8, 0xcc1111, 0.60);
    const atkRing   = this.add.circle(ax, ay, BTN_R, 0x000000, 0);
    atkRing.setStrokeStyle(2, 0xff6666, 0.80);
    const atkLabel  = this.add.text(ax, ay, '⚔', { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.95);

    // ── Pointer tracking ──────────────────────────────────────────────────────
    let joyId: number | null = null;
    let atkId: number | null = null;
    let joySrcX = 0, joySrcY = 0;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < W * 0.5 && joyId === null) {
        joyId   = p.id;
        joySrcX = p.x;
        joySrcY = p.y;
        base.setPosition(p.x, p.y);
        baseRing.setPosition(p.x, p.y);
        thumb.setPosition(p.x, p.y);
      } else if (atkId === null && Phaser.Math.Distance.Between(p.x, p.y, ax, ay) <= BTN_R) {
        atkId              = p.id;
        input.isAttackHeld = true;
        atkBtn.setFillStyle(0xee3333, 0.98);
        atkInner.setFillStyle(0xff5555, 0.80);
        this.tweens.killTweensOf([atkBtn, atkRing, atkLabel, atkInner]);
        this.tweens.add({
          targets: [atkBtn, atkRing, atkLabel, atkInner, atkShadow],
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
        atkBtn.setFillStyle(0x8b0000, 0.90);
        atkInner.setFillStyle(0xcc1111, 0.60);
        this.tweens.killTweensOf([atkBtn, atkRing, atkLabel, atkInner, atkShadow]);
        this.tweens.add({
          targets: [atkBtn, atkRing, atkLabel, atkInner, atkShadow],
          scaleX: 1, scaleY: 1,
          duration: 100, ease: 'Back.easeOut',
        });
      }
    });
  }
}
