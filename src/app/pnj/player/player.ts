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
  private layers = new Map<string, Phaser.GameObjects.Sprite>();

  status = {
    HP: 100,
    HPMax: 100,
  }

  currentDirection: Direction = Direction.DOWN;
  isAttacking = false;
  private isMoving = false;
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
    this.setHP(attack.HP);
  }

  setHP(HP: number) {
    this.status.HP = Math.max(0, this.status.HP + HP);
    this.status$.next(this.status);
  }

  resetStatus(currentHp: number, maxHp: number) {
    this.status = { HP: currentHp, HPMax: maxHp };
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
    if (this.isAttacking) return;
    this.isAttacking = true;
    const direction = this.getDirection();
    this.sprite.play(playerTags.ATTACK + direction);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.isAttacking = false;
      if (this.isMoving) {
        this.sprite.play(playerTags.WALK + this.currentDirection);
      } else {
        this.sprite.play(playerTags.IDLE + this.currentDirection);
      }
    });
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
    this.isMoving = false;
    this.currentDirection = direction;
    if (this.isAttacking) return;
    this.sprite.anims.stop();
    this.sprite.play(playerTags.IDLE + direction);
  }

  startAnimation(direction: Direction) {
    this.isMoving = true;
    this.currentDirection = direction;
    if (this.isAttacking) return;
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

  // ── Capas de equipamiento ──────────────────────────────────────────────────

  addLayer(slotId: string, key: string, depth: number): void {
    this.removeLayer(slotId);
    const layer = this.mainScene.add.sprite(this.sprite.x, this.sprite.y, key);
    layer.setOrigin(this.sprite.originX, this.sprite.originY);
    layer.setScale(this.sprite.scaleX, this.sprite.scaleY);
    layer.setDepth(depth);
    this.layers.set(slotId, layer);
  }

  removeLayer(slotId: string): void {
    const layer = this.layers.get(slotId);
    if (layer?.active) layer.destroy();
    this.layers.delete(slotId);
  }

  clearLayers(): void {
    this.layers.clear();
  }

  syncLayers(): void {
    if (!this.sprite?.active || !this.sprite.anims?.currentFrame) return;
    const frameKey = this.sprite.anims.currentFrame.frame.name;
    this.layers.forEach(layer => {
      if (!layer?.active) return;
      layer.setPosition(this.sprite.x, this.sprite.y);
      layer.setFrame(frameKey);
    });
  }

}