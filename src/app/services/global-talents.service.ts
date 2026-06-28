import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';

/**
 * Talentos GLOBALES de cuenta (ventana "Talentos globales"). A diferencia del árbol
 * radial de personaje, aquí son TRES filas horizontales independientes (Ataque,
 * Skills, Exploración), cada una de 10 niveles con alguna bifurcación. Se desbloquean
 * gastando puntos de cuenta (TOTAL_POINTS), respetando prerrequisitos. Globales entre
 * personajes; persisten en local + cuenta de Supabase (global_data.account.globalTalents).
 *
 * El nodo `FORGE_NODE` desbloquea la pestaña de mejoras de las forjas.
 */

export type GtTreeId = 'attack' | 'skills' | 'exploration';

export interface GtNode {
  id: string;
  tree: GtTreeId;
  level: number;        // 1..10 (posición horizontal)
  branch: number;       // 0 = línea principal; 1 = rama (debajo)
  label: string;
  icon: string;         // ion-icon
  desc: string;         // efecto (placeholder de momento)
  cost: number;         // puntos
  requires: string[];   // nodos prerrequisito
}

export const GT_TREES: { id: GtTreeId; label: string; icon: string }[] = [
  { id: 'attack',      label: 'Ataque',      icon: 'flame-outline' },
  { id: 'skills',      label: 'Skills',      icon: 'flash-outline' },
  { id: 'exploration', label: 'Exploración', icon: 'compass-outline' },
];

const GT_LEVELS = 10;
// Bifurcación cada dos nodos (niveles pares), alternando: arriba, abajo, arriba…
const GT_BRANCH_LEVELS = [2, 4, 6, 8, 10];

function buildNodes(): GtNode[] {
  const out: GtNode[] = [];
  for (const t of GT_TREES) {
    for (let lvl = 1; lvl <= GT_LEVELS; lvl++) {
      const id = `${t.id}_${lvl}`;
      out.push({
        id, tree: t.id, level: lvl, branch: 0,   // línea principal recta
        label: `${t.label} ${lvl}`,
        icon: t.icon,
        desc: `Talento de ${t.label.toLowerCase()}, nivel ${lvl}.`,
        cost: 1,
        requires: lvl === 1 ? [] : [`${t.id}_${lvl - 1}`],
      });
      const bi = GT_BRANCH_LEVELS.indexOf(lvl);
      if (bi !== -1) {
        const dir = bi % 2 === 0 ? -1 : 1;   // alterna: -1 = arriba, +1 = abajo
        out.push({
          id: `${id}b`, tree: t.id, level: lvl, branch: dir,
          label: `${t.label} ${lvl} (rama)`,
          icon: t.icon,
          desc: `Bifurcación de ${t.label.toLowerCase()} en el nivel ${lvl}.`,
          cost: 1,
          requires: [id],
        });
      }
    }
  }
  return out;
}

export const GT_NODES: GtNode[] = buildNodes();

const STORAGE_KEY = 'global_talents';

@Injectable({ providedIn: 'root' })
export class GlobalTalentsService {
  static readonly TOTAL_POINTS = 10;
  /** Nodo que desbloquea las mejoras de las forjas (gating del panel de la forja). */
  static readonly FORGE_NODE = 'skills_1';
  /** Primer nodo de Ataque: desbloquea el auto-ataque (botón ∞ del HUD). */
  static readonly AUTO_ATTACK_NODE = 'attack_1';

  private storage = inject(StorageService);
  private active = new Set<string>();
  private loadPromise: Promise<void>;

  readonly available$ = new BehaviorSubject<number>(GlobalTalentsService.TOTAL_POINTS);
  readonly forgeUpgradesUnlocked$ = new BehaviorSubject<boolean>(false);
  /** true si la mejora de auto-ataque está activa (gatea el botón ∞ del HUD). */
  readonly autoAttackUnlocked$ = new BehaviorSubject<boolean>(false);
  /** Emite tras cualquier cambio (para refrescar la vista). */
  readonly changes$ = new BehaviorSubject<void>(undefined);

  constructor() {
    // El nodo de forja lleva texto propio (es el que gatea las mejoras de la forja).
    const fn = GT_NODES.find(n => n.id === GlobalTalentsService.FORGE_NODE);
    if (fn) { fn.label = 'Mejoras de forjas'; fn.desc = 'Desbloquea la pestaña de mejoras en las forjas.'; }
    // Primer nodo de Ataque = auto-ataque: su ficha explica que activa el botón ∞ del HUD.
    const an = GT_NODES.find(n => n.id === GlobalTalentsService.AUTO_ATTACK_NODE);
    if (an) { an.label = 'Auto-ataque'; an.desc = 'Activa el auto-ataque (botón ∞ del HUD). Si no está desbloqueado, el botón no aparece.'; }
    this.loadPromise = this.load();
  }

  get total(): number { return GlobalTalentsService.TOTAL_POINTS; }
  node(id: string): GtNode | undefined { return GT_NODES.find(n => n.id === id); }
  private costOf(id: string): number { return this.node(id)?.cost ?? 1; }
  get spent(): number { let s = 0; this.active.forEach(id => s += this.costOf(id)); return s; }
  get available(): number { return this.total - this.spent; }

  isUnlocked(id: string): boolean { return this.active.has(id); }
  prereqsMet(n: GtNode): boolean { return n.requires.every(r => this.active.has(r)); }
  canUnlock(n: GtNode): boolean { return !this.active.has(n.id) && this.prereqsMet(n) && this.available >= n.cost; }
  hasUnlockedDependents(n: GtNode): boolean { return GT_NODES.some(x => x.requires.includes(n.id) && this.active.has(x.id)); }
  canRelock(n: GtNode): boolean { return this.active.has(n.id) && !this.hasUnlockedDependents(n); }

  unlock(id: string): void {
    const n = this.node(id);
    if (!n || !this.canUnlock(n)) return;
    this.active.add(id);
    this.emit(); this.persist();
  }

  relock(id: string): void {
    const n = this.node(id);
    if (!n || !this.canRelock(n)) return;
    this.active.delete(id);
    this.emit(); this.persist();
  }

  private emit(): void {
    this.available$.next(this.available);
    this.forgeUpgradesUnlocked$.next(this.active.has(GlobalTalentsService.FORGE_NODE));
    this.autoAttackUnlocked$.next(this.active.has(GlobalTalentsService.AUTO_ATTACK_NODE));
    this.changes$.next();
  }

  // ── Persistencia local ──────────────────────────────────────────────────────

  private async load(): Promise<void> {
    try {
      const saved = (await this.storage.get(STORAGE_KEY)) as string[] | null;
      if (Array.isArray(saved)) this.active = new Set(saved.filter(id => !!this.node(id)));
    } catch (e) {
      console.warn('[global-talents] no se pudo restaurar', e);
    }
    this.emit();
  }

  private persist(): void { this.storage.set(STORAGE_KEY, [...this.active]); }

  // ── Cuenta (Supabase global_data.account) ────────────────────────────────────

  getSnapshot(): string[] { return [...this.active]; }

  async restore(ids: string[] | null | undefined): Promise<void> {
    await this.loadPromise;
    if (!Array.isArray(ids)) return;
    this.active = new Set(ids.filter(id => !!this.node(id)));
    this.emit(); this.persist();
  }
}
