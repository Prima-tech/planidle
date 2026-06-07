import { Injectable } from '@angular/core';
import { GameSnapshot } from './save.service';
import { MAP_REGISTRY } from '../scenes/gamescene/map-config';
import { AfkBonusService } from './afk-bonus.service';

const MIN_OFFLINE_MINUTES = 2;
const MAX_OFFLINE_HOURS   = 8;
const KILL_CYCLE_SECS     = 12; // respawn(3) + pelea+viaje(9) por slot
const COINS_PER_KILL      = 1;
const EXP_PER_KILL        = 1;

const ENEMY_NAMES: Record<string, string> = {
  orc1: 'Orco',
};

export interface EnemyGain {
  enemyType: string;
  displayName: string;
  kills: number;
}

export interface OfflineGains {
  elapsedMs: number;
  mapId: string;
  mapName: string;
  enemyGains: EnemyGain[];
  coins: number;
  exp: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineGainsService {

  constructor(private afkBonus: AfkBonusService) {}

  calculate(snapshot: GameSnapshot): OfflineGains | null {
    const ref = snapshot?.lastSeen ?? snapshot?.lastModified;
    console.log('[OfflineGains] ref:', ref, '| mapId:', snapshot?.mapId);
    if (!ref) { console.log('[OfflineGains] sin timestamp'); return null; }

    const elapsedMs = Date.now() - new Date(ref).getTime();
    const elapsedMinutes = elapsedMs / 60000;
    console.log('[OfflineGains] minutos offline:', elapsedMinutes.toFixed(1));
    if (elapsedMinutes < MIN_OFFLINE_MINUTES) { console.log('[OfflineGains] < 2 min, ignorado'); return null; }

    const cappedMinutes = Math.min(elapsedMinutes, MAX_OFFLINE_HOURS * 60);
    const mapConfig = MAP_REGISTRY[snapshot.mapId ?? 'hogar'];
    if (!mapConfig || mapConfig.spawns.length === 0) { console.log('[OfflineGains] mapa sin spawns:', snapshot.mapId); return null; }

    const enemyGains: EnemyGain[] = [];
    let rawCoins = 0;
    let rawExp   = 0;

    for (const spawn of mapConfig.spawns) {
      const killsPerMinute = spawn.maxCount * (60 / KILL_CYCLE_SECS);
      const kills = Math.floor(killsPerMinute * cappedMinutes);
      if (kills === 0) continue;
      enemyGains.push({
        enemyType:   spawn.enemyType,
        displayName: ENEMY_NAMES[spawn.enemyType] ?? spawn.enemyType,
        kills,
      });
      rawCoins += kills * COINS_PER_KILL;
      rawExp   += kills * EXP_PER_KILL;
    }

    if (enemyGains.length === 0) return null;

    return {
      elapsedMs:  Math.floor(cappedMinutes * 60000),
      mapId:      mapConfig.id,
      mapName:    mapConfig.name,
      enemyGains,
      coins: Math.floor(rawCoins * this.afkBonus.coinsMult),
      exp:   Math.floor(rawExp   * this.afkBonus.expMult),
    };
  }

  /** Monedas AFK por hora para el mapa dado (con multiplicadores activos). */
  coinsPerHour(mapId: string): number {
    const mapConfig = MAP_REGISTRY[mapId];
    if (!mapConfig || mapConfig.spawns.length === 0) return 0;
    let raw = 0;
    for (const spawn of mapConfig.spawns) {
      raw += spawn.maxCount * (60 / KILL_CYCLE_SECS) * 60 * COINS_PER_KILL;
    }
    return Math.floor(raw * this.afkBonus.coinsMult);
  }

  /** XP AFK por hora para el mapa dado (con multiplicadores activos). */
  expPerHour(mapId: string): number {
    const mapConfig = MAP_REGISTRY[mapId];
    if (!mapConfig || mapConfig.spawns.length === 0) return 0;
    let raw = 0;
    for (const spawn of mapConfig.spawns) {
      raw += spawn.maxCount * (60 / KILL_CYCLE_SECS) * 60 * EXP_PER_KILL;
    }
    return Math.floor(raw * this.afkBonus.expMult);
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
