import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { EquipmentService } from 'src/app/services/equipment.service';
import { EQUIP_LAYER_REGISTRY } from 'src/app/pnj/player/equip-layer-registry';

const SHEET_COLS     = 13;
const FRAME_SIZE     = 64;
const PREVIEW_START  = 130; // walk_down fila 10 del sheet LPC combinado
const PREVIEW_FRAMES = 9;
const FRAME_MS       = 130;

interface LayerSource {
  src: string;
  depth: number;
  sheetStart?: number; // frame donde empieza walk_down en la hoja separada
  sheetCols?: number;  // frames por fila en esa hoja
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
      { src: 'assets/sprites/player/character/body/main.png', depth: 0 },
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
            const framesPerRow = walkDown.endFrame - walkDown.startFrame + 1;
            sources.push({
              src: sheet.path,
              depth: cfg.depth,
              sheetStart: walkDown.startFrame,
              sheetCols: framesPerRow,
            });
            break;
          }
        }
      } else if (cfg.path) {
        sources.push({ src: cfg.path, depth: cfg.depth });
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
    const tick = () => {
      this.ctx.clearRect(0, 0, this.size, this.size);

      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (img.naturalWidth === 0) continue;
        const src = sources[i];

        let sx: number;
        let sy: number;

        if (src.sheetStart !== undefined && src.sheetCols !== undefined) {
          // Sheet separado (mode:'anim'): calcular frame dentro de su propia cuadrícula
          const absoluteFrame = src.sheetStart + this.frameIdx;
          sx = (absoluteFrame % src.sheetCols) * FRAME_SIZE;
          sy = Math.floor(absoluteFrame / src.sheetCols) * FRAME_SIZE;
        } else {
          // Sheet LPC combinado estándar (mode:'frame')
          const frame = PREVIEW_START + this.frameIdx;
          sx = (frame % SHEET_COLS) * FRAME_SIZE;
          sy = Math.floor(frame / SHEET_COLS) * FRAME_SIZE;
        }

        this.ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE, 0, 0, this.size, this.size);
      }

      this.frameIdx = (this.frameIdx + 1) % PREVIEW_FRAMES;
      this.timer = setTimeout(tick, FRAME_MS);
    };
    tick();
  }
}
