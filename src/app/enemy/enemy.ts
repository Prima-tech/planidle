import { GameScene } from "../scenes/gamescene/gamescene";

export class Enemy {
//  sprite: Phaser.GameObjects.Sprite;
  HP: number;

  constructor( 
    public sprite: Phaser.GameObjects.Sprite,
    private tilePos: Phaser.Math.Vector2) {
    const offsetX = GameScene.TILE_SIZE / 2;
    const offsetY = GameScene.TILE_SIZE;

    this.sprite.setOrigin(0.5, 1);
    this.sprite.setPosition(
      tilePos.x * GameScene.TILE_SIZE + offsetX,
      tilePos.y * GameScene.TILE_SIZE + offsetY
    );
    this.sprite.setFrame(55);
      /*

    this.sprite = scene.add.sprite(x, y, texture);
    this.sprite.setDepth(2);
    this.sprite.scale = 3;
    this.HP = HP;
    */
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