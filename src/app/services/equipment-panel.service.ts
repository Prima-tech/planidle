import { Injectable } from '@angular/core';

/**
 * Estado de visibilidad de la ventana de equipo, para que otros paneles
 * (p.ej. el inventario y su comparador) sepan si está abierta y en qué pestaña.
 * La rellena EquipmentComponent en su ngOnInit/ngOnDestroy y al cambiar de pestaña.
 */
@Injectable({ providedIn: 'root' })
export class EquipmentPanelService {
  open = false;
  tab = 0;

  /** true cuando el equipo está abierto en la pestaña de equipo de personaje (tab 0). */
  get onCharacterEquipTab(): boolean {
    return this.open && this.tab === 0;
  }
}
