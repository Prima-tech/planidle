export class Enemy {
  sprite: Phaser.GameObjects.Sprite;
  HP: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, HP: number) {
    this.sprite = scene.add.sprite(x, y, texture);
    this.sprite.setDepth(2);
    this.sprite.scale = 3;
    this.HP = HP;
  }

  addMovementAnimations(scene: Phaser.Scene, directions: { [key: string]: { start: number; end: number } }) {
    for (const [direction, frames] of Object.entries(directions)) {
      scene.anims.create({
        key: direction,
        frames: scene.anims.generateFrameNumbers(this.sprite.texture.key, {
          start: frames.start,
          end: frames.end,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  addAttackAnimations(scene: Phaser.Scene, attacks: { [key: string]: { start: number; end: number } }) {
    for (const [attack, frames] of Object.entries(attacks)) {
      scene.anims.create({
        key: attack,
        frames: scene.anims.generateFrameNumbers(this.sprite.texture.key, {
          start: frames.start,
          end: frames.end,
        }),
        frameRate: 10,
        repeat: 0,
      });
    }
  }

  takeDamage(amount: number) {
    this.HP -= amount;
    if (this.HP <= 0) {
      this.die();
    }
  }

  private die() {
    this.sprite.destroy();
    console.log("Enemy died");
  }

  addCollider(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject) {
    scene.physics.add.collider(this.sprite, target);
  }
}