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

  constructor(
    private input: Phaser.Input.InputPlugin,
    private gridPhysics: GridPhysics,
    private mobileInput?: MobileInput | null,
  ) {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as any;

    const trackDir = (dir: Direction) => () => this.lastCardinalDir = dir;

    this.cursors.left.on('down',  trackDir(Direction.LEFT));
    this.cursors.right.on('down', trackDir(Direction.RIGHT));
    this.cursors.up.on('down',    trackDir(Direction.UP));
    this.cursors.down.on('down',  trackDir(Direction.DOWN));

    this.wasd.left.on('down',  trackDir(Direction.LEFT));
    this.wasd.right.on('down', trackDir(Direction.RIGHT));
    this.wasd.up.on('down',    trackDir(Direction.UP));
    this.wasd.down.on('down',  trackDir(Direction.DOWN));
  }

  update() {
    const mob = this.mobileInput;

    // Mobile joystick takes priority when active
    if (mob && mob.direction !== Direction.NONE) {
      this.gridPhysics.movePlayer(mob.direction, mob.lastCardinalDir);
      return;
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
