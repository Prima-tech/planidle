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
  enemies: EnemySpawn[];
  portals: PortalConfig[];
}

export const MAP_REGISTRY: Record<string, MapConfig> = {
  hogar: {
    id: 'hogar',
    name: 'Hogar',
    enemies: [],
    portals: [{ tilePos: { x: 17, y: 17 }, targetMapId: '1-1' }]
  },
  '1-1': {
    id: '1-1',
    name: '1-1',
    enemies: [{ tilePos: { x: 8, y: 8 }, type: 'orc' }],
    portals: [{ tilePos: { x: 2, y: 2 }, targetMapId: 'hogar' }]
  }
};
