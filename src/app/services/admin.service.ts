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
 * Por ahora arranca en `true` para no cambiar la experiencia de desarrollo.
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
    try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch { return true; }
  }
}
