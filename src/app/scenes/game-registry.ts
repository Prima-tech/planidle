import { EquipmentService } from '../services/equipment.service';
import { InventoryService } from '../services/inventory.service';
import { KillService } from '../services/kill.service';
import { MapService } from '../services/map.service';
import { MapStatsService } from '../services/map-stats.service';
import { PlayerBridgeService } from '../services/player-bridge.service';
import { PlayerStateService } from '../services/player-state.service';
import { WorldService } from '../services/world.service';

/** Claves del registro Phaser. Úsalas en registry.set() para evitar typos. */
export const REGISTRY_KEYS = {
  PLAYER_BRIDGE: 'playerBridgeService',
  WORLD:         'worldService',
  INVENTORY:     'inventoryService',
  PLAYER_STATE:  'playerStateService',
  KILL:          'killService',
  MAP:           'mapService',
  MAP_STATS:     'mapStatsService',
  EQUIPMENT:     'equipmentService',
} as const;

/** Wrapper tipado sobre game.registry. Úsalo en preload() de cada escena. */
export class GameRegistry {
  constructor(private game: Phaser.Game) {}

  get playerBridge(): PlayerBridgeService  { return this.game.registry.get(REGISTRY_KEYS.PLAYER_BRIDGE); }
  get world():        WorldService         { return this.game.registry.get(REGISTRY_KEYS.WORLD); }
  get inventory():    InventoryService     { return this.game.registry.get(REGISTRY_KEYS.INVENTORY); }
  get playerState():  PlayerStateService   { return this.game.registry.get(REGISTRY_KEYS.PLAYER_STATE); }
  get kill():         KillService          { return this.game.registry.get(REGISTRY_KEYS.KILL); }
  get map():          MapService           { return this.game.registry.get(REGISTRY_KEYS.MAP); }
  get mapStats():     MapStatsService      { return this.game.registry.get(REGISTRY_KEYS.MAP_STATS); }
  get equipment():    EquipmentService     { return this.game.registry.get(REGISTRY_KEYS.EQUIPMENT); }
}
