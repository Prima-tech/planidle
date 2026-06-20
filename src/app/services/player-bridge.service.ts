import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Subject } from 'rxjs';
import { IAttack, Player } from '../pnj/player/player';
import { SceneManager } from '../scenes/scene-manager';
import { CharacterStatsService } from './character-stats.service';
import { EquipmentService } from './equipment.service';
import { InventoryItem } from './inventory.service';
import { PlayerStateService } from './player-state.service';
import { AdminService } from './admin.service';

/** Poción equipada: se auto-usa al bajar a la mitad de HP, con cooldown. */
const AUTO_POTION_COOLDOWN_MS = 30_000;

// Sprint (Modo Mundo): empujón de velocidad de SPRINT_DURATION con un pico inicial
// muy grande que decelera; luego un cooldown antes de poder repetirlo.
const SPRINT_DURATION_MS = 10_000;
const SPRINT_COOLDOWN_MS = 20_000;   // medido desde la activación (10 s sprint + 10 s de espera)
const SPRINT_BASE_MULT = 2;          // ×2 sostenido durante todo el sprint
const SPRINT_BURST_EXTRA = 2;        // pico extra al arrancar (×4) que decae hasta 0

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
  /** El botón "volver al mapa principal" (HTML, solo en modo carrera) emite aquí;
   *  WorldRunScene sale de la exploración a la capital del planeta. */
  readonly exitRunRequest$ = new Subject<void>();
  /** Muerte en el Modo Mundo: WorldRunScene pausa y emite aquí; Angular muestra el
   *  modal "Has muerto" cuyo "Aceptar" llama a requestExitRun() (→ capital). */
  readonly runDeath$ = new Subject<void>();

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

  setRunMode(active: boolean): void {
    if (active) this.sprintStart = 0;   // se entra con el sprint listo
    this.runMode$.next(active);
  }
  requestJump(): void { this.jumpRequest$.next(); }
  releaseJump(): void { this.jumpReleaseRequest$.next(); }
  requestExitRun(): void { this.exitRunRequest$.next(); }
  notifyRunDeath(): void { this.runDeath$.next(); }

  // ── Sprint (Modo Mundo) ───────────────────────────────────────────────────────
  // Timestamp de la última activación (0 = nunca / reset). La velocidad la aplica
  // WorldRunScene leyendo currentSprintMultiplier() cada frame; el botón lee los
  // getters de cooldown para pintar el aro (igual que las habilidades).
  private sprintStart = 0;

  /** Arranca el sprint si no está en cooldown. Devuelve true si se activó.
   *  Requiere tener comprado el hito 'sprint' (ver run-milestones / panel de hitos). */
  activateSprint(): boolean {
    if (!this.playerState.hasRunMilestone('sprint')) return false;
    if (this.sprintOnCooldown) return false;
    this.sprintStart = Date.now();
    return true;
  }

  private get sprintElapsed(): number { return Date.now() - this.sprintStart; }
  get sprintActive(): boolean { return this.sprintStart > 0 && this.sprintElapsed < SPRINT_DURATION_MS; }
  get sprintOnCooldown(): boolean { return this.sprintStart > 0 && this.sprintElapsed < SPRINT_COOLDOWN_MS; }

  /** Multiplicador de velocidad actual: pico al inicio (×4) que decelera hasta
   *  ×SPRINT_BASE_MULT y vuelve a ×1 al terminar. */
  currentSprintMultiplier(): number {
    if (!this.sprintActive) return 1;
    const t = this.sprintElapsed / SPRINT_DURATION_MS;   // 0 → 1
    const decay = (1 - t) * (1 - t);                     // 1 → 0, deceleración suave
    return SPRINT_BASE_MULT + SPRINT_BURST_EXTRA * decay;
  }

  /** Aro de cooldown del botón: 1 = recién usado, 0 = listo. */
  get sprintCooldownRatio(): number {
    if (!this.sprintOnCooldown) return 0;
    return 1 - this.sprintElapsed / SPRINT_COOLDOWN_MS;
  }
  get sprintCooldownSeconds(): number {
    if (!this.sprintOnCooldown) return 0;
    return Math.ceil((SPRINT_COOLDOWN_MS - this.sprintElapsed) / 1000);
  }
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
    private admin: AdminService,
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
    // Modo admin: invulnerable al daño de enemigos (ignora ataques que restan HP).
    if (this.admin.isAdmin && (attack.HP ?? 0) < 0) return;
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
      // GameScene parada → venimos de WorldRunScene (p.ej. teletransporte desde el
      // mapa del mundo o cambio de personaje en modo carrera). Su runner es un
      // ArcadeSprite vivo que anima 'wr_run' sobre la textura 'player'; el preload de
      // GameScene quita esa textura y, si WorldRunScene sigue corriendo, su sprite
      // avanzaría a un frame ya destruido → crash 'sourceSize'. La paramos primero
      // (su SHUTDOWN destruye el sprite) y luego arrancamos GameScene.
      const run = game.scene.getScene('WorldRunScene');
      if (run?.scene.isActive()) run.scene.stop();
      game.scene.start('GameScene');
    }
  }

  emitSceneReady(): void {
    this.sceneReady$.next();
  }
}
