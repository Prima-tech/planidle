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

function bootsLayer(folder: string): EquipLayerConfig {
  const p = folder;
  return {
    frameWidth: 64, frameHeight: 64, depth: 3, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_idle`, path: `assets/sprites/player/equip/boots/${p}/idle.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_idle_up`,    startFrame: 0, endFrame: 1, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,  startFrame: 2, endFrame: 3, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,  startFrame: 4, endFrame: 5, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`, startFrame: 6, endFrame: 7, frameRate: 2,  repeat: -1 },
        ],
      },
      {
        key: `${p}_walk`, path: `assets/sprites/player/equip/boots/${p}/walk.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_walk_up`,    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`, startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: `${p}_slash`, path: `assets/sprites/player/equip/boots/${p}/slash.png`,
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

function legsLayer(folder: string): EquipLayerConfig {
  const p = folder;
  return {
    frameWidth: 64, frameHeight: 64, depth: 3, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_idle`, path: `assets/sprites/player/equip/legs/${p}/idle.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_idle_up`,    startFrame: 0, endFrame: 1, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,  startFrame: 2, endFrame: 3, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,  startFrame: 4, endFrame: 5, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`, startFrame: 6, endFrame: 7, frameRate: 2,  repeat: -1 },
        ],
      },
      {
        key: `${p}_walk`, path: `assets/sprites/player/equip/legs/${p}/walk.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_walk_up`,    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`, startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: `${p}_slash`, path: `assets/sprites/player/equip/legs/${p}/slash.png`,
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

// walk-only weapons: idle = frame estático del walk sheet, no attack defined
function weaponWalkLayer(prefix: string, walkPath: string): EquipLayerConfig {
  const p = prefix;
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [{
      key: `${p}_walk`, path: `assets/sprites/player/equip/${walkPath}`,
      frameWidth: 64, frameHeight: 64,
      anims: [
        // idle: frame estático por dirección (primer frame de cada dirección del walk)
        { key: `${p}_idle_up`,    startFrame: 0,  endFrame: 0,  frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_left`,  startFrame: 9,  endFrame: 9,  frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_down`,  startFrame: 18, endFrame: 18, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_right`, startFrame: 27, endFrame: 27, frameRate: 2,  repeat: -1 },
        // walk
        { key: `${p}_walk_up`,    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_left`,  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
        { key: `${p}_walk_down`,  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
        { key: `${p}_walk_right`, startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
      ],
    }],
  };
}

// weapons with 18c×12r attack_slash: rows 0-3 = UP/LEFT/DOWN/RIGHT, 18 frames each
function weaponAttackLayer(prefix: string, walkPath: string, slashPath: string): EquipLayerConfig {
  const p = prefix;
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_walk`, path: `assets/sprites/player/equip/${walkPath}`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          // idle: frame estático por dirección
          { key: `${p}_idle_up`,    startFrame: 0,  endFrame: 0,  frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,  startFrame: 9,  endFrame: 9,  frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,  startFrame: 18, endFrame: 18, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`, startFrame: 27, endFrame: 27, frameRate: 2,  repeat: -1 },
          // walk
          { key: `${p}_walk_up`,    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`, startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        // Realmente 6c×4r con frames de 192×192 (el sheet mide 1152×768)
        key: `${p}_slash`, path: `assets/sprites/player/equip/${slashPath}`,
        frameWidth: 192, frameHeight: 192,
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

// dagger: standard LPC slash (6c×4r)
function weaponFullLayer(prefix: string, walkPath: string, slashPath: string): EquipLayerConfig {
  const p = prefix;
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_walk`, path: `assets/sprites/player/equip/${walkPath}`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          // idle: frame estático por dirección
          { key: `${p}_idle_up`,    startFrame: 0,  endFrame: 0,  frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,  startFrame: 9,  endFrame: 9,  frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,  startFrame: 18, endFrame: 18, frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`, startFrame: 27, endFrame: 27, frameRate: 2,  repeat: -1 },
          // walk
          { key: `${p}_walk_up`,    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`, startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        // dagger/slash: estándar LPC 6c×4r
        key: `${p}_slash`, path: `assets/sprites/player/equip/${slashPath}`,
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

function armingLayer(material: string): EquipLayerConfig {
  const p = `arming_${material}`;
  const base = `weapons/arming/universal/fg`;
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_idle`, path: `assets/sprites/player/equip/${base}/idle/${material}.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_idle_up`,    startFrame: 0, endFrame: 1, frameRate: 2, repeat: -1 },
          { key: `${p}_idle_left`,  startFrame: 2, endFrame: 3, frameRate: 2, repeat: -1 },
          { key: `${p}_idle_down`,  startFrame: 4, endFrame: 5, frameRate: 2, repeat: -1 },
          { key: `${p}_idle_right`, startFrame: 6, endFrame: 7, frameRate: 2, repeat: -1 },
        ],
      },
      {
        key: `${p}_walk`, path: `assets/sprites/player/equip/${base}/walk/${material}.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_walk_up`,    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`, startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        // Realmente 6c×4r con frames de 128×128 (el sheet mide 768×512)
        key: `${p}_slash`, path: `assets/sprites/player/equip/weapons/arming/attack_slash/fg/${material}.png`,
        frameWidth: 128, frameHeight: 128,
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
  'Armour Boots':     bootsLayer('armour'),
  'Basic Boots':      bootsLayer('basic'),
  'Fold Boots':       bootsLayer('fold'),
  'Armour Pants':     legsLayer('armour'),
  'Hose':             legsLayer('hose'),
  'Leggings':         legsLayer('leggins'),
  'Shorts':           legsLayer('shorts'),
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
  // Weapons
  'Dagger':         weaponFullLayer('dagger',        'weapons/dagger/walk/dagger.png',           'weapons/dagger/slash/dagger.png'),
  'Longsword':      weaponAttackLayer('longsword',   'weapons/longsword/walk/longsword.png',     'weapons/longsword/attack_slash/longsword.png'),
  'Rapier':         weaponAttackLayer('rapier',      'weapons/rapier/walk/rapier.png',           'weapons/rapier/attack_slash/rapier.png'),
  'Saber':          weaponAttackLayer('saber',       'weapons/saber/walk/saber.png',             'weapons/saber/attack_slash/saber.png'),
  'Glowsword Blue': weaponAttackLayer('glowsword_blue','weapons/glowsword/walk/blue.png',        'weapons/glowsword/attack_slash/blue.png'),
  'Glowsword Red':  weaponAttackLayer('glowsword_red', 'weapons/glowsword/walk/red.png',        'weapons/glowsword/attack_slash/red.png'),
  'Arming (Iron)':  armingLayer('iron'),
  'Arming (Steel)': armingLayer('steel'),
  'Arming (Silver)':armingLayer('silver'),
  'Arming (Gold)':  armingLayer('gold'),
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
