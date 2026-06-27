import { Component, inject } from '@angular/core';
import { ENEMY_REGISTRY, EnemyTypeConfig } from 'src/app/enemy/enemy-config';
import { ITEM_CATALOG, LootEntry } from 'src/app/physics/griddrops';
import { SummonService } from 'src/app/services/summon.service';
import { EquipmentService } from 'src/app/services/equipment.service';
import { InventoryItem, InventoryService } from 'src/app/services/inventory.service';
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
    { icon: 'paw-outline',        title: 'Pets'    },
    { icon: 'apps-outline',       title: 'Icons'   },
  ];

  /** Mascotas disponibles para invocar (categoría 'Mascota'). */
  readonly petCatalog: LootEntry[] = ITEM_CATALOG.filter(e => e.category === 'Mascota');

  // Hoja de iconos de referencia (Icons.png, 480×320). Columnas de ancho alterno:
  // pequeño (16px) + grande (32px), repetido 10 veces; filas de 32px (10 filas).
  // 20 iconos por fila × 10 = 200. Se listan en la pestaña Icons con su nº (#índice).
  readonly ICONS_SHEET_W = 480;
  readonly ICONS_SHEET_H = 320;
  readonly iconsSheetList: { x: number; y: number; w: number; h: number }[] = (() => {
    const list: { x: number; y: number; w: number; h: number }[] = [];
    const rows = 10, pairs = 10, rowH = 32;
    for (let r = 0; r < rows; r++) {
      let x = 0;
      const y = r * rowH;
      for (let p = 0; p < pairs; p++) {
        // El dibujo del pequeño vive en la mitad inferior de la fila → recorto
        // solo ese 16×16 de abajo para que se vea centrado (no pegado al suelo).
        list.push({ x, y: y + 16, w: 16, h: 16 }); x += 16;   // icono pequeño
        list.push({ x, y, w: 32, h: 32 });         x += 32;   // icono grande
      }
    }
    return list;
  })();

  /** Estilo que recorta la caja (x,y,w,h) de Icons.png, escalada. */
  iconsSheetStyle(box: { x: number; y: number; w: number; h: number }): Record<string, string> {
    const scale = 1.5;
    return {
      'background-image':    `url(assets/icon/icons/Icons.png)`,
      'background-repeat':   'no-repeat',
      'background-size':     `${this.ICONS_SHEET_W * scale}px ${this.ICONS_SHEET_H * scale}px`,
      'background-position': `-${box.x * scale}px -${box.y * scale}px`,
      'image-rendering':     'pixelated',
      'width':               `${box.w * scale}px`,
      'height':              `${box.h * scale}px`,
    };
  }

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

  get activeTab():      number { return this._activeTab; }
  get activeItemTab():  number { return this._activeItemTab; }
  get activeEnemyTab(): number { return this._activeEnemyTab; }

  set activeTab(v: number)      { this._activeTab = v;      this.panelState.set('summon.tab', v); }
  set activeItemTab(v: number)  { this._activeItemTab = v;  this.panelState.set('summon.itemTab', v); }
  set activeEnemyTab(v: number) { this._activeEnemyTab = v; this.panelState.set('summon.enemyTab', v); }
  readonly itemSubTabs  = ['Armor', 'Weapons', 'Misc', 'Drops'];
  readonly enemySubTabs = ['World1'];

  readonly enemyGroups: EnemyGroup[];
  readonly armorCatalog:  LootEntry[];
  readonly weaponCatalog: LootEntry[];
  readonly miscCatalog:   LootEntry[];
  readonly dropCatalog:   LootEntry[];   // materiales que sueltan los bichos (categoría 'Material')
  readonly armorGroups:   ArmorGroup[];
  openGroups = new Set<string>();

  private armorKeys:  Set<string>;
  private weaponKeys: Set<string>;

  constructor(
    private summonService: SummonService,
    private equipmentService: EquipmentService,
    private inventoryService: InventoryService,
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
    // Drops de bichos = materiales; van a su propia pestaña, fuera de Misc.
    this.dropCatalog   = ITEM_CATALOG.filter(e => e.category === 'Material');
    this.miscCatalog   = ITEM_CATALOG.filter(e => this.itemGroup(e) === 'misc' && e.category !== 'Material');

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
    this.enemyGroups = baseCards.map(toGroup);
    const rawTab         = this.panelState.get('summon.tab', 0) as number;
    const mappedTab      = rawTab === 2 ? 1 : rawTab === 1 ? 0 : rawTab;
    // Clamp al nuevo nº de pestañas (se quitó la de Icons; Pets pasó de 4 a 3).
    this._activeTab      = Math.min(Math.max(mappedTab, 0), this.tabs.length - 1);
    this._activeItemTab  = this.panelState.get('summon.itemTab',  0);
    this._activeEnemyTab = this.panelState.get('summon.enemyTab', 0);
  }

  summon(type: string): void {
    this.summonService.summon(type);
  }

  giveItem(entry: LootEntry): void {
    // Las mascotas van directas al inventario (no como drop al suelo), para
    // poder equiparlas luego en el slot de la pestaña secundaria.
    if (entry.category === 'Mascota') { this.givePet(entry); return; }
    this.summonService.dropItem(entry);
  }

  private givePet(entry: LootEntry): void {
    const item: InventoryItem = {
      id:              `pet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name:            entry.name,
      category:        entry.category,
      icon:            entry.icon,
      iconSheet:       entry.iconSheet,
      iconFrame:       entry.iconFrame,
      iconFrameSize:   entry.iconFrameSize,
      iconFrameCols:   entry.iconFrameCols,
      iconContentSize: entry.iconContentSize,
      mergeable:       entry.mergeable,
      order:           entry.order,
      description:     entry.description,
      stats:           entry.stats,
      petId:           entry.petId,
      petLevel:        1,
      petExp:          0,
    };
    this.inventoryService.addOrDropToWorld(item);
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
      label:       cfg.displayName ?? this.formatLabel(cfg.type),
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
