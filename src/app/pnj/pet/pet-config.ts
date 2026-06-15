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
  /** Columna de inicio dentro de la fila (por defecto 0). Sirve para saltar frames
   *  vacíos al principio de una fila (p.ej. el "emerge" arranca bajo tierra). */
  startCol?: number;
}

/** Un paso de la animación de recogida (al coger un item del suelo). */
export interface PetPickupStep {
  /** Nombre de la anim (clave en `PetConfig.anims`). */
  anim: string;
  /** Si se indica, pasa al siguiente paso tras estos ms; si no, espera a que la anim termine. */
  durationMs?: number;
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
  /** Secuencia de anims al recoger un item. Si falta, no hace nada especial. */
  pickup?: PetPickupStep[];
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
    // Al recoger: hace su animación de ataque y sigue.
    pickup: [{ anim: 'attack' }],
  },
  ferret: {
    id: 'ferret',
    name: 'Hurón',
    textureKey: 'pet_ferret',
    sheetPath: 'assets/sprites/pets/ferret/ferret.png',
    frameWidth: 32,
    frameHeight: 32,
    cols: 8,
    scale: 2.8,   // algo más pequeño que el panda (3.3) pero no tanto
    // Sheet 8×9: Idle, Idle2, Movement, Dig, Disappear, Jump, Emerge, Sleep, Death.
    // La mascota solo usa idle + move; el resto queda listo para el futuro.
    anims: {
      idle:   { row: 0, frames: 8, frameRate: 8,  repeat: -1 },
      idle2:  { row: 1, frames: 8, frameRate: 8,  repeat: -1 },
      move:   { row: 2, frames: 8, frameRate: 12, repeat: -1 },
      // Jump: la fila es un "salto y agarre" (cols 0‑4); las cols 5‑7 son poses
      // tumbadas casi idénticas (frames de más) → solo 0‑4.
      jump:   { row: 5, frames: 5, frameRate: 14, repeat: 0  },
      // Emerge: las cols 0‑2 están vacías/casi vacías (sale de bajo tierra) →
      // empezamos en la col 3 para evitar el "flashazo" del frame en blanco.
      emerge: { row: 6, startCol: 3, frames: 5, frameRate: 12, repeat: 0  },
      sleep:  { row: 7, frames: 8, frameRate: 6,  repeat: -1 },
      death:  { row: 8, frames: 8, frameRate: 10, repeat: 0  },
    },
    // Al recoger: salto+agarre y, a los 500 ms, emerge.
    pickup: [{ anim: 'jump', durationMs: 500 }, { anim: 'emerge' }],
  },
  cactus: {
    id: 'cactus',
    name: 'Cactus',
    textureKey: 'pet_cactus',
    sheetPath: 'assets/sprites/pets/cactus/cactus.png',
    frameWidth: 32,
    frameHeight: 32,
    cols: 8,
    scale: 3.3,
    // Sheet 8×5 (sin Idle2 ni Sleep): Idle, Movement, Attack, Damage, Death.
    // La mascota solo usa idle + move; el resto queda listo para el futuro.
    // Nº de frames real por fila: Damage y Death tienen 3 celdas finales vacías
    // (comprobado por alfa) → 5 reales; incluirlas provocaría parpadeo.
    anims: {
      idle:   { row: 0, frames: 8, frameRate: 8,  repeat: -1 },
      move:   { row: 1, frames: 8, frameRate: 12, repeat: -1 },
      attack: { row: 2, frames: 8, frameRate: 14, repeat: 0  },
      damage: { row: 3, frames: 5, frameRate: 12, repeat: 0  },
      death:  { row: 4, frames: 5, frameRate: 10, repeat: 0  },
    },
    // Al recoger: hace su animación de ataque y sigue.
    pickup: [{ anim: 'attack' }],
  },

  // ── Mascotas sin JSON de Aseprite: rejilla y nº de frames REALES por fila
  // deducidos por análisis de alfa del PNG; el orden de filas (idle/move/…) es
  // INFERIDO por aspecto (idle = fila 0). La mascota solo usa idle + move; si
  // alguna "camina" con una pose rara, ajustar la fila `move`. Sin `pickup`.
  akaname: {
    id: 'akaname', name: 'Akaname', textureKey: 'pet_akaname',
    sheetPath: 'assets/sprites/pets/akaname.png',
    frameWidth: 32, frameHeight: 32, cols: 8, scale: 3.3,
    anims: {
      idle:   { row: 0, frames: 5, frameRate: 8,  repeat: -1 },
      move:   { row: 1, frames: 8, frameRate: 12, repeat: -1 },
      attack: { row: 2, frames: 8, frameRate: 14, repeat: 0  },
      damage: { row: 3, frames: 6, frameRate: 12, repeat: 0  },
    },
  },
  brain: {
    id: 'brain', name: 'Cerebro', textureKey: 'pet_brain',
    sheetPath: 'assets/sprites/pets/brain.png',
    frameWidth: 32, frameHeight: 32, cols: 7, scale: 3.3,
    anims: {
      idle:   { row: 0, frames: 4, frameRate: 8,  repeat: -1 },
      move:   { row: 1, frames: 4, frameRate: 10, repeat: -1 },
      attack: { row: 2, frames: 4, frameRate: 12, repeat: 0  },
      damage: { row: 3, frames: 7, frameRate: 12, repeat: 0  },
    },
  },
  erizo: {
    id: 'erizo', name: 'Erizo', textureKey: 'pet_erizo',
    sheetPath: 'assets/sprites/pets/erizo.png',
    frameWidth: 32, frameHeight: 32, cols: 5, scale: 3.3,
    anims: {
      idle:   { row: 0, frames: 5, frameRate: 8,  repeat: -1 },
      move:   { row: 1, frames: 5, frameRate: 12, repeat: -1 },
      attack: { row: 2, frames: 3, frameRate: 12, repeat: 0  },
      damage: { row: 3, frames: 5, frameRate: 12, repeat: 0  },
      death:  { row: 4, frames: 2, frameRate: 8,  repeat: 0  },
    },
  },
  fly: {
    id: 'fly', name: 'Mosca', textureKey: 'pet_fly',
    sheetPath: 'assets/sprites/pets/fly.png',
    frameWidth: 32, frameHeight: 32, cols: 6, scale: 3.3,
    anims: {
      idle:   { row: 0, frames: 4, frameRate: 8,  repeat: -1 },
      move:   { row: 1, frames: 4, frameRate: 12, repeat: -1 },
      attack: { row: 2, frames: 4, frameRate: 12, repeat: 0  },
      damage: { row: 3, frames: 5, frameRate: 12, repeat: 0  },
    },
  },
  globo: {
    id: 'globo', name: 'Globo', textureKey: 'pet_globo',
    sheetPath: 'assets/sprites/pets/globo.png',
    frameWidth: 32, frameHeight: 32, cols: 7, scale: 3.3,
    anims: {
      idle:   { row: 0, frames: 5, frameRate: 8,  repeat: -1 },
      move:   { row: 1, frames: 5, frameRate: 12, repeat: -1 },
      attack: { row: 2, frames: 5, frameRate: 12, repeat: 0  },
      damage: { row: 3, frames: 6, frameRate: 12, repeat: 0  },
      death:  { row: 4, frames: 3, frameRate: 8,  repeat: 0  },
    },
  },
  rat: {
    id: 'rat', name: 'Rata Azul', textureKey: 'pet_rat',
    sheetPath: 'assets/sprites/pets/rat.png',
    frameWidth: 32, frameHeight: 32, cols: 8, scale: 3.3,
    // r0,r1 parecen idle + idle2 (ambas 8 frames) → move = fila 2.
    anims: {
      idle:   { row: 0, frames: 8, frameRate: 8,  repeat: -1 },
      idle2:  { row: 1, frames: 8, frameRate: 8,  repeat: -1 },
      move:   { row: 2, frames: 6, frameRate: 12, repeat: -1 },
      attack: { row: 3, frames: 6, frameRate: 14, repeat: 0  },
      damage: { row: 4, frames: 4, frameRate: 12, repeat: 0  },
      death:  { row: 5, frames: 5, frameRate: 10, repeat: 0  },
    },
  },
  rat2: {
    id: 'rat2', name: 'Ratón Gris', textureKey: 'pet_rat2',
    sheetPath: 'assets/sprites/pets/rat2.png',
    frameWidth: 32, frameHeight: 32, cols: 24, scale: 3.3,
    anims: {
      idle:   { row: 0, frames: 8,  frameRate: 8,  repeat: -1 },
      move:   { row: 1, frames: 16, frameRate: 14, repeat: -1 },
      attack: { row: 2, frames: 24, frameRate: 14, repeat: 0  },
      damage: { row: 3, frames: 8,  frameRate: 12, repeat: 0  },
      death:  { row: 4, frames: 10, frameRate: 10, repeat: 0  },
    },
  },
  rat3: {
    id: 'rat3', name: 'Rata Carmesí', textureKey: 'pet_rat3',
    sheetPath: 'assets/sprites/pets/rat3.png',
    frameWidth: 32, frameHeight: 32, cols: 8, scale: 3.3,
    anims: {
      idle:   { row: 0, frames: 4, frameRate: 8,  repeat: -1 },
      move:   { row: 1, frames: 8, frameRate: 12, repeat: -1 },
      attack: { row: 2, frames: 8, frameRate: 14, repeat: 0  },
      damage: { row: 3, frames: 4, frameRate: 12, repeat: 0  },
      death:  { row: 4, frames: 7, frameRate: 10, repeat: 0  },
    },
  },
};

/** Frame que se usa como icono fijo (idle 0). */
export const PET_ICON_FRAME = 0;

/** Nivel máximo que puede alcanzar una mascota. */
export const PET_MAX_LEVEL = 10;

/** Exp necesaria para pasar del nivel `level` al siguiente. */
export function petExpNeeded(level: number): number {
  return level * 100;
}

// ── Rango de recogida (px): a qué distancia detecta la mascota los drops ───────
export const PET_PICKUP_RANGE_BASE      = 260;  // nivel 1
export const PET_PICKUP_RANGE_PER_LEVEL = 20;   // +20 px por nivel

/** Rango de recogida de drops según el nivel de la mascota. */
export function petPickupRange(level: number): number {
  return PET_PICKUP_RANGE_BASE + PET_PICKUP_RANGE_PER_LEVEL * (Math.max(1, level) - 1);
}
