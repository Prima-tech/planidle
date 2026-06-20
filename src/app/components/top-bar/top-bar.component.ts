import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, combineLatest, Subscription, map, startWith } from 'rxjs';
import { AsgardService } from 'src/app/services/asgard';
import { StorageService } from 'src/app/services/storage.service';
import { EquipmentSnapshot } from 'src/app/services/equipment.service';
import { ActiveBuff, BuffService } from 'src/app/services/buff.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { expNeeded, MAX_LEVEL, PlayerStateService } from 'src/app/services/player-state.service';
import { WorldService } from 'src/app/services/world.service';
import { MapStatsService } from 'src/app/services/map-stats.service';
import { AfkBonusService, AFK_PASSIVE_REGISTRY, AfkPassiveDef } from 'src/app/services/afk-bonus.service';
import { OfflineGainsService, AfkDropRate } from 'src/app/services/offline-gains.service';
import { sheetPos, sheetBgSize } from 'src/app/utils/item-icon.util';
import { MAP_ELITE_THRESHOLD, MAP_OBLIVION_THRESHOLD, MAP_REGISTRY, planetNameForMap } from 'src/app/scenes/gamescene/map-config';
import { enemySpriteStyle, enemySpriteClass } from 'src/app/utils/enemy-sprite.utils';
import { UnlockService } from 'src/app/services/unlock.service';
import { ActivityService, ActivityKind } from 'src/app/services/activity.service';
import { CharacterStatsService } from 'src/app/services/character-stats.service';

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
  drops: AfkDropRate[];
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
  private storage      = inject(StorageService);
  private unlocks      = inject(UnlockService);
  private activity     = inject(ActivityService);
  private charStats    = inject(CharacterStatsService);

  valueHP$: any = null;
  valueMP$: any = null;
  valueXP$: any = null;
  initStatusBar = false;
  lvl$ = this.playerState.lvl$;

  mapName$ = this.worldService.currentMap$.pipe(map(m => m.name));

  mapPanelOpen = false;

  private _unlockTrigger$ = new BehaviorSubject<void>(undefined);

  mapPanelData$ = combineLatest([
    this.worldService.currentMap$,
    this.mapStats.sessionKills$,
    this._unlockTrigger$,
    // damage$ se reemite al cambiar equipo/talentos/stats → refresca las tasas AFK.
    this.charStats.damage$,
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

      const rates = this.offlineGains.afkRates(mapId);

      return {
        mapId,
        enemyType,
        eliteThreshold:    eliteThresholdEff ?? 0,
        oblivionThreshold,
        baseKillsCurrent,
        eliteKillsCurrent,
        eliteProgress,
        oblivionProgress,
        coinsPerHour: rates?.coinsPerHour ?? 0,
        expPerHour:   rates?.expPerHour ?? 0,
        drops:        rates?.drops ?? [],
        afkPassives: AFK_PASSIVE_REGISTRY.map(p => ({
          ...p,
          unlocked: this.afkBonus.isUnlocked(p.id),
        })),
      } as MapPanelData;
    })
  );

  /** Récord de distancia y muertes de la expedición (Modo Mundo): se muestran en el
   *  panel desplegable de la barra de vida cuando el personaje está explorando. */
  recordDistance$ = this.playerState.worldBestDistanceM$;
  deaths$ = this.playerState.currentDeaths$;

  /** ¿El personaje está en el Modo Mundo ahora mismo? (la CD del tick lo reevalúa). */
  get isExploring(): boolean { return this.activity.current === 'exploring'; }

  toggleMapPanel() { this.mapPanelOpen = !this.mapPanelOpen; }

  // ── Selector de personaje (botón arriba-dcha de la pastilla) ────────────────

  charListOpen = false;
  // Botón del roster: solo visible con 2+ personajes desbloqueados.
  hasMultipleChars = false;
  // equipment null = personaje activo (sprite reactivo al equipo actual). exploring =
  // está en el Modo Mundo (mostramos el planeta, no el mapa de combate, que está stale).
  rosterItems: { char: any; equipment: EquipmentSnapshot | null; mapName: string; exploring: boolean; planet: string }[] = [];

  /** Recuenta personajes desbloqueados para mostrar/ocultar el selector. */
  private async refreshCharCount(): Promise<void> {
    const chars = (await this.asgardService.getCharacters()) ?? [];
    const unlocked = chars.filter((c: any) => c?.id && this.unlocks.isCharacterUnlocked(c.name)).length;
    this.hasMultipleChars = unlocked >= 2;
  }

  async toggleCharList(): Promise<void> {
    this.charListOpen = !this.charListOpen;
    if (!this.charListOpen) return;

    const chars = (await this.asgardService.getCharacters()) ?? [];
    const items: typeof this.rosterItems = [];
    for (const c of chars) {
      if (!c?.id) continue;
      // Solo personajes desbloqueados: el resto no aparece (sin candado)
      if (!this.unlocks.isCharacterUnlocked(c.name)) continue;
      if (this.isCurrent(c)) {
        // Personaje activo: estado EN VIVO. En el Modo Mundo el mapa actual sigue
        // siendo el de combate (stale), así que la actividad la leemos del servicio.
        const mapId = this.worldService.getCurrentMap()?.id;
        items.push({ char: c, equipment: null, ...this.locationOf(mapId, this.activity.current) });
      } else {
        const snap = await this.storage.get(`snapshot_char_${c.id}`);
        items.push({ char: c, equipment: snap?.equipment ?? {}, ...this.locationOf(snap?.mapId, snap?.activity) });
      }
    }
    this.rosterItems = items;
  }

  private mapNameOf(mapId: string | undefined): string {
    if (!mapId) return '—';
    return MAP_REGISTRY[mapId]?.name ?? mapId;
  }

  /** Ubicación para la ficha del roster. Explorando (Modo Mundo) muestra el planeta y
   *  marca `exploring` (el template antepone "Explorando"); si no, el nombre del mapa. */
  private locationOf(mapId: string | undefined, activity: ActivityKind | undefined): { mapName: string; exploring: boolean; planet: string } {
    return {
      mapName:   this.mapNameOf(mapId),
      exploring: activity === 'exploring',
      planet:    planetNameForMap(mapId ?? 'hogar'),
    };
  }

  isCurrent(c: any): boolean {
    return String(c?.id) === String(this.asgardService.selectedPlayer?.id);
  }

  async pickCharacter(c: any): Promise<void> {
    this.charListOpen = false;
    if (this.isCurrent(c)) return;
    await this.asgardService.setSelectedPlayer(c);
  }

  spriteStyle(enemyType: string) { return enemySpriteStyle(enemyType, 32); }
  spriteClass(enemyType: string) { return enemySpriteClass(enemyType); }

  // Iconos de drops: recorte del spritesheet (poción usa icons1) o PNG suelto.
  dropSheetPos(d: AfkDropRate) { return sheetPos(d.entry.iconFrame, d.entry.iconFrameCols, d.entry.iconFrameSize, d.entry.iconContentSize); }
  dropSheetBg(d: AfkDropRate)  { return sheetBgSize(d.entry.iconFrameCols, d.entry.iconFrameSize, d.entry.iconContentSize); }
  /** Cantidad/hora redondeada para mostrar (1 decimal si <10). */
  dropPerHour(d: AfkDropRate): string {
    return d.perHour >= 10 ? Math.round(d.perHour).toString() : d.perHour.toFixed(1);
  }

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
  private unlockSub: Subscription;
  private tickInterval: any;

  // Avatar de la barra de vida: icono de lo que estoy haciendo ahora mismo
  // (espada/pico/botas/hacha). null = idle (p.ej. en Asgard) → el template pinta "Zzz".
  activityIcon: string | null = null;

  /** Actualiza el icono del avatar según la actividad actual del personaje. */
  private refreshActivityIcon(): void {
    this.activityIcon = this.activity.def(this.activity.current).iconImg ?? null;
  }

  // Cooldown de la poción auto-equipada, mostrado junto a los buffos
  potionCdActive = false;
  potionCdRatio = 1;
  potionCdSeconds = 0;
  potionCdIcon: string | null = null;

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
    this.refreshActivityIcon();

    // Conteo inicial + recálculo cuando se desbloquea/bloquea algún personaje.
    this.refreshCharCount();
    this.unlockSub = this.unlocks.changes$.subscribe(() => this.refreshCharCount());

    this.buffSub = this.buffService.buffs$.subscribe(buffs => {
      this.activeBuffs = buffs;
    });
    this.tickInterval = setInterval(() => {
      this.buffService.tick();
      this.activeBuffs = [...this.activeBuffs];
      const ratios: Record<string, number> = {};
      for (const buff of this.activeBuffs) ratios[buff.id] = this.buffService.ratio(buff);
      this.buffRatios = ratios;

      // Cooldown de poción: visible solo mientras corre y haya poción equipada
      this.potionCdActive  = this.playerBridge.autoPotionOnCooldown && !!this.playerBridge.autoPotionItem;
      this.potionCdRatio   = this.playerBridge.autoPotionReadyRatio;
      this.potionCdSeconds = this.playerBridge.autoPotionCooldownSeconds;
      this.potionCdIcon    = this.playerBridge.autoPotionItem?.icon ?? null;

      this.refreshActivityIcon();
    }, 100);
  }

  ngOnDestroy(): void {
    this.buffSub?.unsubscribe();
    this.unlockSub?.unsubscribe();
    clearInterval(this.tickInterval);
  }

}
