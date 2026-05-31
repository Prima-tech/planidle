import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MAP_REGISTRY, MapConfig } from '../scenes/gamescene/map-config';

@Injectable({ providedIn: 'root' })
export class WorldService {
  private currentMapId = 'hogar';
  readonly currentMap$ = new BehaviorSubject<MapConfig>(MAP_REGISTRY['hogar']);

  getCurrentMap(): MapConfig {
    return MAP_REGISTRY[this.currentMapId];
  }

  setCurrentMap(id: string): void {
    this.currentMapId = id;
    this.currentMap$.next(MAP_REGISTRY[id]);
  }
}
