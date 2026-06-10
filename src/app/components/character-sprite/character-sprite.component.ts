import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { EquipmentService, EquipmentSnapshot } from 'src/app/services/equipment.service';
import { EQUIP_LAYER_REGISTRY } from 'src/app/pnj/player/equip-layer-registry';

const SHEET_COLS     = 13;
const FRAME_SIZE     = 64;
const PREVIEW_START  = 130;
const PREVIEW_FRAMES = 9;
const FRAME_MS       = 130;

const IMG_CACHE = new Map<string, HTMLImageElement>();

interface LayerSource {
  src: string;
  depth: number;
  sheetStart?: number;
  sheetCols?: number;
}

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
      { src: 'assets/sprites/player/character/body/main.png', depth: 0 },
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
    return sources;
  }

  private async reload(): Promise<void> {
    const sources = this.buildLayers();
    const imgs = await Promise.all(sources.map(s => this.loadImg(s.src)));
    // Detener el loop anterior solo cuando las nuevas imágenes ya están listas
    clearTimeout(this.timer);
    this.frameIdx = 0;
    this.startLoop(sources, imgs);
  }

  private loadImg(src: string): Promise<HTMLImageElement> {
    const cached = IMG_CACHE.get(src);
    if (cached?.naturalWidth > 0) return Promise.resolve(cached);
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { IMG_CACHE.set(src, img); resolve(img); };
      img.onerror = () => resolve(img);
      img.src = src;
      if (img.complete && img.naturalWidth > 0) { IMG_CACHE.set(src, img); resolve(img); }
    });
  }

  private startLoop(sources: LayerSource[], imgs: HTMLImageElement[]): void {
    const tick = () => {
      this.ctx.clearRect(0, 0, this.size, this.size);

      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (img.naturalWidth === 0) continue;
        const src = sources[i];
        let sx: number, sy: number;

        if (src.sheetStart !== undefined && src.sheetCols !== undefined) {
          const absoluteFrame = src.sheetStart + this.frameIdx;
          sx = (absoluteFrame % src.sheetCols) * FRAME_SIZE;
          sy = Math.floor(absoluteFrame / src.sheetCols) * FRAME_SIZE;
        } else {
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
