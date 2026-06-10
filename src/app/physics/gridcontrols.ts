import { Direction } from "../pnj/interfaces/Direction";
import { GridPhysics } from "./gridphisics";
import { MobileInput } from "../scenes/mobile-hud.scene";

export class GridControls {
  private lastCardinalDir: Direction = Direction.DOWN;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private readonly DOUBLE_TAP_MS = 300;
  private lastDirPressTime: Partial<Record<Direction, number>> = {};
  private prevMobileDir: Direction = Direction.NONE;
  private mobileReleasedDir: Direction = Direction.NONE;
  private mobileReleasedTime = 0;

  constructor(
    private input: Phaser.Input.InputPlugin,
    private gridPhysics: GridPhysics,
    private mobileInput?: MobileInput | null,
    private dashCallback?: (moveDir: Direction, animDir: Direction) => void,
  ) {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as any;

    const trackAndDash = (dir: Direction) => () => {
      const now = Date.now();
      const last = this.lastDirPressTime[dir] ?? 0;
      if (now - last < this.DOUBLE_TAP_MS) {
        this.dashCallback?.(dir, dir);
        this.lastDirPressTime[dir] = 0;
      } else {
        this.lastDirPressTime[dir] = now;
      }
      this.lastCardinalDir = dir;
    };

    this.cursors.left.on('down',  trackAndDash(Direction.LEFT));
    this.cursors.right.on('down', trackAndDash(Direction.RIGHT));
    this.cursors.up.on('down',    trackAndDash(Direction.UP));
    this.cursors.down.on('down',  trackAndDash(Direction.DOWN));

    this.wasd.left.on('down',  trackAndDash(Direction.LEFT));
    this.wasd.right.on('down', trackAndDash(Direction.RIGHT));
    this.wasd.up.on('down',    trackAndDash(Direction.UP));
    this.wasd.down.on('down',  trackAndDash(Direction.DOWN));
  }

  update() {
    const mob = this.mobileInput;

    if (mob) {
      const now = Date.now();

      // Detectar double-tap de joystick: soltar + re-presionar misma dirección cardinal
      if (this.prevMobileDir !== Direction.NONE && mob.direction === Direction.NONE) {
        this.mobileReleasedDir  = mob.lastCardinalDir;
        this.mobileReleasedTime = now;
      } else if (this.prevMobileDir === Direction.NONE && mob.direction !== Direction.NONE) {
        if (mob.lastCardinalDir === this.mobileReleasedDir && now - this.mobileReleasedTime < this.DOUBLE_TAP_MS) {
          this.dashCallback?.(mob.direction, mob.lastCardinalDir);
          this.mobileReleasedDir = Direction.NONE;
        }
      }
      this.prevMobileDir = mob.direction;

      if (mob.direction !== Direction.NONE) {
        this.gridPhysics.movePlayer(mob.direction, mob.lastCardinalDir);
        return;
      }
    }

    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;

    let direction = Direction.NONE;
    if (up && left)         direction = Direction.UP_LEFT;
    else if (up && right)   direction = Direction.UP_RIGHT;
    else if (down && left)  direction = Direction.DOWN_LEFT;
    else if (down && right) direction = Direction.DOWN_RIGHT;
    else if (left)          direction = Direction.LEFT;
    else if (right)         direction = Direction.RIGHT;
    else if (up)            direction = Direction.UP;
    else if (down)          direction = Direction.DOWN;

    this.gridPhysics.movePlayer(direction, this.lastCardinalDir);
  }
}
