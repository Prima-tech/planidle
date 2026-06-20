/**
 * Hitos del Modo Mundo: al alcanzar `distanceM` por PRIMERA vez (su flag aún sin
 * marcar) se desbloquea el mapa y aparece el modal de entrada.
 *   · `firstEver` = el primer mapa de todos: el modal solo ofrece "Aceptar" (entra).
 *     En los demás el modal ofrece "Aceptar" (entra) o "Cancelar" (sigue corriendo).
 * El "primera vez" se persiste como flag (char) en UnlockService; el botón "borrar
 * todo" limpia los flags, así que los hitos vuelven a dispararse desde cero.
 * Añadir más mapas = añadir entradas aquí (su distancia, flag y pin de mapa).
 *
 * Vive en un módulo plano (sin Phaser) para poder compartirlo entre la escena
 * (WorldRunScene) y el cálculo de ganancias AFK (OfflineGainsService): los metros
 * acumulados estando AFK explorando desbloquean los mapas que crucen, igual que
 * correrlos en vivo.
 */
export interface RunUnlockPoint {
  distanceM: number;
  flag: string;     // flag (char) que desbloquea la feature 'map.X'
  mapId: string;    // id de pin del mapa (p.ej. '1-1')
  firstEver: boolean;
  // Personaje reclutable que vive en ese mapa (p.ej. Kugo en 1-1). Su desbloqueo es
  // GLOBAL (de cuenta), a diferencia del flag del mapa que es por personaje. Si ya
  // está reclutado, el hito NO fuerza el modal aunque este personaje no tenga aún su
  // flag de mapa: muestra el botón de entrada (ver checkUnlockPoints).
  recruitChar?: string;
}

export const RUN_UNLOCK_POINTS: RunUnlockPoint[] = [
  { distanceM: 100, flag: 'map_1_1', mapId: '1-1', firstEver: true, recruitChar: 'Kugo' },
  { distanceM: 300, flag: 'map_1_2', mapId: '1-2', firstEver: false },
];
