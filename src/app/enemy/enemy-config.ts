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

// ── Dificultad incremental por tier ──────────────────────────────────────────
// tier = número del mapa donde vive el enemigo (1-1 → 1 … 1-8 → 8). Vida y daño
// salen de UNA curva geométrica (estilo incremental): cada mapa multiplica al
// anterior, así el de un mapa nunca puede ser más flojo que el del mapa previo.
// La EXP por kill se deriva del mismo tier en griddrops (EXP_REWARDS) y el oro
// de las tablas de botín también. Élite/oblivion multiplican ENCIMA de la base
// (×3/×8 vida, ×2/×3 daño), como siempre.
export const TIER_HP_BASE    = 100;
export const TIER_HP_GROWTH  = 1.35;
export const TIER_DMG_BASE   = 7;
export const TIER_DMG_GROWTH = 1.25;

export function tierHp(tier: number): number {
  return Math.round(TIER_HP_BASE * Math.pow(TIER_HP_GROWTH, tier - 1));
}
export function tierDamage(tier: number): number {
  return Math.round(TIER_DMG_BASE * Math.pow(TIER_DMG_GROWTH, tier - 1));
}

// Varianza de daño (±15%): TODO golpe —del jugador y de los enemigos— se multiplica
// por este factor, así los números no salen siempre idénticos. Un solo mando para
// ambos bandos.
export const DAMAGE_VARIANCE = 0.15;
export function rollDamageVariance(): number {
  return 1 - DAMAGE_VARIANCE + Math.random() * DAMAGE_VARIANCE * 2;
}

// ── Config completa de un tipo de enemigo ─────────────────────────────────────

// Arquetipo del ataque:
//  'melee'  — golpe cuerpo a cuerpo (por defecto); esquivable saliendo del rango
//             durante el wind-up.
//  'ranged' — dispara un proyectil al punto donde estás al lanzarlo; esquivable
//             moviéndote antes de que llegue. Se detiene a attackRangeTiles y
//             RETROCEDE (kiting) si te acercas a menos de ~2 tiles.
//  'slam'   — golpe de ÁREA alrededor del enemigo: el círculo naranja crece durante
//             el wind-up y al completarse daña a quien siga dentro.
//  'charge' — embestida: telegrafía una LÍNEA hacia ti y sale disparado por ella;
//             quedarse en la línea = golpe con empujón. Esquivable en perpendicular.
export type EnemyAttackKind = 'melee' | 'ranged' | 'slam' | 'charge';

export interface EnemyTypeConfig {
  type: string;
  tier?: number;           // número de mapa (1..8) — vida/daño/EXP/oro salen de la curva
  hp: number;
  scale: number;
  speed: number;           // px/s
  damage: number;
  attackCooldown: number;  // ms
  attackKind?: EnemyAttackKind; // por defecto 'melee'
  windUpMs?: number;       // ms desde que arranca el golpe hasta el impacto (telegrafía);
                           // si falta → ~40% de la duración de la anim de ataque.
                           // Corto = difícil de esquivar (ratas); largo = muy esquivable (golem)
  attackRangeTiles?: number; // rango al que inicia el ataque; por defecto 2 (melee/slam), 4 (ranged)
  slamRadiusTiles?: number;  // 'slam': radio del área (por defecto 2.2)
  slamEvery?: number;      // cada N golpes, el ataque es un slam (élites melee: 3, oblivion: 4, automático)
  noFlinch?: boolean;      // aplomo: recibe daño sin hurt ni retroceso (golem; élites/oblivion automático)
  enrages?: boolean;       // furia bajo 30% de vida: wind-up y cooldown ×0.8 + tinte rojizo (solo orc1)
  // Sprites de efectos (opcionales, para cuando haya arte): deben ser keys de textura
  // YA CARGADAS en la escena (p.ej. una hoja de skills). Si existe una anim con la
  // misma key se reproduce. Si faltan → efecto procedural (bola con estela / onda).
  projectileSpriteKey?: string; // 'ranged': sprite del proyectil (rotado hacia el objetivo)
  slamSpriteKey?: string;       // 'slam': anim del impacto, escalada al diámetro del área
  displayName?: string;    // nombre visible al jugador (si omitido usa type)
  tint?: number;           // tint visual (0xRRGGBB) — usado para elite/oblivion
  spriteType?: string;     // tipo base cuyos sprites se reusan (omite carga propia)
  spriteBase?: string;     // carpeta de sprites (default 'assets/sprites/enemy/{baseType}')
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
  tier: 3,                 // mapa 1-3
  hp: tierHp(3),
  scale: 3,
  speed: 96,
  damage: tierDamage(3),
  attackCooldown: 1500,
  windUpMs: 600,           // pega fuerte pero telegrafiado: se puede esquivar
  enrages: true,           // bajo 30% de vida entra en furia (ataca ×0.8 más rápido)
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
  tier: 1,                 // mapa 1-1
  hp: tierHp(1),
  scale: 3,
  speed: 150,
  damage: tierDamage(1),
  attackCooldown: 1500,
  windUpMs: 300,           // golpe rápido y flojo: casi imposible de esquivar, poco castigo
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
  tier: 2,                 // variante mejorada (sin mapa asignado aún)
  hp: tierHp(2),
  scale: 3,
  speed: 150,
  damage: tierDamage(2),
  attackCooldown: 1500,
  windUpMs: 300,
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
  tier: 7,                 // mapa 1-7
  hp: tierHp(7),
  scale: 3,
  speed: 115,
  damage: tierDamage(7),
  attackCooldown: 1700,
  windUpMs: 450,
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
  tier: 5,                 // mapa 1-5
  hp: tierHp(5),
  scale: 3,
  speed: 110,
  damage: tierDamage(5),
  attackCooldown: 1600,
  attackKind: 'ranged',    // primer enemigo a distancia: escupe desde 4 tiles
  windUpMs: 500,
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
  tier: 8,                 // mapa 1-8
  hp: tierHp(8),
  scale: 4.5,
  speed: 70,
  damage: tierDamage(8),
  attackCooldown: 2000,
  attackKind: 'slam',      // golpe de ÁREA: círculo telegrafiado ~1s → sal de él o duele
  windUpMs: 900,
  slamRadiusTiles: 2.4,
  noFlinch: true,          // aplomo: tus golpes no lo inmutan (ni hurt ni retroceso)
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
  tier: 2,                 // mapa 1-2
  hp: tierHp(2),
  scale: 3,
  speed: 130,
  damage: tierDamage(2),
  attackCooldown: 1500,
  windUpMs: 250,           // la más rápida del juego: mordisco casi instantáneo
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
  tier: 6,                 // mapa 1-6
  hp: tierHp(6),
  scale: 3,
  speed: 100,
  damage: tierDamage(6),
  attackCooldown: 1400,
  attackKind: 'charge',    // embestida en línea telegrafiada: esquívala en perpendicular
  windUpMs: 600,
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
  tier: 4,                 // mapa 1-4
  hp: tierHp(4),
  scale: 3,
  speed: 110,
  damage: tierDamage(4),
  attackCooldown: 1700,
  windUpMs: 450,
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

// ── Animales de caza ─────────────────────────────────────────────────────────
// Sprites 32×32 direccionales (4 filas: down/up/left/right) en
// assets/sprites/animals/hunt_animals/{Carpeta}/. Son enemigos PASIVOS (vagan,
// no atacan, daño 0) y frágiles (10 HP). Se golpean como cualquier enemigo.

const ANIMAL_DIR: DirOrder = [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT];

function animal(o: {
  type: string; name: string; folder: string; prefix: string;
  walkFile: string; walkCols: number; deathCols: number;
}): EnemyTypeConfig {
  const A = (filename: string, cols: number, fr: number, rep: number): ActionConfig => ({
    filename, frameWidth: 32, frameHeight: 32, frameRate: fr, repeat: rep,
    directional: true, frames: dirFrames(cols, ANIMAL_DIR),
  });
  return {
    type: o.type, displayName: o.name,
    hp: 10, scale: 3, speed: 50, damage: 0, attackCooldown: 999999,
    spriteBase: `assets/sprites/animals/hunt_animals/${o.folder}`,
    actions: {
      idle:  A(`${o.prefix}_Idle_with_shadow`, 4, 4, -1),
      walk:  A(o.walkFile, o.walkCols, 8, -1),
      hurt:  A(`${o.prefix}_Hurt_with_shadow`, 4, 10, 0),
      death: A(`${o.prefix}_Death_with_shadow`, o.deathCols, 8, 0),
    },
  };
}

const fox    = animal({ type: 'fox',          name: 'Zorro',    folder: 'Fox',          prefix: 'Fox',          walkFile: 'Fox_walk_with_shadow',          walkCols: 6, deathCols: 6 });
const hare   = animal({ type: 'hare',         name: 'Liebre',   folder: 'Hare',         prefix: 'Hare',         walkFile: 'Hare_Walk_with_shadow',         walkCols: 5, deathCols: 6 });
const deer   = animal({ type: 'deer',         name: 'Ciervo',   folder: 'Deer',         prefix: 'Deer',         walkFile: 'Deer_Walk_with_shadow',         walkCols: 6, deathCols: 7 });
const boar   = animal({ type: 'boar',         name: 'Jabalí',   folder: 'Boar',         prefix: 'Boar',         walkFile: 'Boar_Walk_with_shadow',         walkCols: 6, deathCols: 6 });
const grouse = animal({ type: 'black_grouse', name: 'Urogallo', folder: 'Black_grouse', prefix: 'Black_grouse', walkFile: 'Black_grouse_Walk_with_shadow', walkCols: 6, deathCols: 6 });

/** Tipos de animal de caza (se spawnean al azar en mapas no-hogar). */
export const ANIMAL_TYPES = ['fox', 'hare', 'deer', 'boar', 'black_grouse'];

// ── Registro global de tipos de enemigo ──────────────────────────────────────
// Para añadir un enemigo nuevo: agregar su config aquí.

export const ENEMY_REGISTRY: Record<string, EnemyTypeConfig> = {
  fox, hare, deer, boar, black_grouse: grouse,
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
