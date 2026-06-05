import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { EquipmentService } from 'src/app/services/equipment.service';
import { EQUIP_LAYER_REGISTRY } from 'src/app/pnj/player/equip-layer-registry';

const SHEET_COLS    = 13;
const FRAME_SIZE    = 64;
const PREVIEW_START  = 130; // WALK DOWN fila 10 — existe en todos los sheets LPC
const PREVIEW_FRAMES = 9;
const FRAME_MS       = 130;

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

    const sources: { src: string; depth: number }[] = [
      { src: 'assets/sprites/player/character/body/main.png', depth: 0 },
    ];

    for (const slot of this.equipment.slots) {
      if (!slot.item) continue;
      const cfg = EQUIP_LAYER_REGISTRY[slot.item.name];
      if (cfg) sources.push({ src: cfg.path, depth: cfg.depth });
    }

    sources.sort((a, b) => a.depth - b.depth);

    const imgs = await Promise.all(sources.map(s => this.loadImg(s.src)));
    this.startLoop(imgs);
  }

  private loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(img); // continúa aunque falle
      img.src = src;
      if (img.complete && img.naturalWidth > 0) resolve(img);
    });
  }

  private startLoop(imgs: HTMLImageElement[]): void {
    const tick = () => {
      const frame = PREVIEW_START + this.frameIdx;
      const col   = frame % SHEET_COLS;
      const row   = Math.floor(frame / SHEET_COLS);
      const sx    = col * FRAME_SIZE;
      const sy    = row * FRAME_SIZE;

      this.ctx.clearRect(0, 0, this.size, this.size);
      for (const img of imgs) {
        if (img.naturalWidth > 0) {
          this.ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE, 0, 0, this.size, this.size);
        }
      }

      this.frameIdx = (this.frameIdx + 1) % PREVIEW_FRAMES;
      this.timer = setTimeout(tick, FRAME_MS);
    };
    tick();
  }
}
