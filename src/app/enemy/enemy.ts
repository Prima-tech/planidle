import { AnimationService } from "../scenes/gamescene/animation.service";
import { EnemyTypeConfig } from "./enemy-config";
import { EnemyBehavior } from "../scenes/gamescene/map-config";
import { GameScene } from "../scenes/gamescene/gamescene";
import { Direction } from "../pnj/interfaces/Direction";
import Phaser from 'phaser';

const Vector2 = Phaser.Math.Vector2;
type Vector2  = Phaser.Math.Vector2;

const BAR_W      = 104;
const BAR_H      = 11;
const BAR_OFFSET = 18;

type EnemyState = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

export class Enemy {
  HP: number;
  maxHP: number;
  isDead = false;
  readonly type: string;

  private animService: AnimationService;
  private state: EnemyState = 'idle';
  private isChasing = false;
  private currentDir: Direction = Direction.DOWN;
  private lastPlayerPos: Vector2 | null = null;
  private hpBar: Phaser.GameObjects.Graphics | null = null;
  private attackTimer: number;
  private readonly speed: number;
  private readonly damage: number;
  private readonly attackCooldown: number;

  constructor(
    public mainScene: Phaser.Scene,
    public sprite: Phaser.GameObjects.Sprite,
    private tilePos: Vector2,
    private tileMap: Phaser.Tilemaps.Tilemap,
    private config: EnemyTypeConfig,
    private behavior: EnemyBehavior = 'passive',
    private visionRadius: number = 5,
    private onDeath?: () => void,
  ) {
    this.type           = config.type;
    this.HP             = config.hp;
    this.maxHP          = config.hp;
    this.speed          = config.speed;
    this.damage         = config.damage;
    this.attackCooldown = config.attackCooldown;
    this.attackTimer    = this.attackCooldown;
    this.animService    = new AnimationService(mainScene);

    this.initSprite();
    this.playAnim('idle');
  }

  // ── Pública ────────────────────────────────────────────────────────────────

  startChasing() {
    if (this.isDead || this.isChasing) return;
    this.isChasing = true;
    this.setState('walk');
  }

  update(delta: number, playerPos: Vector2): void {
    if (this.isDead) return;
    this.lastPlayerPos = playerPos;

    if (this.behavior === 'aggressive' && !this.isChasing) {
      const dist = Phaser.Math.Distance.Between(
        this.sprite.x, this.sprite.y, playerPos.x, playerPos.y,
      );
      if (dist < this.visionRadius * GameScene.TILE_SIZE) this.startChasing();
    }

    if (this.hpBar) this.drawHPBar();
    if (!this.isChasing || this.state === 'attack' || this.state === 'hurt') return;

    const pos  = new Vector2(this.sprite.x, this.sprite.y);
    const dx   = playerPos.x - pos.x;
    const dy   = playerPos.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < GameScene.TILE_SIZE * 2) {
      const dirToPlayer = this.cardinalDir(dx, dy);
      if (dirToPlayer !== this.currentDir) {
        this.currentDir = dirToPlayer;
        if (this.state === 'idle') this.playAnim('idle');
      }
      this.setState('idle');
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        this.attackTimer = this.attackCooldown;
        this.performAttack();
      }
      return;
    }

    this.attackTimer = this.attackCooldown;
    this.move(pos, dx, dy, dist, delta);
  }

  takeDamage(amount: number) {
    if (this.isDead) return;
    this.HP -= amount;
    this.showDamageNumber(amount);
    this.ensureHPBar();
    this.drawHPBar();
    if (this.HP <= 0) { this.die(); return; }
    this.playHurt();
  }

  getTilePos(): Vector2 { return this.tilePos.clone(); }
  getPixelPos(): Vector2 { return new Vector2(this.sprite.x, this.sprite.y); }

  // ── Privada ────────────────────────────────────────────────────────────────

  private initSprite() {
    const offsetX = GameScene.TILE_SIZE / 2;
    const offsetY = GameScene.TILE_SIZE;
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(this.config.scale);
    this.sprite.setPosition(
      this.tilePos.x * GameScene.TILE_SIZE + offsetX,
      this.tilePos.y * GameScene.TILE_SIZE + offsetY,
    );
    if (this.config.tint) this.sprite.setTint(this.config.tint);
  }

  private setState(next: EnemyState) {
    if (this.state === next || this.state === 'death') return;
    this.state = next;
    this.playAnim(next);
  }

  /** Reproduce la animación correcta para el estado y dirección actuales.
   *  Devuelve true si la animación arrancó (o ya estaba jugando). */
  private playAnim(action: string, dir?: Direction): boolean {
    const d    = dir ?? this.currentDir;
    const safe = (d === Direction.NONE || !d) ? Direction.DOWN : d;
    const cfg  = this.config.actions[action];
    if (!cfg) return false;
    const key  = this.animService.enemyAnimKey(this.config.type, action, cfg.directional ? safe : undefined);
    if (!this.mainScene.anims.exists(key)) return false;
    const anim = this.mainScene.anims.get(key);
    if (!anim || anim.frames.length === 0) return false;
    if (this.sprite.anims.currentAnim?.key === key) return true;
    this.sprite.play(key);
    return true;
  }

  private move(pos: Vector2, dx: number, dy: number, dist: number, delta: number) {
    const step = this.speed * (delta / 1000);
    const nx   = (dx / dist) * step;
    const ny   = (dy / dist) * step;

    const full = new Vector2(pos.x + nx, pos.y + ny);
    const xOnly = new Vector2(pos.x + nx, pos.y);
    const yOnly = new Vector2(pos.x,      pos.y + ny);

    const bFull = this.isTileBlocked(full);
    const bX    = this.isTileBlocked(xOnly);
    const bY    = this.isTileBlocked(yOnly);

    let moved = false;
    if (!bFull && !(bX && bY)) {
      this.sprite.setPosition(full.x, full.y); moved = true;
    } else if (!bX) {
      this.sprite.setPosition(xOnly.x, xOnly.y); moved = true;
    } else if (!bY) {
      this.sprite.setPosition(yOnly.x, yOnly.y); moved = true;
    }

    if (!moved) { this.setState('idle'); return; }

    this.tilePos = new Vector2(
      Math.floor(this.sprite.x / GameScene.TILE_SIZE),
      Math.floor(this.sprite.y / GameScene.TILE_SIZE),
    );

    // Actualizar dirección ANTES de setState para que la primera animación sea correcta
    const dir        = this.cardinalDir(dx, dy);
    const dirChanged = dir !== this.currentDir;
    if (dirChanged) this.currentDir = dir;

    const wasWalk = this.state === 'walk';
    this.setState('walk');

    // Si ya estaba en walk y cambió dirección, setState fue no-op → actualizar animación
    if (wasWalk && dirChanged) this.playAnim('walk');
  }

  private performAttack(): void {
    this.facePlayer();
    this.state = 'attack';
    this.mainScene.events.emit('enemyAttackPlayer', { damage: this.damage });

    const animName = this.resolveAttackAnim();
    const played   = this.playAnim(animName);

    if (!played) {
      // Animación no disponible → salir de estado attack para no quedarse atascado
      this.state = 'idle';
      this.playAnim('idle');
      return;
    }

    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.isDead) return;
      this.state = 'idle';
      this.playAnim('idle');
    });
  }

  private resolveAttackAnim(): string {
    return 'attack';
  }

  private playHurt(): void {
    if (!this.config.actions.hurt) return;
    this.facePlayer();
    const prevState = this.state;
    this.state = 'hurt';
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.playAnim('hurt');
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.isDead) return;
      this.state = prevState;
      this.playAnim(prevState);
    });
  }

  private die() {
    if (this.isDead) return;
    this.isDead = true;
    this.isChasing = false;
    this.state = 'death';
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.hpBar?.destroy();
    this.hpBar = null;

    const center = this.sprite.getCenter();
    const type   = this.config.type;

    if (this.config.actions.death) {
      // Reproduce el spritesheet de muerte real
      this.playAnim('death');
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.mainScene.tweens.add({
          targets: this.sprite, alpha: 0, duration: 400, delay: 200,
          onComplete: () => {
            this.sprite.destroy();
            this.mainScene.events.emit('enemyDied', { position: center, type });
            this.onDeath?.();
          },
        });
      });
    } else {
      // Fallback: tween de muerte
      this.animService.createDieAnimation(this.sprite, () => {
        this.mainScene.events.emit('enemyDied', { position: center, type });
        this.onDeath?.();
      });
    }
  }

  private showDamageNumber(amount: number): void {
    const x    = this.sprite.x + Phaser.Math.Between(-30, 30);
    const y    = this.sprite.y - this.sprite.displayHeight * 0.6;
    const text = this.mainScene.add.text(x, y, `${amount}`, {
      fontSize: '28px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 6, fill: true },
    });
    text.setOrigin(0.5, 1).setDepth(10);
    this.mainScene.tweens.add({
      targets: text, y: y - 35, alpha: 0, duration: 700, ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  private ensureHPBar(): void {
    if (this.hpBar) return;
    this.hpBar = this.mainScene.add.graphics();
    this.hpBar.setDepth(15);
  }

  private drawHPBar(): void {
    if (!this.hpBar) return;
    const pct   = Math.max(0, this.HP / this.maxHP);
    const color = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffcc00 : 0xff3333;
    const x     = this.sprite.x - BAR_W / 2;
    const y     = this.sprite.y - this.sprite.displayHeight - BAR_OFFSET;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.55);
    this.hpBar.fillRoundedRect(x - 1, y - 1, BAR_W + 2, BAR_H + 2, 3);
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRoundedRect(x, y, BAR_W * pct, BAR_H, 2);
  }

  private facePlayer(): void {
    if (!this.lastPlayerPos) return;
    const dx = this.lastPlayerPos.x - this.sprite.x;
    const dy = this.lastPlayerPos.y - this.sprite.y;
    this.currentDir = this.cardinalDir(dx, dy);
  }

  private cardinalDir(dx: number, dy: number): Direction {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    return dy > 0 ? Direction.DOWN : Direction.UP;
  }

  private isTileBlocked(pixelPos: Vector2): boolean {
    const tileX = Math.floor(pixelPos.x / GameScene.TILE_SIZE);
    const tileY = Math.floor(pixelPos.y / GameScene.TILE_SIZE);
    if (!this.tileMap.layers.some(l => this.tileMap.hasTileAt(tileX, tileY, l.name))) return true;
    return this.tileMap.layers.some(l => {
      const tile = this.tileMap.getTileAt(tileX, tileY, false, l.name);
      return tile?.properties?.collides;
    });
  }
}
