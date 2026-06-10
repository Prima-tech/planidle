import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, combineLatest, Subscription, map, startWith } from 'rxjs';
import { AsgardService } from 'src/app/services/asgard';
import { ActiveBuff, BuffService } from 'src/app/services/buff.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { expNeeded, MAX_LEVEL, PlayerStateService } from 'src/app/services/player-state.service';
import { WorldService } from 'src/app/services/world.service';
import { MapStatsService } from 'src/app/services/map-stats.service';
import { AfkBonusService, AFK_PASSIVE_REGISTRY, AfkPassiveDef } from 'src/app/services/afk-bonus.service';
import { OfflineGainsService } from 'src/app/services/offline-gains.service';
import { MAP_ELITE_THRESHOLD, MAP_OBLIVION_THRESHOLD, MAP_REGISTRY } from 'src/app/scenes/gamescene/map-config';
import { enemySpriteStyle, enemySpriteClass } from 'src/app/utils/enemy-sprite.utils';

export interface MapPanelData {
  mapId: string;
  enemyType: string | null;
  eliteThreshold: number;
  oblivionThreshold: number | null;
  baseKillsCurrent: number;
  eliteKillsCurrent: number;
  eliteProgress: number;
  oblivionProgress: number;
  coinsPerHour: number;
  expPerHour: number;
  afkPassives: (AfkPassiveDef & { unlocked: boolean })[];
}

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
  private worldService = inject(WorldService);
  private mapStats     = inject(MapStatsService);
  private afkBonus     = inject(AfkBonusService);
  private offlineGains = inject(OfflineGainsService);

  valueHP$: any = null;
  valueMP$: any = null;
  valueXP$: any = null;
  initStatusBar = false;
  coins$ = this.playerState.coins$;
  lvl$   = this.playerState.lvl$;

  mapName$ = this.worldService.currentMap$.pipe(map(m => m.name));

  mapPanelOpen = false;

  private _unlockTrigger$ = new BehaviorSubject<void>(undefined);

  mapPanelData$ = combineLatest([
    this.worldService.currentMap$,
    this.mapStats.sessionKills$,
    this._unlockTrigger$,
  ]).pipe(
    map(([mapConfig, sessionKills]) => {
      const mapId = mapConfig.id;
      const eliteThreshold    = MAP_ELITE_THRESHOLD[mapId]    ?? 999;
      const oblivionThreshold = MAP_OBLIVION_THRESHOLD[mapId] ?? null;

      const baseKills = Object.entries(sessionKills)
        .filter(([t]) => !t.endsWith('_elite') && !t.endsWith('_oblivion'))
        .reduce((s, [, n]) => s + n, 0);

      const eliteKills = Object.entries(sessionKills)
        .filter(([t]) => t.endsWith('_elite'))
        .reduce((s, [, n]) => s + n, 0);

      const eliteThresholdEff  = eliteThreshold < 999 ? eliteThreshold : null;
      const baseKillsCurrent   = eliteThresholdEff    ? baseKills % eliteThresholdEff : 0;
      const eliteKillsCurrent  = oblivionThreshold    ? eliteKills % oblivionThreshold : eliteKills;
      const eliteProgress      = eliteThresholdEff    ? baseKillsCurrent / eliteThresholdEff : 0;
      const oblivionProgress   = oblivionThreshold    ? eliteKillsCurrent / oblivionThreshold : 0;

      const enemyType = MAP_REGISTRY[mapId]?.spawns?.[0]?.enemyType ?? null;

      return {
        mapId,
        enemyType,
        eliteThreshold:    eliteThresholdEff ?? 0,
        oblivionThreshold,
        baseKillsCurrent,
        eliteKillsCurrent,
        eliteProgress,
        oblivionProgress,
        coinsPerHour: this.offlineGains.coinsPerHour(mapId),
        expPerHour:   this.offlineGains.expPerHour(mapId),
        afkPassives: AFK_PASSIVE_REGISTRY.map(p => ({
          ...p,
          unlocked: this.afkBonus.isUnlocked(p.id),
        })),
      } as MapPanelData;
    })
  );

  toggleMapPanel() { this.mapPanelOpen = !this.mapPanelOpen; }

  spriteStyle(enemyType: string) { return enemySpriteStyle(enemyType, 32); }
  spriteClass(enemyType: string) { return enemySpriteClass(enemyType); }

  async unlockPassive(passive: AfkPassiveDef & { unlocked: boolean }): Promise<void> {
    if (passive.unlocked) return;
    const coins = this.playerState.snapshot().coins;
    if (coins < passive.cost) return;
    this.playerState.addCoins(-passive.cost);
    await this.afkBonus.unlock(passive.id);
    this._unlockTrigger$.next();
  }

  activeBuffs: ActiveBuff[] = [];
  buffRatios: Record<string, number> = {};
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
      map(status => ({
        ratio:   Math.max(0, Math.min(1, status.HP / status.HPMax)),
        current: Math.max(0, Math.floor(status.HP)),
        max:     status.HPMax,
      }))
    );
    this.valueMP$ = this.playerState.state$.pipe(
      map(s => ({
        ratio:   Math.max(0, Math.min(1, s.mp / (s.mpMax || 1))),
        current: Math.floor(s.mp),
        max:     s.mpMax,
      }))
    );
    this.valueXP$ = this.playerState.state$.pipe(
      map(s => {
        const needed = expNeeded(s.lvl);
        return {
          ratio:   s.lvl >= MAX_LEVEL ? 1 : s.exp / needed,
          current: s.exp,
          max:     needed,
        };
      })
    );

    this.initStatusBar = true;

    this.buffSub = this.buffService.buffs$.subscribe(buffs => {
      this.activeBuffs = buffs;
    });
    this.tickInterval = setInterval(() => {
      this.buffService.tick();
      this.activeBuffs = [...this.activeBuffs];
      const ratios: Record<string, number> = {};
      for (const buff of this.activeBuffs) ratios[buff.id] = this.buffService.ratio(buff);
      this.buffRatios = ratios;
    }, 100);
  }

  ngOnDestroy(): void {
    this.buffSub?.unsubscribe();
    clearInterval(this.tickInterval);
  }

}
