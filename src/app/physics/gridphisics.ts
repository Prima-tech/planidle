import { Enemy } from "../enemy/enemy";
import { Direction } from "../pnj/interfaces/Direction";
import { Player } from "../pnj/player/player";
import { GameScene } from "../scenes/gamescene/gamescene";
import Phaser from 'phaser';

const Vector2 = Phaser.Math.Vector2;
type Vector2 = Phaser.Math.Vector2;

const DIAG = 1 / Math.sqrt(2);

export class GridPhysics extends Phaser.Events.EventEmitter {
  private readonly speedPixelsPerSecond: number = GameScene.TILE_SIZE * 4;

  private movementIntent: Direction = Direction.NONE;
  private animDirection: Direction = Direction.DOWN;
  private currentAnimDirection: Direction = Direction.NONE;
  private isWalking: boolean = false;

  private readonly dirVectors: Partial<Record<Direction, Vector2>> = {
    [Direction.UP]:         new Vector2(0, -1),
    [Direction.DOWN]:       new Vector2(0,  1),
    [Direction.LEFT]:       new Vector2(-1, 0),
    [Direction.RIGHT]:      new Vector2(1,  0),
    [Direction.UP_LEFT]:    new Vector2(-DIAG, -DIAG),
    [Direction.UP_RIGHT]:   new Vector2( DIAG, -DIAG),
    [Direction.DOWN_LEFT]:  new Vector2(-DIAG,  DIAG),
    [Direction.DOWN_RIGHT]: new Vector2( DIAG,  DIAG),
  };

  constructor(
    private player: Player,
    private tileMap: Phaser.Tilemaps.Tilemap,
    private enemies: Enemy[]
  ) {
    super();
  }

  movePlayer(direction: Direction, animDir: Direction): void {
    this.movementIntent = direction;
    this.animDirection = animDir;
  }

  update(delta: number): void {
    if (this.movementIntent !== Direction.NONE) {
      this.applyMovement(delta);
      if (!this.isWalking || this.animDirection !== this.currentAnimDirection) {
        this.player.startAnimation(this.animDirection);
        this.currentAnimDirection = this.animDirection;
        this.isWalking = true;
      }
    } else {
      if (this.isWalking) {
        this.player.stopAnimation(this.currentAnimDirection);
        this.isWalking = false;
      }
    }
    this.movementIntent = Direction.NONE;
  }

  private applyMovement(delta: number): void {
    const dirVec = this.dirVectors[this.movementIntent];
    if (!dirVec) return;

    const pixels = this.speedPixelsPerSecond * (delta / 1000);
    const dx = dirVec.x * pixels;
    const dy = dirVec.y * pixels;

    const pos = this.player.getPosition();
    const newFull = new Vector2(pos.x + dx, pos.y + dy);
    const newX    = new Vector2(pos.x + dx, pos.y);
    const newY    = new Vector2(pos.x,      pos.y + dy);

    const blockedFull = this.isTileBlocked(newFull);
    const blockedX    = this.isTileBlocked(newX);
    const blockedY    = this.isTileBlocked(newY);

    // Corner blocking: prevent cutting through where both adjacent cardinal tiles are walls
    const cornerBlocked = blockedX && blockedY;

    if (!blockedFull && !cornerBlocked) {
      this.player.setPosition(newFull);
    } else if (!blockedX) {
      this.player.setPosition(newX);
    } else if (!blockedY) {
      this.player.setPosition(newY);
    }
    // else: fully blocked, don't move
  }

  attackEnemy(): void {
    const pos = this.player.getPosition();
    const playerTileX = Math.floor(pos.x / GameScene.TILE_SIZE);
    const playerTileY = Math.floor(pos.y / GameScene.TILE_SIZE);

    this.enemies.forEach(enemy => {
      const enemyTilePos = enemy.getTilePos();
      const isAdjacent =
        Math.abs(enemyTilePos.x - playerTileX) <= 1 &&
        Math.abs(enemyTilePos.y - playerTileY) <= 1 &&
        !(enemyTilePos.x === playerTileX && enemyTilePos.y === playerTileY);

      if (isAdjacent) {
        enemy.takeDamage(10);
        enemy.startChasing();
        this.emit('enemyAttacked', enemy);
      }
    });
  }

  private isTileBlocked(pixelPos: Vector2): boolean {
    const tileX = Math.floor(pixelPos.x / GameScene.TILE_SIZE);
    const tileY = Math.floor(pixelPos.y / GameScene.TILE_SIZE);
    const tileVec = new Vector2(tileX, tileY);
    if (this.hasNoTile(tileVec)) return true;
    return this.tileMap.layers.some((layer) => {
      const tile = this.tileMap.getTileAt(tileX, tileY, false, layer.name);
      return tile && tile.properties.collides;
    });
  }

  private hasNoTile(pos: Vector2): boolean {
    return !this.tileMap.layers.some((layer) =>
      this.tileMap.hasTileAt(pos.x, pos.y, layer.name)
    );
  }
}
