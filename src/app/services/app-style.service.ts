import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Estilo visual (tema) de TODA la app. Selector en Ajustes (un botón por estilo,
 * uno activo a la vez). Se persiste en localStorage y se aplica pintando el
 * atributo `data-appstyle` en <html>; las piezas que quieran variar por tema usan
 * `:host-context([data-appstyle="dark"]) …` en su SCSS.
 *
 * - `wood` es el estilo PRINCIPAL (por defecto). Toda pieza nueva se maqueta en
 *   wood salvo indicación expresa.
 * - `dark` y `cyberpunk` solo redefinen, de momento, el bocadillo de diálogo de
 *   NPC. Lo que no tenga override cae al look wood automáticamente (base sin
 *   `:host-context`).
 */
export type AppStyleId = 'wood' | 'dark' | 'cyberpunk';

export interface AppStyleDef {
  id: AppStyleId;
  nameKey: string;   // clave i18n del nombre del botón
}

export const APP_STYLES: AppStyleDef[] = [
  { id: 'wood', nameKey: 'SETTINGS.STYLE.WOOD' },
  { id: 'dark', nameKey: 'SETTINGS.STYLE.DARK' },
  { id: 'cyberpunk', nameKey: 'SETTINGS.STYLE.CYBERPUNK' },
];

const STORAGE_KEY = 'app_style';
const ATTR = 'data-appstyle';
const DEFAULT: AppStyleId = 'wood';

@Injectable({ providedIn: 'root' })
export class AppStyleService {

  readonly styles = APP_STYLES;
  private readonly _current$: BehaviorSubject<AppStyleId>;

  constructor() {
    const saved = this.read();
    this._current$ = new BehaviorSubject<AppStyleId>(saved);
    this.apply(saved);   // pinta el atributo al arrancar (sin parpadeo)
  }

  get current(): AppStyleId { return this._current$.value; }
  get current$() { return this._current$.asObservable(); }

  isActive(id: AppStyleId): boolean { return this._current$.value === id; }

  /** Cambia el estilo activo: persiste y lo aplica en caliente a toda la app. */
  set(id: AppStyleId): void {
    if (id === this._current$.value) return;
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* sin storage */ }
    this.apply(id);
    this._current$.next(id);
  }

  private apply(id: AppStyleId): void {
    document.documentElement.setAttribute(ATTR, id);
  }

  private read(): AppStyleId {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'wood' || v === 'dark' || v === 'cyberpunk') return v;
    } catch { /* sin storage */ }
    return DEFAULT;
  }
}
