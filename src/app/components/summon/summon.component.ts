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

// Icono de un tier de minería: PNG suelto (`img`) o recorte de una hoja (`box` +
// `sheet`: 'icons' por defecto, o 'objects').
interface MiningIcon {
  name:  string;
  img?:  string;
  box?:  { x: number; y: number; w: number; h: number };
  sheet?: 'icons' | 'objects';
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
    { icon: 'leaf-outline',       title: 'Objects' },
    { icon: 'diamond-outline',    title: 'Mining'  },
  ];

  // Tiers de minería (referencia), agrupados por tier. `img` = PNG suelto; `box` =
  // recorte de una hoja (`sheet`: 'icons' por defecto, o 'objects'). El nombre del
  // tier va en el título; cada icono solo su rol.
  readonly miningTiers: { title: string; items: MiningIcon[] }[] = [
    {
      title: 'tier1',
      items: [
        { name: 'rock', img: 'assets/sprites/map/skills/rocks/tier1_rock.png' },
        { name: 'map',  box: { x: 48,  y: 16, w: 16, h: 16 } },   // Icons.png #2  (minimapa)
        { name: 'drop', box: { x: 64,  y: 32, w: 32, h: 32 } },   // Icons.png #23 (drop)
        { name: 'bar_mini', box: { x: 96,  y: 48, w: 16, h: 16 } }, // Icons.png #24 (pequeño)
        { name: 'bar',      box: { x: 112, y: 32, w: 32, h: 32 } }, // Icons.png #25 (grande)
      ],
    },
    {
      title: 'tier2',
      items: [
        { name: 'rock', box: { x: 338, y: 7,  w: 27, h: 23 }, sheet: 'objects' }, // Objects.png #10
        { name: 'map',  box: { x: 0,   y: 16, w: 16, h: 16 } },   // Icons.png #0
        { name: 'drop', box: { x: 16,  y: 32, w: 32, h: 32 } },   // Icons.png #21
        { name: 'bar_mini', box: { x: 96, y: 16, w: 16, h: 16 } }, // Icons.png #4
        { name: 'bar',      box: { x: 112, y: 0, w: 32, h: 32 } }, // Icons.png #5
      ],
    },
    {
      title: 'tier3',
      items: [
        { name: 'rock', box: { x: 466, y: 7,  w: 26, h: 22 }, sheet: 'objects' }, // Objects #214
        { name: 'map',  box: { x: 0,   y: 80, w: 16, h: 16 } },   // Icons #40
        { name: 'drop', box: { x: 16,  y: 96, w: 32, h: 32 } },   // Icons #61
        { name: 'bar_mini', box: { x: 96,  y: 80, w: 16, h: 16 } }, // Icons #44
        { name: 'bar',      box: { x: 112, y: 64, w: 32, h: 32 } }, // Icons #45
      ],
    },
    {
      title: 'tier4',
      items: [
        { name: 'rock', box: { x: 340, y: 39,  w: 25, h: 22 }, sheet: 'objects' }, // Objects #230
        { name: 'map',  box: { x: 48,  y: 144, w: 16, h: 16 } },   // Icons #82
        { name: 'drop', box: { x: 64,  y: 160, w: 32, h: 32 } },   // Icons #103
        { name: 'bar_mini', box: { x: 96,  y: 176, w: 16, h: 16 } }, // Icons #104
        { name: 'bar',      box: { x: 112, y: 160, w: 32, h: 32 } }, // Icons #105
      ],
    },
    {
      title: 'tier5',
      items: [
        { name: 'rock', box: { x: 594, y: 7,   w: 28, h: 21 }, sheet: 'objects' }, // Objects #218
        { name: 'map',  box: { x: 0,   y: 144, w: 16, h: 16 } },   // Icons #80
        { name: 'drop', box: { x: 16,  y: 160, w: 32, h: 32 } },   // Icons #101
        { name: 'bar_mini', box: { x: 96,  y: 144, w: 16, h: 16 } }, // Icons #84
        { name: 'bar',      box: { x: 112, y: 128, w: 32, h: 32 } }, // Icons #85
      ],
    },
    {
      title: 'tier6',
      items: [
        { name: 'rock', box: { x: 400, y: 39,  w: 28, h: 22 }, sheet: 'objects' }, // Objects #232
        { name: 'map',  box: { x: 0,   y: 208, w: 16, h: 16 } },   // Icons #120
        { name: 'drop', box: { x: 16,  y: 224, w: 32, h: 32 } },   // Icons #141
        { name: 'bar_mini', box: { x: 96,  y: 240, w: 16, h: 16 } }, // Icons #144
        { name: 'bar',      box: { x: 112, y: 224, w: 32, h: 32 } }, // Icons #145
      ],
    },
    {
      title: 'tier7',
      items: [
        { name: 'rock', box: { x: 466, y: 39,  w: 26, h: 21 }, sheet: 'objects' }, // Objects #234
        { name: 'map',  box: { x: 48,  y: 208, w: 16, h: 16 } },   // Icons #122
        { name: 'drop', box: { x: 64,  y: 224, w: 32, h: 32 } },   // Icons #143
        { name: 'bar_mini', box: { x: 96,  y: 208, w: 16, h: 16 } }, // Icons #124
        { name: 'bar',      box: { x: 112, y: 192, w: 32, h: 32 } }, // Icons #125
      ],
    },
  ];

  /** Recorte de una hoja (Icons/Objects) para mostrar el icono del tier en su celda. */
  miningIconStyle(item: MiningIcon): Record<string, string> {
    const isObj = item.sheet === 'objects';
    const url = isObj ? 'assets/icon/icons/Objects.png' : 'assets/icon/icons/Icons.png';
    const W = isObj ? this.OBJECTS_SHEET_W : this.ICONS_SHEET_W;
    const H = isObj ? this.OBJECTS_SHEET_H : this.ICONS_SHEET_H;
    const b = item.box!;
    return {
      'background-image':    `url(${url})`,
      'background-repeat':   'no-repeat',
      'background-size':     `${W}px ${H}px`,
      'background-position': `-${b.x}px -${b.y}px`,
      'image-rendering':     'pixelated',
      'width':               `${b.w}px`,
      'height':              `${b.h}px`,
    };
  }

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

  // Hoja de objetos (Objects.png, 656×272). Rejilla irregular (arbustos/rocas/setas
  // arriba, árboles grandes abajo): cada icono es su caja exacta detectada por su
  // recorte real. Se escala cada uno para caber en la celda. Listados con su nº.
  readonly OBJECTS_SHEET_W = 656;
  readonly OBJECTS_SHEET_H = 272;
  readonly objectsSheetList: { x: number; y: number; w: number; h: number }[] = [
    {x:1,y:7,w:28,h:24},{x:33,y:7,w:28,h:24},{x:65,y:7,w:29,h:23},{x:97,y:7,w:29,h:23},{x:129,y:7,w:29,h:23},{x:161,y:9,w:29,h:21},{x:194,y:8,w:29,h:21},{x:226,y:8,w:29,h:21},{x:257,y:7,w:28,h:22},{x:289,y:8,w:28,h:21},{x:338,y:7,w:27,h:23},{x:370,y:7,w:27,h:23},{x:403,y:7,w:26,h:21},{x:435,y:7,w:26,h:21},{x:466,y:7,w:26,h:22},{x:498,y:9,w:26,h:20},{x:531,y:8,w:26,h:20},{x:563,y:8,w:26,h:20},{x:594,y:7,w:28,h:21},{x:626,y:8,w:28,h:20},
    {x:3,y:39,w:27,h:23},{x:35,y:41,w:27,h:21},{x:64,y:39,w:28,h:23},{x:96,y:39,w:28,h:23},{x:128,y:39,w:29,h:23},{x:160,y:39,w:29,h:23},{x:193,y:39,w:28,h:22},{x:225,y:41,w:28,h:20},{x:258,y:39,w:26,h:22},{x:290,y:40,w:26,h:21},{x:340,y:39,w:25,h:22},{x:372,y:41,w:25,h:20},{x:400,y:39,w:28,h:22},{x:432,y:39,w:28,h:22},{x:466,y:39,w:26,h:21},{x:498,y:39,w:26,h:21},{x:530,y:39,w:26,h:20},{x:562,y:41,w:26,h:18},{x:595,y:39,w:24,h:21},{x:627,y:40,w:25,h:20},
    {x:6,y:69,w:21,h:25},{x:41,y:81,w:18,h:13},{x:72,y:70,w:17,h:22},{x:105,y:80,w:16,h:12},{x:136,y:68,w:19,h:25},{x:169,y:77,w:18,h:16},{x:200,y:69,w:16,h:22},{x:230,y:80,w:20,h:12},{x:262,y:70,w:20,h:21},{x:296,y:81,w:17,h:11},{x:342,y:69,w:21,h:23},{x:377,y:81,w:17,h:11},{x:408,y:70,w:16,h:21},{x:442,y:80,w:14,h:11},{x:472,y:68,w:19,h:24},{x:505,y:77,w:17,h:15},{x:536,y:69,w:16,h:21},{x:570,y:84,w:13,h:6},{x:598,y:70,w:20,h:20},{x:635,y:84,w:11,h:6},
    {x:7,y:98,w:21,h:30},{x:43,y:114,w:12,h:13},{x:69,y:99,w:22,h:28},{x:107,y:106,w:13,h:21},{x:134,y:100,w:20,h:28},{x:167,y:102,w:19,h:26},{x:197,y:101,w:20,h:27},{x:229,y:107,w:20,h:21},{x:262,y:101,w:22,h:27},{x:295,y:104,w:21,h:24},{x:343,y:98,w:21,h:29},{x:380,y:114,w:10,h:12},{x:405,y:99,w:22,h:27},{x:444,y:106,w:11,h:20},{x:470,y:100,w:20,h:27},{x:503,y:102,w:19,h:25},{x:533,y:101,w:20,h:26},{x:565,y:107,w:20,h:20},{x:598,y:101,w:22,h:26},{x:631,y:104,w:21,h:23},
    {x:5,y:135,w:23,h:23},{x:37,y:142,w:23,h:16},{x:69,y:136,w:25,h:22},{x:103,y:142,w:23,h:16},{x:133,y:132,w:22,h:24},{x:165,y:140,w:22,h:16},{x:195,y:134,w:27,h:23},{x:227,y:142,w:27,h:15},{x:264,y:134,w:17,h:23},{x:296,y:146,w:17,h:11},{x:342,y:135,w:21,h:22},{x:374,y:142,w:21,h:15},{x:407,y:136,w:21,h:21},{x:439,y:142,w:21,h:15},{x:470,y:132,w:19,h:23},{x:502,y:140,w:19,h:15},{x:532,y:134,w:25,h:22},{x:564,y:142,w:25,h:14},{x:600,y:134,w:17,h:23},{x:632,y:146,w:17,h:11},
    {x:3,y:168,w:23,h:22},{x:35,y:171,w:23,h:19},{x:69,y:167,w:23,h:22},{x:101,y:174,w:23,h:15},{x:132,y:167,w:23,h:25},{x:164,y:171,w:23,h:21},{x:198,y:167,w:20,h:24},{x:230,y:174,w:18,h:17},{x:263,y:164,w:21,h:26},{x:295,y:174,w:19,h:16},{x:341,y:168,w:21,h:21},{x:373,y:172,w:21,h:17},{x:406,y:167,w:19,h:21},{x:438,y:174,w:19,h:14},{x:470,y:167,w:20,h:23},{x:502,y:171,w:20,h:19},{x:535,y:167,w:19,h:22},{x:567,y:174,w:16,h:15},{x:599,y:164,w:21,h:25},{x:631,y:174,w:17,h:15},
    {x:0,y:225,w:32,h:47},{x:37,y:253,w:24,h:19},{x:83,y:208,w:53,h:64},{x:143,y:253,w:33,h:19},{x:193,y:194,w:63,h:78},{x:268,y:247,w:42,h:25},{x:336,y:225,w:32,h:47},{x:373,y:254,w:24,h:18},{x:419,y:208,w:53,h:64},{x:479,y:253,w:33,h:19},{x:529,y:194,w:63,h:77},{x:604,y:247,w:41,h:24},
  ];

  /** Estilo que recorta la caja de Objects.png, escalada para caber (~48px) en la celda. */
  objectsSheetStyle(box: { x: number; y: number; w: number; h: number }): Record<string, string> {
    const FIT = 48;
    const scale = Math.min(FIT / box.w, FIT / box.h);
    return {
      'background-image':    `url(assets/icon/icons/Objects.png)`,
      'background-repeat':   'no-repeat',
      'background-size':     `${this.OBJECTS_SHEET_W * scale}px ${this.OBJECTS_SHEET_H * scale}px`,
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
