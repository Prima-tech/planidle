import { Component, Input } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PlayerStateService, expNeeded, MAX_LEVEL } from 'src/app/services/player-state.service';
import { CharacterStatsService, DamageBreakdown } from 'src/app/services/character-stats.service';

interface StatsViewModel {
  lvl:        number;
  exp:        number;
  expCap:     number;
  expPct:     number;
  isMaxLevel: boolean;
  damage:     DamageBreakdown;
}

@Component({
  selector: 'app-char-stats',
  templateUrl: './char-stats.component.html',
  styleUrls: ['./char-stats.component.scss'],
  standalone: false,
})
export class CharStatsComponent {

  @Input() section: 'all' | 'header' | 'combat' = 'all';

  readonly vm$: Observable<StatsViewModel>;

  constructor(playerState: PlayerStateService, charStats: CharacterStatsService) {
    this.vm$ = combineLatest([playerState.state$, charStats.damage$]).pipe(
      map(([s, damage]) => {
        const isMaxLevel = s.lvl >= MAX_LEVEL;
        const expCap     = isMaxLevel ? 0 : expNeeded(s.lvl);
        return {
          lvl: s.lvl,
          exp: s.exp,
          expCap,
          expPct: isMaxLevel ? 100 : Math.min(100, (s.exp / expCap) * 100),
          isMaxLevel,
          damage,
        };
      })
    );
  }
}
