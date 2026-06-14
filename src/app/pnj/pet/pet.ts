import { PetConfig } from './pet-config';

/**
 * Mascota que acompaña al jugador en el mapa. No tiene cuerpo de físicas: se
 * mueve por píxeles hacia el jugador y mantiene una distancia de seguimiento.
 * Reproduce `move` mientras avanza e `idle` al detenerse, volteándose según la
 * dirección horizontal.
 */
export class Pet {

  private sprite: Phaser.GameObjects.Sprite;

  // Se queda a esta distancia del jugador (px) y solo avanza si se aleja más.
  private static readonly FOLLOW_DIST = 70;
  // Velocidad de seguimiento (px/ms). Algo más rápida que el jugador para alcanzarlo.
  private static readonly SPEED = 0.26;

  constructor(
    private scene: Phaser.Scene,
    private cfg: PetConfig,
    spawnX: number,
    spawnY: number,
  ) {
    Pet.registerAnims(scene, cfg);
    this.sprite = scene.add.sprite(spawnX, spawnY, cfg.textureKey, cfg.anims['idle'].row * cfg.cols);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(cfg.scale);
    this.sprite.setDepth(spawnY);
    this.play('idle');
  }

  /** Registra las animaciones de la mascota (idempotente). */
  static registerAnims(scene: Phaser.Scene, cfg: PetConfig): void {
    for (const [name, anim] of Object.entries(cfg.anims)) {
      const key = `${cfg.textureKey}_${name}`;
      if (scene.anims.exists(key)) continue;
      const start = anim.row * cfg.cols;
      const frames = scene.anims.generateFrameNumbers(cfg.textureKey, { start, end: start + anim.frames - 1 });
      if (frames.length) {
        scene.anims.create({ key, frames, frameRate: anim.frameRate, repeat: anim.repeat });
      }
    }
  }

  // Movimiento mínimo (px) en un frame para considerar que la mascota "corre".
  // Evita que al pararse quede atascada en la animación de correr por el jitter
  // de punto flotante alrededor de la distancia de seguimiento.
  private static readonly MOVE_EPS = 0.3;

  /** Mueve la mascota hacia `target` (posición del jugador en px). */
  update(delta: number, targetX: number, targetY: number): void {
    if (!this.sprite?.active) return;
    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let moved = 0;
    if (dist > Pet.FOLLOW_DIST) {
      const step = Math.min(Pet.SPEED * delta, dist - Pet.FOLLOW_DIST);
      if (step > Pet.MOVE_EPS) {
        this.sprite.x += (dx / dist) * step;
        this.sprite.y += (dy / dist) * step;
        moved = step;
        if (Math.abs(dx) > 1) this.sprite.setFlipX(dx < 0);
      }
    }

    this.play(moved > Pet.MOVE_EPS ? 'move' : 'idle');
    this.sprite.setDepth(this.sprite.y);
  }

  destroy(): void {
    if (this.sprite?.active) this.sprite.destroy();
  }

  private play(state: 'idle' | 'move'): void {
    const key = `${this.cfg.textureKey}_${state}`;
    if (this.sprite.anims.currentAnim?.key === key) return;
    if (this.scene.anims.exists(key)) this.sprite.play(key);
  }
}
