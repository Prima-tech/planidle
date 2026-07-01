import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

// ── Catálogo de efectos ──────────────────────────────────────────────────────
// Los .wav viven en src/assets/audio/sfx/ (generados con tools/sfxgen/gen.mjs).
export const SFX = {
  coin:        'assets/audio/sfx/coin.wav',
  hit:         'assets/audio/sfx/hit.wav',
  enemy_death: 'assets/audio/sfx/enemy_death.wav',
  levelup:     'assets/audio/sfx/levelup.wav',
  mine:        'assets/audio/sfx/mine.wav',
  ui_click:    'assets/audio/sfx/ui_click.wav',
  unlock:      'assets/audio/sfx/unlock.wav',
} as const;

export type SfxId = keyof typeof SFX;

// ── Persistencia de volúmenes ────────────────────────────────────────────────
interface AudioSettings {
  master: number;   // 0..1
  sfx: number;      // 0..1
  music: number;    // 0..1
  muted: boolean;
}

const STORAGE_KEY = 'idle_audio_settings';
const DEFAULTS: AudioSettings = { master: 0.8, sfx: 0.9, music: 0.4, muted: false };

// Evita solapar el mismo efecto demasiadas veces por frame (p. ej. varios golpes)
const SAME_SFX_MIN_GAP_MS = 40;

@Injectable({ providedIn: 'root' })
export class AudioService {

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private buffers = new Map<SfxId, AudioBuffer>();
  private lastPlayedAt = new Map<SfxId, number>();
  private loaded = false;
  private unlocked = false;

  private _settings: AudioSettings;
  private _subject: BehaviorSubject<AudioSettings>;

  constructor() {
    this._settings = this.loadSettings();
    this._subject  = new BehaviorSubject<AudioSettings>({ ...this._settings });
  }

  // ── Inicialización (crear contexto y precargar buffers) ────────────────────
  /** Crea el AudioContext y aplica los gains. Idempotente. */
  private ensureContext(): void {
    if (this.ctx) return;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.applyGains();
  }

  /**
   * Descarga y decodifica todos los efectos. Llamar una vez al arrancar
   * (LayoutComponent). No suena nada hasta que hay un gesto del usuario.
   */
  async preload(): Promise<void> {
    if (this.loaded) return;
    this.ensureContext();
    if (!this.ctx) return;
    const entries = Object.entries(SFX) as [SfxId, string][];
    await Promise.all(entries.map(async ([id, url]) => {
      try {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx!.decodeAudioData(arr);
        this.buffers.set(id, buf);
      } catch (e) {
        console.warn('[audio] no se pudo cargar', id, e);
      }
    }));
    this.loaded = true;
  }

  /**
   * Desbloquea el audio tras el primer gesto del usuario (política de móviles).
   * Engancharlo a un pointerdown/touchstart global una sola vez.
   */
  unlock(): void {
    this.ensureContext();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.unlocked = true;
  }

  // ── Reproducción ────────────────────────────────────────────────────────────
  /** Dispara un efecto puntual. `volume` (0..1) escala sobre el volumen de SFX. */
  play(id: SfxId, volume = 1): void {
    if (this._settings.muted) return;
    if (!this.ctx || !this.sfxGain) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    const now = this.ctx.currentTime * 1000;
    const last = this.lastPlayedAt.get(id) ?? -Infinity;
    if (now - last < SAME_SFX_MIN_GAP_MS) return;
    this.lastPlayedAt.set(id, now);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (volume !== 1) {
      const g = this.ctx.createGain();
      g.gain.value = volume;
      src.connect(g);
      g.connect(this.sfxGain);
    } else {
      src.connect(this.sfxGain);
    }
    src.start(0);
  }

  // ── Volúmenes ────────────────────────────────────────────────────────────────
  private applyGains(): void {
    if (!this.masterGain || !this.sfxGain || !this.musicGain) return;
    const m = this._settings.muted ? 0 : this._settings.master;
    this.masterGain.gain.value = m;
    this.sfxGain.gain.value = this._settings.sfx;
    this.musicGain.gain.value = this._settings.music;
  }

  private update(patch: Partial<AudioSettings>): void {
    this._settings = { ...this._settings, ...patch };
    this.applyGains();
    this.saveSettings();
    this._subject.next({ ...this._settings });
  }

  get settings$() { return this._subject.asObservable(); }

  get masterVolume(): number { return this._settings.master; }
  get masterVolume$() { return this._subject.pipe(map(s => s.master), distinctUntilChanged()); }
  setMasterVolume(v: number) { this.update({ master: clamp01(v) }); }

  get sfxVolume(): number { return this._settings.sfx; }
  get sfxVolume$() { return this._subject.pipe(map(s => s.sfx), distinctUntilChanged()); }
  setSfxVolume(v: number) { this.update({ sfx: clamp01(v) }); }

  get musicVolume(): number { return this._settings.music; }
  get musicVolume$() { return this._subject.pipe(map(s => s.music), distinctUntilChanged()); }
  setMusicVolume(v: number) { this.update({ music: clamp01(v) }); }

  get muted(): boolean { return this._settings.muted; }
  get muted$() { return this._subject.pipe(map(s => s.muted), distinctUntilChanged()); }
  setMuted(v: boolean) { this.update({ muted: v }); }
  toggleMuted() { this.setMuted(!this._settings.muted); }

  /** Bus de música, por si luego se añaden loops de fondo por bioma. */
  get musicBus(): GainNode | null { this.ensureContext(); return this.musicGain; }

  // ── Persistencia ────────────────────────────────────────────────────────────
  private loadSettings(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private saveSettings(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
