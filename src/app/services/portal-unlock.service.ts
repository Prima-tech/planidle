import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InventoryService } from './inventory.service';
import { UnlockService } from './unlock.service';
import { UnlockScope } from './unlock-config';

export interface PortalUnlockCost { name: string; qty: number; }

export interface PortalUnlockReq {
  /** Flag de UnlockService que se marca al pagar (persiste el desbloqueo). */
  flag: string;
  scope: UnlockScope;
  /** Materiales requeridos (nombre de item + cantidad). */
  cost: PortalUnlockCost[];
}

/**
 * Puente Phaser ↔ Angular para la ventana de "portal sellado". La escena llama a
 * `open(req)` al interactuar con un portal bloqueado; el PortalUnlockComponent lee
 * `request$` y muestra la ventana. Al confirmar, cobra los materiales del inventario
 * y marca el flag → el portal se abre (la escena lo detecta vía `unlocks.hasFlag`).
 */
@Injectable({ providedIn: 'root' })
export class PortalUnlockService {
  private inventory = inject(InventoryService);
  private unlocks   = inject(UnlockService);

  /** Petición actual (null = ventana cerrada). */
  readonly request$ = new BehaviorSubject<PortalUnlockReq | null>(null);

  /** Posición CSS (px, relativa al viewport) del borde superior del portal al que apunta
   *  la petición. La escena la actualiza cada frame; la ventana se ancla ahí siguiendo al
   *  portal. Objeto mutable (no observable) → el componente lo lee en un rAF, sin CD. */
  readonly anchor = { x: 0, y: 0 };
  setAnchor(x: number, y: number): void { this.anchor.x = x; this.anchor.y = y; }

  open(req: PortalUnlockReq): void { this.request$.next(req); }
  close(): void { if (this.request$.value) this.request$.next(null); }

  /** Cantidad que tiene el jugador de un material (por nombre). */
  have(name: string): number { return this.inventory.countByName(name); }

  /** Icono de un material (por nombre), buscando el primer item del inventario con ese
   *  nombre. Si el jugador no tiene ninguno todavía, devuelve '' (la ventana muestra un
   *  marcador genérico). Vale para pintar el coste sin un catálogo global de iconos. */
  iconFor(name: string): string { return this.inventory.iconByName?.(name) ?? ''; }

  /** ¿Tiene el jugador todos los materiales del coste? */
  canAfford(req: PortalUnlockReq | null = this.request$.value): boolean {
    return !!req && req.cost.every(c => this.inventory.countByName(c.name) >= c.qty);
  }

  /** Cobra el coste y marca el portal como desbloqueado. Devuelve true si se pagó. */
  confirm(): boolean {
    const req = this.request$.value;
    if (!req || !this.canAfford(req)) return false;
    for (const c of req.cost) this.inventory.consumeByName(c.name, c.qty);
    this.unlocks.setFlag(req.flag, req.scope);
    this.close();
    return true;
  }
}
