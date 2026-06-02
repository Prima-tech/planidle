import { Component } from '@angular/core';
import { ENEMY_REGISTRY, EnemyTypeConfig } from 'src/app/enemy/enemy-config';
import { SummonService } from 'src/app/services/summon.service';

interface EnemyCard {
  type:      string;
  label:     string;
  hp:        number;
  spriteUrl: string;
  tier:      'base' | 'elite' | 'oblivion';
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

    const spriteUrl = idleCfg
      ? `assets/sprites/enemy/${baseType}/${idleCfg.filename}.png`
      : '';

    return {
      type: cfg.type,
      label: this.formatLabel(cfg.type),
      hp:    cfg.hp,
      spriteUrl,
      tier,
    };
  }

  private formatLabel(type: string): string {
    return type.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
}
