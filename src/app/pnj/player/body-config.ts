/**
 * Modelo de cuerpo (hoja LPC 64×64, layout 832×3456) por personaje.
 *
 * Por defecto todos comparten `main.png`; los personajes con modelo propio se
 * listan aquí por su NOMBRE de roster. Añadir un modelo nuevo = soltar el PNG en
 * `assets/sprites/player/character/body/` y mapear su nombre aquí.
 */
const DEFAULT_BODY = 'assets/sprites/player/character/body/main.png';

const CHARACTER_BODY: Record<string, string> = {
  Gutts: 'assets/sprites/player/character/body/guts.png',
  Kugo:  'assets/sprites/player/character/body/kugo.png',
};

/** Ruta de la hoja de cuerpo para un personaje (main.png si no tiene modelo propio). */
export function bodySpriteFor(name?: string | null): string {
  return (name && CHARACTER_BODY[name]) || DEFAULT_BODY;
}
