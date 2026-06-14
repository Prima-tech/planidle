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
  /** Para armas con frames mezclados (walk 64px + slash 128px en hojas distintas):
   *  clave de la hoja "oversize" 128px y el offsetY a aplicar cuando se reproduce
   *  un frame de esa hoja. syncLayers lo aplica dinámicamente por frame. */
  oversizeSheetKey?: string;
  oversizeOffsetY?: number;
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

// Espadas tipo "Arming Sword" del set universal LPC (ElizaWy). La hoja mezcla
// dos tamaños de frame sobre el MISMO PNG:
//   · walk/idle a 64×64 (rejilla de 26 cols). walk filas 8-11, idle filas 22-25.
//   · slash "oversize" a 128×128 (rejilla de 13 cols). bloque filas 27-30 (6 fr).
// Por eso cargamos el PNG con DOS claves (64 y 128) y el ataque usa la de 128,
// con offsetY=80 (el personaje va centrado en el frame de 128). syncLayers aplica
// ese offset dinámicamente cuando se reproduce un frame de la hoja oversize.
function swordLayerArming(prefix: string, file: string): EquipLayerConfig {
  const p = prefix;
  const path = `assets/sprites/player/equip/weapons/swords/${file}`;
  const C64 = 26;   // columnas a 64px
  const walk = { up: 8 * C64, left: 9 * C64, down: 10 * C64, right: 11 * C64 };
  const idle = { up: 22 * C64, left: 23 * C64, down: 24 * C64, right: 25 * C64 };
  const C128 = 13;  // columnas a 128px
  const slash = { up: 27 * C128, left: 28 * C128, down: 29 * C128, right: 30 * C128 };
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    depthWhenUp: 1.5,   // detrás del jugador salvo mirando hacia abajo
    oversizeSheetKey: `${p}_slash`, oversizeOffsetY: 80,
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_main`, path, frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_idle_up`,      startFrame: idle.up,    endFrame: idle.up + 1,    frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,    startFrame: idle.left,  endFrame: idle.left + 1,  frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,    startFrame: idle.down,  endFrame: idle.down + 1,  frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`,   startFrame: idle.right, endFrame: idle.right + 1, frameRate: 2,  repeat: -1 },
          { key: `${p}_walk_up`,      startFrame: walk.up,    endFrame: walk.up + 8,    frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,    startFrame: walk.left,  endFrame: walk.left + 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,    startFrame: walk.down,  endFrame: walk.down + 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`,   startFrame: walk.right, endFrame: walk.right + 8, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: `${p}_slash`, path, frameWidth: 128, frameHeight: 128,
        anims: [
          // 5 frames (cols 0-4): se omite la col 5 (follow-through) que sobraba al final.
          { key: `${p}_attack_up`,    startFrame: slash.up,    endFrame: slash.up + 4,    frameRate: 14, repeat: 0 },
          { key: `${p}_attack_left`,  startFrame: slash.left,  endFrame: slash.left + 4,  frameRate: 14, repeat: 0 },
          { key: `${p}_attack_down`,  startFrame: slash.down,  endFrame: slash.down + 4,  frameRate: 14, repeat: 0 },
          { key: `${p}_attack_right`, startFrame: slash.right, endFrame: slash.right + 4, frameRate: 14, repeat: 0 },
        ],
      },
    ],
  };
}

export const EQUIP_LAYER_REGISTRY: Record<string, EquipLayerConfig> = {
  // ── Espadas (assets/sprites/player/equip/weapons/swords) ────────────────────
  'Espada de Acero':  swordLayer64('sword01', 'sword_01.png'),
  'Cimitarra Dorada': swordLayerArming('sword02', 'sword_02.png'),
  'Hoja Ardiente':    swordLayerArming('sword03', 'sword_03.png'),
  'Sable Rúnico':     swordLayerArming('sword04', 'sword_04.png'),
  // ── Sombra del jugador (capa permanente, depth < player) ──────────────────
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
