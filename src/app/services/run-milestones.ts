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
}

export const RUN_MILESTONES: RunMilestoneDef[] = [
  {
    id: 'sprint', cost: 1,
    labelKey: 'RUN.MS_SPRINT', descKey: 'RUN.MS_SPRINT_DESC',
    icon: 'flash',
  },
  // Habilidades estilo Idle Slayer (su efecto vive en WorldRunScene, gateado por
  // hasRunMilestone). Costes escalonados: las estrellas persisten entre expediciones.
  {
    id: 'double_jump', cost: 15,
    labelKey: 'RUN.MS_DJUMP', descKey: 'RUN.MS_DJUMP_DESC',
    icon: 'arrow-up-circle',
  },
  {
    id: 'dash', cost: 40,
    labelKey: 'RUN.MS_DASH', descKey: 'RUN.MS_DASH_DESC',
    icon: 'play-forward',
  },
  {
    id: 'slam', cost: 80,
    labelKey: 'RUN.MS_SLAM', descKey: 'RUN.MS_SLAM_DESC',
    icon: 'arrow-down-circle',
  },
  {
    id: 'bow', cost: 150,
    labelKey: 'RUN.MS_BOW', descKey: 'RUN.MS_BOW_DESC',
    icon: 'send',
  },
];
