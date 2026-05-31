import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';

export type KillRecord = Record<string, number>;  // enemyType → count
export type KillMap    = Record<string, KillRecord>; // mapId → kills

const GLOBAL_KEY = 'global_kills';

@Injectable({ providedIn: 'root' })
export class KillService {

  private charKills: KillMap   = {};
  private globalKills: KillMap = {};

  readonly charKills$   = new BehaviorSubject<KillMap>({});
  readonly globalKills$ = new BehaviorSubject<KillMap>({});

  constructor(private storage: StorageService) {}

  // --- Ciclo de vida (llamado por SaveService) ---

  restoreCharKills(kills: KillMap): void {
    this.charKills = kills ?? {};
    this.charKills$.next({ ...this.charKills });
  }

  async loadGlobalKills(): Promise<void> {
    const saved: KillMap | null = await this.storage.get(GLOBAL_KEY);
    this.globalKills = saved ?? {};
    this.globalKills$.next({ ...this.globalKills });
  }

  getCharKillsSnapshot(): KillMap {
    return { ...this.charKills };
  }

  // --- Registro de bajas ---

  async recordKill(mapId: string, enemyType: string): Promise<void> {
    // Contador individual
    if (!this.charKills[mapId])   this.charKills[mapId]   = {};
    this.charKills[mapId][enemyType] = (this.charKills[mapId][enemyType] ?? 0) + 1;
    this.charKills$.next({ ...this.charKills });

    // Contador global
    if (!this.globalKills[mapId]) this.globalKills[mapId] = {};
    this.globalKills[mapId][enemyType] = (this.globalKills[mapId][enemyType] ?? 0) + 1;
    this.globalKills$.next({ ...this.globalKills });
    await this.storage.set(GLOBAL_KEY, this.globalKills);
  }

  // --- Consultas ---

  getCharMapKills(mapId: string):   KillRecord { return this.charKills[mapId]   ?? {}; }
  getGlobalMapKills(mapId: string): KillRecord { return this.globalKills[mapId] ?? {}; }
  getTotalCharKills(mapId: string): number { return Object.values(this.getCharMapKills(mapId)).reduce((a, b) => a + b, 0); }
  getTotalGlobalKills(mapId: string): number { return Object.values(this.getGlobalMapKills(mapId)).reduce((a, b) => a + b, 0); }
}
