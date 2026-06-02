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

  // HP bar: Rectangle objects en lugar de Graphics — setPosition/setSize es 10× más
  // barato que clear() + fillRoundedRect() cada frame.
  private hpBarBg:   Phaser.GameObjects.Rectangle | null = null;
  private hpBarFill: Phaser.GameObjects.Rectangle | null = null;

  private attackTimer: number;
  private readonly speed: number;
  private readonly damage: number;
  private readonly attackCooldown: number;
  private readonly layerCount: number;  // cacheado para evitar .layers.length cada frame

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
    this.layerCount     = tileMap.layers.length;
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

    if (this.hpBarBg) this.drawHPBar();
    if (!this.isChasing || this.state === 'attack' || this.state === 'hurt') return;

    // Evitar new Vector2 en el hot path — operar con coordenadas crudas
    const sx   = this.sprite.x;
    const sy   = this.sprite.y;
    const dx   = playerPos.x - sx;
    const dy   = playerPos.y - sy;
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
    this.move(sx, sy, dx, dy, dist, delta);
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

  // Sin allocations de Vector2: isTileBlocked recibe coordenadas crudas.
  // Una sola pasada con índice numérico en lugar de dos pasadas con string lookup.
  private move(sx: number, sy: number, dx: number, dy: number, dist: number, delta: number) {
    const step = this.speed * (delta / 1000);
    const nx   = (dx / dist) * step;
    const ny   = (dy / dist) * step;

    const bFull = this.isTileBlocked(sx + nx, sy + ny);
    const bX    = this.isTileBlocked(sx + nx, sy);
    const bY    = this.isTileBlocked(sx,      sy + ny);

    let newX = sx;
    let newY = sy;
    let moved = false;

    if (!bFull && !(bX && bY)) {
      newX = sx + nx; newY = sy + ny; moved = true;
    } else if (!bX) {
      newX = sx + nx; moved = true;
    } else if (!bY) {
      newY = sy + ny; moved = true;
    }

    if (!moved) { this.setState('idle'); return; }

    this.sprite.setPosition(newX, newY);
    this.tilePos = new Vector2(
      Math.floor(newX / GameScene.TILE_SIZE),
      Math.floor(newY / GameScene.TILE_SIZE),
    );

    const dir        = this.cardinalDir(dx, dy);
    const dirChanged = dir !== this.currentDir;
    if (dirChanged) this.currentDir = dir;

    const wasWalk = this.state === 'walk';
    this.setState('walk');
    if (wasWalk && dirChanged) this.playAnim('walk');
  }

  private performAttack(): void {
    this.facePlayer();
    this.state = 'attack';
    this.mainScene.events.emit('enemyAttackPlayer', { damage: this.damage });

    const animName = this.resolveAttackAnim();
    const played   = this.playAnim(animName);

    if (!played) {
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
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    this.hpBarBg = null;
    this.hpBarFill = null;

    const center = this.sprite.getCenter();
    const type   = this.config.type;

    if (this.config.actions.death) {
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
    if (this.hpBarBg) return;
    this.hpBarBg = this.mainScene.add
      .rectangle(0, 0, BAR_W + 2, BAR_H + 2, 0x000000, 0.55)
      .setDepth(15)
      .setOrigin(0.5, 0.5);
    this.hpBarFill = this.mainScene.add
      .rectangle(0, 0, BAR_W, BAR_H, 0x44cc44, 1)
      .setDepth(15)
      .setOrigin(0, 0.5);
  }

  private drawHPBar(): void {
    if (!this.hpBarBg || !this.hpBarFill) return;
    const pct   = Math.max(0, this.HP / this.maxHP);
    const color = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffcc00 : 0xff3333;
    const cx    = this.sprite.x;
    const cy    = this.sprite.y - this.sprite.displayHeight - BAR_OFFSET;

    this.hpBarBg.setPosition(cx, cy);
    this.hpBarFill.setPosition(cx - BAR_W / 2, cy);
    this.hpBarFill.setSize(BAR_W * pct, BAR_H);
    this.hpBarFill.setFillStyle(color, 1);
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

  // Una sola pasada con índice numérico (más rápido que string lookup por nombre de capa).
  // Retorna true (bloqueado) si no hay tile en ninguna capa (fuera de mapa) o si
  // algún tile tiene la propiedad collides=true.
  private isTileBlocked(px: number, py: number): boolean {
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
