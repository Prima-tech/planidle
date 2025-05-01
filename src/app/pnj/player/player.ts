import { GameScene } from "src/app/scenes/gamescene/gamescene";
import { Direction } from "../interfaces/Direction";
import { AnimationService } from "src/app/scenes/gamescene/animation.service";

export class Player {

  currentDirection: Direction = Direction.DOWN;
  private animationService: AnimationService;
  constructor(
    public mainScene: Phaser.Scene,
    public sprite: Phaser.GameObjects.Sprite,
    private tilePos: Phaser.Math.Vector2
  ) {
    this.initSpriteProperties();
    this.initPlayerAnimation();

  }


    initPlayerAnimation()  {
      
   //   this.createTopDownRightLeftAnim('IDLE', 'player_run_', 'player')

      let frames = {
        [Direction.UP]: { start: 104, end: 112 },
        [Direction.LEFT]: { start: 117, end: 125 },
        [Direction.DOWN]: { start: 130, end: 138 },
        [Direction.RIGHT]: { start: 143, end: 150 },      
      }
      this.animationService.createTopDownRightLeftAnim('WALK', 'player_walk_', 'player', frames)

      let framesAttack = {
        [Direction.UP]: { start: 156, end: 161 },
        [Direction.LEFT]: { start: 169, end: 174 },
        [Direction.DOWN]: { start: 182, end: 187 },
        [Direction.RIGHT]: { start: 195, end: 200},      
      }
      this.animationService.createTopDownRightLeftAnim('ATTACK', 'player_attack_', 'player', framesAttack)

     
    }





    public playerAttack() {
      console.log('Player attacked!');
      const direction = this.getDirection();
      const attackAnimationKey = "player_attack_" + direction;
      this.sprite.play(attackAnimationKey);

      this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.sprite.play(direction); // Vuelve a la animación de la dirección actual
      }, this);
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

  getPosition(): Phaser.Math.Vector2 {
    return this.sprite.getBottomCenter();
  }

  setPosition(position: Phaser.Math.Vector2): void {
    this.sprite.setPosition(position.x, position.y);
  }

  stopAnimation(direction: Direction) {
    const animationManager = this.sprite.anims.animationManager;
    const standingFrame = animationManager.get('player_walk_' + direction).frames[1].frame.name;
    this.sprite.anims.stop();
    this.currentDirection = direction;
    this.sprite.setFrame(standingFrame);
  }

  startAnimation(direction: Direction) {
    this.currentDirection = direction;
    this.sprite.anims.play('player_walk_' + direction);
  }

  getTilePos(): Phaser.Math.Vector2 {
    return this.tilePos.clone();
  }

  setTilePos(tilePosition: Phaser.Math.Vector2): void {
    this.tilePos = tilePosition.clone();
  }

  getDirection() {
    return this.currentDirection;
  }
}