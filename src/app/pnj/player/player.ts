import { GameScene } from "src/app/scenes/gamescene/gamescene";
import { Direction } from "../interfaces/Direction";
import { AnimationService } from "src/app/scenes/gamescene/animation.service";
import { playerAnimations, playerTags } from "src/app/scenes/gamescene/constants";
import { EquipLayerConfig } from "./equip-layer-registry";
import { Subject } from "rxjs";

export interface IAttack {
  HP: number;

}

export class Player {

  public status$ = new Subject<any>();
  public mainScene: Phaser.Scene;
  public sprite: Phaser.GameObjects.Sprite;
  private tilePos: Phaser.Math.Vector2;
  private layers       = new Map<string, Phaser.GameObjects.Sprite>();
  private layerConfigs = new Map<string, EquipLayerConfig>();
  private readonly _posCache = new Phaser.Math.Vector2();

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
    this.isAttacking = false;
    this.isMoving = false;
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
    return this._posCache.set(this.sprite.x, this.sprite.y);
  }

  setPosition(position: Phaser.Math.Vector2): void {
    this.sprite.setPosition(position.x, position.y);
  }

  setPositionXY(x: number, y: number): void {
    this.sprite.setPosition(x, y);
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

  startDash(): void {
    this.sprite.setAlpha(0.55);
    this.layers.forEach(l => l.setAlpha(0.55));
  }

  endDash(): void {
    this.sprite.setAlpha(1);
    this.layers.forEach(l => l.setAlpha(1));
  }

  getSprite() {
    return this.sprite;
  }

  // ── Capas de equipamiento ──────────────────────────────────────────────────

  addLayer(slotId: string, key: string, depth: number, cfg?: EquipLayerConfig): void {
    this.removeLayer(slotId);
    const offsetY = cfg?.layerOffsetY ?? 0;
    const layer = this.mainScene.add.sprite(this.sprite.x, this.sprite.y + offsetY, key);
    layer.setOrigin(this.sprite.originX, this.sprite.originY);
    const s = cfg?.layerScale ?? this.sprite.scaleX;
    layer.setScale(s, s);
    layer.setDepth(depth);
    if (cfg?.mode === 'anim' && cfg.fallbackAnim && this.mainScene.anims.exists(cfg.fallbackAnim)) {
      layer.play(cfg.fallbackAnim, true);
    }
    this.layers.set(slotId, layer);
    if (cfg) this.layerConfigs.set(slotId, cfg);
  }

  removeLayer(slotId: string): void {
    const layer = this.layers.get(slotId);
    if (layer?.active) layer.destroy();
    this.layers.delete(slotId);
    this.layerConfigs.delete(slotId);
  }

  clearLayers(): void {
    this.layers.clear();
    this.layerConfigs.clear();
  }

  // Spritesheets de equipo LPC parciales (ej. long_knife) solo tienen 21 filas (frames 0-272).
  // El idle del cuerpo usa filas 22-25 (frames 286+), que no existen en esos sheets,
  // generando un error de Phaser cada frame. En idle, usamos el frame 0 de walk de
  // la dirección correspondiente, que sí existe y tiene la pose de reposo correcta.
  private static readonly IDLE_HOLD_FRAME: Record<string, number> = {
    [Direction.UP]:    104,
    [Direction.LEFT]:  117,
    [Direction.DOWN]:  130,
    [Direction.RIGHT]: 143,
  };

  syncLayers(): void {
    if (this.layers.size === 0) return;
    if (!this.sprite?.active || !this.sprite.anims?.currentFrame) return;
    const currentAnimKey = this.sprite.anims.currentAnim?.key ?? '';
    const isIdle = currentAnimKey.startsWith(playerTags.IDLE);
    this.layers.forEach((layer, slotId) => {
      if (!layer?.active) return;
      const cfg = this.layerConfigs.get(slotId);
      layer.setPosition(this.sprite.x, this.sprite.y + (cfg?.layerOffsetY ?? 0));
      const baseY = this.sprite.y;
      if (cfg?.depthWhenUp !== undefined) {
        const facingDown = currentAnimKey.endsWith('_down');
        layer.setDepth(baseY + (facingDown ? cfg.depth : cfg.depthWhenUp) - 2);
      } else {
        layer.setDepth(baseY + (cfg?.depth ?? 2) - 2);
      }
      if (cfg?.mode === 'anim' && cfg.playerPrefix && cfg.layerPrefix) {
        const targetKey = currentAnimKey.startsWith(cfg.playerPrefix)
          ? cfg.layerPrefix + currentAnimKey.slice(cfg.playerPrefix.length)
          : (cfg.fallbackAnim ?? '');
        const layerKey       = layer.anims.currentAnim?.key ?? '';
        const isSameKey      = layerKey === targetKey;
        const isStillPlaying = layer.anims.isPlaying;
        if (targetKey && (!isSameKey || !isStillPlaying)) {
          const animKey = this.mainScene.anims.exists(targetKey) ? targetKey : (cfg.fallbackAnim ?? '');
          if (animKey) {
            layer.play(animKey);
            if (!isSameKey) {
              layer.anims.setProgress(this.sprite.anims.getProgress());
            }
          }
        }
      } else {
        if (isIdle) {
          const dir = currentAnimKey.slice(playerTags.IDLE.length);
          layer.setFrame(Player.IDLE_HOLD_FRAME[dir] ?? 130);
        } else {
          layer.setFrame(this.sprite.anims.currentFrame.frame.name);
        }
      }
    });
  }

}