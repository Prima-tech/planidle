/**
 * Hitos del Modo Mundo: mejoras que se compran con estrellas (PlayerState.stars) y
 * se desbloquean por personaje (PlayerState.runMilestones). El panel del HUD de
 * exploración (run-stats) los lista; al comprarlos, su efecto pasa a estar disponible.
 *
 * Añadir un hito = una entrada aquí + sus textos i18n (RUN.MS_*) + cablear su efecto
 * donde corresponda (p.ej. 'sprint' habilita el botón de impulso, ver layout +
 * PlayerBridgeService.activateSprint).
 */
export interface RunMilestoneDef {
  id: string;        // id único (también la clave en PlayerState.runMilestones)
  cost: number;      // coste en estrellas
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

// Escalera de mejoras estilo Idle Slayer (loop: matar → estrellas → comprar →
// llegar más lejos). Orden = orden de compra recomendado (costes crecientes).
// Los efectos viven en WorldRunScene (gateados por hasRunMilestone), salvo
// 'sprint' (PlayerBridgeService.activateSprint).
export const RUN_MILESTONES: RunMilestoneDef[] = [
  {
    id: 'sprint', cost: 1,
    labelKey: 'RUN.MS_SPRINT', descKey: 'RUN.MS_SPRINT_DESC',
    icon: 'flash',
  },
  // Sin estos hitos NO aparecen enemigos (y sin enemigos no hay estrellas por kill):
  // comprarlos es la primera inversión del loop.
  {
    id: 'enemies', cost: 5,
    labelKey: 'RUN.MS_ENEMIES', descKey: 'RUN.MS_ENEMIES_DESC',
    icon: 'paw',
  },
  {
    id: 'speed1', cost: 8,
    labelKey: 'RUN.MS_SPEED1', descKey: 'RUN.MS_SPEED_DESC',
    icon: 'speedometer',
  },
  // Mapas: se COMPRAN aquí (ya no se desbloquean por metros). El 1-1 cuesta 1★
  // (primer objetivo, además desbloquea el botón de mapa); el resto 1000★ encadenados.
  {
    id: 'map_1_1', cost: 1,
    labelKey: 'RUN.MS_MAP_1_1', descKey: 'RUN.MS_MAP_DESC',
    icon: 'map', unlockFlag: 'map_1_1',
  },
  {
    id: 'double_jump', cost: 15,
    labelKey: 'RUN.MS_DJUMP', descKey: 'RUN.MS_DJUMP_DESC',
    icon: 'arrow-up-circle',
  },
  {
    id: 'hearts', cost: 20,
    labelKey: 'RUN.MS_HEARTS', descKey: 'RUN.MS_HEARTS_DESC',
    icon: 'heart-circle',
  },
  {
    id: 'magnet1', cost: 25,
    labelKey: 'RUN.MS_MAGNET1', descKey: 'RUN.MS_MAGNET1_DESC',
    icon: 'magnet',
  },
  {
    id: 'star_prod1', cost: 30,
    labelKey: 'RUN.MS_PROD1', descKey: 'RUN.MS_PROD1_DESC',
    icon: 'hourglass',
  },
  {
    id: 'star_value1', cost: 35,
    labelKey: 'RUN.MS_STARVAL1', descKey: 'RUN.MS_STARVAL_DESC',
    icon: 'star',
  },
  {
    id: 'dash', cost: 40,
    labelKey: 'RUN.MS_DASH', descKey: 'RUN.MS_DASH_DESC',
    icon: 'play-forward',
  },
  {
    id: 'flying_enemies', cost: 50,
    labelKey: 'RUN.MS_FLYING', descKey: 'RUN.MS_FLYING_DESC',
    icon: 'airplane',
  },
  {
    id: 'heart_boost', cost: 60,
    labelKey: 'RUN.MS_HEART', descKey: 'RUN.MS_HEART_DESC',
    icon: 'heart',
  },
  {
    id: 'speed2', cost: 75,
    labelKey: 'RUN.MS_SPEED2', descKey: 'RUN.MS_SPEED_DESC',
    icon: 'speedometer',
  },
  {
    id: 'slam', cost: 80,
    labelKey: 'RUN.MS_SLAM', descKey: 'RUN.MS_SLAM_DESC',
    icon: 'arrow-down-circle',
  },
  {
    id: 'magnet2', cost: 120,
    labelKey: 'RUN.MS_MAGNET2', descKey: 'RUN.MS_MAGNET2_DESC',
    icon: 'magnet',
  },
  {
    id: 'bow', cost: 150,
    labelKey: 'RUN.MS_BOW', descKey: 'RUN.MS_BOW_DESC',
    icon: 'send',
  },
  {
    id: 'star_prod2', cost: 180,
    labelKey: 'RUN.MS_PROD2', descKey: 'RUN.MS_PROD2_DESC',
    icon: 'timer',
  },
  {
    id: 'star_value2', cost: 200,
    labelKey: 'RUN.MS_STARVAL2', descKey: 'RUN.MS_STARVAL_DESC',
    icon: 'star',
  },
  {
    id: 'double_arrows', cost: 250,
    labelKey: 'RUN.MS_ARROWS2', descKey: 'RUN.MS_ARROWS2_DESC',
    icon: 'swap-vertical',
  },
  {
    id: 'speed3', cost: 300,
    labelKey: 'RUN.MS_SPEED3', descKey: 'RUN.MS_SPEED_DESC',
    icon: 'speedometer',
  },
  {
    id: 'boost', cost: 350,
    labelKey: 'RUN.MS_BOOST', descKey: 'RUN.MS_BOOST_DESC',
    icon: 'flame',
  },
  {
    id: 'star_prod3', cost: 400,
    labelKey: 'RUN.MS_PROD3', descKey: 'RUN.MS_PROD3_DESC',
    icon: 'infinite',
  },
  {
    id: 'second_chance', cost: 500,
    labelKey: 'RUN.MS_REVIVE', descKey: 'RUN.MS_REVIVE_DESC',
    icon: 'refresh-circle',
  },
  // Resto de mapas (1000★ cada uno, encadenados al anterior).
  { id: 'map_1_2', cost: 1000, labelKey: 'RUN.MS_MAP_1_2', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_2', requires: 'map_1_1' },
  { id: 'map_1_3', cost: 1000, labelKey: 'RUN.MS_MAP_1_3', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_3', requires: 'map_1_2' },
  { id: 'map_1_4', cost: 1000, labelKey: 'RUN.MS_MAP_1_4', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_4', requires: 'map_1_3' },
  { id: 'map_1_5', cost: 1000, labelKey: 'RUN.MS_MAP_1_5', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_5', requires: 'map_1_4' },
  { id: 'map_1_6', cost: 1000, labelKey: 'RUN.MS_MAP_1_6', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_6', requires: 'map_1_5' },
  { id: 'map_1_7', cost: 1000, labelKey: 'RUN.MS_MAP_1_7', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_7', requires: 'map_1_6' },
  { id: 'map_1_8', cost: 1000, labelKey: 'RUN.MS_MAP_1_8', descKey: 'RUN.MS_MAP_DESC', icon: 'map', unlockFlag: 'map_1_8', requires: 'map_1_7' },
];
