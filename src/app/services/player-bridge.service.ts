import { Injectable } from '@angular/core';
import { distinctUntilChanged, map, Subject } from 'rxjs';
import { IAttack, Player } from '../pnj/player/player';
import { SceneManager } from '../scenes/scene-manager';
import { CharacterStatsService } from './character-stats.service';
import { EquipmentService } from './equipment.service';
import { InventoryItem } from './inventory.service';
import { PlayerStateService } from './player-state.service';

/** Poción equipada: se auto-usa al bajar a la mitad de HP, con cooldown. */
const AUTO_POTION_COOLDOWN_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class PlayerBridgeService {

  player: Player;
  isDead = false;
  readonly death$ = new Subject<void>();
  readonly sceneStarting$ = new Subject<void>();
  readonly sceneReady$ = new Subject<void>();

  private lastAutoPotion = 0;
  private autoPotionTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private sceneManager: SceneManager,
    private playerState: PlayerStateService,
    private equipment: EquipmentService,
    charStats: CharacterStatsService,
  ) {
    // El sprite Phaser es la fuente de verdad de la barra de HP, pero hasta ahora
    // su HPMax solo se fijaba al seleccionar personaje o revivir. Aquí lo mantenemos
    // en sync cuando cambia el HP máximo (CONST, equipo +hp, talentos).
    charStats.hp$
      .pipe(map(b => b.total), distinctUntilChanged())
      .subscribe(total => {
        if (!this.player) return;
        const newHP = Math.min(this.player.status.HP, total);
        this.player.resetStatus(newHP, total);
        this.playerState.setHp(newHP, total);
      });
  }

  createPlayer(): void {
    this.player = new Player();
  }

  getPlayer(): Player {
    return this.player;
  }

  setInitialSprites(sprites: any): void {
    this.player.setInitialSprites(sprites);
  }

  setAttackToPlayer(attack: IAttack): void {
    if (this.isDead) return;
    this.player.receiveAttack(attack);
    const { HP, HPMax } = this.player.status;
    this.playerState.setHp(HP, HPMax);
    if (HP <= 0) {
      this.isDead = true;
      this.player.death();
      this.playerState.recordDeath();
      this.death$.next();
      return;
    }
    this.tryAutoPotion();
  }

  /** Usa la poción equipada si falta la mitad o más de HP y el cooldown está listo. */
  private tryAutoPotion(): void {
    if (this.isDead || !this.player) return;
    const { HP, HPMax } = this.player.status;
    if (HP <= 0 || HP > HPMax / 2) return;                       // solo a mitad o menos

    const remaining = AUTO_POTION_COOLDOWN_MS - (Date.now() - this.lastAutoPotion);
    if (remaining > 0) {
      this.scheduleAutoPotionRecheck(remaining);
      return;
    }

    const slot = this.equipment.slots.find(s => s.id === 'potion');
    const item = slot?.item;
    const heal = item?.stats?.['healing'] ?? 0;
    if (!slot || !item || heal <= 0) return;

    this.lastAutoPotion = Date.now();
    this.healPlayer(heal, true);

    // Consume una unidad; al agotarse, libera el slot
    if (item.mergeable && (item.sum ?? 1) > 1) {
      item.sum! -= 1;
    } else {
      slot.item = null;
    }
    this.equipment.changes$.next();

    // Reprograma por si sigue bajo de vida al expirar el cooldown
    this.scheduleAutoPotionRecheck(AUTO_POTION_COOLDOWN_MS + 50);
  }

  private scheduleAutoPotionRecheck(delay: number): void {
    clearTimeout(this.autoPotionTimer);
    this.autoPotionTimer = setTimeout(() => this.tryAutoPotion(), delay);
  }

  // ── Estado del cooldown para la UI (slot de equipo + barra de buffos) ─────────

  /** Poción equipada en el slot. */
  get autoPotionItem(): InventoryItem | null {
    return this.equipment.slots.find(s => s.id === 'potion')?.item ?? null;
  }

  /** Segundos restantes de cooldown (0 = lista). */
  get autoPotionCooldownSeconds(): number {
    const remaining = AUTO_POTION_COOLDOWN_MS - (Date.now() - this.lastAutoPotion);
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  /** Fracción 0→1 de progreso del cooldown: 0 recién usada, 1 lista. */
  get autoPotionReadyRatio(): number {
    const elapsed = Date.now() - this.lastAutoPotion;
    return Math.max(0, Math.min(1, elapsed / AUTO_POTION_COOLDOWN_MS));
  }

  /** Hay cooldown en curso (independiente de si sigue equipada). */
  get autoPotionOnCooldown(): boolean {
    return this.autoPotionCooldownSeconds > 0;
  }

  healPlayer(amount: number, showNumber = false): void {
    if (!this.player || amount <= 0) return;
    const { HP, HPMax } = this.player.status;
    const newHP = Math.min(HP + amount, HPMax);
    this.player.resetStatus(newHP, HPMax);
    this.playerState.setHp(newHP, HPMax);
    if (showNumber) {
      const healed = newHP - HP;            // lo realmente recuperado (capado a HPMax)
      this.player.showHealNumber(healed);
    }
  }

  resetPlayerStatus(currentHp: number, maxHp: number): void {
    this.player?.resetStatus(currentHp, maxHp);
  }

  restartGameScene(): void {
    const game = this.sceneManager.game;
    if (!game) return;
    this.sceneStarting$.next();
    const scene = game.scene.getScene('GameScene');
    if (scene?.scene.isActive()) {
      scene.scene.restart();
    } else {
      game.scene.start('GameScene');
    }
  }

  emitSceneReady(): void {
    this.sceneReady$.next();
  }
}
