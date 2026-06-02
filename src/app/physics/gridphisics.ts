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
  private readonly layerCount: number;

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
    this.layerCount = tileMap.layers.length;
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

    // Usar coordenadas escalares para evitar new Vector2() en el hot path
    const pos = this.player.getPosition();
    const px = pos.x;
    const py = pos.y;

    const blockedFull = this.isTileBlockedXY(px + dx, py + dy);
    const blockedX    = this.isTileBlockedXY(px + dx, py     );
    const blockedY    = this.isTileBlockedXY(px,      py + dy);

    if (!blockedFull && !(blockedX && blockedY)) {
      this.player.setPositionXY(px + dx, py + dy);
    } else if (!blockedX) {
      this.player.setPositionXY(px + dx, py     );
    } else if (!blockedY) {
      this.player.setPositionXY(px,      py + dy);
    }
  }

  attackEnemy(): void {
    const pos  = this.player.getPosition();
    const dir  = this.player.getDirection();
    const RANGE = GameScene.TILE_SIZE * 2;

    this.enemies.forEach(enemy => {
      const ePos = enemy.getPixelPos();
      const dx   = ePos.x - pos.x;
      const dy   = ePos.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > RANGE || dist === 0) return;
      if (!this.isInAttackDirection(dx, dy, dir)) return;

      enemy.takeDamage(10);
      enemy.startChasing();
      this.emit('enemyAttacked', enemy);
    });
  }

  private isInAttackDirection(dx: number, dy: number, dir: Direction): boolean {
    const vec = this.dirVectors[dir];
    if (!vec) return true;
    return (dx * vec.x + dy * vec.y) > 0;
  }

  // Sin allocations: usa índice numérico de capa como Enemy.isTileBlocked()
  private isTileBlockedXY(px: number, py: number): boolean {
    const tileX = Math.floor(px / GameScene.TILE_SIZE);
    const tileY = Math.floor(py / GameScene.TILE_SIZE);
    let hasAny = false;
    for (let i = 0; i < this.layerCount; i++) {
      const tile = this.tileMap.getTileAt(tileX, tileY, false, i);
      if (tile) {
        hasAny = true;
        if (tile.properties?.collides) return true;
      }
    }
    return !hasAny;
  }
}
