import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { MAP_REGISTRY } from 'src/app/scenes/gamescene/map-config';

// Vista alternativa del mapa del mundo (pestaña "Hexágonos" del panel del minimapa):
// tablero hexagonal de estrategia con relieve, iconos de terreno y niebla de guerra que
// se levanta alrededor de los mapas desbloqueados. Canvas 2D puro (sin Phaser): el
// terreno se pinta UNA vez en una caché y cada frame solo se animan pines/selección.
//
// El mundo es un mapa de alturas procedural (semilla fija → siempre igual) con
// proporción 1.6 que se encaja (contain) en el canvas; los hexágonos cubren todo el
// canvas y lo que cae fuera del mundo es océano.

const DOUBLE_CLICK_MS = 300;
const WORLD_ASPECT = 1.6;

// Mapas del planeta Tierra en ORDEN de ruta. x/y normalizados (0..1) sobre el mundo.
// Para añadir un mapa: nueva entrada aquí (y en PLANET_MAPS del panel).
interface HexPin { mapId: string; x: number; y: number; home?: boolean; boss?: boolean; }
const HEX_PINS: HexPin[] = [
  { mapId: 'hogar', x: .13, y: .62, home: true },
  { mapId: '1-1',   x: .23, y: .44 },
  { mapId: '1-2',   x: .33, y: .63 },
  { mapId: '1-3',   x: .43, y: .42 },
  { mapId: '1-4',   x: .52, y: .64 },
  { mapId: '1-5',   x: .61, y: .38 },
  { mapId: '1-6',   x: .71, y: .60 },
  { mapId: '1-7',   x: .79, y: .33 },
  { mapId: '1-8',   x: .88, y: .55, boss: true },
];

// ── Mundo procedural (se calcula una vez al cargar el módulo) ─────────────────
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed: number): (x: number, y: number) => number {
  const r = rng(seed), N = 64, v = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) v[i] = r();
  const s = (t: number) => t * t * (3 - 2 * t);
  const g = (i: number, j: number) => v[((j % N + N) % N) * N + ((i % N + N) % N)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi);
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
function fbm(n: (x: number, y: number) => number, x: number, y: number): number {
  let s = 0, a = .5, f = 1, t = 0;
  for (let o = 0; o < 5; o++) { s += a * n(x * f, y * f); t += a; a *= .5; f *= 2; }
  return s / t;
}
const hash = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

/** Ruta suavizada (Catmull-Rom) por los pines; `seg` = índice del tramo i→i+1. */
function buildRoute(steps: number): { x: number; y: number }[] {
  const P = HEX_PINS, out: { x: number; y: number }[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

const GW = 160, GH = 100;
const HT = new Float32Array(GW * GH), MO = new Float32Array(GW * GH);
(() => {
  const n1 = makeNoise(7), n2 = makeNoise(91), route = buildRoute(40);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const nx = i / (GW - 1), ny = j / (GH - 1);
    let h = fbm(n1, nx * 5, ny * 5 / WORLD_ASPECT) - .5;
    const d = Math.min(nx, 1 - nx, ny, 1 - ny);
    h -= Math.max(0, .2 - d) * 2.2;                     // océano en los bordes
    let md = 9;
    for (const p of route) { const dx = (p.x - nx) * WORLD_ASPECT, dy = p.y - ny; md = Math.min(md, dx * dx + dy * dy); }
    h += .32 * Math.exp(-md / .012) - .05;              // tierra continua a lo largo de la ruta
    for (const p of HEX_PINS) { const dx = (p.x - nx) * WORLD_ASPECT, dy = p.y - ny; h += .12 * Math.exp(-(dx * dx + dy * dy) / .003); }
    HT[j * GW + i] = h;
    MO[j * GW + i] = fbm(n2, nx * 4, ny * 4 / WORLD_ASPECT);
  }
})();
function bil(A: Float32Array, nx: number, ny: number): number {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return A === HT ? -.5 : .5;   // fuera del mundo: océano
  const x = Math.min(GW - 1.001, nx * (GW - 1)), y = Math.min(GH - 1.001, ny * (GH - 1));
  const i = x | 0, j = y | 0, fx = x - i, fy = y - j;
  const a = A[j * GW + i], b = A[j * GW + i + 1], c = A[(j + 1) * GW + i], d = A[(j + 1) * GW + i + 1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

type Terrain = 'deep' | 'water' | 'sand' | 'grass' | 'forest' | 'hills' | 'mount' | 'snow';
function terrain(h: number, m: number): Terrain {
  if (h < -.1) return 'deep';
  if (h < 0) return 'water';
  if (h < .04) return 'sand';
  if (h < .2) return m > .55 ? 'forest' : 'grass';
  if (h < .32) return 'hills';
  if (h < .42) return 'mount';
  return 'snow';
}
const TERRAIN_COLOR: Record<Terrain, [number, number, number]> = {
  deep: [42, 74, 120], water: [54, 96, 154], sand: [214, 195, 138], grass: [122, 168, 74],
  forest: [79, 127, 60], hills: [162, 160, 94], mount: [138, 125, 112], snow: [232, 238, 242],
};
const rgb = (c: [number, number, number], k: number) =>
  `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;

interface Cell { cx: number; cy: number; }

@Component({
  selector: 'app-hex-map',
  template: '<canvas #cv (pointerup)="onPointerUp($event)" (pointermove)="onPointerMove($event)"></canvas>',
  styles: [':host{position:absolute;inset:0;display:block;background:#161b24} canvas{display:block;width:100%;height:100%;touch-action:manipulation} canvas.hot{cursor:pointer}'],
  standalone: false,
})
export class HexMapComponent implements AfterViewInit, OnDestroy {
  private ngZone = inject(NgZone);
  @ViewChild('cv', { static: true }) cvRef: ElementRef<HTMLCanvasElement>;

  /** mapId → bloqueado (lo da el panel; mismo criterio que el globo). */
  @Input() isLocked: (mapId: string) => boolean = () => false;
  @Input() currentMapId = '';
  @Input() selectedMapId = '';
  @Output() pinSelect   = new EventEmitter<string>();
  @Output() pinTeleport = new EventEmitter<string>();

  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private w = 0; private h = 0;
  private cache: HTMLCanvasElement | null = null;
  private lockKey = '';
  private r = 0;                         // radio del hexágono (px de canvas)
  private snap: Cell[] = [];             // celda donde cae cada pin
  private raf = 0;
  private ro: ResizeObserver;
  private frame = 0;
  private lastClick = { id: '', at: 0 };

  ngAfterViewInit(): void {
    const cv = this.cvRef.nativeElement;
    this.ro = new ResizeObserver(() => {
      const w = Math.round(cv.clientWidth * this.dpr), h = Math.round(cv.clientHeight * this.dpr);
      if (w && h && (w !== this.w || h !== this.h)) { this.w = cv.width = w; this.h = cv.height = h; this.cache = null; }
    });
    this.ro.observe(cv);
    // Bucle fuera de Angular: no dispara change detection por frame.
    this.ngZone.runOutsideAngular(() => {
      const t0 = performance.now();
      const loop = (now: number) => { this.draw((now - t0) / 1000); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }

  private locked(i: number): boolean { return this.isLocked(HEX_PINS[i].mapId); }

  /** Rectángulo del mundo encajado (contain) en el canvas. */
  private worldRect() {
    const ww = Math.min(this.w, this.h * WORLD_ASPECT), wh = ww / WORLD_ASPECT;
    return { x: (this.w - ww) / 2, y: (this.h - wh) / 2, w: ww, h: wh };
  }

  private hexPath(o: CanvasRenderingContext2D, cx: number, cy: number, rr: number) {
    o.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 90); o.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    o.closePath();
  }

  private edge(o: CanvasRenderingContext2D, cx: number, cy: number, rr: number, from: number, to: number) {
    o.beginPath();
    for (let k = from; k <= to; k++) {
      const a = Math.PI / 180 * (60 * k - 90), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      k === from ? o.moveTo(x, y) : o.lineTo(x, y);
    }
    o.stroke();
  }

  /** Terreno + niebla + ruta: se pinta una vez por tamaño/estado de desbloqueos. */
  private buildCache() {
    const { w, h } = this, W = this.worldRect(), u = W.w / 800;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const o = cv.getContext('2d')!;
    o.fillStyle = '#161b24'; o.fillRect(0, 0, w, h);
    const r = this.r = Math.max(9 * this.dpr, W.w / 40), hw = Math.sqrt(3) * r, vs = 1.5 * r;
    const cells: Cell[] = [];
    for (let row = 0; row * vs < h + r; row++)
      for (let col = 0; col * hw < w + hw; col++) cells.push({ cx: col * hw + (row % 2 ? hw / 2 : 0), cy: row * vs });
    const opened = HEX_PINS.filter((_, i) => !this.locked(i));

    for (const cl of cells) {
      const nx = (cl.cx - W.x) / W.w, ny = (cl.cy - W.y) / W.h;
      const t = terrain(bil(HT, nx, ny), bil(MO, nx, ny)), base = TERRAIN_COLOR[t];
      let fd = 9;
      for (const p of opened) fd = Math.min(fd, Math.hypot((p.x - nx) * WORLD_ASPECT, p.y - ny));
      const fog = fd > .15;

      this.hexPath(o, cl.cx, cl.cy, r - u);
      o.fillStyle = rgb(base, .92 + hash(cl.cx, cl.cy) * .16); o.fill();
      // bisel: arista superior-izq clara, inferior-dcha oscura
      o.lineWidth = 1.6 * u;
      o.strokeStyle = rgb(base, 1.25); this.edge(o, cl.cx, cl.cy, r - 2 * u, 3, 6);
      o.strokeStyle = rgb(base, .65);  this.edge(o, cl.cx, cl.cy, r - 2 * u, 0, 3);

      const { cx, cy } = cl, s = r * .32;
      if (t === 'forest') {
        o.fillStyle = '#2b5426';
        for (const [dx, dy] of [[-.45, .2], [.45, .2], [0, -.25]]) {
          o.beginPath(); o.moveTo(cx + dx * r - s * .6, cy + dy * r + s * .5); o.lineTo(cx + dx * r, cy + dy * r - s * .7); o.lineTo(cx + dx * r + s * .6, cy + dy * r + s * .5); o.fill();
        }
      } else if (t === 'mount' || t === 'snow') {
        o.fillStyle = '#5e544a'; o.beginPath(); o.moveTo(cx - r * .55, cy + r * .3); o.lineTo(cx, cy - r * .45); o.lineTo(cx + r * .55, cy + r * .3); o.fill();
        o.fillStyle = '#f4f6f8'; o.beginPath(); o.moveTo(cx - r * .18, cy - r * .18); o.lineTo(cx, cy - r * .45); o.lineTo(cx + r * .18, cy - r * .18); o.fill();
      } else if (t === 'hills') {
        o.strokeStyle = '#6e6c3c'; o.lineWidth = 1.6 * u; o.beginPath();
        o.arc(cx - r * .22, cy + r * .18, r * .25, Math.PI, 0); o.arc(cx + r * .25, cy + r * .18, r * .22, Math.PI, 0); o.stroke();
      } else if (t === 'water' && hash(cy, cx) < .3) {
        o.strokeStyle = 'rgba(200,230,255,.45)'; o.lineWidth = 1.4 * u; o.beginPath(); o.moveTo(cx - r * .35, cy);
        o.quadraticCurveTo(cx - r * .17, cy - r * .15, cx, cy); o.quadraticCurveTo(cx + r * .17, cy + r * .15, cx + r * .35, cy); o.stroke();
      }
      if (fog) { this.hexPath(o, cx, cy, r); o.fillStyle = `rgba(14,17,24,${.62 + hash(cy, cx + 1) * .12})`; o.fill(); }
      this.hexPath(o, cx, cy, r); o.strokeStyle = 'rgba(10,12,18,.55)'; o.lineWidth = u; o.stroke();
    }

    // cada pin a su celda más cercana
    this.snap = HEX_PINS.map(p => {
      const px = W.x + p.x * W.w, py = W.y + p.y * W.h;
      let best = cells[0], bd = Infinity;
      for (const cl of cells) { const d = Math.hypot(cl.cx - px, cl.cy - py); if (d < bd) { bd = d; best = cl; } }
      return best;
    });

    // ruta: dorada con flechas hasta lo desbloqueado, punteada gris después
    o.lineCap = 'round';
    for (let i = 0; i < HEX_PINS.length - 1; i++) {
      const a = this.snap[i], b = this.snap[i + 1], lk = this.locked(i + 1);
      o.strokeStyle = lk ? 'rgba(160,160,170,.35)' : 'rgba(240,192,64,.9)';
      o.lineWidth = (lk ? 2 : 3) * u; o.setLineDash(lk ? [2 * u, 6 * u] : [8 * u, 6 * u]);
      o.beginPath(); o.moveTo(a.cx, a.cy); o.lineTo(b.cx, b.cy); o.stroke();
      if (!lk) {
        const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2, an = Math.atan2(b.cy - a.cy, b.cx - a.cx), L = 7 * u;
        o.setLineDash([]); o.fillStyle = '#f0c040'; o.beginPath();
        o.moveTo(mx + Math.cos(an) * L, my + Math.sin(an) * L);
        o.lineTo(mx + Math.cos(an + 2.4) * L, my + Math.sin(an + 2.4) * L);
        o.lineTo(mx + Math.cos(an - 2.4) * L, my + Math.sin(an - 2.4) * L); o.fill();
      }
    }
    o.setLineDash([]);
    this.cache = cv;
  }

  private draw(t: number) {
    if (!this.w) return;
    // Revisa desbloqueos cada ~0.5 s: si cambian, se repinta la niebla y la ruta.
    if (this.frame++ % 30 === 0) {
      const key = HEX_PINS.map((_, i) => this.locked(i) ? 1 : 0).join('');
      if (key !== this.lockKey) { this.lockKey = key; this.cache = null; }
    }
    if (!this.cache) this.buildCache();
    const o = this.cvRef.nativeElement.getContext('2d')!, r = this.r, u = this.worldRect().w / 800;
    o.drawImage(this.cache!, 0, 0);

    HEX_PINS.forEach((p, i) => {
      const { cx: x, cy: y } = this.snap[i], lk = this.locked(i), cur = p.mapId === this.currentMapId;
      this.hexPath(o, x, y, r - 1.5 * u);
      o.lineWidth = (cur ? 3.5 : 2.2) * u;
      o.strokeStyle = cur ? `rgba(240,192,64,${.6 + Math.sin(t * 4) * .4})` : lk ? '#5a5a66' : '#e8d8b0';
      o.stroke();

      if (lk) this.lockIcon(o, x, y, r * .6);
      else {
        // estandarte: morado para la capital, rojo para el resto
        o.strokeStyle = '#2a1c14'; o.lineWidth = 2 * u;
        o.beginPath(); o.moveTo(x - r * .25, y + r * .5); o.lineTo(x - r * .25, y - r * .6); o.stroke();
        const wave = Math.sin(t * 4 + i) * r * .06;
        o.fillStyle = p.home ? '#6e4a67' : p.boss ? '#3a2c20' : '#c0392b';
        o.beginPath(); o.moveTo(x - r * .25, y - r * .6); o.lineTo(x + r * .45, y - r * .45 + wave); o.lineTo(x - r * .25, y - r * .15); o.fill();
        o.strokeStyle = '#2a1c14'; o.lineWidth = 1.2 * u; o.stroke();
        if (p.home) { o.fillStyle = '#f0c040'; o.fillRect(x - r * .05, y - r * .48, r * .18, r * .12); }
      }

      const name = MAP_REGISTRY[p.mapId]?.name ?? p.mapId;
      const fs = Math.max(10 * this.dpr, 11 * u);
      o.font = `bold ${fs}px Georgia, 'Times New Roman', serif`;
      const tw = o.measureText(name).width + 10 * u, th = fs + 4 * u, ty = y + r * .75;
      o.fillStyle = 'rgba(14,17,24,.85)'; o.fillRect(x - tw / 2, ty, tw, th);
      o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillStyle = cur ? '#f0c040' : lk ? '#8a8a96' : '#f2ead8';
      o.fillText(name, x, ty + th / 2 + u);

      if (p.mapId === this.selectedMapId) {
        this.hexPath(o, x, y, r + 3 * u + Math.sin(t * 6) * 1.5 * u);
        o.strokeStyle = '#ffffff'; o.lineWidth = 1.5 * u; o.stroke();
      }
    });
  }

  private lockIcon(o: CanvasRenderingContext2D, x: number, y: number, s: number) {
    o.save();
    o.lineWidth = s * .18; o.strokeStyle = '#1a1d26';
    o.beginPath(); o.arc(x, y - s * .25, s * .32, Math.PI, 0); o.stroke();
    o.fillStyle = '#7a7a86'; o.fillRect(x - s * .5, y - s * .25, s, s * .75); o.strokeRect(x - s * .5, y - s * .25, s, s * .75);
    o.fillStyle = '#1a1d26'; o.fillRect(x - s * .07, y, s * .14, s * .25);
    o.restore();
  }

  private pinAt(e: PointerEvent): number {
    const rect = this.cvRef.nativeElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) * this.dpr, y = (e.clientY - rect.top) * this.dpr;
    let best = -1, bd = Infinity;
    this.snap.forEach((c, i) => { const d = Math.hypot(c.cx - x, c.cy - y); if (d < this.r * 1.1 && d < bd) { bd = d; best = i; } });
    return best;
  }

  onPointerMove(e: PointerEvent) {
    this.cvRef.nativeElement.classList.toggle('hot', this.pinAt(e) >= 0);
  }

  /** Click → tarjeta de info del mapa; doble click → viajar (como en el globo). */
  onPointerUp(e: PointerEvent) {
    const i = this.pinAt(e);
    if (i < 0) return;
    const id = HEX_PINS[i].mapId, now = performance.now();
    if (this.lastClick.id === id && now - this.lastClick.at < DOUBLE_CLICK_MS) {
      this.lastClick = { id: '', at: 0 };
      this.pinTeleport.emit(id);
      return;
    }
    this.lastClick = { id, at: now };
    this.pinSelect.emit(id);
  }
}
