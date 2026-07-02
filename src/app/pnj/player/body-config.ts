/**
 * Modelo de cuerpo (hoja LPC 64×64, layout 832×3456) por personaje.
 *
 * Los personajes con modelo propio se listan en CHARACTER_BODY por su NOMBRE; el
 * resto cae en DEFAULT_BODY. Añadir un modelo = soltar el PNG en
 * `assets/sprites/player/character/body/` y mapear su nombre aquí.
 */
const BODY_DIR = 'assets/sprites/player/character/body';

// Fallback para nombres sin modelo propio. (main.png se eliminó; usamos guts como base.)
const DEFAULT_BODY = `${BODY_DIR}/guts.png`;

const CHARACTER_BODY: Record<string, string> = {
  Gutts:   `${BODY_DIR}/guts.png`,
  Kugo:    `${BODY_DIR}/kugo.png`,
  Italien: `${BODY_DIR}/italien.png`,
  Orc:     `${BODY_DIR}/orc.png`,
  Rake:    `${BODY_DIR}/rake.png`,
  // Heimdall: NPC dador de la primera misión en Asgard. Reutiliza el sheet de Rake
  // como placeholder (aparece en otro mapa, no coincide en pantalla); soltar un
  // PNG propio en body/ y cambiar la ruta cuando haya arte dedicado.
  Heimdall: `${BODY_DIR}/rake.png`,
};

/** Ruta de la hoja de cuerpo para un personaje (DEFAULT_BODY si no tiene modelo propio). */
export function bodySpriteFor(name?: string | null): string {
  return (name && CHARACTER_BODY[name]) || DEFAULT_BODY;
}
