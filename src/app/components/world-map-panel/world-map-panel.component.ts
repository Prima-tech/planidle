import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WorldService } from 'src/app/services/world.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { MAP_REGISTRY, MapConfig } from 'src/app/scenes/gamescene/map-config';

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

// Datos del idle-DOWN de cada tipo de enemigo base.
const ENEMY_FRAMES: Record<string, { src: string; cols: number; fps: number }> = {
  slime4: { src: 'assets/sprites/enemy/slime4/Slime1_Idle_with_shadow.png', cols: 6, fps: 6 },
  slime5: { src: 'assets/sprites/enemy/slime5/Slime2_Idle_with_shadow.png', cols: 6, fps: 6 },
  slime6: { src: 'assets/sprites/enemy/slime6/Slime3_Idle_with_shadow.png', cols: 6, fps: 6 },
  orc1:   { src: 'assets/sprites/enemy/orc1/orc1_idle_full.png',            cols: 4, fps: 4 },
};

const FRAME_PX    = 64;  // frameWidth = frameHeight para todos
const DISPLAY_PX  = 48;  // tamaño de visualización
const DIR_ROWS    = 4;   // DOWN / UP / LEFT / RIGHT

@Component({
  selector: 'app-world-map-panel',
  templateUrl: './world-map-panel.component.html',
  styleUrls: ['./world-map-panel.component.scss'],
  standalone: false
})
export class WorldMapPanelComponent implements OnInit, OnDestroy {
  private worldService = inject(WorldService);
  private playerBridge = inject(PlayerBridgeService);
  private mapSub: Subscription;

  activeTab    = 0;
  currentMapId = '';
  selectedMap: MapConfig | null = null;

  readonly pins = MAP_PINS;

  ngOnInit() {
    this.mapSub = this.worldService.currentMap$.subscribe(m => {
      this.currentMapId = m.id;
    });
  }

  ngOnDestroy() {
    this.mapSub?.unsubscribe();
  }

  selectPin(pinId: string) {
    const cfg = MAP_REGISTRY[pinId];
    this.selectedMap = this.selectedMap?.id === pinId ? null : cfg;
  }

  teleport(pinId: string) {
    if (pinId === this.currentMapId) return;
    this.worldService.setCurrentMap(pinId);
    this.playerBridge.restartGameScene();
  }

  spriteStyle(enemyType: string): Record<string, string> {
    const f = ENEMY_FRAMES[enemyType];
    if (!f) return {};
    const scale    = DISPLAY_PX / FRAME_PX;
    const totalW   = f.cols * DISPLAY_PX;
    const duration = `${f.cols / f.fps}s`;
    return {
      'background-image':  `url('${f.src}')`,
      'background-size':   `${totalW}px ${DIR_ROWS * DISPLAY_PX}px`,
      'background-repeat': 'no-repeat',
      '--end-x':           `-${totalW}px`,
      '--duration':        duration,
    };
  }

  spriteClass(enemyType: string): string {
    const f = ENEMY_FRAMES[enemyType];
    return f ? `frames-${f.cols}` : '';
  }
}
