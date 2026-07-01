// SFX generator — síntesis de efectos retro por código (sin dependencias).
// Genera WAV 16-bit mono a 44.1kHz. Dos estilos: 'sharp' (8-bit puro) y 'soft' (suavizado).
//
//   node tools/sfxgen/gen.mjs <outDir>
//
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SR = 44100;
const outDir = process.argv[2] || join(process.cwd(), 'tools', 'sfxgen', 'out');
mkdirSync(outDir, { recursive: true });

// ── Osciladores ──────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const sine     = (p) => Math.sin(p * TAU);
const square   = (p) => (p % 1 < 0.5 ? 1 : -1);
const saw      = (p) => 2 * (p % 1) - 1;
const triangle = (p) => { const x = p % 1; return x < 0.5 ? 4 * x - 1 : 3 - 4 * x; };
let _seed = 1337;
const noise = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return (_seed / 0x3fffffff) - 1; };

// ── Helpers de envolvente / filtro ───────────────────────────────────────────
// ADSR simple sobre longitud n (en muestras)
function adsr(n, a, d, s, r, sustainLevel = 0.6) {
  const env = new Float32Array(n);
  const aN = a * SR, dN = d * SR, rN = r * SR;
  const sN = Math.max(0, n - aN - dN - rN);
  let i = 0;
  for (let k = 0; k < aN && i < n; k++, i++) env[i] = k / aN;
  for (let k = 0; k < dN && i < n; k++, i++) env[i] = 1 - (1 - sustainLevel) * (k / dN);
  for (let k = 0; k < sN && i < n; k++, i++) env[i] = sustainLevel;
  for (let k = 0; k < rN && i < n; k++, i++) env[i] = sustainLevel * (1 - k / rN);
  return env;
}
// decaimiento exponencial
function expEnv(n, tau) {
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.exp(-i / (tau * SR));
  return env;
}
// filtro paso-bajo de un polo (suaviza el brillo del 8-bit)
function lowpass(buf, cutoff) {
  const dt = 1 / SR, rc = 1 / (TAU * cutoff), alpha = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y += alpha * (buf[i] - y); buf[i] = y; }
  return buf;
}
function seconds(s) { return Math.max(1, Math.floor(s * SR)); }

// ── Constructor de sonidos ───────────────────────────────────────────────────
// Cada generador devuelve Float32Array en [-1,1]. `soft` cambia timbre/filtro.
function make(dur, fn) {
  const n = seconds(dur);
  const out = new Float32Array(n);
  let phase = 0, prevFreq = 0;
  const ctx = {
    n, SR,
    // avanza fase con freq variable por muestra
    osc(i, freq, wave) {
      phase += freq / SR;
      return wave(phase);
    },
  };
  for (let i = 0; i < n; i++) out[i] = fn(i, ctx) || 0;
  return out;
}

// lerp de frecuencia
const lerp = (a, b, t) => a + (b - a) * t;

// ── Definición de efectos ────────────────────────────────────────────────────
function coin(soft) {
  const dur = soft ? 0.28 : 0.22;
  const env = expEnv(seconds(dur), soft ? 0.10 : 0.07);
  const wave = soft ? triangle : square;
  const buf = make(dur, (i, c) => {
    const t = i / c.n;
    // salto de dos tonos: nota baja -> nota alta (arpegio corto)
    const freq = t < 0.35 ? 988 : 1319; // B5 -> E6
    return c.osc(i, freq, wave) * env[i] * 0.5;
  });
  return soft ? lowpass(buf, 4000) : buf;
}

function hit(soft) {
  const dur = soft ? 0.16 : 0.12;
  const env = expEnv(seconds(dur), soft ? 0.045 : 0.03);
  const buf = make(dur, (i, c) => {
    const t = i / c.n;
    const freq = lerp(420, 110, t);            // golpe con caída de tono
    const body = c.osc(i, freq, soft ? triangle : square);
    const n = noise() * (1 - t);               // "thwack" de ruido al inicio
    return (body * 0.6 + n * 0.5) * env[i] * 0.6;
  });
  return soft ? lowpass(buf, 3200) : buf;
}

function enemyDeath(soft) {
  const dur = soft ? 0.42 : 0.35;
  const env = expEnv(seconds(dur), soft ? 0.14 : 0.10);
  const buf = make(dur, (i, c) => {
    const t = i / c.n;
    const freq = lerp(600, 70, t * t);         // pop descendente
    const tone = c.osc(i, freq, soft ? sine : square);
    const n = noise() * Math.pow(1 - t, 2) * 0.6;
    return (tone * 0.55 + n) * env[i] * 0.6;
  });
  return soft ? lowpass(buf, 2600) : buf;
}

function levelup(soft) {
  const dur = soft ? 0.7 : 0.6;
  const n = seconds(dur);
  const out = new Float32Array(n);
  const notes = [523, 659, 784, 1047];         // C5 E5 G5 C6
  const wave = soft ? triangle : square;
  const step = n / notes.length;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const idx = Math.min(notes.length - 1, Math.floor(i / step));
    const local = (i - idx * step) / step;
    const e = Math.exp(-local * 3) * 0.9 + 0.1;
    phase += notes[idx] / SR;
    out[i] = wave(phase) * e * 0.4;
  }
  return soft ? lowpass(out, 5000) : out;
}

function mine(soft) {
  const dur = soft ? 0.20 : 0.16;
  const env = expEnv(seconds(dur), soft ? 0.05 : 0.035);
  const buf = make(dur, (i, c) => {
    const t = i / c.n;
    const thud = c.osc(i, lerp(180, 60, t), sine) * 0.7;   // impacto grave
    const click = noise() * Math.pow(1 - t, 6) * 0.8;      // "tick" del pico
    return (thud + click) * env[i] * 0.7;
  });
  return soft ? lowpass(buf, 2200) : buf;
}

function uiClick(soft) {
  const dur = 0.06;
  const env = expEnv(seconds(dur), 0.015);
  const buf = make(dur, (i, c) => {
    const t = i / c.n;
    return c.osc(i, lerp(1200, 800, t), soft ? triangle : square) * env[i] * 0.35;
  });
  return soft ? lowpass(buf, 6000) : buf;
}

function unlock(soft) {
  const dur = soft ? 0.55 : 0.45;
  const n = seconds(dur);
  const out = new Float32Array(n);
  const notes = [784, 988, 1319];              // G5 B5 E6 brillante
  const wave = soft ? triangle : square;
  const step = n / notes.length;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const idx = Math.min(notes.length - 1, Math.floor(i / step));
    const local = (i - idx * step) / step;
    const e = Math.exp(-local * 2.5) * 0.9 + 0.1;
    phase += notes[idx] / SR;
    // pizca de brillo con quinta arriba
    out[i] = (wave(phase) * 0.7 + sine(phase * 1.5) * 0.15) * e * 0.4;
  }
  return soft ? lowpass(out, 5500) : out;
}

const EFFECTS = { coin, hit, enemy_death: enemyDeath, levelup, mine, ui_click: uiClick, unlock };

// ── Escritura WAV ────────────────────────────────────────────────────────────
function writeWav(path, samples) {
  // normaliza suave para evitar clipping
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const g = peak > 0.99 ? 0.99 / peak : 1;
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let v = Math.max(-1, Math.min(1, samples[i] * g));
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  writeFileSync(path, buf);
}

// ── Main ─────────────────────────────────────────────────────────────────────
// Modos:
//   node gen.mjs <outDir>          -> compara ambos estilos (nombre_sharp / nombre_soft)
//   node gen.mjs <outDir> --final  -> set definitivo, solo suavizado, nombres limpios
const FINAL = process.argv.includes('--final');

if (FINAL) {
  for (const [name, fn] of Object.entries(EFFECTS)) {
    _seed = 1337;
    writeWav(join(outDir, `${name}.wav`), fn(true));
    console.log('✓', `${name}.wav`);
  }
  console.log(`\n${Object.keys(EFFECTS).length} efectos (suavizado) → ${outDir}`);
} else {
  const styles = ['sharp', 'soft'];
  for (const [name, fn] of Object.entries(EFFECTS)) {
    for (const style of styles) {
      _seed = 1337; // ruido reproducible entre estilos
      writeWav(join(outDir, `${name}_${style}.wav`), fn(style === 'soft'));
      console.log('✓', `${name}_${style}.wav`);
    }
  }
  console.log(`\n${Object.keys(EFFECTS).length} efectos × ${styles.length} estilos → ${outDir}`);
}
