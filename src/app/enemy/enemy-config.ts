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
    death:  { filename: 'Slime1_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true,  frames: dirFrames(8,  SLIME1_DIR) },
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
    attack: { filename: 'Slime2_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME2_DIR) },
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
    attack: { filename: 'Slime3_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true,  frames: dirFrames(10, SLIME9_DIR) },
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

// ── Definición del Goobling3 ─────────────────────────────────────────────────

const GOOBLING3_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const goobling3: EnemyTypeConfig = {
  type: 'goobling3',
  hp: 55,
  scale: 3,
  speed: 125,
  damage: 7,
  attackCooldown: 1500,
  actions: {
    idle:            { filename: 'Idle_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(4, GOOBLING3_DIR) },
    walk:            { filename: 'Walk_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(6, GOOBLING3_DIR) },
    run:             { filename: 'Run_with_shadow',          frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(6, GOOBLING3_DIR) },
    attack:          { filename: 'Attack_with_shadow',       frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(5, GOOBLING3_DIR) },
    hurt:            { filename: 'Hurt_with_shadow',         frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(4, GOOBLING3_DIR) },
    death:           { filename: 'Death_with_shadow',        frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(6, GOOBLING3_DIR) },
    walkAttackFront: { filename: 'Walk_attack_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(6, GOOBLING3_DIR) },
    runAttackFront:  { filename: 'Run_attack_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(7, GOOBLING3_DIR) },
  },
};

const goobling3_elite: EnemyTypeConfig    = { ...goobling3, type: 'goobling3_elite',    hp: 165, scale: 3.5, speed: 138, damage: 14, attackCooldown: 1200, tint: 0xffcc00, spriteType: 'goobling3' };
const goobling3_oblivion: EnemyTypeConfig = { ...goobling3, type: 'goobling3_oblivion', hp: 440, scale: 4,   speed: 150, damage: 23, attackCooldown: 1005, tint: 0xcc00ff, spriteType: 'goobling3' };

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

// ── Definición del Gnoll2 ────────────────────────────────────────────────────

const GNOLL2_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const gnoll2: EnemyTypeConfig = {
  type: 'gnoll2',
  hp: 65,
  scale: 3,
  speed: 118,
  damage: 9,
  attackCooldown: 1400,
  actions: {
    idle:   { filename: 'Gnoll2_Idle_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(4, GNOLL2_DIR) },
    walk:   { filename: 'Gnoll2_Walk_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(6, GNOLL2_DIR) },
    run:    { filename: 'Gnoll2_Run_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(8,  GNOLL2_DIR) },
    attack: { filename: 'Gnoll2_Attack_with_shadow',frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(10, GNOLL2_DIR) },
    hurt:   { filename: 'Gnoll2_Hurt_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(4, GNOLL2_DIR) },
    death:  { filename: 'Gnoll2_Death_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(6, GNOLL2_DIR) },
  },
};

const gnoll2_elite: EnemyTypeConfig    = { ...gnoll2, type: 'gnoll2_elite',    hp: 195, scale: 3.5, speed: 130, damage: 18, attackCooldown: 1120, tint: 0xffcc00, spriteType: 'gnoll2' };
const gnoll2_oblivion: EnemyTypeConfig = { ...gnoll2, type: 'gnoll2_oblivion', hp: 520, scale: 4,   speed: 142, damage: 30, attackCooldown: 938,  tint: 0xcc00ff, spriteType: 'gnoll2' };

// ── Definición del Gnoll3 ────────────────────────────────────────────────────

const GNOLL3_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const gnoll3: EnemyTypeConfig = {
  type: 'gnoll3',
  hp: 85,
  scale: 3,
  speed: 125,
  damage: 11,
  attackCooldown: 1300,
  actions: {
    idle:   { filename: 'Gnoll3_Idle_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(4, GNOLL3_DIR) },
    walk:   { filename: 'Gnoll3_Walk_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(6, GNOLL3_DIR) },
    run:    { filename: 'Gnoll3_Run_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(8,  GNOLL3_DIR) },
    attack: { filename: 'Gnoll3_Attack_with_shadow',frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(10, GNOLL3_DIR) },
    hurt:   { filename: 'Gnoll3_Hurt_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(4, GNOLL3_DIR) },
    death:  { filename: 'Gnoll3_Death_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(6, GNOLL3_DIR) },
  },
};

const gnoll3_elite: EnemyTypeConfig    = { ...gnoll3, type: 'gnoll3_elite',    hp: 255, scale: 3.5, speed: 138, damage: 22, attackCooldown: 1040, tint: 0xffcc00, spriteType: 'gnoll3' };
const gnoll3_oblivion: EnemyTypeConfig = { ...gnoll3, type: 'gnoll3_oblivion', hp: 680, scale: 4,   speed: 150, damage: 36, attackCooldown: 871,  tint: 0xcc00ff, spriteType: 'gnoll3' };

// ── Definición del Beholder1 ─────────────────────────────────────────────────

const BEHOLDER1_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const beholder1: EnemyTypeConfig = {
  type: 'beholder1',
  hp: 100,
  scale: 4,
  speed: 85,
  damage: 14,
  attackCooldown: 1100,
  actions: {
    idle:   { filename: 'Beholder1_Idle_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(12, BEHOLDER1_DIR) },
    walk:   { filename: 'Beholder1_Walk_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(8,  BEHOLDER1_DIR) },
    run:    { filename: 'Beholder1_Run_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(8,  BEHOLDER1_DIR) },
    attack: { filename: 'Beholder1_Attack_with_shadow',frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(12, BEHOLDER1_DIR) },
    hurt:   { filename: 'Beholder1_Hurt_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(6,  BEHOLDER1_DIR) },
    death:  { filename: 'Beholder1_Death_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(9,  BEHOLDER1_DIR) },
  },
};

const beholder1_elite: EnemyTypeConfig    = { ...beholder1, type: 'beholder1_elite',    hp: 300, scale: 4.5, speed: 94,  damage: 28, attackCooldown: 880, tint: 0xffcc00, spriteType: 'beholder1' };
const beholder1_oblivion: EnemyTypeConfig = { ...beholder1, type: 'beholder1_oblivion', hp: 800, scale: 5, speed: 102, damage: 46, attackCooldown: 740, tint: 0xcc00ff, spriteType: 'beholder1' };

// ── Definición del Beholder2 ─────────────────────────────────────────────────

const BEHOLDER2_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const beholder2: EnemyTypeConfig = {
  type: 'beholder2',
  hp: 130,
  scale: 4,
  speed: 90,
  damage: 18,
  attackCooldown: 1000,
  actions: {
    idle:   { filename: 'Beholder2_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(12, BEHOLDER2_DIR) },
    walk:   { filename: 'Beholder2_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(8,  BEHOLDER2_DIR) },
    run:    { filename: 'Beholder2_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(8,  BEHOLDER2_DIR) },
    attack: { filename: 'Beholder2_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(12, BEHOLDER2_DIR) },
    hurt:   { filename: 'Beholder2_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(6,  BEHOLDER2_DIR) },
    death:  { filename: 'Beholder2_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(9,  BEHOLDER2_DIR) },
  },
};

const beholder2_elite: EnemyTypeConfig    = { ...beholder2, type: 'beholder2_elite',    hp: 390,  scale: 4.5, speed: 99,  damage: 36, attackCooldown: 800, tint: 0xffcc00, spriteType: 'beholder2' };
const beholder2_oblivion: EnemyTypeConfig = { ...beholder2, type: 'beholder2_oblivion', hp: 1040, scale: 5, speed: 108, damage: 60, attackCooldown: 670, tint: 0xcc00ff, spriteType: 'beholder2' };

// ── Definición del Beholder3 ─────────────────────────────────────────────────

const BEHOLDER3_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const beholder3: EnemyTypeConfig = {
  type: 'beholder3',
  hp: 160,
  scale: 4,
  speed: 95,
  damage: 22,
  attackCooldown: 950,
  actions: {
    idle:   { filename: 'Beholder3_Idle_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(12, BEHOLDER3_DIR) },
    walk:   { filename: 'Beholder3_Walk_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(8,  BEHOLDER3_DIR) },
    run:    { filename: 'Beholder3_Run_with_shadow',    frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: -1, directional: true, frames: dirFrames(8,  BEHOLDER3_DIR) },
    attack: { filename: 'Beholder3_Attack_with_shadow', frameWidth: 64, frameHeight: 64, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(12, BEHOLDER3_DIR) },
    hurt:   { filename: 'Beholder3_Hurt_with_shadow',   frameWidth: 64, frameHeight: 64, frameRate: 10, repeat: 0,  directional: true, frames: dirFrames(6,  BEHOLDER3_DIR) },
    death:  { filename: 'Beholder3_Death_with_shadow',  frameWidth: 64, frameHeight: 64, frameRate: 6,  repeat: 0,  directional: true, frames: dirFrames(9,  BEHOLDER3_DIR) },
  },
};

const beholder3_elite: EnemyTypeConfig    = { ...beholder3, type: 'beholder3_elite',    hp: 480,  scale: 4.5, speed: 105, damage: 44, attackCooldown: 760, tint: 0xffcc00, spriteType: 'beholder3' };
const beholder3_oblivion: EnemyTypeConfig = { ...beholder3, type: 'beholder3_oblivion', hp: 1280, scale: 5, speed: 114, damage: 73, attackCooldown: 637, tint: 0xcc00ff, spriteType: 'beholder3' };

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

// ── Definición del Golem2 ────────────────────────────────────────────────────

const GOLEM2_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const golem2: EnemyTypeConfig = {
  type: 'golem2',
  hp: 120,
  scale: 4.5,
  speed: 75,
  damage: 20,
  attackCooldown: 1800,
  actions: {
    idle:   { filename: 'Golem2_Idle_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 4,  repeat: -1, directional: true, frames: dirFrames(4, GOLEM2_DIR) },
    walk:   { filename: 'Golem2_Walk_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(8, GOLEM2_DIR) },
    run:    { filename: 'Golem2_Run_with_shadow',   frameWidth: 128, frameHeight: 128, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(8, GOLEM2_DIR) },
    attack: { filename: 'Golem2_Attack_with_shadow',frameWidth: 128, frameHeight: 128, frameRate: 7,  repeat: 0,  directional: true, frames: dirFrames(9, GOLEM2_DIR) },
    hurt:   { filename: 'Golem2_Hurt_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(4, GOLEM2_DIR) },
    death:  { filename: 'Golem2_Death_with_shadow', frameWidth: 128, frameHeight: 128, frameRate: 5,  repeat: 0,  directional: true, frames: dirFrames(8, GOLEM2_DIR) },
  },
};

const golem2_elite: EnemyTypeConfig    = { ...golem2, type: 'golem2_elite',    hp: 360,  scale: 5.5, speed: 83, damage: 40, attackCooldown: 1440, tint: 0xffcc00, spriteType: 'golem2' };
const golem2_oblivion: EnemyTypeConfig = { ...golem2, type: 'golem2_oblivion', hp: 960,  scale: 6, speed: 90, damage: 66, attackCooldown: 1206, tint: 0xcc00ff, spriteType: 'golem2' };

// ── Definición del Golem3 ────────────────────────────────────────────────────

const GOLEM3_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

const golem3: EnemyTypeConfig = {
  type: 'golem3',
  hp: 160,
  scale: 4.5,
  speed: 80,
  damage: 25,
  attackCooldown: 1600,
  actions: {
    idle:   { filename: 'Golem3_Idle_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 4,  repeat: -1, directional: true, frames: dirFrames(4, GOLEM3_DIR) },
    walk:   { filename: 'Golem3_Walk_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 6,  repeat: -1, directional: true, frames: dirFrames(8, GOLEM3_DIR) },
    run:    { filename: 'Golem3_Run_with_shadow',   frameWidth: 128, frameHeight: 128, frameRate: 8,  repeat: -1, directional: true, frames: dirFrames(8, GOLEM3_DIR) },
    attack: { filename: 'Golem3_Attack_with_shadow',frameWidth: 128, frameHeight: 128, frameRate: 7,  repeat: 0,  directional: true, frames: dirFrames(9, GOLEM3_DIR) },
    hurt:   { filename: 'Golem3_Hurt_with_shadow',  frameWidth: 128, frameHeight: 128, frameRate: 8,  repeat: 0,  directional: true, frames: dirFrames(4, GOLEM3_DIR) },
    death:  { filename: 'Golem3_Death_with_shadow', frameWidth: 128, frameHeight: 128, frameRate: 5,  repeat: 0,  directional: true, frames: dirFrames(8, GOLEM3_DIR) },
  },
};

const golem3_elite: EnemyTypeConfig    = { ...golem3, type: 'golem3_elite',    hp: 480,  scale: 5.5, speed: 88, damage: 50, attackCooldown: 1280, tint: 0xffcc00, spriteType: 'golem3' };
const golem3_oblivion: EnemyTypeConfig = { ...golem3, type: 'golem3_oblivion', hp: 1280, scale: 6, speed: 96, damage: 83, attackCooldown: 1072, tint: 0xcc00ff, spriteType: 'golem3' };

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
  goobling2,
  goobling2_elite,
  goobling2_oblivion,
  goobling3,
  goobling3_elite,
  goobling3_oblivion,
  gnoll1,
  gnoll1_elite,
  gnoll1_oblivion,
  gnoll2,
  gnoll2_elite,
  gnoll2_oblivion,
  gnoll3,
  gnoll3_elite,
  gnoll3_oblivion,
  beholder1,
  beholder1_elite,
  beholder1_oblivion,
  beholder2,
  beholder2_elite,
  beholder2_oblivion,
  beholder3,
  beholder3_elite,
  beholder3_oblivion,
  golem1,
  golem1_elite,
  golem1_oblivion,
  golem2,
  golem2_elite,
  golem2_oblivion,
  golem3,
  golem3_elite,
  golem3_oblivion,
};
