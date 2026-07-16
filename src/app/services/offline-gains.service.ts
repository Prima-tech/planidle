import { Injectable } from '@angular/core';
import { GameSnapshot } from './save.service';
import { MAP_REGISTRY, planetNameForMap, ENEMY_RESPAWN_MS, ORE_RESPAWN_MS, TREE_RESPAWN_MS } from '../scenes/gamescene/map-config';
import { MapUpgradesService } from './map-upgrades.service';
import { MapDominionService } from './map-dominion.service';
import { RunProgressService } from './run-progress.service';
import { AfkBonusService } from './afk-bonus.service';
import { CharacterStatsService } from './character-stats.service';
import { EquipmentService } from './equipment.service';
import { TalentService } from './talent.service';
import { GatheringSkillId } from './gathering-skills.service';
import { ENEMY_REGISTRY } from '../enemy/enemy-config';
import { LOOT_TABLES, EXP_REWARDS, LootEntry, ITEM_CATALOG } from '../physics/griddrops';
import { HARVEST_KINDS, harvestKindForSkill, miningTier, gemTier, treeTier } from '../scenes/gamescene/harvest-config';

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
// Eficiencia AFK: las ganancias offline rinden 1/10 de lo que rendiría jugando activo
// (kills/hora ÷ 10 → oro, exp y drops también ÷ 10). Aplica a TODOS los mapas.
const AFK_GAIN_FACTOR = 0.1;

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
  exploreStars?: number;         // estrellas de los generadores pasivos (star_prod1/2/3)
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
    private mapUpgrades: MapUpgradesService,
    private dominion: MapDominionService,
    private runProgress: RunProgressService,
  ) {}

  /**
   * Tasas AFK REALES de un mapa, calculadas a partir del combate:
   *  - DPS del jugador (daño por golpe × valor esperado del crítico ÷ cadencia)
   *  - vida del enemigo → tiempo de matar uno
   *  - respawn y enemigos máx. simultáneos (incluidas las mejoras de mapa) → suministro:
   *    kills/hora = 3600 / max(tiempoDeMatar, respawn ÷ maxEnemigos)
   *  - loot real (LOOT_TABLES) con el drop rate del personaje y del mapa, + exp por kill
   * Devuelve null si el mapa no tiene enemigos o el daño es nulo.
   */
  /**
   * AFK/hora de cada mineral del mapa (mena + gema), con TODAS las stats:
   *  - velocidad de minado: golpes para destruir (vida/fuerza) ÷ cadencia + viaje, y los misses por
   *    falta de eficiencia (prob. acierto = min(1, efic. jugador / efic. mena)) lo frenan.
   *  - suministro: las menas reaparecen cada ORE_RESPAWN_MS (−mejora "Respawn de menas"),
   *    no puedes minar más rápido de lo que aparecen.
   *  - drop por nodo: multi-drop por eficiencia (E[unidades] = max(1, ratio)) × talento
   *    miningDrop × media del rango de drop.
   * Devuelve [] en el hogar o mapas sin minería.
   */
  miningAfkPerHour(mapId: string): { name: string; perHour: number }[] {
    const mapConfig = MAP_REGISTRY[mapId];
    if (!mapConfig || mapId === 'hogar') return [];

    const gem = gemTier(mapConfig.gemTier);
    const gemAvailable = !!gem && this.mapUpgrades.gemUnlocked(mapId);
    // AFK reparte el tiempo: si hay gemas desbloqueadas, mitad mena / mitad gema.
    const oreShare = gemAvailable ? 0.5 : 1;

    const oreEff = this.charStats.currentMiningEfficiency;
    const minePow = this.charStats.currentMiningPower;
    const mine = miningTier(mapConfig.mineTier);
    const out: { name: string; perHour: number }[] = [
      { name: mine.dropName, perHour: Math.floor(this.mineableThroughput(oreEff, mine.efficiency ?? 0, this.oreSupplySecs(mapId), this.miningDropMult(), mine.mineHp ?? 20, minePow).perHour * oreShare) },
    ];
    if (gemAvailable) {
      out.push({ name: gem!.dropName, perHour: Math.floor(this.mineableThroughput(oreEff, gem!.efficiency ?? 0, this.gemSupplySecs(mapId), this.miningDropMult(), gem!.mineHp ?? 20, minePow).perHour * 0.5) });
    }
    return out;
  }

  /** AFK/hora de la madera del mapa (pestaña Tala). Misma fórmula que la minería, con la
   *  eficiencia/fuerza de TALA, el respawn de árboles y sin reparto (un solo recurso). */
  woodcuttingAfkPerHour(mapId: string): { name: string; perHour: number }[] {
    const mapConfig = MAP_REGISTRY[mapId];
    if (!mapConfig || mapId === 'hogar') return [];
    const tree = treeTier(mapConfig.treeTier);
    const eff  = this.charStats.currentWoodcuttingEfficiency;
    const pow  = this.charStats.currentWoodcuttingPower;
    return [{ name: tree.dropName, perHour: this.mineableThroughput(eff, tree.efficiency ?? 0, this.treeSupplySecs(mapId), this.woodDropMult(), tree.mineHp ?? 20, pow).perHour }];
  }

  private miningDropMult(): number { return 1 + (this.talent.getBonus().miningDrop ?? 0); }
  private woodDropMult(): number { return 1 + ((this.talent.getBonus() as any).woodcuttingDrop ?? 0); }

  /** Segundos entre menas (respawn de menas, −mejora "Respawn de menas"). */
  private oreSupplySecs(mapId: string): number {
    return Math.max(5, (ORE_RESPAWN_MS - this.mapUpgrades.oreRespawnReductionMs(mapId)) / 1000);
  }
  /** Segundos medios entre gemas (media del rango aleatorio min..max de respawn de gema). */
  private gemSupplySecs(mapId: string): number {
    return ((this.mapUpgrades.gemRespawnMinMs(mapId) + this.mapUpgrades.gemRespawnMaxMs(mapId)) / 2) / 1000;
  }
  /** Segundos entre árboles (respawn de árboles, −mejora "Respawn de árboles"). */
  private treeSupplySecs(mapId: string): number {
    return Math.max(5, (TREE_RESPAWN_MS - this.mapUpgrades.treeRespawnReductionMs(mapId)) / 1000);
  }

  /** Núcleo compartido (panel y reclamo offline) para minería Y tala: nodos/hora y
   *  unidades/hora de un recurso según TODAS las stats. `playerEff` = eficiencia del
   *  jugador (minería o tala), `supplySecs` = segundos entre apariciones, `dropMult` =
   *  multiplicador de botín (talento). Así panel y botín real salen del MISMO cálculo. */
  private mineableThroughput(playerEff: number, reqEff: number, supplySecs: number, dropMult: number, hp: number, power: number): { nodesPerHour: number; perHour: number } {
    const supplyRate = 3600 / Math.max(1, supplySecs);                  // nodos/hora que el mapa suministra
    const drop       = HARVEST_KINDS.rock.drop;                         // 1..1 (igual gema/árbol)
    const avgQty     = drop ? (drop.min + drop.max) / 2 : 1;

    const hitChance = reqEff > 0 ? Math.min(1, playerEff / reqEff) : 1;
    if (hitChance <= 0 || power <= 0) return { nodesPerHour: 0, perHour: 0 };  // no acierta o sin fuerza
    const ratio        = reqEff > 0 ? playerEff / reqEff : 1;
    // Golpes para destruir = vida / fuerza (mismo modelo que gamescene); los misses por
    // eficiencia los multiplican (1/hitChance intentos por golpe acertado).
    const hitsToDestroy = Math.max(1, Math.ceil(hp / power));
    const secsPerNode   = (hitsToDestroy / hitChance) * (ATTACK_INTERVAL_MS / 1000) + TRAVEL_SECS;
    const nodesPerHour  = Math.min(3600 / secsPerNode, supplyRate);
    const expMultiDrop  = Math.max(1, ratio);                           // E[unidades] del multi-drop
    // ×AFK_GAIN_FACTOR (1/10): el botín AFK rinde una décima parte (igual que el combate).
    const perHour       = Math.floor(nodesPerHour * avgQty * expMultiDrop * dropMult * AFK_GAIN_FACTOR);
    return { nodesPerHour, perHour };
  }

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

    // Ritmo de kills limitado por DOS cuellos de botella:
    //  1) lo rápido que matas: vida del enemigo ÷ DPS.
    //  2) el SUMINISTRO del mapa: respawn repartido entre los enemigos máx. simultáneos
    //     (no puedes matar más rápido de lo que reaparecen). Aquí entran las mejoras de
    //     mapa "Reaparición" (−respawn) y "Enemigos máx." (+max).
    const secsToKill   = enemyCfg.hp / dps;
    const respawnSecs  = Math.max(500, ENEMY_RESPAWN_MS - this.mapUpgrades.respawnReductionMs(mapId)) / 1000;
    const enemyBonus   = this.mapUpgrades.extraMaxEnemies(mapId);
    const maxEnemies   = Math.max(1, mapConfig.spawns.reduce((s, sp) => s + (sp.maxCount ?? 0) + enemyBonus, 0));
    const secsPerKill  = Math.max(secsToKill, respawnSecs / maxEnemies);
    // ×AFK_GAIN_FACTOR (1/10): el AFK rinde una décima parte del juego activo.
    const killsPerHour = Math.floor((3600 / secsPerKill) * AFK_GAIN_FACTOR);
    if (killsPerHour <= 0) return null;

    // Drop rate real: bonus del personaje (%), modificador del mapa y bonus de
    // dominio (mapa dominado) sobre la chance base — mismo cálculo que rollDrops.
    const dropMult = (1 + this.charStats.currentDropRateBonus / 100) * (mapConfig.dropRateModifier ?? 1)
      * this.dominion.dropMultiplier(mapId);
    const table    = LOOT_TABLES[enemyType] ?? LOOT_TABLES['default'];

    let coinsPerKill = 0;
    const drops: AfkDropRate[] = [];
    for (const entry of table) {
      const avgQty = (entry.minQty + entry.maxQty) / 2;
      if (entry.type === 'currency') {
        coinsPerKill += entry.chance * avgQty;
      } else {
        // Sin cap a 1: el juego activo dropea con desbordamiento (floor + decimal%
        // de copia extra, ver rollDrops), cuya media es exactamente chance×mult.
        const finalChance = entry.chance * dropMult;
        const perHour = killsPerHour * finalChance * avgQty;
        if (perHour > 0) drops.push({ entry, perHour });
      }
    }

    return {
      enemyType,
      killsPerHour,
      coinsPerHour: Math.floor(killsPerHour * coinsPerKill * this.afkBonus.coinsMult),
      expPerHour:   Math.floor(killsPerHour * (EXP_REWARDS[enemyType] ?? 10)
                      * (1 + this.charStats.currentExpBonus / 100) * this.afkBonus.expMult),
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
    } else {
      const ref = snapshot?.lastSeen ?? snapshot?.lastModified;
      if (!ref) return null;
      elapsedMs = Date.now() - new Date(ref).getTime();
    }

    const elapsedMinutes = elapsedMs / 60000;
    if (elapsedMs / 1000 < MIN_OFFLINE_SECONDS) return null;

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
    if (!mapConfig || mapConfig.spawns.length === 0) return null;

    // AFK real: kills derivados de la DPS del personaje contra la vida del enemigo,
    // con monedas/XP/botín del loot real. El mismo modelo que muestra el panel.
    const rates = this.afkRates(mapConfig.id);
    if (!rates) return null;

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
    const hours = cappedMinutes / 60;
    const mapId = snapshot.mapId ?? 'hogar';

    // Recurso(s) soltado(s) → itemDrops → inventario. La MINERÍA usa el MISMO cálculo
    // que el panel (mineableThroughput); si hay gemas desbloqueadas, reparte el tiempo
    // mitad mena / mitad gema. La TALA mantiene su modelo simple (sin eficiencia/multidrop).
    const itemDrops: AfkItemGain[] = [];
    const pushDrop = (name: string, qty: number) => {
      if (qty <= 0) return;
      const entry = ITEM_CATALOG.find(e => e.name === name);
      if (entry) itemDrops.push({ entry, qty });
    };

    let nodesFloat = 0;
    if (skill === 'mining') {
      const mapConfig = MAP_REGISTRY[mapId];
      const mine = miningTier(mapConfig?.mineTier);
      const gem  = gemTier(mapConfig?.gemTier);
      const gemAvailable = !!gem && this.mapUpgrades.gemUnlocked(mapId);
      const oreShare = gemAvailable ? 0.5 : 1;

      const oreEff = this.charStats.currentMiningEfficiency;
      const minePow = this.charStats.currentMiningPower;
      const oreTp = this.mineableThroughput(oreEff, mine.efficiency ?? 0, this.oreSupplySecs(mapId), this.miningDropMult(), mine.mineHp ?? 20, minePow);
      pushDrop(mine.dropName, Math.floor(oreTp.perHour * oreShare * hours));
      nodesFloat += oreTp.nodesPerHour * oreShare * hours;

      if (gemAvailable) {
        const gemTp = this.mineableThroughput(oreEff, gem!.efficiency ?? 0, this.gemSupplySecs(mapId), this.miningDropMult(), gem!.mineHp ?? 20, minePow);
        pushDrop(gem!.dropName, Math.floor(gemTp.perHour * 0.5 * hours));
        nodesFloat += gemTp.nodesPerHour * 0.5 * hours;
      }
    } else {
      // Tala: mismo cálculo (eficiencia/fuerza de tala, respawn de árboles, multi-drop).
      const tree = treeTier(MAP_REGISTRY[mapId]?.treeTier);
      const eff  = this.charStats.currentWoodcuttingEfficiency;
      const pow  = this.charStats.currentWoodcuttingPower;
      const tp   = this.mineableThroughput(eff, tree.efficiency ?? 0, this.treeSupplySecs(mapId), this.woodDropMult(), tree.mineHp ?? 20, pow);
      pushDrop(tree.dropName, Math.floor(tp.perHour * hours));
      nodesFloat = tp.nodesPerHour * hours;
    }

    const nodes = Math.floor(nodesFloat);
    if (nodes <= 0) return null;

    const gatherXp = nodes * kind.xp;

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

  /** Ganancias AFK explorando: metros (10/min) + estrellas de los generadores
   *  pasivos. Los mapas ya NO se desbloquean por metros (se compran con estrellas
   *  en el panel de hitos), así que el AFK no cruza/desbloquea nada. */
  private calculateExploring(snapshot: GameSnapshot, cappedMinutes: number): OfflineGains | null {
    // Bonus de exploración: INT (+1%/punto) + talentos exploration (vía charStats).
    const exploreBonus  = this.charStats.currentExplorationBonus ?? 0;
    const exploreMeters = Math.floor(METERS_PER_MINUTE * cappedMinutes * (1 + exploreBonus / 100));
    if (exploreMeters <= 0) return null;

    // Generadores pasivos de estrellas ('star_prod1/2/3'): la MISMA tasa que el tick
    // en vivo de WorldRunScene, aplicada al tiempo AFK (mismo tope de horas). Los hitos
    // ahora son de CUENTA (RunProgress), no del snapshot per-personaje.
    const exploreStars = Math.floor(
      this.runProgress.starProdPerMinTotal() * cappedMinutes);

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
      exploreStars,
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
