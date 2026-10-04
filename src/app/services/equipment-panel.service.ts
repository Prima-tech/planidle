import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Vista concreta de la ventana de equipo que se pide abrir desde fuera. */
export interface EquipmentView {
  tab: number;
  /** Pestaña 0: true → vista "Equipo de recolección" (herramientas) en vez de combate. */
  gathering?: boolean;
}

/**
 * Estado de visibilidad de la ventana de equipo, para que otros paneles
 * (p.ej. el inventario y su comparador) sepan si está abierta y en qué pestaña.
 * La rellena EquipmentComponent en su ngOnInit/ngOnDestroy y al cambiar de pestaña.
 */
@Injectable({ providedIn: 'root' })
export class EquipmentPanelService {
  open = false;
  tab = 0;

  /** Vista pedida desde fuera (p.ej. pulsar la herramienta resaltada por la guía en el
   *  inventario). La consume EquipmentComponent al abrirse, o al vuelo si ya está abierta. */
  pendingView: EquipmentView | null = null;
  /** Emite al pedir una vista: el footer abre la ventana si estaba cerrada. */
  readonly openRequest$ = new Subject<void>();

  /** true cuando el equipo está abierto en la pestaña de equipo de personaje (tab 0). */
  get onCharacterEquipTab(): boolean {
    return this.open && this.tab === 0;
  }

  /** Abre la ventana de equipo (si no lo está) en la vista indicada. */
  requestView(view: EquipmentView): void {
    this.pendingView = view;
    this.openRequest$.next();
  }

  /** Recoge (y borra) la vista pendiente. */
  takePendingView(): EquipmentView | null {
    const v = this.pendingView;
    this.pendingView = null;
    return v;
  }
}
