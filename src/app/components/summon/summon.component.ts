import { Component } from '@angular/core';
import { ENEMY_REGISTRY, EnemyTypeConfig } from 'src/app/enemy/enemy-config';
import { MAP_REGISTRY, MapConfig } from 'src/app/scenes/gamescene/map-config';
import { SummonService } from 'src/app/services/summon.service';
import { WorldService } from 'src/app/services/world.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';

interface EnemyCard {
  type:      string;
  label:     string;
  hp:        number;
  spriteUrl: string;
  tier:      'base' | 'elite' | 'oblivion';
}

interface EnemyGroup {
  name:     string;
  base:     EnemyCard;
  elite:    EnemyCard | null;
  oblivion: EnemyCard | null;
}

@Component({
  selector: 'app-summon',
  templateUrl: './summon.component.html',
  styleUrls: ['./summon.component.scss'],
  standalone: false,
})
export class SummonComponent {

  readonly tabs = ['Enemigos', 'Mapas'];
  activeTab     = 0;
  readonly enemyGroups: EnemyGroup[];
  readonly maps: MapConfig[];

  constructor(
    private summonService: SummonService,
    private worldService: WorldService,
    private playerBridge: PlayerBridgeService,
  ) {
    const allCards = Object.values(ENEMY_REGISTRY).map(cfg => this.toCard(cfg));
    const baseCards = allCards.filter(c => c.tier === 'base');
    this.enemyGroups = baseCards.map(base => ({
      name:     base.label,
      base,
      elite:    allCards.find(c => c.type === `${base.type}_elite`)    ?? null,
      oblivion: allCards.find(c => c.type === `${base.type}_oblivion`) ?? null,
    }));
    this.maps = Object.values(MAP_REGISTRY);
  }

  get currentMapId(): string {
    return this.worldService.getCurrentMap().id;
  }

  summon(type: string): void {
    this.summonService.summon(type);
  }

  teleport(mapId: string): void {
    if (mapId === this.currentMapId) return;
    this.worldService.setCurrentMap(mapId);
    this.playerBridge.restartGameScene();
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
