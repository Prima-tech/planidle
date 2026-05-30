import { InventoryItem, InventoryService } from '../services/inventory.service';
import { Player } from '../pnj/player/player';

interface LootEntry {
  name: string;
  chance: number;
  minQty: number;
  maxQty: number;
  mergeable: boolean;
  texture: string;
  order: number;
}

const LOOT_TABLES: Record<string, LootEntry[]> = {
  orc: [
    { name: 'Oro',      chance: 0.5, minQty: 1, maxQty: 3, mergeable: true,  texture: 'sword', order: 10 },
    { name: 'Espada',   chance: 0.2, minQty: 1, maxQty: 1, mergeable: false, texture: 'sword', order: 1  },
    { name: 'Poción',   chance: 1, minQty: 1, maxQty: 2, mergeable: true,  texture: 'sword', order: 5  },
  ],
  default: [
    { name: 'Oro',      chance: 0.4, minQty: 1, maxQty: 2, mergeable: true,  texture: 'sword', order: 10 },
  ]
};

export class GridDrops {

  constructor(
    private player: Player,
    private mainScene: Phaser.Scene,
    private inventoryService: InventoryService
  ) {
    this.mainScene.events.on('enemyDied', ({ position, type }: { position: Phaser.Math.Vector2, type: string }) => {
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

    const sprite = this.mainScene.physics.add.image(
      position.x + offsetX,
      position.y + offsetY,
      loot.texture
    );
    sprite.setScale(3);
    sprite.setDepth(1);

    let collected = false;
    this.mainScene.physics.add.overlap(
      this.player.getSprite(),
      sprite,
      () => {
        if (collected) return;
        collected = true;
        this.collectDrop(sprite, loot);
      }
    );
  }

  private collectDrop(sprite: Phaser.GameObjects.Image, loot: LootEntry): void {
    sprite.destroy();

    const qty = Phaser.Math.Between(loot.minQty, loot.maxQty);
    const item: InventoryItem = {
      id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: loot.name,
      mergeable: loot.mergeable,
      sum: loot.mergeable ? qty : undefined,
      order: loot.order,
    };

    this.inventoryService.addDroppedItem(item);
    console.log(`[Drop] Recogido: ${item.name}${item.sum ? ` x${item.sum}` : ''}`);
  }
}
