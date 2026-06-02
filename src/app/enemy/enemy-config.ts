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

// ── Definición del Slime6 ─────────────────────────────────────────────────────

const SLIME6_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime6: EnemyTypeConfig = {
  type: 'slime6',
  hp: 50,
  scale: 3,
  speed: 150,
  damage: 6,
  attackCooldown: 1500,
  actions: {
    idle: {
      filename: 'Slime3_Idle_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 6, repeat: -1,
      directional: true,
      frames: dirFrames(6, SLIME6_DIR),
    },
    walk: {
      filename: 'Slime3_Walk_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 8, repeat: -1,
      directional: true,
      frames: dirFrames(8, SLIME6_DIR),
    },
    run: {
      filename: 'Slime3_Run_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 10, repeat: -1,
      directional: true,
      frames: dirFrames(8, SLIME6_DIR),
    },
    attack: {
      filename: 'Slime3_Attack_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 8, repeat: 0,
      directional: true,
      frames: dirFrames(9, SLIME6_DIR),
    },
    hurt: {
      filename: 'Slime3_Hurt_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 10, repeat: 0,
      directional: true,
      frames: dirFrames(5, SLIME6_DIR),
    },
    death: {
      filename: 'Slime3_Death_with_shadow',
      frameWidth: 64, frameHeight: 64,
      frameRate: 6, repeat: 0,
      directional: true,
      frames: dirFrames(10, SLIME6_DIR),
    },
  },
};

const slime6_elite: EnemyTypeConfig = {
  ...slime6,
  type: 'slime6_elite',
  hp: 150,
  scale: 3.5,
  speed: 165,
  damage: 12,
  attackCooldown: 1200,
  tint: 0xffcc00,
  spriteType: 'slime6',
};

const slime6_oblivion: EnemyTypeConfig = {
  ...slime6,
  type: 'slime6_oblivion',
  hp: 400,
  scale: 4,
  speed: 180,
  damage: 20,
  attackCooldown: 1000,
  tint: 0xcc00ff,
  spriteType: 'slime6',
};

// ── Definición del Slime1 ─────────────────────────────────────────────────────

const SLIME1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime1: EnemyTypeConfig = {
  type: 'slime1',
  hp: 20,
  scale: 3,
  speed: 110,
  damage: 3,
  attackCooldown: 1800,
  actions: {
    idle:   { filename: 'Slime1_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true,  frames: dirFrames(6,  SLIME1_DIR) },
    walk:   { filename: 'Slime1_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true,  frames: dirFrames(8,  SLIME1_DIR) },
    run:    { filename: 'Slime1_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true,  frames: dirFrames(8,  SLIME1_DIR) },
    attack: { filename: 'Slime1_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME1_DIR) },
    hurt:   { filename: 'Slime1_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true,  frames: dirFrames(5,  SLIME1_DIR) },
    death:  { filename: 'Slime1_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME1_DIR) },
  },
};

const slime1_elite: EnemyTypeConfig    = { ...slime1, type: 'slime1_elite',    hp: 60,  scale: 3.5, speed: 125, damage: 7,  attackCooldown: 1500, tint: 0xffcc00, spriteType: 'slime1' };
const slime1_oblivion: EnemyTypeConfig = { ...slime1, type: 'slime1_oblivion', hp: 200, scale: 4,   speed: 140, damage: 14, attackCooldown: 1200, tint: 0xcc00ff, spriteType: 'slime1' };

// ── Definición del Slime2 ─────────────────────────────────────────────────────

const SLIME2_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime2: EnemyTypeConfig = {
  type: 'slime2',
  hp: 28,
  scale: 3,
  speed: 120,
  damage: 4,
  attackCooldown: 1700,
  actions: {
    idle:   { filename: 'Slime2_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true,  frames: dirFrames(6,  SLIME2_DIR) },
    walk:   { filename: 'Slime2_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true,  frames: dirFrames(8,  SLIME2_DIR) },
    run:    { filename: 'Slime2_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true,  frames: dirFrames(8,  SLIME2_DIR) },
    attack: { filename: 'Slime2_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(11, SLIME2_DIR) },
    hurt:   { filename: 'Slime2_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true,  frames: dirFrames(5,  SLIME2_DIR) },
    death:  { filename: 'Slime2_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME2_DIR) },
  },
};

const slime2_elite: EnemyTypeConfig    = { ...slime2, type: 'slime2_elite',    hp: 80,  scale: 3.5, speed: 135, damage: 9,  attackCooldown: 1400, tint: 0xffcc00, spriteType: 'slime2' };
const slime2_oblivion: EnemyTypeConfig = { ...slime2, type: 'slime2_oblivion', hp: 250, scale: 4,   speed: 150, damage: 16, attackCooldown: 1100, tint: 0xcc00ff, spriteType: 'slime2' };

// ── Definición del Slime3 ─────────────────────────────────────────────────────

const SLIME3_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime3: EnemyTypeConfig = {
  type: 'slime3',
  hp: 36,
  scale: 3,
  speed: 130,
  damage: 5,
  attackCooldown: 1600,
  actions: {
    idle:   { filename: 'Slime3_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true,  frames: dirFrames(6,  SLIME3_DIR) },
    walk:   { filename: 'Slime3_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true,  frames: dirFrames(8,  SLIME3_DIR) },
    run:    { filename: 'Slime3_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true,  frames: dirFrames(8,  SLIME3_DIR) },
    attack: { filename: 'Slime3_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(9,  SLIME3_DIR) },
    hurt:   { filename: 'Slime3_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true,  frames: dirFrames(5,  SLIME3_DIR) },
    death:  { filename: 'Slime3_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME3_DIR) },
  },
};

const slime3_elite: EnemyTypeConfig    = { ...slime3, type: 'slime3_elite',    hp: 100, scale: 3.5, speed: 145, damage: 11, attackCooldown: 1300, tint: 0xffcc00, spriteType: 'slime3' };
const slime3_oblivion: EnemyTypeConfig = { ...slime3, type: 'slime3_oblivion', hp: 300, scale: 4,   speed: 160, damage: 18, attackCooldown: 1000, tint: 0xcc00ff, spriteType: 'slime3' };

// ── Definición del Slime7 ─────────────────────────────────────────────────────

const SLIME7_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime7: EnemyTypeConfig = {
  type: 'slime7',
  hp: 65,
  scale: 3,
  speed: 160,
  damage: 8,
  attackCooldown: 1400,
  actions: {
    idle:   { filename: 'Slime1_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true,  frames: dirFrames(6,  SLIME7_DIR) },
    walk:   { filename: 'Slime1_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true,  frames: dirFrames(8,  SLIME7_DIR) },
    run:    { filename: 'Slime1_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true,  frames: dirFrames(8,  SLIME7_DIR) },
    attack: { filename: 'Slime1_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME7_DIR) },
    hurt:   { filename: 'Slime1_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true,  frames: dirFrames(5,  SLIME7_DIR) },
    death:  { filename: 'Slime1_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME7_DIR) },
  },
};

const slime7_elite: EnemyTypeConfig    = { ...slime7, type: 'slime7_elite',    hp: 180, scale: 3.5, speed: 175, damage: 16, attackCooldown: 1200, tint: 0xffcc00, spriteType: 'slime7' };
const slime7_oblivion: EnemyTypeConfig = { ...slime7, type: 'slime7_oblivion', hp: 500, scale: 4,   speed: 195, damage: 28, attackCooldown: 950,  tint: 0xcc00ff, spriteType: 'slime7' };

// ── Definición del Slime8 ─────────────────────────────────────────────────────

const SLIME8_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime8: EnemyTypeConfig = {
  type: 'slime8',
  hp: 80,
  scale: 3,
  speed: 165,
  damage: 9,
  attackCooldown: 1300,
  actions: {
    idle:   { filename: 'Slime2_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true,  frames: dirFrames(6,  SLIME8_DIR) },
    walk:   { filename: 'Slime2_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true,  frames: dirFrames(8,  SLIME8_DIR) },
    run:    { filename: 'Slime2_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true,  frames: dirFrames(8,  SLIME8_DIR) },
    attack: { filename: 'Slime2_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME8_DIR) },
    hurt:   { filename: 'Slime2_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true,  frames: dirFrames(5,  SLIME8_DIR) },
    death:  { filename: 'Slime2_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME8_DIR) },
  },
};

const slime8_elite: EnemyTypeConfig    = { ...slime8, type: 'slime8_elite',    hp: 220, scale: 3.5, speed: 180, damage: 18, attackCooldown: 1100, tint: 0xffcc00, spriteType: 'slime8' };
const slime8_oblivion: EnemyTypeConfig = { ...slime8, type: 'slime8_oblivion', hp: 600, scale: 4,   speed: 200, damage: 32, attackCooldown: 900,  tint: 0xcc00ff, spriteType: 'slime8' };

// ── Definición del Slime9 ─────────────────────────────────────────────────────

const SLIME9_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const slime9: EnemyTypeConfig = {
  type: 'slime9',
  hp: 95,
  scale: 3,
  speed: 170,
  damage: 10,
  attackCooldown: 1200,
  actions: {
    idle:   { filename: 'Slime3_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true,  frames: dirFrames(6,  SLIME9_DIR) },
    walk:   { filename: 'Slime3_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true,  frames: dirFrames(8,  SLIME9_DIR) },
    run:    { filename: 'Slime3_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true,  frames: dirFrames(8,  SLIME9_DIR) },
    attack: { filename: 'Slime3_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(9,  SLIME9_DIR) },
    hurt:   { filename: 'Slime3_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true,  frames: dirFrames(5,  SLIME9_DIR) },
    death:  { filename: 'Slime3_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME9_DIR) },
  },
};

const slime9_elite: EnemyTypeConfig    = { ...slime9, type: 'slime9_elite',    hp: 260, scale: 3.5, speed: 185, damage: 20, attackCooldown: 1000, tint: 0xffcc00, spriteType: 'slime9' };
const slime9_oblivion: EnemyTypeConfig = { ...slime9, type: 'slime9_oblivion', hp: 700, scale: 4,   speed: 205, damage: 36, attackCooldown: 850,  tint: 0xcc00ff, spriteType: 'slime9' };

// ── Variantes Elite y Oblivion del Slime4 ────────────────────────────────────

const slime4_elite: EnemyTypeConfig = {
  ...slime4,
  type: 'slime4_elite',
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
  hp: 400,
  scale: 4,
  speed: 180,
  damage: 20,
  attackCooldown: 1000,
  tint: 0xcc00ff,
  spriteType: 'slime4',
};

// ── Registro global de tipos de enemigo ──────────────────────────────────────
// Para añadir un enemigo nuevo: agregar su config aquí.

export const ENEMY_REGISTRY: Record<string, EnemyTypeConfig> = {
  orc1,
  orc1_elite,
  orc1_oblivion,
  slime1,
  slime1_elite,
  slime1_oblivion,
  slime2,
  slime2_elite,
  slime2_oblivion,
  slime3,
  slime3_elite,
  slime3_oblivion,
  slime4,
  slime4_elite,
  slime4_oblivion,
  slime5,
  slime5_elite,
  slime5_oblivion,
  slime6,
  slime6_elite,
  slime6_oblivion,
  slime7,
  slime7_elite,
  slime7_oblivion,
  slime8,
  slime8_elite,
  slime8_oblivion,
  slime9,
  slime9_elite,
  slime9_oblivion,
};
