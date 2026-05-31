import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameScene } from 'src/app/scenes/gamescene/gamescene';
import { FakeApiService } from 'src/app/services/fakeapi';
import { ProfileService } from 'src/app/services/profile';
import Phaser from 'phaser';
import { MapScene } from 'src/app/scenes/mapscene/mapscene';
import { MapService } from 'src/app/services/map.service';
import { SceneManager } from 'src/app/scenes/scene-manager';
import { AsgardService } from 'src/app/services/asgard';
import { InventoryService } from 'src/app/services/inventory.service';
import { WorldService } from 'src/app/services/world.service';
import { PlayerStateService } from 'src/app/services/player-state.service';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: false
})
export class LayoutComponent {

  config: Phaser.Types.Core.GameConfig | undefined;
  phaserGame: Phaser.Game | undefined;
  dataLoaded = false;
  constructor(
    private router: Router,
    public service: FakeApiService,
    public profile: ProfileService,
    public mapService: MapService,
    public sceneManager: SceneManager,
    public asgardService: AsgardService,
    public inventoryService: InventoryService,
    public worldService: WorldService,
    public playerStateService: PlayerStateService
  ) {
    this.loadGame();
  }

  ngOnInit(): void {
    console.log('oyistis ?')
    this.asgardService.getSelectedPlayer();
    this.asgardService.refreshData();
    this.service.getUserData().subscribe((data) => {
      this.asgardService.createPlayer(data)
      this.registerServices();
      this.dataLoaded = true;
    })
  }

  loadGame() {
    this.config = {
      title: "Sample",
      render: {
        antialias: false,
      },
      physics: {
        default: 'arcade',
      },
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
    this.phaserGame.registry.set('mapService', this.mapService);
    this.phaserGame.registry.set('asgardService', this.asgardService);
    this.phaserGame.registry.set('inventoryService', this.inventoryService);
    this.phaserGame.registry.set('worldService', this.worldService);
    this.phaserGame.registry.set('playerStateService', this.playerStateService);
    this.sceneManager.setGame(this.phaserGame);
  }

  test() {
    this.profile.setStatus(10);
  }

}
