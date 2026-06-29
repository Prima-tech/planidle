import { Component, EventEmitter, Output, inject, OnDestroy, OnInit } from '@angular/core';
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
import { MAP_ELITE_THRESHOLD, MAP_OBLIVION_THRESHOLD, MAP_REGISTRY, ENEMY_RESPAWN_MS, ORE_RESPAWN_MS, TREE_RESPAWN_MS, planetNameForMap } from 'src/app/scenes/gamescene/map-config';
import { enemySpriteStyle, enemySpriteClass } from 'src/app/utils/enemy-sprite.utils';
import { miningTier, gemTier, treeTier } from 'src/app/scenes/gamescene/harvest-config';
import { UnlockService } from 'src/app/services/unlock.service';
import { ActivityService, ActivityKind } from 'src/app/services/activity.service';
import { MapUpgradesService } from 'src/app/services/map-upgrades.service';
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
  maxEnemies: number;       // máximo de enemigos simultáneos del mapa (suma de spawns)
  respawnMs: number;        // tiempo de reaparición tras morir uno
  coinsPerHour: number;
  expPerHour: number;
  drops: AfkDropRate[];
  afkPassives: (AfkPassiveDef & { unlocked: boolean })[];
  /** Eficiencia de minado / tala actuales (cabeceras de las pestañas Minería / Tala). */
  playerMiningEff: number;
  playerWoodEff: number;
  /** Minerales del mapa (mena + gema desbloqueada), cada uno con sus datos (pestaña
   *  Minería). dropGuaranteed/dropPlusChance = multi-drop por eficiencia; afkPerHour =
   *  unidades/hora AFK (reparto 50/50 si hay gema); respawnLabel = tiempo de reaparición. */
  minerals: { name: string; img: string; max: number; efficiency: number; dropGuaranteed: number; dropPlusChance: number; afkPerHour: number; respawnLabel: string }[];
  /** Madera del mapa (pestaña Tala), con sus datos como los minerales; null en el hogar. */
  wood: { name: string; img: string; max: number; efficiency: number; dropGuaranteed: number; dropPlusChance: number; afkPerHour: number; respawnLabel: string } | null;
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
  private mapUpgrades  = inject(MapUpgradesService);

  valueHP$: any = null;
  valueMP$: any = null;
  valueXP$: any = null;
  initStatusBar = false;
  lvl$ = this.playerState.lvl$;

  mapName$ = this.worldService.currentMap$.pipe(map(m => m.name));

  /** Pulsar el nombre del personaje abre la ventana de equipo (lo abre el layout). */
  @Output() openEquipment = new EventEmitter<void>();

  mapPanelOpen = false;

  private _unlockTrigger$ = new BehaviorSubject<void>(undefined);

  mapPanelData$ = combineLatest([
    this.worldService.currentMap$,
    this.mapStats.sessionKills$,
    this._unlockTrigger$,
    // damage$ se reemite al cambiar equipo/talentos/stats → refresca las tasas AFK.
    this.charStats.damage$,
    // mejoras de mapa → recalcula el respawn efectivo (la "Reaparición" lo reduce).
    this.mapUpgrades.changes$,
    // eficiencia de minado/tala del personaje → refresca las cabeceras de Minería/Tala.
    this.charStats.miningEfficiency$,
    this.charStats.woodcuttingEfficiency$,
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

      // Élite/Oblivion ocultos hasta desbloquearlos en las mejoras del mapa.
      const eliteUnlocked    = this.mapUpgrades.eliteUnlocked(mapId);
      const oblivionUnlocked = this.mapUpgrades.oblivionUnlocked(mapId);
      const eliteThresholdEff    = (eliteUnlocked && eliteThreshold < 999) ? eliteThreshold : null;
      const oblivionThresholdEff = (oblivionUnlocked && oblivionThreshold) ? oblivionThreshold : null;
      const baseKillsCurrent   = eliteThresholdEff    ? baseKills % eliteThresholdEff : 0;
      const eliteKillsCurrent  = oblivionThresholdEff ? eliteKills % oblivionThresholdEff : eliteKills;
      const eliteProgress      = eliteThresholdEff    ? baseKillsCurrent / eliteThresholdEff : 0;
      const oblivionProgress   = oblivionThresholdEff ? eliteKillsCurrent / oblivionThresholdEff : 0;

      const spawns    = MAP_REGISTRY[mapId]?.spawns ?? [];
      const enemyType = spawns[0]?.enemyType ?? null;
      // Máx. enemigos simultáneos = maxCount + bono de la mejora de mapa "Enemigos máx."
      // (mismo cálculo que gamescene.effectiveMaxCount, por grupo de spawn).
      const enemyBonus = this.mapUpgrades.extraMaxEnemies(mapId);
      const maxEnemies = spawns.reduce((s, sp) => s + (sp.maxCount ?? 0) + enemyBonus, 0);

      const rates = this.offlineGains.afkRates(mapId);

      // Recursos del mapa (el hogar no genera). Minerales (mena + gema) → pestaña
      // Minería; madera → pestaña Tala.
      const playerEff = this.charStats.currentMiningEfficiency;
      const woodEff   = this.charStats.currentWoodcuttingEfficiency;
      // Drop por golpe según el ratio eficiencia jugador/recurso: floor(ratio) fijas + % de
      // una más (la parte decimal). Igual que efficiencyDropCount() en gamescene.
      const dropInfo = (playerE: number, eff: number) => {
        const ratio = eff > 0 ? playerE / eff : 1;
        const fl = Math.floor(ratio);
        return { dropGuaranteed: Math.max(1, fl), dropPlusChance: fl >= 1 ? Math.round((ratio - fl) * 100) : 0 };
      };

      // AFK/hora por recurso (todas las stats) → se busca por nombre al construir la lista.
      const afk = new Map(this.offlineGains.miningAfkPerHour(mapId).map(a => [a.name, a.perHour]));
      const woodAfk = new Map(this.offlineGains.woodcuttingAfkPerHour(mapId).map(a => [a.name, a.perHour]));
      // Tiempo de reaparición legible (segundos o m:ss).
      const fmt = (ms: number) => {
        const s = Math.round(ms / 1000);
        return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      };

      const minerals: { name: string; img: string; max: number; efficiency: number; dropGuaranteed: number; dropPlusChance: number; afkPerHour: number; respawnLabel: string }[] = [];
      let wood: { name: string; img: string; max: number; efficiency: number; dropGuaranteed: number; dropPlusChance: number; afkPerHour: number; respawnLabel: string } | null = null;
      if (mapId !== 'hogar') {
        const mine = miningTier(mapConfig.mineTier);
        // Mena: máx. simultáneas = 1 base + mejora "Menas máx."; eficiencia del tier.
        const oreRespawnMs = Math.max(5000, ORE_RESPAWN_MS - this.mapUpgrades.oreRespawnReductionMs(mapId));
        minerals.push({ name: mine.dropName, img: this.harvestImg(mine.rockTexture), max: 1 + this.mapUpgrades.extraOre(mapId), efficiency: mine.efficiency ?? 0, ...dropInfo(playerEff, mine.efficiency ?? 0), afkPerHour: afk.get(mine.dropName) ?? 0, respawnLabel: fmt(oreRespawnMs) });
        // Gema: solo si el mapa tiene gemTier Y está desbloqueada en la ventana de mapa.
        const gem = gemTier(mapConfig.gemTier);
        if (gem && this.mapUpgrades.gemUnlocked(mapId)) {
          const gemLabel = `${fmt(this.mapUpgrades.gemRespawnMinMs(mapId))} – ${fmt(this.mapUpgrades.gemRespawnMaxMs(mapId))}`;
          minerals.push({ name: gem.dropName, img: this.harvestImg(gem.rockTexture), max: 1, efficiency: gem.efficiency ?? 0, ...dropInfo(playerEff, gem.efficiency ?? 0), afkPerHour: afk.get(gem.dropName) ?? 0, respawnLabel: gemLabel });
        }
        // Árbol: réplica de la mena (máx. + respawn + eficiencia de tala).
        const tree = treeTier(mapConfig.treeTier);
        const treeRespawnMs = Math.max(5000, TREE_RESPAWN_MS - this.mapUpgrades.treeRespawnReductionMs(mapId));
        wood = { name: tree.dropName, img: this.harvestImg(tree.rockTexture), max: 1 + this.mapUpgrades.extraTrees(mapId), efficiency: tree.efficiency ?? 0, ...dropInfo(woodEff, tree.efficiency ?? 0), afkPerHour: woodAfk.get(tree.dropName) ?? 0, respawnLabel: fmt(treeRespawnMs) };
      }

      return {
        mapId,
        enemyType,
        eliteThreshold:    eliteThresholdEff ?? 0,
        oblivionThreshold: oblivionThresholdEff,
        baseKillsCurrent,
        eliteKillsCurrent,
        eliteProgress,
        oblivionProgress,
        maxEnemies,
        // Respawn efectivo = base − reducción de la mejora de mapa "Reaparición" (suelo 500ms).
        respawnMs: Math.max(500, ENEMY_RESPAWN_MS - this.mapUpgrades.respawnReductionMs(mapId)),
        coinsPerHour: rates?.coinsPerHour ?? 0,
        expPerHour:   rates?.expPerHour ?? 0,
        drops:        rates?.drops ?? [],
        afkPassives: AFK_PASSIVE_REGISTRY.map(p => ({
          ...p,
          unlocked: this.afkBonus.isUnlocked(p.id),
        })),
        playerMiningEff: this.charStats.currentMiningEfficiency,
        playerWoodEff: this.charStats.currentWoodcuttingEfficiency,
        minerals,
        wood,
      } as MapPanelData;
    })
  );

  /** Pestaña activa del panel de info del mapa (lateral): enemigos | minería. */
  mapInfoTab: 'enemies' | 'mining' | 'wood' = 'enemies';

  /** Ruta del sprite del recurso a partir de su clave de textura (misma fuente que el
   *  juego/harvest-config): rock_tier3 → rocks/tier3_rock.png, tree_tier1 → trees/tree_tier1.png */
  private harvestImg(textureKey: string): string {
    if (textureKey.startsWith('rock_')) return `assets/sprites/map/skills/rocks/${textureKey.slice('rock_'.length)}_rock.png`;
    if (textureKey.startsWith('tree_')) return `assets/sprites/map/skills/trees/${textureKey}.png`;
    return '';
  }

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

  // Iconos de drops: recorte de un spritesheet (materiales) o PNG suelto (poción, etc.).
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
