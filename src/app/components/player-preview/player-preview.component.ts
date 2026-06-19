import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { EquipmentService } from 'src/app/services/equipment.service';
import { AsgardService } from 'src/app/services/asgard';
import { EQUIP_LAYER_REGISTRY } from 'src/app/pnj/player/equip-layer-registry';
import { bodySpriteFor } from 'src/app/pnj/player/body-config';
import { LayerSource, loadDecoded, bakeStrip } from '../character-sprite/sprite-strip.util';

const FRAME_SIZE     = 64;
const PREVIEW_START  = 130; // walk_down fila 10 del sheet LPC combinado
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

  constructor(private equipment: EquipmentService, private asgard: AsgardService) {}

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
      { src: bodySpriteFor(this.asgard.selectedPlayer?.name),
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

    const imgs = await Promise.all(sources.map(s => loadDecoded(s.src)));
    const strip = bakeStrip(sources, imgs, this.size, PREVIEW_FRAMES, FRAME_SIZE);
    this.startLoop(strip);
  }

  // El tick solo copia la columna del frame actual del strip ya horneado: blit
  // canvas→canvas, sin decode ni redibujado de capas.
  private startLoop(strip: HTMLCanvasElement): void {
    const tick = () => {
      this.ctx.clearRect(0, 0, this.size, this.size);
      this.ctx.drawImage(strip, this.frameIdx * this.size, 0, this.size, this.size,
                                0, 0, this.size, this.size);
      this.frameIdx = (this.frameIdx + 1) % PREVIEW_FRAMES;
      this.timer = setTimeout(tick, FRAME_MS);
    };
    tick();
  }
}
