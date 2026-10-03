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


// ── Recoger del suelo: variantes elegibles en Ajustes → Sonido (pickup_1..6) ──
// 1 pop: burbuja que sube de tono, cortita.
function pickupPop() {
  const dur = 0.11, env = expEnv(seconds(dur), 0.035);
  return lowpass(make(dur, (i, c) => c.osc(i, lerp(320, 950, Math.sqrt(i / c.n)), sine) * env[i] * 0.6), 5000);
}
// 2 blip: dos notitas ascendentes muy rápidas.
function pickupBlip() {
  const dur = 0.14, n = seconds(dur), half = n / 2;
  return lowpass(make(dur, (i, c) => {
    const local = (i % half) / half;
    return c.osc(i, i < half ? 880 : 1175, triangle) * Math.exp(-local * 6) * 0.45;
  }), 4500);
}
// 3 swoosh: soplido de ruido que se "traga" el objeto + tick final.
function pickupSwoosh() {
  const dur = 0.18, n = seconds(dur);
  const buf = make(dur, (i, c) => {
    const t = i / c.n;
    const air = noise() * Math.sin(Math.PI * Math.min(1, t / 0.8)) * 0.5;
    const tick = t > 0.8 ? c.osc(i, 1400, sine) * Math.exp(-(t - 0.8) * 40) * 0.5 : 0;
    return air + tick;
  });
  return lowpass(buf, 3000);
}
// 4 pluck: cuerda pulsada suave (fundamental + octava).
function pickupPluck() {
  const dur = 0.25, env = expEnv(seconds(dur), 0.07);
  let ph = 0;
  return lowpass(make(dur, (i) => { ph += 660 / SR; return (triangle(ph) * 0.6 + sine(ph * 2) * 0.25) * env[i] * 0.6; }), 3500);
}
// 5 chime: campanita (parciales inarmónicos tipo bell).
function pickupChime() {
  const dur = 0.4, env = expEnv(seconds(dur), 0.12);
  let ph = 0;
  return make(dur, (i) => { ph += 1568 / SR; return (sine(ph) * 0.5 + sine(ph * 1.5) * 0.2 + sine(ph * 2.76) * 0.12) * env[i] * 0.5; });
}
// 6 bag: "a la mochila" — golpe sordo de cuero, grave y corto.
function pickupBag() {
  const dur = 0.13, env = expEnv(seconds(dur), 0.03);
  return lowpass(make(dur, (i, c) => {
    const t = i / c.n;
    return (c.osc(i, lerp(170, 90, t), sine) * 0.8 + noise() * Math.pow(1 - t, 4) * 0.35) * env[i] * 0.8;
  }), 1600);
}

const PICKUPS = [pickupPop, pickupBlip, pickupSwoosh, pickupPluck, pickupChime, pickupBag];


// ── Recolección: hacha contra madera (chop_1..4) y pico contra piedra/mena (pick_1..4) ──
// Filtro paso-banda resonante (biquad RBJ): da "cuerpo" de madera hueca o de roca al ruido.
function bandpass(buf, freq, q) {
  const w = TAU * freq / SR, alpha = Math.sin(w) / (2 * q), cw = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = alpha / a0, b2 = -alpha / a0, a1 = -2 * cw / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y;
  }
  return buf;
}
// Ruido blanco con envolvente exponencial (golpe/arenilla).
function noiseBurst(dur, tau, gain = 1) {
  const env = expEnv(seconds(dur), tau);
  return make(dur, (i) => noise() * env[i] * gain);
}
// Suma de capas (de distinta longitud) en un único buffer.
function mix(...layers) {
  const n = Math.max(...layers.map(l => l.length));
  const out = new Float32Array(n);
  for (const l of layers) for (let i = 0; i < l.length; i++) out[i] += l[i];
  return out;
}
// Parciales senoidales con decaimiento propio: [freq, amp, tau][]
function partials(dur, list) {
  const n = seconds(dur);
  return make(dur, (i) => {
    const t = i / SR;
    let s = 0;
    for (const [f, a, tau] of list) s += Math.sin(TAU * f * t) * a * Math.exp(-t / tau);
    return s;
  });
}

// chop 1 · "toc": madera hueca, nudillo seco con resonancia corta.
function chopTok() {
  return lowpass(mix(
    bandpass(noiseBurst(0.16, 0.025, 1.6), 900, 4),
    partials(0.18, [[310, 0.55, 0.045], [720, 0.25, 0.025]]),
    noiseBurst(0.02, 0.003, 0.5),
  ), 4500);
}
// chop 2 · "hachazo": tajo grave y carnoso, más ruido y menos tono.
function chopThwack() {
  return lowpass(mix(
    bandpass(noiseBurst(0.2, 0.04, 2.2), 550, 1.8),
    partials(0.2, [[150, 0.6, 0.05], [95, 0.35, 0.07]]),
    noiseBurst(0.015, 0.002, 0.6),
  ), 3000);
}
// chop 3 · "astilla": golpe + chasquidos de fibras que se rompen.
function chopSplinter() {
  const hit = mix(
    bandpass(noiseBurst(0.12, 0.02, 1.6), 1100, 3),
    partials(0.14, [[380, 0.4, 0.035]]),
  );
  const dur = 0.24, n = seconds(dur);
  const crackle = new Float32Array(n);
  for (let k = 0; k < 9; k++) {                 // impulsos dispersos tras el golpe
    const at = seconds(0.03 + Math.abs(noise()) * 0.17);
    const amp = 0.5 * (1 - at / n);
    for (let j = 0; j < 90 && at + j < n; j++) crackle[at + j] += noise() * amp * Math.exp(-j / 18);
  }
  return lowpass(mix(hit, bandpass(crackle, 2400, 1.5)), 6000);
}
// chop 4 · "tronco": árbol grande, golpe sordo y redondo.
function chopLog() {
  return lowpass(mix(
    partials(0.24, [[200, 0.7, 0.06], [130, 0.4, 0.08], [460, 0.15, 0.03]]),
    bandpass(noiseBurst(0.15, 0.03, 1.4), 400, 2),
  ), 1800);
}

// pick 1 · "clinc": metal contra roca, brillante con un poco de cola.
function pickClink() {
  return mix(
    partials(0.3, [[2350, 0.32, 0.06], [3610, 0.18, 0.04], [5230, 0.1, 0.025]]),
    bandpass(noiseBurst(0.08, 0.012, 1.4), 3000, 1.2),
    lowpass(partials(0.12, [[140, 0.5, 0.03]]), 800),
  );
}
// pick 2 · "esquirla": tic corto + gravilla que cae.
function pickChip() {
  const tick = mix(
    partials(0.1, [[2900, 0.3, 0.018], [4400, 0.15, 0.012]]),
    bandpass(noiseBurst(0.05, 0.008, 1.5), 3500, 1.5),
  );
  const dur = 0.3, n = seconds(dur);
  const gravel = new Float32Array(n);
  for (let k = 0; k < 14; k++) {                // piedrecitas rebotando
    const at = seconds(0.04 + Math.abs(noise()) * 0.22);
    const amp = 0.35 * (1 - at / n);
    for (let j = 0; j < 60 && at + j < n; j++) gravel[at + j] += noise() * amp * Math.exp(-j / 10);
  }
  return mix(tick, lowpass(bandpass(gravel, 1800, 1.2), 5000));
}
// pick 3 · "crunch": roca que cede, grave y terroso, apenas metal.
function pickCrunch() {
  return lowpass(mix(
    partials(0.18, [[120, 0.6, 0.04], [1900, 0.12, 0.02]]),
    bandpass(noiseBurst(0.18, 0.035, 2), 1200, 1.1),
    noiseBurst(0.015, 0.002, 0.5),
  ), 3500);
}
// pick 4 · "ping": mena/cristal que suena casi a campana (más tonal).
function pickPing() {
  return mix(
    partials(0.45, [[1760, 0.3, 0.12], [2650, 0.16, 0.08], [4120, 0.08, 0.05]]),
    bandpass(noiseBurst(0.04, 0.006, 1.2), 2800, 1.5),
    lowpass(partials(0.1, [[160, 0.4, 0.025]]), 800),
  );
}

const HARVEST = {
  chop: [chopTok, chopThwack, chopSplinter, chopLog],
  pick: [pickClink, pickChip, pickCrunch, pickPing],
};

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

//   node gen.mjs <outDir> --pickups -> solo las variantes de recoger (pickup_1..6.wav)
if (process.argv.includes('--pickups')) {
  PICKUPS.forEach((fn, i) => {
    _seed = 1337;
    const file = `pickup_${i + 1}.wav`;
    writeWav(join(outDir, file), fn());
    console.log('✓', file);
  });
  process.exit(0);
}

//   node gen.mjs <outDir> --harvest -> recolección: chop_1..4 (madera) y pick_1..4 (piedra/mena)
if (process.argv.includes('--harvest')) {
  for (const [prefix, list] of Object.entries(HARVEST)) {
    list.forEach((fn, i) => {
      _seed = 1337 + i * 101;
      const file = `${prefix}_${i + 1}.wav`;
      const buf = fn();
      let peak = 0;                              // mismo pico en todas: comparables a oído
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      if (peak > 0) for (let k = 0; k < buf.length; k++) buf[k] *= 0.85 / peak;
      writeWav(join(outDir, file), buf);
      console.log('✓', file);
    });
  }
  process.exit(0);
}

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
