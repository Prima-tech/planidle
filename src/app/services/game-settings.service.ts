import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { ParallaxThemeId } from '../scenes/gamescene/parallax-themes';
import { WorldParallaxId } from '../scenes/worldrun/parallax-sets';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface GameSettings {
  showJoystick: boolean;
  showFps: boolean;
  showGrid: boolean;          // overlay de rejilla de tiles (debug de posiciones)
  screenShake: boolean;       // efectos de pantalla (temblor de cámara + destellos)
  parallaxTheme: ParallaxThemeId;
  worldParallax: WorldParallaxId;
}

const STORAGE_KEY = 'idle_game_settings';

const DEFAULTS: GameSettings = {
  showJoystick: true,
  showFps: false,
  showGrid: false,
  screenShake: true,
  parallaxTheme: 'sea',
  worldParallax: 'paralax01',
};

// ── Servicio ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GameSettingsService {

  private _settings: GameSettings;
  private _subject: BehaviorSubject<GameSettings>;

  constructor() {
    this._settings = this.load();
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

  get parallaxTheme(): ParallaxThemeId { return this._settings.parallaxTheme; }
  get parallaxTheme$()                 { return this._subject.pipe(map(s => s.parallaxTheme), distinctUntilChanged()); }
  setParallaxTheme(v: ParallaxThemeId) { this.set('parallaxTheme', v); }

  get worldParallax(): WorldParallaxId { return this._settings.worldParallax; }
  get worldParallax$()                 { return this._subject.pipe(map(s => s.worldParallax), distinctUntilChanged()); }
  setWorldParallax(v: WorldParallaxId) { this.set('worldParallax', v); }

  // ── Persistencia ────────────────────────────────────────────────────────────

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      // Merge con defaults para que ajustes nuevos tengan valor por defecto
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
  }
}
