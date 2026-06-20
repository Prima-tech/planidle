import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Qué está haciendo un personaje (para distinguirlo cuando está AFK):
 *  - idle:      en el hogar / sin actividad
 *  - killing:   en un mapa de combate, matando enemigos
 *  - exploring: en el Modo Mundo (runner)
 *  - mining:    minando una roca
 *  - chopping:  talando un árbol
 * Añadir actividades = una entrada nueva aquí + en ACTIVITY_REGISTRY + sus labels i18n.
 */
export type ActivityKind = 'idle' | 'killing' | 'exploring' | 'mining' | 'chopping';

export interface ActivityDef {
  kind: ActivityKind;
  labelKey: string;   // clave i18n (ACTIVITY.*)
  icon: string;       // ion-icon (ficha del roster)
  color: string;      // tinte del icono en la ficha del roster
  iconImg?: string;   // PNG para el avatar de la barra de vida (espada/pico/botas/hacha)
}

// Iconos del avatar de la barra de vida: reusan el arte de equipo/herramientas del
// juego (Ionicons no trae espada/pico/hacha). idle no tiene → cae al person-outline.
const SWORD_ICON = 'assets/sprites/player/equip/weapons/swords/icons/sword_01_icon.png';
const PICK_ICON  = 'assets/sprites/player/equip/tools/picks/icons/pick_01_icon.png';
const AXE_ICON   = 'assets/sprites/player/equip/tools/axes/icons/axe_01_icon.png';
const BOOTS_ICON = 'assets/sprites/player/equip/foot/icons/foot_01_icon.png';

export const ACTIVITY_REGISTRY: Record<ActivityKind, ActivityDef> = {
  idle:      { kind: 'idle',      labelKey: 'ACTIVITY.IDLE',      icon: 'bed-outline',    color: '#9aa6b2' },
  killing:   { kind: 'killing',   labelKey: 'ACTIVITY.KILLING',   icon: 'skull-outline',  color: '#e0584e', iconImg: SWORD_ICON },
  exploring: { kind: 'exploring', labelKey: 'ACTIVITY.EXPLORING', icon: 'walk-outline',   color: '#4ea1e0', iconImg: BOOTS_ICON },
  mining:    { kind: 'mining',    labelKey: 'ACTIVITY.MINING',    icon: 'hammer-outline', color: '#c9a227', iconImg: PICK_ICON  },
  chopping:  { kind: 'chopping',  labelKey: 'ACTIVITY.CHOPPING',  icon: 'leaf-outline',   color: '#5bb24a', iconImg: AXE_ICON   },
};

/**
 * Actividad ACTUAL del personaje activo. Las escenas la fijan (GameScene =
 * killing/idle según el mapa, WorldRunScene = exploring, recolección =
 * mining/chopping) y SaveService la persiste en el snapshot, para que el roster
 * (globalposition) muestre qué hacía cada personaje al dejarlo.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly _current = new BehaviorSubject<ActivityKind>('idle');
  readonly current$ = this._current.asObservable();

  get current(): ActivityKind { return this._current.value; }

  set(kind: ActivityKind): void {
    if (this._current.value !== kind) this._current.next(kind);
  }

  /** Definición (label/icon/color) de una actividad; idle por defecto si es desconocida. */
  def(kind: ActivityKind | undefined | null): ActivityDef {
    return ACTIVITY_REGISTRY[kind as ActivityKind] ?? ACTIVITY_REGISTRY.idle;
  }
}
