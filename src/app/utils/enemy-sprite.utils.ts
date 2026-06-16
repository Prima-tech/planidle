import { Direction } from '../pnj/interfaces/Direction';
import {
  ActionConfig, DirectionFrames, ENEMY_REGISTRY, OmniFrames,
} from '../enemy/enemy-config';

const DIR_ROWS = 4;

interface EnemyFrameData { src: string; cols: number; fps: number; }

/**
 * Deriva la hoja de idle (src + columnas + fps) de la fuente de verdad
 * (ENEMY_REGISTRY). Antes había un registro paralelo hardcoded que solo conocía
 * 3 enemigos; al añadir tipos nuevos no se veían en el panel de mundos. Ahora
 * cualquier enemigo del registro funciona sin tocar este archivo.
 */
function frameData(enemyType: string): EnemyFrameData | null {
  const cfg = ENEMY_REGISTRY[enemyType];
  if (!cfg) return null;

  // Las variantes elite/oblivion reusan los sprites del tipo base (spriteType).
  const baseType = cfg.spriteType ?? enemyType;
  const action: ActionConfig | undefined = cfg.actions.idle ?? cfg.actions.walk;
  if (!action) return null;

  const cols = action.directional
    ? framesPerDir(action.frames as DirectionFrames)
    : omniLength(action.frames as OmniFrames);

  return {
    src: `assets/sprites/enemy/${baseType}/${action.filename}.png`,
    cols,
    fps: action.frameRate,
  };
}

/** Frames de la fila DOWN (la que muestra el preview) en una acción direccional. */
function framesPerDir(frames: DirectionFrames): number {
  const down = frames[Direction.DOWN];
  return down.end - down.start + 1;
}

function omniLength(frames: OmniFrames): number {
  return frames.end - frames.start + 1;
}

export function enemySpriteStyle(enemyType: string, displayPx = 48): Record<string, string> {
  const f = frameData(enemyType);
  if (!f) return {};
  const totalW = f.cols * displayPx;
  return {
    'background-image':  `url('${f.src}')`,
    'background-size':   `${totalW}px ${DIR_ROWS * displayPx}px`,
    'background-repeat': 'no-repeat',
    // La animación la aporta la clase frames-N del SCSS de cada componente
    // (world-map-panel y top-bar tienen frames-4/6, que cubren a los enemigos
    // actuales). Para un enemigo con otro nº de frames, añade su regla frames-N.
    '--end-x':           `-${totalW}px`,
    '--duration':        `${f.cols / f.fps}s`,
  };
}

export function enemySpriteClass(enemyType: string): string {
  const f = frameData(enemyType);
  return f ? `frames-${f.cols}` : '';
}
