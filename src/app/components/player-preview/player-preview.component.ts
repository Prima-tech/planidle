import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { EquipmentService } from 'src/app/services/equipment.service';
import { EQUIP_LAYER_REGISTRY } from 'src/app/pnj/player/equip-layer-registry';

const SHEET_COLS   = 13;
const FRAME_SIZE   = 64;
const IDLE_START   = 312; // idle DOWN frame 0
const IDLE_FRAMES  = 2;
const FRAME_MS     = 500;

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

  constructor(private equipment: EquipmentService) {}

  ngOnInit(): void {
    this.ctx = this.cvRef.nativeElement.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.loadAndAnimate();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  private loadAndAnimate(): void {
    const layers: { img: HTMLImageElement; depth: number }[] = [];

    const body = new Image();
    body.src = 'assets/sprites/player/character/body/main.png';
    layers.push({ img: body, depth: 0 });

    for (const slot of this.equipment.slots) {
      if (!slot.item) continue;
      const cfg = EQUIP_LAYER_REGISTRY[slot.item.name];
      if (!cfg) continue;
      const img = new Image();
      img.src = cfg.path;
      layers.push({ img, depth: cfg.depth });
    }

    layers.sort((a, b) => a.depth - b.depth);

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded === layers.length) this.startLoop(layers.map(l => l.img));
    };

    for (const l of layers) {
      if (l.img.complete) { onLoad(); }
      else { l.img.onload = onLoad; }
    }
  }

  private startLoop(imgs: HTMLImageElement[]): void {
    const tick = () => {
      const frame = IDLE_START + this.frameIdx;
      const col   = frame % SHEET_COLS;
      const row   = Math.floor(frame / SHEET_COLS);
      const sx    = col * FRAME_SIZE;
      const sy    = row * FRAME_SIZE;

      this.ctx.clearRect(0, 0, this.size, this.size);
      for (const img of imgs) {
        this.ctx.drawImage(img, sx, sy, FRAME_SIZE, FRAME_SIZE, 0, 0, this.size, this.size);
      }

      this.frameIdx = (this.frameIdx + 1) % IDLE_FRAMES;
      this.timer = setTimeout(tick, FRAME_MS);
    };
    tick();
  }
}
