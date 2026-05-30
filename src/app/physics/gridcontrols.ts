import { Direction } from "../pnj/interfaces/Direction";
import { GridPhysics } from "./gridphisics";

export class GridControls {
  private lastCardinalDir: Direction = Direction.DOWN;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(
    private input: Phaser.Input.InputPlugin,
    private gridPhysics: GridPhysics
  ) {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.cursors.left.on('down', () => this.lastCardinalDir = Direction.LEFT);
    this.cursors.right.on('down', () => this.lastCardinalDir = Direction.RIGHT);
    this.cursors.up.on('down', () => this.lastCardinalDir = Direction.UP);
    this.cursors.down.on('down', () => this.lastCardinalDir = Direction.DOWN);
  }

  update() {
    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const up = this.cursors.up.isDown;
    const down = this.cursors.down.isDown;

    let direction = Direction.NONE;
    if (up && left) direction = Direction.UP_LEFT;
    else if (up && right) direction = Direction.UP_RIGHT;
    else if (down && left) direction = Direction.DOWN_LEFT;
    else if (down && right) direction = Direction.DOWN_RIGHT;
    else if (left) direction = Direction.LEFT;
    else if (right) direction = Direction.RIGHT;
    else if (up) direction = Direction.UP;
    else if (down) direction = Direction.DOWN;

    this.gridPhysics.movePlayer(direction, this.lastCardinalDir);
  }
}
