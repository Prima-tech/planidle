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
  /** Override scale for layers whose frameSize differs from the player's 64×64 base.
   *  If omitted, copies the player sprite's scale. */
  layerScale?: number;
  /** Y offset (world px) applied to the layer position, e.g. to compensate when
   *  the physical frame is larger than the sprite content area. */
  layerOffsetY?: number;
  /** Depth to use when the player faces up (weapon goes behind the sprite).
   *  If omitted, depth stays constant for all directions. */
  depthWhenUp?: number;
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
        key: `${p}_thrust`, path: `assets/sprites/player/equip/boots/${p}/thrust.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_attack_up`,    startFrame: 0,  endFrame: 7,  frameRate: 10, repeat: 0 },
          { key: `${p}_attack_left`,  startFrame: 8,  endFrame: 15, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_down`,  startFrame: 16, endFrame: 23, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_right`, startFrame: 24, endFrame: 31, frameRate: 10, repeat: 0 },
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
        key: `${p}_thrust`, path: `assets/sprites/player/equip/legs/${p}/thrust.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_attack_up`,    startFrame: 0,  endFrame: 7,  frameRate: 10, repeat: 0 },
          { key: `${p}_attack_left`,  startFrame: 8,  endFrame: 15, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_down`,  startFrame: 16, endFrame: 23, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_right`, startFrame: 24, endFrame: 31, frameRate: 10, repeat: 0 },
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
        key: `${p}_thrust`, path: `assets/sprites/player/equip/armour/${p}/thrust.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_attack_up`,    startFrame: 0,  endFrame: 7,  frameRate: 10, repeat: 0 },
          { key: `${p}_attack_left`,  startFrame: 8,  endFrame: 15, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_down`,  startFrame: 16, endFrame: 23, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_right`, startFrame: 24, endFrame: 31, frameRate: 10, repeat: 0 },
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
        key: `${p}_thrust`, path: `assets/sprites/player/equip/helmets/${p}/thrust.png`,
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_attack_up`,    startFrame: 0,  endFrame: 7,  frameRate: 10, repeat: 0 },
          { key: `${p}_attack_left`,  startFrame: 8,  endFrame: 15, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_down`,  startFrame: 16, endFrame: 23, frameRate: 10, repeat: 0 },
          { key: `${p}_attack_right`, startFrame: 24, endFrame: 31, frameRate: 10, repeat: 0 },
        ],
      },
    ],
  };
}


export const EQUIP_LAYER_REGISTRY: Record<string, EquipLayerConfig> = {
  // ── Sombra del jugador (capa permanente, depth < player) ──────────────────
  // ── Armas ─────────────────────────────────────────────────────────────────
  // weapons1/cimitar.png: 9c×35r a 128×128px. Contenido en filas 27-34.
  // Filas 27-30 walk (9 frames), filas 31-34 slash (6 frames).
  'Cimitar': {
    frameWidth: 128, frameHeight: 128, depth: 4, mode: 'anim',
    layerScale: 2.5,    // content 64px×2.5 = 160px display, same height as player (64×2.5)
    layerOffsetY: 80,   // frame 128×2.5 top = y-160; need +80 to match original y-80 alignment
    depthWhenUp: 1.5,   // behind player (depth 2) when facing up
    playerPrefix: 'player_', layerPrefix: 'cimitar_', fallbackAnim: 'cimitar_idle_down',
    sheets: [{
      key: 'cimitar_main',
      path: 'assets/sprites/player/equip/weapons1/cimitar.png',
      frameWidth: 128, frameHeight: 128,
      anims: [
        { key: 'cimitar_idle_up',      startFrame: 243, endFrame: 243, frameRate: 2,  repeat: -1 },
        { key: 'cimitar_idle_left',    startFrame: 252, endFrame: 252, frameRate: 2,  repeat: -1 },
        { key: 'cimitar_idle_down',    startFrame: 261, endFrame: 261, frameRate: 2,  repeat: -1 },
        { key: 'cimitar_idle_right',   startFrame: 270, endFrame: 270, frameRate: 2,  repeat: -1 },
        { key: 'cimitar_walk_up',      startFrame: 243, endFrame: 251, frameRate: 10, repeat: -1 },
        { key: 'cimitar_walk_left',    startFrame: 252, endFrame: 260, frameRate: 10, repeat: -1 },
        { key: 'cimitar_walk_down',    startFrame: 261, endFrame: 269, frameRate: 10, repeat: -1 },
        { key: 'cimitar_walk_right',   startFrame: 270, endFrame: 278, frameRate: 10, repeat: -1 },
        { key: 'cimitar_attack_up',    startFrame: 279, endFrame: 286, frameRate: 10, repeat: 0 },
        { key: 'cimitar_attack_left',  startFrame: 288, endFrame: 295, frameRate: 10, repeat: 0 },
        { key: 'cimitar_attack_down',  startFrame: 297, endFrame: 304, frameRate: 10, repeat: 0 },
        { key: 'cimitar_attack_right', startFrame: 306, endFrame: 313, frameRate: 10, repeat: 0 },
      ],
    }],
  },
  'Shadow': {
    frameWidth: 64, frameHeight: 64, depth: 1, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: 'shadow_', fallbackAnim: 'shadow_idle_down',
    sheets: [
      {
        key: 'shadow_walk',
        path: 'assets/sprites/player/character/shadow/walk/shadow.png',
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: 'shadow_idle_up',    startFrame: 0,  endFrame: 0,  frameRate: 2,  repeat: -1 },
          { key: 'shadow_idle_left',  startFrame: 9,  endFrame: 9,  frameRate: 2,  repeat: -1 },
          { key: 'shadow_idle_down',  startFrame: 18, endFrame: 18, frameRate: 2,  repeat: -1 },
          { key: 'shadow_idle_right', startFrame: 27, endFrame: 27, frameRate: 2,  repeat: -1 },
          { key: 'shadow_walk_up',    startFrame: 0,  endFrame: 8,  frameRate: 10, repeat: -1 },
          { key: 'shadow_walk_left',  startFrame: 9,  endFrame: 17, frameRate: 10, repeat: -1 },
          { key: 'shadow_walk_down',  startFrame: 18, endFrame: 26, frameRate: 10, repeat: -1 },
          { key: 'shadow_walk_right', startFrame: 27, endFrame: 35, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: 'shadow_thrust',
        path: 'assets/sprites/player/character/shadow/thrust/shadow.png',
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: 'shadow_attack_up',    startFrame: 0,  endFrame: 7,  frameRate: 10, repeat: 0 },
          { key: 'shadow_attack_left',  startFrame: 8,  endFrame: 15, frameRate: 10, repeat: 0 },
          { key: 'shadow_attack_down',  startFrame: 16, endFrame: 23, frameRate: 10, repeat: 0 },
          { key: 'shadow_attack_right', startFrame: 24, endFrame: 31, frameRate: 10, repeat: 0 },
        ],
      },
    ],
  },
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
        key: 'armet_thrust',
        path: 'assets/sprites/player/equip/helmets/armet/thrust.png',
        frameWidth: 64,
        frameHeight: 64,
        anims: [
          { key: 'armet_attack_up',    startFrame: 0,  endFrame: 7,  frameRate: 10, repeat: 0 },
          { key: 'armet_attack_left',  startFrame: 8,  endFrame: 15, frameRate: 10, repeat: 0 },
          { key: 'armet_attack_down',  startFrame: 16, endFrame: 23, frameRate: 10, repeat: 0 },
          { key: 'armet_attack_right', startFrame: 24, endFrame: 31, frameRate: 10, repeat: 0 },
        ],
      },
    ],
  },
};
