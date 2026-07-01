import { GameScene } from "src/app/scenes/gamescene/gamescene";
import { Direction } from "../interfaces/Direction";
import { AnimationService } from "src/app/scenes/gamescene/animation.service";
import { playerAnimations, playerTags } from "src/app/scenes/gamescene/constants";
import { EquipLayerConfig } from "./equip-layer-registry";
import { spawnFloatingText } from "src/app/scenes/gamescene/floating-text";
import { Subject } from "rxjs";

export class Player {

  public status$ = new Subject<any>();
  public mainScene: Phaser.Scene;
  public sprite: Phaser.GameObjects.Sprite;
  private tilePos: Phaser.Math.Vector2;
  private layers       = new Map<string, Phaser.GameObjects.Sprite>();
  private layerConfigs = new Map<string, EquipLayerConfig>();
  private readonly _posCache = new Phaser.Math.Vector2();

  // ── Split de piernas en el slash de espada ──────────────────────────────────
  // Durante el ataque de espada (slash), la mitad de ARRIBA del cuerpo y de las
  // armaduras alineadas 1:1 (botas/grebas/torso/casco) hace el slash, y la mitad de
  // ABAJO (piernas) sigue caminando si te mueves o queda quieta si estás parado.
  // Se recorta cada sprite en la cintura y se clona la parte inferior como un sprite
  // aparte que reproduce walk/idle. Solo slash (no thrust/bastón); las armas swing
  // van enteras con el torso. WAIST_Y en px de textura del frame LPC 64×64 (ajustable).
  private static readonly FRAME_W = 64;
  private static readonly FRAME_H = 64;
  // Línea de corte (px de textura, 0=arriba) POR DIRECCIÓN. En el slash LPC los
  // antebrazos/manos bajan hasta ~la cintura, así que el corte va BAJO para no
  // taparlos con las piernas. Subir el valor = corte más abajo (más brazo/mano,
  // menos zancada); bajarlo = al revés. Mirando abajo las manos caen más → corte
  // más bajo (54) para que la mano quede entera y no se vea un trocito flotando.
  private static readonly WAIST_Y: Record<string, number> = {
    up: 52, left: 52, right: 52, down: 54,
  };
  // Compensación de la estocada lateral: al pegar de lado el torso se adelanta
  // dentro del frame y se despega de la cadera. Movemos las piernas hacia el golpe
  // (px de mundo) siguiendo una curva seno del progreso del swing (0 al empezar,
  // máximo a mitad, 0 al acabar) para que sigan al torso. 0 = sin compensar.
  private static readonly LUNGE_X: Record<string, number> = {
    left: -5, right: 5, up: 0, down: 0,
  };
  private legsClones     = new Map<string, Phaser.GameObjects.Sprite>();
  private legsSplitActive = false;
  private legsSplitDir: Direction = Direction.DOWN;

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

  applyDamage(amount: number) {
    this.status.HP = Math.max(0, this.status.HP - amount);
    this.status$.next(this.status);
  }

  resetStatus(currentHp: number, maxHp: number) {
    this.status = { HP: currentHp, HPMax: maxHp };
    this.status$.next(this.status);
  }

  death() {
    this.endLegsSplit();   // por si muere a mitad de un slash (deshace el recorte)
    this.sprite.play(playerTags.DEATH + this.getDirection());
  }

  /** Muestra en verde el HP recuperado sobre el sprite, con '+' que flotan hacia arriba. */
  showHealNumber(amount: number): void {
    if (!this.mainScene || !this.sprite || amount <= 0) return;
    const cx   = this.sprite.x;
    const topY = this.sprite.y - this.sprite.displayHeight * 0.9;

    // Número principal "+X"
    spawnFloatingText(this.mainScene, cx, topY, `+${amount}`, {
      fontSize: 30, color: '#3ad12f', stroke: '#0a3d08',
      rise: 42, duration: 900,
    });

    // Pequeñas '+' verdes que suben alrededor del sprite
    for (let i = 0; i < 5; i++) {
      const px = cx + Phaser.Math.Between(-22, 22);
      const py = this.sprite.y - Phaser.Math.Between(0, 30);
      const plus = this.mainScene.add.text(px, py, '+', {
        fontSize:        `${Phaser.Math.Between(14, 22)}px`,
        color:           '#7dff5a',
        fontStyle:       'bold',
        stroke:          '#0a3d08',
        strokeThickness: 3,
      });
      plus.setOrigin(0.5, 1).setDepth(4999).setAlpha(0);
      this.mainScene.tweens.add({
        targets:    plus,
        y:          py - Phaser.Math.Between(40, 70),
        alpha:      { from: 0.9, to: 0 },
        duration:   Phaser.Math.Between(700, 1100),
        delay:      i * 80,
        ease:       'Sine.easeOut',
        onComplete: () => plus.destroy(),
      });
    }
  }

  /* animations */

  setInitialSprites(sprites: any) {
    this.mainScene = sprites.mainScene;
    this.sprite = sprites.sprite;
    this.tilePos = sprites.tilePos;
    this.isAttacking = false;
    this.isMoving = false;
    // Restart de escena: los clones del split viejo ya los destruyó la escena.
    this.legsSplitActive = false;
    this.legsClones.clear();
    this.initSpriteProperties();
    this.initPlayerAnimation();
  }

  initPlayerAnimation() {
    this.animationService.createTopDownRightLeftAnim('WALK', playerTags.WALK, 'player', playerAnimations.WALK);
    this.animationService.createTopDownRightLeftAnim('ATTACK', playerTags.ATTACK, 'player', playerAnimations.ATTACK, 0);
    this.animationService.createTopDownRightLeftAnim('THRUST', playerTags.THRUST, 'player', playerAnimations.THRUST, 0, 13);
    this.animationService.createTopDownRightLeftAnim('IDLE', playerTags.IDLE, 'player', playerAnimations.IDLE, -1, 2);
    this.animationService.createTopDownRightLeftAnim('DEATH', playerTags.DEATH, 'player', playerAnimations.DEATH, 0);
    this.sprite.play(playerTags.IDLE + Direction.DOWN); // Animación por defecto
  }

  public playerAttack(useThrust = false, timeScale = 1) {
    if (this.isAttacking) return;
    this.isAttacking = true;
    const direction = this.getDirection();
    const tag = useThrust ? playerTags.THRUST : playerTags.ATTACK;
    this.sprite.play(tag + direction);
    // Velocidad de ataque: acelera SOLO esta animación y se restaura al terminar
    // (walk/idle comparten el mismo anims manager del sprite). Las capas de equipo
    // van conducidas por el progreso del cuerpo (syncLayers), así que siguen solas.
    this.sprite.anims.timeScale = timeScale;
    // Solo espada (slash): las piernas siguen su marcha mientras el torso ataca.
    if (!useThrust) this.beginLegsSplit(direction);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.isAttacking = false;
      this.sprite.anims.timeScale = 1;
      this.endLegsSplit();
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
    // Si se quita una capa durante un slash, su clon de piernas se va con ella.
    const legs = this.legsClones.get(slotId);
    if (legs?.active) legs.destroy();
    this.legsClones.delete(slotId);
  }

  clearLayers(): void {
    this.layers.clear();
    this.layerConfigs.clear();
    this.legsClones.forEach(c => { if (c?.active) c.destroy(); });
    this.legsClones.clear();
    this.legsSplitActive = false;
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
    // Las piernas del slash se animan aunque el jugador no lleve ninguna capa de
    // equipo, así que va antes del early-return de abajo.
    this.updateLegsSplit();
    if (this.layers.size === 0) return;
    if (!this.sprite?.active || !this.sprite.anims?.currentFrame) return;
    const currentAnimKey = this.sprite.anims.currentAnim?.key ?? '';
    const isIdle = currentAnimKey.startsWith(playerTags.IDLE);
    // El ataque del cuerpo puede ser slash (armas) o thrust (bastones); ambos cuentan
    // como "ataque" para el offset oversize y la sincronización por progreso.
    const isAttackAnim = currentAnimKey.startsWith(playerTags.ATTACK) || currentAnimKey.startsWith(playerTags.THRUST);
    this.layers.forEach((layer, slotId) => {
      if (!layer?.active) return;
      const cfg = this.layerConfigs.get(slotId);
      // Offset dinámico: el ataque de estas armas usa una hoja "oversize" (128px,
      // personaje centrado) que necesita +80. Lo basamos en si el cuerpo está
      // atacando (no en el frame ya pintado) para que el offset cambie EN el mismo
      // frame que la textura y no haya salto al empezar/terminar el ataque.
      let offY = cfg?.layerOffsetY ?? 0;
      if (cfg?.oversizeSheetKey && isAttackAnim) {
        offY = cfg.oversizeOffsetY ?? offY;
      }
      layer.setPosition(this.sprite.x, this.sprite.y + offY);
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
        if (isAttackAnim && targetKey && this.mainScene.anims.exists(targetKey)) {
          // Durante el ataque, el arma puede tener distinto nº de frames que el
          // cuerpo (ej. slash de 5 frames vs ataque de 6). En vez de dejar que
          // corra a su ritmo (se queda colgada o se reinicia al final), la
          // conducimos por el progreso del cuerpo cada frame → siempre sincronizada.
          if (!isSameKey) layer.play(targetKey);
          layer.anims.setProgress(this.sprite.anims.getProgress());
        } else {
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

  // ── Split de piernas (slash de espada) ──────────────────────────────────────

  /** Recorta el sprite a la mitad superior (torso/brazos → hace el slash). */
  private cropUpper(s: Phaser.GameObjects.Sprite, waistY: number): void {
    s.setCrop(0, 0, Player.FRAME_W, waistY);
  }
  /** Recorta el sprite a la mitad inferior (piernas). */
  private cropLegs(s: Phaser.GameObjects.Sprite, waistY: number): void {
    s.setCrop(0, waistY, Player.FRAME_W, Player.FRAME_H - waistY);
  }

  /** Clona la mitad inferior de `src` como un sprite independiente (mismas textura,
   *  frame, origen, escala y profundidad), recortado a las piernas. */
  private makeLegsClone(src: Phaser.GameObjects.Sprite, waistY: number): Phaser.GameObjects.Sprite {
    const clone = this.mainScene.add.sprite(src.x, src.y, src.texture.key, src.frame.name);
    clone.setOrigin(src.originX, src.originY);
    clone.setScale(src.scaleX, src.scaleY);
    clone.setDepth(src.depth);
    clone.setAlpha(src.alpha);
    this.cropLegs(clone, waistY);
    return clone;
  }

  /** Arranca el split: recorta el cuerpo (y armaduras alineadas) a la mitad superior
   *  y crea sus clones de piernas. updateLegsSplit() los anima cada frame. */
  private beginLegsSplit(dir: Direction): void {
    if (!this.sprite?.active) return;
    this.endLegsSplit();                 // limpia un split previo, por si acaso
    this.legsSplitActive = true;
    this.legsSplitDir = dir;
    const waistY = Player.WAIST_Y[dir] ?? 48;

    this.cropUpper(this.sprite, waistY);
    this.legsClones.set('__body__', this.makeLegsClone(this.sprite, waistY));

    this.layers.forEach((layer, slotId) => {
      const cfg = this.layerConfigs.get(slotId);
      if (!cfg?.splitLegsOnSlash || !layer?.active) return;
      this.cropUpper(layer, waistY);
      this.legsClones.set(slotId, this.makeLegsClone(layer, waistY));
    });
  }

  /** Cada frame durante el slash: mueve las piernas (walk si me muevo, idle si no).
   *  Posición y profundidad se derivan de la `y` ACTUAL del cuerpo (igual que
   *  syncLayers con las demás capas), NO del `.depth`/`.x/.y` de la capa de origen:
   *  syncLayers corre antes de que GameScene fije `sprite.depth = y`, así que ese
   *  valor va un frame retrasado y, al moverse hacia abajo, dejaba la sombra (y-1)
   *  por encima. Las armaduras se sincronizan al progreso de las piernas del cuerpo. */
  private updateLegsSplit(): void {
    if (!this.legsSplitActive) return;
    const dir = this.legsSplitDir;
    const moving = this.isMoving;
    const bodyScale = this.sprite.scaleX;
    const alpha = this.sprite.alpha;
    // Estocada: el cuerpo está reproduciendo el slash → seguimos su progreso y
    // movemos las piernas hacia el golpe con una curva seno (pico a mitad del swing).
    const slashProg = this.sprite.anims?.getProgress?.() ?? 0;
    const lungeX = (Player.LUNGE_X[dir] ?? 0) * Math.sin(slashProg * Math.PI);
    const baseX = this.sprite.x + lungeX;
    const baseY = this.sprite.y;

    const bodyLegs = this.legsClones.get('__body__');
    if (bodyLegs?.active) {
      const bodyKey = (moving ? playerTags.WALK : playerTags.IDLE) + dir;
      this.driveLegs(bodyLegs, bodyKey, baseX, baseY, baseY, bodyScale, alpha);
    }
    const prog = bodyLegs?.anims?.getProgress?.() ?? 0;

    this.legsClones.forEach((clone, slotId) => {
      if (slotId === '__body__' || !clone?.active) return;
      const cfg = this.layerConfigs.get(slotId);
      if (!cfg?.layerPrefix) return;
      const offY  = cfg.layerOffsetY ?? 0;
      const depth = baseY + ((cfg.depth ?? 2) - 2);    // misma fórmula que syncLayers
      const scale = cfg.layerScale ?? bodyScale;
      const key   = cfg.layerPrefix + (moving ? 'walk_' : 'idle_') + dir;
      this.driveLegs(clone, key, baseX, baseY + offY, depth, scale, alpha, prog);
    });
  }

  /** Coloca el clon de piernas y le pone la animación walk/idle correspondiente. */
  private driveLegs(
    clone: Phaser.GameObjects.Sprite, animKey: string,
    x: number, y: number, depth: number, scale: number, alpha: number,
    syncProgress?: number,
  ): void {
    clone.setPosition(x, y);
    clone.setDepth(depth);
    clone.setScale(scale, scale);
    clone.setAlpha(alpha);
    if (this.mainScene.anims.exists(animKey)) {
      if (clone.anims.currentAnim?.key !== animKey) clone.play(animKey);
      if (syncProgress !== undefined && clone.anims.currentAnim) {
        clone.anims.setProgress(syncProgress);
      }
    }
  }

  /** Termina el split: quita el recorte del cuerpo y capas, y destruye los clones. */
  private endLegsSplit(): void {
    if (!this.legsSplitActive && this.legsClones.size === 0) return;
    this.legsSplitActive = false;
    if (this.sprite?.active) this.sprite.setCrop();
    this.layers.forEach(layer => { if (layer?.active) layer.setCrop(); });
    this.legsClones.forEach(clone => { if (clone?.active) clone.destroy(); });
    this.legsClones.clear();
  }

}