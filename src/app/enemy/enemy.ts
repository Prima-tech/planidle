import { AnimationService } from "../scenes/gamescene/animation.service";
import { NATIVE_DPR } from "../scenes/gamescene/constants";
import { EnemyAttackKind, EnemyTypeConfig } from "./enemy-config";
import { EnemyBehavior } from "../scenes/gamescene/map-config";
import { GameScene } from "../scenes/gamescene/gamescene";
import { REGISTRY_KEYS } from "../scenes/game-registry";
import { Direction } from "../pnj/interfaces/Direction";
import { spawnFloatingText } from "../scenes/gamescene/floating-text";
import Phaser from 'phaser';

const Vector2 = Phaser.Math.Vector2;
type Vector2  = Phaser.Math.Vector2;

// Multiplicador global sobre la escala de cada tipo (ENEMY_REGISTRY)
const SCALE_BOOST = 1.15;

// Crítico de los enemigos al pegar al jugador: probabilidad (%) y multiplicador.
// El crítico empuja al jugador hacia atrás (knockback lo gestiona la GameScene).
const ENEMY_CRIT_CHANCE = 15;   // %
const ENEMY_CRIT_MULT   = 1.6;

// Distancia (en tiles) a la que el enemigo deja de perseguir y empieza a atacar.
const ATTACK_RANGE_TILES = 2;

// Esquiva posicional: si en el momento del impacto el jugador está más allá de este
// factor sobre el rango de ataque (se alejó/hizo dash durante el wind-up), el golpe
// falla y muestra "MISS". Da sentido a la telegrafía (anillo naranja) y al dash.
const MISS_RANGE_FACTOR = 1.25;

// Leash: si el jugador se aleja más de esto (tiles) del enemigo que le persigue,
// el enemigo abandona la caza, se cura del todo y vuelve a deambular por su zona
// (evita el aggro eterno y el "picoteo" huyendo).
const LEASH_TILES = 12;

// ── Arquetipos de ataque (attackKind del config) ─────────────────────────────
const RANGED_RANGE_TILES    = 4;    // rango por defecto al que dispara un 'ranged'
const KITE_RANGE_TILES      = 2.2;  // 'ranged': si el jugador se acerca a menos → retrocede
const PROJECTILE_SPEED_TILES = 7;   // velocidad del proyectil (tiles/s) — esquivable corriendo
const PROJECTILE_HIT_TILES  = 0.9;  // radio de impacto del proyectil al aterrizar
const SLAM_RADIUS_TILES     = 2.2;  // radio por defecto del área del slam
const SLAM_WINDUP_MIN_MS    = 650;  // un slam nunca telegrafía menos que esto (debe poder esquivarse)
const CHARGE_DIST_TILES     = 6;    // 'charge': longitud máxima de la embestida (o hasta el muro)
const CHARGE_SPEED_TILES    = 14;   // velocidad de la embestida (tiles/s)
const CHARGE_HIT_TILES      = 1.0;  // radio de atropello durante la embestida
const CHARGE_WIDTH_TILES    = 1.6;  // ancho visual de la línea telegrafiada

// Enrage: por debajo de este % de vida el enemigo se enfurece — wind-up y cooldown
// ×ENRAGE_MULT y tinte rojizo (si no tiene tint propio). Se le pasa al curarse (leash).
const ENRAGE_HP_PCT = 0.3;
const ENRAGE_MULT   = 0.8;
const ENRAGE_TINT   = 0xff9a8a;

// Élite/oblivion (detectados por sufijo del type): telegrafían más rápido y ganan
// patrones extra — élite melee: slam cada 3 golpes; oblivion melee: además dispara
// proyectil si el jugador está fuera del cuerpo a cuerpo (rango de inicio 4 tiles).
const ELITE_WINDUP_MULT    = 0.85;
const OBLIVION_WINDUP_MULT = 0.75;
const ELITE_SLAM_EVERY     = 3;
const OBLIVION_SLAM_EVERY  = 4;

const BAR_W      = 104;
const BAR_H      = 14;
const BAR_OFFSET = 4;
const BAR_BORDER = 5;   // marco exterior ≈2px CSS con la cámara a 0.4

// Texturas de la barra (pista + relleno) generadas una vez por sesión con el
// estilo exacto de la barra HP del HUD (top-bar): pista hundida $cell-border
// con borde $outline y relleno rojo en degradado con rayitas píxel.
const BAR_TEX_TRACK = 'enemy_hpbar_track';
const BAR_TEX_FILL  = 'enemy_hpbar_fill';
// La textura se genera a la resolución exacta a la que la cámara la pinta
// (zoom 0.4 × DPR): 1 texel = 1 píxel de canvas → separaciones nítidas
const BAR_RES = 0.4 * NATIVE_DPR;

function barRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function ensureBarTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(BAR_TEX_TRACK)) return;

  const W = BAR_W + BAR_BORDER * 2;
  const H = BAR_H + BAR_BORDER * 2;
  const track = scene.textures.createCanvas(BAR_TEX_TRACK, Math.ceil(W * BAR_RES), Math.ceil(H * BAR_RES))!;
  const t = track.context;
  t.setTransform(BAR_RES, 0, 0, BAR_RES, 0, 0);
  barRoundRect(t, 0, 0, W, H, 9);                         // borde $outline
  t.fillStyle = '#3a2c20';
  t.fill();
  barRoundRect(t, BAR_BORDER, BAR_BORDER, BAR_W, BAR_H, 6); // pista $cell-border
  t.fillStyle = '#21130e';
  t.fill();
  t.fillStyle = 'rgba(0, 0, 0, 0.55)';                    // sombra interior (hundida)
  t.fillRect(BAR_BORDER + 2, BAR_BORDER, BAR_W - 4, 3);
  track.refresh();

  const fill = scene.textures.createCanvas(BAR_TEX_FILL, Math.ceil(BAR_W * BAR_RES), Math.ceil(BAR_H * BAR_RES))!;
  const f = fill.context;
  f.setTransform(BAR_RES, 0, 0, BAR_RES, 0, 0);
  const grad = f.createLinearGradient(0, 0, 0, BAR_H);    // degradado del HUD
  grad.addColorStop(0,    '#e8604a');
  grad.addColorStop(0.55, '#c0392b');
  grad.addColorStop(1,    '#8e2418');
  barRoundRect(f, 0, 0, BAR_W, BAR_H, 4);
  f.fillStyle = grad;
  f.fill();
  f.fillStyle = 'rgba(0, 0, 0, 0.07)';                    // textura píxel vertical
  for (let x = 0; x < BAR_W; x += 8) f.fillRect(x, 0, 2, BAR_H);
  f.fillStyle = 'rgba(255, 255, 255, 0.3)';               // brillo superior
  f.fillRect(2, 1, BAR_W - 4, 2);
  f.fillStyle = 'rgba(0, 0, 0, 0.3)';                     // sombra inferior
  f.fillRect(2, BAR_H - 3, BAR_W - 4, 2);
  fill.refresh();
}
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

  // HP bar: dos Images sobre texturas pre-generadas (ensureBarTextures) —
  // setPosition/setCrop por frame, sin redibujar nada.
  private hpBarTrack: Phaser.GameObjects.Image | null = null;
  private hpBarFill:  Phaser.GameObjects.Image | null = null;
  private hpBarLastPct = -1;

  private attackTimer: number;
  private readonly speed: number;
  private readonly damage: number;
  private readonly attackCooldown: number;
  private readonly attackRangeSq: number;
  private readonly attackRangePx: number;
  private readonly layerCount: number;
  private readonly visionRadiusSq: number;
  private cachedDisplayHeight = 0;

  // Arquetipo de ataque (ver enemy-config): base + extras de élite/oblivion.
  private readonly attackKind: EnemyAttackKind;
  private readonly windUpMult: number;
  private readonly slamEvery: number;      // 0 = nunca hace slam secundario
  private readonly mixedRanged: boolean;   // oblivion melee: lejos → proyectil
  private readonly meleeRangeSq: number;   // rango cuerpo a cuerpo (2 tiles)
  private readonly noFlinch: boolean;      // aplomo: sin hurt ni retroceso al recibir
  private readonly canEnrage: boolean;     // solo los tipos con enrages: true en config
  private attackCount = 0;
  private enraged = false;                 // furia por vida baja (< ENRAGE_HP_PCT)
  private slamFx: Phaser.GameObjects.Shape[] = [];   // telegrafía del slam/charge en curso

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
    // Obstáculos dinámicos (rocas/árboles/edificios) que NO están en el tilemap.
    // Es la MISMA referencia que usa GridPhysics para el jugador; al mutarse (nodo
    // destruido), el enemigo ve el cambio en vivo. Sin esto, los enemigos atraviesan
    // las rocas/árboles/edificios porque solo miraban el `collides` del tilemap.
    private collisionTiles: Set<string> = new Set(),
  ) {
    this.type           = config.type;
    this.HP             = config.hp;
    this.maxHP          = config.hp;
    this.speed          = config.speed;
    this.damage         = config.damage;
    this.attackCooldown = config.attackCooldown;
    this.attackTimer    = this.attackCooldown;

    // Arquetipo de ataque + extras por tier (sufijo del type)
    const isElite    = config.type.endsWith('_elite');
    const isOblivion = config.type.endsWith('_oblivion');
    this.attackKind  = config.attackKind ?? 'melee';
    this.mixedRanged = isOblivion && this.attackKind === 'melee';
    this.slamEvery   = config.slamEvery ?? (this.attackKind !== 'melee' ? 0
      : isElite ? ELITE_SLAM_EVERY : isOblivion ? OBLIVION_SLAM_EVERY : 0);
    this.windUpMult  = isElite ? ELITE_WINDUP_MULT : isOblivion ? OBLIVION_WINDUP_MULT : 1;
    this.noFlinch    = config.noFlinch ?? (isElite || isOblivion);
    this.canEnrage   = config.enrages ?? false;

    const rangeTiles = config.attackRangeTiles
      ?? ((this.attackKind === 'ranged' || this.attackKind === 'charge' || this.mixedRanged)
        ? RANGED_RANGE_TILES : ATTACK_RANGE_TILES);
    this.attackRangePx  = rangeTiles * GameScene.TILE_SIZE;
    this.attackRangeSq  = this.attackRangePx * this.attackRangePx;
    const meleeRange    = ATTACK_RANGE_TILES * GameScene.TILE_SIZE;
    this.meleeRangeSq   = meleeRange * meleeRange;
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

  /** Abandona la caza (leash): cura al máximo, quita la barra de HP y vuelve a deambular. */
  private dropChase(): void {
    this.isChasing = false;
    this.HP = this.maxHP;
    // Al curarse se le pasa la furia (y su tinte, si no tiene uno propio)
    if (this.enraged) {
      this.enraged = false;
      if (!this.config.tint && this.sprite.active) this.sprite.clearTint();
    }
    this.hpBarTrack?.destroy();
    this.hpBarFill?.destroy();
    this.hpBarTrack = null;
    this.hpBarFill = null;
    this.hpBarLastPct = -1;
    this.hasWanderTarget = false;
    if (this.state !== 'hurt') this.setState('idle');
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

    // Leash: el jugador se fue demasiado lejos → abandonar la caza.
    if (this.isChasing) {
      const ldx = this.sprite.x - playerPos.x;
      const ldy = this.sprite.y - playerPos.y;
      const leash = LEASH_TILES * GameScene.TILE_SIZE;
      if (ldx * ldx + ldy * ldy > leash * leash) this.dropChase();
    }

    this.sprite.setDepth(this.sprite.y);
    if (this.hpBarTrack) this.drawHPBar();

    // El cooldown de ataque corre siempre que el jugador esté a rango, AUNQUE el
    // enemigo esté en 'hurt'. Si solo corriera fuera de 'hurt', recibir golpes
    // seguidos lo stun-lockearía y nunca llegaría a pegar.
    if (this.isChasing) {
      const adx = playerPos.x - this.sprite.x;
      const ady = playerPos.y - this.sprite.y;
      if (adx * adx + ady * ady < this.attackRangeSq) {
        if (this.state !== 'attack') {
          this.attackTimer -= delta;
          if (this.attackTimer <= 0) {
            this.attackTimer = this.currentCooldown();
            this.performAttack();
            return;
          }
        }
      } else {
        this.attackTimer = this.currentCooldown();
      }
    }

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
    this.spawnHitSpark(isCrit);
    if (this.HP <= 0) { this.die(); return; }
    if (this.canEnrage && !this.enraged && this.HP <= this.maxHP * ENRAGE_HP_PCT) this.enrage();
    // Aplomo (golem, élites, oblivion): encaja el golpe sin inmutarse — ni animación
    // de daño ni retroceso. Sin esto, el spam de golpes los tenía temblequeando
    // mientras cargaban sus ataques y parecían débiles.
    if (this.noFlinch) return;
    this.applyKnockback(isCrit);
    this.playHurt();
  }

  /** Furia por vida baja: telegrafiía y ataca ×0.8 más rápido; aviso con anillo rojo
   *  + "ENRAGE" + tinte rojizo (solo si no tiene tint propio de élite/oblivion). */
  private enrage(): void {
    this.enraged = true;
    spawnFloatingText(this.mainScene, this.sprite.x, this.sprite.y - this.sprite.displayHeight * 0.55,
      'ENRAGE', { fontSize: 24, color: '#ff5a3c', strokeThickness: 5, rise: 40, duration: 800 });
    const ring = this.mainScene.add.circle(this.sprite.x, this.getCollisionY(), 12, 0xff5a3c, 0);
    ring.setStrokeStyle(4, 0xff5a3c, 0.9);
    ring.setDepth(4500);
    this.mainScene.tweens.add({
      targets: ring, scale: 3.2, alpha: 0, duration: 320, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    if (!this.config.tint) this.sprite.setTint(ENRAGE_TINT);
  }

  /** Cooldown efectivo entre ataques (la furia lo acorta). */
  private currentCooldown(): number {
    return this.enraged ? Math.round(this.attackCooldown * ENRAGE_MULT) : this.attackCooldown;
  }

  isChasingPlayer(): boolean { return this.isChasing; }

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

    // Kiting: los 'ranged' puros mantienen la distancia de tiro — si te acercas
    // demasiado retroceden (hasta topar con un muro: ahí se les acorrala). Siguen
    // disparando mientras huyen (el ciclo de ataque va aparte, en update()).
    if (this.attackKind === 'ranged' && dist < KITE_RANGE_TILES * GameScene.TILE_SIZE) {
      this.move(sx, sy, -dx, -dy, dist, delta);
      return;
    }

    if (dist < this.attackRangePx) {
      // En rango de ataque: el cooldown/ataque lo gestiona update(); aquí solo encarar.
      const dirToPlayer = this.cardinalDir(dx, dy);
      if (dirToPlayer !== this.currentDir) {
        this.currentDir = dirToPlayer;
        if (this.state === 'idle') this.playAnim('idle');
      }
      this.setState('idle');
      return;
    }

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
    this.sprite.setScale(this.config.scale * SCALE_BOOST);
    this.sprite.setPosition(
      this.tilePos.x * GameScene.TILE_SIZE + offsetX,
      this.tilePos.y * GameScene.TILE_SIZE + offsetY,
    );
    if (this.config.tint) this.sprite.setTint(this.config.tint);
    this.cachedDisplayHeight = this.sprite.displayHeight;

    // Pop-in: entra con un escalado elástico (Back.Out sobre-rebota) + fade, en vez de
    // aparecer de golpe. Arranca en 0.5× (no 0×) para que, en el caso raro de recibir un
    // golpe durante el tween — el knockback hace killTweensOf(sprite) — no quede diminuto.
    const baseScale = this.config.scale * SCALE_BOOST;
    this.sprite.setScale(baseScale * 0.5);
    this.sprite.setAlpha(0.35);
    this.mainScene.tweens.add({
      targets: this.sprite, scaleX: baseScale, scaleY: baseScale, alpha: 1,
      duration: 200, ease: 'Back.Out',
    });
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
    // El ataque puede arrancar mientras el enemigo estaba en 'hurt': descarta el
    // handler de recuperación pendiente para que no compita con el del ataque.
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);

    const animName = this.resolveAttackAnim();
    const played   = this.playAnim(animName);

    if (!played) {
      this.state = 'idle';
      this.playAnim('idle');
      return;
    }

    // Arquetipo de ESTE golpe (melee/ranged/slam según base, contador de slam y distancia)
    const kind = this.chooseAttackKind();

    // Wind-up: ms desde que arranca el golpe hasta el impacto. Config windUpMs (o el
    // ~40% "natural" de la anim); un slam secundario (élites melee) respeta un mínimo
    // esquivable; élite/oblivion telegrafían más rápido (windUpMult).
    const natural = this.attackImpactMs();
    let windUp = this.config.windUpMs ?? natural;
    if (kind === 'slam' && this.attackKind !== 'slam') windUp = Math.max(SLAM_WINDUP_MIN_MS, windUp);
    windUp = Math.round(windUp * this.windUpMult);
    if (this.enraged) windUp = Math.round(windUp * ENRAGE_MULT);

    // Sincroniza la anim con el wind-up: el frame de impacto (~40%) cae EN el impacto.
    // Se restaura a 1 al terminar el ataque (y en hurt/death, que lo interrumpen).
    this.sprite.anims.timeScale = Phaser.Math.Clamp(natural / windUp, 0.2, 3);

    const isCrit = Math.random() * 100 < ENEMY_CRIT_CHANCE;
    const damage = Math.floor(this.damage * (isCrit ? ENEMY_CRIT_MULT : 1));

    // La embestida gestiona su propio flujo (telegrafía en línea + dash con tween):
    // no debe registrar el handler genérico de ANIMATION_COMPLETE, porque el dash
    // sigue vivo cuando la anim de ataque termina.
    if (kind === 'charge') {
      this.startCharge(damage, isCrit, windUp);
      return;
    }

    // Centro del slam fijado al INICIO (el enemigo no se mueve durante 'attack'):
    // el área que ves crecer es exactamente la que daña.
    const slamX = this.sprite.x;
    const slamY = this.getCollisionY();
    const slamR = (this.config.slamRadiusTiles ?? SLAM_RADIUS_TILES) * GameScene.TILE_SIZE;

    if (kind === 'slam') this.spawnSlamTelegraph(slamX, slamY, slamR, windUp);
    else this.spawnAttackTell();   // anillo pequeño: "va a pegar/disparar"

    this.mainScene.time.delayedCall(windUp, () => {
      if (this.isDead) return;
      if (kind === 'ranged')    this.launchProjectile(damage, isCrit);
      else if (kind === 'slam') this.slamImpact(slamX, slamY, slamR, damage, isCrit);
      else                      this.meleeImpact(damage, isCrit);
    });

    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.sprite.anims.timeScale = 1;
      if (this.isDead) return;
      this.state = 'idle';
      this.playAnim('idle');
    });
  }

  /** Momento "natural" del impacto: ~40% de la duración de la anim de ataque. */
  private attackImpactMs(): number {
    const attackCfg = this.config.actions.attack;
    const frameRate = attackCfg?.frameRate ?? 8;
    const framesAny = attackCfg?.frames as any;
    let frameCount  = 8;
    if (framesAny) {
      frameCount = typeof framesAny.end === 'number'
        ? framesAny.end - framesAny.start + 1
        : (Object.values(framesAny)[0] as any).end - (Object.values(framesAny)[0] as any).start + 1;
    }
    return Math.round(frameCount * 0.4 / frameRate * 1000);
  }

  /** Decide el arquetipo de este golpe concreto:
   *  - slam secundario cada slamEvery golpes (élite/oblivion melee), solo si el
   *    jugador está a rango cuerpo a cuerpo (si no, el área no le alcanzaría);
   *  - oblivion melee con el jugador lejos → proyectil;
   *  - si no, el arquetipo base del config. */
  private chooseAttackKind(): EnemyAttackKind {
    this.attackCount++;
    const p = this.lastPlayerPos;
    const nearSq = p
      ? (p.x - this.sprite.x) ** 2 + (p.y - this.sprite.y) ** 2
      : Infinity;
    if (this.slamEvery > 0 && this.attackCount % this.slamEvery === 0 && nearSq <= this.meleeRangeSq) {
      return 'slam';
    }
    if (this.mixedRanged && nearSq > this.meleeRangeSq) return 'ranged';
    return this.attackKind;
  }

  /** Embestida: fija la dirección hacia el jugador AL EMPEZAR, telegrafía la línea
   *  del recorrido real (hasta CHARGE_DIST_TILES o el primer muro) y, tras el
   *  wind-up, sale disparado por ella con la anim de correr. Quedarse en la línea =
   *  atropello con empujón; esquivable moviéndose en perpendicular. Un golpe tuyo
   *  durante el dash lo interrumpe (el knockback mata el tween). */
  private startCharge(damage: number, isCrit: boolean, windUp: number): void {
    const p = this.lastPlayerPos;
    if (!p) {
      this.sprite.anims.timeScale = 1;
      this.state = 'idle';
      this.playAnim('idle');
      return;
    }
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const dx = p.x - sx;
    const dy = p.y - sy;
    const d  = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;

    // Recorrido real: hasta la distancia máxima o el primer tile bloqueado
    const maxDist = CHARGE_DIST_TILES * GameScene.TILE_SIZE;
    const step    = GameScene.TILE_SIZE / 2;
    let travel = maxDist;
    for (let s = step; s <= maxDist; s += step) {
      if (this.isTileBlocked(sx + nx * s, sy + ny * s)) { travel = s - step; break; }
    }
    const ex = sx + nx * travel;
    const ey = sy + ny * travel;

    // Telegrafía: rectángulo del recorrido que se "carga" (más opaco al final)
    const width = CHARGE_WIDTH_TILES * GameScene.TILE_SIZE;
    const lane = this.mainScene.add.rectangle(sx, sy, travel, width, 0xff5a3c, 0.12);
    lane.setOrigin(0, 0.5);
    lane.setRotation(Math.atan2(ny, nx));
    lane.setStrokeStyle(3, 0xff5a3c, 0.7);
    lane.setDepth(4500);
    this.mainScene.tweens.add({ targets: lane, fillAlpha: 0.3, duration: windUp, ease: 'Quad.easeIn' });
    this.slamFx = [lane];   // misma limpieza que el slam (impacto llegado o muerte)

    this.mainScene.time.delayedCall(windUp, () => {
      this.clearSlamTelegraph();
      if (this.isDead) return;
      // Dash: anim de correr a velocidad normal; 'attack' bloquea updateChase
      // (un hurt durante el wind-up pudo devolver el estado a idle).
      this.state = 'attack';
      this.sprite.anims.timeScale = 1;
      if (!this.playAnim('run')) this.playAnim('walk');

      let hit = false;
      this.mainScene.tweens.add({
        targets: this.sprite,
        x: ex, y: ey,
        duration: (travel / (CHARGE_SPEED_TILES * GameScene.TILE_SIZE)) * 1000,
        ease: 'Linear',
        onUpdate: () => {
          if (hit || this.isDead) return;
          const q = this.lastPlayerPos;
          if (!q) return;
          const hdx = q.x - this.sprite.x;
          const hdy = q.y - this.sprite.y;
          const hitR = CHARGE_HIT_TILES * GameScene.TILE_SIZE;
          if (hdx * hdx + hdy * hdy <= hitR * hitR) {
            hit = true;   // un solo atropello por embestida
            this.mainScene.events.emit('enemyAttackPlayer', {
              damage, isCrit, sourceX: this.sprite.x, sourceY: this.sprite.y, knockback: true,
            });
          }
        },
        onComplete: () => {
          if (this.isDead) return;
          this.tilePos.set(
            Math.floor(this.sprite.x / GameScene.TILE_SIZE),
            Math.floor(this.sprite.y / GameScene.TILE_SIZE),
          );
          this.state = 'idle';
          this.playAnim('idle');
        },
      });
    });
  }

  /** Impacto melee: esquiva posicional — si el jugador salió del rango durante el
   *  wind-up (andando o con dash), el golpe falla → la telegrafía sirve. */
  private meleeImpact(damage: number, isCrit: boolean): void {
    if (this.lastPlayerPos) {
      const pdx = this.lastPlayerPos.x - this.sprite.x;
      const pdy = this.lastPlayerPos.y - this.sprite.y;
      const missR = ATTACK_RANGE_TILES * GameScene.TILE_SIZE * MISS_RANGE_FACTOR;
      if (pdx * pdx + pdy * pdy > missR * missR) {
        spawnFloatingText(this.mainScene, this.sprite.x, this.sprite.y - this.sprite.displayHeight * 0.5,
          'MISS', { fontSize: 22, color: '#d8d8d8', strokeThickness: 5 });
        return;
      }
    }
    this.mainScene.events.emit('enemyAttackPlayer', {
      damage, isCrit, sourceX: this.sprite.x, sourceY: this.sprite.y,
    });
  }

  /** Proyectil hacia el punto donde ESTÁ el jugador al disparar (no le persigue):
   *  moverse antes de que llegue = esquivado. Visual: sprite del config
   *  (projectileSpriteKey) si existe; si no, bola procedural — halo pulsante del
   *  color del enemigo + núcleo blanco + estela de puntos. Al aterrizar, estallido
   *  (grande si acierta, pequeño si muerde el suelo). */
  private launchProjectile(damage: number, isCrit: boolean): void {
    const p = this.lastPlayerPos;
    if (!p) return;
    const sx = this.sprite.x;
    const sy = this.sprite.y - this.sprite.displayHeight * 0.35;
    const tx = p.x;   // snapshot: lastPlayerPos es una referencia viva que muta cada frame
    const ty = p.y;
    const color = this.config.tint ?? 0x9be04a;

    // Fogonazo de salida
    const muzzle = this.mainScene.add.circle(sx, sy, 10, 0xffffff, 0.8).setDepth(5001);
    this.mainScene.tweens.add({
      targets: muzzle, scale: 1.8, alpha: 0, duration: 120, ease: 'Quad.easeOut',
      onComplete: () => muzzle.destroy(),
    });

    const parts: Phaser.GameObjects.Components.Transform[] = [];
    let trailTimer: Phaser.Time.TimerEvent | null = null;
    const key = this.config.projectileSpriteKey;
    if (key && this.mainScene.textures.exists(key)) {
      const spr = this.mainScene.add.sprite(sx, sy, key);
      spr.setDepth(5000).setScale(2);
      spr.setRotation(Math.atan2(ty - sy, tx - sx));
      if (this.mainScene.anims.exists(key)) spr.play(key);
      parts.push(spr);
    } else {
      const halo = this.mainScene.add.circle(sx, sy, 13, color, 0.35).setDepth(4999);
      const core = this.mainScene.add.circle(sx, sy, 6, 0xffffff, 1).setDepth(5000);
      core.setStrokeStyle(3, color, 1);
      // Respiración del halo mientras vuela
      this.mainScene.tweens.add({ targets: halo, scale: 1.35, duration: 140, yoyo: true, repeat: -1 });
      // Estela: puntitos que quedan atrás encogiéndose
      trailTimer = this.mainScene.time.addEvent({
        delay: 50, loop: true,
        callback: () => {
          if (!core.active) return;
          const dot = this.mainScene.add.circle(core.x, core.y, 4, color, 0.5).setDepth(4998);
          this.mainScene.tweens.add({
            targets: dot, scale: 0.2, alpha: 0, duration: 260, ease: 'Quad.easeOut',
            onComplete: () => dot.destroy(),
          });
        },
      });
      parts.push(halo, core);
    }

    const dist = Math.hypot(tx - sx, ty - sy) || 1;
    this.mainScene.tweens.add({
      targets: parts,
      x: tx,
      y: ty - GameScene.TILE_SIZE * 0.4,   // apunta al torso, el impacto se mide a ras de suelo
      duration: (dist / (PROJECTILE_SPEED_TILES * GameScene.TILE_SIZE)) * 1000,
      ease: 'Linear',
      onComplete: () => {
        trailTimer?.remove();
        parts.forEach(o => {
          const go = o as any;
          if (go.active) { this.mainScene.tweens.killTweensOf(go); go.destroy(); }
        });
        const q = this.lastPlayerPos;
        const hitR = PROJECTILE_HIT_TILES * GameScene.TILE_SIZE;
        const hit = !!q && (q.x - tx) ** 2 + (q.y - ty) ** 2 <= hitR * hitR;
        this.projectileBurst(tx, ty, color, hit);
        if (hit) {
          this.mainScene.events.emit('enemyAttackPlayer', { damage, isCrit, sourceX: tx, sourceY: ty });
        }
      },
    });
  }

  /** Estallido al aterrizar el proyectil: anillo + esquirlas radiales del color del
   *  enemigo. Acierto = más grande; fallo = mordisco pequeño al suelo. */
  private projectileBurst(x: number, y: number, color: number, hit: boolean): void {
    const ring = this.mainScene.add.circle(x, y, hit ? 12 : 8, color, 0).setDepth(5000);
    ring.setStrokeStyle(3, color, 0.9);
    this.mainScene.tweens.add({
      targets: ring, scale: hit ? 2.6 : 1.8, alpha: 0, duration: 240, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    const n = hit ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const chip = this.mainScene.add.circle(x, y, Phaser.Math.Between(2, 4), color, 0.9).setDepth(5000);
      const ang  = (Math.PI * 2 * i) / n + Phaser.Math.FloatBetween(-0.4, 0.4);
      const d    = Phaser.Math.Between(14, 30);
      this.mainScene.tweens.add({
        targets: chip,
        x: x + Math.cos(ang) * d,
        y: y + Math.sin(ang) * d * 0.7,   // achatado (perspectiva)
        alpha: 0, scale: 0.3,
        duration: Phaser.Math.Between(180, 300), ease: 'Quad.easeOut',
        onComplete: () => chip.destroy(),
      });
    }
  }

  /** Telegrafía del slam. Lectura en tres capas:
   *  - `edge`: contorno del ÁREA REAL, visible desde el primer instante (sabes ya
   *    de dónde tienes que salir);
   *  - `zone`: relleno que crece del centro al borde durante el wind-up — es la
   *    "barra de progreso" del golpe, y se va cargando (más opaco al final);
   *  - `pulse`: anillos que se CONTRAEN hacia el enemigo (está cogiendo fuerza).
   *  Todo se destruye al llegar el impacto (o en die() si muere a mitad). */
  private spawnSlamTelegraph(x: number, y: number, radius: number, windUp: number): void {
    this.clearSlamTelegraph();

    const edge = this.mainScene.add.circle(x, y, radius, 0xff5a3c, 0);
    edge.setStrokeStyle(3, 0xff5a3c, 0.55);
    edge.setDepth(4500);

    const zone = this.mainScene.add.circle(x, y, radius, 0xff5a3c, 0.10);
    zone.setDepth(4500);
    zone.setScale(0.12);
    this.mainScene.tweens.add({
      targets: zone, scale: 1, fillAlpha: 0.26, duration: windUp, ease: 'Quad.easeIn',
    });

    const pulse = this.mainScene.add.circle(x, y, radius, 0xffb45a, 0);
    pulse.setStrokeStyle(2, 0xffb45a, 0.85);
    pulse.setDepth(4501);
    this.mainScene.tweens.add({
      targets: pulse,
      scale: { from: 1, to: 0.08 },
      alpha: { from: 0.85, to: 0.1 },
      duration: 340, repeat: -1, ease: 'Quad.easeIn',
    });

    this.slamFx = [edge, zone, pulse];
  }

  /** Destruye la telegrafía del slam en curso (impacto llegado o enemigo muerto). */
  private clearSlamTelegraph(): void {
    this.slamFx.forEach(o => { if (o.active) { this.mainScene.tweens.killTweensOf(o); o.destroy(); } });
    this.slamFx = [];
  }

  /** Impacto del slam: destello del suelo + doble onda + escombros radiales + polvo
   *  + temblor. Con slamSpriteKey en el config, además reproduce esa anim escalada
   *  al diámetro del área. Daña si el jugador sigue dentro. */
  private slamImpact(x: number, y: number, radius: number, damage: number, isCrit: boolean): void {
    this.clearSlamTelegraph();

    // Anim de arte propio si el config la define y está cargada
    const key = this.config.slamSpriteKey;
    if (key && this.mainScene.textures.exists(key)) {
      const spr = this.mainScene.add.sprite(x, y, key).setDepth(4502);
      spr.setDisplaySize(radius * 2.2, radius * 2.2);
      if (this.mainScene.anims.exists(key)) {
        spr.play(key);
        spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.destroy());
      } else {
        this.mainScene.tweens.add({ targets: spr, alpha: 0, duration: 400, onComplete: () => spr.destroy() });
      }
    }

    // Destello del suelo (toda el área, un instante)
    const flash = this.mainScene.add.circle(x, y, radius, 0xffd9a0, 0.35).setDepth(4500);
    this.mainScene.tweens.add({
      targets: flash, alpha: 0, scale: 1.05, duration: 170, ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Doble onda de choque: gruesa naranja + fina blanca con retardo
    const ring1 = this.mainScene.add.circle(x, y, radius, 0xffffff, 0).setDepth(4501);
    ring1.setStrokeStyle(6, 0xffb45a, 0.95);
    ring1.setScale(0.25);
    this.mainScene.tweens.add({
      targets: ring1, scale: 1, alpha: 0, duration: 240, ease: 'Quad.easeOut',
      onComplete: () => ring1.destroy(),
    });
    const ring2 = this.mainScene.add.circle(x, y, radius, 0xffffff, 0).setDepth(4501);
    ring2.setStrokeStyle(2, 0xffffff, 0.8);
    ring2.setScale(0.2);
    this.mainScene.tweens.add({
      targets: ring2, scale: 1.15, alpha: 0, duration: 330, delay: 50, ease: 'Quad.easeOut',
      onComplete: () => ring2.destroy(),
    });

    // Escombros radiales (tierra) + motas de polvo que suben
    for (let i = 0; i < 8; i++) {
      const chip = this.mainScene.add.circle(x, y, Phaser.Math.Between(3, 5),
        i % 2 ? 0x8a6a4a : 0xffb45a, 0.95).setDepth(4502);
      const ang = (Math.PI * 2 * i) / 8 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const d   = radius * Phaser.Math.FloatBetween(0.5, 0.95);
      this.mainScene.tweens.add({
        targets: chip,
        x: x + Math.cos(ang) * d,
        y: y + Math.sin(ang) * d * 0.7 - Phaser.Math.Between(4, 14),   // achatado + saltito
        alpha: 0, scale: 0.4,
        duration: Phaser.Math.Between(260, 420), ease: 'Quad.easeOut',
        onComplete: () => chip.destroy(),
      });
    }
    for (let i = 0; i < 3; i++) {
      const dust = this.mainScene.add.circle(
        x + Phaser.Math.Between(-radius * 0.5, radius * 0.5),
        y - Phaser.Math.Between(0, 8),
        Phaser.Math.Between(6, 10), 0xcbb79a, 0.35).setDepth(4502);
      this.mainScene.tweens.add({
        targets: dust, y: dust.y - Phaser.Math.Between(18, 34), scale: 1.8, alpha: 0,
        duration: Phaser.Math.Between(380, 560), delay: i * 60, ease: 'Sine.easeOut',
        onComplete: () => dust.destroy(),
      });
    }

    const fx = this.mainScene.game.registry.get(REGISTRY_KEYS.GAME_SETTINGS)?.screenShake ?? true;
    if (fx) this.mainScene.cameras.main.shake(140, 0.005);

    const p = this.lastPlayerPos;
    if (p && (p.x - x) ** 2 + (p.y - y) ** 2 <= radius * radius) {
      this.mainScene.events.emit('enemyAttackPlayer', { damage, isCrit, sourceX: x, sourceY: y });
    }
  }

  private resolveAttackAnim(): string {
    return 'attack';
  }

  // Énfasis al matar un enemigo especial (élite/oblivion): shake fuerte + destello
  // blanco + micro cámara-lenta (freeze real ~90ms, igual patrón que el crítico del player).
  private specialKillFeedback(): void {
    // El temblor/destello respetan el ajuste "screenShake"; la micro-pausa se mantiene
    // (es hit-stop, no un efecto visual molesto).
    const fx = this.mainScene.game.registry.get(REGISTRY_KEYS.GAME_SETTINGS)?.screenShake ?? true;
    if (fx) {
      const cam = this.mainScene.cameras.main;
      cam.shake(220, 0.009);
      cam.flash(180, 255, 255, 255);
    }
    this.mainScene.scene.pause();
    setTimeout(() => this.mainScene.scene.resume(), 90);
  }

  // Estallido de muerte: destello + anillo expansivo + trozos radiales (del color del
  // enemigo). Objetos propios de vida corta → coste GPU mínimo. El loot ya sale volando
  // aparte (gridDrops.spawnDrop con `from` = enemigo).
  private spawnDeathPop(): void {
    const cx = this.sprite.x;
    const cy = this.sprite.y - this.sprite.displayHeight * 0.25;

    const flash = this.mainScene.add.circle(cx, cy, 16, 0xffffff, 0.9);
    flash.setDepth(6000);
    this.mainScene.tweens.add({
      targets: flash, scale: 2.2, alpha: 0, duration: 190, ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    const ring = this.mainScene.add.circle(cx, cy, 10, 0xffffff, 0);
    ring.setStrokeStyle(4, 0xffffff, 0.85);
    ring.setDepth(6000);
    this.mainScene.tweens.add({
      targets: ring, scale: 4, alpha: 0, duration: 320, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    const color = this.config.tint ?? 0xffffff;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const chip = this.mainScene.add.circle(cx, cy, Phaser.Math.Between(3, 6), color, 1);
      chip.setDepth(6000);
      const ang  = (Math.PI * 2 * i) / n + Phaser.Math.FloatBetween(-0.3, 0.3);
      const dist = Phaser.Math.Between(30, 62);
      this.mainScene.tweens.add({
        targets: chip,
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist * 0.7,   // achatado (perspectiva)
        alpha: 0, scale: 0.3,
        duration: Phaser.Math.Between(260, 420), ease: 'Quad.easeOut',
        onComplete: () => chip.destroy(),
      });
    }
  }

  // Chispa blanca de impacto al recibir un golpe: círculo que crece y se desvanece
  // (objeto propio, no toca el sprite → no compite con el knockback). Más grande en crítico.
  private spawnHitSpark(isCrit: boolean): void {
    const x = this.sprite.x + Phaser.Math.Between(-8, 8);
    const y = this.sprite.y - this.sprite.displayHeight * 0.30;
    const spark = this.mainScene.add.circle(x, y, isCrit ? 12 : 8, 0xffffff, 0.9);
    spark.setDepth(6000);
    this.mainScene.tweens.add({
      targets: spark, scale: isCrit ? 3.2 : 2.2, alpha: 0,
      duration: isCrit ? 260 : 170, ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  // Telegrafía de ataque: anillo naranja que se expande bajo el enemigo justo al
  // iniciar el golpe, para que el jugador lo lea venir (objeto propio, sin riesgo).
  private spawnAttackTell(): void {
    const x = this.sprite.x;
    const y = this.sprite.y - this.sprite.displayHeight * 0.22;
    const ring = this.mainScene.add.circle(x, y, 8, 0xff5a3c, 0);
    ring.setStrokeStyle(3, 0xff5a3c, 0.9);
    ring.setDepth(4500);
    this.mainScene.tweens.add({
      targets: ring, scale: 3.4, alpha: 0, duration: 300, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  // Flash blanco de impacto: tinte sólido un instante y restaurar el tinte propio
  private flashWhite(): void {
    this.sprite.setTintFill(0xffffff);
    this.mainScene.time.delayedCall(70, () => {
      if (!this.sprite.active) return;
      if (this.config.tint) this.sprite.setTint(this.config.tint);
      else if (this.enraged) this.sprite.setTint(ENRAGE_TINT);   // conserva el tinte de furia
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
    // 'attack' nunca se conserva: recuperar a 'attack' dejaría al enemigo
    // atascado reproduciendo el ataque sin handler de salida → vuelve a 'idle'.
    if (this.state !== 'hurt') this.preHurtState = this.state === 'attack' ? 'idle' : this.state;

    this.state = 'hurt';
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.sprite.anims.timeScale = 1;   // por si interrumpe un ataque con wind-up escalado

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
    this.spawnDeathPop();   // estallido al morir (el loot ya sale volando aparte)
    this.mainScene.game.registry.get(REGISTRY_KEYS.AUDIO)?.play('enemy_death');
    // Kills especiales (élite/oblivion): énfasis extra para que se sientan un evento.
    if (this.type.endsWith('_elite') || this.type.endsWith('_oblivion')) this.specialKillFeedback();
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.sprite.anims.timeScale = 1;   // por si muere a mitad de un ataque escalado
    this.clearSlamTelegraph();         // no dejar el círculo rojo huérfano en el suelo
    this.hpBarTrack?.destroy();
    this.hpBarFill?.destroy();
    this.hpBarTrack = null;
    this.hpBarFill = null;

    const center = this.sprite.getCenter();
    const type   = this.config.type;

    if (this.config.actions.death) {
      this.playAnim('death');
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        // El cadáver (último frame de la muerte) se queda un rato y luego se
        // desvanece; el drop cae justo al desaparecer.
        this.mainScene.tweens.add({
          targets: this.sprite, alpha: 0, duration: 400, delay: 1400,
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
    spawnFloatingText(this.mainScene,
      this.sprite.x + Phaser.Math.Between(-30, 30),
      this.sprite.y - this.sprite.displayHeight * 0.38,
      `${amount}`, {
        fontSize:        isCrit ? 48 : 28,
        color:           isCrit ? '#b85c00' : '#ffd700',
        strokeThickness: isCrit ? 8 : 6,
        rise:            isCrit ? 55 : 35,
        duration:        isCrit ? 900 : 700,
      });
  }

  private ensureHPBar(): void {
    if (this.hpBarTrack) return;
    ensureBarTextures(this.mainScene);
    // setScale(1/BAR_RES): la textura de alta resolución vuelve a medidas de
    // mundo y queda 1:1 con el píxel del canvas al renderizar
    this.hpBarTrack = this.mainScene.add.image(0, 0, BAR_TEX_TRACK)
      .setDepth(5000)
      .setScale(1 / BAR_RES);
    this.hpBarFill = this.mainScene.add.image(0, 0, BAR_TEX_FILL)
      .setDepth(5001)
      .setOrigin(0, 0.5)
      .setScale(1 / BAR_RES);
  }

  private drawHPBar(): void {
    if (!this.hpBarTrack || !this.hpBarFill) return;
    const pct = Math.max(0, this.HP / this.maxHP);
    const cx  = this.sprite.x;
    const cy  = this.sprite.y - this.cachedDisplayHeight * BAR_ANCHOR - BAR_OFFSET;

    this.hpBarTrack.setPosition(cx, cy);
    this.hpBarFill.setPosition(cx - BAR_W / 2, cy);

    // setCrop solo cuando cambia el HP: recorta el relleno por porcentaje
    // (coordenadas de crop en px de textura, no de mundo)
    if (pct !== this.hpBarLastPct) {
      this.hpBarLastPct = pct;
      this.hpBarFill.setCrop(0, 0, Math.round(BAR_W * BAR_RES * pct), Math.ceil(BAR_H * BAR_RES));
      this.hpBarFill.setVisible(pct > 0);
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
    // Obstáculos dinámicos (rocas/árboles/edificios), igual que GridPhysics.
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
