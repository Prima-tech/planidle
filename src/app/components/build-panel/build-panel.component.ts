import { Component, inject } from '@angular/core';
import { BuildableDef, CityBuildService } from 'src/app/services/city-build.service';

@Component({
  selector: 'app-build-panel',
  templateUrl: './build-panel.component.html',
  styleUrls: ['./build-panel.component.scss'],
  standalone: false,
})
export class BuildPanelComponent {

  private cityBuild = inject(CityBuildService);

  readonly CHEST_FRAME_SIZE = 32;
  readonly CHEST_COLS       = 9;

  /** Construibles disponibles: oculta los uniques ya construidos. */
  get buildables(): BuildableDef[] {
    return this.cityBuild.buildables.filter(d => !(d.unique && this.cityBuild.isBuilt(d.type)));
  }

  /** ¿Hay edificios colocados que se puedan mover? */
  get hasBuildings(): boolean {
    return this.cityBuild.hasBuildings();
  }

  select(def: BuildableDef): void {
    this.cityBuild.startPlacement(def);
  }

  /** Entra en modo "mover edificio": pinchar un edificio del mapa lo edita. */
  startMove(): void {
    this.cityBuild.startMoveMode();
  }

  /** Entra en modo "borrar edificio": pinchar un edificio pide confirmación. */
  startDelete(): void {
    this.cityBuild.startDeleteMode();
  }

  /** Recorte del frame para el preview de la ficha.
   *  - Con `previewSrc` (estaciones): recorte explícito en px de la hoja `previewUrl`.
   *  - Sin él (cofre/tienda): rejilla por defecto de la hoja 'chests' (9 cols, 32×32, ×2). */
  frameStyle(def: BuildableDef): Record<string, string> {
    if (def.previewSrc && def.previewSheet) {
      const s = def.previewScale ?? 1;
      const r = def.previewSrc, sheet = def.previewSheet;
      return {
        'background-image':    `url(${def.previewUrl})`,
        'background-repeat':   'no-repeat',
        'background-size':     `${sheet.w * s}px ${sheet.h * s}px`,
        'background-position': `-${r.x * s}px -${r.y * s}px`,
        'image-rendering':     'pixelated',
        'width':               `${r.w * s}px`,
        'height':              `${r.h * s}px`,
      };
    }
    const scale = def.previewScale ?? 2;
    const size  = this.CHEST_FRAME_SIZE;
    return {
      'background-image':    `url(assets/sprites/resources/${def.spriteKey}.png)`,
      'background-repeat':   'no-repeat',
      'background-size':     `${this.CHEST_COLS * size * scale}px auto`,
      'background-position': `-${def.frame * size * scale}px 0px`,
      'image-rendering':     'pixelated',
      'width':               `${size * scale}px`,
      'height':              `${size * scale}px`,
    };
  }
}
