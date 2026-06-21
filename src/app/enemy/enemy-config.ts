import { Direction } from '../pnj/interfaces/Direction';

// ── Tipos de frame ────────────────────────────────────────────────────────────

export interface DirectionFrames {
  [Direction.DOWN]:  { start: number; end: number };
  [Direction.LEFT]:  { start: number; end: number };
  [Direction.UP]:    { start: number; end: number };
  [Direction.RIGHT]: { start: number; end: number };
}

export interface OmniFrames {
  start: number;
  end: number;
}

// ── Configuración de una acción ───────────────────────────────────────────────

export interface ActionConfig {
  filename: string;        // sin extensión, relativo al directorio del tipo
  frameWidth: number;
  frameHeight: number;
  frameRate: number;
  repeat: number;          // -1 = loop, 0 = once
  directional: boolean;
  frames: DirectionFrames | OmniFrames;
}

// ── Config completa de un tipo de enemigo ─────────────────────────────────────

export interface EnemyTypeConfig {
  type: string;
  hp: number;
  scale: number;
  speed: number;           // px/s
  damage: number;
  attackCooldown: number;  // ms
  displayName?: string;    // nombre visible al jugador (si omitido usa type)
  tint?: number;           // tint visual (0xRRGGBB) — usado para elite/oblivion
  spriteType?: string;     // tipo base cuyos sprites se reusan (omite carga propia)
  actions: {
    idle?:             ActionConfig;
    walk?:             ActionConfig;
    run?:              ActionConfig;
    attack?:           ActionConfig;
    hurt?:             ActionConfig;
    death?:            ActionConfig;
    walkAttackFront?:  ActionConfig;
    runAttackFront?:   ActionConfig;
  };
}

// ── Helper: calcula frames por dirección asumiendo filas en el orden indicado ─

export type DirOrder = [Direction, Direction, Direction, Direction];

export const DEFAULT_DIR_ORDER: DirOrder = [
  Direction.DOWN, Direction.LEFT, Direction.UP, Direction.RIGHT,
];

export function dirFrames(
  framesPerDir: number,
  order: DirOrder = DEFAULT_DIR_ORDER,
): DirectionFrames {
  const result: any = {};
  order.forEach((dir, i) => {
    result[dir] = { start: i * framesPerDir, end: i * framesPerDir + framesPerDir - 1 };
  });
  return result as DirectionFrames;
}

// ── Definición del Orc1 ───────────────────────────────────────────────────────
// Ajusta framesPerDir si los sprites tienen más o menos frames por dirección.

const ORC1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const orc1: EnemyTypeConfig = {
  type: 'orc1',
  displayName: 'Orco',
  hp: 200,                 // mapa 1-3
  scale: 3,
  speed: 96,
  damage: 20,
  attackCooldown: 1500,
  actions: {
    idle: {
      filename: 'orc1_idle_full',
      frameWidth: 64, frameHeight: 64,
      frameRate: 4, repeat: -1,
      directional: true,
      frames: dirFrames(4, ORC1_DIR),
    },
    walk: {
      filename: 'orc1_walk_full',
      frameWidth: 64, frameHeight: 64,
      frameRate: 8, repeat: -1,
      directional: true,
      frames: dirFrames(6, ORC1_DIR),
    },
    run: {
      filename: 'orc1_run_full',
      frameWidth: 64, frameHeight: 64,
      frameRate: 10, repeat: -1,
      directional: true,
      frames: dirFrames(8, ORC1_DIR),
    },
    attack: {
      filename: 'orc1_attack_full',
      frameWidth: 64, frameHeight: 64,
      frameRate: 8, repeat: 0,
      directional: true,
      frames: dirFrames(8, ORC1_DIR),
    },
    hurt: {
      filename: 'orc1_hurt_full',
      frameWidth: 64, frameHeight: 64,
      frameRate: 10, repeat: 0,
      directional: true,
      frames: dirFrames(6, ORC1_DIR),
    },
    death: {
      filename: 'orc1_death_full',
      frameWidth: 64, frameHeight: 64,
      frameRate: 6, repeat: 0,
      directional: false,
      frames: { start: 0, end: 7 },
    },
  },
};

// ── Variantes Elite y Oblivion del Orc1 ─────────────────────────────────────
// Reusan los sprites de orc1 (spriteType: 'orc1') — no requieren assets propios.

const orc1_elite: EnemyTypeConfig = {
  ...orc1,
  type: 'orc1_elite',
  displayName: 'Orco',
  hp: orc1.hp * 3,
  scale: 3.5,
  speed: 110,
  damage: orc1.damage * 2,
  attackCooldown: 1200,
  tint: 0xffcc00,
  spriteType: 'orc1',
};

const orc1_oblivion: EnemyTypeConfig = {
  ...orc1,
  type: 'orc1_oblivion',
  displayName: 'Orco',
  hp: orc1.hp * 8,
  scale: 4,
  speed: 130,
  damage: orc1.damage * 3,
  attackCooldown: 1000,
  tint: 0xcc00ff,
  spriteType: 'orc1',
};

// ── Definición del Slime4 ─────────────────────────────────────────────────────

const SLIME4_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime4: EnemyTypeConfig = {
  type: 'slime4',
  displayName: 'Slime',
  hp: 100,                 // mapa 1-1
  scale: 3,
  speed: 150,
  damage: 12,
  attackCooldown: 1500,
  actions: {
    idle: {
      filename: 'Slime1_Idle_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 6, repeat: -1,
      directional: true,
      frames: dirFrames(6, SLIME4_DIR),
    },
    walk: {
      filename: 'Slime1_Walk_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 8, repeat: -1,
      directional: true,
      frames: dirFrames(8, SLIME4_DIR),
    },
    run: {
      filename: 'Slime1_Run_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 10, repeat: -1,
      directional: true,
      frames: dirFrames(8, SLIME4_DIR),
    },
    attack: {
      filename: 'Slime1_Attack_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 8, repeat: 0,
      directional: true,
      frames: dirFrames(10, SLIME4_DIR),
    },
    hurt: {
      filename: 'Slime1_Hurt_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 10, repeat: 0,
      directional: true,
      frames: dirFrames(5, SLIME4_DIR),
    },
    death: {
      filename: 'Slime1_Death_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 6, repeat: 0,
      directional: true,
      frames: dirFrames(10, SLIME4_DIR),
    },
  },
};

// ── Definición del Slime5 ─────────────────────────────────────────────────────

const SLIME5_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime5: EnemyTypeConfig = {
  type: 'slime5',
  displayName: 'Slime mejorado',
  hp: 125,
  scale: 3,
  speed: 150,
  damage: 14,
  attackCooldown: 1500,
  actions: {
    idle: {
      filename: 'Slime2_Idle_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 6, repeat: -1,
      directional: true,
      frames: dirFrames(6, SLIME5_DIR),
    },
    walk: {
      filename: 'Slime2_Walk_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 8, repeat: -1,
      directional: true,
      frames: dirFrames(8, SLIME5_DIR),
    },
    run: {
      filename: 'Slime2_Run_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 10, repeat: -1,
      directional: true,
      frames: dirFrames(8, SLIME5_DIR),
    },
    attack: {
      filename: 'Slime2_Attack_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 8, repeat: 0,
      directional: true,
      frames: dirFrames(11, SLIME5_DIR),
    },
    hurt: {
      filename: 'Slime2_Hurt_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 10, repeat: 0,
      directional: true,
      frames: dirFrames(5, SLIME5_DIR),
    },
    death: {
      filename: 'Slime2_Death_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 6, repeat: 0,
      directional: true,
      frames: dirFrames(10, SLIME5_DIR),
    },
  },
};

const slime5_elite: EnemyTypeConfig = {
  ...slime5,
  type: 'slime5_elite',
  hp: slime5.hp * 3,
  scale: 3.5,
  speed: 165,
  damage: slime5.damage * 2,
  attackCooldown: 1200,
  tint: 0xffcc00,
  spriteType: 'slime5',
};

const slime5_oblivion: EnemyTypeConfig = {
  ...slime5,
  type: 'slime5_oblivion',
  hp: slime5.hp * 8,
  scale: 4,
  speed: 180,
  damage: slime5.damage * 3,
  attackCooldown: 1000,
  tint: 0xcc00ff,
  spriteType: 'slime5',
};

// ── Variantes Elite y Oblivion del Slime4 ────────────────────────────────────

const slime4_elite: EnemyTypeConfig = {
  ...slime4,
  type: 'slime4_elite',
  displayName: 'Slime',
  hp: slime4.hp * 3,
  scale: 3.5,
  speed: 165,
  damage: slime4.damage * 2,
  attackCooldown: 1200,
  tint: 0xffcc00,
  spriteType: 'slime4',
};

const slime4_oblivion: EnemyTypeConfig = {
  ...slime4,
  type: 'slime4_oblivion',
  displayName: 'Slime',
  hp: slime4.hp * 8,
  scale: 4,
  speed: 180,
  damage: slime4.damage * 3,
  attackCooldown: 1000,
  tint: 0xcc00ff,
  spriteType: 'slime4',
};

// ── Definición del Goobling2 ─────────────────────────────────────────────────

const GOOBLING2_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const goobling2: EnemyTypeConfig = {
  type: 'goobling2',
  displayName: 'Goblin',
  hp: 400,                 // mapa 1-7
  scale: 3,
  speed: 115,
  damage: 36,
  attackCooldown: 1700,
  actions: {
    idle:            { filename: 'Idle_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(4, GOOBLING2_DIR) },
    walk:            { filename: 'Walk_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(6, GOOBLING2_DIR) },
    run:             { filename: 'Run_with_shadow',          frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(6, GOOBLING2_DIR) },
    attack:          { filename: 'Attack_with_shadow',       frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(5, GOOBLING2_DIR) },
    hurt:            { filename: 'Hurt_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(4, GOOBLING2_DIR) },
    death:           { filename: 'Death_with_shadow',        frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(6, GOOBLING2_DIR) },
    walkAttackFront: { filename: 'Walk_attack_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(6, GOOBLING2_DIR) },
    runAttackFront:  { filename: 'Run_attack_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(7, GOOBLING2_DIR) },
  },
};

const goobling2_elite: EnemyTypeConfig    = { ...goobling2, type: 'goobling2_elite',    hp: goobling2.hp * 3, scale: 3.5, speed: 127, damage: goobling2.damage * 2, attackCooldown: 1360, tint: 0xffcc00, spriteType: 'goobling2' };
const goobling2_oblivion: EnemyTypeConfig = { ...goobling2, type: 'goobling2_oblivion', hp: goobling2.hp * 8, scale: 4,   speed: 138, damage: goobling2.damage * 3, attackCooldown: 1140, tint: 0xcc00ff, spriteType: 'goobling2' };

// ── Definición del Gnoll1 ────────────────────────────────────────────────────

const GNOLL1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const gnoll1: EnemyTypeConfig = {
  type: 'gnoll1',
  displayName: 'Gnoll',
  hp: 300,                 // mapa 1-5
  scale: 3,
  speed: 110,
  damage: 28,
  attackCooldown: 1600,
  actions: {
    idle:   { filename: 'Gnoll1_Idle_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(4, GNOLL1_DIR) },
    walk:   { filename: 'Gnoll1_Walk_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(6, GNOLL1_DIR) },
    run:    { filename: 'Gnoll1_Run_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(8,  GNOLL1_DIR) },
    attack: { filename: 'Gnoll1_Attack_with_shadow',frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(10, GNOLL1_DIR) },
    hurt:   { filename: 'Gnoll1_Hurt_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(4, GNOLL1_DIR) },
    death:  { filename: 'Gnoll_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(6, GNOLL1_DIR) },
  },
};

const gnoll1_elite: EnemyTypeConfig    = { ...gnoll1, type: 'gnoll1_elite',    hp: gnoll1.hp * 3, scale: 3.5, speed: 121, damage: gnoll1.damage * 2, attackCooldown: 1280, tint: 0xffcc00, spriteType: 'gnoll1' };
const gnoll1_oblivion: EnemyTypeConfig = { ...gnoll1, type: 'gnoll1_oblivion', hp: gnoll1.hp * 8, scale: 4,   speed: 132, damage: gnoll1.damage * 3, attackCooldown: 1072, tint: 0xcc00ff, spriteType: 'gnoll1' };

// ── Definición del Golem1 ────────────────────────────────────────────────────

const GOLEM1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const golem1: EnemyTypeConfig = {
  type: 'golem1',
  displayName: 'Golem',
  hp: 450,                 // mapa 1-8
  scale: 4.5,
  speed: 70,
  damage: 40,
  attackCooldown: 2000,
  actions: {
    idle:   { filename: 'Golem1_Idle_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 4,  repeat: -1, directional: true, frames: dirFrames(4, GOLEM1_DIR) },
    walk:   { filename: 'Golem1_Walk_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(8, GOLEM1_DIR) },
    run:    { filename: 'Golem1_Run_with_shadow',   frameWidth: 128, frameHeight: 128, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(8, GOLEM1_DIR) },
    attack: { filename: 'Golem1_Attack_with_shadow',frameWidth: 128, frameHeight: 128, frameRate: 7,  repeat: 0,  directional: true, frames: dirFrames(9, GOLEM1_DIR) },
    hurt:   { filename: 'Golem1_Hurt_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(4, GOLEM1_DIR) },
    death:  { filename: 'Golem1_Death_with_shadow', frameWidth: 128, frameHeight: 128, frameRate: 5,  repeat: 0,  directional: true, frames: dirFrames(8, GOLEM1_DIR) },
  },
};

const golem1_elite: EnemyTypeConfig    = { ...golem1, type: 'golem1_elite',    hp: golem1.hp * 3, scale: 5.5, speed: 77, damage: golem1.damage * 2, attackCooldown: 1600, tint: 0xffcc00, spriteType: 'golem1' };
const golem1_oblivion: EnemyTypeConfig = { ...golem1, type: 'golem1_oblivion', hp: golem1.hp * 8, scale: 6, speed: 84, damage: golem1.damage * 3, attackCooldown: 1340, tint: 0xcc00ff, spriteType: 'golem1' };

// ── Definición del Rat1 ──────────────────────────────────────────────────────
// Sprites 128×128 en enemy/rats1/. Rápida y frágil. Death direccional (4 filas).

const RAT1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const rats1: EnemyTypeConfig = {
  type: 'rats1',
  displayName: 'Rata',
  hp: 150,                 // mapa 1-2
  scale: 3,
  speed: 130,
  damage: 16,
  attackCooldown: 1500,
  actions: {
    idle:   { filename: 'Rat1_Idle_with_shadow',   frameWidth: 128, frameHeight: 128, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(6, RAT1_DIR) },
    walk:   { filename: 'Rat1_Walk_with_shadow',   frameWidth: 128, frameHeight: 128, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(6, RAT1_DIR) },
    run:    { filename: 'Rat1_Run_with_shadow',    frameWidth: 128, frameHeight: 128, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(6, RAT1_DIR) },
    attack: { filename: 'Rat1_Attack_with_shadow', frameWidth: 128, frameHeight: 128, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(8, RAT1_DIR) },
    hurt:   { filename: 'Rat1_Hurt_with_shadow',   frameWidth: 128, frameHeight: 128, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(4, RAT1_DIR) },
    death:  { filename: 'Rat1_Death_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(5, RAT1_DIR) },
  },
};

const rats1_elite: EnemyTypeConfig    = { ...rats1, type: 'rats1_elite',    hp: rats1.hp * 3,  scale: 3.5, speed: 143, damage: rats1.damage * 2, attackCooldown: 1200, tint: 0xffcc00, spriteType: 'rats1' };
const rats1_oblivion: EnemyTypeConfig = { ...rats1, type: 'rats1_oblivion', hp: rats1.hp * 8, scale: 4,   speed: 156, damage: rats1.damage * 3, attackCooldown: 1000, tint: 0xcc00ff, spriteType: 'rats1' };

// ── Definición del Lizardman1 ────────────────────────────────────────────────
// Sprites 64×64 en enemy/lizard1/. Equilibrado, tipo orco fuerte. Death direccional.

const LIZARD1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const lizard1: EnemyTypeConfig = {
  type: 'lizard1',
  displayName: 'Hombre Lagarto',
  hp: 350,                 // mapa 1-6
  scale: 3,
  speed: 100,
  damage: 32,
  attackCooldown: 1400,
  actions: {
    idle:   { filename: 'Lizardman1_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(4, LIZARD1_DIR) },
    walk:   { filename: 'Lizardman1_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(6, LIZARD1_DIR) },
    run:    { filename: 'Lizardman1_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(8, LIZARD1_DIR) },
    attack: { filename: 'Lizardman1_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(7, LIZARD1_DIR) },
    hurt:   { filename: 'Lizardman1_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(5, LIZARD1_DIR) },
    death:  { filename: 'Lizardman1_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(7, LIZARD1_DIR) },
  },
};

const lizard1_elite: EnemyTypeConfig    = { ...lizard1, type: 'lizard1_elite',    hp: lizard1.hp * 3, scale: 3.5, speed: 110, damage: lizard1.damage * 2, attackCooldown: 1120, tint: 0xffcc00, spriteType: 'lizard1' };
const lizard1_oblivion: EnemyTypeConfig = { ...lizard1, type: 'lizard1_oblivion', hp: lizard1.hp * 8, scale: 4,   speed: 120, damage: lizard1.damage * 3, attackCooldown: 938,  tint: 0xcc00ff, spriteType: 'lizard1' };

// ── Definición del Goobling1 ─────────────────────────────────────────────────
// Sprites 64×64 en enemy/goobling1/. Mismo set que goobling2 (con walk/run attack).

const GOOBLING1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const goobling1: EnemyTypeConfig = {
  type: 'goobling1',
  displayName: 'Goblin',
  hp: 250,                 // mapa 1-4
  scale: 3,
  speed: 110,
  damage: 24,
  attackCooldown: 1700,
  actions: {
    idle:            { filename: 'Idle0_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(4, GOOBLING1_DIR) },
    walk:            { filename: 'Walk0_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(6, GOOBLING1_DIR) },
    run:             { filename: 'Run0_with_shadow',          frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(8, GOOBLING1_DIR) },
    attack:          { filename: 'Attack0_with_shadow',       frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(5, GOOBLING1_DIR) },
    hurt:            { filename: 'Hurt0_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(4, GOOBLING1_DIR) },
    death:           { filename: 'Death0_with_shadow',        frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(6, GOOBLING1_DIR) },
    walkAttackFront: { filename: 'Walk_Attack0_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(6, GOOBLING1_DIR) },
    runAttackFront:  { filename: 'Run_Attack0_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(8, GOOBLING1_DIR) },
  },
};

const goobling1_elite: EnemyTypeConfig    = { ...goobling1, type: 'goobling1_elite',    hp: goobling1.hp * 3,  scale: 3.5, speed: 121, damage: goobling1.damage * 2,  attackCooldown: 1360, tint: 0xffcc00, spriteType: 'goobling1' };
const goobling1_oblivion: EnemyTypeConfig = { ...goobling1, type: 'goobling1_oblivion', hp: goobling1.hp * 8, scale: 4,   speed: 132, damage: goobling1.damage * 3, attackCooldown: 1140, tint: 0xcc00ff, spriteType: 'goobling1' };

// ── Registro global de tipos de enemigo ──────────────────────────────────────
// Para añadir un enemigo nuevo: agregar su config aquí.

export const ENEMY_REGISTRY: Record<string, EnemyTypeConfig> = {
  orc1,
  orc1_elite,
  orc1_oblivion,
  slime4,
  slime4_elite,
  slime4_oblivion,
  slime5,
  slime5_elite,
  slime5_oblivion,
  goobling2,
  goobling2_elite,
  goobling2_oblivion,
  gnoll1,
  gnoll1_elite,
  gnoll1_oblivion,
  golem1,
  golem1_elite,
  golem1_oblivion,
  rats1,
  rats1_elite,
  rats1_oblivion,
  lizard1,
  lizard1_elite,
  lizard1_oblivion,
  goobling1,
  goobling1_elite,
  goobling1_oblivion,
};
