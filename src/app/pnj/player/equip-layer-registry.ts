export interface EquipLayerSheet {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  anims: Array<{
    key: string;
    startFrame: number;
    endFrame: number;
    frameRate: number;
    repeat: number;
  }>;
}

export interface EquipLayerConfig {
  frameWidth: number;
  frameHeight: number;
  depth: number;
  /** 'frame' (default): syncs frame number from combined LPC sheet.
   *  'anim': plays its own animations from separated sheets. */
  mode?: 'frame' | 'anim';
  // mode 'frame':
  key?: string;
  path?: string;
  // mode 'anim':
  sheets?: EquipLayerSheet[];
  playerPrefix?: string;   // e.g. 'player_'
  layerPrefix?: string;    // e.g. 'armet_'
  fallbackAnim?: string;
}

export const EQUIP_LAYER_REGISTRY: Record<string, EquipLayerConfig> = {
  'Espada': {
    key: 'equip_espada',
    path: 'assets/sprites/player/equip/right-hand/long_knife.png',
    frameWidth: 64,
    frameHeight: 64,
    depth: 4,
  },
  'Armet': {
    frameWidth: 64,
    frameHeight: 64,
    depth: 3,
    mode: 'anim',
    playerPrefix: 'player_',
    layerPrefix: 'armet_',
    fallbackAnim: 'armet_idle_down',
    sheets: [
      {
        key: 'armet_idle',
        path: 'assets/sprites/player/equip/helmets/armet/idle.png',
        frameWidth: 64,
        frameHeight: 64,
        anims: [
          { key: 'armet_idle_up',    startFrame: 0, endFrame: 1, frameRate: 2,  repeat: -1 },
          { key: 'armet_idle_left',  startFrame: 2, endFrame: 3, frameRate: 2,  repeat: -1 },
          { key: 'armet_idle_down',  startFrame: 4, endFrame: 5, frameRate: 2,  repeat: -1 },
          { key: 'armet_idle_right', startFrame: 6, endFrame: 7, frameRate: 2,  repeat: -1 },
        ],
      },
      {
        key: 'armet_walk',
        path: 'assets/sprites/player/equip/helmets/armet/walk.png',
        frameWidth: 64,
        frameHeight: 64,
        anims: [
          { key: 'armet_walk_up',    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: 'armet_walk_left',  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: 'armet_walk_down',  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: 'armet_walk_right', startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: 'armet_slash',
        path: 'assets/sprites/player/equip/helmets/armet/slash.png',
        frameWidth: 64,
        frameHeight: 64,
        anims: [
          { key: 'armet_attack_up',    startFrame: 0,  endFrame: 5,  frameRate: 10, repeat: 0 },
          { key: 'armet_attack_left',  startFrame: 6,  endFrame: 11, frameRate: 10, repeat: 0 },
          { key: 'armet_attack_down',  startFrame: 12, endFrame: 17, frameRate: 10, repeat: 0 },
          { key: 'armet_attack_right', startFrame: 18, endFrame: 23, frameRate: 10, repeat: 0 },
        ],
      },
    ],
  },
};
