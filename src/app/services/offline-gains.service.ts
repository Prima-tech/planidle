import { Injectable } from '@angular/core';
import { GameSnapshot } from './save.service';
import { MAP_REGISTRY, planetNameForMap } from '../scenes/gamescene/map-config';
import { RUN_UNLOCK_POINTS } from '../scenes/worldrun/run-unlock-points';
import { AfkBonusService } from './afk-bonus.service';
import { CharacterStatsService } from './character-stats.service';
import { EquipmentService } from './equipment.service';
import { TalentService } from './talent.service';
import { GatheringSkillId } from './gathering-skills.service';
import { ENEMY_REGISTRY } from '../enemy/enemy-config';
import { LOOT_TABLES, EXP_REWARDS, LootEntry, ITEM_CATALOG } from '../physics/griddrops';
import { HARVEST_KINDS, HARVEST_HITS, harvestKindForSkill, miningTier } from '../scenes/gamescene/harvest-config';

const MIN_OFFLINE_SECONDS = 10;
const MAX_OFFLINE_HOURS   = 8;
const METERS_PER_MINUTE   = 10; // metros explorados por minuto AFK en el Modo Mundo

// Cadencia de ataque: el jugador pega una vez por animación de ataque (6 frames a
// 10 fps ≈ 600 ms). Define la DPS junto con el daño por golpe.
const ATTACK_INTERVAL_MS = 600;
// Sobrecoste por kill además del tiempo puro de pelea: acercarse al siguiente
// enemigo + respawn amortizado. Sin esto, contra enemigos frágiles los kills/hora
// se dispararían a valores irreales.
const TRAVEL_SECS = 1.5;

export interface EnemyGain {
  enemyType: string;
  displayName: string;
  kills: number;
}

/** Tasa de drop de un item por hora AFK (display del panel). */
export interface AfkDropRate {
  entry: LootEntry;
  perHour: number;
}

/** Item realmente acumulado durante el AFK offline (para meter al inventario). */
export interface AfkItemGain {
  entry: LootEntry;
  qty: number;
}

/** Tasas AFK reales de un mapa, derivadas del combate (DPS vs vida + loot real). */
export interface AfkRates {
  enemyType: string;
  killsPerHour: number;
  coinsPerHour: number;
  expPerHour: number;
  drops: AfkDropRate[];
}

export interface OfflineGains {
  // 'killing' = combate. 'exploring' = Modo Mundo (metros). 'gathering' = minar/talar.
  kind: 'killing' | 'exploring' | 'gathering';
  elapsedMs: number;
  mapId: string;
  mapName: string;
  // Combate
  enemyGains: EnemyGain[];
  coins: number;
  exp: number;
  itemDrops?: AfkItemGain[];     // botín real acumulado (combate o recolección)
  // Exploración (Modo Mundo)
  planetName?: string;
  exploreMeters?: number;        // metros ganados AFK (10/min)
  unlockedFlags?: string[];      // flags de mapa a marcar al recoger (idempotente)
  unlockedMapNames?: string[];   // nombres de esos mapas (para el modal)
  // Recolección (minería / tala)
  gatherSkill?: GatheringSkillId;
  gatherXp?: number;             // XP de la skill acumulada
  gatherNodes?: number;          // nodos recolectados
}

@Injectable({ providedIn: 'root' })
export class OfflineGainsService {

  constructor(
    private afkBonus: AfkBonusService,
    private charStats: CharacterStatsService,
    private equipment: EquipmentService,
    private talent: TalentService,
  ) {}

  /**
   * Tasas AFK REALES de un mapa, calculadas a partir del combate:
   *  - DPS del jugador (daño por golpe × valor esperado del crítico ÷ cadencia)
   *  - vida del enemigo del mapa → tiempo por kill (+ sobrecoste de viaje)
   *  - loot real (LOOT_TABLES) con el drop rate del personaje y del mapa
   * Devuelve null si el mapa no tiene enemigos o el daño es nulo.
   */
  afkRates(mapId: string): AfkRates | null {
    const mapConfig = MAP_REGISTRY[mapId];
    if (!mapConfig || mapConfig.spawns.length === 0) return null;

    const enemyType = mapConfig.spawns[0].enemyType;
    const enemyCfg  = ENEMY_REGISTRY[enemyType];
    if (!enemyCfg) return null;

    // Daño efectivo por golpe. Los enemigos no tienen defensa, así que no hay
    // reducción; el arma a distancia (bastón) golpea con daño mágico.
    const ranged     = this.equipment.slots.some(s => s.item?.weaponKind === 'ranged');
    const hitDamage  = Math.max(1, ranged ? this.charStats.currentMagicDamage : this.charStats.currentDamage);
    const critChance = this.charStats.currentCritChance / 100;
    const critMult   = this.charStats.currentCritDamage / 100;
    const expectedHit = hitDamage * (1 + critChance * (critMult - 1));
    const dps = expectedHit / (ATTACK_INTERVAL_MS / 1000);

    const secsToKill   = enemyCfg.hp / dps;
    const killsPerHour = Math.floor(3600 / (secsToKill + TRAVEL_SECS));
    if (killsPerHour <= 0) return null;

    // Drop rate real: bonus del personaje (%) y modificador del mapa sobre la chance base.
    const dropMult = (1 + this.charStats.currentDropRateBonus / 100) * (mapConfig.dropRateModifier ?? 1);
    const table    = LOOT_TABLES[enemyType] ?? LOOT_TABLES['default'];

    let coinsPerKill = 0;
    const drops: AfkDropRate[] = [];
    for (const entry of table) {
      const avgQty = (entry.minQty + entry.maxQty) / 2;
      if (entry.type === 'currency') {
        coinsPerKill += entry.chance * avgQty;
      } else {
        const finalChance = Math.min(1, entry.chance * dropMult);
        const perHour = killsPerHour * finalChance * avgQty;
        if (perHour > 0) drops.push({ entry, perHour });
      }
    }

    return {
      enemyType,
      killsPerHour,
      coinsPerHour: Math.floor(killsPerHour * coinsPerKill * this.afkBonus.coinsMult),
      expPerHour:   Math.floor(killsPerHour * (EXP_REWARDS[enemyType] ?? 10) * this.afkBonus.expMult),
      drops,
    };
  }

  /**
   * @param overrideElapsedMs Tiempo offline en ms calculado por el SERVIDOR (claim_offline).
   *   Cuando llega (modo Supabase), se usa en vez del reloj del cliente — así no se
   *   puede fabricar progreso cambiando la hora del móvil. En modo local es undefined
   *   y se cae al cálculo con el timestamp del snapshot (offline-first, sin alternativa).
   */
  calculate(snapshot: GameSnapshot, overrideElapsedMs?: number): OfflineGains | null {
    let elapsedMs: number;
    if (overrideElapsedMs != null && Number.isFinite(overrideElapsedMs)) {
      elapsedMs = overrideElapsedMs;
      console.log('[OfflineGains] elapsed (servidor):', (elapsedMs / 60000).toFixed(1), 'min | mapId:', snapshot?.mapId);
    } else {
      const ref = snapshot?.lastSeen ?? snapshot?.lastModified;
      console.log('[OfflineGains] ref (cliente):', ref, '| mapId:', snapshot?.mapId);
      if (!ref) { console.log('[OfflineGains] sin timestamp'); return null; }
      elapsedMs = Date.now() - new Date(ref).getTime();
    }

    const elapsedMinutes = elapsedMs / 60000;
    console.log('[OfflineGains] minutos offline:', elapsedMinutes.toFixed(1));
    if (elapsedMs / 1000 < MIN_OFFLINE_SECONDS) { console.log('[OfflineGains] < 10 s, ignorado'); return null; }

    const cappedMinutes = Math.min(elapsedMinutes, MAX_OFFLINE_HOURS * 60);

    // El AFK continúa la ÚLTIMA acción del personaje (snapshot.activity):
    //  - exploring → metros en el Modo Mundo
    //  - mining/chopping → recolección (recursos + XP de la skill)
    //  - resto (killing/idle) → combate en el mapa
    if (snapshot.activity === 'exploring') {
      return this.calculateExploring(snapshot, cappedMinutes);
    }
    if (snapshot.activity === 'mining' || snapshot.activity === 'chopping') {
      return this.calculateGathering(snapshot, cappedMinutes);
    }

    const mapConfig = MAP_REGISTRY[snapshot.mapId ?? 'hogar'];
    if (!mapConfig || mapConfig.spawns.length === 0) { console.log('[OfflineGains] mapa sin spawns:', snapshot.mapId); return null; }

    // AFK real: kills derivados de la DPS del personaje contra la vida del enemigo,
    // con monedas/XP/botín del loot real. El mismo modelo que muestra el panel.
    const rates = this.afkRates(mapConfig.id);
    if (!rates) { console.log('[OfflineGains] sin tasas de combate:', mapConfig.id); return null; }

    const hours = cappedMinutes / 60;
    const kills = Math.floor(rates.killsPerHour * hours);
    if (kills === 0) return null;

    const enemyCfg = ENEMY_REGISTRY[rates.enemyType];
    const enemyGains: EnemyGain[] = [{
      enemyType:   rates.enemyType,
      displayName: enemyCfg?.displayName ?? rates.enemyType,
      kills,
    }];

    const itemDrops: AfkItemGain[] = rates.drops
      .map(d => ({ entry: d.entry, qty: Math.floor(d.perHour * hours) }))
      .filter(d => d.qty > 0);

    return {
      kind:       'killing',
      elapsedMs:  Math.floor(cappedMinutes * 60000),
      mapId:      mapConfig.id,
      mapName:    mapConfig.name,
      enemyGains,
      coins: Math.floor(rates.coinsPerHour * hours),
      exp:   Math.floor(rates.expPerHour * hours),
      itemDrops,
    };
  }

  /** Ganancias AFK recolectando (minería / tala): nodos por hora derivados de los
   *  golpes para destruir + sobrecoste de viaje → XP de la skill y recurso real
   *  (con el multiplicador de botín de minería de los talentos). */
  private calculateGathering(snapshot: GameSnapshot, cappedMinutes: number): OfflineGains | null {
    const skill: GatheringSkillId = snapshot.activity === 'chopping' ? 'woodcutting' : 'mining';
    const kind  = HARVEST_KINDS[harvestKindForSkill(skill)];

    const secsPerNode  = HARVEST_HITS * (ATTACK_INTERVAL_MS / 1000) + TRAVEL_SECS;
    const nodesPerHour = Math.floor(3600 / secsPerNode);
    const hours = cappedMinutes / 60;
    const nodes = Math.floor(nodesPerHour * hours);
    if (nodes <= 0) return null;

    const gatherXp = nodes * kind.xp;

    // Recurso soltado (madera / piedra molida). La minería escala con el talento
    // miningDrop (igual que en destroyNode). Va por itemDrops → al inventario.
    const itemDrops: AfkItemGain[] = [];
    if (kind.drop) {
      const dropMult = skill === 'mining' ? 1 + (this.talent.getBonus().miningDrop ?? 0) : 1;
      const avgQty   = (kind.drop.min + kind.drop.max) / 2;
      const qty      = Math.floor(nodes * avgQty * dropMult);
      // La minería suelta el mineral del tier del mapa; la tala, su recurso fijo.
      const dropName = skill === 'mining'
        ? miningTier(MAP_REGISTRY[snapshot.mapId ?? '']?.mineTier).dropName
        : kind.drop.name;
      const entry    = ITEM_CATALOG.find(e => e.name === dropName);
      if (entry && qty > 0) itemDrops.push({ entry, qty });
    }

    const mapName = MAP_REGISTRY[snapshot.mapId ?? 'hogar']?.name ?? snapshot.mapId ?? '';
    return {
      kind:        'gathering',
      elapsedMs:   Math.floor(cappedMinutes * 60000),
      mapId:       snapshot.mapId ?? 'hogar',
      mapName,
      enemyGains:  [],
      coins:       0,
      exp:         0,
      itemDrops,
      gatherSkill: skill,
      gatherXp,
      gatherNodes: nodes,
    };
  }

  /** Ganancias AFK explorando: metros (10/min) + mapas desbloqueados al cruzar sus
   *  hitos. Los flags se devuelven para marcarlos al recoger (LayoutComponent). */
  private calculateExploring(snapshot: GameSnapshot, cappedMinutes: number): OfflineGains | null {
    const exploreMeters = Math.floor(METERS_PER_MINUTE * cappedMinutes);
    if (exploreMeters <= 0) return null;

    const oldDistance = snapshot.playerState?.explorationDistanceM ?? 0;
    const newDistance = oldDistance + exploreMeters;

    // Hitos cruzados POR el AFK: entre la distancia previa y la nueva (exclusivo del
    // inicio para no re-anunciar uno ya alcanzado). setFlag al recoger es idempotente.
    const crossed = RUN_UNLOCK_POINTS.filter(
      pt => pt.distanceM > oldDistance && pt.distanceM <= newDistance,
    );

    const mapName = MAP_REGISTRY[snapshot.mapId ?? 'hogar']?.name ?? snapshot.mapId ?? '';
    return {
      kind:        'exploring',
      elapsedMs:   Math.floor(cappedMinutes * 60000),
      mapId:       snapshot.mapId ?? 'hogar',
      mapName,
      enemyGains:  [],
      coins:       0,
      exp:         0,
      planetName:  planetNameForMap(snapshot.mapId ?? 'hogar'),
      exploreMeters,
      unlockedFlags:    crossed.map(pt => pt.flag),
      unlockedMapNames: crossed.map(pt => MAP_REGISTRY[pt.mapId]?.name ?? pt.mapId),
    };
  }

  formatElapsed(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
}
