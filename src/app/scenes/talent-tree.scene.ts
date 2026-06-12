import Phaser from 'phaser';
import { Subscription } from 'rxjs';
import { TalentNodeConfig, TalentService, SphereType } from '../services/talent.service';

// Árbol de talentos renderizado en Phaser dentro del panel de equipo (tab 3).
// Estética "ascua" estilo Diablo: fondo de humo oscuro con resplandor rojo,
// caminos de brasa con remaches romboidales, orbes oscuros con aro ardiente,
// hub central ornamentado y ascuas flotando hacia arriba.
// El componente Angular (EquipmentComponent) crea el juego, registra el
// TalentService + los nodos del árbol activo y un callback de tap; el picker
// de esferas sigue siendo HTML (flyout) — aquí solo se pinta y se navega.

export const TALENT_TREE_DATA_KEY = 'talentTreeNodes';
export const TALENT_SERVICE_KEY   = 'talentService';
export const TALENT_NODE_TAP_KEY  = 'onTalentNodeTap';

// Canvas con supersampling: se renderiza a mínimo 2× (aunque el devicePixelRatio
// sea 1) y se reduce con zoom CSS — trazos y texto lo más nítidos posible.
// El componente usa el mismo factor al crear el juego (TALENT_TREE_RES).
const DPR = Math.max(Math.min(window.devicePixelRatio || 1, 3), 2);
export const TALENT_TREE_RES = DPR;

const CELL    = 44 * DPR;   // paso de cuadrícula (col/row)
const PAD     = 70 * DPR;   // margen del mundo alrededor del árbol
const R_NODE  = 16 * DPR;   // radio nodo normal
const R_SMALL = 11 * DPR;   // radio nodo small
const R_HUB   = 26 * DPR;   // radio del hub central (requires: [])

const SPHERE_COLOR: Record<SphereType, number> = {
  normal: 0x4caf50,
  rare:   0x2196f3,
  epic:   0x9c27b0,
};

// ── Paleta ascua ──────────────────────────────────────────────────────────────
const C_FILL_LOCKED = 0x150d0a;
const C_RIM_LOCKED  = 0x42302a;
const C_FILL_AVAIL  = 0x241510;
const C_RIM_AVAIL   = 0xd86a30;   // brasa: "puedes engarzar aquí"
const C_LINE_IDLE   = 0x3c2a22;
const C_LINE_REACH  = 0x8a4a26;   // padre engarzado, hijo aún no
const C_LINE_ACTIVE = 0xff5a28;   // halo del camino encendido
const C_LINE_CORE   = 0xffa050;   // trazo central del camino encendido
const C_EMBER       = 0xff6a2e;   // ascuas flotantes / partículas
const C_RING_DECO   = 0x6a2a18;   // anillos concéntricos de fondo
const C_TEXT        = '#ffd9a8';
const C_TEXT_DIM    = '#6a5448';
const C_GOLD        = '#ffc24a';

type NodeState = 'locked' | 'available' | 'slotted';

interface NodeView {
  cfg:   TalentNodeConfig;
  cont:  Phaser.GameObjects.Container;
  glow:  Phaser.GameObjects.Arc;     // halo exterior (estado)
  base:  Phaser.GameObjects.Arc;     // círculo principal
  core:  Phaser.GameObjects.Arc;     // núcleo de color de esfera (slotted)
  shine: Phaser.GameObjects.Arc;     // reflejo superior del orbe
  num:   Phaser.GameObjects.Text | null;
  pulse: Phaser.Tweens.Tween | null; // pulso del glow en estado available
  r:     number;
}

interface EdgeParticle {
  arc: Phaser.GameObjects.Arc;
  x1: number; y1: number; x2: number; y2: number;
  t: number;
  speed: number;
}

interface Ember {
  arc: Phaser.GameObjects.Arc;
  vy: number;      // px/ms hacia arriba
  drift: number;   // deriva horizontal (px/ms)
  life: number;    // 0..1
  rate: number;    // avance de vida por ms
}

export class TalentTreeScene extends Phaser.Scene {

  private talent!: TalentService;
  private nodes:  TalentNodeConfig[] = [];
  private views:  Map<string, NodeView> = new Map();

  private edgesG!: Phaser.GameObjects.Graphics;
  private selRing!: Phaser.GameObjects.Arc;
  private selectedId: string | null = null;

  private hubRing: Phaser.GameObjects.Graphics | null = null;
  private particles: EdgeParticle[] = [];
  private embers: Ember[] = [];
  private worldW = 0;
  private worldH = 0;
  private changesSub: Subscription | null = null;

  constructor() { super({ key: 'TalentTreeScene' }); }

  create(): void {
    this.views.clear();
    this.particles = [];
    this.embers = [];
    this.selectedId = null;
    this.hubRing = null;

    this.talent = this.registry.get(TALENT_SERVICE_KEY) as TalentService;
    this.nodes  = (this.registry.get(TALENT_TREE_DATA_KEY) as TalentNodeConfig[]) ?? [];
    if (!this.talent || !this.nodes.length) return;

    const maxCol = Math.max(...this.nodes.map(n => n.col));
    const maxRow = Math.max(...this.nodes.map(n => n.row));
    this.worldW = maxCol * CELL + PAD * 2;
    this.worldH = maxRow * CELL + PAD * 2;

    this.createBackdrop();

    this.edgesG = this.add.graphics();

    for (const cfg of this.nodes) this.buildNode(cfg);

    // Anillo de selección (se mueve al nodo seleccionado desde Angular)
    this.selRing = this.add.circle(0, 0, R_NODE, 0x000000, 0)
      .setStrokeStyle(2.5 * DPR, 0xffd9a8, 0.95)
      .setVisible(false);
    this.tweens.add({
      targets: this.selRing,
      scale: { from: 1, to: 1.12 },
      alpha: { from: 1, to: 0.55 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.refresh();

    // Cámara: pan con arrastre + rueda para zoom, centrada en el hub
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldW, this.worldH);
    const hub = this.nodes.find(n => n.requires.length === 0) ?? this.nodes[0];
    const hubPos = this.nodeCenter(hub);
    cam.centerOn(hubPos.x, hubPos.y);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.scrollX -= (p.position.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.position.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.zoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.6, 1.6);
    });

    this.changesSub = this.talent.changes$.subscribe(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.changesSub?.unsubscribe();
      this.changesSub = null;
    });
  }

  override update(_time: number, delta: number): void {
    if (this.hubRing) this.hubRing.rotation += delta * 0.0003;

    for (const pt of this.particles) {
      pt.t = (pt.t + delta * pt.speed) % 1;
      pt.arc.setPosition(
        Phaser.Math.Linear(pt.x1, pt.x2, pt.t),
        Phaser.Math.Linear(pt.y1, pt.y2, pt.t),
      );
      // fade in/out en los extremos para que no "aparezcan" de golpe
      pt.arc.setAlpha(Math.sin(pt.t * Math.PI) * 0.9);
    }

    for (const em of this.embers) {
      em.life += delta * em.rate;
      if (em.life >= 1) this.resetEmber(em);
      em.arc.y -= em.vy * delta;
      em.arc.x += em.drift * delta;
      em.arc.setAlpha(Math.sin(em.life * Math.PI) * 0.55);
    }
  }

  /** Llamado desde Angular al cambiar la selección (picker abierto/cerrado) */
  setSelected(nodeId: string | null): void {
    this.selectedId = nodeId;
    if (!nodeId) { this.selRing.setVisible(false); return; }
    const view = this.views.get(nodeId);
    if (!view) { this.selRing.setVisible(false); return; }
    this.selRing
      .setPosition(view.cont.x, view.cont.y)
      .setRadius(view.r + 5 * DPR)
      .setVisible(true);
  }

  // ── Construcción ────────────────────────────────────────────────────────────

  private nodeCenter(cfg: TalentNodeConfig): { x: number; y: number } {
    return { x: PAD + cfg.col * CELL, y: PAD + cfg.row * CELL };
  }

  private nodeRadius(cfg: TalentNodeConfig): number {
    if (cfg.requires.length === 0) return R_HUB;
    return cfg.small ? R_SMALL : R_NODE;
  }

  private createBackdrop(): void {
    const hub = this.nodes.find(n => n.requires.length === 0);
    const c = hub ? this.nodeCenter(hub) : { x: this.worldW / 2, y: this.worldH / 2 };

    // Resplandor de fragua tras el hub
    this.add.circle(c.x, c.y, 260 * DPR, 0x8a1e10, 0.10);
    this.add.circle(c.x, c.y, 150 * DPR, 0xff3a14, 0.06);
    this.add.circle(c.x, c.y, 75  * DPR, 0xffa050, 0.05);

    // Anillos concéntricos tenues alrededor del hub (ornamento, no caminos)
    for (const mult of [2.2, 4.2, 6.2]) {
      this.add.circle(c.x, c.y, mult * CELL, 0x000000, 0)
        .setStrokeStyle(1.5 * DPR, C_RING_DECO, 0.16);
    }

    // Ascuas flotando por todo el mundo
    const rnd = Phaser.Math.RND;
    for (let i = 0; i < 36; i++) {
      const ember: Ember = {
        arc: this.add.circle(
          rnd.between(0, this.worldW), rnd.between(0, this.worldH),
          rnd.realInRange(0.8, 1.8) * DPR,
          C_EMBER, 0,
        ),
        vy:    rnd.realInRange(0.006, 0.018) * DPR,
        drift: rnd.realInRange(-0.004, 0.004) * DPR,
        life:  rnd.realInRange(0, 1),
        rate:  1 / rnd.between(3500, 7000),
      };
      this.embers.push(ember);
    }
  }

  private resetEmber(em: Ember): void {
    const rnd = Phaser.Math.RND;
    em.life = 0;
    em.rate = 1 / rnd.between(3500, 7000);
    em.arc.setPosition(rnd.between(0, this.worldW), rnd.between(this.worldH * 0.3, this.worldH));
  }

  private buildNode(cfg: TalentNodeConfig): void {
    const { x, y } = this.nodeCenter(cfg);
    const r = this.nodeRadius(cfg);
    const isHub = cfg.requires.length === 0;

    const glow  = this.add.circle(0, 0, r * 1.6, C_RIM_AVAIL, 0).setVisible(false);
    const base  = this.add.circle(0, 0, r, C_FILL_LOCKED).setStrokeStyle(2.5 * DPR, C_RIM_LOCKED);
    const core  = this.add.circle(0, 0, r * 0.5, 0xffffff, 0).setVisible(false);
    const shine = this.add.circle(-r * 0.3, -r * 0.35, r * 0.32, 0xffd9a8, 0.10);

    const children: Phaser.GameObjects.GameObject[] = [glow, base, core, shine];

    let num: Phaser.GameObjects.Text | null = null;
    if (cfg.num) {
      num = this.add.text(0, 0, String(cfg.num), {
        fontFamily: 'Georgia, serif',
        fontSize: `${(cfg.small ? 10 : 12) * DPR}px`,
        fontStyle: 'bold',
        color: C_TEXT,
      }).setOrigin(0.5);
      children.push(num);
    }

    if (cfg.topLabel) {
      children.push(this.add.text(0, -(r + 11 * DPR), cfg.topLabel, {
        fontFamily: 'Georgia, serif',
        fontSize: `${10 * DPR}px`,
        fontStyle: 'bold',
        color: C_GOLD,
      }).setOrigin(0.5));
    }

    if (isHub) {
      // Emblema central + anillo ornamentado con muescas que rota en update()
      children.push(this.add.text(0, 0, '✦', {
        fontSize: `${20 * DPR}px`,
        color: '#ff8a4a',
      }).setOrigin(0.5));

      const ring = this.add.graphics();
      ring.lineStyle(2 * DPR, 0xff8a4a, 0.55);
      for (let i = 0; i < 4; i++) {
        ring.beginPath();
        ring.arc(0, 0, r + 7 * DPR, i * Math.PI / 2 + 0.25, (i + 1) * Math.PI / 2 - 0.25);
        ring.strokePath();
      }
      // remaches romboidales en los 4 puntos cardinales del anillo
      ring.fillStyle(0xffa050, 0.8);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const px = Math.cos(a) * (r + 7 * DPR);
        const py = Math.sin(a) * (r + 7 * DPR);
        this.fillDiamond(ring, px, py, 3.5 * DPR);
      }
      this.hubRing = ring;
      children.push(ring);
      children.push(this.add.circle(0, 0, r * 0.62, 0x000000, 0).setStrokeStyle(1.5 * DPR, 0xff8a4a, 0.45));
    }

    const cont = this.add.container(x, y, children);

    // Hit area generosa sobre el círculo base (coords locales del Arc)
    const hitR = Math.max(r * 1.35, 16 * DPR);
    base.setInteractive(new Phaser.Geom.Circle(r, r, hitR), Phaser.Geom.Circle.Contains);
    base.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() > 12 * DPR) return;   // era un arrastre, no un tap
      this.onTap(cfg);
    });

    this.views.set(cfg.id, { cfg, cont, glow, base, core, shine, num, pulse: null, r });
  }

  // ── Estados / repintado ─────────────────────────────────────────────────────

  private nodeState(id: string): NodeState {
    if (this.talent.slotted[id])    return 'slotted';
    if (this.talent.isUnlocked(id)) return 'available';
    return 'locked';
  }

  private refresh(): void {
    for (const view of this.views.values()) this.styleNode(view);
    this.redrawEdges();
    this.rebuildParticles();
    // La selección puede haberse quedado huérfana (p.ej. tras engarzar)
    if (this.selectedId && !this.views.has(this.selectedId)) this.setSelected(null);
  }

  private styleNode(view: NodeView): void {
    const state  = this.nodeState(view.cfg.id);
    const sphere = this.talent.slotted[view.cfg.id];

    view.pulse?.remove();
    view.pulse = null;

    if (state === 'locked') {
      view.base.setFillStyle(C_FILL_LOCKED).setStrokeStyle(2.5 * DPR, C_RIM_LOCKED);
      view.glow.setVisible(false);
      view.core.setVisible(false);
      view.shine.setAlpha(0.05);
      view.num?.setColor(C_TEXT_DIM);
    } else if (state === 'available') {
      view.base.setFillStyle(C_FILL_AVAIL).setStrokeStyle(2.5 * DPR, C_RIM_AVAIL);
      view.glow.setVisible(true).setFillStyle(C_RIM_AVAIL, 0.12);
      view.core.setVisible(false);
      view.shine.setAlpha(0.14);
      view.num?.setColor(C_TEXT);
      view.pulse = this.tweens.add({
        targets: view.glow,
        alpha: { from: 0.4, to: 1 },
        scale: { from: 0.92, to: 1.08 },
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else {
      const color = SPHERE_COLOR[sphere!];
      const dark  = Phaser.Display.Color.ValueToColor(color).darken(55).color;
      view.base.setFillStyle(dark).setStrokeStyle(2.5 * DPR, color);
      view.glow.setVisible(true).setFillStyle(color, 0.16).setScale(1).setAlpha(1);
      view.core.setVisible(true).setFillStyle(color, 0.95);
      view.shine.setAlpha(0.26);
      view.num?.setColor('#ffffff');
    }
  }

  /** Rombo relleno centrado en (cx, cy) — remaches de caminos y anillos */
  private fillDiamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number): void {
    g.fillPoints([
      new Phaser.Geom.Point(cx,     cy - s),
      new Phaser.Geom.Point(cx + s, cy),
      new Phaser.Geom.Point(cx,     cy + s),
      new Phaser.Geom.Point(cx - s, cy),
    ], true);
  }

  private redrawEdges(): void {
    const g = this.edgesG;
    g.clear();

    for (const node of this.nodes) {
      for (const reqId of node.requires) {
        const parent = this.views.get(reqId);
        const child  = this.views.get(node.id);
        if (!parent || !child) continue;

        const pSlotted = !!this.talent.slotted[reqId];
        const cSlotted = !!this.talent.slotted[node.id];
        const x1 = parent.cont.x, y1 = parent.cont.y;
        const x2 = child.cont.x,  y2 = child.cont.y;
        const mx = (x1 + x2) / 2,  my = (y1 + y2) / 2;

        if (pSlotted && cSlotted) {
          g.lineStyle(8 * DPR, C_LINE_ACTIVE, 0.18);   // halo de brasa
          g.lineBetween(x1, y1, x2, y2);
          g.lineStyle(2.5 * DPR, C_LINE_CORE, 0.95);   // trazo encendido
          g.lineBetween(x1, y1, x2, y2);
          g.fillStyle(0xffd9a8, 0.95);
        } else if (pSlotted) {
          g.lineStyle(2.5 * DPR, C_LINE_REACH, 0.9);
          g.lineBetween(x1, y1, x2, y2);
          g.fillStyle(C_LINE_REACH, 0.95);
        } else {
          g.lineStyle(2 * DPR, C_LINE_IDLE, 0.85);
          g.lineBetween(x1, y1, x2, y2);
          g.fillStyle(0x52382c, 0.9);
        }

        // remache romboidal a mitad de camino (estilo forja)
        this.fillDiamond(g, mx, my, 3.5 * DPR);
      }
    }
  }

  private rebuildParticles(): void {
    for (const pt of this.particles) pt.arc.destroy();
    this.particles = [];

    for (const node of this.nodes) {
      for (const reqId of node.requires) {
        if (!this.talent.slotted[reqId] || !this.talent.slotted[node.id]) continue;
        const parent = this.views.get(reqId);
        const child  = this.views.get(node.id);
        if (!parent || !child) continue;

        for (let i = 0; i < 2; i++) {
          this.particles.push({
            arc: this.add.circle(parent.cont.x, parent.cont.y, 2.2 * DPR, C_LINE_CORE, 0.9),
            x1: parent.cont.x, y1: parent.cont.y,
            x2: child.cont.x,  y2: child.cont.y,
            t: i / 2,
            speed: 0.0006,
          });
        }
      }
    }
  }

  // ── Interacción ─────────────────────────────────────────────────────────────

  private onTap(cfg: TalentNodeConfig): void {
    const view = this.views.get(cfg.id);
    if (!view) return;

    if (this.nodeState(cfg.id) === 'locked') {
      // Feedback: sacudida corta, sin abrir picker
      this.tweens.add({
        targets: view.cont,
        x: { from: view.cont.x - 3 * DPR, to: view.cont.x },
        duration: 60, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
      });
      return;
    }

    // Pop de confirmación + callback hacia Angular (abre el picker HTML)
    this.tweens.add({
      targets: view.cont,
      scale: { from: 1.15, to: 1 },
      duration: 160, ease: 'Back.easeOut',
    });
    const cb = this.registry.get(TALENT_NODE_TAP_KEY) as ((id: string) => void) | undefined;
    cb?.(cfg.id);
  }
}
