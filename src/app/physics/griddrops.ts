import { InventoryItem, InventoryService } from '../services/inventory.service';
import { PlayerStateService } from '../services/player-state.service';
import { Player } from '../pnj/player/player';

interface LootEntry {
  name: string;
  type: 'currency' | 'item';
  chance: number;
  minQty: number;
  maxQty: number;
  mergeable: boolean;
  texture: string;
  icon?: string;
  animKey?: string;
  scale: number;
  order: number;
  description?: string;
  stats?: Record<string, number>;
}

const EXP_REWARDS: Record<string, number> = {
  slime4:          5,
  slime4_elite:    25,
  slime4_oblivion: 70,
  slime5:          5,
  slime5_elite:    25,
  slime5_oblivion: 70,
  slime6:          5,
  slime6_elite:    25,
  slime6_oblivion: 70,
  orc1:          15,
  orc1_elite:    75,
  orc1_oblivion: 200,
};

const LOOT_TABLES: Record<string, LootEntry[]> = {
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
    { name: 'Oro',    type: 'currency', chance: 0.8,  minQty: 1, maxQty: 5,  mergeable: true,  texture: 'drop_coin',   icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
    { name: 'Espada', type: 'item',     chance: 0.15, minQty: 1, maxQty: 1,  mergeable: false, texture: 'sword',       icon: 'assets/icon/weapons/sword8.png', scale: 3, order: 1, description: 'Espada de hierro forjada en Asgard.', stats: { damage: 5 } },
    { name: 'Poción', type: 'item',     chance: 0.4,  minQty: 1, maxQty: 1,  mergeable: true,  texture: 'drop_potion', icon: 'assets/icon/potion.svg',                scale: 4, order: 5, description: 'Restaura puntos de vida al usarla.',   stats: { healing: 6 } },
  ],
  orc1_elite: [
    { name: 'Oro',    type: 'currency', chance: 1.0,  minQty: 5, maxQty: 15, mergeable: true,  texture: 'drop_coin',   icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
    { name: 'Espada', type: 'item',     chance: 0.4,  minQty: 1, maxQty: 1,  mergeable: false, texture: 'sword',       icon: 'assets/icon/weapons/sword8.png', scale: 3, order: 1, description: 'Espada de hierro forjada en Asgard.', stats: { damage: 5 } },
    { name: 'Poción', type: 'item',     chance: 0.8,  minQty: 1, maxQty: 2,  mergeable: true,  texture: 'drop_potion', icon: 'assets/icon/potion.svg',                scale: 4, order: 5, description: 'Restaura puntos de vida al usarla.',   stats: { healing: 6 } },
  ],
  orc1_oblivion: [
    { name: 'Oro',    type: 'currency', chance: 1.0,  minQty: 15, maxQty: 40, mergeable: true,  texture: 'drop_coin',   icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
    { name: 'Espada', type: 'item',     chance: 0.8,  minQty: 1,  maxQty: 2,  mergeable: false, texture: 'sword',       icon: 'assets/icon/weapons/sword8.png', scale: 3, order: 1, description: 'Espada de hierro forjada en Asgard.', stats: { damage: 5 } },
    { name: 'Poción', type: 'item',     chance: 1.0,  minQty: 2,  maxQty: 4,  mergeable: true,  texture: 'drop_potion', icon: 'assets/icon/potion.svg',                scale: 4, order: 5, description: 'Restaura puntos de vida al usarla.',   stats: { healing: 6 } },
  ],
  default: [
    { name: 'Oro',    type: 'currency', chance: 0.4,  minQty: 1, maxQty: 2,  mergeable: true,  texture: 'drop_coin',   icon: 'assets/sprites/resources/coin.png', animKey: 'coin_spin', scale: 3, order: 10 },
  ],
};

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
      drops.forEach(loot => this.spawnDrop(position, loot));
    });
  }

  private rollDrops(enemyType: string): LootEntry[] {
    const table = LOOT_TABLES[enemyType] ?? LOOT_TABLES['default'];
    return table.filter(entry => Math.random() < entry.chance);
  }

  private spawnDrop(position: Phaser.Math.Vector2, loot: LootEntry): void {
    const offsetX = Phaser.Math.Between(-40, 40);
    const offsetY = Phaser.Math.Between(-20, 20);

    const sprite = this.mainScene.physics.add.sprite(
      position.x + offsetX,
      position.y + offsetY,
      loot.texture,
      0,
    );
    sprite.setDepth(1);
    sprite.setAlpha(0);
    sprite.setScale(0);

    if (loot.animKey) sprite.play(loot.animKey);

    // Animación de aparición
    this.mainScene.tweens.add({
      targets: sprite,
      alpha: 1,
      scaleX: loot.scale,
      scaleY: loot.scale,
      duration: 250,
      ease: 'Back.Out',
    });

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
      icon: loot.icon,
      mergeable: loot.mergeable,
      sum: loot.mergeable ? qty : undefined,
      order: loot.order,
      description: loot.description,
      stats: loot.stats,
    };
    this.inventoryService.addDroppedItem(item);
  }
}
