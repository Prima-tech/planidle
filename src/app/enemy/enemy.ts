import { AnimationService } from "../scenes/gamescene/animation.service";
import { enemyAnimations, enemyTags } from "../scenes/gamescene/constants";
import { GameScene } from "../scenes/gamescene/gamescene";
import { Direction } from "../pnj/interfaces/Direction";
import Phaser from 'phaser';

const Vector2 = Phaser.Math.Vector2;
type Vector2 = Phaser.Math.Vector2;

export class Enemy {
  name: string;
  HP: number = 50;
  isDead: boolean = false;

  private animationService: AnimationService;
  private isChasing: boolean = false;
  private isMoving: boolean = false;
  private speed: number = GameScene.TILE_SIZE * 2;
  private currentAnimDir: Direction = Direction.DOWN;

  constructor(
    public mainScene: Phaser.Scene,
    public sprite: Phaser.GameObjects.Sprite,
    private tilePos: Vector2,
    private tileMap: Phaser.Tilemaps.Tilemap
  ) {
    this.initSpriteProperties();
    this.initAnimation();
  }

  initSpriteProperties() {
    const offsetX = GameScene.TILE_SIZE / 2;
    const offsetY = GameScene.TILE_SIZE;
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setPosition(
      this.tilePos.x * GameScene.TILE_SIZE + offsetX,
      this.tilePos.y * GameScene.TILE_SIZE + offsetY
    );
    this.animationService = new AnimationService(this.mainScene);
  }

  initAnimation() {
    this.animationService.createTopDownRightLeftAnim('WALK', enemyTags.WALK, 'enemyTexture', enemyAnimations.WALK);
    // Idle reusa los mismos frames que WALK pero a framerate bajo (los frames de IDLE en constants.ts son incorrectos)
    this.animationService.createTopDownRightLeftAnim('IDLE', enemyTags.IDLE, 'enemyTexture', enemyAnimations.WALK, -1, 3);
    this.sprite.play(enemyTags.IDLE + this.currentAnimDir);
  }

  startChasing() {
    if (this.isDead) return;
    this.isChasing = true;
    this.sprite.play(enemyTags.WALK + this.currentAnimDir);
  }

  update(delta: number, playerPos: Vector2): void {
    if (this.isDead || !this.isChasing) return;

    const pos = new Vector2(this.sprite.x, this.sprite.y);
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < GameScene.TILE_SIZE) {
      this.setMoving(false);
      return;
    }

    const step = this.speed * (delta / 1000);
    const nx = (dx / dist) * step;
    const ny = (dy / dist) * step;

    const newFull = new Vector2(pos.x + nx, pos.y + ny);
    const newX    = new Vector2(pos.x + nx, pos.y);
    const newY    = new Vector2(pos.x,      pos.y + ny);

    const blockedFull = this.isTileBlocked(newFull);
    const blockedX    = this.isTileBlocked(newX);
    const blockedY    = this.isTileBlocked(newY);

    let moved = false;
    if (!blockedFull && !(blockedX && blockedY)) {
      this.sprite.setPosition(newFull.x, newFull.y);
      moved = true;
    } else if (!blockedX) {
      this.sprite.setPosition(newX.x, newX.y);
      moved = true;
    } else if (!blockedY) {
      this.sprite.setPosition(newY.x, newY.y);
      moved = true;
    }

    this.setMoving(moved);

    if (moved) {
      // Mantener tilePos sincronizado con posición pixel (lo usa el sistema de ataque)
      this.tilePos = new Vector2(
        Math.floor(this.sprite.x / GameScene.TILE_SIZE),
        Math.floor(this.sprite.y / GameScene.TILE_SIZE)
      );

      // Animación según dirección dominante
      const dir = this.getCardinalDir(dx, dy);
      if (dir !== this.currentAnimDir) {
        this.sprite.play(enemyTags.WALK + dir);
        this.currentAnimDir = dir;
      }
    }
  }

  private setMoving(moving: boolean): void {
    if (moving === this.isMoving) return;
    this.isMoving = moving;
    if (moving) {
      this.sprite.play(enemyTags.WALK + this.currentAnimDir);
    } else {
      this.sprite.play(enemyTags.IDLE + this.currentAnimDir);
    }
  }

  takeDamage(amount: number) {
    this.HP -= amount;
    if (this.HP <= 0) {
      this.die();
    }
  }

  getTilePos(): Vector2 {
    return this.tilePos.clone();
  }

  private getCardinalDir(dx: number, dy: number): Direction {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    }
    return dy > 0 ? Direction.DOWN : Direction.UP;
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

  private die() {
    this.isDead = true;
    this.isChasing = false;
    const center = this.sprite.getCenter();
    this.animationService.createDieAnimation(this.sprite, () => {
      this.sprite.destroy();
      this.mainScene.events.emit('enemyDied', center);
    });
  }
}
