export interface EnemySpawn {
  tilePos: { x: number; y: number };
  type: string;
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
  enemies: EnemySpawn[];
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
    enemies: [],
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
    enemies: [{ tilePos: { x: 8, y: 8 }, type: 'orc' }],
    portals: [{ tilePos: { x: 2, y: 2 }, targetMapId: 'hogar' }]
  }
};
