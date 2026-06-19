import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { EquipmentService, EquipmentSnapshot } from 'src/app/services/equipment.service';
import { EQUIP_LAYER_REGISTRY } from 'src/app/pnj/player/equip-layer-registry';
import { bodySpriteFor } from 'src/app/pnj/player/body-config';
import { LayerSource, loadDecoded, bakeStrip } from './sprite-strip.util';

const FRAME_SIZE     = 64;
const PREVIEW_START  = 130;
const PREVIEW_FRAMES = 9;
const FRAME_MS       = 130;

@Component({
  selector: 'app-character-sprite',
  template: `<canvas #cv [width]="size" [height]="size" class="sprite-canvas"></canvas>`,
  styles: [`:host { display: block; } .sprite-canvas { image-rendering: pixelated; display: block; }`],
  standalone: false,
})
export class CharacterSpriteComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('cv', { static: true }) cvRef: ElementRef<HTMLCanvasElement>;

  /** Tamaño del canvas en px */
  @Input() size = 56;

  /**
   * Si se proporciona, renderiza este snapshot.
   * Si es null usa el personaje activo (EquipmentService reactivo).
   */
  @Input() equipmentSnapshot: EquipmentSnapshot | null = null;

  /** Nombre del personaje: elige su modelo de cuerpo (Gutts tiene el suyo). */
  @Input() characterName: string | null = null;

  private ctx: CanvasRenderingContext2D;
  private timer: ReturnType<typeof setTimeout>;
  private frameIdx = 0;
  private sub: Subscription;

  constructor(private equipment: EquipmentService) {}

  ngOnInit(): void {
    this.ctx = this.cvRef.nativeElement.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    if (this.equipmentSnapshot === null) {
      // Personaje activo — reactivo a cambios de equipo
      this.sub = this.equipment.changes$.pipe(
        startWith(null as void),
        debounceTime(50),
      ).subscribe(() => this.reload());
    } else {
      this.reload();
    }
  }

  ngOnChanges(): void {
    if (this.ctx) this.reload();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.sub?.unsubscribe();
  }

  private buildLayers(): LayerSource[] {
    const sources: LayerSource[] = [
      { src: bodySpriteFor(this.characterName),
        depth: 0, frameSize: FRAME_SIZE, startFrame: PREVIEW_START, frameCount: PREVIEW_FRAMES },
    ];

    const slots: Array<{ item: any }> = this.equipmentSnapshot !== null
      ? Object.values(this.equipmentSnapshot)
          .filter(Boolean)
          .map(item => ({ item }))
      : this.equipment.slots.filter(s => s.item);

    for (const slot of slots) {
      if (!slot.item) continue;
      const cfg = EQUIP_LAYER_REGISTRY[slot.item.name];
      if (!cfg) continue;

      if (cfg.mode === 'anim' && cfg.sheets) {
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
    return sources;
  }

  private async reload(): Promise<void> {
    const sources = this.buildLayers();
    const imgs = await Promise.all(sources.map(s => loadDecoded(s.src)));
    const strip = bakeStrip(sources, imgs, this.size, PREVIEW_FRAMES, FRAME_SIZE);
    // Detener el loop anterior solo cuando el strip nuevo ya está listo
    clearTimeout(this.timer);
    this.frameIdx = 0;
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
