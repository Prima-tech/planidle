import { Enemy } from "../enemy/enemy";
import { Direction } from "../pnj/interfaces/Direction";
import { Player } from "../pnj/player/player";
import { GameScene } from "../scenes/gamescene/gamescene";
import Phaser from 'phaser';

const Vector2 = Phaser.Math.Vector2;
type Vector2 = Phaser.Math.Vector2;

export class GridPhysics extends Phaser.Events.EventEmitter {
	private movementDirection: Direction = Direction.NONE;
	private readonly speedPixelsPerSecond: number = GameScene.TILE_SIZE * 4;
  private tileSizePixelsWalked: number = 0;
  private lastMovementIntent = Direction.NONE;
  private movementDirectionVectors: {
    [key in Direction]?: Vector2;
  } = {
    [Direction.UP]: Vector2.UP,
    [Direction.DOWN]: Vector2.DOWN,
    [Direction.LEFT]: Vector2.LEFT,
    [Direction.RIGHT]: Vector2.RIGHT,
  };

  constructor(
    private player: Player,
    private tileMap: Phaser.Tilemaps.Tilemap,
    private enemies: Enemy[]
  ) {
    super();
  }

  movePlayer(direction: Direction): void {
    this.lastMovementIntent = direction;
    if (this.isMoving()) return;
    if (this.isBlockingDirection(direction)) {
      this.player.stopAnimation(direction);
    } else {
      this.startMoving(direction);
    }
  }

  private isMoving(): boolean {
    return this.movementDirection != Direction.NONE;
  }

  private startMoving(direction: Direction): void {
    this.player.startAnimation(direction);
    this.movementDirection = direction;
    this.updatePlayerTilePos();
  }

  update(delta: number): void {
    if (this.isMoving()) {
      this.updatePlayerPosition(delta);
    }
    this.lastMovementIntent = Direction.NONE;
  }

  private updatePlayerPosition(delta: number) {
    const pixelsToWalkThisUpdate = this.getPixelsToWalkThisUpdate(delta);

    if (!this.willCrossTileBorderThisUpdate(pixelsToWalkThisUpdate)) {
      this.movePlayerSprite(pixelsToWalkThisUpdate);
    } else if (this.shouldContinueMoving()) {
      this.movePlayerSprite(pixelsToWalkThisUpdate);
      this.updatePlayerTilePos();
    } else {
      this.movePlayerSprite(GameScene.TILE_SIZE - this.tileSizePixelsWalked);
      this.stopMoving();
    }
  }

  private shouldContinueMoving(): boolean {
    return (
      this.movementDirection == this.lastMovementIntent &&
      !this.isBlockingDirection(this.lastMovementIntent)
    );
  }

  private movePlayerSprite(pixelsToMove: number) {
    const directionVec = this.movementDirectionVectors[
      this.movementDirection
    ].clone();
    const movementDistance = directionVec.multiply(new Vector2(pixelsToMove));
    const newPlayerPos = this.player.getPosition().add(movementDistance);
    this.player.setPosition(newPlayerPos);
    this.tileSizePixelsWalked += pixelsToMove;
    this.tileSizePixelsWalked %= GameScene.TILE_SIZE;
  }

	private stopMoving(): void {
    this.player.stopAnimation(this.movementDirection);
    this.movementDirection = Direction.NONE;
  }

	private getPixelsToWalkThisUpdate(delta: number): number {
		const deltaInSeconds = delta / 1000;
		return this.speedPixelsPerSecond * deltaInSeconds;
	}

  private willCrossTileBorderThisUpdate(
    pixelsToWalkThisUpdate: number
  ): boolean {
    return (
      this.tileSizePixelsWalked + pixelsToWalkThisUpdate >= GameScene.TILE_SIZE
    );
  }

  private updatePlayerTilePos() {
    this.player.setTilePos(
      this.player
        .getTilePos()
        .add(this.movementDirectionVectors[this.movementDirection])
    );
  }

  private isBlockingDirection(direction: Direction): boolean {
    const nextTilePos = this.tilePosInDirection(direction);

    // Check if the position is blocked by a tile
    if (this.hasBlockingTile(nextTilePos)) return true;

    // Check if the position is occupied by an enemy
    const enemyAtPosition = this.enemies.find(enemy => {
      const enemyTilePos = enemy.getTilePos();
      return enemyTilePos.x === nextTilePos.x && enemyTilePos.y === nextTilePos.y;
    });

    return !!enemyAtPosition;
  }

  attackEnemy(): void {
    const playerTilePos = this.player.getTilePos();

    this.enemies.forEach(enemy => {
      const enemyTilePos = enemy.getTilePos();
      const isAdjacent =
        Math.abs(enemyTilePos.x - playerTilePos.x) +
        Math.abs(enemyTilePos.y - playerTilePos.y) === 1; // Check adjacency

      if (isAdjacent) {
        enemy.takeDamage(10); // Example damage value
       // console.log('soy el enemy', enemy)
        this.emit('enemyAttacked', enemy); // Emit event when an enemy is attacked
       // console.log('attack done');
      }
    });
  }

  private hasBlockingTile(pos: Vector2): boolean {
    if (this.hasNoTile(pos)) return true;
    return this.tileMap.layers.some((layer) => {
      const tile = this.tileMap.getTileAt(pos.x, pos.y, false, layer.name);
      return tile && tile.properties.collides;
    });
  }

  private tilePosInDirection(direction: Direction): Vector2 {
    return this.player
      .getTilePos()
      .add(this.movementDirectionVectors[direction]);
  }

  private hasNoTile(pos: Vector2): boolean {
    return !this.tileMap.layers.some((layer) =>
      this.tileMap.hasTileAt(pos.x, pos.y, layer.name)
    );
  }

  
}