import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import Phaser from 'phaser';
import { PlanetViewScene } from 'src/app/scenes/planet-view.scene';
import { WorldService } from 'src/app/services/world.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { AsgardService } from 'src/app/services/asgard';
import { StorageService } from 'src/app/services/storage.service';
import { EquipmentSnapshot } from 'src/app/services/equipment.service';
import { MAP_REGISTRY, MapConfig } from 'src/app/scenes/gamescene/map-config';
import { enemySpriteStyle, enemySpriteClass } from 'src/app/utils/enemy-sprite.utils';

interface MapPin {
  id: string;
  name: string;
  x: number;
  y: number;
}

const MAP_PINS: MapPin[] = [
  { id: 'hogar', name: 'Hogar', x: 50, y: 15 },
  { id: '1-1',   name: '1-1',  x: 10, y: 60 },
  { id: '1-2',   name: '1-2',  x: 22, y: 45 },
  { id: '1-3',   name: '1-3',  x: 33, y: 65 },
  { id: '1-4',   name: '1-4',  x: 46, y: 50 },
  { id: '1-5',   name: '1-5',  x: 57, y: 75 },
  { id: '1-6',   name: '1-6',  x: 66, y: 58 },
  { id: '1-7',   name: '1-7',  x: 77, y: 78 },
  { id: '1-8',   name: '1-8',  x: 88, y: 62 },
];

const DISPLAY_PX = 48;

export interface CharOnMap {
  name: string;
  isCurrent: boolean;
  equipment: EquipmentSnapshot | null; // null = personaje activo (reactivo)
}

@Component({
  selector: 'app-world-map-panel',
  templateUrl: './world-map-panel.component.html',
  styleUrls: ['./world-map-panel.component.scss'],
  standalone: false
})
export class WorldMapPanelComponent implements OnInit, OnDestroy {
  private worldService  = inject(WorldService);
  private playerBridge  = inject(PlayerBridgeService);
  private asgard        = inject(AsgardService);
  private storage       = inject(StorageService);
  private mapSub: Subscription;

  activeTab    = 0;
  currentMapId = '';
  selectedMap: MapConfig | null = null;
  charsOnMap: CharOnMap[] = [];

  private planetGame: Phaser.Game | null = null;

  readonly pins = MAP_PINS;

  ngOnInit() {
    this.mapSub = this.worldService.currentMap$.subscribe(m => {
      this.currentMapId = m.id;
    });
  }

  ngOnDestroy() {
    this.mapSub?.unsubscribe();
    this.destroyPlanetGame();
  }

  selectTab(index: number) {
    if (this.activeTab === index) return;
    this.activeTab = index;
    if (index === 2) {
      this.selectedMap = null;
      this.charsOnMap  = [];
      // El contenedor entra al DOM con el *ngIf en este mismo ciclo
      setTimeout(() => this.createPlanetGame());
    } else {
      this.destroyPlanetGame();
    }
  }

  private createPlanetGame() {
    const parent = document.getElementById('planet-view');
    if (!parent || this.planetGame) return;
    this.planetGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width:  parent.clientWidth,
      height: parent.clientHeight,
      backgroundColor: '#05060f',
      scene: [PlanetViewScene],
    });
  }

  private destroyPlanetGame() {
    this.planetGame?.destroy(true);
    this.planetGame = null;
  }

  async selectPin(pinId: string) {
    const cfg = MAP_REGISTRY[pinId];
    if (this.selectedMap?.id === pinId) {
      this.selectedMap = null;
      this.charsOnMap  = [];
    } else {
      this.selectedMap = cfg;
      await this.loadCharsOnMap(pinId);
    }
  }

  private async loadCharsOnMap(mapId: string) {
    const chars   = (await this.asgard.getCharacters()) ?? [];
    const current = String(this.asgard.selectedPlayer?.id ?? '');
    const result: CharOnMap[] = [];

    for (const char of chars) {
      if (!char?.id || !char?.name) continue;
      const id = String(char.id);

      if (id === current) {
        if (mapId === this.currentMapId)
          result.push({ name: char.name, isCurrent: true, equipment: null });
      } else {
        const snap = await this.storage.get(`snapshot_char_${id}`);
        if (snap?.mapId === mapId)
          result.push({ name: char.name, isCurrent: false, equipment: snap.equipment ?? {} });
      }
    }

    this.charsOnMap = result;
  }

  teleport(pinId: string) {
    if (pinId === this.currentMapId) return;
    this.worldService.setCurrentMap(pinId);
    this.playerBridge.restartGameScene();
  }

  spriteStyle(enemyType: string) { return enemySpriteStyle(enemyType, DISPLAY_PX); }
  spriteClass(enemyType: string) { return enemySpriteClass(enemyType); }
}
