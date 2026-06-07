import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription, map, startWith } from 'rxjs';
import { AsgardService } from 'src/app/services/asgard';
import { ActiveBuff, BuffService } from 'src/app/services/buff.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { expNeeded, MAX_LEVEL, PlayerStateService } from 'src/app/services/player-state.service';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss'],
  standalone: false,
})
export class TopBarComponent implements OnInit, OnDestroy {
  private playerState  = inject(PlayerStateService);
  private playerBridge = inject(PlayerBridgeService);
  private buffService  = inject(BuffService);
  asgardService        = inject(AsgardService);

  valueHP$: any = null;
  valueMP$: any = null;
  valueXP$: any = null;
  initStatusBar = false;
  coins$ = this.playerState.coins$;
  lvl$   = this.playerState.lvl$;

  activeBuffs: ActiveBuff[] = [];
  private buffSub: Subscription;
  private tickInterval: any;

  private readonly CLASS_ICONS: Record<string, string> = {
    Warrior:   'shield-outline',
    Mage:      'flash-outline',
    Hunter:    'scan-outline',
    Priest:    'heart-outline',
    Necron:    'skull-outline',
    Ancestral: 'infinite-outline',
  };

  get classIcon(): string {
    const cls = this.asgardService.selectedPlayer?.character_class;
    return this.CLASS_ICONS[cls] ?? 'person-outline';
  }

  get classKey(): string {
    return (this.asgardService.selectedPlayer?.character_class ?? '').toLowerCase();
  }

  ngOnInit() {
    this.valueHP$ = this.playerBridge.player.status$.pipe(
      startWith(this.playerBridge.getPlayer().getStatus()),
      map(status => {
        const value = Math.max(0, Math.min(1, status.HP / status.HPMax));
        const color = value < 0.25 ? 'danger' : value < 0.5 ? 'warning' : 'success';
        return { value, color };
      })
    );
    this.valueMP$ = this.playerState.state$.pipe(
      map(s => Math.max(0, Math.min(1, s.mp / (s.mpMax || 1))))
    );
    this.valueXP$ = this.playerState.state$.pipe(
      map(s => ({
        value: s.lvl >= MAX_LEVEL ? 1 : s.exp / expNeeded(s.lvl),
        color: 'warning',
      }))
    );

    this.initStatusBar = true;

    this.buffSub = this.buffService.buffs$.subscribe(buffs => {
      this.activeBuffs = buffs;
    });
    this.tickInterval = setInterval(() => {
      this.buffService.tick();
      this.activeBuffs = [...this.activeBuffs];
    }, 100);
  }

  ngOnDestroy(): void {
    this.buffSub?.unsubscribe();
    clearInterval(this.tickInterval);
  }

  buffRatio(buff: ActiveBuff): number {
    return this.buffService.ratio(buff);
  }
}
