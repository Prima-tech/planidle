import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { ParallaxThemeId } from '../scenes/gamescene/parallax-themes';
import { WorldParallaxId } from '../scenes/worldrun/parallax-sets';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type AppLanguage = 'es' | 'en';

export interface GameSettings {
  showJoystick: boolean;
  showFps: boolean;
  showGrid: boolean;          // overlay de rejilla de tiles (debug de posiciones)
  screenShake: boolean;       // efectos de pantalla (temblor de cámara + destellos)
  cameraBounds: boolean;      // la cámara se detiene en el borde del mapa (no muestra el vacío)
  chatEnabled: boolean;       // muestra el chat y deja que otros personajes escriban
  parallaxTheme: ParallaxThemeId;
  worldParallax: WorldParallaxId;
  language: AppLanguage;      // idioma de la interfaz (ngx-translate)
  skipExploration: boolean;   // prueba sin Modo Exploración: sus gates no bloquean y se ocultan sus entradas
  version?: number;           // esquema de los ajustes guardados (para migraciones)
}

const STORAGE_KEY = 'idle_game_settings';

// Esquema de los ajustes guardados. Súbelo al cambiar un DEFAULT que deba imponerse
// sobre lo ya guardado, y añade su caso en `load()`.
//   2 → "Jugar sin exploración" pasa a estar ACTIVO por defecto.
//   3 → "Mostrar joystick" pasa a estar DESACTIVADO por defecto.
const SETTINGS_VERSION = 3;

const DEFAULTS: GameSettings = {
  showJoystick: false,
  showFps: false,
  showGrid: false,
  screenShake: true,
  cameraBounds: true,
  chatEnabled: true,
  parallaxTheme: 'sea',
  worldParallax: 'paralax01',
  language: 'es',
  // Por defecto el juego arranca SIN Modo Exploración: cuenta nueva = cadena de
  // misiones de combate (QUESTS_NO_EXPLORATION), mapas abiertos y sin portales al
  // runner. Se activa a mano desde Ajustes → Admin → "Jugar sin exploración".
  skipExploration: true,
  version: SETTINGS_VERSION,
};

// ── Servicio ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GameSettingsService {

  private _settings: GameSettings;
  private _subject: BehaviorSubject<GameSettings>;
  /** true si `load()` tuvo que migrar los ajustes guardados (ver SETTINGS_VERSION). */
  private _migrated = false;

  constructor() {
    this._settings = this.load();
    // Sella la versión del esquema en disco: si no, una migración se reaplicaría en
    // cada arranque y pisaría la elección del jugador hasta que tocara algún ajuste.
    if (this._migrated) this.save();
    this._subject  = new BehaviorSubject<GameSettings>({ ...this._settings });
  }

  // Acceso individual por clave
  get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return this._settings[key];
  }

  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this._settings[key] = value;
    this.save();
    this._subject.next({ ...this._settings });
  }

  // Observable general (emite GameSettings completo)
  get settings$() { return this._subject.asObservable(); }

  // Shortcuts tipados por setting — emiten solo su valor y solo cuando cambia
  get showJoystick():  boolean { return this._settings.showJoystick; }
  get showJoystick$()          { return this._subject.pipe(map(s => s.showJoystick), distinctUntilChanged()); }
  setShowJoystick(v: boolean)  { this.set('showJoystick', v); }

  get showFps():  boolean { return this._settings.showFps; }
  get showFps$()          { return this._subject.pipe(map(s => s.showFps), distinctUntilChanged()); }
  setShowFps(v: boolean)  { this.set('showFps', v); }

  get showGrid():  boolean { return this._settings.showGrid; }
  get showGrid$()          { return this._subject.pipe(map(s => s.showGrid), distinctUntilChanged()); }
  setShowGrid(v: boolean)  { this.set('showGrid', v); }

  get screenShake():  boolean { return this._settings.screenShake; }
  get screenShake$()          { return this._subject.pipe(map(s => s.screenShake), distinctUntilChanged()); }
  setScreenShake(v: boolean)  { this.set('screenShake', v); }

  get cameraBounds():  boolean { return this._settings.cameraBounds; }
  get cameraBounds$()          { return this._subject.pipe(map(s => s.cameraBounds), distinctUntilChanged()); }
  setCameraBounds(v: boolean)  { this.set('cameraBounds', v); }

  get chatEnabled():  boolean { return this._settings.chatEnabled; }
  get chatEnabled$()          { return this._subject.pipe(map(s => s.chatEnabled), distinctUntilChanged()); }
  setChatEnabled(v: boolean)  { this.set('chatEnabled', v); }

  get parallaxTheme(): ParallaxThemeId { return this._settings.parallaxTheme; }
  get parallaxTheme$()                 { return this._subject.pipe(map(s => s.parallaxTheme), distinctUntilChanged()); }
  setParallaxTheme(v: ParallaxThemeId) { this.set('parallaxTheme', v); }

  get worldParallax(): WorldParallaxId { return this._settings.worldParallax; }
  get worldParallax$()                 { return this._subject.pipe(map(s => s.worldParallax), distinctUntilChanged()); }
  setWorldParallax(v: WorldParallaxId) { this.set('worldParallax', v); }

  get language(): AppLanguage { return this._settings.language; }
  get language$()             { return this._subject.pipe(map(s => s.language), distinctUntilChanged()); }
  setLanguage(v: AppLanguage) { this.set('language', v); }

  get skipExploration():  boolean { return this._settings.skipExploration; }
  get skipExploration$()          { return this._subject.pipe(map(s => s.skipExploration), distinctUntilChanged()); }
  setSkipExploration(v: boolean)  { this.set('skipExploration', v); }

  // ── Persistencia ────────────────────────────────────────────────────────────

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const saved: Partial<GameSettings> = JSON.parse(raw);
      // Merge con defaults para que ajustes nuevos tengan valor por defecto
      const merged: GameSettings = { ...DEFAULTS, ...saved };
      // Migración: lo guardado antes de la v2 lleva skipExploration=false aunque el
      // jugador no lo tocara nunca (era el default viejo). Se adopta el nuevo default
      // una sola vez; a partir de ahí manda lo que elija en Ajustes.
      const savedVersion = saved.version ?? 1;
      if (savedVersion < 2) {
        merged.skipExploration = DEFAULTS.skipExploration;
        this._migrated = true;
      }
      // v3: el joystick pasa a estar oculto por defecto (mismo criterio: una sola vez).
      if (savedVersion < 3) {
        merged.showJoystick = DEFAULTS.showJoystick;
        this._migrated = true;
      }
      merged.version = SETTINGS_VERSION;
      return merged;
    } catch {
      return { ...DEFAULTS };
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
  }
}
