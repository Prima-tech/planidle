import Phaser from 'phaser';

// Dos vistas en la misma escena:
//  - 'detail': un planeta (TileSprite + máscara circular) que gira al arrastrar,
//    con inercia. Botón «+» para hacer zoom-out al sistema.
//  - 'system': estrella central + planetas orbitando. Pulsar un planeta hace
//    zoom-in a su vista detalle.
// Las transiciones usan fade + tween de zoom de cámara.

const FRICTION   = 0.94;   // decaimiento de la inercia por frame
const MIN_VEL    = 0.02;   // umbral para frenar del todo
const DRAG_Y     = 0.5;    // el arrastre vertical pesa menos (sensación de eje)
const STAR_COUNT = 90;
const TEX_SIZE   = 512;
const SHADE_KEY  = 'planet_shade';

interface PlanetDef {
  id: string;
  name: string;
  kind: 'blob' | 'bands';
  base: string;          // color de fondo (océano / atmósfera)
  features: string[];    // colores de continentes o bandas
  cloudAlpha: number;
  halo: number;          // color del halo atmosférico
  orbit: number;         // radio orbital (factor 0-1 sobre el máximo)
  size: number;          // radio en px en la vista sistema
  speed: number;         // velocidad orbital (rad/s)
}

const PLANETS: PlanetDef[] = [
  { id: 'mundo',   name: 'Mundo',   kind: 'blob',  base: '#16456e', features: ['#3a7a44', '#46905a', '#54a060'], cloudAlpha: 0.13, halo: 0x3a7ac8, orbit: 0.46, size: 13, speed: 0.10 },
  { id: 'magmar',  name: 'Magmar',  kind: 'blob',  base: '#3a1006', features: ['#e0531e', '#ff7a2e', '#b03a10'], cloudAlpha: 0,    halo: 0xd0501e, orbit: 0.28, size: 9,  speed: 0.16 },
  { id: 'ferrum',  name: 'Ferrum',  kind: 'blob',  base: '#7a2f16', features: ['#a14a24', '#b85c2e', '#8f3c1c'], cloudAlpha: 0.04, halo: 0xb05a30, orbit: 0.63, size: 10, speed: 0.08 },
  { id: 'glacius', name: 'Glacius', kind: 'blob',  base: '#7fa8cc', features: ['#ffffff', '#dcecf8', '#bcd8ee'], cloudAlpha: 0.10, halo: 0x9fd0f0, orbit: 0.80, size: 11, speed: 0.06 },
  { id: 'titanus', name: 'Titanus', kind: 'bands', base: '#c8a06a', features: ['#b08850', '#d8b87e', '#9a7444', '#e8cc96'], cloudAlpha: 0, halo: 0xd8b070, orbit: 0.97, size: 16, speed: 0.045 },
];

interface OrbitingPlanet {
  def: PlanetDef;
  img: Phaser.GameObjects.Image;
  angle: number;
  radiusX: number;
  radiusY: number;
}

type ViewMode = 'detail' | 'system';

export class PlanetViewScene extends Phaser.Scene {

  private mode: ViewMode = 'detail';
  private transitioning = false;

  // Vista detalle
  private detailC: Phaser.GameObjects.Container | null = null;
  private planet: Phaser.GameObjects.TileSprite | null = null;
  private planetMask: Phaser.GameObjects.Graphics | null = null;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private velX = 0;
  private velY = 0;

  // Vista sistema
  private systemC: Phaser.GameObjects.Container | null = null;
  private orbiting: OrbitingPlanet[] = [];

  constructor() { super({ key: 'PlanetViewScene' }); }

  create(): void {
    this.cameras.main.setBackgroundColor('#05060f');
    this.createStars(this.scale.width, this.scale.height);
    for (const def of PLANETS) this.createPlanetTexture(def);
    this.createShadeTexture();
    for (const def of PLANETS) this.createMiniTexture(def);

    this.buildSystemView();
    this.systemC!.setVisible(false);
    this.buildDetailView(PLANETS[0]);
    this.initDrag();
  }

  override update(_t: number, delta: number): void {
    if (this.mode === 'detail') {
      this.updateInertia();
    } else {
      this.updateOrbits(delta);
    }
  }

  // ── Transiciones ────────────────────────────────────────────────────────────

  private goToSystem(): void {
    if (this.transitioning || this.mode !== 'detail') return;
    this.transition(() => {
      this.detailC?.setVisible(false);
      this.systemC?.setVisible(true);
      this.mode = 'system';
    }, /* zoomIn */ false);
  }

  private goToPlanet(def: PlanetDef): void {
    if (this.transitioning || this.mode !== 'system') return;
    this.transition(() => {
      this.systemC?.setVisible(false);
      this.buildDetailView(def);
      this.mode = 'detail';
    }, /* zoomIn */ true);
  }

  private transition(swap: () => void, zoomIn: boolean): void {
    this.transitioning = true;
    const cam = this.cameras.main;
    cam.fadeOut(160, 5, 6, 15);
    this.tweens.add({ targets: cam, zoom: zoomIn ? 1.3 : 0.75, duration: 160, ease: 'Sine.easeIn' });
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      swap();
      cam.zoom = zoomIn ? 0.8 : 1.25;
      this.tweens.add({
        targets: cam, zoom: 1, duration: 280, ease: 'Sine.easeOut',
        onComplete: () => { this.transitioning = false; },
      });
      cam.fadeIn(200, 5, 6, 15);
    });
  }

  // ── Vista detalle ───────────────────────────────────────────────────────────

  private buildDetailView(def: PlanetDef): void {
    this.detailC?.destroy(true);
    this.planetMask?.destroy();
    this.velX = 0;
    this.velY = 0;
    this.dragging = false;

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.34;

    this.detailC = this.add.container(0, 0);

    const haloOuter = this.add.circle(cx, cy, radius + 6, def.halo, 0.18);
    const haloRing  = this.add.circle(cx, cy, radius + 2, 0x000000, 0)
      .setStrokeStyle(2, def.halo, 0.45);

    this.planet = this.add.tileSprite(cx, cy, radius * 2, radius * 2, this.texKey(def));
    this.planetMask = this.make.graphics({}, false);
    this.planetMask.fillCircle(cx, cy, radius);
    this.planet.setMask(this.planetMask.createGeometryMask());

    const shade = this.add.image(cx, cy, SHADE_KEY);
    shade.setDisplaySize(radius * 2, radius * 2);

    const name = this.add.text(cx, cy + radius + 18, def.name, {
      fontSize: '13px', color: '#9fc0e8', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5, 0.5).setAlpha(0.8);

    this.detailC.add([haloOuter, haloRing, this.planet, shade, name]);
    this.detailC.add(this.buildZoomOutButton());
  }

  // Botón «+»: zoom-out al sistema estelar
  private buildZoomOutButton(): Phaser.GameObjects.GameObject[] {
    const bx = 26, by = 26, r = 16;
    const bg = this.add.circle(bx, by, r, 0x1e3a5f, 0.92).setStrokeStyle(1.5, 0x3498db, 0.8);
    const label = this.add.text(bx, by - 1, '+', {
      fontSize: '22px', color: '#5bc0f8', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();  // que no arranque el drag del planeta
      this.goToSystem();
    });
    return [bg, label];
  }

  private initDrag(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.mode !== 'detail' || this.transitioning) return;
      this.dragging = true;
      this.lastX = p.x;
      this.lastY = p.y;
      this.velX = 0;
      this.velY = 0;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !this.planet) return;
      const dx = p.x - this.lastX;
      const dy = (p.y - this.lastY) * DRAG_Y;
      this.lastX = p.x;
      this.lastY = p.y;
      this.planet.tilePositionX -= dx;
      this.planet.tilePositionY -= dy;
      this.velX = dx;
      this.velY = dy;
    });

    const stop = () => { this.dragging = false; };
    this.input.on('pointerup', stop);
    this.input.on('pointerupoutside', stop);
  }

  private updateInertia(): void {
    if (this.dragging || !this.planet) return;
    if (Math.abs(this.velX) < MIN_VEL && Math.abs(this.velY) < MIN_VEL) return;
    this.planet.tilePositionX -= this.velX;
    this.planet.tilePositionY -= this.velY;
    this.velX *= FRICTION;
    this.velY *= FRICTION;
  }

  // ── Vista sistema ───────────────────────────────────────────────────────────

  private buildSystemView(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const maxOrbit = Math.min(W * 0.46, H * 0.78);

    this.systemC = this.add.container(0, 0);
    this.orbiting = [];

    // Órbitas (elipses aplastadas para dar perspectiva)
    const orbitGfx = this.add.graphics();
    orbitGfx.lineStyle(1, 0x3a5a8a, 0.25);
    for (const def of PLANETS) {
      orbitGfx.strokeEllipse(cx, cy, def.orbit * maxOrbit * 2, def.orbit * maxOrbit * 2 * 0.42);
    }
    orbitGfx.setDepth(-5);
    this.systemC.add(orbitGfx);

    // Estrella central con pulso
    const sR = Math.min(W, H) * 0.085;
    const glow2 = this.add.circle(cx, cy, sR * 2.4, 0xffc860, 0.07).setDepth(-1);
    const glow1 = this.add.circle(cx, cy, sR * 1.6, 0xffd070, 0.16).setDepth(-0.9);
    const body  = this.add.circle(cx, cy, sR,       0xffdf90, 1).setDepth(0);
    const core  = this.add.circle(cx, cy, sR * 0.6, 0xfff8dc, 1).setDepth(0.1);
    this.systemC.add([glow2, glow1, body, core]);
    this.tweens.add({
      targets: [glow1, glow2], alpha: 0.04, scaleX: 1.12, scaleY: 1.12,
      duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const hint = this.add.text(cx, H - 16, 'Toca un planeta', {
      fontSize: '11px', color: '#6a8ab0', letterSpacing: 1,
    }).setOrigin(0.5, 0.5).setAlpha(0.7).setDepth(10);
    this.systemC.add(hint);

    // Planetas
    for (const def of PLANETS) {
      const img = this.add.image(0, 0, this.miniKey(def));
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.goToPlanet(def);
      });
      img.on('pointerover', () => img.setScale(1.25));
      img.on('pointerout',  () => img.setScale(1));

      this.systemC.add(img);
      this.orbiting.push({
        def, img,
        angle:   Math.random() * Math.PI * 2,
        radiusX: def.orbit * maxOrbit,
        radiusY: def.orbit * maxOrbit * 0.42,
      });
    }
    this.positionOrbits();
  }

  private updateOrbits(delta: number): void {
    for (const o of this.orbiting) {
      o.angle += o.def.speed * (delta / 1000);
    }
    this.positionOrbits();
  }

  private positionOrbits(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    for (const o of this.orbiting) {
      o.img.setPosition(cx + Math.cos(o.angle) * o.radiusX, cy + Math.sin(o.angle) * o.radiusY);
      // Por detrás de la estrella en la mitad superior de la órbita
      o.img.setDepth(Math.sin(o.angle) > 0 ? 2 : -2);
    }
    // Los containers ignoran depth salvo que se ordene la lista explícitamente
    this.systemC?.sort('depth');
  }

  // ── Texturas procedurales ───────────────────────────────────────────────────

  private texKey(def: PlanetDef): string  { return `planet_surface_${def.id}`; }
  private miniKey(def: PlanetDef): string { return `planet_mini_${def.id}`; }

  private createStars(w: number, h: number): void {
    for (let i = 0; i < STAR_COUNT; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        Phaser.Math.FloatBetween(0.5, 1.6),
        0xffffff,
        Phaser.Math.FloatBetween(0.25, 0.9),
      );
      star.setDepth(-10);
      if (Math.random() < 0.25) {
        this.tweens.add({
          targets: star, alpha: 0.1,
          duration: Phaser.Math.Between(800, 2200),
          yoyo: true, repeat: -1,
        });
      }
    }
  }

  private createPlanetTexture(def: PlanetDef): void {
    const key = this.texKey(def);
    if (this.textures.exists(key)) return;
    const canvas = this.textures.createCanvas(key, TEX_SIZE, TEX_SIZE)!;
    const ctx = canvas.context;

    ctx.fillStyle = def.base;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    if (def.kind === 'bands') {
      // Gigante gaseoso: bandas horizontales (la costura del tile cae en un
      // borde de banda, así que no se nota) + óvalos de turbulencia
      const bandCount = 16;
      const bandH = TEX_SIZE / bandCount;
      for (let i = 0; i < bandCount; i++) {
        ctx.fillStyle = def.features[i % def.features.length];
        ctx.fillRect(0, i * bandH, TEX_SIZE, bandH);
      }
      ctx.globalAlpha = 0.25;
      for (let n = 0; n < 30; n++) {
        const ny = Math.random() * TEX_SIZE;
        const nx = Math.random() * TEX_SIZE;
        const r  = 10 + Math.random() * 30;
        ctx.fillStyle = def.features[Math.floor(Math.random() * def.features.length)];
        for (const ox of [-TEX_SIZE, 0, TEX_SIZE]) {
          ctx.beginPath();
          ctx.ellipse(nx + ox, ny, r * 2.2, r * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else {
      // Continentes: blobs duplicados en ±TEX_SIZE para que tilee sin costuras
      for (let c = 0; c < 8; c++) {
        const originX = Math.random() * TEX_SIZE;
        const originY = Math.random() * TEX_SIZE;
        ctx.fillStyle = def.features[c % def.features.length];
        for (let b = 0; b < 14; b++) {
          const bx = originX + (Math.random() - 0.5) * 130;
          const by = originY + (Math.random() - 0.5) * 90;
          const r  = 12 + Math.random() * 34;
          for (const ox of [-TEX_SIZE, 0, TEX_SIZE]) {
            for (const oy of [-TEX_SIZE, 0, TEX_SIZE]) {
              ctx.beginPath();
              ctx.arc(bx + ox, by + oy, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    if (def.cloudAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${def.cloudAlpha})`;
      for (let n = 0; n < 22; n++) {
        const nx = Math.random() * TEX_SIZE;
        const ny = Math.random() * TEX_SIZE;
        const r  = 8 + Math.random() * 26;
        for (const ox of [-TEX_SIZE, 0, TEX_SIZE]) {
          for (const oy of [-TEX_SIZE, 0, TEX_SIZE]) {
            ctx.beginPath();
            ctx.ellipse(nx + ox, ny + oy, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    canvas.refresh();
  }

  // Versión mini pre-renderizada (recorte circular + sombreado) para la vista
  // sistema — evita una máscara por planeta
  private createMiniTexture(def: PlanetDef): void {
    const key = this.miniKey(def);
    if (this.textures.exists(key)) return;
    const d = def.size * 2;
    const canvas = this.textures.createCanvas(key, d, d)!;
    const ctx = canvas.context;

    const src = this.textures.get(this.texKey(def)).getSourceImage() as HTMLCanvasElement;
    ctx.drawImage(src, 0, 0, 220, 220, 0, 0, d, d);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    const grad = ctx.createRadialGradient(d * 0.36, d * 0.34, d * 0.05, d * 0.5, d * 0.5, d * 0.52);
    grad.addColorStop(0,   'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1,   'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2);
    ctx.fill();

    canvas.refresh();
  }

  // Luz arriba-izquierda + sombra en el limbo: el disco pasa a leerse como esfera
  private createShadeTexture(): void {
    if (this.textures.exists(SHADE_KEY)) return;
    const size = 256;
    const canvas = this.textures.createCanvas(SHADE_KEY, size, size)!;
    const ctx = canvas.context;

    const grad = ctx.createRadialGradient(
      size * 0.36, size * 0.34, size * 0.05,
      size * 0.5,  size * 0.5,  size * 0.52,
    );
    grad.addColorStop(0,    'rgba(255, 255, 255, 0.28)');
    grad.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.8,  'rgba(0, 0, 0, 0.38)');
    grad.addColorStop(1,    'rgba(0, 0, 0, 0.82)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    canvas.refresh();
  }
}
