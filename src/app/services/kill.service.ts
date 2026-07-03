import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
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
  /** Emite solo en kills reales (no durante restoreCharKills). Úsalo para logros/toasts. */
  readonly kill$ = new Subject<void>();
  /** Como kill$ pero con el detalle de la baja (mapa + tipo). Úsalo para misiones. */
  readonly killDetail$ = new Subject<{ mapId: string; enemyType: string }>();

  constructor(private storage: StorageService) {}

  // --- Ciclo de vida (llamado por SaveService) ---

  restoreCharKills(kills: KillMap): void {
    this.charKills = kills ?? {};
    this.charKills$.next({ ...this.charKills });
  }

  /** Borra kills de personaje y globales (llamado desde clearCurrentCharacter). */
  async resetAll(): Promise<void> {
    this.charKills = {};
    this.globalKills = {};
    this.charKills$.next({});
    this.globalKills$.next({});
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null; }
    await this.storage.set(GLOBAL_KEY, {});
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
    this.kill$.next();
    this.killDetail$.next({ mapId, enemyType });

    // Contador global
    if (!this.globalKills[mapId]) this.globalKills[mapId] = {};
    this.globalKills[mapId][enemyType] = (this.globalKills[mapId][enemyType] ?? 0) + 1;
    this.globalKills$.next({ ...this.globalKills });
    this.schedulePersist();
  }

  /** Baja que SOLO alimenta misiones (killDetail$), sin tocar los contadores
   *  persistentes (charKills/globalKills), kill$ ni los logros. Para enemigos del
   *  Modo Mundo (rata de exploración): no son bajas de combate reales pero sí
   *  cuentan para las misiones de matar. `enemyType` debe casar con la familia
   *  del objetivo (p.ej. 'rats_world' para family 'rats'). */
  emitQuestKill(enemyType: string, mapId = 'exploration'): void {
    this.killDetail$.next({ mapId, enemyType });
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
