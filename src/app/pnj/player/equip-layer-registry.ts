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
  layerPrefix?: string;    // e.g. 'helm01_'
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

// Botas (foot) y pantalones (lets_final) LPC en hoja universal combinada de 64×64
// (13 cols), igual que cascos/armaduras: walk 8-11, slash 12-15, idle 22-25. depth 3.
function combinedLayer(prefix: string, path: string): EquipLayerConfig {
  const p = prefix;
  const C = 13;
  return {
    frameWidth: 64, frameHeight: 64, depth: 3, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [{
      key: `${p}_main`, path, frameWidth: 64, frameHeight: 64,
      anims: [
        { key: `${p}_idle_up`,      startFrame: 22 * C, endFrame: 22 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_left`,    startFrame: 23 * C, endFrame: 23 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_down`,    startFrame: 24 * C, endFrame: 24 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_right`,   startFrame: 25 * C, endFrame: 25 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_walk_up`,      startFrame: 8 * C,  endFrame: 8 * C + 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_left`,    startFrame: 9 * C,  endFrame: 9 * C + 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_down`,    startFrame: 10 * C, endFrame: 10 * C + 8, frameRate: 10, repeat: -1 },
        { key: `${p}_walk_right`,   startFrame: 11 * C, endFrame: 11 * C + 8, frameRate: 10, repeat: -1 },
        { key: `${p}_attack_up`,    startFrame: 12 * C, endFrame: 12 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_left`,  startFrame: 13 * C, endFrame: 13 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_down`,  startFrame: 14 * C, endFrame: 14 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_right`, startFrame: 15 * C, endFrame: 15 * C + 5, frameRate: 10, repeat: 0 },
      ],
    }],
  };
}

const bootsLayer = (prefix: string, file: string): EquipLayerConfig =>
  combinedLayer(prefix, `assets/sprites/player/equip/foot/${file}`);

const legsLayer = (prefix: string, file: string): EquipLayerConfig =>
  combinedLayer(prefix, `assets/sprites/player/equip/lets_final/${file}`);

// Armaduras (torso) LPC en hoja universal combinada de 64×64 (13 cols), igual que
// los cascos: walk filas 8-11, slash 12-15, idle 22-25. depth 3 (sobre el cuerpo).
function armourLayer(prefix: string, file: string): EquipLayerConfig {
  const p = prefix;
  const C = 13;
  return {
    frameWidth: 64, frameHeight: 64, depth: 3, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [{
      key: `${p}_main`,
      path: `assets/sprites/player/equip/torso/${file}`,
      frameWidth: 64, frameHeight: 64,
      anims: [
        { key: `${p}_idle_up`,      startFrame: 22 * C, endFrame: 22 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_left`,    startFrame: 23 * C, endFrame: 23 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_down`,    startFrame: 24 * C, endFrame: 24 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_right`,   startFrame: 25 * C, endFrame: 25 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_walk_up`,      startFrame: 8 * C,  endFrame: 8 * C + 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_left`,    startFrame: 9 * C,  endFrame: 9 * C + 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_down`,    startFrame: 10 * C, endFrame: 10 * C + 8, frameRate: 10, repeat: -1 },
        { key: `${p}_walk_right`,   startFrame: 11 * C, endFrame: 11 * C + 8, frameRate: 10, repeat: -1 },
        { key: `${p}_attack_up`,    startFrame: 12 * C, endFrame: 12 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_left`,  startFrame: 13 * C, endFrame: 13 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_down`,  startFrame: 14 * C, endFrame: 14 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_right`, startFrame: 15 * C, endFrame: 15 * C + 5, frameRate: 10, repeat: 0 },
      ],
    }],
  };
}

// Cascos LPC en hoja universal combinada de 64×64 (13 cols), alineada 1:1 con el
// cuerpo. walk filas 8-11 (9fr), slash 12-15 (6fr), idle 22-25 (2fr). depth 3
// (siempre sobre el cuerpo; el casco va en la cabeza, no necesita depthWhenUp).
function helmLayer(prefix: string, file: string): EquipLayerConfig {
  const p = prefix;
  const C = 13;
  return {
    frameWidth: 64, frameHeight: 64, depth: 3, mode: 'anim',
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [{
      key: `${p}_main`,
      path: `assets/sprites/player/equip/helms/${file}`,
      frameWidth: 64, frameHeight: 64,
      anims: [
        { key: `${p}_idle_up`,      startFrame: 22 * C, endFrame: 22 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_left`,    startFrame: 23 * C, endFrame: 23 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_down`,    startFrame: 24 * C, endFrame: 24 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_idle_right`,   startFrame: 25 * C, endFrame: 25 * C + 1, frameRate: 2,  repeat: -1 },
        { key: `${p}_walk_up`,      startFrame: 8 * C,  endFrame: 8 * C + 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_left`,    startFrame: 9 * C,  endFrame: 9 * C + 8,  frameRate: 10, repeat: -1 },
        { key: `${p}_walk_down`,    startFrame: 10 * C, endFrame: 10 * C + 8, frameRate: 10, repeat: -1 },
        { key: `${p}_walk_right`,   startFrame: 11 * C, endFrame: 11 * C + 8, frameRate: 10, repeat: -1 },
        { key: `${p}_attack_up`,    startFrame: 12 * C, endFrame: 12 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_left`,  startFrame: 13 * C, endFrame: 13 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_down`,  startFrame: 14 * C, endFrame: 14 * C + 5, frameRate: 10, repeat: 0 },
        { key: `${p}_attack_right`, startFrame: 15 * C, endFrame: 15 * C + 5, frameRate: 10, repeat: 0 },
      ],
    }],
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

// Bastones de mago (assets/sprites/player/equip/weapons/staff/staff). Hoja LPC
// "magic" combinada de 1536×4224 que mezcla dos tamaños de frame sobre el MISMO PNG:
//   · walk/idle a 64×64 (rejilla de 24 cols). walk filas 8-11 (9 frames, cols 0-8).
//     No hay slash a 64px; el idle reutiliza el primer frame de cada walk.
//   · cast "oversize" a 192×192 (rejilla de 8 cols). bloque filas 18-21 (8 frames),
//     una por dirección (up/left/down/right) → se usa como animación de ataque.
// Cargamos el PNG con DOS claves (64 y 192). El ataque usa la de 192 con
// oversizeOffsetY=160 (= (192-64)/2 × 2.5; el personaje va centrado en el frame de
// 192). syncLayers aplica ese offset dinámicamente al reproducir un frame oversize.
function staffLayer(prefix: string, file: string): EquipLayerConfig {
  const p = prefix;
  const path = `assets/sprites/player/equip/weapons/staff/staff/${file}`;
  const C64 = 24;   // columnas a 64px
  const walk = { up: 8 * C64, left: 9 * C64, down: 10 * C64, right: 11 * C64 };
  const C192 = 8;   // columnas a 192px
  const cast = { up: 18 * C192, left: 19 * C192, down: 20 * C192, right: 21 * C192 };
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    depthWhenUp: 1.5,   // detrás del jugador salvo mirando hacia abajo
    oversizeSheetKey: `${p}_cast`, oversizeOffsetY: 160,
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_main`, path, frameWidth: 64, frameHeight: 64,
        anims: [
          // idle = primer frame del walk de cada dirección (la hoja no trae idle propio)
          { key: `${p}_idle_up`,      startFrame: walk.up,    endFrame: walk.up,        frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,    startFrame: walk.left,  endFrame: walk.left,      frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,    startFrame: walk.down,  endFrame: walk.down,      frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`,   startFrame: walk.right, endFrame: walk.right,     frameRate: 2,  repeat: -1 },
          { key: `${p}_walk_up`,      startFrame: walk.up,    endFrame: walk.up + 8,    frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,    startFrame: walk.left,  endFrame: walk.left + 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,    startFrame: walk.down,  endFrame: walk.down + 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`,   startFrame: walk.right, endFrame: walk.right + 8, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: `${p}_cast`, path, frameWidth: 192, frameHeight: 192,
        anims: [
          // El bloque del bastón (8 frames de 192px) está dibujado para superponerse al
          // THRUST del cuerpo (filas 4-7, 8 frames). Por eso el bastón ataca con thrust
          // (no slash) → estas claves son '_thrust_' y mapean 1:1 con 'player_thrust_*'.
          { key: `${p}_thrust_up`,    startFrame: cast.up,    endFrame: cast.up + 7,    frameRate: 13, repeat: 0 },
          { key: `${p}_thrust_left`,  startFrame: cast.left,  endFrame: cast.left + 7,  frameRate: 13, repeat: 0 },
          { key: `${p}_thrust_down`,  startFrame: cast.down,  endFrame: cast.down + 7,  frameRate: 13, repeat: 0 },
          { key: `${p}_thrust_right`, startFrame: cast.right, endFrame: cast.right + 7, frameRate: 13, repeat: 0 },
        ],
      },
    ],
  };
}

// Herramientas de recolección (picos, hachas…) en assets/sprites/player/equip/tools.
// Todas comparten la hoja LPC "smash" combinada de 832×3968 que mezcla dos tamaños:
//   · walk/idle a 64×64 (rejilla 13 cols). walk filas 8-11 (9 frames). No trae idle
//     propio → idle reutiliza el 1er frame del walk de cada dirección.
//   · golpe ("smash") oversize a 128×128 (rejilla 6 cols). bloque filas 27-30, una
//     por dirección (6 frames) → animación de ATAQUE al recolectar. (La col 2 va
//     vacía: en ese frame la herramienta pasa por detrás del cuerpo; solo tenemos la
//     capa fg. Aceptable.) Cargamos el PNG con DOS claves (64 y 128); el ataque usa la
//     de 128 con oversizeOffsetY=80 (= (128-64)/2 × 2.5). Solo se pinta en su modo
//     (minería para el pico, tala para el hacha).
function toolLayer(prefix: string, subdir: string, file: string): EquipLayerConfig {
  const p = prefix;
  const path = `assets/sprites/player/equip/tools/${subdir}/${file}`;
  const C = 13;
  const walk = { up: 8 * C, left: 9 * C, down: 10 * C, right: 11 * C }; // 104,117,130,143
  const C128 = 6;   // columnas a 128px
  const smash = { up: 27 * C128, left: 28 * C128, down: 29 * C128, right: 30 * C128 };
  return {
    frameWidth: 64, frameHeight: 64, depth: 4, mode: 'anim',
    depthWhenUp: 1.5,   // detrás del jugador salvo mirando hacia abajo
    oversizeSheetKey: `${p}_smash`, oversizeOffsetY: 80,
    playerPrefix: 'player_', layerPrefix: `${p}_`, fallbackAnim: `${p}_idle_down`,
    sheets: [
      {
        key: `${p}_main`, path, frameWidth: 64, frameHeight: 64,
        anims: [
          { key: `${p}_idle_up`,    startFrame: walk.up,    endFrame: walk.up,        frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_left`,  startFrame: walk.left,  endFrame: walk.left,      frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_down`,  startFrame: walk.down,  endFrame: walk.down,      frameRate: 2,  repeat: -1 },
          { key: `${p}_idle_right`, startFrame: walk.right, endFrame: walk.right,     frameRate: 2,  repeat: -1 },
          { key: `${p}_walk_up`,    startFrame: walk.up,    endFrame: walk.up + 8,    frameRate: 10, repeat: -1 },
          { key: `${p}_walk_left`,  startFrame: walk.left,  endFrame: walk.left + 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_down`,  startFrame: walk.down,  endFrame: walk.down + 8,  frameRate: 10, repeat: -1 },
          { key: `${p}_walk_right`, startFrame: walk.right, endFrame: walk.right + 8, frameRate: 10, repeat: -1 },
        ],
      },
      {
        key: `${p}_smash`, path, frameWidth: 128, frameHeight: 128,
        anims: [
          { key: `${p}_attack_up`,    startFrame: smash.up,    endFrame: smash.up + 5,    frameRate: 12, repeat: 0 },
          { key: `${p}_attack_left`,  startFrame: smash.left,  endFrame: smash.left + 5,  frameRate: 12, repeat: 0 },
          { key: `${p}_attack_down`,  startFrame: smash.down,  endFrame: smash.down + 5,  frameRate: 12, repeat: 0 },
          { key: `${p}_attack_right`, startFrame: smash.right, endFrame: smash.right + 5, frameRate: 12, repeat: 0 },
        ],
      },
    ],
  };
}

export const EQUIP_LAYER_REGISTRY: Record<string, EquipLayerConfig> = {
  // ── Herramientas de recolección (assets/sprites/player/equip/tools) ─────────
  'Pico de Hierro':  toolLayer('pick01', 'picks', 'pick_01.png'),
  'Hacha de Hierro': toolLayer('axe01',  'axes',  'axe_01.png'),
  // ── Bastones de mago (assets/sprites/player/equip/weapons/staff/staff) ───────
  'Bastón Nudoso':   staffLayer('staff01', 'staff_01.png'),
  'Báculo de Roble': staffLayer('staff02', 'staff_02.png'),
  'Cayado Arcano':   staffLayer('staff03', 'staff_03.png'),
  'Vara de Cristal': staffLayer('staff04', 'staff_04.png'),
  // ── Espadas (assets/sprites/player/equip/weapons/swords) ────────────────────
  'Espada de Acero':  swordLayer64('sword01', 'sword_01.png'),
  'Cimitarra Dorada': swordLayerArming('sword02', 'sword_02.png'),
  'Hoja Ardiente':    swordLayerArming('sword03', 'sword_03.png'),
  'Sable Rúnico':     swordLayerArming('sword04', 'sword_04.png'),
  'Colmillo Carmesí': swordLayerArming('sword05', 'sword_05.png'),
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
  // ── Botas (assets/sprites/player/equip/foot) ────────────────────────────────
  'Botas de Marfil':   bootsLayer('foot01', 'foot_01.png'),
  'Botas de Amatista': bootsLayer('foot02', 'foot_02.png'),
  'Botas Carmesí':     bootsLayer('foot03', 'foot_03.png'),
  'Botas de Cobalto':  bootsLayer('foot04', 'foot_04.png'),
  // ── Pantalones (assets/sprites/player/equip/lets_final) ─────────────────────
  'Grebas de Cuero':     legsLayer('legs01', 'legs_01.png'),
  'Grebas de Obsidiana': legsLayer('legs02', 'legs_02.png'),
  'Grebas Doradas':      legsLayer('legs03', 'legs_03.png'),
  'Grebas de Cobalto':   legsLayer('legs04', 'legs_04.png'),
  // ── Armaduras / torsos (assets/sprites/player/equip/torso) ──────────────────
  'Coraza de Marfil':    armourLayer('torso01', 'torso_01.png'),
  'Coraza de Obsidiana': armourLayer('torso02', 'torso_02.png'),
  'Coraza de Cobalto':   armourLayer('torso03', 'torso_03.png'),
  'Coraza Dorada':       armourLayer('torso04', 'torso_04.png'),
  // ── Cascos (assets/sprites/player/equip/helms) ──────────────────────────────
  'Yelmo de Hierro':   helmLayer('helm01', 'helm_01.png'),
  'Yelmo de Plata':    helmLayer('helm02', 'helm_02.png'),
  'Casco de Cuero':    helmLayer('helm03', 'helm_03.png'),
  'Capacete de Cuero': helmLayer('helm04', 'helm_04.png'),
};
