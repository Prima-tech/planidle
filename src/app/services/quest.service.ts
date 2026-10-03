import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { StorageService } from './storage.service';
import { KillService } from './kill.service';
import { PlayerStateService } from './player-state.service';
import { RunProgressService } from './run-progress.service';
import { NotificationBadgeService } from './notification-badge.service';
import { UnlockService } from './unlock.service';
import { InventoryItem, InventoryService } from './inventory.service';
import { GameSettingsService } from './game-settings.service';
import { CityBuildService } from './city-build.service';
import { GatheringEquipmentService } from './gathering-equipment.service';
import { RECIPE_IRON_PICKAXE_FLAG } from './workbench.service';
import { ITEM_CATALOG, hydrateItem } from '../physics/griddrops';

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
  | StarsObjective
  | OpenPortalObjective
  | CollectObjective
  | BuildObjective
  | EquipObjective;
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

/** Abrir un portal sellado (marca su flag en UnlockService al pagar su coste en
 *  materiales). El progreso es binario: 0 hasta abrirlo, `goal` (1) al abrirlo. Se
 *  cumple RETROACTIVAMENTE: da igual cuándo recojas los materiales o si abres el
 *  portal antes de aceptar la misión, cuenta igual (sigue el estado del flag). */
export interface OpenPortalObjective {
  type: 'openPortal';
  goal: number;   // siempre 1
  flag: string;   // flag de UnlockService que se marca al abrir el portal
}

/** Recoger materiales (tener N de cada item en el inventario). El progreso = cuántos de
 *  los `items` están ya al completo; goal = items.length (todos). RETROACTIVO: sigue el
 *  inventario actual, así que lo recogido antes de aceptar la misión cuenta igual. */
export interface CollectObjective {
  type: 'collect';
  goal: number;   // = items.length
  items: { name: string; qty: number }[];
  /** true → al COBRARLA se entregan (y se gastan) los materiales. Si para entonces ya
   *  no los tienes (el progreso es pegajoso), se cobra lo que haya y la misión se
   *  completa igual: ya estaba ganada. */
  consume?: boolean;
}

/** Levantar un edificio en Asgard (sistema de construcción). El progreso es binario:
 *  0 hasta construirlo, `goal` (1) al colocarlo. NO es retroactivo: cuenta solo lo que
 *  coloca ESTE personaje mientras la misión le toca (evento de colocación + prerequisito
 *  cumplido). La ciudad es compartida entre personajes, así que mirar `isBuilt()` al
 *  cargar le regalaría la misión a todo personaje nuevo. Pegajoso: borrar el edificio
 *  después no descompleta la misión (el progreso ya quedó guardado). */
export interface BuildObjective {
  type: 'build';
  goal: number;        // siempre 1
  buildType: string;   // `type` en BUILDABLES (city-build.service), p.ej. 'workbench'
}

/** Tener EQUIPADO un item concreto (p.ej. una herramienta fabricada en la mesa de
 *  trabajo). Progreso binario: 0 hasta equiparlo, `goal` (1) al equiparlo. Solo cuenta
 *  con el prerequisito cobrado (si ya lo llevabas puesto al llegar, cuenta al instante).
 *  Pegajoso: desequiparlo después no descompleta la misión. */
export interface EquipObjective {
  type: 'equip';
  goal: number;       // siempre 1
  itemName: string;   // nombre en ITEM_CATALOG, p.ej. 'Hacha de Hierro'
}

export interface QuestReward {
  coins?: number;
  exp?: number;
  /** Hito del Modo Mundo que se otorga al cobrar (p.ej. 'sprint' = Impulso). */
  runMilestone?: string;
  /** Items que se meten en la mochila al cobrar (nombre en ITEM_CATALOG). Si no
   *  caben, caen al suelo del mapa (`addOrDropToWorld`). */
  items?: { name: string; qty: number }[];
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
  /** NPC que ENCARGA la misión: su retrato (recortado de la hoja LPC) sale como avatar
   *  de la tarjeta en la ventana de misiones. Debe existir en NPC_PORTRAITS. */
  giver?: string;
  /** Flags (ámbito personaje) que se marcan cuando la misión pasa a estar DISPONIBLE
   *  (Mordekai la ofrece al cobrar la previa). P.ej. desbloquear una receta de la mesa
   *  de trabajo que hace falta para cumplirla. */
  startFlags?: string[];
}

/** Retrato de un NPC para la ventana de misiones: se recorta el frame idle de su hoja
 *  LPC (frames 64×64) por CSS. `cols` = columnas de la hoja; `frame` = índice del frame
 *  idle a mostrar (mismo que usa la escena para pintarlo quieto). */
export interface NpcPortrait { sheet: string; frame: number; cols: number; }

export const NPC_PORTRAITS: Record<string, NpcPortrait> = {
  // Mordekai: hoja LPC de 24 columnas, idle = frame 240 (ver CITY_NPCS en gamescene).
  Mordekai: { sheet: 'assets/sprites/players/mordekai.png', frame: 240, cols: 24 },
};

/** Máximo de misiones activas (fijadas en el HUD) a la vez. */
export const MAX_ACTIVE_QUESTS = 5;

// ── Catálogo de misiones ──────────────────────────────────────────────────────
// El orden aquí es el orden de presentación.

// Los textos (name/desc/track) son CLAVES i18n: se traducen al mostrarlos con el
// pipe `| translate` (equipment quest panel, HUD tracker). Ver QUESTS.* en los json.
/** Materiales de la primera misión. Compartidos por las dos cadenas; lo que cambia
 *  es si se ENTREGAN al cobrarla (ver `consume` más abajo). */
const MATERIALES_INICIALES = [{ name: 'Piedra', qty: 5 }, { name: 'Madera', qty: 5 }];

export const QUESTS: QuestDef[] = [
  {
    // PRIMERA misión de todas (Mordekai): recoge 5 Piedra + 5 Madera del suelo de Asgard.
    // Se cumple al TENER ambos en el inventario (retroactivo: cuenta lo ya recogido).
    id: 'recoge_materiales',
    name: 'QUESTS.RECOGE_MATERIALES.NAME',
    desc: 'QUESTS.RECOGE_MATERIALES.DESC',
    icon: 'cube-outline',
    track: 'QUESTS.RECOGE_MATERIALES.TRACK',
    // Cadena CON exploración: NO se entregan. El jugador los necesita después para
    // abrir el portal sellado de Asgard (ver `unlockCost` en map-config).
    objective: { type: 'collect', goal: 2, items: MATERIALES_INICIALES },
    reward: { exp: 10, items: [{ name: 'Mesa de trabajo', qty: 1 }] },
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_COLLECT_CLAIM' },
  },
  {
    id: 'primeras_estrellas',
    name: 'QUESTS.PRIMERAS_ESTRELLAS.NAME',
    desc: 'QUESTS.PRIMERAS_ESTRELLAS.DESC',
    icon: 'star-outline',
    track: 'QUESTS.PRIMERAS_ESTRELLAS.TRACK',
    objective: { type: 'stars', goal: 100 },
    // Recompensa: 10 de oro. El Impulso ya NO se otorga aquí: se compra con estrellas
    // en el panel de mejoras del run (hito 'sprint', 10★).
    reward: { coins: 10, exp: 10 },
    requires: 'recoge_materiales',   // sigue a la misión de recoger materiales
    giver: 'Mordekai',
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
    reward: { coins: 100, exp: 10 },
    giver: 'Mordekai',
    requires: 'primeras_estrellas',   // aparece solo tras cobrar la de la estrella
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_CLAIM2' },
  },
];

/** Cadena SIN Modo Exploración (ajuste skipExploration). Solo conserva la primera misión
 *  (mismo id → comparte progreso); su diálogo de cobro manda a 1-1 en vez de a explorar. */
export const QUESTS_NO_EXPLORATION: QuestDef[] = [
  {
    // Misma misión (mismo id → mismo progreso) con dos cambios: aquí SÍ se entregan los
    // materiales a Mordekai al cobrarla (sin exploración el portal sellado ni siquiera
    // aparece, así que no hay otro uso para ellos), y su diálogo manda al banco.
    ...QUESTS[0],
    objective: { type: 'collect', goal: 2, consume: true, items: MATERIALES_INICIALES },
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_NOEXP_CLAIM0' },
  },
  {
    // Aprender los planos que da la misión anterior (botón "Aprender" en la ficha del
    // item) y levantar el banco con el botón Construir de Asgard.
    id: 'noexp_mesa_trabajo',
    name: 'QUESTS.NOEXP_MESA_TRABAJO.NAME',
    desc: 'QUESTS.NOEXP_MESA_TRABAJO.DESC',
    icon: 'hammer-outline',
    track: 'QUESTS.NOEXP_MESA_TRABAJO.TRACK',
    objective: { type: 'build', goal: 1, buildType: 'workbench' },
    reward: { coins: 10, exp: 10 },
    requires: 'recoge_materiales',
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_BENCH_CLAIM' },
  },
  {
    // Fabricar el Hacha de Hierro en la mesa de trabajo (receta disponible de serie) y
    // equiparla. Se entrega hablando con Mordekai.
    id: 'noexp_hacha',
    name: 'QUESTS.NOEXP_HACHA.NAME',
    desc: 'QUESTS.NOEXP_HACHA.DESC',
    icon: 'construct-outline',
    track: 'QUESTS.NOEXP_HACHA.TRACK',
    objective: { type: 'equip', goal: 1, itemName: 'Hacha de Hierro' },
    reward: { coins: 10, exp: 10 },
    requires: 'noexp_mesa_trabajo',
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_AXE_CLAIM' },
  },
  {
    // Al ofrecerla (cobrar la del hacha) se desbloquea la receta del Pico de Hierro en
    // la mesa de trabajo. Fabricarlo y equiparlo; se entrega hablando con Mordekai.
    id: 'noexp_pico',
    name: 'QUESTS.NOEXP_PICO.NAME',
    desc: 'QUESTS.NOEXP_PICO.DESC',
    icon: 'hammer-outline',
    track: 'QUESTS.NOEXP_PICO.TRACK',
    objective: { type: 'equip', goal: 1, itemName: 'Pico de Hierro' },
    reward: { coins: 10, exp: 10 },
    requires: 'noexp_hacha',
    startFlags: [RECIPE_IRON_PICKAXE_FLAG],
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_PICK_CLAIM' },
  },
  {
    // Estrenar las herramientas: talar y picar hasta reunir 5 Madera + 5 Mineral de Cobre
    // (lo que sueltan árboles y rocas de Asgard; la Piedra solo sale del suelo), que se
    // entregan a Mordekai al cobrarla.
    id: 'noexp_farmeo',
    name: 'QUESTS.NOEXP_FARMEO.NAME',
    desc: 'QUESTS.NOEXP_FARMEO.DESC',
    icon: 'leaf-outline',
    track: 'QUESTS.NOEXP_FARMEO.TRACK',
    objective: { type: 'collect', goal: 2, consume: true, items: [{ name: 'Madera', qty: 5 }, { name: 'Mineral de Cobre', qty: 5 }] },
    reward: { coins: 10, exp: 10 },
    requires: 'noexp_pico',
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_FARM_CLAIM' },
  },
  {
    id: 'noexp_slimes',
    name: 'QUESTS.NOEXP_SLIMES.NAME',
    desc: 'QUESTS.NOEXP_SLIMES.DESC',
    icon: 'skull-outline',
    track: 'QUESTS.NOEXP_SLIMES.TRACK',
    objective: { type: 'kill', family: 'slime', goal: 10 },
    reward: { coins: 50, exp: 10 },
    requires: 'noexp_farmeo',
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_NOEXP_CLAIM1' },
  },
  {
    id: 'noexp_slime_elite',
    name: 'QUESTS.NOEXP_SLIME_ELITE.NAME',
    desc: 'QUESTS.NOEXP_SLIME_ELITE.DESC',
    icon: 'flame-outline',
    track: 'QUESTS.NOEXP_SLIME_ELITE.TRACK',
    objective: { type: 'kill', enemyTypes: ['slime4_elite'], goal: 1 },
    reward: { coins: 150, exp: 10 },
    requires: 'noexp_slimes',
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_NOEXP_CLAIM2' },
  },
  {
    id: 'noexp_ratas',
    name: 'QUESTS.NOEXP_RATAS.NAME',
    desc: 'QUESTS.NOEXP_RATAS.DESC',
    icon: 'skull-outline',
    track: 'QUESTS.NOEXP_RATAS.TRACK',
    objective: { type: 'kill', family: 'rats', goal: 15 },
    reward: { coins: 300, exp: 10 },
    requires: 'noexp_slime_elite',
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_NOEXP_CLAIM3' },
  },
  {
    id: 'noexp_orcos',
    name: 'QUESTS.NOEXP_ORCOS.NAME',
    desc: 'QUESTS.NOEXP_ORCOS.DESC',
    icon: 'skull-outline',
    track: 'QUESTS.NOEXP_ORCOS.TRACK',
    objective: { type: 'kill', family: 'orc', goal: 20 },
    reward: { coins: 600, exp: 10 },
    requires: 'noexp_ratas',
    giver: 'Mordekai',
    claimDialogue: { speaker: 'Mordekai', text: 'NPC.MORDEKAI_NOEXP_CLAIM4' },
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
  private portalSub: Subscription;
  private invSub: Subscription;
  private buildSub: Subscription;
  private equipSub: Subscription;
  private skipSub: Subscription;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private storage: StorageService,
    private kills: KillService,
    private playerState: PlayerStateService,
    private runProgress: RunProgressService,
    private badges: NotificationBadgeService,
    private unlocks: UnlockService,
    private inventory: InventoryService,
    private gs: GameSettingsService,
    private cityBuild: CityBuildService,
    private gathering: GatheringEquipmentService,
  ) {
    // Al cambiar "sin exploración" cambia la cadena entera: saneamos lo fijado y
    // re-enganchamos la que toca (ver syncChain).
    this.skipSub = this.gs.skipExploration$.subscribe(() => { this.syncChain(); this.notify(); });
    // killDetail$ solo emite en bajas reales (no en restoreCharKills), así una
    // misión recién cargada no se autocompleta ni dispara toasts al recargar.
    this.killSub = this.kills.killDetail$.subscribe(({ enemyType }) => {
      this.onKill(enemyType);
    });
    // Estrellas: el progreso sigue el balance actual (max, nunca baja). Las emisiones
    // previas a loadForChar no importan: loadForChar reemplaza `progress` desde el save.
    this.starSub = this.runProgress.stars$.subscribe(balance => this.onStarsBalance(balance));
    // Portales sellados: al marcarse su flag (abrirlos pagando materiales) UnlockService
    // emite changes$ → sincroniza el progreso de las misiones 'openPortal'.
    this.portalSub = this.unlocks.changes$.subscribe(() => this.onPortalFlags());
    // Inventario: al cambiar (recoger/gastar) sincroniza el progreso de las 'collect'.
    this.invSub = this.inventory.changes$.subscribe(() => this.onCollect());
    // Construcción: al colocar un edificio en Asgard sincroniza las misiones 'build'.
    this.buildSub = this.cityBuild.placed$.subscribe(() => this.onBuild());
    // Equipo de recolección: al equipar/cambiar sincroniza las misiones 'equip'.
    this.equipSub = this.gathering.changes$.subscribe(() => this.onEquip());
  }

  ngOnDestroy(): void {
    this.killSub?.unsubscribe();
    this.starSub?.unsubscribe();
    this.portalSub?.unsubscribe();
    this.invSub?.unsubscribe();
    this.buildSub?.unsubscribe();
    this.equipSub?.unsubscribe();
    this.skipSub?.unsubscribe();
    if (this.persistTimer) clearTimeout(this.persistTimer);
  }

  /** Definición de una misión por id (para consultarla desde la escena/NPCs). */
  byId(id: string): QuestDef | undefined {
    return this.list().find(q => q.id === id) ?? QUESTS.find(q => q.id === id);
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
    // Sincroniza el progreso de estrellas con el balance actual (global de cuenta).
    this.onStarsBalance(this.runProgress.getStars());
    // Sincroniza el progreso de portales con los flags ya marcados (retroactivo al cargar).
    this.onPortalFlags();
    // Sincroniza el progreso de recogida con el inventario actual (retroactivo al cargar).
    this.onCollect();
    // La cadena puede haber cambiado desde el último guardado (toggle "sin exploración").
    this.syncChain();
    // Equipo actual: si ya llevas puesta la herramienta que pide una misión 'equip'.
    // (Los startFlags NO se marcan aquí: UnlockService carga sus flags DESPUÉS que las
    // misiones en SaveService.loadCharacter y los pisaría. Se marcan al cobrar la previa.)
    this.onEquip();
    // Calienta el cache de construcciones/recetas (idempotente) para que el panel
    // Construir y la ficha del item sepan desde el primer frame qué hay aprendido.
    await this.cityBuild.load();
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

  /** Saneado de la cadena vigente. El ajuste "sin exploración" puede cambiarse a mitad
   *  de partida, y entonces lo fijado en el HUD es de la OTRA cadena (p.ej. la misión de
   *  estrellas) y la sucesora de la nueva nunca se fijó, porque eso ocurre en `claim()`
   *  y el cobro ya pasó. Aquí: fuera lo que no pertenece a esta cadena, y dentro la
   *  siguiente cuyo prerequisito ya esté cobrado. */
  private syncChain(): void {
    const chain = this.list();
    let changed = false;

    for (const id of [...this.activeSet]) {
      const def = chain.find(q => q.id === id);
      // Fuera lo que no es de esta cadena y lo que aún no toca (su previa sin cobrar):
      // un personaje nuevo no puede arrancar con una misión encadenada ya fijada.
      if (!def || !this.prereqMet(def)) { this.activeSet.delete(id); changed = true; }
    }
    for (const q of chain) {
      if (!q.requires || !this.completedSet.has(q.requires)) continue;   // la 1ª la da el NPC
      if (this.completedSet.has(q.id) || this.activeSet.has(q.id)) continue;
      if (!this.canActivate()) break;
      this.activeSet.add(q.id);
      changed = true;
    }

    if (changed) { this.notify(); this.persistNow(); }
  }

  /** Cadena vigente según el ajuste "sin exploración". */
  private list(): QuestDef[] {
    return this.gs.skipExploration ? QUESTS_NO_EXPLORATION : QUESTS;
  }

  /** ¿La misión no pertenece a la cadena vigente? */
  isSkipped(def: QuestDef): boolean {
    return !this.list().some(q => q.id === def.id);
  }

  /** ¿Está desbloqueada la UI de misiones? Espejo de `missionsUnlocked` en la ventana
   *  de equipo: la pestaña de Misiones solo existe cuando Mordekai ya dio la primera
   *  ('recoge_materiales' activa o completada). Antes de eso NO debe encenderse el aviso
   *  (notif-dot), aunque el objetivo ya esté "reclamable" (p.ej. recoger materiales antes
   *  de hablar con Mordekai): el punto rojo apuntaría a una pestaña oculta sin nada que cobrar. */
  private questsUiUnlocked(): boolean {
    return this.activeSet.has('recoge_materiales') || this.completedSet.has('recoge_materiales');
  }

  /** Enciende el aviso de misiones, pero solo si la UI ya está desbloqueada. */
  private flagQuestsBadge(): void {
    if (this.questsUiUnlocked()) this.badges.flag('equip.quests');
  }

  available(): QuestDef[] {
    return this.list().filter(q => !this.completedSet.has(q.id) && this.prereqMet(q));
  }

  /** Misión vigente de un NPC que reparte misiones (`giver`): la primera que se le
   *  pueda ENTREGAR y, si no hay ninguna, la primera que tenga disponible. null cuando
   *  no le queda nada. Lo usa el marcador flotante !/? de la escena, que si no se
   *  quedaría clavado en la primera misión de la cadena. */
  questForGiver(giver: string): QuestDef | null {
    const mine = this.available().filter(q => q.giver === giver);
    return mine.find(q => this.isClaimable(q)) ?? mine[0] ?? null;
  }

  /** Guía: item que pide equipar una misión 'equip' en curso (p.ej. 'Hacha de Hierro'),
   *  o null. La UI resalta el camino: Fabricar → mochila → item → Equipar. */
  pendingEquipItem(): string | null {
    const q = this.available().find(d => d.objective.type === 'equip' && !this.isClaimable(d));
    return q?.objective.type === 'equip' ? q.objective.itemName : null;
  }

  completed(): QuestDef[] {
    return this.list().filter(q => this.completedSet.has(q.id));
  }

  /** Misiones fijadas en el HUD (siempre no completadas). */
  active(): QuestDef[] {
    return this.list().filter(q => this.activeSet.has(q.id) && !this.completedSet.has(q.id));
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
    return this.list().some(q => this.isClaimable(q));
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
    if (this.isSkipped(def)) return;            // no pertenece a la cadena vigente
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
    for (const def of this.list()) {
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
    for (const def of this.list()) {
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

  /** Progreso de las misiones 'openPortal' = 1 si su portal ya está abierto (flag marcado
   *  en UnlockService), 0 si no. RETROACTIVO: da igual cuándo recojas los materiales o si
   *  abres el portal antes de aceptar la misión — sigue el estado del flag. No autocompleta:
   *  al llegar al objetivo espera a "Completar" (o a hablar con Mordekai). */
  private onPortalFlags(): void {
    let changed = false;
    for (const def of this.list()) {
      if (def.objective.type !== 'openPortal') continue;
      if (this.completedSet.has(def.id)) continue;
      const cur = this.progress[def.id] ?? 0;
      if (cur >= def.objective.goal) continue;
      if (!this.unlocks.hasFlag(def.objective.flag)) continue;   // portal aún sellado
      this.progress[def.id] = def.objective.goal;
      changed = true;
      this.flagQuestsBadge();
    }
    if (changed) {
      this.notify();
      this.schedulePersist();
    }
  }

  /** Marca el progreso de las misiones 'build' al COLOCAR un edificio (placed$). Solo
   *  cuentan las misiones que ya le tocan a este personaje (prerequisito cobrado): la
   *  ciudad es global, y sin ese filtro el edificio de un personaje completaría la
   *  misión de otro. No autocompleta: espera a "Completar" (o a Mordekai). */
  private onBuild(): void {
    let changed = false;
    for (const def of this.list()) {
      if (def.objective.type !== 'build') continue;
      if (this.completedSet.has(def.id)) continue;
      if (!this.prereqMet(def)) continue;
      const cur = this.progress[def.id] ?? 0;
      if (cur >= def.objective.goal) continue;
      if (!this.cityBuild.isBuilt(def.objective.buildType)) continue;   // aún sin construir
      this.progress[def.id] = def.objective.goal;
      changed = true;
      this.flagQuestsBadge();
    }
    if (changed) {
      this.notify();
      this.schedulePersist();
    }
  }

  /** Marca el progreso de las misiones 'equip' si el item pedido está equipado en algún
   *  slot de recolección. Solo con el prerequisito cobrado; pegajoso (no baja). */
  private onEquip(): void {
    let changed = false;
    for (const def of this.list()) {
      if (def.objective.type !== 'equip') continue;
      if (this.completedSet.has(def.id)) continue;
      if (!this.prereqMet(def)) continue;
      const cur = this.progress[def.id] ?? 0;
      if (cur >= def.objective.goal) continue;
      const name = def.objective.itemName;
      if (!this.gathering.slots.some(sl => sl.item?.name === name)) continue;   // no equipado
      this.progress[def.id] = def.objective.goal;
      changed = true;
      this.flagQuestsBadge();
    }
    if (changed) {
      this.notify();
      this.schedulePersist();
    }
  }

  /** Marca los `startFlags` de las misiones que ya están ofrecidas (prerequisito
   *  cobrado), p.ej. la receta del pico al ofrecer su misión. Idempotente. */
  private grantStartFlags(): void {
    for (const q of this.list()) {
      if (!q.startFlags?.length || !this.prereqMet(q)) continue;
      for (const f of q.startFlags) if (!this.unlocks.hasFlag(f)) this.unlocks.setFlag(f, 'char');
    }
  }

  /** Progreso de las misiones 'collect' = nº de materiales que ya tienes al completo en el
   *  inventario (goal = todos). RETROACTIVO: sigue el inventario actual, así que lo recogido
   *  antes de aceptar la misión cuenta igual. PEGAJOSO (max, nunca baja): una vez has tenido
   *  todo a la vez, gastarlo (p.ej. abrir el portal) no descompleta la misión. */
  private onCollect(): void {
    let changed = false;
    for (const def of this.list()) {
      if (def.objective.type !== 'collect') continue;
      if (this.completedSet.has(def.id)) continue;
      if (!this.prereqMet(def)) continue;   // aún no ofrecida: no acumula (la cuenta al ofrecerse)
      const done = def.objective.items.filter(it => this.inventory.countByName(it.name) >= it.qty).length;
      const cur = this.progress[def.id] ?? 0;
      const next = Math.max(cur, done);
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
    this.payObjectiveCost(def);
    this.grantReward(def.reward);
    // Desbloquea y fija en el HUD las misiones encadenadas a esta (requires === def.id).
    for (const q of this.list()) if (q.requires === def.id) this.activate(q);
    this.grantStartFlags();   // las recién ofrecidas desbloquean lo suyo (p.ej. receta)
    this.onEquip();           // si ya llevas puesto lo que pide la siguiente, cuenta ya
    this.onCollect();         // ídem con los materiales que ya lleves encima
    this.completed$.next(def);
    this.notify();
    this.persistNow();  // los completados se guardan al momento (recompensa ya dada)
  }

  /** Entrega (gasta) los materiales de un objetivo 'collect' marcado con `consume`.
   *  Best-effort: si falta algo no bloquea el cobro — la misión ya estaba ganada. */
  private payObjectiveCost(def: QuestDef): void {
    const obj = def.objective;
    if (obj.type !== 'collect' || !obj.consume) return;
    for (const it of obj.items) this.inventory.consumeByName(it.name, it.qty);
  }

  private grantReward(reward?: QuestReward): void {
    if (!reward) return;
    if (reward.coins) this.playerState.collectCoins(reward.coins);
    if (reward.exp)   this.playerState.addExp(reward.exp);
    if (reward.runMilestone) this.runProgress.grant(reward.runMilestone);
    for (const want of reward.items ?? []) this.grantItem(want.name, want.qty);
  }

  /** Mete `qty` unidades de un item del catálogo en la mochila (al suelo si no cabe).
   *  Los apilables van en una sola pila; el resto, una unidad por celda. */
  private grantItem(name: string, qty: number): void {
    const entry = ITEM_CATALOG.find(e => e.name === name);
    if (!entry) { console.warn(`[Quests] recompensa desconocida: ${name}`); return; }
    const make = (sum?: number): InventoryItem => hydrateItem({
      id: this.inventory.generateId(), name: entry.name, ...(sum !== undefined ? { sum } : {}),
    });
    if (entry.mergeable) this.inventory.addOrDropToWorld(make(qty));
    else for (let i = 0; i < qty; i++) this.inventory.addOrDropToWorld(make());
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
