import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { StorageService } from './storage.service';
import { KillService } from './kill.service';
import { PlayerStateService } from './player-state.service';
import { NotificationBadgeService } from './notification-badge.service';

// Sistema de misiones.
//
// A diferencia de los logros (que derivan su progreso en vivo de contadores
// acumulativos), una misión cuenta su progreso DESDE QUE EMPIEZA: no se
// autocompleta con bajas previas. Por eso el progreso se incrementa con cada
// evento real (KillService.killDetail$) y se persiste por personaje.
//
// Estados (solo dos grupos, como pide el diseño):
//   - DISPONIBLE: progreso < objetivo (en curso)
//   - COMPLETADA: progreso >= objetivo (recompensa ya entregada)
//
// Para añadir tipos nuevos de misión: extender QuestObjective con un nuevo
// 'type', cubrirlo en matchesKill()/progressTowards() y enganchar la fuente
// del evento en el constructor (igual que killDetail$ para 'kill').

/** Objetivo de una misión. Discriminado por `type` para crecer con más clases. */
export type QuestObjective =
  | KillObjective;
// Futuro: | { type: 'reachLevel'; goal: number }
//         | { type: 'collectItem'; itemId: string; goal: number }
//         | { type: 'spendCoins'; goal: number } ...

/** Matar enemigos. Filtra por familia (prefijo del tipo) o por tipos exactos.
 *  Sin filtro → cuenta cualquier baja. */
export interface KillObjective {
  type: 'kill';
  goal: number;
  family?: string;        // ej. 'slime' casa slime1, slime2, slime1_elite…
  enemyTypes?: string[];  // tipos exactos (tiene prioridad sobre family)
}

export interface QuestReward {
  coins?: number;
  exp?: number;
}

export interface QuestDef {
  id: string;             // único, sin espacios
  name: string;
  desc: string;
  icon: string;           // ion-icon
  objective: QuestObjective;
  reward?: QuestReward;
}

// ── Catálogo de misiones ──────────────────────────────────────────────────────
// El orden aquí es el orden de presentación.

export const QUESTS: QuestDef[] = [
  {
    id: 'slimes_10',
    name: 'Plaga de babosas',
    desc: 'Las babosas han invadido los caminos. Acaba con 10 de ellas.',
    icon: 'water-outline',
    objective: { type: 'kill', family: 'slime', goal: 10 },
    reward: { coins: 150, exp: 60 },
  },
  {
    id: 'kill_50',
    name: 'Cazador novato',
    desc: 'Demuestra tu valía derrotando a 50 enemigos cualesquiera.',
    icon: 'skull-outline',
    objective: { type: 'kill', goal: 50 },
    reward: { coins: 300, exp: 150 },
  },
  {
    id: 'orcs_5',
    name: 'Limpieza de orcos',
    desc: 'Los orcos acechan la zona. Abate a 5 de ellos.',
    icon: 'flame-outline',
    objective: { type: 'kill', family: 'orc', goal: 5 },
    reward: { coins: 200, exp: 80 },
  },
];

interface QuestSave {
  progress: Record<string, number>;
  completed: string[];
}

const charKey = (id: string) => `quests_char_${id}`;

@Injectable({ providedIn: 'root' })
export class QuestService implements OnDestroy {

  /** Emite cada vez que se completa una misión (para el toast). */
  readonly completed$ = new Subject<QuestDef>();
  /** Emite en cualquier cambio de estado (progreso o completado) para refrescar UI. */
  readonly changes$ = new Subject<void>();

  private charId: string | null = null;
  private progress: Record<string, number> = {};
  private completedSet = new Set<string>();
  private killSub: Subscription;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private storage: StorageService,
    private kills: KillService,
    private playerState: PlayerStateService,
    private badges: NotificationBadgeService,
  ) {
    // killDetail$ solo emite en bajas reales (no en restoreCharKills), así una
    // misión recién cargada no se autocompleta ni dispara toasts al recargar.
    this.killSub = this.kills.killDetail$.subscribe(({ enemyType }) => {
      this.onKill(enemyType);
    });
  }

  ngOnDestroy(): void {
    this.killSub?.unsubscribe();
    if (this.persistTimer) clearTimeout(this.persistTimer);
  }

  // ── Ciclo de vida (SaveService) ─────────────────────────────────────────────

  async loadForChar(charId: string): Promise<void> {
    this.charId = charId;
    const saved: QuestSave | null = await this.storage.get(charKey(charId));
    this.progress     = saved?.progress  ? { ...saved.progress } : {};
    this.completedSet = new Set(saved?.completed ?? []);
    this.changes$.next();
  }

  async clearAll(): Promise<void> {
    this.progress = {};
    this.completedSet.clear();
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null; }
    if (this.charId) await this.storage.set(charKey(this.charId), { progress: {}, completed: [] });
    this.changes$.next();
  }

  // ── Consultas para la UI ────────────────────────────────────────────────────

  available(): QuestDef[] {
    return QUESTS.filter(q => !this.completedSet.has(q.id));
  }

  completed(): QuestDef[] {
    return QUESTS.filter(q => this.completedSet.has(q.id));
  }

  isCompleted(def: QuestDef): boolean {
    return this.completedSet.has(def.id);
  }

  /** Progreso actual hacia el objetivo (recortado al objetivo). */
  progressOf(def: QuestDef): number {
    return Math.min(def.objective.goal, this.progress[def.id] ?? 0);
  }

  goalOf(def: QuestDef): number {
    return def.objective.goal;
  }

  /** 0..1 para barras de progreso. */
  ratio(def: QuestDef): number {
    return Math.min(1, (this.progress[def.id] ?? 0) / def.objective.goal);
  }

  // ── Registro de progreso ────────────────────────────────────────────────────

  private onKill(enemyType: string): void {
    let changed = false;
    for (const def of QUESTS) {
      if (this.completedSet.has(def.id)) continue;
      if (def.objective.type !== 'kill') continue;
      if (!matchesKill(def.objective, enemyType)) continue;

      this.progress[def.id] = (this.progress[def.id] ?? 0) + 1;
      changed = true;
      if (this.progress[def.id] >= def.objective.goal) this.complete(def);
    }
    if (changed) {
      this.changes$.next();
      this.schedulePersist();
    }
  }

  private complete(def: QuestDef): void {
    this.completedSet.add(def.id);
    this.grantReward(def.reward);
    this.badges.flag('equip.quests');
    this.completed$.next(def);
    this.persistNow();  // los completados se guardan al momento (recompensa ya dada)
  }

  private grantReward(reward?: QuestReward): void {
    if (!reward) return;
    if (reward.coins) this.playerState.collectCoins(reward.coins);
    if (reward.exp)   this.playerState.addExp(reward.exp);
  }

  // ── Persistencia ────────────────────────────────────────────────────────────
  // Hay una baja cada pocos segundos: agrupa las escrituras de progreso.

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, 3000);
  }

  private persistNow(): void {
    if (!this.charId) return;
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null; }
    const save: QuestSave = { progress: this.progress, completed: [...this.completedSet] };
    this.storage.set(charKey(this.charId), save);
  }
}

/** ¿La baja de `enemyType` cuenta para este objetivo de matar? */
function matchesKill(obj: KillObjective, enemyType: string): boolean {
  if (obj.enemyTypes?.length) return obj.enemyTypes.includes(enemyType);
  if (obj.family) return enemyType.startsWith(obj.family);
  return true;  // sin filtro: cualquier enemigo
}
