import { Component, inject } from '@angular/core';
import { ENEMY_REGISTRY, EnemyTypeConfig } from 'src/app/enemy/enemy-config';
import { ITEM_CATALOG, LootEntry } from 'src/app/physics/griddrops';
import { SummonService } from 'src/app/services/summon.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { PanelStateService } from 'src/app/services/panel-state.service';

interface EnemyCard {
  type:        string;
  label:       string;
  hp:          number;
  spriteUrl:   string;
  tier:        'base' | 'elite' | 'oblivion';
  frameWidth:  number;
  frameHeight: number;
}

interface EnemyGroup {
  name:     string;
  base:     EnemyCard;
  elite:    EnemyCard | null;
  oblivion: EnemyCard | null;
}

interface ArmorGroup {
  category: string;
  items:    LootEntry[];
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
    { icon: 'bag-handle-outline', title: 'Items'    },
  ];
  private panelState = inject(PanelStateService);

  private _activeTab      = 0;
  private _activeItemTab  = 0;
  private _activeEnemyTab = 0;

  get activeTab():      number { return this._activeTab; }
  get activeItemTab():  number { return this._activeItemTab; }
  get activeEnemyTab(): number { return this._activeEnemyTab; }

  set activeTab(v: number)      { this._activeTab = v;      this.panelState.set('summon.tab', v); }
  set activeItemTab(v: number)  { this._activeItemTab = v;  this.panelState.set('summon.itemTab', v); }
  set activeEnemyTab(v: number) { this._activeEnemyTab = v; this.panelState.set('summon.enemyTab', v); }
  readonly itemSubTabs  = ['Armaduras', 'Armas', 'Miscelánea'];
  readonly enemySubTabs = ['Slimes', 'Miscelánea'];
  readonly slimeGroups: EnemyGroup[];
  readonly miscGroups:  EnemyGroup[];
  readonly armorCatalog:  LootEntry[];
  readonly weaponCatalog: LootEntry[];
  readonly miscCatalog:   LootEntry[];
  readonly armorGroups:   ArmorGroup[];
  openGroups = new Set<string>();

  private armorKeys:  Set<string>;
  private weaponKeys: Set<string>;

  constructor(
    private summonService: SummonService,
    private equipmentService: EquipmentService,
  ) {
    const ARMOR_SLOT_IDS  = new Set(['helmet', 'armor', 'pants', 'boots']);
    const WEAPON_SLOT_IDS = new Set(['weapon']);
    this.armorKeys  = new Set<string>();
    this.weaponKeys = new Set<string>();
    for (const slot of this.equipmentService.slots) {
      if (WEAPON_SLOT_IDS.has(slot.id))      slot.accepts.forEach(a => this.weaponKeys.add(a));
      else if (ARMOR_SLOT_IDS.has(slot.id))  slot.accepts.forEach(a => this.armorKeys.add(a));
    }

    this.armorCatalog  = ITEM_CATALOG.filter(e => this.itemGroup(e) === 'armor');
    this.weaponCatalog = ITEM_CATALOG.filter(e => this.itemGroup(e) === 'weapon');
    this.miscCatalog   = ITEM_CATALOG.filter(e => this.itemGroup(e) === 'misc');

    const ARMOR_ORDER = ['Casco', 'Armadura', 'Pantalones', 'Botas'];
    const groupMap = new Map<string, LootEntry[]>();
    for (const item of this.armorCatalog) {
      const cat = item.category ?? 'Otro';
      if (!groupMap.has(cat)) groupMap.set(cat, []);
      groupMap.get(cat)!.push(item);
    }
    this.armorGroups = [
      ...ARMOR_ORDER.filter(c => groupMap.has(c)).map(c => ({ category: c, items: groupMap.get(c)! })),
      ...Array.from(groupMap.entries()).filter(([c]) => !ARMOR_ORDER.includes(c)).map(([c, items]) => ({ category: c, items })),
    ];
    const allCards = Object.values(ENEMY_REGISTRY).map(cfg => this.toCard(cfg));
    const baseCards = allCards.filter(c => c.tier === 'base');
    const toGroup = (base: EnemyCard): EnemyGroup => ({
      name:     base.label,
      base,
      elite:    allCards.find(c => c.type === `${base.type}_elite`)    ?? null,
      oblivion: allCards.find(c => c.type === `${base.type}_oblivion`) ?? null,
    });
    this.slimeGroups = baseCards.filter(c => c.type.startsWith('slime')).map(toGroup);
    this.miscGroups  = baseCards.filter(c => !c.type.startsWith('slime')).map(toGroup);
    const rawTab         = this.panelState.get('summon.tab', 0) as number;
    this._activeTab      = rawTab === 2 ? 1 : rawTab === 1 ? 0 : rawTab;
    this._activeItemTab  = this.panelState.get('summon.itemTab',  0);
    this._activeEnemyTab = this.panelState.get('summon.enemyTab', 0);
  }

  summon(type: string): void {
    this.summonService.summon(type);
  }

  giveItem(entry: LootEntry): void {
    this.summonService.dropItem(entry);
  }

  getSheetPos(frame = 0, cols = 12, frameSize = 32, contentSize?: number): string {
    const cs    = contentSize ?? frameSize;
    const scale = 32 / cs;
    const col   = frame % cols;
    const row   = Math.floor(frame / cols);
    return `-${col * frameSize * scale}px -${row * frameSize * scale}px`;
  }

  getSheetBgSize(cols = 12, frameSize = 32, contentSize?: number): string {
    const cs = contentSize ?? frameSize;
    return `${cols * frameSize * (32 / cs)}px auto`;
  }

  toggleGroup(category: string): void {
    if (this.openGroups.has(category)) this.openGroups.delete(category);
    else this.openGroups.add(category);
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
      type:        cfg.type,
      label:       this.formatLabel(cfg.type),
      hp:          cfg.hp,
      spriteUrl,
      tier,
      frameWidth:  idleCfg?.frameWidth  ?? 64,
      frameHeight: idleCfg?.frameHeight ?? 64,
    };
  }

  enemyFrameStyle(card: EnemyCard): Record<string, string> {
    const BOX = 72;
    const scale = BOX / Math.max(card.frameWidth, card.frameHeight);
    return {
      width:           `${card.frameWidth}px`,
      height:          `${card.frameHeight}px`,
      transform:       `scale(${scale})`,
      transformOrigin: '0 0',
    };
  }

  private formatLabel(type: string): string {
    return type.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
}
