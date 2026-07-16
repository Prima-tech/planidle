/**
 * Armas del Modo Exploración: generadores pasivos de ESTRELLAS estilo Idle Slayer. Cada
 * arma se sube de NIVEL gastando ORO (monedas del jugador); cada nivel aporta estrellas
 * por segundo. Los niveles son progresión COMPARTIDA de cuenta (RunProgressService, como
 * las estrellas/hitos).
 *
 * Las estrellas se generan mientras exploras (tick de WorldRunScene, igual que la
 * producción de estrellas de los hitos). Añadir un arma = una entrada aquí + sus textos
 * i18n (RUN.WPN_*) + su icono.
 *
 * Módulo plano (sin Phaser ni Angular) para que lo compartan la escena y el servicio.
 */
export interface RunWeaponDef {
  id: string;
  labelKey: string;              // i18n del nombre
  img: string;                   // ruta del icono (pixel-art)
  baseCost: number;              // coste en ORO del PRIMER nivel (0 → 1)
  costGrowth: number;            // multiplicador de coste por cada nivel ya comprado
  starsPerSecPerLevel: number;   // estrellas/seg que aporta cada nivel
  /** Pico de estrellas (saldo máximo alcanzado a la vez) necesario para que el arma
   *  APAREZCA en la pestaña. Sin valor = disponible desde el principio. */
  unlockAtStars?: number;
}

export const RUN_WEAPONS: RunWeaponDef[] = [
  {
    id: 'sword',
    labelKey: 'RUN.WPN_SWORD',
    img: 'assets/icon/weapons/sword1.png',
    baseCost: 10,
    costGrowth: 1.15,
    starsPerSecPerLevel: 0.1,
  },
  {
    id: 'shield',
    labelKey: 'RUN.WPN_SHIELD',
    img: 'assets/sprites/skills/fire/icons/escudo_de_fuego.png',
    baseCost: 60,
    costGrowth: 1.15,
    starsPerSecPerLevel: 1,
    unlockAtStars: 80,   // aparece al llegar a 80 estrellas a la vez
  },
];

/** Armas disponibles según el pico de estrellas alcanzado (saldo máximo a la vez). */
export function unlockedRunWeapons(starsPeak: number): RunWeaponDef[] {
  return RUN_WEAPONS.filter(w => !w.unlockAtStars || starsPeak >= w.unlockAtStars);
}

/** Coste (en oro) de subir del nivel actual `level` al siguiente. Primer nivel (0→1) = baseCost. */
export function weaponUpgradeCost(def: RunWeaponDef, level: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
}

/** Estrellas/seg que produce un arma a un nivel dado. */
export function weaponStarsPerSec(def: RunWeaponDef, level: number): number {
  return def.starsPerSecPerLevel * level;
}
