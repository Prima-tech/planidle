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
const BAR_OFFSET = 4;
// Los spritesheets traen aire transparente alrededor: la cabeza real queda muy
// por debajo del borde superior del sprite, de ahí el factor < 0.5
const BAR_ANCHOR = 0.32;

type EnemyState = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

export class Enemy {
  HP: number;
  maxHP: number;
  isDead = false;
  readonly type: string;

  private animService: AnimationService;
  private state: EnemyState = 'idle';
  private preHurtState: EnemyState = 'idle';
  private isChasing = false;
  private currentDir: Direction = Direction.DOWN;
  private lastPlayerPos: Vector2 | null = null;

  // HP bar: Rectangle objects en lugar de Graphics — setPosition/setSize es 10× más
  // barato que clear() + fillRoundedRect() cada frame.
  private hpBarBg:       Phaser.GameObjects.Rectangle | null = null;
  private hpBarFill:     Phaser.GameObjects.Rectangle | null = null;
  private hpBarLastPct = -1;

  private attackTimer: number;
  private readonly speed: number;
  private readonly damage: number;
  private readonly attackCooldown: number;
  private readonly layerCount: number;
  private readonly visionRadiusSq: number;
  private cachedDisplayHeight = 0;

  private hasWanderZone = false;
  private wanderBoundsMinX = 0;
  private wanderBoundsMinY = 0;
  private wanderBoundsMaxX = 0;
  private wanderBoundsMaxY = 0;
  private hasWanderTarget = false;
  private wanderTargetX = 0;
  private wanderTargetY = 0;
  private wanderWaitMs = 0;
  private wanderStuckMs = 0;

  constructor(
    public mainScene: Phaser.Scene,
    public sprite: Phaser.GameObjects.Sprite,
    private tilePos: Vector2,
    private tileMap: Phaser.Tilemaps.Tilemap,
    private config: EnemyTypeConfig,
    private behavior: EnemyBehavior = 'passive',
    visionRadius: number = 5,
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
    const visionPx      = visionRadius * GameScene.TILE_SIZE;
    this.visionRadiusSq = visionPx * visionPx;

    this.initSprite();
    this.playAnim('idle');
  }

  // ── Pública ────────────────────────────────────────────────────────────────

  startChasing() {
    if (this.isDead || this.isChasing) return;
    this.isChasing = true;
    this.hasWanderTarget = false;
    this.setState('walk');
  }

  setWanderZone(tileX: number, tileY: number, tileW: number, tileH: number, bufferTiles = 3): void {
    const ts = GameScene.TILE_SIZE;
    this.wanderBoundsMinX = (tileX - bufferTiles) * ts;
    this.wanderBoundsMinY = (tileY - bufferTiles) * ts;
    this.wanderBoundsMaxX = (tileX + tileW + bufferTiles) * ts;
    this.wanderBoundsMaxY = (tileY + tileH + bufferTiles) * ts;
    this.hasWanderZone = true;
    this.wanderWaitMs = Phaser.Math.Between(0, 2000);
  }

  update(delta: number, playerPos: Vector2): void {
    if (this.isDead) return;
    this.lastPlayerPos = playerPos;

    if (this.behavior === 'aggressive' && !this.isChasing) {
      const vdx = this.sprite.x - playerPos.x;
      const vdy = this.sprite.y - playerPos.y;
      if (vdx * vdx + vdy * vdy < this.visionRadiusSq) this.startChasing();
    }

    this.sprite.setDepth(this.sprite.y);
    if (this.hpBarBg) this.drawHPBar();
    if (this.state === 'attack' || this.state === 'hurt') return;

    if (this.isChasing) {
      this.updateChase(playerPos, delta);
    } else {
      this.updateWander(delta);
    }
  }

  takeDamage(amount: number, isCrit = false) {
    if (this.isDead) return;
    this.HP -= amount;
    this.showDamageNumber(amount, isCrit);
    this.ensureHPBar();
    this.drawHPBar();
    this.flashWhite();
    if (this.HP <= 0) { this.die(); return; }
    this.applyKnockback(isCrit);
    this.playHurt();
  }

  getTilePos(): Vector2 { return this.tilePos.clone(); }
  getPixelPos(): Vector2 { return new Vector2(this.sprite.x, this.sprite.y); }
  getCollisionY(): number { return this.sprite.y + this.sprite.displayHeight * 0.1; }

  // ── Privada ────────────────────────────────────────────────────────────────

  private updateChase(playerPos: Vector2, delta: number): void {
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

  private updateWander(delta: number): void {
    if (!this.hasWanderZone) return;

    if (this.wanderWaitMs > 0) {
      this.wanderWaitMs -= delta;
      return;
    }

    if (!this.hasWanderTarget) {
      this.pickWanderTarget();
      return;
    }

    const sx   = this.sprite.x;
    const sy   = this.sprite.y;
    const dx   = this.wanderTargetX - sx;
    const dy   = this.wanderTargetY - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < GameScene.TILE_SIZE * 0.6) {
      this.hasWanderTarget = false;
      this.wanderWaitMs = Phaser.Math.Between(1500, 4000);
      this.setState('idle');
      return;
    }

    this.move(sx, sy, dx, dy, dist, delta);

    if (Math.abs(this.sprite.x - sx) < 0.5 && Math.abs(this.sprite.y - sy) < 0.5) {
      this.wanderStuckMs += delta;
      if (this.wanderStuckMs > 800) {
        this.wanderStuckMs = 0;
        this.hasWanderTarget = false;
        this.wanderWaitMs = Phaser.Math.Between(500, 1500);
      }
    } else {
      this.wanderStuckMs = 0;
    }
  }

  private pickWanderTarget(): void {
    const ts       = GameScene.TILE_SIZE;
    const curTileX = Math.floor(this.sprite.x / ts);
    const curTileY = Math.floor(this.sprite.y / ts);

    const boundMinX = Math.max(0, Math.ceil(this.wanderBoundsMinX / ts));
    const boundMaxX = Math.floor(this.wanderBoundsMaxX / ts);
    const boundMinY = Math.max(0, Math.ceil(this.wanderBoundsMinY / ts));
    const boundMaxY = Math.floor(this.wanderBoundsMaxY / ts);

    const offX = Phaser.Math.Between(1, 4) * (Math.random() < 0.5 ? 1 : -1);
    const offY = Phaser.Math.Between(1, 4) * (Math.random() < 0.5 ? 1 : -1);
    const tx   = Math.max(boundMinX, Math.min(boundMaxX, curTileX + offX));
    const ty   = Math.max(boundMinY, Math.min(boundMaxY, curTileY + offY));

    this.wanderTargetX = tx * ts + ts / 2;
    this.wanderTargetY = ty * ts + ts;
    this.hasWanderTarget = true;
    this.wanderStuckMs = 0;
  }

  private initSprite() {
    const offsetX = GameScene.TILE_SIZE / 2;
    const offsetY = GameScene.TILE_SIZE / 2;
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setScale(this.config.scale);
    this.sprite.setPosition(
      this.tilePos.x * GameScene.TILE_SIZE + offsetX,
      this.tilePos.y * GameScene.TILE_SIZE + offsetY,
    );
    if (this.config.tint) this.sprite.setTint(this.config.tint);
    this.cachedDisplayHeight = this.sprite.displayHeight;
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

    const bFull = this.isTileBlocked(sx + nx, sy + ny) || this.isPlayerBlocked(sx + nx, sy + ny);
    const bX    = this.isTileBlocked(sx + nx, sy     ) || this.isPlayerBlocked(sx + nx, sy     );
    const bY    = this.isTileBlocked(sx,      sy + ny) || this.isPlayerBlocked(sx,      sy + ny);

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
    this.tilePos.set(
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

    const animName = this.resolveAttackAnim();
    const played   = this.playAnim(animName);

    if (!played) {
      this.state = 'idle';
      this.playAnim('idle');
      return;
    }

    // Retrasa el daño ~40% de la duración de la animación para que coincida
    // visualmente con el impacto, en lugar de aplicarse al primer frame.
    const attackCfg = this.config.actions.attack;
    const frameRate = attackCfg?.frameRate ?? 8;
    const framesAny = attackCfg?.frames as any;
    let frameCount  = 8;
    if (framesAny) {
      frameCount = typeof framesAny.end === 'number'
        ? framesAny.end - framesAny.start + 1
        : (Object.values(framesAny)[0] as any).end - (Object.values(framesAny)[0] as any).start + 1;
    }
    const hitDelay  = Math.round(frameCount * 0.4 / frameRate * 1000);
    const damage    = this.damage;

    this.mainScene.time.delayedCall(hitDelay, () => {
      if (this.isDead) return;
      this.mainScene.events.emit('enemyAttackPlayer', { damage });
    });

    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.isDead) return;
      this.state = 'idle';
      this.playAnim('idle');
    });
  }

  private resolveAttackAnim(): string {
    return 'attack';
  }

  // Flash blanco de impacto: tinte sólido un instante y restaurar el tinte propio
  private flashWhite(): void {
    this.sprite.setTintFill(0xffffff);
    this.mainScene.time.delayedCall(70, () => {
      if (!this.sprite.active) return;
      if (this.config.tint) this.sprite.setTint(this.config.tint);
      else this.sprite.clearTint();
    });
  }

  // Empujón corto alejándose del jugador (más fuerte en crítico).
  // Durante 'hurt' el update() no mueve al enemigo, así que el tween no compite.
  private applyKnockback(isCrit: boolean): void {
    if (!this.lastPlayerPos) return;
    const dx = this.sprite.x - this.lastPlayerPos.x;
    const dy = this.sprite.y - this.lastPlayerPos.y;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = isCrit ? 16 : 9;
    const nx = this.sprite.x + (dx / d) * push;
    const ny = this.sprite.y + (dy / d) * push;
    if (this.isTileBlocked(nx, ny)) return;

    this.mainScene.tweens.killTweensOf(this.sprite);
    this.mainScene.tweens.add({
      targets: this.sprite,
      x: nx, y: ny,
      duration: 90,
      ease: 'Power2',
      onComplete: () => {
        this.tilePos.set(
          Math.floor(this.sprite.x / GameScene.TILE_SIZE),
          Math.floor(this.sprite.y / GameScene.TILE_SIZE),
        );
      },
    });
  }

  private playHurt(): void {
    if (!this.config.actions.hurt) return;
    this.facePlayer();

    // Solo actualizar preHurtState cuando entramos desde un estado no-hurt.
    // Si ya estamos en hurt (golpe spam), conservamos el estado original para
    // que el enemigo pueda recuperarse correctamente al terminar la animación.
    if (this.state !== 'hurt') this.preHurtState = this.state;

    this.state = 'hurt';
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);

    // Llamar a sprite.play() directamente para forzar el reinicio aunque la
    // animación ya estuviese corriendo (playAnim tiene un guard que lo impediría).
    const cfg = this.config.actions['hurt'];
    const dir = (this.currentDir === Direction.NONE || !this.currentDir) ? Direction.DOWN : this.currentDir;
    const key = this.animService.enemyAnimKey(this.config.type, 'hurt', cfg.directional ? dir : undefined);
    if (this.mainScene.anims.exists(key)) this.sprite.play(key);

    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.isDead) return;
      this.state = this.preHurtState;
      this.playAnim(this.preHurtState);
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

  private showDamageNumber(amount: number, isCrit = false): void {
    const x    = this.sprite.x + Phaser.Math.Between(-30, 30);
    const y    = this.sprite.y - this.sprite.displayHeight * 0.38;
    const text = this.mainScene.add.text(x, y, `${amount}`, {
      fontSize:        isCrit ? '48px' : '28px',
      color:           isCrit ? '#b85c00' : '#ffd700',
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: isCrit ? 8 : 6,
    });
    text.setOrigin(0.5, 1).setDepth(5000);
    this.mainScene.tweens.add({
      targets:  text,
      y:        y - (isCrit ? 55 : 35),
      alpha:    0,
      duration: isCrit ? 900 : 700,
      ease:     'Power2',
      onComplete: () => text.destroy(),
    });
  }

  private ensureHPBar(): void {
    if (this.hpBarBg) return;
    this.hpBarBg = this.mainScene.add
      .rectangle(0, 0, BAR_W + 2, BAR_H + 2, 0x000000, 0.55)
      .setDepth(5000)
      .setOrigin(0.5, 0.5);
    this.hpBarFill = this.mainScene.add
      .rectangle(0, 0, BAR_W, BAR_H, 0x44cc44, 1)
      .setDepth(5000)
      .setOrigin(0, 0.5);
  }

  private drawHPBar(): void {
    if (!this.hpBarBg || !this.hpBarFill) return;
    const pct = Math.max(0, this.HP / this.maxHP);
    const cx  = this.sprite.x;
    const cy  = this.sprite.y - this.cachedDisplayHeight * BAR_ANCHOR - BAR_OFFSET;
    this.hpBarBg.setPosition(cx, cy);
    this.hpBarFill.setPosition(cx - BAR_W / 2, cy);

    // setSize y setFillStyle son costosos — solo actualizar cuando el HP cambia
    if (pct !== this.hpBarLastPct) {
      this.hpBarLastPct = pct;
      const color = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffcc00 : 0xff3333;
      this.hpBarFill.setSize(BAR_W * pct, BAR_H);
      this.hpBarFill.setFillStyle(color, 1);
    }
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

  // Bloquea movimiento de wander hacia el jugador. Chasing ignorado: el
  // enemigo necesita acercarse para atacar.
  private isPlayerBlocked(px: number, py: number): boolean {
    if (this.isChasing || !this.lastPlayerPos) return false;
    const HW    = GameScene.TILE_SIZE * 0.9;
    const bodyY = py - this.sprite.displayHeight * 0.4;
    return Math.abs(this.lastPlayerPos.x - px) < HW &&
           Math.abs(this.lastPlayerPos.y - bodyY) < HW;
  }

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
