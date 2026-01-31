import { GameScene } from "src/app/scenes/gamescene/gamescene";
import { Direction } from "../interfaces/Direction";
import { AnimationService } from "src/app/scenes/gamescene/animation.service";
import { playerAnimations, playerTags } from "src/app/scenes/gamescene/constants";
import { Subject } from "rxjs";

export interface IAttack {
  HP: number;

}

export class Player {

  public status$ = new Subject<any>();
  public mainScene: Phaser.Scene;
  public sprite: Phaser.GameObjects.Sprite;
  private tilePos: Phaser.Math.Vector2;

  status = {
    HP: 100,
    HPMax: 100,
  }

  currentDirection: Direction = Direction.DOWN;
  private animationService: AnimationService;

  constructor(

  ) {

  }

  getStatus() {
    return this.status;
  }

  setStatus(v: any) {
    if (!v) return;
    this.status = v;
  }

  receiveAttack(attack: IAttack) {
    this.setHP(attack.HP)
  }

  setHP(HP: number) {
    this.status.HP = this.status.HP + HP;
    console.log('tiro le next', this.status)
    this.status$.next(this.status);
  }

  death() {
    this.sprite.play(playerTags.DEATH + this.getDirection());
  }

  /* animations */

  setInitialSprites(sprites: any) {
    this.mainScene = sprites.mainScene;
    this.sprite = sprites.sprite;
    this.tilePos = sprites.tilePos;
    this.initSpriteProperties();
    this.initPlayerAnimation();
  }

  initPlayerAnimation() {
    this.animationService.createTopDownRightLeftAnim('WALK', playerTags.WALK, 'player', playerAnimations.WALK);
    this.animationService.createTopDownRightLeftAnim('ATTACK', playerTags.ATTACK, 'player', playerAnimations.ATTACK, 0);
    this.animationService.createTopDownRightLeftAnim('IDLE', playerTags.IDLE, 'player', playerAnimations.IDLE, -1, 2);
    this.animationService.createTopDownRightLeftAnim('DEATH', playerTags.DEATH, 'player', playerAnimations.DEATH, 0);
    this.sprite.play(playerTags.IDLE + Direction.DOWN); // Animación por defecto
  }

  public playerAttack() {
    console.log('Player attacked!');
    const direction = this.getDirection();
    const attackAnimationKey = playerTags.ATTACK + direction;
    this.sprite.play(attackAnimationKey);

    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.sprite.play(playerTags.IDLE + direction); // Vuelve a la animación de la dirección actual
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
    const idleAnimationKey = playerTags.IDLE + direction;
    this.sprite.anims.stop();
    this.currentDirection = direction;
    this.sprite.play(idleAnimationKey); // Cambia a la animación idle
  }

  startAnimation(direction: Direction) {
    this.currentDirection = direction;
    this.sprite.anims.play(playerTags.WALK + direction);
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

  getSprite() {
    return this.sprite;
  }

}