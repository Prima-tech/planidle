// Globo 3D de la Tierra (vista detalle del panel del mapa del mundo).
//
// Esfera ortográfica de verdad (no una textura que se desliza bajo una máscara),
// dibujada en Canvas 2D por EarthGlobe.draw() sobre una CanvasTexture de Phaser.
// Tres CAPAS que comparten el MISMO terreno (mapa de alturas procedural sobre la
// esfera, semilla fija) para que los continentes coincidan al cambiar de capa:
//  - 'base':    mundo de bolsillo (toon, árboles/castillo/banderas que asoman)
//  - 'economy': tablero hexagonal geodésico con relieve
//  - 'war':     proyección táctica (holograma de puntos, meridianos, radar)
//
// Sin dependencias de Phaser: la escena solo le pasa contexto, tamaño y rotación.

export type GlobeLayer = 'base' | 'economy' | 'war';

export interface GlobePin {
  name: string;
  mapId: string;
  tx: number;      // coords "de textura" 0..512 (TIERRA_PINS): tx = longitud, ty = latitud
  ty: number;
  home: boolean;
  locked: boolean;
}

export interface GlobeRot { yaw: number; pitch: number; }
/** Pin visible en este frame, en px del canvas. */
export interface GlobeHit { mapId: string; x: number; y: number; }

type V3 = [number, number, number];
interface Rot { cy: number; sy: number; cp: number; sp: number; yaw: number; pitch: number; }
interface PinW extends GlobePin { w: V3; lat: number; lon: number; }

const TAU = Math.PI * 2, PI = Math.PI;
const TEX = 512;

// ── Utilidades ───────────────────────────────────────────────────────────────

function h3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
function fbm(x: number, y: number, z: number, oct: number): number {
  let a = .5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; a *= .5; f *= 2.03; }
  return s / n;
}
const v3 = (lat: number, lon: number): V3 => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
const norm = (p: number[]): V3 => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; };
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function slerp(a: V3, b: V3, t: number): V3 {
  const om = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
  if (om < 1e-5) return a;
  const s = Math.sin(om), k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}
function fib(n: number): V3[] {
  const out: V3[] = [], g = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), a = g * i; out.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  return out;
}
/** tx/ty (0..512) → lat/lon. tx crece hacia el este; ty hacia el sur. */
function texToLatLon(tx: number, ty: number): { lat: number; lon: number } {
  return { lon: (tx / TEX) * TAU - PI, lat: PI / 2 - (ty / TEX) * PI };
}
/** Rotación que deja el punto tx/ty en el centro de la cara visible. */
export function rotFacing(tx: number, ty: number): GlobeRot {
  const { lat, lon } = texToLatLon(tx, ty);
  return { yaw: -lon, pitch: lat };
}

// ── Terreno compartido por las 3 capas ──────────────────────────────────────
// 0 fondo · 1 costa · 2 arena · 3 pradera · 4 bosque · 5 desierto · 6 roca · 7 nieve · 8 banquisa
const W = 512, H = 256;
let HT: Float32Array, TY: Uint8Array, COAST: Uint8Array, MO: Float32Array;

/** Tipo de terreno a partir de altura, humedad y latitud (globo y mapa plano). */
// Este mundo NO tiene nieve ni banquisa (tipos 7/8 sin uso): las cumbres son roca
// y los polos siguen la regla normal de su altura/humedad.
function classify(h: number, m: number, lat: number): number {
  const al = Math.abs(lat);
  if (h < 0) return h < -.16 ? 0 : 1;
  if (h > .34) return 6;
  if (h < .035) return 2;
  if (m < .45 && al < .7) return 5;
  if (m > .52) return 4;
  return 3;
}

/** Se genera UNA vez (la posición de los pines levanta tierra bajo ellos y a lo
 *  largo de la ruta, para que el camino vaya siempre por un continente). */
function ensureTerrain(pins: PinW[]): void {
  if (HT) return;
  HT = new Float32Array(W * H); MO = new Float32Array(W * H); TY = new Uint8Array(W * H); COAST = new Uint8Array(W * H);
  const bumps: V3[] = [];
  for (let i = 0; i < pins.length - 1; i++) for (let s = 0; s <= 6; s++) bumps.push(slerp(pins[i].w, pins[i + 1].w, s / 6));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const lat = PI / 2 - (j + .5) / H * PI, lon = (i + .5) / W * TAU - PI, w = v3(lat, lon);
    let h = (fbm(w[0] * 1.7 + 3.1, w[1] * 1.7 + 7.7, w[2] * 1.7 + 1.3, 5) - .5) * 2.6 - .07;
    for (const p of pins) { const d2 = (w[0] - p.w[0]) ** 2 + (w[1] - p.w[1]) ** 2 + (w[2] - p.w[2]) ** 2; h += .2 * Math.exp(-d2 / .03); }
    for (const b of bumps) { const d2 = (w[0] - b[0]) ** 2 + (w[1] - b[1]) ** 2 + (w[2] - b[2]) ** 2; if (d2 < .05) h += .1 * Math.exp(-d2 / .012); }
    const m = fbm(w[0] * 2.3 + 20, w[1] * 2.3 + 20, w[2] * 2.3 + 20, 4), k = j * W + i;
    HT[k] = h;
    MO[k] = m;
    TY[k] = classify(h, m, lat);
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, s = HT[k] >= 0, r = j * W + (i + 1) % W, d = j < H - 1 ? k + W : k;
    COAST[k] = ((HT[r] >= 0) !== s || (HT[d] >= 0) !== s) ? 1 : 0;
  }
}
function idxOf(lat: number, lon: number): number {
  let i = ((lon + PI) / TAU * W) | 0; if (i >= W) i = W - 1; if (i < 0) i = 0;
  let j = ((PI / 2 - lat) / PI * H) | 0; if (j >= H) j = H - 1; if (j < 0) j = 0;
  return j * W + i;
}
const idxW = (w: V3) => idxOf(Math.asin(Math.max(-1, Math.min(1, w[1]))), Math.atan2(w[0], w[2]));

// ── Proyección ──────────────────────────────────────────────────────────────
const L = norm([-.5, .55, .7]);
function rotPre(r: GlobeRot): Rot {
  return { yaw: r.yaw, pitch: r.pitch, cy: Math.cos(r.yaw), sy: Math.sin(r.yaw), cp: Math.cos(r.pitch), sp: Math.sin(r.pitch) };
}
function proj(w: number[], r: Rot): V3 {
  const x = w[0] * r.cy + w[2] * r.sy, z0 = -w[0] * r.sy + w[2] * r.cy;
  return [x, w[1] * r.cp - z0 * r.sp, w[1] * r.sp + z0 * r.cp];
}
interface Buf { c: HTMLCanvasElement; x: CanvasRenderingContext2D; img: ImageData; N: number; }
function makeBuf(N: number): Buf {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d')!;
  return { c, x, img: x.createImageData(N, N), N };
}
type Shade = (d: Uint8ClampedArray, o: number, x: number, y: number, z: number, lat: number, lon: number, i: number) => void;
/** Rasteriza el disco píxel a píxel: para cada punto visible calcula su lat/lon. */
function raster(B: Buf, r: Rot, shade: Shade): void {
  const N = B.N, d = B.img.data, half = N / 2;
  for (let py = 0; py < N; py++) {
    const y = -(py + .5 - half) / half;
    for (let px = 0; px < N; px++) {
      const x = (px + .5 - half) / half, o = (py * N + px) << 2, r2 = x * x + y * y;
      if (r2 >= 1) { d[o + 3] = 0; continue; }
      const z = Math.sqrt(1 - r2);
      const y1 = y * r.cp + z * r.sp, z1 = -y * r.sp + z * r.cp;
      const wx = x * r.cy - z1 * r.sy, wz = x * r.sy + z1 * r.cy;
      const lat = Math.asin(y1), lon = Math.atan2(wx, wz);
      shade(d, o, x, y, z, lat, lon, idxOf(lat, lon));
      d[o + 3] = 255;
    }
  }
  B.x.putImageData(B.img, 0, 0);
}
/** Polilínea por la superficie, cortada donde pasa por detrás. */
function tracePath(ctx: CanvasRenderingContext2D, pts: V3[], r: Rot, cx: number, cy: number, R: number, s = 1, minZ = 0): void {
  ctx.beginPath(); let pen = false;
  for (const w of pts) {
    const p = proj(w, r);
    if (p[2] < minZ) { pen = false; continue; }
    const x = cx + p[0] * R * s, y = cy - p[1] * R * s;
    if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    pen = true;
  }
}
function outlinedText(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, fill: string, stroke: string, lw: number): void {
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}

// ── Datos estáticos por capa (perezosos, una vez) ───────────────────────────

interface HexTile { p: V3; poly: V3[]; t: number; }
let HEX: HexTile[] | null = null;
/** Esfera geodésica: icosaedro subdividido; cada vértice es una casilla (hexágono,
 *  o pentágono en los 12 vértices originales) formada por los centroides vecinos. */
function ensureHex(): HexTile[] {
  if (HEX) return HEX;
  const f = 12, g = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]].map(norm);
  const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const verts: V3[] = [], key = new Map<string, number>(), tris: number[][] = [];
  const vid = (p: number[]) => {
    const n = norm(p), k = n.map(v => Math.round(v * 1e5)).join(',');
    let id = key.get(k);
    if (id === undefined) { id = verts.length; verts.push(n); key.set(k, id); }
    return id;
  };
  for (const [a, b, c] of F) {
    const A = V[a], B = V[b], C = V[c], gr: number[][] = [];
    for (let i = 0; i <= f; i++) {
      gr[i] = [];
      for (let j = 0; j <= f - i; j++) { const k = f - i - j; gr[i][j] = vid([0, 1, 2].map(q => (A[q] * k + B[q] * i + C[q] * j) / f)); }
    }
    for (let i = 0; i < f; i++) for (let j = 0; j < f - i; j++) {
      tris.push([gr[i][j], gr[i + 1][j], gr[i][j + 1]]);
      if (j < f - i - 1) tris.push([gr[i + 1][j], gr[i + 1][j + 1], gr[i][j + 1]]);
    }
  }
  const adj: V3[][] = verts.map(() => []);
  for (const tr of tris) {
    const c = norm([0, 1, 2].map(q => verts[tr[0]][q] + verts[tr[1]][q] + verts[tr[2]][q]));
    tr.forEach(v => adj[v].push(c));
  }
  HEX = verts.map((p, i) => {
    const e1 = norm(cross(Math.abs(p[1]) < .9 ? [0, 1, 0] : [1, 0, 0], p)), e2 = cross(p, e1);
    const poly = adj[i].slice().sort((a, b) => Math.atan2(dot(a, e2), dot(a, e1)) - Math.atan2(dot(b, e2), dot(b, e1)));
    return { p, poly, t: TY[idxW(p)] };
  });
  return HEX;
}

interface Dot { w: V3; lon: number; coast: boolean; }
let DOTS: Dot[] | null = null;
let GRAT: V3[][] | null = null;
function ensureHolo(): void {
  if (DOTS) return;
  DOTS = fib(9000).filter(w => HT[idxW(w)] >= 0).map(w => ({ w, lon: Math.atan2(w[0], w[2]), coast: !!COAST[idxW(w)] }));
  GRAT = [];
  for (let la = -60; la <= 60; la += 20) { const pts: V3[] = []; for (let k = 0; k <= 96; k++) pts.push(v3(la * PI / 180, k / 96 * TAU)); GRAT.push(pts); }
  for (let lo = 0; lo < 360; lo += 20) { const pts: V3[] = []; for (let k = 0; k <= 48; k++) pts.push(v3(-PI / 2 + k / 48 * PI, lo * PI / 180)); GRAT.push(pts); }
}

type PropKind = 'tree' | 'pine' | 'rock' | 'cactus' | 'castle' | 'flag';
interface Prop { w: V3; k: PropKind; pin?: PinW; ll?: [number, number]; }
let SCENERY: Prop[] | null = null;
function ensureScenery(pins: PinW[]): Prop[] {
  if (SCENERY) return SCENERY;
  SCENERY = [];
  fib(5200).forEach((w, k) => {
    if (pins.some(p => dot(p.w, w) > .9965)) return;   // despejado alrededor de los mapas
    const t = TY[idxW(w)], rnd = h3(k, 4, 2);
    if (t === 4 && rnd < .5) SCENERY.push({ w, k: 'tree' });
    else if (t === 3 && rnd < .06) SCENERY.push({ w, k: 'tree' });
    else if (t === 6 && rnd < .3) SCENERY.push({ w, k: 'rock' });
    else if (t === 6 && rnd < .42) SCENERY.push({ w, k: 'pine' });
    else if (t === 5 && rnd < .05) SCENERY.push({ w, k: 'cactus' });
  });
  return SCENERY;
}

// ── Paletas ─────────────────────────────────────────────────────────────────
const PAL_TOON = [[72, 142, 214], [112, 192, 232], [250, 226, 160], [128, 204, 92], [92, 176, 86], [242, 204, 124], [176, 156, 140], [255, 255, 255], [232, 246, 255]];
const HEX_COL = [[43, 93, 138], [63, 134, 184], [232, 212, 154], [121, 184, 90], [63, 138, 74], [224, 184, 112], [154, 143, 128], [244, 246, 248], [216, 232, 244]];
const HEX_ELEV = [1, 1.004, 1.014, 1.026, 1.036, 1.022, 1.056, 1.066, 1.006];
const OUT = '#2b2546';
const CY = '95,245,214';

// ════════════════════════════════════════════════════════════════════════════

export class EarthGlobe {
  private readonly pins: PinW[];
  private readonly openRoute: V3[][] = [];    // tramos entre mapas desbloqueados consecutivos
  private readonly lockedRoute: V3[][] = [];  // tramos que tocan un mapa bloqueado
  private buf: Buf | null = null;
  private props: Prop[] = [];

  constructor(pins: GlobePin[]) {
    this.pins = pins.map(p => {
      const { lat, lon } = texToLatLon(p.tx, p.ty);
      return { ...p, w: v3(lat, lon), lat, lon };
    });
    ensureTerrain(this.pins);
    for (let i = 0; i < this.pins.length - 1; i++) {
      const a = this.pins[i], b = this.pins[i + 1], seg: V3[] = [];
      for (let s = 0; s <= 18; s++) seg.push(slerp(a.w, b.w, s / 18));
      (a.locked || b.locked ? this.lockedRoute : this.openRoute).push(seg);
    }
    // Banderas/castillo dependen del estado de bloqueo actual → se rehacen por instancia
    this.props = [
      ...ensureScenery(this.pins),
      ...this.pins.map(p => ({ w: p.w, k: (p.home ? 'castle' : 'flag') as PropKind, pin: p })),
    ];
  }

  /** Dibuja la capa en un canvas w×h con el globo de radio R centrado (o, con `flat`,
   *  el mapa plano equirectangular centrado en el mismo punto, a R px por radián).
   *  Devuelve los pines visibles (para colocar las zonas de toque). */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, R: number, rot: GlobeRot, t: number,
       layer: GlobeLayer, dpr: number, debugGrid: boolean, flat = false): GlobeHit[] {
    ctx.clearRect(0, 0, w, h);
    const r = rotPre(rot);
    if (flat) {
      const fh = this.drawFlat(ctx, w, h, R, r, t, layer, dpr);
      if (debugGrid) this.drawFlatDebugGrid(ctx, w, h, R, r, dpr);
      return fh;
    }
    let hits: GlobeHit[];
    if (layer === 'economy') hits = this.drawHex(ctx, w, h, R, r, t, dpr);
    else if (layer === 'war') hits = this.drawHolo(ctx, w, h, R, r, t, dpr);
    else hits = this.drawToon(ctx, w, h, R, r, t, dpr);
    if (debugGrid) this.drawDebugGrid(ctx, w, h, R, r, dpr);
    return hits;
  }

  // ── Capa base: mundo de bolsillo ──────────────────────────────────────────
  private drawToon(ctx: CanvasRenderingContext2D, w: number, h: number, R: number, r: Rot, t: number, dpr: number): GlobeHit[] {
    const N = Math.min(360, Math.max(120, Math.round(R)));
    if (!this.buf || this.buf.N !== N) this.buf = makeBuf(N);
    const cx = w / 2, cy = h / 2, s = R * .05;

    const placed = this.props.map(pr => ({ pr, v: proj(pr.w, r) })).filter(o => o.v[2] > -.3);
    placed.sort((a, b) => a.v[2] - b.v[2]);
    // Cada prop se planta en su punto de la superficie, orientado a la normal en
    // pantalla: en el borde se ve de perfil y asoma por la silueta del planeta.
    const putProp = ({ pr, v }: { pr: Prop; v: V3 }) => {
      const x = cx + v[0] * R, y = cy - v[1] * R, len = Math.hypot(v[0], v[1]);
      const ux = len > .01 ? v[0] / len : 0, uy = len > .01 ? v[1] / len : 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ux, uy)); ctx.scale(1, .3 + .7 * len);
      this.propShape(ctx, pr.k, s, pr.pin); ctx.restore();
    };

    // Lo que está detrás pero asoma por el borde se pinta ANTES: el globo lo tapa.
    placed.filter(o => o.v[2] < 0).forEach(putProp);

    raster(this.buf, r, (d, o, x, y, z, _lat, _lon, i) => {
      let c = PAL_TOON[TY[i]];
      if (COAST[i]) c = HT[i] < 0 ? [244, 252, 255] : [96, 150, 80];
      const lit = x * L[0] + y * L[1] + z * L[2];
      const b = lit > .38 ? 1 : lit > -.05 ? .8 : .6, sh = b === 1 ? 0 : b === .8 ? .18 : .4;
      d[o] = mix(c[0] * b, 90, sh); d[o + 1] = mix(c[1] * b, 76, sh); d[o + 2] = mix(c[2] * b, 170, sh);
    });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.buf.c, cx - R, cy - R, 2 * R, 2 * R);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    ctx.lineCap = 'round'; ctx.setLineDash([.1, 7 * dpr]);
    ctx.strokeStyle = OUT; ctx.lineWidth = 6 * dpr;
    for (const seg of this.openRoute) { tracePath(ctx, seg, r, cx, cy, R, 1, .03); ctx.stroke(); }
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3.5 * dpr;
    for (const seg of this.openRoute) { tracePath(ctx, seg, r, cx, cy, R, 1, .03); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(43,37,70,.45)'; ctx.lineWidth = 3 * dpr;
    for (const seg of this.lockedRoute) { tracePath(ctx, seg, r, cx, cy, R, 1, .03); ctx.stroke(); }
    ctx.setLineDash([]);

    placed.filter(o => o.v[2] >= 0).forEach(putProp);

    const hits: GlobeHit[] = [];
    ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const p of this.pins) {
      const v = proj(p.w, r); if (v[2] < .05) continue;
      const x = cx + v[0] * R, y = cy - v[1] * R;
      if (v[2] > .15) outlinedText(ctx, p.name, x, y - s * (p.home ? 3.1 : 2.3), p.locked ? '#b8b4c8' : '#fff', OUT, 4 * dpr);
      if (!p.locked) hits.push({ mapId: p.mapId, x, y: y - s });
    }
    return hits;
  }

  private propShape(ctx: CanvasRenderingContext2D, k: PropKind, s: number, pin?: PinW): void {
    ctx.lineWidth = s * .14; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
    const shape = (fill: string, path: () => void) => { ctx.beginPath(); path(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
    if (k === 'tree') {
      shape('#8a5a36', () => ctx.rect(-s * .12, -s * .55, s * .24, s * .55));
      shape('#5cbf4e', () => ctx.arc(0, -s * .95, s * .5, 0, TAU));
      ctx.fillStyle = 'rgba(30,80,40,.35)'; ctx.beginPath(); ctx.arc(0, -s * .95, s * .43, .2, PI - .2); ctx.fill();
    } else if (k === 'pine') {
      shape('#3f8f6a', () => { ctx.moveTo(-s * .45, -s * .2); ctx.lineTo(0, -s * 1.6); ctx.lineTo(s * .45, -s * .2); ctx.closePath(); });
    } else if (k === 'rock') {
      shape('#a99a8e', () => { ctx.moveTo(-s * .5, 0); ctx.lineTo(-s * .3, -s * .55); ctx.lineTo(s * .1, -s * .7); ctx.lineTo(s * .5, -s * .3); ctx.lineTo(s * .45, 0); ctx.closePath(); });
    } else if (k === 'cactus') {
      shape('#5aa65a', () => ctx.rect(-s * .12, -s * 1.1, s * .24, s * 1.1));
      shape('#5aa65a', () => ctx.rect(s * .12, -s * .75, s * .25, s * .14));
    } else if (k === 'castle') {
      const c = s * 1.7;
      shape('#d9d2e6', () => ctx.rect(-c * .5, -c * .7, c, c * .7));
      shape('#c4bcd6', () => ctx.rect(-c * .7, -c * 1.05, c * .32, c * 1.05));
      shape('#c4bcd6', () => ctx.rect(c * .38, -c * 1.05, c * .32, c * 1.05));
      shape('#e05a4f', () => { ctx.moveTo(-c * .75, -c * 1.05); ctx.lineTo(-c * .54, -c * 1.4); ctx.lineTo(-c * .33, -c * 1.05); ctx.closePath(); });
      shape('#e05a4f', () => { ctx.moveTo(c * .33, -c * 1.05); ctx.lineTo(c * .54, -c * 1.4); ctx.lineTo(c * .75, -c * 1.05); ctx.closePath(); });
      shape('#6b4a3a', () => { ctx.moveTo(-c * .14, 0); ctx.lineTo(-c * .14, -c * .3); ctx.arc(0, -c * .3, c * .14, PI, 0); ctx.lineTo(c * .14, 0); ctx.closePath(); });
      shape('#f0c040', () => { ctx.moveTo(0, -c * .7); ctx.lineTo(0, -c * 1.25); ctx.lineTo(c * .3, -c * 1.12); ctx.lineTo(0, -c * 1.02); });
    } else if (k === 'flag') {
      shape('#e8e2d0', () => ctx.rect(-s * .06, -s * 1.6, s * .12, s * 1.6));
      shape(pin?.locked ? '#9a98aa' : '#4fb3f0', () => { ctx.moveTo(s * .06, -s * 1.6); ctx.lineTo(s * .75, -s * 1.38); ctx.lineTo(s * .06, -s * 1.12); ctx.closePath(); });
    }
  }

  // ── Capa economía: tablero hexagonal ──────────────────────────────────────
  private drawHex(ctx: CanvasRenderingContext2D, w: number, h: number, R: number, r: Rot, t: number, dpr: number): GlobeHit[] {
    const tiles = ensureHex(), cx = w / 2, cy = h / 2;
    const pinTile = new Map<HexTile, PinW>();
    for (const pin of this.pins) {
      let best: HexTile = tiles[0], bd = -2;
      for (const tile of tiles) { const d = dot(tile.p, pin.w); if (d > bd) { bd = d; best = tile; } }
      pinTile.set(best, pin);
    }
    const vis: { z: number; tile: HexTile; c: V3 }[] = [];
    for (const tile of tiles) { const c = proj(tile.p, r); if (c[2] > -.08) vis.push({ z: c[2], tile, c }); }
    vis.sort((a, b) => a.z - b.z);

    ctx.lineJoin = 'round';
    for (const { tile, c } of vis) {
      const pin = pinTile.get(tile);
      const e = pin ? (pin.locked ? 1.045 : 1.075) : HEX_ELEV[tile.t];
      const lit = Math.max(0, c[0] * L[0] + c[1] * L[1] + c[2] * L[2]);
      let col = pin ? (pin.home ? [240, 192, 64] : pin.locked ? [120, 124, 140] : [91, 192, 248]) : HEX_COL[tile.t];
      if (tile.t <= 1 && !pin) { const wv = .04 * Math.sin(t * 1.6 + tile.p[0] * 9 + tile.p[2] * 7); col = col.map(v => v * (1 + wv)); }
      const top = tile.poly.map(q => { const v = proj(q, r); return [cx + v[0] * R * e, cy - v[1] * R * e]; });
      if (e > 1.008) {
        // Paredes del prisma (relieve) antes de la tapa
        const base = tile.poly.map(q => { const v = proj(q, r); return [cx + v[0] * R, cy - v[1] * R]; });
        const k = .42 + .3 * lit;
        ctx.fillStyle = `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`;
        for (let a = 0; a < top.length; a++) {
          const b = (a + 1) % top.length;
          ctx.beginPath(); ctx.moveTo(base[a][0], base[a][1]); ctx.lineTo(base[b][0], base[b][1]); ctx.lineTo(top[b][0], top[b][1]); ctx.lineTo(top[a][0], top[a][1]); ctx.fill();
        }
      }
      const k = .55 + .55 * lit;
      ctx.beginPath(); top.forEach(([x, y], a) => a ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.fillStyle = `rgb(${Math.min(255, col[0] * k) | 0},${Math.min(255, col[1] * k) | 0},${Math.min(255, col[2] * k) | 0})`; ctx.fill();
      ctx.strokeStyle = 'rgba(10,20,30,.28)'; ctx.lineWidth = .8 * dpr; ctx.stroke();
    }

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 5 * dpr;
    for (const seg of this.openRoute) { tracePath(ctx, seg, r, cx, cy, R, 1.08, .05); ctx.stroke(); }
    ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 3 * dpr;
    for (const seg of this.openRoute) { tracePath(ctx, seg, r, cx, cy, R, 1.08, .05); ctx.stroke(); }
    ctx.setLineDash([3 * dpr, 5 * dpr]); ctx.strokeStyle = 'rgba(200,205,220,.5)'; ctx.lineWidth = 2 * dpr;
    for (const seg of this.lockedRoute) { tracePath(ctx, seg, r, cx, cy, R, 1.06, .05); ctx.stroke(); }
    ctx.setLineDash([]);

    const hits: GlobeHit[] = [];
    ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const p of this.pins) {
      const v = proj(p.w, r); if (v[2] < .08) continue;
      const e = p.locked ? 1.045 : 1.075, x = cx + v[0] * R * e, y = cy - v[1] * R * e;
      outlinedText(ctx, p.name, x, y - 9 * dpr, p.home ? '#ffe7a0' : p.locked ? '#a8acb8' : '#fff', 'rgba(10,16,26,.85)', 3.5 * dpr);
      if (!p.locked) hits.push({ mapId: p.mapId, x, y });
    }
    return hits;
  }

  // ── Capa guerra: proyección táctica ───────────────────────────────────────
  private drawHolo(ctx: CanvasRenderingContext2D, w: number, h: number, R: number, r: Rot, t: number, dpr: number): GlobeHit[] {
    ensureHolo();
    const cx = w / 2, cy = h / 2;
    const bg = ctx.createRadialGradient(cx, cy, R * .2, cx, cy, R * 1.4);
    bg.addColorStop(0, 'rgba(40,140,120,.25)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // Retícula: delante y detrás en dos trazos (detrás casi transparente)
    const front = new Path2D(), back = new Path2D();
    for (const pts of GRAT) {
      let prev: number[] | null = null;
      for (const w of pts) {
        const p = proj(w, r), x = cx + p[0] * R, y = cy - p[1] * R;
        if (prev) { const path = p[2] > 0 ? front : back; path.moveTo(prev[0], prev[1]); path.lineTo(x, y); }
        prev = [x, y];
      }
    }
    ctx.lineWidth = dpr;
    ctx.strokeStyle = `rgba(${CY},.05)`; ctx.stroke(back);
    ctx.strokeStyle = `rgba(${CY},.2)`; ctx.stroke(front);

    // Puntos de tierra agrupados por brillo (8 niveles → 8 rellenos por frame)
    const sweep = (t * .7) % TAU - PI, sz = 1.6 * dpr;
    const levels: Path2D[] = Array.from({ length: 8 }, () => new Path2D());
    for (const d of DOTS) {
      const p = proj(d.w, r);
      let a = p[2] > 0 ? .25 + .6 * p[2] : .06;
      let dl = sweep - d.lon; dl -= Math.round(dl / TAU) * TAU;
      if (dl > 0 && dl < .5 && p[2] > 0) a = Math.min(1, a + (.5 - dl) * 1.6);
      if (d.coast) a = Math.min(1, a * 1.5);
      levels[Math.min(7, (a * 8) | 0)].rect(cx + p[0] * R - sz / 2, cy - p[1] * R - sz / 2, sz, sz);
    }
    levels.forEach((path, i) => { ctx.fillStyle = `rgba(${CY},${(i + .5) / 8})`; ctx.fill(path); });

    ctx.strokeStyle = `rgba(${CY},.7)`; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .15);
    ctx.strokeStyle = `rgba(${CY},.45)`; ctx.lineWidth = dpr; ctx.beginPath();
    for (let k = 0; k < 120; k++) {
      const a = k / 120 * TAU, l = (k % 10 ? 4 : 10) * dpr;
      ctx.moveTo(Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12); ctx.lineTo(Math.cos(a) * (R * 1.12 + l), Math.sin(a) * (R * 1.12 + l));
    }
    ctx.stroke();
    ctx.lineWidth = 2.5 * dpr; ctx.strokeStyle = `rgba(${CY},.8)`;
    [0, PI * .66, PI * 1.33].forEach(a0 => { ctx.beginPath(); ctx.arc(0, 0, R * 1.2, a0, a0 + .5); ctx.stroke(); });
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${CY},.25)`; ctx.lineWidth = 7 * dpr;
    for (const seg of this.openRoute) { tracePath(ctx, seg, r, cx, cy, R); ctx.stroke(); }
    ctx.strokeStyle = `rgba(${CY},1)`; ctx.lineWidth = 1.8 * dpr;
    for (const seg of this.openRoute) { tracePath(ctx, seg, r, cx, cy, R); ctx.stroke(); }
    ctx.setLineDash([2 * dpr, 4 * dpr]); ctx.strokeStyle = `rgba(${CY},.35)`; ctx.lineWidth = 1.2 * dpr;
    for (const seg of this.lockedRoute) { tracePath(ctx, seg, r, cx, cy, R); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';

    const hits: GlobeHit[] = [];
    ctx.font = `${Math.round(11 * dpr)}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    this.pins.forEach((p, i) => {
      const v = proj(p.w, r), x = cx + v[0] * R, y = cy - v[1] * R;
      if (v[2] < 0) { ctx.strokeStyle = `rgba(${CY},.15)`; ctx.lineWidth = dpr; ctx.strokeRect(x - 2 * dpr, y - 2 * dpr, 4 * dpr, 4 * dpr); return; }
      const col = p.home ? '255,200,90' : p.locked ? '90,130,122' : CY, s = (p.home ? 5 : 4) * dpr;
      if (!p.locked) {
        const ph = (t * .8 + i * .17) % 1;
        ctx.strokeStyle = `rgba(${col},${1 - ph})`; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(x, y, s + ph * 14 * dpr, 0, TAU); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
      if (p.locked) { ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = 1.2 * dpr; ctx.stroke(); } else { ctx.fillStyle = `rgba(${col},1)`; ctx.fill(); }
      if (v[2] > .25) { ctx.fillStyle = `rgba(${col},.95)`; ctx.fillText(p.name.toUpperCase(), x + 8 * dpr, y - 6 * dpr); }
      if (!p.locked && v[2] > .05) hits.push({ mapId: p.mapId, x, y });
    });

    // Lecturas numéricas bajo el anillo HUD (sin texto: no requieren traducción).
    // Van pegadas al globo (no a las esquinas) para no chocar con los botones del panel.
    const deg = (a: number) => ((a * 180 / PI) % 360 + 540) % 360 - 180;
    const open = this.pins.filter(p => !p.locked).length;
    ctx.fillStyle = `rgba(${CY},.85)`; ctx.font = `${Math.round(11 * dpr)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${deg(-r.yaw).toFixed(1)}°  ${deg(r.pitch).toFixed(1)}°  ·  ${open}/${this.pins.length}`,
      cx, cy + R * 1.2 + 26 * dpr);
    return hits;
  }

  // ════════════════════════════════════════════════════════════════════════
  // MAPA PLANO (equirectangular). Mismo centro y escala que el globo: a R px por
  // radián alrededor del punto que mira el globo → al alternar no se pierde el sitio.
  // El fondo de cada capa es una textura precalculada (una vez); por frame solo se
  // pintan ruta, pines y adornos encima.
  // ════════════════════════════════════════════════════════════════════════

  private flatPinHex: Map<string, FlatHexCell> | null = null;

  private drawFlat(ctx: CanvasRenderingContext2D, w: number, h: number, R: number, r: Rot, t: number,
                   layer: GlobeLayer, dpr: number): GlobeHit[] {
    const v = flatView(w, h, R, r);
    const tex = layer === 'economy' ? flatHexTex() : layer === 'war' ? flatWarTex() : flatBaseTex();
    ctx.imageSmoothingEnabled = true;
    // Si el mundo entero cabe (vista estática encajada) se pinta una sola copia; si
    // no, se repite en horizontal tantas veces como quepan en pantalla
    if (v.mapW <= w + 1) ctx.drawImage(tex, v.cx - v.mapW / 2 - wrapPI(v.lonC) * v.k, v.y0, v.mapW, v.mapH);
    else for (let x = v.tileStart; x < w; x += v.mapW) ctx.drawImage(tex, x, v.y0, v.mapW + 1, v.mapH);
    if (layer === 'economy') return this.flatHexOverlay(ctx, v, dpr);
    if (layer === 'war') return this.flatWarOverlay(ctx, v, t, dpr);
    return this.flatBaseOverlay(ctx, v, dpr);
  }

  /** Traza los tramos de ruta en plano (corta donde cruzan el borde del mundo). */
  private traceFlat(ctx: CanvasRenderingContext2D, v: FlatView, segs: V3[][], dy = 0): void {
    ctx.beginPath();
    for (const seg of segs) {
      let px = NaN;
      for (const p of seg) {
        const [x, y] = fpos(v, Math.asin(Math.max(-1, Math.min(1, p[1]))), Math.atan2(p[0], p[2]));
        if (isNaN(px) || Math.abs(x - px) > v.mapW / 2) ctx.moveTo(x, y + dy); else ctx.lineTo(x, y + dy);
        px = x;
      }
    }
  }

  private flatBaseOverlay(ctx: CanvasRenderingContext2D, v: FlatView, dpr: number): GlobeHit[] {
    const s = v.k * .05;
    ctx.lineCap = 'round'; ctx.setLineDash([.1, 7 * dpr]);
    ctx.strokeStyle = OUT; ctx.lineWidth = 6 * dpr; this.traceFlat(ctx, v, this.openRoute); ctx.stroke();
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3.5 * dpr; this.traceFlat(ctx, v, this.openRoute); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,37,70,.45)'; ctx.lineWidth = 3 * dpr; this.traceFlat(ctx, v, this.lockedRoute); ctx.stroke();
    ctx.setLineDash([]);

    // Árboles, castillo y banderas de pie; los de más abajo tapan a los de arriba
    const vis: { pr: Prop; x: number; y: number }[] = [];
    for (const pr of this.props) {
      const ll = pr.ll ?? (pr.ll = [Math.asin(Math.max(-1, Math.min(1, pr.w[1]))), Math.atan2(pr.w[0], pr.w[2])]);
      const [x, y] = fpos(v, ll[0], ll[1]);
      if (onScreen(v, x, y, s * 4)) vis.push({ pr, x, y });
    }
    vis.sort((a, b) => a.y - b.y);
    for (const o of vis) { ctx.save(); ctx.translate(o.x, o.y); this.propShape(ctx, o.pr.k, s, o.pr.pin); ctx.restore(); }

    const hits: GlobeHit[] = [];
    ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const p of this.pins) {
      const [x, y] = fpos(v, p.lat, p.lon);
      if (!onScreen(v, x, y, 20 * dpr)) continue;
      outlinedText(ctx, p.name, x, y - s * (p.home ? 3.1 : 2.3), p.locked ? '#b8b4c8' : '#fff', OUT, 4 * dpr);
      if (!p.locked) hits.push({ mapId: p.mapId, x, y: y - s });
    }
    return hits;
  }

  private flatHexOverlay(ctx: CanvasRenderingContext2D, v: FlatView, dpr: number): GlobeHit[] {
    const g = flatHexGrid(), sc = v.mapW / FW, rr = g.r * sc;
    if (!this.flatPinHex) {
      // Casilla de cada mapa: la más cercana a su pin (con la costura horizontal)
      this.flatPinHex = new Map();
      for (const p of this.pins) {
        const tx = (p.lon + PI) / TAU * FW, ty = (PI / 2 - p.lat) / PI * FH;
        let best = g.cells[0], bd = Infinity;
        for (const c of g.cells) {
          let dx = Math.abs(c.x - tx); dx = Math.min(dx, FW - dx);
          const d = dx * dx + (c.y - ty) ** 2;
          if (d < bd) { bd = d; best = c; }
        }
        this.flatPinHex.set(p.mapId, best);
      }
    }
    const lift = .07 * g.r * ELEV_K * sc;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 5 * dpr; this.traceFlat(ctx, v, this.openRoute, -lift); ctx.stroke();
    ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 3 * dpr; this.traceFlat(ctx, v, this.openRoute, -lift); ctx.stroke();
    ctx.setLineDash([3 * dpr, 5 * dpr]); ctx.strokeStyle = 'rgba(200,205,220,.5)'; ctx.lineWidth = 2 * dpr;
    this.traceFlat(ctx, v, this.lockedRoute, -lift); ctx.stroke(); ctx.setLineDash([]);

    const hits: GlobeHit[] = [];
    ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const p of this.pins) {
      const c = this.flatPinHex.get(p.mapId);
      const [x, y] = fpos(v, PI / 2 - c.y / FH * PI, c.x / FW * TAU - PI);
      if (!onScreen(v, x, y, rr * 2)) continue;
      const e = (p.locked ? .045 : .075) * g.r * ELEV_K * sc;
      const col = p.home ? [240, 192, 64] : p.locked ? [120, 124, 140] : [91, 192, 248];
      prism(ctx, x, y, rr, e, col, dpr);
      outlinedText(ctx, p.name, x, y - e - rr * .9, p.home ? '#ffe7a0' : p.locked ? '#a8acb8' : '#fff', 'rgba(10,16,26,.85)', 3.5 * dpr);
      if (!p.locked) hits.push({ mapId: p.mapId, x, y: y - e });
    }
    return hits;
  }

  private flatWarOverlay(ctx: CanvasRenderingContext2D, v: FlatView, t: number, dpr: number): GlobeHit[] {
    // Barrido de radar: banda que recorre las longitudes (como el del globo)
    const [sx] = fpos(v, 0, (t * .7) % TAU - PI), bw = .5 * v.k;
    ctx.globalCompositeOperation = 'lighter';
    for (const off of [0, -v.mapW, v.mapW]) {
      const x = sx + off;
      if (x < 0 || x - bw > v.w) continue;
      const g = ctx.createLinearGradient(x - bw, 0, x, 0);
      g.addColorStop(0, `rgba(${CY},0)`); g.addColorStop(1, `rgba(${CY},.28)`);
      ctx.fillStyle = g; ctx.fillRect(x - bw, v.y0, bw, v.mapH);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${CY},.25)`; ctx.lineWidth = 7 * dpr; this.traceFlat(ctx, v, this.openRoute); ctx.stroke();
    ctx.strokeStyle = `rgba(${CY},1)`; ctx.lineWidth = 1.8 * dpr; this.traceFlat(ctx, v, this.openRoute); ctx.stroke();
    ctx.setLineDash([2 * dpr, 4 * dpr]); ctx.strokeStyle = `rgba(${CY},.35)`; ctx.lineWidth = 1.2 * dpr;
    this.traceFlat(ctx, v, this.lockedRoute); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';

    const hits: GlobeHit[] = [];
    ctx.font = `${Math.round(11 * dpr)}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    this.pins.forEach((p, i) => {
      const [x, y] = fpos(v, p.lat, p.lon);
      if (!onScreen(v, x, y, 30 * dpr)) return;
      const col = p.home ? '255,200,90' : p.locked ? '90,130,122' : CY, s = (p.home ? 5 : 4) * dpr;
      if (!p.locked) {
        const ph = (t * .8 + i * .17) % 1;
        ctx.strokeStyle = `rgba(${col},${1 - ph})`; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(x, y, s + ph * 14 * dpr, 0, TAU); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
      if (p.locked) { ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = 1.2 * dpr; ctx.stroke(); } else { ctx.fillStyle = `rgba(${col},1)`; ctx.fill(); }
      ctx.fillStyle = `rgba(${col},.95)`; ctx.fillText(p.name.toUpperCase(), x + 8 * dpr, y - 6 * dpr);
      if (!p.locked) hits.push({ mapId: p.mapId, x, y });
    });
    return hits;
  }

  private drawFlatDebugGrid(ctx: CanvasRenderingContext2D, w: number, h: number, R: number, r: Rot, dpr: number): void {
    const v = flatView(w, h, R, r), STEP = 32;
    ctx.strokeStyle = 'rgba(255,60,60,.45)'; ctx.lineWidth = dpr; ctx.beginPath();
    for (let tx = 0; tx < TEX; tx += STEP) {
      const { lon } = texToLatLon(tx, 0), [x] = fpos(v, 0, lon);
      ctx.moveTo(x, v.y0); ctx.lineTo(x, v.y0 + v.mapH);
    }
    for (let ty = STEP; ty < TEX; ty += STEP) {
      const { lat } = texToLatLon(0, ty), [, y] = fpos(v, lat, 0);
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.font = `${Math.round(9 * dpr)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let tx = 0; tx < TEX; tx += STEP * 2) for (let ty = STEP * 2; ty < TEX; ty += STEP * 2) {
      const { lat, lon } = texToLatLon(tx, ty), [x, y] = fpos(v, lat, lon);
      if (onScreen(v, x, y, 0)) outlinedText(ctx, `${tx},${ty}`, x, y, '#ffd0d0', 'rgba(0,0,0,.8)', 3 * dpr);
    }
    ctx.textBaseline = 'alphabetic';
  }

  // ── DEBUG: cuadrícula tx/ty para colocar pines (TIERRA_PINS) ─────────────
  private drawDebugGrid(ctx: CanvasRenderingContext2D, w: number, h: number, R: number, r: Rot, dpr: number): void {
    const cx = w / 2, cy = h / 2, STEP = 32;
    ctx.strokeStyle = 'rgba(255,60,60,.45)'; ctx.lineWidth = dpr;
    for (let tx = 0; tx < TEX; tx += STEP) {
      const pts: V3[] = [];
      for (let ty = 0; ty <= TEX; ty += 8) { const { lat, lon } = texToLatLon(tx, ty); pts.push(v3(lat, lon)); }
      tracePath(ctx, pts, r, cx, cy, R); ctx.stroke();
    }
    for (let ty = STEP; ty < TEX; ty += STEP) {
      const pts: V3[] = [];
      for (let tx = 0; tx <= TEX; tx += 8) { const { lat, lon } = texToLatLon(tx, ty); pts.push(v3(lat, lon)); }
      tracePath(ctx, pts, r, cx, cy, R); ctx.stroke();
    }
    ctx.font = `${Math.round(9 * dpr)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let tx = 0; tx < TEX; tx += STEP * 2) for (let ty = STEP * 2; ty < TEX; ty += STEP * 2) {
      const { lat, lon } = texToLatLon(tx, ty), p = proj(v3(lat, lon), r);
      if (p[2] < .2) continue;
      outlinedText(ctx, `${tx},${ty}`, cx + p[0] * R, cy - p[1] * R, '#ffd0d0', 'rgba(0,0,0,.8)', 3 * dpr);
    }
    ctx.textBaseline = 'alphabetic';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Mapa plano: vista, muestreo suave del terreno y texturas de fondo por capa
// ════════════════════════════════════════════════════════════════════════════

const FW = 1536, FH = 768;      // texturas planas (2:1, equirectangulares)
const HEX_COLS = 72;            // columnas de casillas del tablero plano (par: cierra la costura)
const ELEV_K = 9;               // altura del relieve hexagonal en px por unidad de HEX_ELEV

interface FlatView {
  w: number; h: number; cx: number; cy: number;
  k: number;                    // px por radián
  lonC: number; latC: number;   // punto central (el que miraba el globo)
  mapW: number; mapH: number; y0: number; tileStart: number;
}
interface FlatHexCell { x: number; y: number; t: number; }

const wrapPI = (a: number) => a - TAU * Math.floor((a + PI) / TAU);

function flatView(w: number, h: number, R: number, r: Rot): FlatView {
  const k = R, cx = w / 2, cy = h / 2, lonC = wrapPI(-r.yaw), latC = r.pitch;
  const mapW = TAU * k, mapH = PI * k;
  let tileStart = cx + (-PI - lonC) * k;
  while (tileStart > 0) tileStart -= mapW;
  return { w, h, cx, cy, k, lonC, latC, mapW, mapH, y0: cy - (PI / 2 - latC) * k, tileStart };
}
function fpos(v: FlatView, lat: number, lon: number): [number, number] {
  return [v.cx + wrapPI(lon - v.lonC) * v.k, v.cy - (lat - v.latC) * v.k];
}
const onScreen = (v: FlatView, x: number, y: number, m: number) => x > -m && x < v.w + m && y > -m && y < v.h + m;

/** Altura y humedad interpoladas (bilineal): costas suaves aunque la rejilla sea 512×256. */
function sampleHM(lat: number, lon: number, out: number[]): void {
  const gx = (lon + PI) / TAU * W - .5, gy = (PI / 2 - lat) / PI * H - .5;
  const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const xa = ((x0 % W) + W) % W, xb = (xa + 1) % W;
  const ya = Math.max(0, Math.min(H - 1, y0)), yb = Math.max(0, Math.min(H - 1, y0 + 1));
  const a = ya * W + xa, b = ya * W + xb, c = yb * W + xa, d = yb * W + xb;
  out[0] = (HT[a] * (1 - fx) + HT[b] * fx) * (1 - fy) + (HT[c] * (1 - fx) + HT[d] * fx) * fy;
  out[1] = (MO[a] * (1 - fx) + MO[b] * fx) * (1 - fy) + (MO[c] * (1 - fx) + MO[d] * fx) * fy;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

let FLAT_BASE: HTMLCanvasElement | null = null;
/** Capa normal en plano: colores toon + sombreado de relieve (luz del noroeste). */
function flatBaseTex(): HTMLCanvasElement {
  if (FLAT_BASE) return FLAT_BASE;
  const [c, x] = makeCanvas(FW, FH), img = x.createImageData(FW, FH), d = img.data;
  const hh = new Float32Array(FW * FH), types = new Uint8Array(FW * FH), tmp = [0, 0];
  for (let j = 0; j < FH; j++) {
    const lat = PI / 2 - (j + .5) / FH * PI;
    for (let i = 0; i < FW; i++) {
      sampleHM(lat, (i + .5) / FW * TAU - PI, tmp);
      hh[j * FW + i] = tmp[0];
      types[j * FW + i] = classify(tmp[0], tmp[1], lat);
    }
  }
  const O = 3;   // distancia (px) para la pendiente del sombreado
  for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
    const k = j * FW + i, hv = hh[k];
    let col = PAL_TOON[types[k]], b = 1, sh = 0;
    if (hv < 0 && hv > -.014) col = [244, 252, 255];        // espuma de costa
    else if (hv >= 0 && hv < .01) col = [96, 150, 80];      // borde de tierra
    else if (hv >= 0) {
      const l = hh[j * FW + (i - O + FW) % FW], r = hh[j * FW + (i + O) % FW];
      const u = hh[Math.max(0, j - O) * FW + i], dn = hh[Math.min(FH - 1, j + O) * FW + i];
      const lit = (l - r) + (u - dn);
      if (lit < -.04) { b = .7; sh = .28; } else if (lit < -.01) { b = .86; sh = .12; } else if (lit > .03) b = 1.07;
    }
    const o = k << 2;
    d[o] = Math.min(255, mix(col[0] * b, 90, sh)); d[o + 1] = Math.min(255, mix(col[1] * b, 76, sh));
    d[o + 2] = Math.min(255, mix(col[2] * b, 170, sh)); d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return FLAT_BASE = c;
}

let FLAT_GRID: { r: number; cells: FlatHexCell[] } | null = null;
/** Rejilla de hexágonos (punta plana) sobre el mapa plano; cada casilla toma el
 *  terreno de su centro. Ordenada por y para pintar de atrás adelante. */
function flatHexGrid(): { r: number; cells: FlatHexCell[] } {
  if (FLAT_GRID) return FLAT_GRID;
  const r = FW / (HEX_COLS * 1.5), rowH = Math.sqrt(3) * r, rows = Math.ceil(FH / rowH) + 1;
  const cells: FlatHexCell[] = [], tmp = [0, 0];
  for (let col = 0; col < HEX_COLS; col++) for (let row = 0; row < rows; row++) {
    const x = col * 1.5 * r, y = row * rowH + (col & 1 ? rowH / 2 : 0);
    const lat = PI / 2 - Math.max(0, Math.min(FH, y)) / FH * PI;
    sampleHM(lat, x / FW * TAU - PI, tmp);
    cells.push({ x, y, t: classify(tmp[0], tmp[1], lat) });
  }
  cells.sort((a, b) => a.y - b.y);
  return FLAT_GRID = { r, cells };
}
function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let a = 0; a < 6; a++) { const ang = a * PI / 3; ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r); }
  ctx.closePath();
}
/** Casilla con relieve: base oscura + lateral + tapa elevada `e` px. */
function prism(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, e: number, col: number[], lw: number): void {
  if (e > .5) {
    ctx.fillStyle = `rgb(${col[0] * .5 | 0},${col[1] * .5 | 0},${col[2] * .5 | 0})`;
    hexPath(ctx, x, y, r); ctx.fill();
    ctx.fillRect(x - r, y - e, 2 * r, e);
  }
  hexPath(ctx, x, y - e, r);
  ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; ctx.fill();
  ctx.strokeStyle = 'rgba(10,20,30,.28)'; ctx.lineWidth = lw; ctx.stroke();
}
let FLAT_HEX: HTMLCanvasElement | null = null;
/** Capa economía en plano: tablero hexagonal con relieve (mismos colores/alturas que el globo). */
function flatHexTex(): HTMLCanvasElement {
  if (FLAT_HEX) return FLAT_HEX;
  const g = flatHexGrid(), [c, x] = makeCanvas(FW, FH);
  x.fillStyle = 'rgb(24,52,78)'; x.fillRect(0, 0, FW, FH);
  for (const cell of g.cells) {
    const e = (HEX_ELEV[cell.t] - 1) * g.r * ELEV_K, col = HEX_COL[cell.t];
    for (const off of [0, -FW, FW]) {
      const cx = cell.x + off;
      if (cx < -g.r * 2 || cx > FW + g.r * 2) continue;
      prism(x, cx, cell.y, g.r, e, col, 1);
    }
  }
  return FLAT_HEX = c;
}

let FLAT_WAR: HTMLCanvasElement | null = null;
/** Capa guerra en plano: fondo oscuro, meridianos/paralelos y tierra en puntos. */
function flatWarTex(): HTMLCanvasElement {
  if (FLAT_WAR) return FLAT_WAR;
  const [c, x] = makeCanvas(FW, FH);
  x.fillStyle = '#041210'; x.fillRect(0, 0, FW, FH);
  x.strokeStyle = `rgba(${CY},.16)`; x.lineWidth = 1; x.beginPath();
  for (let lo = 0; lo <= 360; lo += 20) { const px = lo / 360 * FW; x.moveTo(px, 0); x.lineTo(px, FH); }
  for (let la = -80; la <= 80; la += 20) { const py = (90 - la) / 180 * FH; x.moveTo(0, py); x.lineTo(FW, py); }
  x.stroke();
  const land = new Path2D(), coast = new Path2D(), tmp = [0, 0], STEP = 6;
  for (let py = STEP / 2; py < FH; py += STEP) {
    const lat = PI / 2 - py / FH * PI;
    for (let px = STEP / 2; px < FW; px += STEP) {
      sampleHM(lat, px / FW * TAU - PI, tmp);
      if (tmp[0] < 0) continue;
      (tmp[0] < .03 ? coast : land).rect(px - 1.2, py - 1.2, 2.4, 2.4);
    }
  }
  x.fillStyle = `rgba(${CY},.5)`; x.fill(land);
  x.fillStyle = `rgba(${CY},.95)`; x.fill(coast);
  x.strokeStyle = `rgba(${CY},.6)`; x.lineWidth = 2; x.strokeRect(1, 1, FW - 2, FH - 2);
  return FLAT_WAR = c;
}
