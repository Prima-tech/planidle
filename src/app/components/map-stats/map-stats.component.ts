import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AsgardService } from 'src/app/services/asgard';
import { KillService } from 'src/app/services/kill.service';
import { ActiveEnemyGroup, MapStatsService } from 'src/app/services/map-stats.service';
import { StorageService } from 'src/app/services/storage.service';
import { WorldService } from 'src/app/services/world.service';
import { MapConfig } from 'src/app/scenes/gamescene/map-config';
import { KillMap } from 'src/app/services/kill.service';

interface CharKillRow {
  name: string;
  total: number;
}

@Component({
  selector: 'app-map-stats',
  templateUrl: './map-stats.component.html',
  styleUrls: ['./map-stats.component.scss'],
  standalone: false,
})
export class MapStatsComponent implements OnInit, OnDestroy {
  currentMap: MapConfig;
  activeGroups: ActiveEnemyGroup[] = [];
  totalActive = 0;
  totalMax = 0;
  globalTotal = 0;
  charKillRows: CharKillRow[] = [];

  private subs: Subscription[] = [];

  constructor(
    private worldService: WorldService,
    private mapStats: MapStatsService,
    private killService: KillService,
    private asgardService: AsgardService,
    private storage: StorageService,
  ) {}

  async ngOnInit() {
    this.currentMap = this.worldService.getCurrentMap();

    this.subs.push(
      this.mapStats.activeGroups$.subscribe(groups => {
        this.activeGroups = groups;
        this.totalActive = groups.reduce((s, g) => s + g.count, 0);
      }),
      this.mapStats.totalMax$.subscribe(max => (this.totalMax = max)),
      this.killService.globalKills$.subscribe(kills => {
        this.globalTotal = this._sumKills(kills);
      }),
    );

    await this.loadCharKills();
  }

  private async loadCharKills() {
    const chars: any[] = (await this.asgardService.getCharacters()) ?? [];
    const currentId = String(this.asgardService.selectedPlayer?.id ?? '');
    const rows: CharKillRow[] = [];

    for (const char of chars) {
      if (!char?.id || !char?.name) continue;
      const id = String(char.id);
      let total: number;

      if (id === currentId) {
        total = this._sumKills(this.killService.getCharKillsSnapshot());
      } else {
        const snap = await this.storage.get(`snapshot_char_${id}`);
        total = snap ? this._sumKills(snap.kills ?? {}) : 0;
      }

      if (total > 0) rows.push({ name: char.name, total });
    }

    rows.sort((a, b) => b.total - a.total);
    this.charKillRows = rows;
  }

  private _sumKills(kills: KillMap): number {
    return Object.values(kills)
      .flatMap(r => Object.values(r))
      .reduce((a, b) => a + b, 0);
  }

  increment() { this.mapStats.incrementMax(); }

  decrement() { this.mapStats.decrementMax(); }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }
}
