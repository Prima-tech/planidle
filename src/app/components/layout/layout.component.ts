import { Component, NgZone, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Router } from '@angular/router';
import { GameScene } from 'src/app/scenes/gamescene/gamescene';
import { NATIVE_DPR } from 'src/app/scenes/gamescene/constants';
import { MobileHUDScene } from 'src/app/scenes/mobile-hud.scene';
import { FakeApiService } from 'src/app/services/fakeapi';
import { ProfileService } from 'src/app/services/profile';
import Phaser from 'phaser';
import { MapService } from 'src/app/services/map.service';
import { SceneManager } from 'src/app/scenes/scene-manager';
import { AsgardService } from 'src/app/services/asgard';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { WorldService } from 'src/app/services/world.service';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { SaveService } from 'src/app/services/save.service';
import { KillService } from 'src/app/services/kill.service';
import { MapStatsService } from 'src/app/services/map-stats.service';
import { OfflineGains } from 'src/app/services/offline-gains.service';
import { REGISTRY_KEYS } from 'src/app/scenes/game-registry';
import { CharacterStatsService } from 'src/app/services/character-stats.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { SummonService } from 'src/app/services/summon.service';
import { SkillActivationService } from 'src/app/services/skill-activation.service';
import { BuffService } from 'src/app/services/buff.service';
import { AutoAttackService } from 'src/app/services/auto-attack.service';
import { GameSettingsService } from 'src/app/services/game-settings.service';
import { PanelStateService } from 'src/app/services/panel-state.service';
import { RegenService } from 'src/app/services/regen.service';
import { HudSkillSlotsService } from 'src/app/services/hud-skill-slots.service';
import { SkillEquipService } from 'src/app/services/skill-equip.service';
import { TalentService } from 'src/app/services/talent.service';
import { NotificationBadgeService } from 'src/app/services/notification-badge.service';
import { InteractionService } from 'src/app/services/interaction.service';
import { CityBuildService } from 'src/app/services/city-build.service';

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
  pendingGains: OfflineGains | null = null;
  playerDead = false;
  private gainsSub: Subscription;
  private deathSub: Subscription;
  private sceneStartingSub: Subscription;
  private sceneReadySub: Subscription;
  private lvlSub: Subscription;
  private lastLvl: number | null = null;

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
  ) {
    this.loadGame();
  }

  ngOnInit(): void {
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
      if (lvl > this.lastLvl) this.badges.flag('equip.stats');
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
      type: Phaser.AUTO,
      input: { activePointers: 3 },
      scene: [GameScene, MobileHUDScene],
      scale: {
        width: window.innerWidth * dpr,
        height: window.innerHeight * dpr,
        zoom: 1 / dpr,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      parent: "game",
      backgroundColor: "#48C4F8",
    };
  }

  registerServices() {
    this.phaserGame = new Phaser.Game(this.config);
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
    this.sceneManager.setGame(this.phaserGame);
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
    this.playerStateService.collectCoins(gains.coins);
    this.playerStateService.addExp(gains.exp);
    this.pendingGains = null;
    this.saveService.pendingGains$.next(null);
  }

  test() {
    this.profile.setStatus(10);
  }
}
