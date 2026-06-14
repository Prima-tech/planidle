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


// Espada LPC universal de 64×64 (mismo grid que el cuerpo del jugador, 13 cols).
// Filas: walk 8-11 (9 frames, up vacía en este arte), slash 12-15 (6 frames).
// Se superpone 1:1 sobre el cuerpo → sin layerScale/offsetY.
function swordLayer64(prefix: string, file: string): EquipLayerConfig {
  const p = prefix;
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    depthWhenUp: 1.5,   // detrás del jugador salvo mirando hacia abajo
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [{
      key: `${p}_main`,
      path: `assets/sprites/player/equip/weapons/swords/${file}`,
      frameWidth: 64, frameHeight: 64,
      anims: [
        { key: `${p}_idle_up`,      startFrame: 104, endFrame: 104, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_left`,    startFrame: 117, endFrame: 117, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_down`,    startFrame: 130, endFrame: 130, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_right`,   startFrame: 143, endFrame: 143, frameRate: 2,  repeat: -1 },
        { key: `${p}_walk_up`,      startFrame: 104, endFrame: 112, frameRate: 10, repeat: -1 },
        { key: `${p}_walk_left`,    startFrame: 117, endFrame: 125, frameRate: 10, repeat: -1 },
        { key: `${p}_walk_down`,    startFrame: 130, endFrame: 138, frameRate: 10, repeat: -1 },
        { key: `${p}_walk_right`,   startFrame: 143, endFrame: 151, frameRate: 10, repeat: -1 },
        { key: `${p}_attack_up`,    startFrame: 156, endFrame: 161, frameRate: 12, repeat: 0 },
        { key: `${p}_attack_left`,  startFrame: 169, endFrame: 174, frameRate: 12, repeat: 0 },
        { key: `${p}_attack_down`,  startFrame: 182, endFrame: 187, frameRate: 12, repeat: 0 },
        { key: `${p}_attack_right`, startFrame: 195, endFrame: 200, frameRate: 12, repeat: 0 },
      ],
    }],
  };
}

// Espadas tipo "Arming Sword" del set universal LPC (ElizaWy). Frame 64×64, pero
// la hoja viene a 26 columnas (fg en cols 0-12 delante del cuerpo, bg en 13-25
// detrás). Usamos solo la mitad fg (cols 0-8 contienen el arma visible).
// Layout universal estándar: walk filas 8-11 (9 frames), idle filas 22-25 (2).
// El slash 1h vive en filas 54+ pero ahí gran parte del arma queda detrás del
// cuerpo (capa bg) y con una sola capa se ve roto → el "ataque" mantiene la pose
// de guardia (idle) hasta poder componer bg+fg.
function swordLayerArming(prefix: string, file: string): EquipLayerConfig {
  const p = prefix;
  const COLS = 26;
  const walk = { up: 8 * COLS, left: 9 * COLS, down: 10 * COLS, right: 11 * COLS };
  const idle = { up: 22 * COLS, left: 23 * COLS, down: 24 * COLS, right: 25 * COLS };
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    depthWhenUp: 1.5,   // detrás del jugador salvo mirando hacia abajo
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [{
      key: `${p}_main`,
      path: `assets/sprites/player/equip/weapons/swords/${file}`,
      frameWidth: 64, frameHeight: 64,
      anims: [
        { key: `${p}_idle_up`,      startFrame: idle.up,    endFrame: idle.up + 1,    frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_left`,    startFrame: idle.left,  endFrame: idle.left + 1,  frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_down`,    startFrame: idle.down,  endFrame: idle.down + 1,  frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_right`,   startFrame: idle.right, endFrame: idle.right + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_walk_up`,      startFrame: walk.up,    endFrame: walk.up + 8,    frameRate: 10, repeat: -1 },
        { key: `${p}_walk_left`,    startFrame: walk.left,  endFrame: walk.left + 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_down`,    startFrame: walk.down,  endFrame: walk.down + 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_right`,   startFrame: walk.right, endFrame: walk.right + 8, frameRate: 10, repeat: -1 },
        // Ataque: pose de guardia (idle). Este arma NO trae slash en su hoja
        // (supportedAnimations: walk/hurt/idle/combat_idle), por eso no hay swing.
        { key: `${p}_attack_up`,    startFrame: idle.up,    endFrame: idle.up,    frameRate: 1, repeat: 0 },
        { key: `${p}_attack_left`,  startFrame: idle.left,  endFrame: idle.left,  frameRate: 1, repeat: 0 },
        { key: `${p}_attack_down`,  startFrame: idle.down,  endFrame: idle.down,  frameRate: 1, repeat: 0 },
        { key: `${p}_attack_right`, startFrame: idle.right, endFrame: idle.right, frameRate: 1, repeat: 0 },
      ],
    }],
  };
}

export const EQUIP_LAYER_REGISTRY: Record<string, EquipLayerConfig> = {
  // ── Espadas (assets/sprites/player/equip/weapons/swords) ────────────────────
  'Espada de Acero':  swordLayer64('sword01', 'sword_01.png'),
  'Cimitarra Dorada': swordLayerArming('sword02', 'sword_02.png'),
  'Hoja Ardiente':    swordLayerArming('sword03', 'sword_03.png'),
  'Sable Rúnico':     swordLayerArming('sword04', 'sword_04.png'),
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
        { key: 'cimitar_attack_up',    startFrame: 279, endFrame: 284, frameRate: 10, repeat: 0 },
        { key: 'cimitar_attack_left',  startFrame: 288, endFrame: 293, frameRate: 10, repeat: 0 },
        { key: 'cimitar_attack_down',  startFrame: 297, endFrame: 302, frameRate: 10, repeat: 0 },
        { key: 'cimitar_attack_right', startFrame: 306, endFrame: 311, frameRate: 10, repeat: 0 },
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
        key: 'shadow_slash',
        path: 'assets/sprites/player/character/shadow/slash/shadow.png',
        frameWidth: 64, frameHeight: 64,
        anims: [
          { key: 'shadow_attack_up',    startFrame: 0,  endFrame: 5,  frameRate: 10, repeat: 0 },
          { key: 'shadow_attack_left',  startFrame: 6,  endFrame: 11, frameRate: 10, repeat: 0 },
          { key: 'shadow_attack_down',  startFrame: 12, endFrame: 17, frameRate: 10, repeat: 0 },
          { key: 'shadow_attack_right', startFrame: 18, endFrame: 23, frameRate: 10, repeat: 0 },
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
