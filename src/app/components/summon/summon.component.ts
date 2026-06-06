import { Component } from '@angular/core';
import { ENEMY_REGISTRY, EnemyTypeConfig } from 'src/app/enemy/enemy-config';
import { MAP_REGISTRY, MapConfig } from 'src/app/scenes/gamescene/map-config';
import { ITEM_CATALOG, LootEntry } from 'src/app/physics/griddrops';
import { SummonService } from 'src/app/services/summon.service';
import { WorldService } from 'src/app/services/world.service';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { EquipmentService } from 'src/app/services/equipment.service';

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

  readonly tabs = [
    { icon: 'skull-outline',      title: 'Enemigos' },
    { icon: 'map-outline',        title: 'Mapas'    },
    { icon: 'bag-handle-outline', title: 'Items'    },
  ];
  activeTab     = 0;
  activeItemTab = 0;
  readonly itemSubTabs = ['Armaduras', 'Armas', 'Miscelánea'];
  readonly enemyGroups: EnemyGroup[];
  readonly maps: MapConfig[];
  readonly armorCatalog:  LootEntry[];
  readonly weaponCatalog: LootEntry[];
  readonly miscCatalog:   LootEntry[];

  private armorKeys:  Set<string>;
  private weaponKeys: Set<string>;

  constructor(
    private summonService: SummonService,
    private worldService: WorldService,
    private playerBridge: PlayerBridgeService,
    private equipmentService: EquipmentService,
  ) {
    this.armorKeys  = new Set<string>();
    this.weaponKeys = new Set<string>();
    for (const slot of this.equipmentService.slots) {
      if (slot.id === 'weapon') slot.accepts.forEach(a => this.weaponKeys.add(a));
      else                      slot.accepts.forEach(a => this.armorKeys.add(a));
    }

    this.armorCatalog  = ITEM_CATALOG.filter(e => this.itemGroup(e) === 'armor');
    this.weaponCatalog = ITEM_CATALOG.filter(e => this.itemGroup(e) === 'weapon');
    this.miscCatalog   = ITEM_CATALOG.filter(e => this.itemGroup(e) === 'misc');
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

  giveItem(entry: LootEntry): void {
    this.summonService.dropItem(entry);
  }

  getSheetPos(frame = 0, cols = 12, frameSize = 32): string {
    const display = 32;
    const scale   = display / frameSize;
    const col     = frame % cols;
    const row     = Math.floor(frame / cols);
    return `-${col * frameSize * scale}px -${row * frameSize * scale}px`;
  }

  getSheetBgSize(cols = 12, frameSize = 32): string {
    return `${cols * 32}px auto`;
  }

  private itemGroup(entry: LootEntry): 'armor' | 'weapon' | 'misc' {
    const key = entry.category ?? entry.name;
    if (this.armorKeys.has(key))  return 'armor';
    if (this.weaponKeys.has(key)) return 'weapon';
    return 'misc';
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
