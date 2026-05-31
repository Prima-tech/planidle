import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Router } from '@angular/router';
import { GameScene } from 'src/app/scenes/gamescene/gamescene';
import { FakeApiService } from 'src/app/services/fakeapi';
import { ProfileService } from 'src/app/services/profile';
import Phaser from 'phaser';
import { MapScene } from 'src/app/scenes/mapscene/mapscene';
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
  pendingGains: OfflineGains | null = null;
  private gainsSub: Subscription;

  constructor(
    private router: Router,
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
  ) {
    this.loadGame();
  }

  ngOnInit(): void {
    this.gainsSub = this.saveService.pendingGains$
      .pipe(filter(g => g !== null))
      .subscribe(gains => {
        console.log('[OfflineGains] ganancias recibidas:', gains);
        this.pendingGains = gains;
      });

    this.asgardService.refreshData();
    this.service.getUserData().subscribe(async (data) => {
      this.playerBridgeService.createPlayer();

      if (!this.phaserGame) {
        const player = await this.asgardService.getSelectedPlayer();
        if (player?.id) {
          await this.saveService.loadCharacter(String(player.id));
        }
        this.registerServices();
      }

      this.dataLoaded = true;
    });
  }

  ngOnDestroy(): void {
    this.gainsSub?.unsubscribe();
    this.phaserGame?.destroy(true);
    this.phaserGame = undefined;
    this.sceneManager.setGame(null);
  }

  loadGame() {
    this.config = {
      title: "Sample",
      render: { antialias: false },
      physics: { default: 'arcade' },
      type: Phaser.AUTO,
      scene: [GameScene, MapScene],
      scale: {
        width: window.innerWidth,
        height: window.innerHeight,
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
    this.sceneManager.setGame(this.phaserGame);
  }

  collectGains(gains: OfflineGains) {
    this.playerStateService.collectCoins(gains.coins);
    this.pendingGains = null;
    this.saveService.pendingGains$.next(null);
  }

  test() {
    this.profile.setStatus(10);
  }
}
