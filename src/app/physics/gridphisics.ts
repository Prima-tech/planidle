import { Enemy } from "../enemy/enemy";
import { Direction } from "../pnj/interfaces/Direction";
import { Player } from "../pnj/player/player";
import { GameScene } from "../scenes/gamescene/gamescene";
import Phaser from 'phaser';

const Vector2 = Phaser.Math.Vector2;
type Vector2 = Phaser.Math.Vector2;

const DIAG = 1 / Math.sqrt(2);

export class GridPhysics extends Phaser.Events.EventEmitter {
  private readonly speedPixelsPerSecond: number = GameScene.TILE_SIZE * 8;
  private readonly DASH_SPEED     = GameScene.TILE_SIZE * 24;
  private readonly DASH_DURATION  = 180; // ms

  private movementIntent: Direction = Direction.NONE;
  private animDirection: Direction = Direction.DOWN;
  private currentAnimDirection: Direction = Direction.NONE;
  private isWalking: boolean = false;
  private readonly layerCount: number;

  private isDashing    = false;
  private dashRemaining = 0;
  private dashMoveDir: Direction = Direction.NONE;
  private dashAnimDir: Direction = Direction.NONE;

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
    private enemies: Enemy[],
    private collisionTiles: Set<string> = new Set(),
  ) {
    super();
    this.layerCount = tileMap.layers.length;
  }

  movePlayer(direction: Direction, animDir: Direction): void {
    this.movementIntent = direction;
    this.animDirection = animDir;
  }

  dash(moveDir: Direction, animDir: Direction): void {
    if (this.isDashing || moveDir === Direction.NONE) return;
    this.isDashing     = true;
    this.dashRemaining = this.DASH_DURATION;
    this.dashMoveDir   = moveDir;
    this.dashAnimDir   = animDir;
    this.player.startDash();
  }

  update(delta: number): void {
    if (this.isDashing) {
      this.dashRemaining -= delta;
      if (this.dashRemaining <= 0) {
        this.isDashing = false;
        this.player.endDash();
      } else {
        this.applyMovement(this.dashMoveDir, delta, this.DASH_SPEED, true);
        if (!this.isWalking || this.dashAnimDir !== this.currentAnimDirection) {
          this.player.startAnimation(this.dashAnimDir);
          this.currentAnimDirection = this.dashAnimDir;
          this.isWalking = true;
        }
        this.movementIntent = Direction.NONE;
        return;
      }
    }

    if (this.movementIntent !== Direction.NONE) {
      this.applyMovement(this.movementIntent, delta, this.speedPixelsPerSecond);
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

  private applyMovement(direction: Direction, delta: number, speed: number, ignoreEnemies = false): void {
    const dirVec = this.dirVectors[direction];
    if (!dirVec) return;

    const pixels = speed * (delta / 1000);
    const dx = dirVec.x * pixels;
    const dy = dirVec.y * pixels;

    const pos = this.player.getPosition();
    const px = pos.x;
    const py = pos.y;

    const enemyBlockFull = ignoreEnemies ? false : this.isEnemyBlockedXY(px + dx, py + dy);
    const enemyBlockX    = ignoreEnemies ? false : this.isEnemyBlockedXY(px + dx, py     );
    const enemyBlockY    = ignoreEnemies ? false : this.isEnemyBlockedXY(px,      py + dy);

    const blockedFull = this.isTileBlockedXY(px + dx, py + dy) || enemyBlockFull;
    const blockedX    = this.isTileBlockedXY(px + dx, py     ) || enemyBlockX;
    const blockedY    = this.isTileBlockedXY(px,      py + dy) || enemyBlockY;

    if (!blockedFull && !(blockedX && blockedY)) {
      this.player.setPositionXY(px + dx, py + dy);
    } else if (!blockedX) {
      this.player.setPositionXY(px + dx, py     );
    } else if (!blockedY) {
      this.player.setPositionXY(px,      py + dy);
    }
  }

  private isEnemyBlockedXY(px: number, py: number): boolean {
    const HW = GameScene.TILE_SIZE * 0.9;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.isDead) continue;
      if (Math.abs(e.sprite.x - px) < HW && Math.abs(e.getCollisionY() - py) < HW) return true;
    }
    return false;
  }

  /** Devuelve el número de enemigos golpeados */
  attackEnemy(damage: number, isCrit = false): number {
    const pos  = this.player.getPosition();
    const dir  = this.player.getDirection();
    const RANGE = GameScene.TILE_SIZE * 3;
    let hits = 0;

    this.enemies.forEach(enemy => {
      const ePos = enemy.getPixelPos();
      const dx   = ePos.x - pos.x;
      const dy   = ePos.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > RANGE || dist === 0) return;
      if (!this.isInAttackDirection(dx, dy, dir)) return;

      enemy.takeDamage(damage, isCrit);
      enemy.startChasing();
      this.emit('enemyAttacked', enemy);
      hits++;
    });

    return hits;
  }

  private isInAttackDirection(dx: number, dy: number, dir: Direction): boolean {
    const vec = this.dirVectors[dir];
    if (!vec) return true;
    return (dx * vec.x + dy * vec.y) > 0;
  }

  /** Check público de colisión en píxeles (lo usa el knockback del jugador). */
  isTileBlocked(px: number, py: number): boolean {
    return this.isTileBlockedXY(px, py);
  }

  // Sin allocations: usa índice numérico de capa como Enemy.isTileBlocked()
  private isTileBlockedXY(px: number, py: number): boolean {
    const tileX = Math.floor(px / GameScene.TILE_SIZE);
    const tileY = Math.floor(py / GameScene.TILE_SIZE);
    if (this.collisionTiles.has(`${tileX},${tileY}`)) return true;
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
