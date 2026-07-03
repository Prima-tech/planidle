import { Component, NgZone, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Router } from '@angular/router';
import { GameScene } from 'src/app/scenes/gamescene/gamescene';
import { NATIVE_DPR } from 'src/app/scenes/gamescene/constants';
import { MobileHUDScene } from 'src/app/scenes/mobile-hud.scene';
import { WorldRunScene } from 'src/app/scenes/worldrun/worldrun.scene';
import { FakeApiService } from 'src/app/services/fakeapi';
import { ProfileService } from 'src/app/services/profile';
import Phaser from 'phaser';
import { MapService } from 'src/app/services/map.service';
import { SceneManager } from 'src/app/scenes/scene-manager';
import { AsgardService } from 'src/app/services/asgard';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { InventoryService, InventoryItem } from 'src/app/services/inventory.service';
import { WorldService } from 'src/app/services/world.service';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { SaveService } from 'src/app/services/save.service';
import { KillService } from 'src/app/services/kill.service';
import { MapStatsService } from 'src/app/services/map-stats.service';
import { OfflineGains, AfkItemGain } from 'src/app/services/offline-gains.service';
import { REGISTRY_KEYS } from 'src/app/scenes/game-registry';
import { CharacterStatsService } from 'src/app/services/character-stats.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { GatheringEquipmentService } from 'src/app/services/gathering-equipment.service';
import { GatheringSkillsService } from 'src/app/services/gathering-skills.service';
import { SummonService } from 'src/app/services/summon.service';
import { SkillActivationService } from 'src/app/services/skill-activation.service';
import { BuffService } from 'src/app/services/buff.service';
import { AutoAttackService } from 'src/app/services/auto-attack.service';
import { GameSettingsService } from 'src/app/services/game-settings.service';
import { PanelStateService } from 'src/app/services/panel-state.service';
import { RegenService } from 'src/app/services/regen.service';
import { APP_VERSION } from 'src/app/version';
import { HudSkillSlotsService } from 'src/app/services/hud-skill-slots.service';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { TalentService } from 'src/app/services/talent.service';
import { NotificationBadgeService } from 'src/app/services/notification-badge.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { CityBuildService } from 'src/app/services/city-build.service';
import { ConnectionService } from 'src/app/services/connection.service';
import { UnlockService } from 'src/app/services/unlock.service';
import { ActivityService } from 'src/app/services/activity.service';
import { DialogueService } from 'src/app/services/dialogue.service';
import { ForgeService } from 'src/app/services/forge.service';
import { MapUpgradesService } from 'src/app/services/map-upgrades.service';
import { AdminService } from 'src/app/services/admin.service';
import { AudioService } from 'src/app/services/audio.service';
import { QuestService } from 'src/app/services/quest.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: false
})
export class LayoutComponent implements OnDestroy {

  config: Phaser.Types.Core.GameConfig | undefined;
  phaserGame: Phaser.Game | undefined;
  dataLoaded = false;
  sceneVisible = false;
  readonly appVersion = APP_VERSION;
  pendingGains: OfflineGains | null = null;
  playerDead = false;
  private gainsSub: Subscription;
  private deathSub: Subscription;
  private sceneStartingSub: Subscription;
  private sceneReadySub: Subscription;
  private lvlSub: Subscription;
  private lastLvl: number | null = null;
  // Tick de change detection throttleado (~30 Hz) para la UI bindeada al juego,
  // ya que Phaser corre fuera de la zona de Angular (ver registerServices).
  private uiTick: ReturnType<typeof setInterval> | null = null;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    public service: FakeApiService,
    public profile: ProfileService,
    public mapService: MapService,
    public sceneManager: SceneManager,
    public asgardService: AsgardService,
    public playerBridgeService: PlayerBridgeService,
    public inventoryService: InventoryService,
    public worldService: WorldService,
    public playerStateService: PlayerStateService,
    private saveService: SaveService,
    private killService: KillService,
    private mapStatsService: MapStatsService,
    private equipmentService: EquipmentService,
    private summonService: SummonService,
    private characterStatsService: CharacterStatsService,
    private skillActivationService: SkillActivationService,
    private buffService: BuffService,
    private autoAttackService: AutoAttackService,
    private gameSettingsService: GameSettingsService,
    private panelStateService: PanelStateService,
    private regenService: RegenService,
    private hudSkillSlotsService: HudSkillSlotsService,
    private skillEquipService: SkillEquipService,
    private talentService: TalentService,
    private badges: NotificationBadgeService,
    private interactionService: InteractionService,
    private cityBuildService: CityBuildService,
    private gatheringEquipmentService: GatheringEquipmentService,
    private gatheringSkillsService: GatheringSkillsService,
    private connectionService: ConnectionService,
    private unlockService: UnlockService,
    private activityService: ActivityService,
    private dialogueService: DialogueService,
    private forgeService: ForgeService,
    private mapUpgradesService: MapUpgradesService,
    private adminService: AdminService,
    private audioService: AudioService,
    private questService: QuestService,
    private translateService: TranslateService,
  ) {
    this.loadGame();
  }

  ngOnInit(): void {
    // Restaura el modo de conexión (local/Supabase) elegido en el login, por si
    // la app recarga directamente en el juego sin volver a pasar por el login.
    this.connectionService.load();
    this.regenService.start();
    this.gainsSub = this.saveService.pendingGains$
      .pipe(filter(g => g !== null))
      .subscribe(gains => {
        console.log('[OfflineGains] ganancias recibidas:', gains);
        this.pendingGains = gains;
      });

    this.deathSub = this.playerBridgeService.death$.subscribe(() => {
      this.playerDead = true;
    });

    this.sceneStartingSub = this.playerBridgeService.sceneStarting$.subscribe(() => {
      this.ngZone.run(() => {
        this.sceneVisible = false;
        this.panelStateService.reset();
        this.asgardService.triggerCloseMenu();
      });
    });

    this.sceneReadySub = this.playerBridgeService.sceneReady$.subscribe(() => {
      this.ngZone.run(() => { this.sceneVisible = true; });
    });

    // Subir de nivel → badge "hay algo nuevo" en equipo (punto de stat por gastar).
    // isRestoring evita falsos positivos al cargar/cambiar de personaje.
    this.lvlSub = this.playerStateService.lvl$.subscribe((lvl: number) => {
      if (this.saveService.isRestoring || this.lastLvl === null) {
        this.lastLvl = lvl;
        return;
      }
      if (lvl > this.lastLvl) {
        this.badges.flag('equip.stats');
        this.audioService.play('levelup');
      }
      this.lastLvl = lvl;
    });

    this.asgardService.refreshData();
    this.service.getUserData().subscribe(async (data) => {
      this.playerBridgeService.createPlayer();

      if (!this.phaserGame) {
        const player = await this.asgardService.getSelectedPlayer();
        if (player?.id) {
          await this.saveService.loadCharacter(String(player.id));
          // Aplica el HP guardado al sprite: sin esto arranca con el default 100/100
          // aunque el personaje tenga más hpMax (la barra lee el sprite, no playerState)
          const state = this.playerStateService.snapshot();
          this.playerBridgeService.resetPlayerStatus(state.hp, state.hpMax);
        }
        this.registerServices();
      }

      this.dataLoaded = true;
    });
  }

  ngOnDestroy(): void {
    this.regenService.stop();
    this.gainsSub?.unsubscribe();
    this.deathSub?.unsubscribe();
    this.sceneStartingSub?.unsubscribe();
    this.sceneReadySub?.unsubscribe();
    this.lvlSub?.unsubscribe();
    if (this.uiTick) { clearInterval(this.uiTick); this.uiTick = null; }
    this.phaserGame?.destroy(true);
    this.phaserGame = undefined;
    this.sceneManager.setGame(null);
  }

  loadGame() {
    // Canvas a resolución nativa (devicePixelRatio) reducido con zoom CSS:
    // sin esto los sprites se ven borrosos en pantallas de alta densidad.
    // roundPixels evita el temblor/deformación por posiciones fraccionarias.
    const dpr = NATIVE_DPR;
    this.config = {
      title: "Sample",
      render: { antialias: false, roundPixels: true },
      physics: { default: 'arcade' },
      // Sin cap por setTimeout: usar requestAnimationFrame (sincronizado con el vsync
      // de la pantalla). El cap con forceSetTimeOut daba 60fps en el número pero no
      // alineados al vsync → judder constante (cable y batería). Con rAF y frames de
      // ~10ms el juego se asienta solo en ~60fps consistentes (1 frame cada 2 vsyncs
      // en pantallas de 120Hz), que es suave.
      type: Phaser.AUTO,
      input: { activePointers: 3 },
      scene: [GameScene, MobileHUDScene, WorldRunScene],
      scale: {
        width: window.innerWidth * dpr,
        height: window.innerHeight * dpr,
        zoom: 1 / dpr,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      parent: "game",
      // Negro: es lo que asoma un instante al cambiar de escena (entre el fade-out de
      // una y el primer frame de la siguiente). Antes era azul (#48C4F8) y daba un
      // destello feo; negro empalma con los fundidos a negro de las transiciones.
      backgroundColor: "#000000",
    };
  }

  registerServices() {
    // El tamaño del canvas se (re)calcula AQUÍ, no en el constructor. loadGame()
    // corre muy pronto en el arranque en frío, antes de que se asienten landscape +
    // modo inmersivo, y puede capturar un innerWidth/Height equivocado (más grande
    // o en vertical). Con scale mode NONE y sin resize, ese tamaño se clava toda la
    // sesión → más píxeles que rellenar → lag SOLO al reabrir. registerServices
    // corre ≈1s después (tras cargar datos), con las dimensiones ya asentadas.
    const dpr = NATIVE_DPR;
    const scale = this.config!.scale as Phaser.Types.Core.ScaleConfig;
    scale.width  = window.innerWidth  * dpr;
    scale.height = window.innerHeight * dpr;

    // Phaser corre FUERA de la zona de Angular. Si no, zone.js parchea el
    // requestAnimationFrame del juego y dispara change detection en CADA frame
    // (~60-120/seg); ese coste crece con cada componente/binding que se añada.
    // Fuera de zona, el bucle del juego no toca a Angular.
    this.ngZone.runOutsideAngular(() => {
      this.phaserGame = new Phaser.Game(this.config);
      // Contrapartida: la UI bindeada a estado del juego (monedas, HP/MP,
      // inventario…) ya no se refresca "gratis" cada frame. La refrescamos con un
      // tick de CD throttleado a ~30 Hz: imperceptible en el HUD y ~4× más barato
      // que ir por frame. Las interacciones del usuario (botones HTML) siguen
      // disparando CD al instante por su cuenta. El setInterval se crea aquí dentro
      // para que zone.js no lo parchee (si no, dispararía CD él mismo cada tick).
      // Tick de change detection a 10Hz (antes 30Hz): cada CD de la UI del juego
      // cuesta 2-5ms (HUD/inventario grandes), así que a 30Hz eran ~90ms/seg de CPU
      // (×2 throttleado sin cable). A 10Hz la UI sigue refrescándose de sobra para
      // contadores/barras y se libera mucho hilo principal para el render.
      this.uiTick = setInterval(() => this.ngZone.run(() => {}), 100);
    });
    this.phaserGame.registry.set(REGISTRY_KEYS.PLAYER_BRIDGE, this.playerBridgeService);
    this.phaserGame.registry.set(REGISTRY_KEYS.MAP,           this.mapService);
    this.phaserGame.registry.set(REGISTRY_KEYS.INVENTORY,     this.inventoryService);
    this.phaserGame.registry.set(REGISTRY_KEYS.WORLD,         this.worldService);
    this.phaserGame.registry.set(REGISTRY_KEYS.PLAYER_STATE,  this.playerStateService);
    this.phaserGame.registry.set(REGISTRY_KEYS.KILL,          this.killService);
    this.phaserGame.registry.set(REGISTRY_KEYS.MAP_STATS,     this.mapStatsService);
    this.phaserGame.registry.set(REGISTRY_KEYS.EQUIPMENT,    this.equipmentService);
    this.phaserGame.registry.set(REGISTRY_KEYS.SUMMON,       this.summonService);
    this.phaserGame.registry.set(REGISTRY_KEYS.CHAR_STATS,       this.characterStatsService);
    this.phaserGame.registry.set(REGISTRY_KEYS.ASGARD,           this.asgardService);
    this.phaserGame.registry.set(REGISTRY_KEYS.SKILL_ACTIVATION, this.skillActivationService);
    this.phaserGame.registry.set(REGISTRY_KEYS.BUFF,             this.buffService);
    this.phaserGame.registry.set(REGISTRY_KEYS.AUTO_ATTACK,      this.autoAttackService);
    this.phaserGame.registry.set(REGISTRY_KEYS.GAME_SETTINGS,   this.gameSettingsService);
    this.phaserGame.registry.set(REGISTRY_KEYS.HUD_SKILL_SLOTS, this.hudSkillSlotsService);
    this.phaserGame.registry.set(REGISTRY_KEYS.SKILL_EQUIP,     this.skillEquipService);
    this.phaserGame.registry.set(REGISTRY_KEYS.TALENT,          this.talentService);
    this.phaserGame.registry.set(REGISTRY_KEYS.INTERACTION,     this.interactionService);
    this.phaserGame.registry.set(REGISTRY_KEYS.CITY_BUILD,      this.cityBuildService);
    this.phaserGame.registry.set(REGISTRY_KEYS.GATHERING,       this.gatheringEquipmentService);
    this.phaserGame.registry.set(REGISTRY_KEYS.GATHERING_SKILLS, this.gatheringSkillsService);
    this.phaserGame.registry.set(REGISTRY_KEYS.UNLOCK,           this.unlockService);
    this.phaserGame.registry.set(REGISTRY_KEYS.ACTIVITY,         this.activityService);
    this.phaserGame.registry.set(REGISTRY_KEYS.DIALOGUE,         this.dialogueService);
    this.phaserGame.registry.set(REGISTRY_KEYS.FORGE,            this.forgeService);
    this.phaserGame.registry.set(REGISTRY_KEYS.MAP_UPGRADES,     this.mapUpgradesService);
    this.phaserGame.registry.set(REGISTRY_KEYS.ADMIN,            this.adminService);
    this.phaserGame.registry.set(REGISTRY_KEYS.AUDIO,            this.audioService);
    this.phaserGame.registry.set(REGISTRY_KEYS.QUESTS,           this.questService);
    this.phaserGame.registry.set(REGISTRY_KEYS.TRANSLATE,        this.translateService);
    this.sceneManager.setGame(this.phaserGame);

    // Audio: precarga los efectos y desbloquea el contexto tras el primer gesto
    // del usuario (política de autoplay en móvil/navegador).
    this.audioService.preload();
    const unlock = () => this.audioService.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  onRevive(): void {
    const state = this.playerStateService.snapshot();
    this.playerStateService.resetExpCurrentLevel();
    this.playerStateService.setHp(state.hpMax, state.hpMax);
    this.playerBridgeService.resetPlayerStatus(state.hpMax, state.hpMax);
    this.worldService.setCurrentMap('hogar');
    this.playerBridgeService.isDead = false;
    this.playerBridgeService.restartGameScene();
    this.playerDead = false;
  }

  collectGains(gains: OfflineGains) {
    if (gains.kind === 'exploring') {
      // Avanza la distancia explorada (resume desde aquí la próxima carrera) y cobra
      // las estrellas de los generadores pasivos. Los mapas ya NO se desbloquean por
      // metros (se compran con estrellas en el panel de hitos).
      this.playerStateService.addExplorationDistance(gains.exploreMeters ?? 0);
      if (gains.exploreStars) this.playerStateService.collectStars(gains.exploreStars);
    } else if (gains.kind === 'gathering') {
      // Recolección AFK: XP de la skill (minería/tala) por los nodos acumulados.
      if (gains.gatherSkill) {
        this.gatheringSkillsService.addBulk(gains.gatherSkill, gains.gatherXp ?? 0, gains.gatherNodes ?? 0);
      }
    } else {
      this.playerStateService.collectCoins(gains.coins);
      this.playerStateService.addExp(gains.exp);
    }

    // Botín real acumulado (combate o recolección): se mete al inventario (lo apilable
    // como una pila; lo que no quepa se descarta, como un drop que no se recoge).
    for (const drop of gains.itemDrops ?? []) {
      const e = drop.entry;
      if (e.mergeable) {
        this.inventoryService.addDroppedItem(this.buildOfflineItem(e, drop.qty));
      } else {
        for (let i = 0; i < drop.qty; i++) {
          this.inventoryService.addDroppedItem(this.buildOfflineItem(e, 1));
        }
      }
    }

    this.pendingGains = null;
    this.saveService.pendingGains$.next(null);
  }

  /** Construye un InventoryItem a partir de una entrada de loot (botín AFK). Apilables
   *  llevan `sum`; el resto un item por unidad. Mismos campos que un drop recogido. */
  private buildOfflineItem(e: AfkItemGain['entry'], qty: number): InventoryItem {
    return {
      id: `afk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: e.name,
      category: e.category,
      icon: e.icon,
      iconSheet: e.iconSheet,
      iconFrame: e.iconFrame,
      iconFrameSize: e.iconFrameSize,
      iconFrameCols: e.iconFrameCols,
      iconContentSize: e.iconContentSize,
      mergeable: e.mergeable,
      sum: e.mergeable ? qty : undefined,
      order: e.order,
      description: e.description,
      stats: e.stats,
      inventorySlots: e.inventorySlots,
      petId: e.petId,
      weaponKind: e.weaponKind,
    };
  }

  test() {
    this.profile.setStatus(10);
  }
}
