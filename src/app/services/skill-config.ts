// 'impact'    — el sprite aparece directamente sobre el enemigo
// 'projectile' — el sprite viaja desde el jugador hasta el enemigo
export type SkillEffectType = 'impact' | 'projectile';

export interface SkillConfig {
  abilityId: string;
  effectType: SkillEffectType;
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
    damage: 10,
    range: 4,
    cooldown: 1500,
    spriteKey: 'skill_fire',
    frameCount: 6,
    frameRate: 12,
    scale: 2,
    iconPath: 'assets/sprites/skills/icons/fire.png',
  },
};
