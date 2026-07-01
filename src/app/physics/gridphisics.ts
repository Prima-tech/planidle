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

  /** Corta cualquier movimiento o dash en curso y deja al jugador parado en idle.
   *  Usado al tocar un portal: el personaje frena en seco durante el fundido. */
  stop(): void {
    if (this.isDashing) {
      this.isDashing = false;
      this.player.endDash();
    }
    this.movementIntent = Direction.NONE;
    if (this.isWalking) {
      this.player.stopAnimation(this.currentAnimDirection);
      this.isWalking = false;
    }
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

    const enemyBlockFull = ignoreEnemies ? false : this.isEnemyBlockedXY(px + dx, py + dy, px, py);
    const enemyBlockX    = ignoreEnemies ? false : this.isEnemyBlockedXY(px + dx, py,      px, py);
    const enemyBlockY    = ignoreEnemies ? false : this.isEnemyBlockedXY(px,      py + dy, px, py);

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

  private isEnemyBlockedXY(px: number, py: number, fromX: number, fromY: number): boolean {
    const HW = GameScene.TILE_SIZE * 0.9;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.isDead) continue;
      const ex = e.sprite.x;
      const ey = e.getCollisionY();
      // Si el jugador YA está dentro de la caja de este enemigo (pegado/solapado),
      // ese enemigo NO bloquea: si bloqueara, al quedar solapados te cerraría TODAS
      // las direcciones y te quedarías atascado. Así siempre puedes despegarte.
      if (Math.abs(ex - fromX) < HW && Math.abs(ey - fromY) < HW) continue;
      if (Math.abs(ex - px) < HW && Math.abs(ey - py) < HW) return true;
    }
    return false;
  }

  /** Devuelve el número de enemigos golpeados */
  /** Ataque básico de arma: golpea SOLO al enemigo (vivo) MÁS CERCANO en rango y en la
   *  dirección de mirada. En el futuro habrá ataques que golpeen a varios; este no.
   *  Devuelve 1 si acertó, 0 si no había objetivo. */
  attackEnemy(damage: number, isCrit = false): number {
    const pos  = this.player.getPosition();
    const dir  = this.player.getDirection();
    const RANGE = GameScene.TILE_SIZE * 3;

    let target: typeof this.enemies[0] | null = null;
    let bestDist = Infinity;
    let candidates = 0;   // TEMP diagnóstico

    this.enemies.forEach(enemy => {
      if (enemy.isDead) return;
      const ePos = enemy.getPixelPos();
      const dx   = ePos.x - pos.x;
      const dy   = ePos.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > RANGE || dist === 0) return;
      if (!this.isInAttackDirection(dx, dy, dist, dir)) return;

      candidates++;   // TEMP diagnóstico
      if (dist < bestDist) { bestDist = dist; target = enemy; }
    });

    if (!target) return 0;
    // TEMP diagnóstico: cuántos enemigos había en rango+dirección y que SOLO golpea a 1.
    console.log('[BASICATK] candidatos en rango+dir:', candidates, '→ daña a 1 (el más cercano)');
    target.takeDamage(damage, isCrit);
    target.startChasing();
    this.emit('enemyAttacked', target);
    return 1;
  }

  // Cono de ~90°: el enemigo debe estar a menos de ~45° de la dirección de mirada.
  // Antes bastaba dot > 0 (medio plano de 180°) y golpeabas enemigos casi de lado.
  // 0.7 (y no cos45°=0.7071) para que un objetivo en diagonal exacta no falle
  // por el borde del cono (el auto-ataque encara por eje dominante).
  private isInAttackDirection(dx: number, dy: number, dist: number, dir: Direction): boolean {
    const vec = this.dirVectors[dir];
    if (!vec) return true;
    return (dx * vec.x + dy * vec.y) / dist > 0.7;
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
