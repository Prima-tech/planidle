export type EnemyBehavior = 'passive' | 'aggressive';

export interface SpawnZone {
  tileX: number;
  tileY: number;
  width: number;   // en tiles
  height: number;  // en tiles
}

export interface SpawnConfig {
  enemyType: string;
  zone: SpawnZone;
  maxCount: number;
  behavior: EnemyBehavior;
  visionRadius: number; // tiles — solo activo en modo aggressive
}

export interface PortalConfig {
  tilePos: { x: number; y: number };
  targetMapId: string;
}

export interface MapConfig {
  id: string;
  name: string;
  tilemapKey: string;
  tilemapJson: string;
  tilesetKey: string;
  tilesetImage: string;
  tilesetName: string;
  spawns: SpawnConfig[];
  portals: PortalConfig[];
}

export const MAP_REGISTRY: Record<string, MapConfig> = {
  hogar: {
    id: 'hogar',
    name: 'Hogar',
    tilemapKey: 'cloud-city-map',
    tilemapJson: 'assets/tilemaps/test/cloud_city.json',
    tilesetKey: 'tiles',
    tilesetImage: 'assets/tilemaps/test/cloud_tileset.png',
    tilesetName: 'Cloud City',
    spawns: [],
    portals: [{ tilePos: { x: 17, y: 17 }, targetMapId: '1-1' }]
  },
  '1-1': {
    id: '1-1',
    name: '1-1',
    tilemapKey: 'cloud-city-map',
    tilemapJson: 'assets/tilemaps/test/cloud_city.json',
    tilesetKey: 'tiles',
    tilesetImage: 'assets/tilemaps/test/cloud_tileset.png',
    tilesetName: 'Cloud City',
    spawns: [
      {
        enemyType: 'orc',
        zone: { tileX: 7, tileY: 7, width: 4, height: 4 },
        maxCount: 3,
        behavior: 'passive',
        visionRadius: 5,
      }
    ],
    portals: [{ tilePos: { x: 2, y: 2 }, targetMapId: 'hogar' }]
  }
};
