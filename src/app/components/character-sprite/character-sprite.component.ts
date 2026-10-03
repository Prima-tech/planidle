import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { EquipmentService, EquipmentSnapshot } from 'src/app/services/equipment.service';
import { EQUIP_LAYER_REGISTRY } from 'src/app/pnj/player/equip-layer-registry';
import { bodySpriteFor } from 'src/app/pnj/player/body-config';
import { LayerSource, loadDecoded, getDecodedSync, bakeStripCached } from './sprite-strip.util';

const FRAME_SIZE     = 64;
const PREVIEW_START  = 130;
const PREVIEW_FRAMES = 9;
const FRAME_MS       = 130;

/** Capas (cuerpo + equipo) del preview de un personaje, ordenadas por profundidad.
 *  `items` = items equipados (snapshot o slots del EquipmentService). */
export function characterLayerSources(characterName: string | null, items: any[]): LayerSource[] {
  const sources: LayerSource[] = [
    { src: bodySpriteFor(characterName),
      depth: 0, frameSize: FRAME_SIZE, startFrame: PREVIEW_START, frameCount: PREVIEW_FRAMES },
  ];

  for (const item of items) {
    if (!item) continue;
    const cfg = EQUIP_LAYER_REGISTRY[item.name];
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

/** Decodifica por adelantado las hojas del preview de un personaje (caché de
 *  loadDecoded), para que su <app-character-sprite> salga al instante. */
export function prewarmCharacterSprite(characterName: string | null, items: any[]): Promise<unknown> {
  return Promise.all(characterLayerSources(characterName, items).map(s => loadDecoded(s.src)));
}

@Component({
  selector: 'app-character-sprite',
  // Sin [width]/[height] en la plantilla: ese binding se aplica DESPUÉS de ngOnInit y
  // redimensionar un canvas lo borra, así que se perdía el primer frame (~130 ms en
  // blanco). El tamaño se fija a mano antes de pintar (fitCanvas).
  template: `<canvas #cv class="sprite-canvas"></canvas>`,
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
    this.fitCanvas();
    this.ctx = this.cvRef.nativeElement.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    // Primer pintado YA (sin el debounce: antes retrasaba 50 ms la carga inicial)
    this.reload();
    if (this.equipmentSnapshot === null) {
      // Personaje activo — reactivo a cambios de equipo
      this.sub = this.equipment.changes$.pipe(debounceTime(50)).subscribe(() => this.reload());
    }
  }

  /** Ajusta el canvas a `size` solo si cambia (asignar width, aunque sea igual, lo borra). */
  private fitCanvas(): void {
    const cv = this.cvRef.nativeElement;
    if (cv.width !== this.size) cv.width = this.size;
    if (cv.height !== this.size) cv.height = this.size;
  }

  ngOnChanges(): void {
    if (!this.ctx) return;
    this.fitCanvas();
    this.ctx.imageSmoothingEnabled = false;   // se resetea al redimensionar
    this.reload();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.sub?.unsubscribe();
  }

  private buildLayers(): LayerSource[] {
    const items = this.equipmentSnapshot !== null
      ? Object.values(this.equipmentSnapshot)
      : this.equipment.slots.map(s => s.item);
    return characterLayerSources(this.characterName, items);
  }

  private async reload(): Promise<void> {
    const sources = this.buildLayers();
    // Si todas las hojas ya están decodificadas (precalentadas o vistas antes) se
    // pinta en este mismo frame; si no, se espera al decode como siempre.
    const ready = sources.map(s => getDecodedSync(s.src));
    const imgs = ready.every(d => d !== undefined)
      ? ready
      : await Promise.all(sources.map(s => loadDecoded(s.src)));
    const strip = bakeStripCached(sources, imgs, this.size, PREVIEW_FRAMES, FRAME_SIZE);
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
