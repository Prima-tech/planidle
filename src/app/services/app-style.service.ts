import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Estilo visual (tema) de TODA la app. Selector en Ajustes (un botón por estilo,
 * uno activo a la vez). Se persiste en localStorage y se aplica pintando el
 * atributo `data-appstyle` en <html>; las piezas que quieran variar por tema usan
 * `:host-context([data-appstyle="cyberpunk"]) …` en su SCSS.
 *
 * - `wood` es el estilo PRINCIPAL (por defecto). Toda pieza nueva se maqueta en
 *   wood salvo indicación expresa.
 * - El resto de estilos redefinen la barra de vida (top-bar) y, algunos, el
 *   bocadillo de diálogo. Lo que no tenga override cae al look wood automáticamente
 *   (base sin `:host-context`).
 */
export type AppStyleId = 'wood' | 'cyberpunk' | 'arcano' | 'sangre' | 'holo' | 'real' | 'sylvan' | 'ember' | 'desert' | 'jrpg';

export interface AppStyleDef {
  id: AppStyleId;
  nameKey: string;   // clave i18n del nombre del botón
}

export const APP_STYLES: AppStyleDef[] = [
  { id: 'wood', nameKey: 'SETTINGS.STYLE.WOOD' },
  { id: 'cyberpunk', nameKey: 'SETTINGS.STYLE.CYBERPUNK' },
  { id: 'arcano', nameKey: 'SETTINGS.STYLE.ARCANE' },
  { id: 'sangre', nameKey: 'SETTINGS.STYLE.BLOOD' },
  { id: 'holo', nameKey: 'SETTINGS.STYLE.HOLO' },
  { id: 'real', nameKey: 'SETTINGS.STYLE.ROYAL' },
  { id: 'sylvan', nameKey: 'SETTINGS.STYLE.SYLVAN' },
  { id: 'ember', nameKey: 'SETTINGS.STYLE.EMBER' },
  { id: 'desert', nameKey: 'SETTINGS.STYLE.DESERT' },
  { id: 'jrpg', nameKey: 'SETTINGS.STYLE.JRPG' },
];

/**
 * Estilo de la BARRA DE VIDA (top-bar + info de mapa), independiente del tema.
 * `default` = la del tema activo (no pinta nada). El resto pinta `data-hpbar` en
 * <html> y top-bar.component.scss lo sobrescribe encima del tema.
 */
export type HpBarStyleId = 'default' | 'blason' | 'hierro' | 'cristal' | 'jrpg';

export const HP_BAR_STYLES: { id: HpBarStyleId; nameKey: string }[] = [
  { id: 'default', nameKey: 'SETTINGS.HP_BAR.DEFAULT' },
  { id: 'blason', nameKey: 'SETTINGS.HP_BAR.CREST' },
  { id: 'hierro', nameKey: 'SETTINGS.HP_BAR.IRON' },
  { id: 'cristal', nameKey: 'SETTINGS.HP_BAR.GLASS' },
  { id: 'jrpg', nameKey: 'SETTINGS.HP_BAR.JRPG' },
];

const HP_BAR_KEY = 'hpbar_style';
const HP_BAR_ATTR = 'data-hpbar';

const STORAGE_KEY = 'app_style';
const ATTR = 'data-appstyle';
const DEFAULT: AppStyleId = 'wood';

@Injectable({ providedIn: 'root' })
export class AppStyleService {

  readonly styles = APP_STYLES;
  readonly hpBarStyles = HP_BAR_STYLES;
  private readonly _current$: BehaviorSubject<AppStyleId>;
  private _hpBar: HpBarStyleId = 'default';

  constructor() {
    const saved = this.read();
    this._current$ = new BehaviorSubject<AppStyleId>(saved);
    this.apply(saved);   // pinta el atributo al arrancar (sin parpadeo)
    this._hpBar = this.readHpBar();
    this.applyHpBar(this._hpBar);
  }

  get hpBar(): HpBarStyleId { return this._hpBar; }
  isHpBar(id: HpBarStyleId): boolean { return this._hpBar === id; }

  /** Cambia el estilo de la barra de vida: persiste y lo aplica en caliente. */
  setHpBar(id: HpBarStyleId): void {
    if (id === this._hpBar) return;
    this._hpBar = id;
    try { localStorage.setItem(HP_BAR_KEY, id); } catch { /* sin storage */ }
    this.applyHpBar(id);
  }

  private applyHpBar(id: HpBarStyleId): void {
    if (id === 'default') document.documentElement.removeAttribute(HP_BAR_ATTR);
    else document.documentElement.setAttribute(HP_BAR_ATTR, id);
  }

  private readHpBar(): HpBarStyleId {
    try {
      const v = localStorage.getItem(HP_BAR_KEY);
      if (HP_BAR_STYLES.some(s => s.id === v)) return v as HpBarStyleId;
    } catch { /* sin storage */ }
    return 'default';
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
      if (APP_STYLES.some(s => s.id === v)) return v as AppStyleId;
    } catch { /* sin storage */ }
    return DEFAULT;
  }
}
