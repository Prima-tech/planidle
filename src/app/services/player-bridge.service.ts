import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Subject } from 'rxjs';
import { IAttack, Player } from '../pnj/player/player';
import { SceneManager } from '../scenes/scene-manager';
import { CharacterStatsService } from './character-stats.service';
import { EquipmentService } from './equipment.service';
import { InventoryItem } from './inventory.service';
import { PlayerStateService } from './player-state.service';

/** Poción equipada: se auto-usa al bajar a la mitad de HP, con cooldown. */
const AUTO_POTION_COOLDOWN_MS = 30_000;

/** Petición de entrada a un mapa (Modo Mundo). `canCancel` = se puede rechazar. */
export interface MapEntrancePrompt {
  mapId: string;
  canCancel: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlayerBridgeService {

  player: Player;
  isDead = false;
  readonly death$ = new Subject<void>();
  readonly sceneStarting$ = new Subject<void>();
  readonly sceneReady$ = new Subject<void>();

  /** Modo Mundo (runner) activo. La UI lo usa para ocultar minimapa/skills/toggle
   *  del footer y convertir el botón de ataque en botón de salto. */
  readonly runMode$ = new BehaviorSubject<boolean>(false);
  /** El botón de salto (HTML) emite al pulsar/soltar; WorldRunScene los escucha
   *  para el salto variable (mantener = más alto). */
  readonly jumpRequest$ = new Subject<void>();
  readonly jumpReleaseRequest$ = new Subject<void>();

  /** Modo Mundo: la PRIMERA vez que se cruza la entrada de un mapa recién
   *  desbloqueado, la escena pide mostrar el modal de entrada (o null = oculto).
   *  `canCancel` es false en el primer mapa de todos (solo "Aceptar" → entra) y
   *  true en los siguientes (se puede "Cancelar" y seguir corriendo). El modal lo lee. */
  readonly mapEntrancePrompt$ = new BehaviorSubject<MapEntrancePrompt | null>(null);
  /** El modal (o el icono de entrada) pide entrar al mapa; la WorldRunScene lo hace. */
  readonly enterMapRequest$ = new Subject<string>();
  /** El modal se cerró con "Cancelar": la WorldRunScene reanuda la carrera. */
  readonly mapEntranceDismissed$ = new Subject<void>();
  /** Modo Mundo: al pasar por la entrada de un mapa YA desbloqueado, la escena pide
   *  mostrar el icono de teletransporte (arriba-derecha, 10 s). Emite el id del mapa. */
  readonly mapEntranceHint$ = new Subject<string>();

  setRunMode(active: boolean): void { this.runMode$.next(active); }
  requestJump(): void { this.jumpRequest$.next(); }
  releaseJump(): void { this.jumpReleaseRequest$.next(); }
  promptMapEntrance(mapId: string, canCancel: boolean): void {
    this.mapEntrancePrompt$.next({ mapId, canCancel });
  }
  /** Confirmar entrada desde el modal: oculta el modal y avisa a la escena. */
  requestEnterMap(mapId: string): void {
    this.mapEntrancePrompt$.next(null);
    this.enterMapRequest$.next(mapId);
  }
  /** "Cancelar" en el modal: oculta el modal y reanuda la carrera. */
  dismissMapEntrance(): void {
    this.mapEntrancePrompt$.next(null);
    this.mapEntranceDismissed$.next();
  }
  /** Pasar por una entrada ya desbloqueada: muestra el icono de teletransporte. */
  showMapEntranceHint(mapId: string): void { this.mapEntranceHint$.next(mapId); }

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
