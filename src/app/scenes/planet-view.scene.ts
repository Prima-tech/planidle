import Phaser from 'phaser';

// Esfera fake-3D: TileSprite con máscara circular — la textura se desplaza
// dentro del disco y una capa de sombreado radial vende el volumen.
// Mucho mejor acabado que rotar un sprite plano (se nota disco al instante).

const FRICTION   = 0.94;   // decaimiento de la inercia por frame
const MIN_VEL    = 0.02;   // umbral para frenar del todo
const DRAG_Y     = 0.5;    // el arrastre vertical pesa menos (sensación de eje)
const STAR_COUNT = 90;

const TEX_KEY   = 'planet_surface';
const SHADE_KEY = 'planet_shade';
const TEX_SIZE  = 512;

export class PlanetViewScene extends Phaser.Scene {

  private planet!: Phaser.GameObjects.TileSprite;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private velX = 0;
  private velY = 0;

  constructor() { super({ key: 'PlanetViewScene' }); }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.34;

    this.cameras.main.setBackgroundColor('#05060f');
    this.createStars(W, H);
    this.createPlanetTexture();

    // Halo atmosférico detrás del planeta
    this.add.circle(cx, cy, radius + 6, 0x3a7ac8, 0.18);
    this.add.circle(cx, cy, radius + 2, 0x000000, 0)
      .setStrokeStyle(2, 0x5b9fe0, 0.45);

    this.planet = this.add.tileSprite(cx, cy, radius * 2, radius * 2, TEX_KEY);
    const maskShape = this.make.graphics({}, false);
    maskShape.fillCircle(cx, cy, radius);
    this.planet.setMask(maskShape.createGeometryMask());

    this.createShading(cx, cy, radius);
    this.initDrag();
  }

  override update(): void {
    if (this.dragging) return;
    if (Math.abs(this.velX) < MIN_VEL && Math.abs(this.velY) < MIN_VEL) return;
    this.planet.tilePositionX -= this.velX;
    this.planet.tilePositionY -= this.velY;
    this.velX *= FRICTION;
    this.velY *= FRICTION;
  }

  // ── Input: drag con inercia ─────────────────────────────────────────────────

  private initDrag(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.lastX = p.x;
      this.lastY = p.y;
      this.velX = 0;
      this.velY = 0;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const dx = p.x - this.lastX;
      const dy = (p.y - this.lastY) * DRAG_Y;
      this.lastX = p.x;
      this.lastY = p.y;
      // La superficie sigue al dedo; la velocidad del último frame alimenta la inercia
      this.planet.tilePositionX -= dx;
      this.planet.tilePositionY -= dy;
      this.velX = dx;
      this.velY = dy;
    });

    const stop = () => { this.dragging = false; };
    this.input.on('pointerup', stop);
    this.input.on('pointerupoutside', stop);
  }

  // ── Texturas procedurales ───────────────────────────────────────────────────

  private createStars(w: number, h: number): void {
    for (let i = 0; i < STAR_COUNT; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        Phaser.Math.FloatBetween(0.5, 1.6),
        0xffffff,
        Phaser.Math.FloatBetween(0.25, 0.9),
      );
      if (Math.random() < 0.25) {
        this.tweens.add({
          targets: star, alpha: 0.1,
          duration: Phaser.Math.Between(800, 2200),
          yoyo: true, repeat: -1,
        });
      }
    }
  }

  // Océano + continentes. Cada blob se pinta también desplazado ±TEX_SIZE en
  // ambos ejes para que la textura tilee sin costuras al hacer scroll.
  private createPlanetTexture(): void {
    if (this.textures.exists(TEX_KEY)) return;
    const canvas = this.textures.createCanvas(TEX_KEY, TEX_SIZE, TEX_SIZE)!;
    const ctx = canvas.context;

    ctx.fillStyle = '#16456e';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const GREENS = ['#3a7a44', '#46905a', '#54a060'];
    for (let c = 0; c < 8; c++) {
      const originX = Math.random() * TEX_SIZE;
      const originY = Math.random() * TEX_SIZE;
      ctx.fillStyle = GREENS[c % GREENS.length];
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

    // Nubes sutiles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
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

    canvas.refresh();
  }

  // Luz arriba-izquierda + sombra en el limbo: el disco pasa a leerse como esfera
  private createShading(cx: number, cy: number, radius: number): void {
    const size = Math.ceil(radius * 2);
    if (this.textures.exists(SHADE_KEY)) this.textures.remove(SHADE_KEY);
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

    this.add.image(cx, cy, SHADE_KEY);
  }
}
