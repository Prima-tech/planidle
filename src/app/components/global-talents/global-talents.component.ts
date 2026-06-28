import { Component, inject, OnInit, HostBinding } from '@angular/core';
import { SaveService } from 'src/app/services/save.service';
import { GlobalTalentsService, GtNode, GtTreeId, GT_TREES, GT_NODES } from 'src/app/services/global-talents.service';

// Ventana de TALENTOS GLOBALES de la cuenta. Tres filas horizontales (Ataque, Skills,
// Exploración) de 10 niveles con bifurcaciones; al pulsar un nodo se abre una ficha
// flotante (réplica de la de talentos de personaje). Se desbloquean con puntos de cuenta.
@Component({
  selector: 'app-global-talents',
  templateUrl: './global-talents.component.html',
  styleUrls: ['./global-talents.component.scss'],
  standalone: false,
})
export class GlobalTalentsComponent implements OnInit {
  private save = inject(SaveService);
  private gt = inject(GlobalTalentsService);

  /** Panel ancho (expandido a la derecha), como en talentos de pj. */
  @HostBinding('class.gt-wide') expanded = false;
  toggleExpand(): void { this.expanded = !this.expanded; }

  // Geometría de las filas. La separación horizontal crece al expandir para que los
  // nodos llenen el ancho extra (en vez de dejar hueco a la derecha).
  readonly NODE = 26;     // tamaño del nodo
  readonly GAPY = 40;     // separación de la rama respecto a la línea principal (nodos verticales)
  readonly PAD = 6;       // margen interior
  readonly BAND = 116;    // alto de cada fila (rama arriba + principal + rama abajo); más alto = filas más separadas
  readonly LEVELS = Math.max(...GT_NODES.map(n => n.level));   // nº de niveles (10)
  get gapx(): number { return this.expanded ? 74 : 48; }

  /** Suma de niveles de todos los personajes; null mientras carga. */
  totalLevel: number | null = null;

  readonly trees = GT_TREES;
  readonly total = GlobalTalentsService.TOTAL_POINTS;
  readonly available$ = this.gt.available$;

  /** Nodo seleccionado (abre la ficha). */
  selectedId: string | null = null;

  async ngOnInit(): Promise<void> {
    this.totalLevel = await this.save.getGlobalLevels();
  }

  // ── Datos por fila ───────────────────────────────────────────────────────────

  /** Hueco izquierdo para las etiquetas de cada fila (más aire entre label y nodos). */
  readonly PADL = 78;

  /** Todos los nodos (las 3 filas en el mismo lienzo). */
  get allNodes(): GtNode[] { return GT_NODES; }

  treeIndex(tree: GtTreeId): number { return this.trees.findIndex(t => t.id === tree); }
  bandTop(tree: GtTreeId): number { return this.PAD + this.treeIndex(tree) * this.BAND; }
  /** Centro vertical de la banda (donde va la línea principal). */
  bandCenter(tree: GtTreeId): number { return this.bandTop(tree) + this.BAND / 2; }

  /** Líneas (conexiones) de TODAS las filas en un único SVG. */
  allLines(): { x1: number; y1: number; x2: number; y2: number; active: boolean }[] {
    const out: { x1: number; y1: number; x2: number; y2: number; active: boolean }[] = [];
    for (const n of GT_NODES) {
      for (const r of n.requires) {
        const req = this.gt.node(r);
        if (!req) continue;
        out.push({
          x1: this.cx(req), y1: this.cy(req),
          x2: this.cx(n),   y2: this.cy(n),
          active: this.gt.isUnlocked(n.id),   // tramo encendido si el nodo destino está cogido
        });
      }
    }
    return out;
  }

  canvasWidth(): number { return this.PADL + this.NODE + (this.LEVELS - 1) * this.gapx + this.PAD; }
  canvasHeight(): number { return this.PAD + this.trees.length * this.BAND; }

  nodeX(n: GtNode): number { return this.PADL + (n.level - 1) * this.gapx; }
  nodeY(n: GtNode): number { return this.bandCenter(n.tree) + n.branch * this.GAPY - this.NODE / 2; }
  cx(n: GtNode): number { return this.nodeX(n) + this.NODE / 2; }
  cy(n: GtNode): number { return this.nodeY(n) + this.NODE / 2; }

  // ── Estado / interacción ─────────────────────────────────────────────────────

  state(n: GtNode): 'unlocked' | 'unlockable' | 'locked' {
    if (this.gt.isUnlocked(n.id)) return 'unlocked';
    if (this.gt.prereqsMet(n)) return 'unlockable';
    return 'locked';
  }
  isUnlocked(id: string): boolean { return this.gt.isUnlocked(id); }
  canUnlock(n: GtNode): boolean { return this.gt.canUnlock(n); }

  onNodeClick(n: GtNode): void {
    this.selectedId = this.selectedId === n.id ? null : n.id;
  }

  get selectedNode(): GtNode | null { return this.selectedId ? (this.gt.node(this.selectedId) ?? null) : null; }
  selectedUnlocked(): boolean { return !!this.selectedId && this.gt.isUnlocked(this.selectedId); }
  selectedReachable(): boolean { const n = this.selectedNode; return !!n && this.gt.prereqsMet(n); }
  selectedCanUnlock(): boolean { const n = this.selectedNode; return !!n && this.gt.canUnlock(n); }
  selectedCanRelock(): boolean { const n = this.selectedNode; return !!n && this.gt.canRelock(n); }

  unlockSelected(): void { if (this.selectedId) { this.gt.unlock(this.selectedId); } }
  relockSelected(): void { if (this.selectedId) { this.gt.relock(this.selectedId); } }

  treeLabel(tree: GtTreeId): string { return this.trees.find(t => t.id === tree)?.label ?? ''; }
}
