import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formato compacto de números grandes: 10000 → "10k", 10000000 → "10M".
 * Por debajo de 1000 se muestra el número tal cual (con separador de miles).
 * Mantiene 1 decimal solo si aporta (1.5k, no 1.0k).
 */
@Pipe({ name: 'compactNumber', standalone: false })
export class CompactNumberPipe implements PipeTransform {
  // Escalera de sufijos (una letra por magnitud, estilo idle): k M B T y luego
  // q Q s S o n d (cuatrillón…decillón). 1d = 1e33 (coste "aparcado" de mapas/mejoras).
  private static readonly UNITS: { value: number; suffix: string }[] = [
    { value: 1e33, suffix: 'd' },
    { value: 1e30, suffix: 'n' },
    { value: 1e27, suffix: 'o' },
    { value: 1e24, suffix: 'S' },
    { value: 1e21, suffix: 's' },
    { value: 1e18, suffix: 'Q' },
    { value: 1e15, suffix: 'q' },
    { value: 1e12, suffix: 'T' },
    { value: 1e9,  suffix: 'B' },
    { value: 1e6,  suffix: 'M' },
    { value: 1e3,  suffix: 'k' },
  ];

  transform(input: number | null | undefined): string {
    const n = Number(input) || 0;
    const abs = Math.abs(n);
    if (abs < 1000) return n.toLocaleString('en-US');

    const sign = n < 0 ? '-' : '';
    for (const { value, suffix } of CompactNumberPipe.UNITS) {
      if (abs >= value) {
        // Trunca a 1 decimal (sin redondear hacia arriba) y quita el ".0".
        const scaled = Math.floor((abs / value) * 10) / 10;
        const text = scaled % 1 === 0 ? String(scaled) : scaled.toFixed(1);
        return `${sign}${text}${suffix}`;
      }
    }
    return n.toLocaleString('en-US');
  }
}
