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

const W1_HOME_TILESET = {
  tilemapKey:   'w1-home',
  tilemapJson:  'assets/tilemaps/W1/home01.tmj',
  tilesetKey:   'w1-ground-grasss',
  tilesetImage: 'assets/tilemaps/W1/ground_grasss.png',
  tilesetName:  'ground_grasss',
};

// Mapas generados por tools/mapgen (npm run gen:maps). Cada uno usa césped + agua (Water_coasts).
const GEN_WATER: TilesetConfig = {
  key: 'gen-water-coasts', name: 'Water_coasts',
  image: 'assets/tilemaps/W1/Water_coasts.png',
};
/** Tileset/tilemap de un mapa generado. El portal de avance va en (width-3, 2): ver manifest.mjs. */
const gen = (id: string) => ({
  tilemapKey:   `gen-${id}`,
  tilemapJson:  `assets/tilemaps/generated/${id}.tmj`,
  tilesetKey:   'gen-ground-grasss',
  tilesetImage: 'assets/tilemaps/W1/ground_grasss.png',
  tilesetName:  'ground_grasss',
  extraTilesets: [GEN_WATER],
});

/** Portal de retroceso (esquina superior-izquierda) */
const backPortal  = (targetMapId: string): PortalConfig => ({ tilePos: { x: 2,  y: 2  }, targetMapId });
/** Portal de avance — x debe coincidir con width-3 del mapa generado (manifest.mjs) */
const nextPortal  = (targetMapId: string, x = 17): PortalConfig => ({ tilePos: { x, y: 2 }, targetMapId });

interface GenLevelOpts {
  id: string; w: number; h: number;          // w/h DEBEN coincidir con manifest.mjs
  back: string; next?: string;
  enemyType: string; maxCount: number; behavior: EnemyBehavior; visionRadius: number;
}
/** Nivel generado: spawn en el centro (como el hogar) y enemigos alrededor del spawn. */
const genLevel = (o: GenLevelOpts): MapConfig => {
  const cx = Math.floor(o.w / 2), cy = Math.floor(o.h / 2);
  const portals = [backPortal(o.back)];
  if (o.next) portals.push(nextPortal(o.next, o.w - 3));
  return {
    ...gen(o.id),
    id: o.id, name: o.id,
    spawnPos: { x: cx, y: cy },
    spawns: [{
      enemyType: o.enemyType,
      zone: { tileX: cx - 4, tileY: cy - 4, width: 8, height: 8 },
      maxCount: o.maxCount, behavior: o.behavior, visionRadius: o.visionRadius,
    }],
    portals,
  };
};

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
    id: 'hogar', name: 'Asgard',
    spawns: [],
    portals: [{ tilePos: { x: 17, y: 17 }, targetMapId: '1-1' }],
    spawnPos: { x: 30, y: 30 },
    extraTilesets: [
      { key: 'w1-water-detail', name: 'Water_detilazation', image: 'assets/tilemaps/W1/water_detilazation.png' },
      { key: 'w1-water-coasts', name: 'Water_coasts',       image: 'assets/tilemaps/W1/Water_coasts.png'       },
      { key: 'w1-ground-copia', name: 'ground_grasss - copia', image: 'assets/tilemaps/W1/ground_grasss.png' },
    ],
  },

  // w/h DEBEN coincidir con tools/mapgen/manifest.mjs. Spawn = centro (derivado en genLevel).
  '1-1': genLevel({ id: '1-1', w: 60, h: 50, back: 'hogar', next: '1-2', enemyType: 'slime4',   maxCount: 2, behavior: 'passive',    visionRadius: 5 }),
  '1-2': genLevel({ id: '1-2', w: 64, h: 54, back: '1-1',   next: '1-3', enemyType: 'rats1',    maxCount: 3, behavior: 'passive',    visionRadius: 5 }),
  '1-3': genLevel({ id: '1-3', w: 68, h: 56, back: '1-2',   next: '1-4', enemyType: 'orc1',     maxCount: 3, behavior: 'passive',    visionRadius: 5 }),
  '1-4': genLevel({ id: '1-4', w: 72, h: 60, back: '1-3',   next: '1-5', enemyType: 'goobling1', maxCount: 4, behavior: 'aggressive', visionRadius: 4 }),
  '1-5': genLevel({ id: '1-5', w: 76, h: 62, back: '1-4',   next: '1-6', enemyType: 'gnoll1',   maxCount: 4, behavior: 'aggressive', visionRadius: 5 }),
  '1-6': genLevel({ id: '1-6', w: 80, h: 66, back: '1-5',   next: '1-7', enemyType: 'lizard1',  maxCount: 5, behavior: 'aggressive', visionRadius: 6 }),
  '1-7': genLevel({ id: '1-7', w: 84, h: 68, back: '1-6',   next: '1-8', enemyType: 'goobling2', maxCount: 5, behavior: 'aggressive', visionRadius: 6 }),
  '1-8': genLevel({ id: '1-8', w: 88, h: 72, back: '1-7',                enemyType: 'golem1',   maxCount: 6, behavior: 'aggressive', visionRadius: 7 }),
};
