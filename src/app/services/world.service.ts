import { Injectable } from '@angular/core';
import { MAP_REGISTRY, MapConfig } from '../scenes/gamescene/map-config';

@Injectable({ providedIn: 'root' })
export class WorldService {
  private currentMapId = 'hogar';

  getCurrentMap(): MapConfig {
    return MAP_REGISTRY[this.currentMapId];
  }

  setCurrentMap(id: string): void {
    this.currentMapId = id;
  }
}
