import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
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
// Estados:
//   - DISPONIBLE: progreso < objetivo (en curso)
//   - RECLAMABLE: progreso >= objetivo pero aún NO cobrada (sigue en Disponibles
//     con un botón "Completar"). Al llegar al objetivo NO se autocompleta: se
//     enciende el aviso (notif-dot 'equip.quests', mismo sistema que el punto de
//     stats al subir de nivel) para indicar que se puede cobrar.
//   - COMPLETADA: el jugador pulsó "Completar" → recompensa entregada.
// Ortogonal a esos: una misión no completada puede estar ACTIVA (fijada). Las
// activas se muestran en el rastreador del HUD (arriba-izquierda); máximo 5.
// Activar es solo fijar en el HUD: el progreso cuenta igual estés o no activa.
//
// Para añadir tipos nuevos de misión: extender QuestObjective con un nuevo
// 'type', cubrirlo en matchesKill() y enganchar la fuente del evento en el
// constructor (igual que killDetail$ para 'kill').

/** Objetivo de una misión. Discriminado por `type` para crecer con más clases. */
export type QuestObjective =
  | KillObjective
  | StarsObjective;
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

/** Acumular estrellas (moneda de exploración del Modo Mundo). El progreso sigue el
 *  balance de estrellas del jugador (nunca baja aunque las gaste). */
export interface StarsObjective {
  type: 'stars';
  goal: number;
}

export interface QuestReward {
  coins?: number;
  exp?: number;
  /** Hito del Modo Mundo que se otorga al cobrar (p.ej. 'sprint' = Impulso). */
  runMilestone?: string;
}

export interface QuestDef {
  id: string;             // único, sin espacios
  name: string;
  desc: string;
  icon: string;           // ion-icon
  /** Etiqueta corta para el rastreador del HUD ("lo que hay que hacer").
   *  Si se omite, el HUD usa `name`. */
  track?: string;
  objective: QuestObjective;
  reward?: QuestReward;
}

/** Máximo de misiones activas (fijadas en el HUD) a la vez. */
export const MAX_ACTIVE_QUESTS = 5;

// ── Catálogo de misiones ──────────────────────────────────────────────────────
// El orden aquí es el orden de presentación.

export const QUESTS: QuestDef[] = [
  {
    id: 'primeras_estrellas',
    name: 'La llamada de Mordekai',
    desc: 'Mordekai te pide aprender a explorar antes de luchar. Cruza el portal de exploración (el del este) y trae 5 estrellas: toca la pantalla para saltar y recógelas al vuelo. Al cobrarla aprenderás el Impulso.',
    icon: 'star-outline',
    track: 'Consigue 5 estrellas',
    objective: { type: 'stars', goal: 5 },
    reward: { coins: 100, exp: 40, runMilestone: 'sprint' },
  },
  {
    id: 'plaga_babosas',
    name: 'Plaga de babosas',
    desc: 'Algo se mueve entre la hierba. Acaba con tu primer enemigo.',
    icon: 'water-outline',
    track: 'Mata 1 enemigo',
    objective: { type: 'kill', goal: 1 },
    reward: { coins: 150, exp: 60 },
  },
  {
    id: 'kill_50',
    name: 'Cazador novato',
    desc: 'Demuestra tu valía derrotando a 50 enemigos cualesquiera.',
    icon: 'skull-outline',
    track: 'Mata enemigos',
    objective: { type: 'kill', goal: 50 },
    reward: { coins: 300, exp: 150 },
  },
  {
    id: 'orcs_5',
    name: 'Limpieza de orcos',
    desc: 'Los orcos acechan la zona. Abate a 5 de ellos.',
    icon: 'flame-outline',
    track: 'Mata orcos',
    objective: { type: 'kill', family: 'orc', goal: 5 },
    reward: { coins: 200, exp: 80 },
  },
];

export interface QuestSave {
  progress: Record<string, number>;
  completed: string[];
  active: string[];
}

const charKey = (id: string) => `quests_char_${id}`;

@Injectable({ providedIn: 'root' })
export class QuestService implements OnDestroy {

  /** Emite cada vez que se completa una misión (para el toast). */
  readonly completed$ = new Subject<QuestDef>();
  /** Emite en cualquier cambio de estado (progreso, completado, activación). */
  readonly changes$ = new Subject<void>();
  /** Lista de misiones activas (fijadas en el HUD). Para el rastreador. */
  readonly active$ = new BehaviorSubject<QuestDef[]>([]);

  private charId: string | null = null;
  private progress: Record<string, number> = {};
  private completedSet = new Set<string>();
  private activeSet = new Set<string>();
  private killSub: Subscription;
  private starSub: Subscription;
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
    // Estrellas: el progreso sigue el balance actual (max, nunca baja). Las emisiones
    // previas a loadForChar no importan: loadForChar reemplaza `progress` desde el save.
    this.starSub = this.playerState.stars$.subscribe(balance => this.onStarsBalance(balance));
  }

  ngOnDestroy(): void {
    this.killSub?.unsubscribe();
    this.starSub?.unsubscribe();
    if (this.persistTimer) clearTimeout(this.persistTimer);
  }

  /** Definición de una misión por id (para consultarla desde la escena/NPCs). */
  byId(id: string): QuestDef | undefined {
    return QUESTS.find(q => q.id === id);
  }

  // ── Ciclo de vida (SaveService) ─────────────────────────────────────────────

  async loadForChar(charId: string, override?: QuestSave): Promise<void> {
    this.charId = charId;
    // override = datos restaurados del snapshot (nube). Si no, lee la clave local.
    const saved: QuestSave | null = override ?? await this.storage.get(charKey(charId));
    this.progress     = saved?.progress ? { ...saved.progress } : {};
    this.completedSet = new Set(saved?.completed ?? []);
    this.activeSet    = new Set(saved?.active ?? []);
    // Sanea: una completada no puede seguir activa (saves antiguos / coherencia)
    for (const id of [...this.activeSet]) if (this.completedSet.has(id)) this.activeSet.delete(id);
    // Sincroniza el progreso de estrellas con el balance ya cargado del personaje.
    this.onStarsBalance(this.playerState.snapshot().stars ?? 0);
    // Si vino del snapshot, sincroniza la clave local para que coincida.
    if (override) this.persistNow();
    // Si quedó alguna misión lista para cobrar, reaviva el notif-dot al cargar.
    if (this.hasClaimable()) this.badges.flag('equip.quests');
    this.notify();
  }

  /** Estado serializable para el GameSnapshot (sube a la nube). */
  getSnapshot(): QuestSave {
    return {
      progress: { ...this.progress },
      completed: [...this.completedSet],
      active: [...this.activeSet],
    };
  }

  async clearAll(): Promise<void> {
    this.progress = {};
    this.completedSet.clear();
    this.activeSet.clear();
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null; }
    if (this.charId) await this.storage.set(charKey(this.charId), { progress: {}, completed: [], active: [] });
    this.notify();
  }

  // ── Consultas para la UI ────────────────────────────────────────────────────

  available(): QuestDef[] {
    return QUESTS.filter(q => !this.completedSet.has(q.id));
  }

  completed(): QuestDef[] {
    return QUESTS.filter(q => this.completedSet.has(q.id));
  }

  /** Misiones fijadas en el HUD (siempre no completadas). */
  active(): QuestDef[] {
    return QUESTS.filter(q => this.activeSet.has(q.id) && !this.completedSet.has(q.id));
  }

  isCompleted(def: QuestDef): boolean {
    return this.completedSet.has(def.id);
  }

  /** Objetivo alcanzado pero aún sin cobrar: muestra el botón "Completar". */
  isClaimable(def: QuestDef): boolean {
    return !this.completedSet.has(def.id) && (this.progress[def.id] ?? 0) >= def.objective.goal;
  }

  /** ¿Hay alguna misión lista para cobrar? (para avisos). */
  hasClaimable(): boolean {
    return QUESTS.some(q => this.isClaimable(q));
  }

  isActive(def: QuestDef): boolean {
    return this.activeSet.has(def.id);
  }

  activeCount(): number {
    return this.active().length;
  }

  /** ¿Se puede fijar una más? (hay hueco bajo el máximo) */
  canActivate(): boolean {
    return this.activeCount() < MAX_ACTIVE_QUESTS;
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

  // ── Activación (fijar/desfijar en el HUD) ───────────────────────────────────

  /** Fija la misión en el HUD. No hace nada si está completada o no hay hueco. */
  activate(def: QuestDef): void {
    if (this.completedSet.has(def.id)) return;
    if (this.activeSet.has(def.id)) return;
    if (!this.canActivate()) return;
    this.activeSet.add(def.id);
    this.notify();
    this.persistNow();
  }

  deactivate(def: QuestDef): void {
    if (!this.activeSet.delete(def.id)) return;
    this.notify();
    this.persistNow();
  }

  toggleActive(def: QuestDef): void {
    this.isActive(def) ? this.deactivate(def) : this.activate(def);
  }

  // ── Registro de progreso ────────────────────────────────────────────────────

  private onKill(enemyType: string): void {
    let changed = false;
    for (const def of QUESTS) {
      if (this.completedSet.has(def.id)) continue;
      if (def.objective.type !== 'kill') continue;
      // Ya alcanzó el objetivo: no se autocompleta, espera a "Completar".
      if ((this.progress[def.id] ?? 0) >= def.objective.goal) continue;
      if (!matchesKill(def.objective, enemyType)) continue;

      this.progress[def.id] = (this.progress[def.id] ?? 0) + 1;
      changed = true;
      // Justo al alcanzar el objetivo: enciende el aviso (mismo notif-dot que
      // el punto de stats al subir de nivel) para indicar que se puede cobrar.
      if (this.progress[def.id] >= def.objective.goal) this.badges.flag('equip.quests');
    }
    if (changed) {
      this.notify();
      this.schedulePersist();
    }
  }

  /** Progreso de las misiones de estrellas = balance actual (max, nunca baja aunque
   *  el jugador gaste estrellas). No autocompleta: al llegar al objetivo espera a
   *  "Completar" (o a hablar con Mordekai) como el resto. */
  private onStarsBalance(balance: number): void {
    let changed = false;
    for (const def of QUESTS) {
      if (def.objective.type !== 'stars') continue;
      if (this.completedSet.has(def.id)) continue;
      const cur = this.progress[def.id] ?? 0;
      if (cur >= def.objective.goal) continue;
      const next = Math.min(def.objective.goal, Math.max(cur, balance));
      if (next !== cur) {
        this.progress[def.id] = next;
        changed = true;
        if (next >= def.objective.goal) this.badges.flag('equip.quests');
      }
    }
    if (changed) {
      this.notify();
      this.schedulePersist();
    }
  }

  /** Cobra una misión reclamable: entrega recompensa y la pasa a Completadas. */
  claim(def: QuestDef): void {
    if (!this.isClaimable(def)) return;
    this.completedSet.add(def.id);
    this.activeSet.delete(def.id);   // al completarse deja de estar fijada en el HUD
    this.grantReward(def.reward);
    this.completed$.next(def);
    this.notify();
    this.persistNow();  // los completados se guardan al momento (recompensa ya dada)
  }

  private grantReward(reward?: QuestReward): void {
    if (!reward) return;
    if (reward.coins) this.playerState.collectCoins(reward.coins);
    if (reward.exp)   this.playerState.addExp(reward.exp);
    if (reward.runMilestone) this.playerState.grantRunMilestone(reward.runMilestone);
  }

  /** Notifica a la UI: refresca rastreador del HUD y suscriptores de changes$. */
  private notify(): void {
    this.active$.next(this.active());
    this.changes$.next();
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
    const save: QuestSave = {
      progress: this.progress,
      completed: [...this.completedSet],
      active: [...this.activeSet],
    };
    this.storage.set(charKey(this.charId), save);
  }
}

/** ¿La baja de `enemyType` cuenta para este objetivo de matar? */
function matchesKill(obj: KillObjective, enemyType: string): boolean {
  if (obj.enemyTypes?.length) return obj.enemyTypes.includes(enemyType);
  if (obj.family) return enemyType.startsWith(obj.family);
  return true;  // sin filtro: cualquier enemigo
}
