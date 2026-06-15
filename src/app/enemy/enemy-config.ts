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
  hp: 50,
  scale: 3,
  speed: 96,
  damage: 8,
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
  hp: 150,
  scale: 3.5,
  speed: 110,
  damage: 15,
  attackCooldown: 1200,
  tint: 0xffcc00,
  spriteType: 'orc1',
};

const orc1_oblivion: EnemyTypeConfig = {
  ...orc1,
  type: 'orc1_oblivion',
  displayName: 'Orco',
  hp: 400,
  scale: 4,
  speed: 130,
  damage: 25,
  attackCooldown: 1000,
  tint: 0xcc00ff,
  spriteType: 'orc1',
};

// ── Definición del Slime4 ─────────────────────────────────────────────────────

const SLIME4_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime4: EnemyTypeConfig = {
  type: 'slime4',
  displayName: 'Slime',
  hp: 50,
  scale: 3,
  speed: 150,
  damage: 6,
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
  hp: 50,
  scale: 3,
  speed: 150,
  damage: 6,
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
  hp: 150,
  scale: 3.5,
  speed: 165,
  damage: 12,
  attackCooldown: 1200,
  tint: 0xffcc00,
  spriteType: 'slime5',
};

const slime5_oblivion: EnemyTypeConfig = {
  ...slime5,
  type: 'slime5_oblivion',
  hp: 400,
  scale: 4,
  speed: 180,
  damage: 20,
  attackCooldown: 1000,
  tint: 0xcc00ff,
  spriteType: 'slime5',
};

// ── Variantes Elite y Oblivion del Slime4 ────────────────────────────────────

const slime4_elite: EnemyTypeConfig = {
  ...slime4,
  type: 'slime4_elite',
  displayName: 'Slime',
  hp: 150,
  scale: 3.5,
  speed: 165,
  damage: 12,
  attackCooldown: 1200,
  tint: 0xffcc00,
  spriteType: 'slime4',
};

const slime4_oblivion: EnemyTypeConfig = {
  ...slime4,
  type: 'slime4_oblivion',
  displayName: 'Slime',
  hp: 400,
  scale: 4,
  speed: 180,
  damage: 20,
  attackCooldown: 1000,
  tint: 0xcc00ff,
  spriteType: 'slime4',
};

// ── Definición del Goobling2 ─────────────────────────────────────────────────

const GOOBLING2_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const goobling2: EnemyTypeConfig = {
  type: 'goobling2',
  hp: 35,
  scale: 3,
  speed: 115,
  damage: 5,
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

const goobling2_elite: EnemyTypeConfig    = { ...goobling2, type: 'goobling2_elite',    hp: 105, scale: 3.5, speed: 127, damage: 10, attackCooldown: 1360, tint: 0xffcc00, spriteType: 'goobling2' };
const goobling2_oblivion: EnemyTypeConfig = { ...goobling2, type: 'goobling2_oblivion', hp: 280, scale: 4,   speed: 138, damage: 17, attackCooldown: 1140, tint: 0xcc00ff, spriteType: 'goobling2' };

// ── Definición del Gnoll1 ────────────────────────────────────────────────────

const GNOLL1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const gnoll1: EnemyTypeConfig = {
  type: 'gnoll1',
  hp: 40,
  scale: 3,
  speed: 110,
  damage: 6,
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

const gnoll1_elite: EnemyTypeConfig    = { ...gnoll1, type: 'gnoll1_elite',    hp: 120, scale: 3.5, speed: 121, damage: 12, attackCooldown: 1280, tint: 0xffcc00, spriteType: 'gnoll1' };
const gnoll1_oblivion: EnemyTypeConfig = { ...gnoll1, type: 'gnoll1_oblivion', hp: 320, scale: 4,   speed: 132, damage: 20, attackCooldown: 1072, tint: 0xcc00ff, spriteType: 'gnoll1' };

// ── Definición del Golem1 ────────────────────────────────────────────────────

const GOLEM1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const golem1: EnemyTypeConfig = {
  type: 'golem1',
  hp: 80,
  scale: 4.5,
  speed: 70,
  damage: 16,
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

const golem1_elite: EnemyTypeConfig    = { ...golem1, type: 'golem1_elite',    hp: 240, scale: 5.5, speed: 77, damage: 32, attackCooldown: 1600, tint: 0xffcc00, spriteType: 'golem1' };
const golem1_oblivion: EnemyTypeConfig = { ...golem1, type: 'golem1_oblivion', hp: 640, scale: 6, speed: 84, damage: 53, attackCooldown: 1340, tint: 0xcc00ff, spriteType: 'golem1' };

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
};
