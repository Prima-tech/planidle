import Phaser from 'phaser';

// Texto flotante de combate/recolección (números de daño, MISS, EVADE, curas…):
// aparece en (x, y), sube `rise` píxeles desvaneciéndose y se destruye solo.
// Único punto de estilo/tween para todos — antes había seis copias del mismo bloque.
export interface FloatingTextStyle {
  fontSize: number;          // px
  color: string;
  strokeThickness?: number;  // por defecto 6
  stroke?: string;           // por defecto negro
  rise?: number;             // px que sube (por defecto 35)
  duration?: number;         // ms (por defecto 700)
}

export function spawnFloatingText(
  scene: Phaser.Scene, x: number, y: number, msg: string, style: FloatingTextStyle,
): void {
  const text = scene.add.text(x, y, msg, {
    fontSize:        `${style.fontSize}px`,
    color:           style.color,
    fontStyle:       'bold',
    stroke:          style.stroke ?? '#000000',
    strokeThickness: style.strokeThickness ?? 6,
  });
  text.setOrigin(0.5, 1).setDepth(5000);
  scene.tweens.add({
    targets:    text,
    y:          y - (style.rise ?? 35),
    alpha:      0,
    duration:   style.duration ?? 700,
    ease:       'Power2',
    onComplete: () => text.destroy(),
  });
}
