/**
 * Hitos del Modo Mundo: mejoras que se compran con estrellas y se desbloquean para
 * TODA la cuenta (RunProgressService — progresión compartida entre personajes). El
 * panel del HUD de exploración (run-stats) los lista; al comprarlos, su efecto pasa a
 * estar disponible.
 *
 * Añadir un hito = una entrada aquí + sus textos i18n (RUN.MS_*) + cablear su efecto
 * donde corresponda (p.ej. 'sprint' habilita el botón de impulso, ver layout +
 * PlayerBridgeService.activateSprint).
 */
export interface RunMilestoneDef {
  id: string;        // id único (también la clave en RunProgressService.milestones)
  cost: number;      // coste en estrellas (LOCKED = mapas/mejoras "aparcados" tras 1-1)
  labelKey: string;  // i18n: nombre
  descKey: string;   // i18n: descripción del efecto
  icon: string;      // ion-icon
  /** Flag (char) de UnlockService que se marca al comprarlo (p.ej. 'map_1_1' →
   *  desbloquea la feature 'map.1-1' para viajar). Lo aplica run-stats.buy(). */
  unlockFlag?: string;
  /** Hito previo necesario (encadena los mapas: 1-2 pide 1-1, etc.). */
  requires?: string;
}

/** Generadores pasivos: ★/min que produce cada tier comprado (estilo "coins per
 *  second" de Idle Slayer). Producen mientras exploras EN VIVO (tick en
 *  WorldRunScene) y también AFK explorando (OfflineGainsService) — por eso viven
 *  en este módulo plano compartido, sin Phaser. */
export const STAR_PROD_TIERS: { id: string; perMin: number }[] = [
  { id: 'star_prod1', perMin: 6 },
  { id: 'star_prod2', perMin: 18 },
  { id: 'star_prod3', perMin: 36 },
];

/** ★/min totales según los hitos generadores comprados. */
export function starProdPerMin(owned: string[]): number {
  return STAR_PROD_TIERS.reduce((sum, t) => sum + (owned.includes(t.id) ? t.perMin : 0), 0);
}

/** Coste "aparcado": mapas (salvo 1-1) y mejoras que por ahora quedan fuera de
 *  alcance en Modo Exploración. 1d★ = 1 decillón (1e33). El 1-1 sigue en 1M★. */
export const LOCKED_COST = 1e33;

// Escalera de mejoras estilo Idle Slayer (loop: matar → estrellas → comprar →
// llegar más lejos). Orden = orden de compra recomendado (costes crecientes).
// Los efectos viven en WorldRunScene (gateados por runProgress.has), salvo
// 'sprint' (PlayerBridgeService.activateSprint).
export const RUN_MILESTONES: RunMilestoneDef[] = [
  // Impulso: se COMPRA con estrellas (antes lo daba la 1ª misión). Habilita el botón de
  // impulso en el HUD (ver layout + PlayerBridgeService.activateSprint).
  {
    id: 'sprint', cost: 10,
    labelKey: 'RUN.MS_SPRINT', descKey: 'RUN.MS_SPRINT_DESC',
    icon: 'flash',
  },
  // Estrellas valiosas: 2ª habilidad tras el Impulso. +1 al valor de cada estrella.
  {
    id: 'star_value3', cost: 25,
    labelKey: 'RUN.MS_STARVAL3', descKey: 'RUN.MS_STARVAL_DESC',
    icon: 'star',
  },
  // Caja aleatoria: cajas "?" tipo Mario que flotan altas; al saltar y golpearlas
  // desde abajo dan una recompensa ALEATORIA (min. de generación, lluvia de estrellas…).
  // Efecto en WorldRunScene (gateado por has()). Colocada por precio entre las primeras.
  {
    id: 'random_box', cost: 50,
    labelKey: 'RUN.MS_RANDOMBOX', descKey: 'RUN.MS_RANDOMBOX_DESC',
    icon: 'gift',
  },
  // Sin estos hitos NO aparecen enemigos (y sin enemigos no hay estrellas por kill):
  // comprarlos es la primera inversión del loop.
  {
    id: 'enemies', cost: 1000,
    labelKey: 'RUN.MS_ENEMIES', descKey: 'RUN.MS_ENEMIES_DESC',
    icon: 'paw',
  },
  // Sardina: +2% a la producción PASIVA de estrellas/seg (armas + generadores). Efecto
  // en RunProgressService.starProdMult (multiplica starsPerSec y starProdPerMinTotal).
  {
    id: 'sardine', cost: 1500,
    labelKey: 'RUN.MS_SARDINE', descKey: 'RUN.MS_SARDINE_DESC',
    icon: 'fish',
  },
  // Monedako: cada moneda (drop de oro) recogida en el juego da +500 de oro extra.
  // Efecto en griddrops.collectDrop (rama 'currency', gateado por has('monedako')).
  {
    id: 'monedako', cost: 10000,
    labelKey: 'RUN.MS_MONEDAKO', descKey: 'RUN.MS_MONEDAKO_DESC',
    icon: 'cash',
  },
  // Naranja: cada moneda recogida da ORO extra = 10% de tus estrellas/seg actuales.
  // Efecto en griddrops.collectDrop (rama 'currency', usa runProgress.starsPerSecTotal).
  {
    id: 'naranja', cost: 10000,
    labelKey: 'RUN.MS_NARANJA', descKey: 'RUN.MS_NARANJA_DESC',
    icon: 'nutrition',
  },
  // Inflación: cada moneda recogida da ESTRELLAS = 20% de tus estrellas/seg actuales.
  // Efecto en griddrops.collectDrop (rama 'currency', usa runProgress.starsPerSecTotal).
  {
    id: 'inflacion', cost: 25000,
    labelKey: 'RUN.MS_INFLACION', descKey: 'RUN.MS_INFLACION_DESC',
    icon: 'trending-up',
  },
  // Mapas: se COMPRAN aquí (ya no se desbloquean por metros). El 1-1 cuesta 1M★ y
  // además desbloquea el botón de mapa; el resto (1-2…1-8) quedan "aparcados" a 1d★
  // (LOCKED_COST), encadenados (1-2 pide 1-1, etc.).
  {
    id: 'map_1_1', cost: 1000000,
    labelKey: 'RUN.MS_MAP_1_1', descKey: 'RUN.MS_MAP_DESC',
    icon: 'map', unlockFlag: 'map_1_1',
  },
  {
    id: 'double_jump', cost: LOCKED_COST,
    labelKey: 'RUN.MS_DJUMP', descKey: 'RUN.MS_DJUMP_DESC',
    icon: 'arrow-up-circle',
  },
  {
    id: 'hearts', cost: LOCKED_COST,
    labelKey: 'RUN.MS_HEARTS', descKey: 'RUN.MS_HEARTS_DESC',
    icon: 'heart-circle',
  },
  {
    id: 'magnet1', cost: LOCKED_COST,
    labelKey: 'RUN.MS_MAGNET1', descKey: 'RUN.MS_MAGNET1_DESC',
    icon: 'magnet',
  },
  {
    id: 'star_prod1', cost: LOCKED_COST,
    labelKey: 'RUN.MS_PROD1', descKey: 'RUN.MS_PROD1_DESC',
    icon: 'hourglass',
  },
  {
    id: 'star_value1', cost: 35,
    labelKey: 'RUN.MS_STARVAL1', descKey: 'RUN.MS_STARVAL_DESC',
    icon: 'star',
  },
  {
    id: 'dash', cost: LOCKED_COST,
    labelKey: 'RUN.MS_DASH', descKey: 'RUN.MS_DASH_DESC',
    icon: 'play-forward',
  },
  {
    id: 'flying_enemies', cost: LOCKED_COST,
    labelKey: 'RUN.MS_FLYING', descKey: 'RUN.MS_FLYING_DESC',
    icon: 'airplane',
  },
  {
    id: 'heart_boost', cost: LOCKED_COST,
    labelKey: 'RUN.MS_HEART', descKey: 'RUN.MS_HEART_DESC',
    icon: 'heart',
  },
  {
    id: 'slam', cost: LOCKED_COST,
    labelKey: 'RUN.MS_SLAM', descKey: 'RUN.MS_SLAM_DESC',
    icon: 'arrow-down-circle',
  },
  {
    id: 'magnet2', cost: LOCKED_COST,
    labelKey: 'RUN.MS_MAGNET2', descKey: 'RUN.MS_MAGNET2_DESC',
    icon: 'magnet',
  },
  {
    id: 'bow', cost: LOCKED_COST,
    labelKey: 'RUN.MS_BOW', descKey: 'RUN.MS_BOW_DESC',
    icon: 'send',
  },
  {
    id: 'star_prod2', cost: LOCKED_COST,
    labelKey: 'RUN.MS_PROD2', descKey: 'RUN.MS_PROD2_DESC',
    icon: 'timer',
  },
  {
    id: 'star_value2', cost: LOCKED_COST,
    labelKey: 'RUN.MS_STARVAL2', descKey: 'RUN.MS_STARVAL_DESC',
    icon: 'star',
  },
  // Oleada estelar: cada estrella recogida rinde además un 25% de tu producción de
  // estrellas/seg actual (armas + generadores). Efecto en WorldRunScene.collectStar.
  {
    id: 'star_surge', cost: 200,
    labelKey: 'RUN.MS_SURGE', descKey: 'RUN.MS_SURGE_DESC',
    icon: 'sparkles',
  },
  {
    id: 'double_arrows', cost: LOCKED_COST,
    labelKey: 'RUN.MS_ARROWS2', descKey: 'RUN.MS_ARROWS2_DESC',
    icon: 'swap-vertical',
  },
  {
    id: 'boost', cost: LOCKED_COST,
    labelKey: 'RUN.MS_BOOST', descKey: 'RUN.MS_BOOST_DESC',
    icon: 'flame',
  },
  {
    id: 'star_prod3', cost: LOCKED_COST,
    labelKey: 'RUN.MS_PROD3', descKey: 'RUN.MS_PROD3_DESC',
    icon: 'infinite',
  },
  {
    id: 'second_chance', cost: LOCKED_COST,
    labelKey: 'RUN.MS_REVIVE', descKey: 'RUN.MS_REVIVE_DESC',
    icon: 'refresh-circle',
  },
  // Resto de mapas (1d★ cada uno — LOCKED_COST, encadenados al anterior).
  { id: 'map_1_2', cost: LOCKED_COST, labelKey: 'RUN.MS_MAP_1_2', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_2', requires: 'map_1_1' },
  { id: 'map_1_3', cost: LOCKED_COST, labelKey: 'RUN.MS_MAP_1_3', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_3', requires: 'map_1_2' },
  { id: 'map_1_4', cost: LOCKED_COST, labelKey: 'RUN.MS_MAP_1_4', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_4', requires: 'map_1_3' },
  { id: 'map_1_5', cost: LOCKED_COST, labelKey: 'RUN.MS_MAP_1_5', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_5', requires: 'map_1_4' },
  { id: 'map_1_6', cost: LOCKED_COST, labelKey: 'RUN.MS_MAP_1_6', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_6', requires: 'map_1_5' },
  { id: 'map_1_7', cost: LOCKED_COST, labelKey: 'RUN.MS_MAP_1_7', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_7', requires: 'map_1_6' },
  { id: 'map_1_8', cost: LOCKED_COST, labelKey: 'RUN.MS_MAP_1_8', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_8', requires: 'map_1_7' },
];
