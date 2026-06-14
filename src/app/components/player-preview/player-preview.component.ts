import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { EquipmentService } from 'src/app/services/equipment.service';
import { EQUIP_LAYER_REGISTRY } from 'src/app/pnj/player/equip-layer-registry';

const FRAME_SIZE     = 64;
const PREVIEW_START  = 130; // walk_down fila 10 del sheet LPC combinado
const PREVIEW_FRAMES = 9;
const FRAME_MS       = 130;

interface LayerSource {
  src: string;
  depth: number;
  frameSize: number;   // px por frame en ESTA hoja (64 normal, 128 armas oversize)
  startFrame: number;  // primer frame de walk_down (índice global en su propia rejilla)
  frameCount: number;  // nº de frames del ciclo de andar (1 = pose estática)
}

@Component({
  selector: 'app-player-preview',
  template: `<canvas #cv [width]="size" [height]="size" class="preview-canvas"></canvas>`,
  styles: [`:host { display: block; } .preview-canvas { image-rendering: pixelated; display: block; }`],
  standalone: false,
})
export class PlayerPreviewComponent implements OnInit, OnDestroy {

  @ViewChild('cv', { static: true }) cvRef: ElementRef<HTMLCanvasElement>;
  @Input() size = 128;

  private ctx: CanvasRenderingContext2D;
  private timer: ReturnType<typeof setTimeout>;
  private frameIdx = 0;
  private sub: Subscription;

  constructor(private equipment: EquipmentService) {}

  ngOnInit(): void {
    this.ctx = this.cvRef.nativeElement.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.sub = this.equipment.changes$.pipe(
      startWith(null as void),
      debounceTime(50),
    ).subscribe(() => this.reload());
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.sub?.unsubscribe();
  }

  private async reload(): Promise<void> {
    clearTimeout(this.timer);
    this.frameIdx = 0;

    const sources: LayerSource[] = [
      { src: 'assets/sprites/player/character/body/main.png',
        depth: 0, frameSize: FRAME_SIZE, startFrame: PREVIEW_START, frameCount: PREVIEW_FRAMES },
    ];

    for (const slot of this.equipment.slots) {
      if (!slot.item) continue;
      const cfg = EQUIP_LAYER_REGISTRY[slot.item.name];
      if (!cfg) continue;

      if (cfg.mode === 'anim' && cfg.sheets) {
        // Busca la hoja que contiene walk_down y extrae sus parámetros de frame
        for (const sheet of cfg.sheets) {
          const walkDown = sheet.anims.find(a => a.key.includes('_walk_down'));
          if (walkDown) {
            sources.push({
              src: sheet.path,
              depth: cfg.depth,
              frameSize: sheet.frameWidth,
              startFrame: walkDown.startFrame,
              frameCount: walkDown.endFrame - walkDown.startFrame + 1,
            });
            break;
          }
        }
      } else if (cfg.path) {
        sources.push({
          src: cfg.path, depth: cfg.depth,
          frameSize: cfg.frameWidth ?? FRAME_SIZE, startFrame: PREVIEW_START, frameCount: PREVIEW_FRAMES,
        });
      }
    }

    sources.sort((a, b) => a.depth - b.depth);

    const imgs = await Promise.all(sources.map(s => this.loadImg(s.src)));
    this.startLoop(sources, imgs);
  }

  private loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = src;
      if (img.complete && img.naturalWidth > 0) resolve(img);
    });
  }

  private startLoop(sources: LayerSource[], imgs: HTMLImageElement[]): void {
    const scale = this.size / FRAME_SIZE;   // el cuerpo (64px) llena el canvas
    const tick = () => {
      this.ctx.clearRect(0, 0, this.size, this.size);

      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (img.naturalWidth === 0) continue;
        const src = sources[i];

        // Columnas reales de la hoja (no el nº de frames de walk) para mapear bien
        // hojas LPC combinadas (13 cols) y oversize (128px). Cada capa cicla solo
        // sus propios frames de walk: frameCount=1 → pose estática (sin slash).
        const cols = Math.max(1, Math.round(img.naturalWidth / src.frameSize));
        const frame = src.startFrame + (this.frameIdx % src.frameCount);
        const sx = (frame % cols) * src.frameSize;
        const sy = Math.floor(frame / cols) * src.frameSize;

        // Centra el frame: las hojas oversize (128) tienen el personaje centrado,
        // su región central de 64px se alinea con el cuerpo.
        const dSize = src.frameSize * scale;
        const dOff  = (this.size - dSize) / 2;
        this.ctx.drawImage(img, sx, sy, src.frameSize, src.frameSize, dOff, dOff, dSize, dSize);
      }

      this.frameIdx = (this.frameIdx + 1) % PREVIEW_FRAMES;
      this.timer = setTimeout(tick, FRAME_MS);
    };
    tick();
  }
}
