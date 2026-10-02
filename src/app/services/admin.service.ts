import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'idle.admin';

/**
 * Fuente de verdad del modo admin (se fija en el login).
 *
 * - **Admin**: lo ve y lo tiene TODO desbloqueado.
 * - **No admin** (espectador): solo ve/usa lo que está desbloruedado de verdad;
 *   lo bloqueado queda oculto.
 *
 * Arranca APAGADO: el juego por defecto se ve como lo ve un jugador normal. El modo
 * admin hay que pedirlo a mano con el toggle del login.
 * Puntos de enganche (pendientes para cuando exista el login):
 *  - `TalentService`: usar {@link isAdmin} para tratar todos los nodos como
 *    desbloqueados (bonos + visibilidad) cuando es admin.
 *  - `skill-slots-panel`: filtrar las habilidades a las desbloqueadas si NO es admin.
 *  - Árbol de talentos / fichas: ocultar lo no desbloqueado si NO es admin.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly _isAdmin$ = new BehaviorSubject<boolean>(this.load());
  readonly isAdmin$ = this._isAdmin$.asObservable();

  get isAdmin(): boolean { return this._isAdmin$.value; }

  /** Lo llamará el login según el check de admin. */
  setAdmin(value: boolean): void {
    this._isAdmin$.next(value);
    try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch { /* sin storage */ }
  }

  private load(): boolean {
    // Solo un '1' explícito (guardado por el toggle del login) enciende el modo admin.
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  }
}
