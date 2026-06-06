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

function armourLayer(folder: string): EquipLayerConfig {
  const p = folder;
  return {
    frameWidth: 64, frameHeight: 64, depth: 3, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_idle`, path: `assets/sprites/player/equip/armour/${p}/idle.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_idle_up`,    startFrame: 0, endFrame: 1, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,  startFrame: 2, endFrame: 3, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,  startFrame: 4, endFrame: 5, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`, startFrame: 6, endFrame: 7, frameRate: 2,  repeat: -1 },
        ],
      },
      {
        key: `${p}_walk`, path: `assets/sprites/player/equip/armour/${p}/walk.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_walk_up`,    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`, startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: `${p}_slash`, path: `assets/sprites/player/equip/armour/${p}/slash.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_attack_up`,    startFrame: 0,  endFrame: 5,  frameRate: 10, repeat: 0 },
          { key: `${p}_attack_left`,  startFrame: 6,  endFrame: 11, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_down`,  startFrame: 12, endFrame: 17, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_right`, startFrame: 18, endFrame: 23, frameRate: 10, repeat: 0 },
        ],
      },
    ],
  };
}

function helmetLayer(folder: string): EquipLayerConfig {
  const p = folder;
  return {
    frameWidth: 64, frameHeight: 64, depth: 3, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_idle`, path: `assets/sprites/player/equip/helmets/${p}/idle.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_idle_up`,    startFrame: 0, endFrame: 1, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,  startFrame: 2, endFrame: 3, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,  startFrame: 4, endFrame: 5, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`, startFrame: 6, endFrame: 7, frameRate: 2,  repeat: -1 },
        ],
      },
      {
        key: `${p}_walk`, path: `assets/sprites/player/equip/helmets/${p}/walk.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_walk_up`,    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`, startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: `${p}_slash`, path: `assets/sprites/player/equip/helmets/${p}/slash.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_attack_up`,    startFrame: 0,  endFrame: 5,  frameRate: 10, repeat: 0 },
          { key: `${p}_attack_left`,  startFrame: 6,  endFrame: 11, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_down`,  startFrame: 12, endFrame: 17, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_right`, startFrame: 18, endFrame: 23, frameRate: 10, repeat: 0 },
        ],
      },
    ],
  };
}

export const EQUIP_LAYER_REGISTRY: Record<string, EquipLayerConfig> = {
  'Espada': {
    key: 'equip_espada',
    path: 'assets/sprites/player/equip/right-hand/long_knife.png',
    frameWidth: 64,
    frameHeight: 64,
    depth: 4,
  },
  'Chainmail':        armourLayer('chainmail'),
  'Leather Armour':   armourLayer('leather'),
  'Legion Armour':    armourLayer('legion'),
  'Plate Armour':     armourLayer('plate'),
  'Tshirt':           armourLayer('tshirt'),
  'Tshirt Buttoned':  armourLayer('tshirt_buttoned'),
  'Barbarian':        helmetLayer('barbarian'),
  'Barbarian Nasal':  helmetLayer('barbarian_nasal'),
  'Barbarian Viking': helmetLayer('barbarian_viking'),
  'Barbuta':          helmetLayer('barbuta'),
  'Barbuta Simple':   helmetLayer('barbuta_simple'),
  'Bascinet':         helmetLayer('bascinet'),
  'Bascinet Round':   helmetLayer('bascinet_round'),
  'Close Helm':       helmetLayer('close'),
  'Flattop':          helmetLayer('flattop'),
  'Greathelm':        helmetLayer('greathelm'),
  'Horned Helm':      helmetLayer('horned'),
  'Kettle Helm':      helmetLayer('kettle'),
  'Legion':           helmetLayer('legion'),
  'Mail Coif':        helmetLayer('mail'),
  'Maximus':          helmetLayer('maximus'),
  'Morion':           helmetLayer('morion'),
  'Nasal Helm':       helmetLayer('nasal'),
  'Norman Helm':      helmetLayer('norman'),
  'Pointed Helm':     helmetLayer('pointed'),
  'Spangehelm':       helmetLayer('spangehelm'),
  'Spangehelm Viking':helmetLayer('spangehelm_viking'),
  'Sugarloaf':        helmetLayer('sugarloaf'),
  'Sugarloaf Simple': helmetLayer('sugarloaf_simple'),
  'Xeon':             helmetLayer('xeon'),
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
