import { AnimationService } from "../scenes/gamescene/animation.service";
import { enemyAnimations, enemyTags } from "../scenes/gamescene/constants";
import { GameScene } from "../scenes/gamescene/gamescene";

export class Enemy {
  name: string;
  HP: number = 100;
  private animationService: AnimationService;
  
  constructor( 
    public mainScene: Phaser.Scene,
    public sprite: Phaser.GameObjects.Sprite,
    private tilePos: Phaser.Math.Vector2) {
      this.initSpriteProperties();
      this.initAnimation();
  }

  initAnimation()  {
   // this.animationService.createTopDownRightLeftAnim('IDLE', enemyTags.IDLE, 'enemyTexture', enemyAnimations.IDLE)
   // this.animationService.createTopDownRightLeftAnim('ATTACK', enemyTags.ATTACK, 'player', enemyAnimations.ATTACK)

  }

  initSpriteProperties() {
    const offsetX = GameScene.TILE_SIZE / 2;
    const offsetY = GameScene.TILE_SIZE;
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setPosition(
      this.tilePos.x * GameScene.TILE_SIZE + offsetX,
      this.tilePos.y * GameScene.TILE_SIZE + offsetY
    );
    this.sprite.setFrame(55);
    this.animationService = new AnimationService(this.mainScene);
  }

  takeDamage(amount: number) {
    console.log(`Enemy received ${amount} damage`);
    console.log('me queda esta vida', this.HP)
    this.HP -= amount;
    if (this.HP <= 0) {
      this.die();
    }
  }

  private die() {
    // this.sprite.destroy();
    this.animationService.createDieAnimation();
    console.log("Enemy died");
  }

  addCollider(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject) {
    scene.physics.add.collider(this.sprite, target);
  }

  getTilePos(): Phaser.Math.Vector2 {
    return this.tilePos.clone();
  }

  dieAnimation()  {
    this.animationService.createTopDownRightLeftAnim('WALK', enemyTags.WALK, 'enemyTexture', enemyAnimations.WALK)
   // this.animationService.createTopDownRightLeftAnim('ATTACK', enemyTags.ATTACK, 'player', enemyAnimations.ATTACK)

  }

}