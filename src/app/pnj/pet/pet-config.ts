// Mascotas: definición de sprites y animaciones.
//
// El spritesheet de cada mascota es una rejilla de frames `frameWidth`×`frameHeight`
// con `cols` columnas. Cada animación ocupa una fila completa: el frame inicial es
// `row * cols` y el final `row * cols + frames - 1`.
//
// El sprite sheet de Aseprite (ver el .json junto al .png) define las filas en este
// orden: Idle, Idle2, Movement, Attack, Damage, Death, Sleep. De momento usamos
// idle + move para que la mascota acompañe al jugador; el resto queda listo para
// futuras habilidades.

export interface PetAnimDef {
  /** Fila (0-indexada) del spritesheet donde está la animación. */
  row: number;
  /** Nº de frames de la fila. */
  frames: number;
  frameRate: number;
  /** -1 = bucle, 0 = una vez. */
  repeat: number;
}

export interface PetConfig {
  id: string;
  name: string;
  /** Clave Phaser de la textura (precargada en gamescene.preload). */
  textureKey: string;
  /** Ruta del spritesheet (también usado como `iconSheet` para el inventario). */
  sheetPath: string;
  frameWidth: number;
  frameHeight: number;
  /** Columnas del spritesheet. */
  cols: number;
  /** Escala del sprite en el mapa. */
  scale: number;
  anims: Record<string, PetAnimDef>;
}

export const PET_REGISTRY: Record<string, PetConfig> = {
  red_panda: {
    id: 'red_panda',
    name: 'Panda Rojo',
    textureKey: 'pet_red_panda',
    sheetPath: 'assets/sprites/pets/red_panda/red_panda.png',
    frameWidth: 32,
    frameHeight: 32,
    cols: 8,
    scale: 3.3,
    // Nº de frames real por fila (algunas filas tienen frames finales vacíos en el
    // spritesheet: idle 6/8, idle2 6/8, damage 5/8). Incluirlos provoca un parpadeo.
    anims: {
      idle:   { row: 0, frames: 6, frameRate: 8,  repeat: -1 },
      idle2:  { row: 1, frames: 6, frameRate: 8,  repeat: -1 },
      move:   { row: 2, frames: 8, frameRate: 12, repeat: -1 },
      attack: { row: 3, frames: 8, frameRate: 14, repeat: 0  },
      damage: { row: 4, frames: 5, frameRate: 12, repeat: 0  },
      death:  { row: 5, frames: 8, frameRate: 10, repeat: 0  },
      sleep:  { row: 6, frames: 8, frameRate: 6,  repeat: -1 },
    },
  },
};

/** Frame que se usa como icono fijo (idle 0). */
export const PET_ICON_FRAME = 0;

/** Nivel máximo que puede alcanzar una mascota. */
export const PET_MAX_LEVEL = 10;
