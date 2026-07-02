/**
 * Puntos de interés del Modo Mundo: la POSICIÓN de cada mapa a lo largo de la
 * carrera. Ya NO desbloquean nada por metros (los mapas se COMPRAN con estrellas
 * en el panel de hitos, ver run-milestones.ts): al cruzar el cartel de un mapa
 * que ya esté comprado aparece su botón de entrada (checkUnlockPoints); si no
 * está comprado, el cartel es solo decorativo.
 *
 * También fija la distancia de ARRANQUE al entrar al Modo Mundo por el portal de
 * salida de un mapa (entryDistanceFor): apareces en su cartel, no en el km 0.
 *
 * Vive en un módulo plano (sin Phaser) para poder compartirlo con Angular si
 * hace falta. Añadir más mapas = añadir entradas aquí (distancia + pin).
 */
export interface RunUnlockPoint {
  distanceM: number;
  flag: string;     // clave interna del punto (histórico: flag del mapa)
  mapId: string;    // id de pin del mapa (p.ej. '1-1')
}

export const RUN_UNLOCK_POINTS: RunUnlockPoint[] = [
  { distanceM: 100,  flag: 'map_1_1', mapId: '1-1' },
  { distanceM: 300,  flag: 'map_1_2', mapId: '1-2' },
  { distanceM: 600,  flag: 'map_1_3', mapId: '1-3' },
  { distanceM: 1000, flag: 'map_1_4', mapId: '1-4' },
  { distanceM: 1500, flag: 'map_1_5', mapId: '1-5' },
  { distanceM: 2100, flag: 'map_1_6', mapId: '1-6' },
  { distanceM: 2800, flag: 'map_1_7', mapId: '1-7' },
  { distanceM: 3600, flag: 'map_1_8', mapId: '1-8' },
];
