import { AnimationService } from "../scenes/gamescene/animation.service";
import { enemyAnimations, enemyTags } from "../scenes/gamescene/constants";
import { EnemyBehavior } from "../scenes/gamescene/map-config";
import { GameScene } from "../scenes/gamescene/gamescene";
import { Direction } from "../pnj/interfaces/Direction";
import Phaser from 'phaser';

const Vector2 = Phaser.Math.Vector2;
type Vector2 = Phaser.Math.Vector2;

const BAR_W      = 104;  // ancho en world units
const BAR_H      = 11;   // alto en world units
const BAR_OFFSET = 18;   // distancia sobre la cabeza

export class Enemy {
  name: string;
  HP: number    = 50;
  maxHP: number = 50;
  isDead: boolean = false;

  private animationService: AnimationService;
  private isChasing: boolean = false;
  private isMoving: boolean = false;
  private speed: number = GameScene.TILE_SIZE * 2;
  private currentAnimDir: Direction = Direction.DOWN;
  private hpBar: Phaser.GameObjects.Graphics | null = null;

  constructor(
    public mainScene: Phaser.Scene,
    public sprite: Phaser.GameObjects.Sprite,
    private tilePos: Vector2,
    private tileMap: Phaser.Tilemaps.Tilemap,
    public enemyType: string = 'orc',
    private behavior: EnemyBehavior = 'passive',
    private visionRadius: number = 5,
    private onDeath?: () => void
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
    this.animationService.createTopDownRightLeftAnim('IDLE', enemyTags.IDLE, 'enemyTexture', enemyAnimations.WALK, -1, 3);
    this.sprite.play(enemyTags.IDLE + this.currentAnimDir);
  }

  startChasing() {
    if (this.isDead || this.isChasing) return;
    this.isChasing = true;
    this.sprite.play(enemyTags.WALK + this.currentAnimDir);
  }

  update(delta: number, playerPos: Vector2): void {
    if (this.isDead) return;

    // Aggressive: entra en persecución si el jugador entra en rango de visión
    if (this.behavior === 'aggressive' && !this.isChasing) {
      const dist = Phaser.Math.Distance.Between(
        this.sprite.x, this.sprite.y, playerPos.x, playerPos.y
      );
      if (dist < this.visionRadius * GameScene.TILE_SIZE) {
        this.startChasing();
      }
    }

    if (this.hpBar) this.drawHPBar();

    if (!this.isChasing) return;

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
      this.tilePos = new Vector2(
        Math.floor(this.sprite.x / GameScene.TILE_SIZE),
        Math.floor(this.sprite.y / GameScene.TILE_SIZE)
      );
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
    this.showDamageNumber(amount);
    this.ensureHPBar();
    this.drawHPBar();
    if (this.HP <= 0) this.die();
  }

  private showDamageNumber(amount: number): void {
    const x = this.sprite.x;
    const y = this.sprite.y - this.sprite.displayHeight;
    const text = this.mainScene.add.text(x, y, `${amount}`, {
      fontSize: '64px', color: '#ffff00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    });
    text.setOrigin(0.5, 1).setDepth(10);
    this.mainScene.tweens.add({
      targets: text, y: y - 80, alpha: 0, duration: 900, ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  getTilePos(): Vector2 { return this.tilePos.clone(); }

  private ensureHPBar(): void {
    if (this.hpBar) return;
    this.hpBar = this.mainScene.add.graphics();
    this.hpBar.setDepth(15);
  }

  private drawHPBar(): void {
    if (!this.hpBar) return;
    const pct    = Math.max(0, this.HP / this.maxHP);
    const color  = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffcc00 : 0xff3333;
    const x      = this.sprite.x - BAR_W / 2;
    const y      = this.sprite.y - this.sprite.displayHeight - BAR_OFFSET;

    this.hpBar.clear();
    // Fondo oscuro
    this.hpBar.fillStyle(0x000000, 0.55);
    this.hpBar.fillRoundedRect(x - 1, y - 1, BAR_W + 2, BAR_H + 2, 3);
    // Relleno coloreado
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRoundedRect(x, y, BAR_W * pct, BAR_H, 2);
  }

  private getCardinalDir(dx: number, dy: number): Direction {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    return dy > 0 ? Direction.DOWN : Direction.UP;
  }

  private isTileBlocked(pixelPos: Vector2): boolean {
    const tileX = Math.floor(pixelPos.x / GameScene.TILE_SIZE);
    const tileY = Math.floor(pixelPos.y / GameScene.TILE_SIZE);
    if (this.hasNoTile(new Vector2(tileX, tileY))) return true;
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
    this.hpBar?.destroy();
    this.hpBar = null;
    const center = this.sprite.getCenter();
    const type = this.enemyType;
    this.animationService.createDieAnimation(this.sprite, () => {
      this.sprite.destroy();
      this.mainScene.events.emit('enemyDied', { position: center, type });
      this.onDeath?.();
    });
  }
}
