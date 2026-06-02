import { Component } from '@angular/core';
import { ENEMY_REGISTRY, EnemyTypeConfig } from 'src/app/enemy/enemy-config';
import { SummonService } from 'src/app/services/summon.service';

const PREVIEW_SIZE = 48; // px del cuadro del botón

interface EnemyCard {
  type:        string;
  label:       string;
  hp:          number;
  frameStyle:  { [key: string]: string };
  tier:        'base' | 'elite' | 'oblivion';
}

@Component({
  selector: 'app-summon',
  templateUrl: './summon.component.html',
  styleUrls: ['./summon.component.scss'],
  standalone: false,
})
export class SummonComponent {

  readonly tabs  = ['Enemigos'];
  activeTab      = 0;
  readonly enemies: EnemyCard[];

  constructor(private summonService: SummonService) {
    this.enemies = Object.values(ENEMY_REGISTRY).map(cfg => this.toCard(cfg));
  }

  summon(type: string): void {
    this.summonService.summon(type);
  }

  private toCard(cfg: EnemyTypeConfig): EnemyCard {
    const baseType = cfg.spriteType ?? cfg.type;
    const idleCfg  = ENEMY_REGISTRY[baseType]?.actions.idle ?? cfg.actions.idle;

    const tier: EnemyCard['tier'] = cfg.type.endsWith('_oblivion') ? 'oblivion'
                                  : cfg.type.endsWith('_elite')    ? 'elite'
                                  : 'base';

    const frameStyle = idleCfg ? this.buildFrameStyle(baseType, idleCfg.filename, idleCfg.frameHeight) : {};

    return {
      type:  cfg.type,
      label: this.formatLabel(cfg.type),
      hp:    cfg.hp,
      frameStyle,
      tier,
    };
  }

  // Muestra solo el primer frame (DOWN idle) usando background-image + clip.
  // background-size escala el alto al tamaño del cuadro; la anchura se ajusta
  // proporcionalmente → el primer frame (cuadrado) queda alineado en 0 0.
  private buildFrameStyle(baseType: string, filename: string, frameHeight: number): { [key: string]: string } {
    const scale   = PREVIEW_SIZE / frameHeight;
    return {
      'background-image':    `url(assets/sprites/enemy/${baseType}/${filename}.png)`,
      'background-position': '0 0',
      'background-repeat':   'no-repeat',
      'background-size':     `auto ${PREVIEW_SIZE}px`,
      'image-rendering':     'pixelated',
    };
  }

  private formatLabel(type: string): string {
    return type.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
}
