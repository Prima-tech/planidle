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
    { icon: 'skull-outline',      title: 'Enemies' },
    { icon: 'bag-handle-outline', title: 'Items'   },
    { icon: 'cube-outline',       title: 'Chests'  },
    { icon: 'images-outline',     title: 'Iconos'  },
  ];

  /** Índices 0-8, uno por columna del spritesheet chests.png (32×32 por frame, 9 cols). */
  readonly chestIndices = [0,1,2,3,4,5,6,7,8];
  readonly CHEST_FRAME_SIZE = 32;
  readonly CHEST_COLS       = 9;

  chestFrameStyle(col: number): Record<string, string> {
    const scale = 2;
    return {
      'background-image':    `url(assets/sprites/resources/chests.png)`,
      'background-repeat':   'no-repeat',
      'background-size':     `${this.CHEST_COLS * this.CHEST_FRAME_SIZE * scale}px auto`,
      'background-position': `-${col * this.CHEST_FRAME_SIZE * scale}px 0px`,
      'image-rendering':     'pixelated',
      'width':               `${this.CHEST_FRAME_SIZE * scale}px`,
      'height':              `${this.CHEST_FRAME_SIZE * scale}px`,
    };
  }

  summonChest(index: number): void {
    this.summonService.spawnChest(index);
  }
  private panelState = inject(PanelStateService);

  private _activeTab      = 0;
  private _activeItemTab  = 0;
  private _activeEnemyTab = 0;
  private _activeIconTab  = 0;

  get activeTab():      number { return this._activeTab; }
  get activeItemTab():  number { return this._activeItemTab; }
  get activeEnemyTab(): number { return this._activeEnemyTab; }
  get activeIconTab():  number { return this._activeIconTab; }

  set activeTab(v: number)      { this._activeTab = v;      this.panelState.set('summon.tab', v); }
  set activeItemTab(v: number)  { this._activeItemTab = v;  this.panelState.set('summon.itemTab', v); }
  set activeEnemyTab(v: number) { this._activeEnemyTab = v; this.panelState.set('summon.enemyTab', v); }
  set activeIconTab(v: number)  { this._activeIconTab = v;  this.panelState.set('summon.iconTab', v); }
  readonly itemSubTabs  = ['Armor', 'Weapons', 'Misc'];
  readonly enemySubTabs = ['Slimes', 'Misc'];
  readonly iconSubTabs  = ['Misc', '···'];

  readonly miscIcons: { frame: number; name: string }[] = [
    // Row 0
    { frame:  0, name: 'Hueso' },        { frame:  1, name: 'Varita' },
    { frame:  2, name: 'Llave' },        { frame:  3, name: 'Flor Rosa' },
    { frame:  4, name: 'Llave Inglesa'}, { frame:  5, name: 'Tijeras' },
    { frame:  6, name: 'Aguja' },        { frame:  7, name: 'Arco' },
    { frame:  8, name: 'Flecha' },       { frame:  9, name: 'Llave Azul' },
    { frame: 10, name: 'Crista Cel.' },  { frame: 11, name: 'Piedra Osc.' },
    { frame: 12, name: 'Pluma' },        { frame: 13, name: 'Llave Oro' },
    { frame: 14, name: 'Frag. Azul' },
    // Row 1
    { frame: 15, name: 'Tierra' },       { frame: 16, name: 'Gravilla' },
    { frame: 17, name: 'Guijarros' },    { frame: 18, name: 'Mon. Cobre' },
    { frame: 19, name: 'Zafiro Sm' },    { frame: 20, name: 'Monedas' },
    { frame: 21, name: 'Orbe Azul Sm'}, { frame: 22, name: 'Mon. Oro' },
    { frame: 23, name: 'Rocas Grises'}, { frame: 24, name: 'Disco Azul' },
    { frame: 25, name: 'Disco Plata' },  { frame: 26, name: 'Perla' },
    { frame: 27, name: 'Frag. Gris' },  { frame: 28, name: 'Rubí Sm' },
    { frame: 29, name: 'Gema Cel.' },
    // Row 2
    { frame: 30, name: 'Arcilla' },      { frame: 31, name: 'Barro' },
    { frame: 32, name: 'Roca Marrón' },  { frame: 33, name: 'Mon. Bronce' },
    { frame: 34, name: 'Zafiro' },       { frame: 35, name: 'Min. Hierro' },
    { frame: 36, name: 'Orbe Azul' },    { frame: 37, name: 'Min. Bronce' },
    { frame: 38, name: 'Piedra' },       { frame: 39, name: 'Mon. Azul' },
    { frame: 40, name: 'Mon. Plata' },   { frame: 41, name: 'Perla Gde.' },
    { frame: 42, name: 'Min. Oscuro' },  { frame: 43, name: 'Rubí' },
    { frame: 44, name: 'Crist. Teal' },
    // Row 3
    { frame: 45, name: 'Shard Nar.' },   { frame: 46, name: 'Shard Azul' },
    { frame: 47, name: 'Shard Blanc.' }, { frame: 48, name: 'Arcilla Sm' },
    { frame: 49, name: 'Ópalo Nar.' },   { frame: 50, name: 'Barro Osc.' },
    { frame: 51, name: 'Esf. Naranja'}, { frame: 52, name: 'Roca Redonda'},
    { frame: 53, name: 'Bola Piedra' },  { frame: 54, name: 'Gema Naranja'},
    { frame: 55, name: 'Jarra Azul' },   { frame: 56, name: 'Jarra Marr.' },
    { frame: 57, name: 'Gema Teal' },    { frame: 58, name: 'Vial Naranja'},
    { frame: 59, name: 'Vial Oscuro' },
    // Row 4
    { frame: 60, name: 'Llama' },        { frame: 61, name: 'Corona Orn.' },
    { frame: 62, name: 'Corona Sm' },    { frame: 63, name: 'Corona Dor.' },
    { frame: 64, name: 'Corona Fuego'}, { frame: 65, name: 'Llama Azul' },
    { frame: 66, name: 'Gota Agua' },    { frame: 67, name: 'Huevo Roto' },
    { frame: 68, name: 'Ojo Mágico' },   { frame: 69, name: 'Sello Rojo' },
    { frame: 70, name: 'Gema Azul Gde'},{ frame: 71, name: 'Crist. Cel.' },
    { frame: 72, name: 'Gema Púrp.' },   { frame: 73, name: 'Lágrima Az.'},
    { frame: 74, name: 'Gota Azul' },
    // Row 5
    { frame: 75, name: 'Anillo Plata'}, { frame: 76, name: 'Anillo Orn.' },
    { frame: 77, name: 'Círculo Mág.' },{ frame: 78, name: 'Anillo Dor.' },
    { frame: 79, name: 'Estrella Dor.'},{ frame: 80, name: 'Semilla' },
    { frame: 81, name: 'Lágrima Azul'}, { frame: 82, name: 'Pluma Blanc.' },
    { frame: 83, name: 'Estrella Am.' }, { frame: 84, name: 'Medalla Oro' },
    { frame: 85, name: 'Item 85' },      { frame: 86, name: 'Item 86' },
    { frame: 87, name: 'Item 87' },      { frame: 88, name: 'Item 88' },
    { frame: 89, name: 'Item 89' },
    // Row 6
    { frame: 90, name: 'Copa' },         { frame: 91, name: 'Cáliz' },
    { frame: 92, name: 'Trofeo' },       { frame: 93, name: 'Lupa' },
    { frame: 94, name: 'Flecha Roja' },  { frame: 95, name: 'Gema Verde' },
    { frame: 96, name: 'Gema Azul' },    { frame: 97, name: 'Gema Púrp.' },
    { frame: 98, name: 'Gema Naranja'}, { frame: 99, name: 'Crist. Rojo' },
    { frame: 100,name: 'Crist. Verde'}, { frame: 101,name: 'Crist. Azul' },
    { frame: 102,name: 'Crist. Viol.' },{ frame: 103,name: 'Crist. Ámbar'},
    { frame: 104,name: 'Item 104' },
  ];
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
    this._activeIconTab  = this.panelState.get('summon.iconTab',  0);
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

  get miscIconsSmall() { return this.miscIcons.filter(i => i.frame < 60); }
  get miscIconsLarge() { return this.miscIcons.filter(i => i.frame >= 60); }

  miscIconStyle(frame: number): Record<string, string> {
    const COLS = 15, FS = 32;
    const col = frame % COLS;
    const row = Math.floor(frame / COLS);
    return {
      'background-image':    `url(assets/sprites/resources/misc.png)`,
      'background-repeat':   'no-repeat',
      'background-position': `-${col * FS}px -${row * FS}px`,
      'image-rendering':     'pixelated',
      'width':               `${FS}px`,
      'height':              `${FS}px`,
    };
  }
}
