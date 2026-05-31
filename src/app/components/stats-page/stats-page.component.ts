import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AsgardService } from 'src/app/services/asgard';
import { KillService, KillMap } from 'src/app/services/kill.service';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { SaveService } from 'src/app/services/save.service';

const ENEMY_LABELS: Record<string, string> = {
  orc1:          'Orco',
  orc1_elite:    'Orco Élite',
  orc1_oblivion: 'Orco Oblivion',
};

interface KillRow {
  label: string;
  count: number;
}

@Component({
  selector: 'app-stats-page',
  templateUrl: './stats-page.component.html',
  styleUrls: ['./stats-page.component.scss'],
  standalone: false,
})
export class StatsPageComponent implements OnInit, OnDestroy {

  globalCoins   = 0;
  lifetimeCoins = 0;
  totalDeaths   = 0;
  playerName    = '';
  killRows: KillRow[] = [];

  private sub: Subscription;

  constructor(
    private killService:   KillService,
    private playerState:   PlayerStateService,
    private saveService:   SaveService,
    private asgard:        AsgardService,
  ) {}

  async ngOnInit() {
    this.playerName  = this.asgard.selectedPlayer?.name ?? '';
    this.globalCoins = await this.saveService.getGlobalCoins();

    this.sub = this.playerState.state$.subscribe(s => {
      this.lifetimeCoins = s.lifetimeCoins ?? 0;
      this.totalDeaths   = s.totalDeaths   ?? 0;
    });

    this.sub.add(
      this.killService.charKills$.subscribe(kills => this.buildKillRows(kills))
    );
  }

  private buildKillRows(charKills: KillMap): void {
    const totals: Record<string, number> = {};
    Object.values(charKills).forEach(mapRecord => {
      Object.entries(mapRecord).forEach(([type, count]) => {
        totals[type] = (totals[type] ?? 0) + count;
      });
    });
    this.killRows = Object.entries(totals)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ label: ENEMY_LABELS[type] ?? type, count }))
      .sort((a, b) => b.count - a.count);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
