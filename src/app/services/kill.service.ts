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
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

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

  recordKill(mapId: string, enemyType: string): void {
    // Contador individual
    if (!this.charKills[mapId])   this.charKills[mapId]   = {};
    this.charKills[mapId][enemyType] = (this.charKills[mapId][enemyType] ?? 0) + 1;
    this.charKills$.next({ ...this.charKills });

    // Contador global
    if (!this.globalKills[mapId]) this.globalKills[mapId] = {};
    this.globalKills[mapId][enemyType] = (this.globalKills[mapId][enemyType] ?? 0) + 1;
    this.globalKills$.next({ ...this.globalKills });
    this.schedulePersist();
  }

  // Con auto-attack hay un kill cada pocos segundos: agrupa las escrituras a
  // storage en una cada 5s en vez de una por kill.
  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.storage.set(GLOBAL_KEY, this.globalKills);
    }, 5000);
  }

  // --- Consultas ---

  getCharMapKills(mapId: string):   KillRecord { return this.charKills[mapId]   ?? {}; }
  getGlobalMapKills(mapId: string): KillRecord { return this.globalKills[mapId] ?? {}; }
  getTotalCharKills(mapId: string): number { return Object.values(this.getCharMapKills(mapId)).reduce((a, b) => a + b, 0); }
  getTotalGlobalKills(mapId: string): number { return Object.values(this.getGlobalMapKills(mapId)).reduce((a, b) => a + b, 0); }

  /** Total de bajas del personaje en todos los mapas (logros) */
  totalCharKills(): number {
    return Object.keys(this.charKills).reduce((sum, mapId) => sum + this.getTotalCharKills(mapId), 0);
  }

  /** Total de bajas de la cuenta en todos los mapas (logros globales) */
  totalGlobalKills(): number {
    return Object.keys(this.globalKills).reduce((sum, mapId) => sum + this.getTotalGlobalKills(mapId), 0);
  }
}
