const FRAME_PX  = 64;
const DIR_ROWS  = 4;

interface EnemyFrameData { src: string; cols: number; fps: number; }

export const ENEMY_FRAMES: Record<string, EnemyFrameData> = {
  slime4: { src: 'assets/sprites/enemy/slime4/Slime1_Idle_with_shadow.png', cols: 6, fps: 6 },
  slime5: { src: 'assets/sprites/enemy/slime5/Slime2_Idle_with_shadow.png', cols: 6, fps: 6 },
  slime6: { src: 'assets/sprites/enemy/slime6/Slime3_Idle_with_shadow.png', cols: 6, fps: 6 },
  orc1:   { src: 'assets/sprites/enemy/orc1/orc1_idle_full.png',            cols: 4, fps: 4 },
};

export function enemySpriteStyle(enemyType: string, displayPx = 48): Record<string, string> {
  const f = ENEMY_FRAMES[enemyType];
  if (!f) return {};
  const scale    = displayPx / FRAME_PX;
  const totalW   = f.cols * displayPx;
  return {
    'background-image':  `url('${f.src}')`,
    'background-size':   `${totalW}px ${DIR_ROWS * displayPx}px`,
    'background-repeat': 'no-repeat',
    '--end-x':           `-${totalW}px`,
    '--duration':        `${f.cols / f.fps}s`,
  };
}

export function enemySpriteClass(enemyType: string): string {
  const f = ENEMY_FRAMES[enemyType];
  return f ? `frames-${f.cols}` : '';
}
