import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';
import { KillService } from 'src/app/services/kill.service';
import { MapStatsService } from 'src/app/services/map-stats.service';
import { WorldService } from 'src/app/services/world.service';
import { MAP_ELITE_THRESHOLD, MAP_OBLIVION_THRESHOLD } from 'src/app/scenes/gamescene/map-config';

export interface KillRow {
  type: string;
  label: string;
  total: number;
  session: number;
  threshold: number;
  progress: number;
  remaining: number;
  nextLabel: string;
}

@Component({
  selector: 'app-map-kills',
  templateUrl: './map-kills.component.html',
  styleUrls: ['./map-kills.component.scss'],
  standalone: false,
})
export class MapKillsComponent implements OnInit, OnDestroy {
  mapName = '';
  baseRows: KillRow[]    = [];
  eliteRows: KillRow[]   = [];
  oblivionKills: { type: string; total: number }[] = [];

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
      const mapId       = map?.id ?? '';
      this.mapName      = map?.name ?? mapId;
      const mapKills    = kills[mapId] ?? {};
      const eliteThr    = MAP_ELITE_THRESHOLD[mapId]    ?? 20;
      const oblivionThr = MAP_OBLIVION_THRESHOLD[mapId] ?? 5;

      const allTypes = new Set([...Object.keys(mapKills), ...Object.keys(sessionKills)]);

      this.baseRows = [...allTypes]
        .filter(t => !t.endsWith('_elite') && !t.endsWith('_oblivion'))
        .map(type => this.buildRow(type, type, mapKills, sessionKills, eliteThr, 'Elite'))
        .sort((a, b) => b.total - a.total);

      this.eliteRows = [...allTypes]
        .filter(t => t.endsWith('_elite'))
        .map(type => this.buildRow(type, 'Elite', mapKills, sessionKills, oblivionThr, 'Oblivion'))
        .sort((a, b) => b.total - a.total);

      this.oblivionKills = [...allTypes]
        .filter(t => t.endsWith('_oblivion'))
        .map(type => ({ type, total: mapKills[type] ?? 0 }))
        .filter(r => r.total > 0);
    });
  }

  private buildRow(
    type: string,
    label: string,
    mapKills: Record<string, number>,
    sessionKills: Record<string, number>,
    threshold: number,
    nextLabel: string,
  ): KillRow {
    const total   = mapKills[type] ?? 0;
    const session = sessionKills[type] ?? 0;
    const mod     = session % threshold;
    const remaining = mod === 0 && session > 0 ? 0 : threshold - mod;
    return { type, label, total, session, threshold, progress: mod / threshold, remaining, nextLabel };
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
