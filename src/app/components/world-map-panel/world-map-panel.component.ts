import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WorldService } from 'src/app/services/world.service';
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

@Component({
  selector: 'app-world-map-panel',
  templateUrl: './world-map-panel.component.html',
  styleUrls: ['./world-map-panel.component.scss'],
  standalone: false
})
export class WorldMapPanelComponent implements OnInit, OnDestroy {
  private worldService = inject(WorldService);
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
}
