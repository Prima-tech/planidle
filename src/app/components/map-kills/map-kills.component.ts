import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';
import { KillService } from 'src/app/services/kill.service';
import { MapStatsService } from 'src/app/services/map-stats.service';
import { WorldService } from 'src/app/services/world.service';
import { MAP_ELITE_THRESHOLD } from 'src/app/scenes/gamescene/map-config';

export interface KillRow {
  type: string;
  total: number;
  sessionKills: number;
  threshold: number;
  progress: number;   // 0–1 para la barra
  remaining: number;
}

@Component({
  selector: 'app-map-kills',
  templateUrl: './map-kills.component.html',
  styleUrls: ['./map-kills.component.scss'],
  standalone: false,
})
export class MapKillsComponent implements OnInit, OnDestroy {
  mapName = '';
  rows: KillRow[] = [];

  private sub: Subscription;

  constructor(
    private killService: KillService,
    private mapStats: MapStatsService,
    private worldService: WorldService,
  ) {}

  ngOnInit() {
    this.sub = combineLatest([
      this.worldService.currentMap$,
      this.killService.charKills$,
      this.mapStats.sessionKills$,
    ]).subscribe(([map, kills, sessionKills]) => {
      const mapId = map?.id ?? '';
      this.mapName = map?.name ?? mapId;
      const mapKills = kills[mapId] ?? {};
      const threshold = MAP_ELITE_THRESHOLD[mapId] ?? 20;

      const types = new Set([
        ...Object.keys(mapKills),
        ...Object.keys(sessionKills),
      ]);

      this.rows = [...types]
        .filter(t => !t.endsWith('_elite') && !t.endsWith('_oblivion'))
        .map(type => {
          const total    = mapKills[type] ?? 0;
          const session  = sessionKills[type] ?? 0;
          const mod      = session % threshold;
          const remaining = mod === 0 && session > 0 ? 0 : threshold - mod;
          return {
            type,
            total,
            sessionKills: session,
            threshold,
            progress: mod / threshold,
            remaining,
          };
        })
        .sort((a, b) => b.total - a.total);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
