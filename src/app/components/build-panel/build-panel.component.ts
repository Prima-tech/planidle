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

  select(def: BuildableDef): void {
    this.cityBuild.startPlacement(def);
  }

  /** Recorte del frame de un spritesheet 32×32 (mismo cálculo que summon). */
  frameStyle(def: BuildableDef): Record<string, string> {
    const scale = 2;
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
