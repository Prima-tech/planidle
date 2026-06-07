// 'impact'    — el sprite aparece directamente sobre el enemigo
// 'projectile' — el sprite viaja desde el jugador hasta el enemigo
export type SkillEffectType = 'impact' | 'projectile';

export type SkillTarget = 'enemy' | 'self';

export interface SkillConfig {
  abilityId: string;
  effectType: SkillEffectType;
  target?: SkillTarget;   // 'enemy' (por defecto) | 'self' — habilidades sobre el propio jugador
  damage: number;
  range: number;        // tiles
  cooldown: number;     // ms
  spriteKey: string;
  frameCount: number;
  frameRate: number;
  scale: number;
  iconPath?: string;    // imagen para el botón del footer
  speed?: number;       // world pixels/second — solo para 'projectile'
}

export const SKILL_REGISTRY: Record<string, SkillConfig> = {
  ranged_attack: {
    abilityId: 'ranged_attack',
    effectType: 'impact',
    damage: 0,
    range: 4,
    cooldown: 1500,
    spriteKey: 'skill_fire',
    frameCount: 6,
    frameRate: 12,
    scale: 2,
    iconPath: 'assets/sprites/skills/icons/fire.png',
  },
  small_fire: {
    abilityId: 'small_fire',
    effectType: 'impact',
    damage: 0,
    range: 3,
    cooldown: 1000,
    spriteKey: 'skill_small_fire',
    frameCount: 6,
    frameRate: 12,
    scale: 1.5,
    iconPath: 'assets/sprites/skills/icons/fuego_pequeno.png',
  },
  fire_flower: {
    abilityId: 'fire_flower',
    effectType: 'impact',
    damage: 0,
    range: 3,
    cooldown: 2500,
    spriteKey: 'skill_fire_flower',
    frameCount: 11,
    frameRate: 12,
    scale: 2.5,
    iconPath: 'assets/sprites/skills/icons/flor_de_fuego.png',
  },
  fire_pillar: {
    abilityId: 'fire_pillar',
    effectType: 'impact',
    damage: 0,
    range: 3,
    cooldown: 1800,
    spriteKey: 'skill_fire_pillar',
    frameCount: 8,
    frameRate: 12,
    scale: 2.5,
    iconPath: 'assets/sprites/skills/icons/pilar_de_fuego.png',
  },
  fire_shield: {
    abilityId: 'fire_shield',
    effectType: 'impact',
    target: 'self',
    damage: 0,
    range: 0,
    cooldown: 4000,
    spriteKey: 'skill_fire_shield',
    frameCount: 8,
    frameRate: 10,
    scale: 2.5,
    iconPath: 'assets/sprites/skills/icons/escudo_de_fuego.png',
  },
  lava_paddle: {
    abilityId: 'lava_paddle',
    effectType: 'impact',
    damage: 0,
    range: 3,
    cooldown: 1500,
    spriteKey: 'skill_lava_paddle',
    frameCount: 10,
    frameRate: 12,
    scale: 2,
    iconPath: 'assets/sprites/skills/icons/paleta_de_lava.png',
  },
  fireball: {
    abilityId: 'fireball',
    effectType: 'projectile',
    damage: 0,
    range: 5,
    cooldown: 2000,
    spriteKey: 'skill_fireball',
    frameCount: 15,
    frameRate: 14,
    scale: 2,
    speed: 350,
    iconPath: 'assets/sprites/skills/icons/bola_de_fuego.png',
  },
  fire_hurricane: {
    abilityId: 'fire_hurricane',
    effectType: 'impact',
    damage: 0,
    range: 3,
    cooldown: 3000,
    spriteKey: 'skill_fire_hurricane',
    frameCount: 14,
    frameRate: 12,
    scale: 3,
    iconPath: 'assets/sprites/skills/icons/huracan_de_fuego.png',
  },
  lava_drop: {
    abilityId: 'lava_drop',
    effectType: 'impact',
    damage: 0,
    range: 4,
    cooldown: 2000,
    spriteKey: 'skill_lava_drop',
    frameCount: 16,
    frameRate: 14,
    scale: 2.5,
    iconPath: 'assets/sprites/skills/icons/gota_de_lava.png',
  },
  magma_geyser: {
    abilityId: 'magma_geyser',
    effectType: 'impact',
    damage: 0,
    range: 3,
    cooldown: 2500,
    spriteKey: 'skill_magma_geyser',
    frameCount: 11,
    frameRate: 12,
    scale: 3,
    iconPath: 'assets/sprites/skills/icons/geiser_de_lava.png',
  },
  phoenix: {
    abilityId: 'phoenix',
    effectType: 'projectile',
    damage: 0,
    range: 6,
    cooldown: 5000,
    spriteKey: 'skill_phoenix',
    frameCount: 16,
    frameRate: 12,
    scale: 3,
    speed: 300,
    iconPath: 'assets/sprites/skills/icons/fenix.png',
  },
};
