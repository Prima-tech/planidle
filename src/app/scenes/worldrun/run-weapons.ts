/**
 * Armas del Modo Exploración: generadores pasivos de ESTRELLAS estilo Idle Slayer. Cada
 * arma se sube de NIVEL gastando ESTRELLAS; cada nivel aporta estrellas por segundo. Los
 * niveles son progresión COMPARTIDA de cuenta (RunProgressService, como estrellas/hitos).
 *
 * Las estrellas se generan mientras exploras (tick de WorldRunScene, igual que la
 * producción de estrellas de los hitos). Añadir un arma = una entrada aquí (con su TIER)
 * + sus textos i18n (RUN.WPN_*) + su icono.
 *
 * ── BALANCE POR TIER (no poner números a mano) ────────────────────────────────────────
 * El coste, la producción y el desbloqueo de cada arma NO se escriben sueltos: salen de su
 * `tier` (0,1,2…) con las constantes de abajo, igual que `tierHp`/`tierDamage` de enemigos.
 * Así la escalada es REGULAR (misma amortización en todos los tiers, sin baches) y se ajusta
 * desde 3-4 mandos:
 *   · WEAPON_BASE_SPS     ★/s por nivel del tier 0.
 *   · WEAPON_SPS_RATIO    cuánto produce cada tier respecto al anterior (×10).
 *   · WEAPON_PAYBACK_SEC  coste base = producción × este nº → amortización CONSTANTE.
 *   · WEAPON_COST_GROWTH  encarecimiento por nivel DENTRO de un arma (autofreno).
 *
 * ── HITOS DE NIVEL (estilo Idle Slayer) ───────────────────────────────────────────────
 * Al alcanzar ciertos niveles (100, 1000, 10000…) el arma gana un multiplicador PERMANENTE
 * a su producción, cada vez mayor cuanto más alto el nivel (ver WEAPON_LEVEL_MILESTONES).
 *
 * Módulo plano (sin Phaser ni Angular) para que lo compartan la escena y el servicio.
 */
export interface RunWeaponDef {
  id: string;
  labelKey: string;              // i18n del nombre
  img: string;                   // ruta del icono (pixel-art)
  tier: number;                  // 0,1,2… — de él salen coste, producción y desbloqueo
  baseCost: number;              // coste en ESTRELLAS del PRIMER nivel (derivado del tier)
  costGrowth: number;            // multiplicador de coste por cada nivel ya comprado
  starsPerSecPerLevel: number;   // estrellas/seg que aporta cada nivel (derivado del tier)
  /** Pico de estrellas (saldo máximo alcanzado a la vez) necesario para que el arma
   *  APAREZCA en la pestaña. Sin valor = disponible desde el principio. */
  unlockAtStars?: number;
}

// ── Mandos de balance de la escalada de armas ─────────────────────────────────────────
const WEAPON_BASE_SPS = 0.1;      // ★/s por nivel del tier 0
const WEAPON_SPS_RATIO = 10;      // cada tier produce ×10 respecto al anterior
const WEAPON_PAYBACK_SEC = 100;   // coste base = ★/s por nivel × este nº (amortización cte.)
const WEAPON_COST_GROWTH = 1.15;  // encarecimiento por nivel dentro de un arma (autofreno)

/** ★/s por nivel de un tier. */
function tierSps(tier: number): number { return WEAPON_BASE_SPS * Math.pow(WEAPON_SPS_RATIO, tier); }
/** Coste base (en estrellas) de un tier: amortización constante = WEAPON_PAYBACK_SEC. */
function tierBaseCost(tier: number): number { return Math.round(tierSps(tier) * WEAPON_PAYBACK_SEC); }

/** Construye una entrada de arma derivando coste/producción/desbloqueo de su tier. El tier 0
 *  está disponible desde el principio; los demás aparecen al alcanzar su coste base en ★. */
function makeWeapon(id: string, labelKey: string, img: string, tier: number): RunWeaponDef {
  return {
    id, labelKey, img, tier,
    starsPerSecPerLevel: tierSps(tier),
    baseCost: tierBaseCost(tier),
    costGrowth: WEAPON_COST_GROWTH,
    unlockAtStars: tier === 0 ? undefined : tierBaseCost(tier),
  };
}

export const RUN_WEAPONS: RunWeaponDef[] = [
  makeWeapon('sword',  'RUN.WPN_SWORD',  'assets/icon/weapons/sword1.png',                        0),
  makeWeapon('shield', 'RUN.WPN_SHIELD', 'assets/sprites/skills/fire/icons/escudo_de_fuego.png', 1),
  makeWeapon('armor',  'RUN.WPN_ARMOR',  'assets/icon/placeholder/torso.png',                    2),
  makeWeapon('helmet', 'RUN.WPN_HELMET', 'assets/icon/placeholder/helm.png',                     3),
  makeWeapon('boots',  'RUN.WPN_BOOTS',  'assets/icon/placeholder/feet.png',                     4),
];

// ── Hitos de nivel (estilo Idle Slayer) ───────────────────────────────────────────────
/** Al alcanzar `level`, el arma multiplica su producción por `mult` (PERMANENTE y
 *  ACUMULATIVO con los hitos anteriores). El multiplicador es mayor cuanto más alto el
 *  nivel. Ajusta/añade filas aquí para tocar la curva de recompensa por subir mucho un arma. */
export const WEAPON_LEVEL_MILESTONES: { level: number; mult: number }[] = [
  { level: 100,     mult: 2 },
  { level: 1000,    mult: 5 },
  { level: 10000,   mult: 10 },
  { level: 100000,  mult: 10 },
];

/** Multiplicador de producción ACUMULADO por los hitos de nivel ya alcanzados (1 si aún no
 *  llegó a ninguno). Ej.: nivel 1200 → ×2 (100) · ×5 (1000) = ×10. */
export function weaponLevelMult(level: number): number {
  let m = 1;
  for (const ms of WEAPON_LEVEL_MILESTONES) if (level >= ms.level) m *= ms.mult;
  return m;
}

/** Próximo hito de nivel a alcanzar (para el HUD), o null si ya se pasaron todos. */
export function nextWeaponMilestone(level: number): { level: number; mult: number } | null {
  return WEAPON_LEVEL_MILESTONES.find(ms => level < ms.level) ?? null;
}

/** Armas disponibles según el pico de estrellas alcanzado (saldo máximo a la vez). */
export function unlockedRunWeapons(starsPeak: number): RunWeaponDef[] {
  return RUN_WEAPONS.filter(w => !w.unlockAtStars || starsPeak >= w.unlockAtStars);
}

/** Coste (en estrellas) de subir del nivel actual `level` al siguiente. Primer nivel (0→1) = baseCost. */
export function weaponUpgradeCost(def: RunWeaponDef, level: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
}

/** Estrellas/seg que produce un arma a un nivel dado, con el multiplicador de HITOS de nivel
 *  ya aplicado (producción lineal por nivel × bonus de hitos alcanzados). */
export function weaponStarsPerSec(def: RunWeaponDef, level: number): number {
  return def.starsPerSecPerLevel * level * weaponLevelMult(level);
}
