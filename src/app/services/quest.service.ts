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
  /** Misión previa necesaria: hasta completarla, esta NO aparece (cadena de onboarding). */
  requires?: string;
  /** Diálogo (NPC) que sale al COBRARLA desde la ventana de equipo (que se cierra).
   *  `text` es una clave i18n. Lo dispara la ventana de equipo, no el claim en sí. */
  claimDialogue?: { speaker: string; text: string };
}

/** Máximo de misiones activas (fijadas en el HUD) a la vez. */
export const MAX_ACTIVE_QUESTS = 5;

// ── Catálogo de misiones ──────────────────────────────────────────────────────
// El orden aquí es el orden de presentación.

// Los textos (name/desc/track) son CLAVES i18n: se traducen al mostrarlos con el
// pipe `| translate` (equipment quest panel, HUD tracker). Ver QUESTS.* en los json.
export const QUESTS: QuestDef[] = [
  {
    id: 'primeras_estrellas',
    name: 'QUESTS.PRIMERAS_ESTRELLAS.NAME',
    desc: 'QUESTS.PRIMERAS_ESTRELLAS.DESC',
    icon: 'star-outline',
    track: 'QUESTS.PRIMERAS_ESTRELLAS.TRACK',
    objective: { type: 'stars', goal: 1 },
    // Única recompensa: el Impulso (hito 'sprint'). Sin oro ni EXP.
    reward: { runMilestone: 'sprint' },
    // Al cobrarla en la ventana de equipo: se cierra y Mordekai suelta el hint de la rata.
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_CLAIM1' },
  },
  {
    id: 'mata_rata',
    name: 'QUESTS.MATA_RATA.NAME',
    desc: 'QUESTS.MATA_RATA.DESC',
    icon: 'skull-outline',
    track: 'QUESTS.MATA_RATA.TRACK',
    objective: { type: 'kill', family: 'rats', goal: 1 },
    reward: { coins: 100 },
    requires: 'primeras_estrellas',   // aparece solo tras cobrar la de la estrella
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_CLAIM2' },
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
    // Si quedó alguna misión lista para cobrar, reaviva el notif-dot al cargar
    // (solo si la UI de misiones ya está desbloqueada; ver flagQuestsBadge).
    if (this.hasClaimable()) this.flagQuestsBadge();
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

  /** ¿Cumple el prerequisito? (sin `requires`, o su misión previa ya completada). */
  private prereqMet(q: QuestDef): boolean {
    return !q.requires || this.completedSet.has(q.requires);
  }

  /** ¿Está desbloqueada la UI de misiones? Espejo de `missionsUnlocked` en la ventana
   *  de equipo: la pestaña de Misiones solo existe cuando Mordekai ya dio la primera
   *  ('primeras_estrellas' activa o completada). Antes de eso NO debe encenderse el
   *  aviso (notif-dot), aunque el balance de estrellas ya haga "reclamable" la 1ª
   *  misión (p.ej. coger una estrella en exploración antes de hablar con Mordekai):
   *  el punto rojo apuntaría a una pestaña oculta sin nada que cobrar. */
  private questsUiUnlocked(): boolean {
    return this.activeSet.has('primeras_estrellas') || this.completedSet.has('primeras_estrellas');
  }

  /** Enciende el aviso de misiones, pero solo si la UI ya está desbloqueada. */
  private flagQuestsBadge(): void {
    if (this.questsUiUnlocked()) this.badges.flag('equip.quests');
  }

  available(): QuestDef[] {
    return QUESTS.filter(q => !this.completedSet.has(q.id) && this.prereqMet(q));
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
    // Si al darla ya estaba reclamable (p.ej. cogiste la estrella antes de que
    // Mordekai te la diera), enciende ahora el aviso: la UI acaba de desbloquearse.
    if (this.isClaimable(def)) this.flagQuestsBadge();
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
      if (!this.prereqMet(def)) continue;   // misión bloqueada aún: no acumula progreso
      // Ya alcanzó el objetivo: no se autocompleta, espera a "Completar".
      if ((this.progress[def.id] ?? 0) >= def.objective.goal) continue;
      if (!matchesKill(def.objective, enemyType)) continue;

      this.progress[def.id] = (this.progress[def.id] ?? 0) + 1;
      changed = true;
      // Justo al alcanzar el objetivo: enciende el aviso (mismo notif-dot que
      // el punto de stats al subir de nivel) para indicar que se puede cobrar.
      if (this.progress[def.id] >= def.objective.goal) this.flagQuestsBadge();
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
        if (next >= def.objective.goal) this.flagQuestsBadge();
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
    // Desbloquea y fija en el HUD las misiones encadenadas a esta (requires === def.id).
    for (const q of QUESTS) if (q.requires === def.id) this.activate(q);
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
