import { InventoryItem, InventoryService } from '../services/inventory.service';
import { PlayerStateService } from '../services/player-state.service';
import { Player } from '../pnj/player/player';

export interface LootEntry {
  name: string;
  category?: string;       // tipo de slot para EquipmentService (ej. 'Casco', 'Arma')
  type: 'currency' | 'item';
  chance: number;
  minQty: number;
  maxQty: number;
  mergeable: boolean;
  texture: string;
  frame?: number;
  icon?: string;
  iconSheet?: string;
  iconFrame?: number;
  iconFrameSize?: number;  // tamaño original del frame en px (por defecto 32 para icons1)
  iconFrameCols?: number;  // columnas en el sheet (por defecto 12 para icons1)
  animKey?: string;
  scale: number;
  order: number;
  description?: string;
  stats?: Record<string, number>;
}

const EXP_REWARDS: Record<string, number> = {
  slime1:          3,  slime1_elite:    15,  slime1_oblivion: 45,
  slime2:          4,  slime2_elite:    18,  slime2_oblivion: 55,
  slime3:          4,  slime3_elite:    20,  slime3_oblivion: 60,
  slime4:          5,  slime4_elite:    25,  slime4_oblivion: 70,
  slime5:          5,  slime5_elite:    25,  slime5_oblivion: 70,
  slime6:          5,  slime6_elite:    25,  slime6_oblivion: 70,
  slime7:          8,  slime7_elite:    35,  slime7_oblivion: 90,
  slime8:          9,  slime8_elite:    40,  slime8_oblivion: 100,
  slime9:         10,  slime9_elite:    45,  slime9_oblivion: 120,
  orc1:           15,  orc1_elite:      75,  orc1_oblivion:   200,
};

const COIN = (min: number, max: number): LootEntry => ({
  name: 'Oro', type: 'currency', chance: 1.0, minQty: min, maxQty: max,
  mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png',
  animKey: 'coin_spin', scale: 3, order: 10,
});
const COIN_ELITE    = (min: number, max: number): LootEntry => ({ ...COIN(min, max), chance: 1.0 });
const COIN_OBLIVION = (min: number, max: number): LootEntry => ({ ...COIN(min, max), chance: 1.0 });

const LOOT_TABLES: Record<string, LootEntry[]> = {
  slime1:          [ COIN(1, 1) ],
  slime1_elite:    [ COIN(2, 5) ],
  slime1_oblivion: [ COIN(8, 15) ],
  slime2:          [ COIN(1, 2) ],
  slime2_elite:    [ COIN(3, 7) ],
  slime2_oblivion: [ COIN(10, 20) ],
  slime3:          [ COIN(1, 2) ],
  slime3_elite:    [ COIN(3, 8) ],
  slime3_oblivion: [ COIN(12, 25) ],
  slime7:          [ COIN(1, 3) ],
  slime7_elite:    [ COIN(5, 12) ],
  slime7_oblivion: [ COIN(15, 30) ],
  slime8:          [ COIN(2, 4) ],
  slime8_elite:    [ COIN(6, 14) ],
  slime8_oblivion: [ COIN(18, 35) ],
  slime9:          [ COIN(2, 5) ],
  slime9_elite:    [ COIN(8, 16) ],
  slime9_oblivion: [ COIN(20, 40) ],
  slime4: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 1, maxQty: 2,  mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  slime4_elite: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 5, maxQty: 10, mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  slime4_oblivion: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 15, maxQty: 30, mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  slime5: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 1, maxQty: 2,  mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  slime5_elite: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 5, maxQty: 10, mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  slime5_oblivion: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 15, maxQty: 30, mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  slime6: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 1, maxQty: 2,  mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  slime6_elite: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 5, maxQty: 10, mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  slime6_oblivion: [
    { name: 'Oro', type: 'currency', chance: 1.0, minQty: 15, maxQty: 30, mergeable: true, texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
  orc1: [
    { name: 'Oro',    type: 'currency', chance: 0.8,  minQty: 1, maxQty: 5,  mergeable: true,  texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
    { name: 'Espada', type: 'item',     chance: 0.15, minQty: 1, maxQty: 1,  mergeable: false, texture: 'icons1', frame: 3,  iconSheet: 'assets/icon/icons/icons1.png', iconFrame: 3,  scale: 3, order: 1, description: 'Espada de hierro forjada en Asgard.',                   stats: { damage: 5 } },
    { name: 'Poción', type: 'item',     chance: 0.4,  minQty: 1, maxQty: 1,  mergeable: true,  texture: 'icons1', frame: 45, iconSheet: 'assets/icon/icons/icons1.png', iconFrame: 45, scale: 3, order: 5, description: 'Restaura puntos de vida al usarla.',                    stats: { healing: 6 } },
    { name: 'Armet', category: 'Casco', type: 'item', chance: 1.0,  minQty: 1, maxQty: 1,  mergeable: false, texture: 'armet_idle', frame: 4, animKey: 'armet_idle_down', iconSheet: 'assets/sprites/player/equip/helmets/armet/idle.png', iconFrame: 4, iconFrameSize: 64, iconFrameCols: 2, scale: 2.5, order: 2, description: 'Casco de acero forjado. Protege la cabeza en combate.', stats: { hp: 15 } },
  ],
  orc1_elite: [
    { name: 'Oro',    type: 'currency', chance: 1.0,  minQty: 5, maxQty: 15, mergeable: true,  texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
    { name: 'Espada', type: 'item',     chance: 0.4,  minQty: 1, maxQty: 1,  mergeable: false, texture: 'icons1', frame: 3,  iconSheet: 'assets/icon/icons/icons1.png', iconFrame: 3,  scale: 3, order: 1, description: 'Espada de hierro forjada en Asgard.',                   stats: { damage: 5 } },
    { name: 'Poción', type: 'item',     chance: 0.8,  minQty: 1, maxQty: 2,  mergeable: true,  texture: 'icons1', frame: 45, iconSheet: 'assets/icon/icons/icons1.png', iconFrame: 45, scale: 3, order: 5, description: 'Restaura puntos de vida al usarla.',                    stats: { healing: 6 } },
    { name: 'Armet', category: 'Casco', type: 'item', chance: 1.0,  minQty: 1, maxQty: 1,  mergeable: false, texture: 'armet_idle', frame: 4, animKey: 'armet_idle_down', iconSheet: 'assets/sprites/player/equip/helmets/armet/idle.png', iconFrame: 4, iconFrameSize: 64, iconFrameCols: 2, scale: 2.5, order: 2, description: 'Casco de acero forjado. Protege la cabeza en combate.', stats: { hp: 15 } },
  ],
  orc1_oblivion: [
    { name: 'Oro',    type: 'currency', chance: 1.0,  minQty: 15, maxQty: 40, mergeable: true,  texture: 'drop_coin', icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
    { name: 'Espada', type: 'item',     chance: 0.8,  minQty: 1,  maxQty: 2,  mergeable: false, texture: 'icons1', frame: 3,  iconSheet: 'assets/icon/icons/icons1.png', iconFrame: 3,  scale: 3, order: 1, description: 'Espada de hierro forjada en Asgard.',                   stats: { damage: 5 } },
    { name: 'Poción', type: 'item',     chance: 1.0,  minQty: 2,  maxQty: 4,  mergeable: true,  texture: 'icons1', frame: 45, iconSheet: 'assets/icon/icons/icons1.png', iconFrame: 45, scale: 3, order: 5, description: 'Restaura puntos de vida al usarla.',                    stats: { healing: 6 } },
    { name: 'Armet', category: 'Casco', type: 'item', chance: 1.0,  minQty: 1,  maxQty: 1,  mergeable: false, texture: 'armet_idle', frame: 4, animKey: 'armet_idle_down', iconSheet: 'assets/sprites/player/equip/helmets/armet/idle.png', iconFrame: 4, iconFrameSize: 64, iconFrameCols: 2, scale: 2.5, order: 2, description: 'Casco de acero forjado. Protege la cabeza en combate.', stats: { hp: 15 } },
  ],
  default: [
    { name: 'Oro',    type: 'currency', chance: 0.4,  minQty: 1, maxQty: 2,  mergeable: true,  texture: 'drop_coin',   icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
};

const _armour = (folder: string, name: string, hp: number): LootEntry => ({
  name,
  category: 'Armadura',
  type: 'item',
  chance: 1,
  minQty: 1,
  maxQty: 1,
  mergeable: false,
  texture: `${folder}_idle`,
  frame: 4,
  animKey: `${folder}_idle_down`,
  iconSheet: `assets/sprites/player/equip/armour/${folder}/idle.png`,
  iconFrame: 4,
  iconFrameSize: 64,
  iconFrameCols: 2,
  scale: 1.5,
  order: 2,
  stats: { hp },
});

const ARMOUR_CATALOG: LootEntry[] = [
  _armour('tshirt',          'Tshirt',           5),
  _armour('tshirt_buttoned', 'Tshirt Buttoned',  8),
  _armour('leather',         'Leather Armour',  15),
  _armour('chainmail',       'Chainmail',       25),
  _armour('legion',          'Legion Armour',   30),
  _armour('plate',           'Plate Armour',    45),
];

const _helmet = (folder: string, name: string, hp: number): LootEntry => ({
  name,
  category: 'Casco',
  type: 'item',
  chance: 1,
  minQty: 1,
  maxQty: 1,
  mergeable: false,
  texture: `${folder}_idle`,
  frame: 4,
  animKey: `${folder}_idle_down`,
  iconSheet: `assets/sprites/player/equip/helmets/${folder}/idle.png`,
  iconFrame: 4,
  iconFrameSize: 64,
  iconFrameCols: 2,
  scale: 1.5,
  order: 2,
  stats: { hp },
});

const HELMET_CATALOG: LootEntry[] = [
  _helmet('barbarian',         'Barbarian',         10),
  _helmet('barbarian_nasal',   'Barbarian Nasal',   10),
  _helmet('barbarian_viking',  'Barbarian Viking',  22),
  _helmet('barbuta',           'Barbuta',           20),
  _helmet('barbuta_simple',    'Barbuta Simple',    15),
  _helmet('bascinet',          'Bascinet',          18),
  _helmet('bascinet_round',    'Bascinet Round',    18),
  _helmet('close',             'Close Helm',        30),
  _helmet('flattop',           'Flattop',           12),
  _helmet('greathelm',         'Greathelm',         35),
  _helmet('horned',            'Horned Helm',       25),
  _helmet('kettle',            'Kettle Helm',       10),
  _helmet('legion',            'Legion',            22),
  _helmet('mail',              'Mail Coif',         12),
  _helmet('maximus',           'Maximus',           28),
  _helmet('morion',            'Morion',            18),
  _helmet('nasal',             'Nasal Helm',         8),
  _helmet('norman',            'Norman Helm',       10),
  _helmet('pointed',           'Pointed Helm',      12),
  _helmet('spangehelm',        'Spangehelm',        15),
  _helmet('spangehelm_viking', 'Spangehelm Viking', 22),
  _helmet('sugarloaf',         'Sugarloaf',         25),
  _helmet('sugarloaf_simple',  'Sugarloaf Simple',  20),
  _helmet('xeon',              'Xeon',              40),
];

const _catalogSeen = new Set<string>();
export const ITEM_CATALOG: LootEntry[] = [
  ...Object.values(LOOT_TABLES)
    .flat()
    .filter(e => {
      if (e.type !== 'item' || _catalogSeen.has(e.name)) return false;
      _catalogSeen.add(e.name);
      return true;
    }),
  ...ARMOUR_CATALOG,
  ...HELMET_CATALOG,
];

export class GridDrops {

  constructor(
    private player: Player,
    private mainScene: Phaser.Scene,
    private inventoryService: InventoryService,
    private playerState: PlayerStateService
  ) {
    this.mainScene.events.on('enemyDied', ({ position, type }: { position: Phaser.Math.Vector2, type: string }) => {
      this.playerState.addExp(EXP_REWARDS[type] ?? 10);
      const drops = this.rollDrops(type);
      drops.forEach(loot => { try { this.spawnDrop(position, loot); } catch (e) { console.error('Drop error:', e); } });
    });
  }

  private rollDrops(enemyType: string): LootEntry[] {
    const table = LOOT_TABLES[enemyType] ?? LOOT_TABLES['default'];
    return table.filter(entry => Math.random() < entry.chance);
  }

  spawnDrop(position: Phaser.Math.Vector2, loot: LootEntry): void {
    const offsetX = Phaser.Math.Between(-40, 40);
    const offsetY = Phaser.Math.Between(-20, 20);

    const sprite = this.mainScene.physics.add.sprite(
      position.x + offsetX,
      position.y + offsetY,
      loot.texture,
      loot.frame ?? 0,
    );
    sprite.setDepth(1);
    sprite.setAlpha(0);
    sprite.setScale(0);
    (sprite.body as Phaser.Physics.Arcade.Body).enable = false;

    if (loot.animKey) sprite.play(loot.animKey);

    // Animación de aparición; collider activo solo al terminar para evitar
    // recogida instantánea cuando el jugador está encima del spawn point.
    this.mainScene.tweens.add({
      targets: sprite,
      alpha: 1,
      scaleX: loot.scale,
      scaleY: loot.scale,
      duration: 250,
      ease: 'Back.Out',
      onComplete: () => {
        (sprite.body as Phaser.Physics.Arcade.Body).enable = true;
        let collected = false;
        const collider = this.mainScene.physics.add.overlap(
          this.player.getSprite(),
          sprite,
          () => {
            if (collected) return;
            collected = true;
            this.mainScene.physics.world.removeCollider(collider);
            this.collectDrop(sprite, loot);
          }
        );
      },
    });
  }

  private collectDrop(sprite: Phaser.Physics.Arcade.Sprite, loot: LootEntry): void {
    sprite.disableBody(false, false);

    this.mainScene.tweens.add({
      targets: sprite,
      alpha: 0,
      y: sprite.y - 30,
      scaleX: sprite.scaleX * 0.4,
      scaleY: sprite.scaleY * 0.4,
      duration: 200,
      ease: 'Power2',
      onComplete: () => sprite.destroy(),
    });

    const qty = Phaser.Math.Between(loot.minQty, loot.maxQty);

    if (loot.type === 'currency') {
      this.playerState.collectCoins(qty);
      return;
    }

    const item: InventoryItem = {
      id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: loot.name,
      category: loot.category,
      icon: loot.icon,
      iconSheet: loot.iconSheet,
      iconFrame: loot.iconFrame,
      iconFrameSize: loot.iconFrameSize,
      iconFrameCols: loot.iconFrameCols,
      mergeable: loot.mergeable,
      sum: loot.mergeable ? qty : undefined,
      order: loot.order,
      description: loot.description,
      stats: loot.stats,
    };
    this.inventoryService.addDroppedItem(item);
  }
}
