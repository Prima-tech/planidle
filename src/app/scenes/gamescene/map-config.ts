export type EnemyBehavior = 'passive' | 'aggressive';

export interface SpawnZone {
  tileX: number;
  tileY: number;
  width: number;
  height: number;
}

export interface SpawnConfig {
  enemyType: string;
  zone: SpawnZone;
  maxCount: number;
  behavior: EnemyBehavior;
  visionRadius: number;
}

export interface SpawnTracker {
  config: SpawnConfig;
  count: number;
}

export interface PortalConfig {
  tilePos: { x: number; y: number };
  targetMapId: string;
}

export interface TilesetConfig {
  key: string;
  image: string;
  name: string;
}

export interface MapConfig {
  id: string;
  name: string;
  tilemapKey: string;
  tilemapJson: string;
  tilesetKey: string;
  tilesetImage: string;
  tilesetName: string;
  extraTilesets?: TilesetConfig[];
  spawns: SpawnConfig[];
  portals: PortalConfig[];
  spawnPos?: { x: number; y: number };
  dropRateModifier?: number;  // multiplicador sobre la chance base de items (default 1.0)
}

const BASE_TILESET = {
  tilemapKey:   'test-map',
  tilemapJson:  'assets/tilemaps/test/test.tmj',
  tilesetKey:   'ground-grasss',
  tilesetImage: 'assets/tilemaps/test/ground_grasss.png',
  tilesetName:  'ground_grasss',
};

const W1_HOME_TILESET = {
  tilemapKey:   'w1-home',
  tilemapJson:  'assets/tilemaps/W1/home01.tmj',
  tilesetKey:   'w1-ground-grasss',
  tilesetImage: 'assets/tilemaps/W1/ground_grasss.png',
  tilesetName:  'ground_grasss',
};

/** Portal de retroceso (esquina superior-izquierda) */
const backPortal  = (targetMapId: string): PortalConfig => ({ tilePos: { x: 2,  y: 2  }, targetMapId });
/** Portal de avance (esquina superior-derecha) */
const nextPortal  = (targetMapId: string): PortalConfig => ({ tilePos: { x: 17, y: 2  }, targetMapId });

export const MAP_ELITE_THRESHOLD: Record<string, number> = {
  'hogar': 999,
  '1-1':   10,
  '1-2':   12,
  '1-3':   15,
  '1-4':   15,
  '1-5':   18,
  '1-6':   20,
  '1-7':   20,
  '1-8':   25,
};

export const MAP_OBLIVION_THRESHOLD: Record<string, number> = {
  '1-1':  3,
  '1-2':  3,
  '1-3':  4,
  '1-4':  4,
  '1-5':  5,
  '1-6':  5,
  '1-7':  5,
  '1-8':  6,
};

export const MAP_REGISTRY: Record<string, MapConfig> = {

  hogar: {
    ...W1_HOME_TILESET,
    id: 'hogar', name: 'Hogar',
    spawns: [],
    portals: [{ tilePos: { x: 17, y: 17 }, targetMapId: '1-1' }],
    spawnPos: { x: 30, y: 30 },
    extraTilesets: [
      { key: 'w1-water-detail', name: 'Water_detilazation', image: 'assets/tilemaps/W1/water_detilazation.png' },
      { key: 'w1-water-coasts', name: 'Water_coasts',       image: 'assets/tilemaps/W1/Water_coasts.png'       },
      { key: 'w1-ground-copia', name: 'ground_grasss - copia', image: 'assets/tilemaps/W1/ground_grasss.png' },
    ],
  },

  '1-1': {
    ...BASE_TILESET,
    id: '1-1', name: '1-1',
    spawns: [{
      enemyType: 'slime4', zone: { tileX: 7, tileY: 7, width: 4, height: 4 },
      maxCount: 2, behavior: 'passive', visionRadius: 5,
    }],
    portals: [backPortal('hogar'), nextPortal('1-2')],
  },

  '1-2': {
    ...BASE_TILESET,
    id: '1-2', name: '1-2',
    spawns: [{
      enemyType: 'slime5', zone: { tileX: 6, tileY: 6, width: 5, height: 5 },
      maxCount: 3, behavior: 'passive', visionRadius: 5,
    }],
    portals: [backPortal('1-1'), nextPortal('1-3')],
  },

  '1-3': {
    ...BASE_TILESET,
    id: '1-3', name: '1-3',
    spawns: [{
      enemyType: 'slime6', zone: { tileX: 6, tileY: 6, width: 6, height: 6 },
      maxCount: 3, behavior: 'passive', visionRadius: 5,
    }],
    portals: [backPortal('1-2'), nextPortal('1-4')],
  },

  '1-4': {
    ...BASE_TILESET,
    id: '1-4', name: '1-4',
    spawns: [{
      enemyType: 'orc1', zone: { tileX: 5, tileY: 5, width: 7, height: 7 },
      maxCount: 4, behavior: 'aggressive', visionRadius: 4,
    }],
    portals: [backPortal('1-3'), nextPortal('1-5')],
  },

  '1-5': {
    ...BASE_TILESET,
    id: '1-5', name: '1-5',
    spawns: [{
      enemyType: 'orc1', zone: { tileX: 5, tileY: 5, width: 7, height: 7 },
      maxCount: 4, behavior: 'aggressive', visionRadius: 5,
    }],
    portals: [backPortal('1-4'), nextPortal('1-6')],
  },

  '1-6': {
    ...BASE_TILESET,
    id: '1-6', name: '1-6',
    spawns: [{
      enemyType: 'orc1', zone: { tileX: 4, tileY: 4, width: 9, height: 9 },
      maxCount: 5, behavior: 'aggressive', visionRadius: 6,
    }],
    portals: [backPortal('1-5'), nextPortal('1-7')],
  },

  '1-7': {
    ...BASE_TILESET,
    id: '1-7', name: '1-7',
    spawns: [{
      enemyType: 'orc1', zone: { tileX: 4, tileY: 4, width: 9, height: 9 },
      maxCount: 5, behavior: 'aggressive', visionRadius: 6,
    }],
    portals: [backPortal('1-6'), nextPortal('1-8')],
  },

  '1-8': {
    ...BASE_TILESET,
    id: '1-8', name: '1-8',
    spawns: [{
      enemyType: 'orc1', zone: { tileX: 3, tileY: 3, width: 11, height: 11 },
      maxCount: 6, behavior: 'aggressive', visionRadius: 7,
    }],
    portals: [backPortal('1-7')],
  },
};
