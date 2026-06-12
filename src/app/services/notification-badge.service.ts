import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Badges de notificación ("hay algo nuevo aquí") con claves jerárquicas.
 *
 * Convención de claves: ruta con puntos, de ventana a elemento concreto.
 *   'equip.stats'  → pastilla de stats dentro de la ventana de equipo
 *   'equip.talents'→ (futuro) pestaña de talentos
 *
 * `has('equip')` devuelve true si 'equip' o cualquier hijo ('equip.*') está
 * marcado — el botón que abre la ventana se enciende solo, sin cablear nada.
 * `clear(key)` borra la clave y todos sus hijos (se llama al "ver" la pantalla).
 *
 * Ver skill del proyecto: /notif-badge
 */
@Injectable({ providedIn: 'root' })
export class NotificationBadgeService {

  private keys = new Set<string>();
  readonly changes$ = new BehaviorSubject<void>(undefined);

  /** Marca una clave (idempotente). Marcar 'a.b' enciende también has('a'). */
  flag(key: string): void {
    if (this.keys.has(key)) return;
    this.keys.add(key);
    this.changes$.next();
  }

  /** Borra la clave y todas sus hijas ('a' borra 'a', 'a.b', 'a.b.c'…) */
  clear(key: string): void {
    let changed = false;
    for (const k of [...this.keys]) {
      if (k === key || k.startsWith(key + '.')) {
        this.keys.delete(k);
        changed = true;
      }
    }
    if (changed) this.changes$.next();
  }

  /** true si la clave o cualquiera de sus hijas está marcada */
  has(key: string): boolean {
    for (const k of this.keys) {
      if (k === key || k.startsWith(key + '.')) return true;
    }
    return false;
  }
}
