// Recorte de iconos de items que viven en un spritesheet (iconSheet/iconFrame).
// Misma matemática que el inventario (getSheetPos/getSheetBgSize): la celda se
// normaliza a 32px de contenido. Compartido por el panel de info del mapa y el
// modal AFK para no duplicar la fórmula.

/** background-position para mostrar el frame `frame` del sheet en una celda de 32px. */
export function sheetPos(frame = 0, cols = 12, frameSize = 32, contentSize?: number): string {
  const cs    = contentSize ?? frameSize;
  const scale = 32 / cs;
  const col   = frame % cols;
  const row   = Math.floor(frame / cols);
  return `-${col * frameSize * scale}px -${row * frameSize * scale}px`;
}

/** background-size del sheet escalado para que cada frame ocupe 32px de contenido. */
export function sheetBgSize(cols = 12, frameSize = 32, contentSize?: number): string {
  const cs = contentSize ?? frameSize;
  return `${cols * frameSize * (32 / cs)}px auto`;
}
